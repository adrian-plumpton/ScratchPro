// Sparkjam jam sync test: two editors in one browser, joined by a stand-in for Liveblocks (a
// BroadcastChannel) and the jams API (localStorage). Checks that joining copies the game, and that block
// edits, sprite changes and bigger changes reach the other editor. Needs a build served on localhost.
// Run: BASE_URL=http://localhost:8601 node test/smoke/jam-sync.mjs

import {chromium} from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const failures = [];
const check = (ok, message) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
    if (!ok) failures.push(message);
};

// Runs in each page before Sparkjam loads.
const fakeLiveblocks = name => {
    window.__jamLog = [];
    const toBase64 = buffer => {
        let text = '';
        new Uint8Array(buffer).forEach(b => {
            text += String.fromCharCode(b);
        });
        return btoa(text);
    };
    window.__sjJamTest = {
        endJam: () => Promise.resolve(),
        removeFromJam: () => Promise.resolve(),
        saveSnapshot: async (code, blob) => {
            localStorage.setItem(`jam-${code}`, toBase64(await blob.arrayBuffer()));
        },
        loadSnapshot: code => {
            const text = atob(localStorage.getItem(`jam-${code}`));
            const bytes = new Uint8Array(text.length);
            for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
            return Promise.resolve(bytes.buffer);
        },
        createClient: () => ({
            enterRoom (roomId, {initialPresence}) {
                const channel = new BroadcastChannel(`jam-test-${roomId}`);
                const me = {connectionId: Date.now(), id: `user-${name}`, info: {name, color: '#36f9c6'}};
                let presence = {...initialPresence};
                const others = new Map();
                const subs = {others: new Set(), event: new Set(), status: new Set()};
                const othersList = () => [...others.values()];
                const emitOthers = () => subs.others.forEach(cb => cb(othersList()));
                const post = message => channel.postMessage({...message, from: me});
                channel.onmessage = ({data}) => {
                    const from = data.from;
                    if (data.kind === 'hello' || data.kind === 'here' || data.kind === 'presence') {
                        others.set(from.connectionId, {...from, presence: data.presence});
                        if (data.kind === 'hello') post({kind: 'here', presence});
                        emitOthers();
                    } else if (data.kind === 'bye') {
                        others.delete(from.connectionId);
                        emitOthers();
                    } else if (data.kind === 'event') {
                        window.__jamLog.push(data.event.type === 'block' ?
                            `${data.event.json.type}:${data.event.json.blockId}:${data.event.json.newParentId || ''}` :
                            data.event.type);
                        subs.event.forEach(cb => cb({event: data.event, user: from, connectionId: from.connectionId}));
                    }
                };
                const room = {
                    subscribe: (type, cb) => {
                        subs[type].add(cb);
                        return () => subs[type].delete(cb);
                    },
                    getStatus: () => 'connected',
                    getSelf: () => me,
                    getOthers: () => othersList(),
                    broadcastEvent: event => post({kind: 'event', event}),
                    updatePresence: patch => {
                        presence = {...presence, ...patch};
                        post({kind: 'presence', presence});
                    }
                };
                post({kind: 'hello', presence});
                return {room, leave: () => post({kind: 'bye'})};
            }
        })
    };
};

const JAM = {code: '1234', roomId: 'jam-1234-test', title: 'Test jam', hostName: 'A', isHost: true};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const context = await browser.newContext({viewport: {width: 1300, height: 850}});
const errors = [];
const open = async (name, url) => {
    const page = await context.newPage();
    page.on('pageerror', err => errors.push(`${name}: ${err.message}`));
    await page.addInitScript(fakeLiveblocks, name);
    await page.goto(`${BASE_URL}${url}`);
    await page.waitForSelector('.blocklyWorkspace', {timeout: 120000});
    await page.waitForFunction(() => window.vm && vm.runtime.targets.length > 0, null, {timeout: 60000});
    await page.waitForTimeout(2000);
    return page;
};

// A starts a jam on Spark Hop.
const a = await open('A', '/editor.html?sample=spark-hop');
await a.evaluate(async jam => {
    await window.__sjJamTest.saveSnapshot(jam.code, await window.__sjJam.saveForJam(vm));
    await window.__sjJam.joinJam(vm, jam, {needsGame: false});
}, JAM);
check(await a.evaluate(() => window.__sjJam.getJamState().status) === 'live', 'A starts a jam');

// B joins from an empty editor and gets the game from A.
const b = await open('B', '/editor.html?blank');
await b.evaluate(jam => window.__sjJam.joinJam(vm, {...jam, isHost: false}, {needsGame: true}), JAM);
await b.waitForFunction(() => window.__sjJam.getJamState().status === 'live', null, {timeout: 30000});
check(await b.evaluate(() => vm.runtime.targets.some(t => t.getName() === 'Player')), 'B gets the game when joining');
check(await a.evaluate(() => window.__sjJam.getJamState().others.map(o => o.name).join()) === 'B',
    'A sees B in the jam');
await a.waitForTimeout(6000); // Let the newly loaded game settle (My games waits for this too).

// Both look at the Player sprite.
for (const page of [a, b]) {
    await page.evaluate(() => vm.setEditingTarget(vm.runtime.getSpriteTargetByName('Player').id));
}
await a.waitForTimeout(1500);

// A adds a block to Player in the code area; B gets it, in the game and in the code area.
const blockId = await a.evaluate(() => {
    // Like dragging "turn 15 degrees" out of the palette: the block and its number slot.
    const workspace = ScratchBlocks.getMainWorkspace();
    const xml = ScratchBlocks.Xml.textToDom('<xml><block type="motion_turnright"><value name="DEGREES">' +
        '<shadow type="math_number"><field name="NUM">15</field></shadow></value></block></xml>');
    const block = ScratchBlocks.Xml.domToBlock(xml.firstChild, workspace);
    block.moveBy(400, 300);
    return block.id;
});
await a.waitForTimeout(1500);
check(await b.evaluate(id => !!vm.runtime.getSpriteTargetByName('Player').blocks.getBlock(id), blockId),
    'A block A adds reaches B\'s game');
check(await b.evaluate(id => !!ScratchBlocks.getMainWorkspace().getBlockById(id), blockId),
    'and appears in B\'s code area');

// A snaps it under the top block of a Player script, then changes its number.
const snapped = await a.evaluate(id => {
    const workspace = ScratchBlocks.getMainWorkspace();
    const block = workspace.getBlockById(id);
    const top = workspace.getTopBlocks(true).find(t => t.id !== id && t.nextConnection);
    let last = top;
    while (last.getNextBlock()) last = last.getNextBlock();
    last.nextConnection.connect(block.previousConnection);
    const number = block.getInputTargetBlock('DEGREES');
    number.setFieldValue('45', 'NUM');
    return {parent: last.id, number: number.id};
}, blockId);
await a.waitForTimeout(1500);
check(await b.evaluate(({id, parent}) => vm.runtime.getSpriteTargetByName('Player').blocks.getBlock(id).parent === parent,
    {id: blockId, parent: snapped.parent}), 'Snapping a block into a script reaches B');
check(await b.evaluate(id => vm.runtime.getSpriteTargetByName('Player').blocks.getBlock(id).fields.NUM.value,
    snapped.number) === '45', 'Changing a number in a block reaches B');

// B deletes it; A loses it too.
await b.evaluate(id => ScratchBlocks.getMainWorkspace().getBlockById(id).dispose(true), blockId);
await b.waitForTimeout(1500);
check(await a.evaluate(id => !vm.runtime.getSpriteTargetByName('Player').blocks.getBlock(id), blockId),
    'B deleting it removes it for A');

// B looks at another sprite while A edits Player; B sees the change on switching back.
await b.evaluate(() => vm.setEditingTarget(vm.runtime.getSpriteTargetByName('Spark').id));
await b.waitForTimeout(800);
const hiddenId = await a.evaluate(() => {
    const workspace = ScratchBlocks.getMainWorkspace();
    const xml = ScratchBlocks.Xml.textToDom('<xml><block type="looks_show"></block></xml>');
    const block = ScratchBlocks.Xml.domToBlock(xml.firstChild, workspace);
    block.moveBy(500, 500);
    return block.id;
});
await a.waitForTimeout(1500);
await b.evaluate(() => vm.setEditingTarget(vm.runtime.getSpriteTargetByName('Player').id));
await b.waitForTimeout(1500);
check(await b.evaluate(id => !!ScratchBlocks.getMainWorkspace().getBlockById(id), hiddenId),
    'Edits to a sprite you aren\'t looking at are there when you open it');

// A drags a script with the mouse: while dragging, B sees a see-through copy following it.
const dragged = await a.evaluate(() => {
    const top = ScratchBlocks.getMainWorkspace().getTopBlocks(true)
        .find(b => b.type === 'event_whenflagclicked');
    const box = top.getSvgRoot().getBoundingClientRect();
    return {id: top.id, x: box.left + 20, y: box.top + 15};
});
await a.bringToFront();
await a.mouse.move(dragged.x, dragged.y);
await a.mouse.down();
for (let i = 1; i <= 10; i++) await a.mouse.move(dragged.x + (i * 12), dragged.y + (i * 6));
await a.waitForTimeout(400);
check(await b.evaluate(() => document.querySelectorAll('.blocklyBlockCanvas > g[style*="opacity: 0.6"]').length) === 1,
    'B sees A dragging blocks, live');
await a.mouse.up();
await a.waitForTimeout(1500);
check(await b.evaluate(() => document.querySelectorAll('.blocklyBlockCanvas > g[style*="opacity: 0.6"]').length) === 0,
    'and the copy goes when A drops them');
const [aPos, bPos] = await Promise.all([a, b].map(page => page.evaluate(id => {
    const block = vm.runtime.getSpriteTargetByName('Player').blocks.getBlock(id);
    return `${Math.round(block.x)},${Math.round(block.y)}`;
}, dragged.id)));
check(aPos === bPos, `The dropped script lands in the same place for both (${aPos} and ${bPos})`);

// A drags a sprite on the stage: B sees it move while it's still being dragged.
await a.evaluate(() => {
    const blob = vm.runtime.getSpriteTargetByName('Blob');
    blob.dragging = true;
    blob.setXY(-120, 60, true); // Forced, as the stage does while dragging.
});
await a.waitForTimeout(500);
check(await b.evaluate(() => Math.round(vm.runtime.getSpriteTargetByName('Blob').x)) === -120,
    'B sees a sprite being dragged, live');
await a.evaluate(() => {
    vm.runtime.getSpriteTargetByName('Blob').dragging = false;
});

// A moves the Blob sprite; B's Blob moves.
await a.evaluate(() => {
    vm.setEditingTarget(vm.runtime.getSpriteTargetByName('Blob').id);
    vm.postSpriteInfo({x: 77, y: -40});
});
await a.waitForTimeout(2500);
check(await b.evaluate(() => Math.round(vm.runtime.getSpriteTargetByName('Blob').x)) === 77,
    'Moving a sprite reaches the other editor');

// A renames a sprite (a bigger change): B reloads the game with the new name.
await a.evaluate(() => vm.renameSprite(vm.runtime.getSpriteTargetByName('Blob').id, 'Slime'));
await b.waitForFunction(() => vm.runtime.targets.some(t => t.getName() === 'Slime'), null, {timeout: 15000})
    .catch(() => {});
check(await b.evaluate(() => vm.runtime.targets.some(t => t.getName() === 'Slime')),
    'Bigger changes (renaming a sprite) reach the other editor');

// A ends the jam with the END button; B is told and keeps their copy.
await a.bringToFront();
await a.getByRole('button', {name: 'END', exact: true}).click();
await a.getByRole('button', {name: 'YES, END IT'}).click();
await b.waitForFunction(() => window.__sjJam.getJamState().status === 'ended', null, {timeout: 10000}).catch(() => {});
check(await b.evaluate(() => window.__sjJam.getJamState().status) === 'ended', 'Ending the jam tells everyone');
check(await b.getByText('ended the jam').isVisible(), 'and B sees who ended it');
check(await a.evaluate(() => window.__sjJam.getJamState().status) === 'idle', 'and A is back to making on their own');

check(errors.length === 0, `No page errors${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();
if (failures.length) {
    console.log(`\n${failures.length} check(s) failed`);
    process.exit(1);
}
console.log('\nAll checks passed');
