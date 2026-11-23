// Sparkjam smoke test, on a phone: the landing page and games gallery work, every sample game opens
// on the game page and responds to its controls, Remix opens the editor, and old links still work.
// Run against a served build: BASE_URL=http://localhost:8601 node test/smoke/sample-games.mjs

import {chromium, devices} from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8601';
const failures = [];
const check = (ok, message) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
    if (!ok) failures.push(message);
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {});
const context = await browser.newContext({...devices['Pixel 7']});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', err => pageErrors.push(err.message));

const spriteNames = () => page.evaluate(() => vm.runtime.targets.filter(t => t.isOriginal).map(t => t.getName()));
const stageVar = name => page.evaluate(n => {
    const v = Object.values(vm.runtime.getTargetForStage().variables).find(x => x.name === n);
    return v ? Number(v.value) : NaN;
}, name);
const spriteX = name => page.evaluate(n => vm.runtime.getSpriteTargetByName(n).x, name);
const controls = () => page.evaluate(() => ({
    joystick: document.querySelectorAll('[class*="joystick-base"]').length > 0,
    buttons: [...document.querySelectorAll('[class*="action-button"]')].map(b => b.textContent.trim())
}));
const holdKey = async (key, ms) => {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    await page.keyboard.up(key);
};

// Landing page: no game engine, four sample games, and jams explain they are coming soon.
await page.goto(`${BASE_URL}/`);
check(await page.locator('h1', {hasText: 'Make games with friends'}).isVisible(), 'The landing page loads');
check(await page.locator('article').count() === 4, 'The landing page shows 4 sample games');
check(await page.evaluate(() => typeof window.vm === 'undefined'), 'The landing page loads no game engine');
await page.locator('#jam-code-hero').fill('12');
await page.locator('#jam-code-hero').press('Enter');
check(await page.getByText('Jam codes are 4 numbers').isVisible(), 'A wrong jam code is explained');
await page.locator('#jam-code-hero').fill('4827');
await page.locator('#jam-code-hero').press('Enter');
await page.waitForURL(/editor\.html\?jam=4827/);
await page.locator('[aria-label="Your Sparkjam account"]').waitFor({timeout: 120000});
check(true, 'Joining a jam opens the editor and asks to sign in');

// Old links to a project on the home page go to the game page.
await page.goto(`${BASE_URL}/#60917032`);
await page.waitForURL(/\/game#60917032$/);
check(true, 'Old /#id links open the game page');

// The game page opens Spark Hop by default.
await page.goto(`${BASE_URL}/game`);
await page.waitForFunction(() => window.vm && vm.runtime.targets.length > 1, null, {timeout: 120000});
await page.waitForTimeout(1500);
check((await spriteNames()).includes('Player'), 'The game page opens Spark Hop by default');

// The gallery filters games and rejects things that aren't Scratch links.
await page.goto(`${BASE_URL}/games`);
await page.getByRole('button', {name: 'MAZES'}).click();
check(await page.locator('article').count() === 1, 'The gallery filters games');
await page.getByRole('button', {name: 'ALL'}).click();
await page.locator('#scratch-link').fill('hello');
await page.locator('#scratch-link').press('Enter');
check(await page.getByRole('alert').isVisible(), 'The gallery explains a bad Scratch link');

const GAMES = [
    {
        title: 'Spark Hop', sprite: 'Player', controls: {joystick: true, buttons: ['Space', 'X']},
        test: async () => {
            // Check the clock before moving: a spark picked up on the way adds a second.
            await page.waitForTimeout(1000);
            check(await stageVar('Time') < 60, 'Spark Hop: the clock counts down');
            const x = await spriteX('Player');
            await holdKey('ArrowRight', 700);
            check(await spriteX('Player') > x + 40, 'Spark Hop: the player runs right');
        }
    },
    {
        title: 'Lane Dash', sprite: 'Stripes', controls: {joystick: true, buttons: ['Space']},
        test: async () => {
            const x = await spriteX('Player');
            await holdKey('ArrowLeft', 500);
            check(await spriteX('Player') < x - 20, 'Lane Dash: the car steers left');
            check(await stageVar('Score') > 0, 'Lane Dash: the score goes up');
        }
    },
    {
        title: 'Bubble Pop', sprite: 'Bubble', controls: {joystick: false, buttons: []},
        test: async () => {
            await page.waitForTimeout(1500);
            // Bubbles drift, so tap one that is clear of the fish, and try a few times.
            const findBubble = () => page.evaluate(() => {
                const bubbles = vm.runtime.targets.filter(t => !t.isOriginal && t.getName() === 'Bubble' &&
                    t.currentCostume === 0 && t.y > -60 && t.y < 120);
                return bubbles.length ? {x: bubbles[0].x, y: bubbles[0].y + 4} : null;
            });
            // Bubbles appear at random, so give one up to 5 seconds to drift into view.
            let seen = await findBubble() !== null;
            for (let i = 0; i < 10 && !seen; i++) {
                await page.waitForTimeout(500);
                seen = await findBubble() !== null;
            }
            check(seen, 'Bubble Pop: bubbles float up');
            const box = await page.locator('canvas').first().boundingBox();
            for (let attempt = 0; attempt < 5 && await stageVar('Score') < 1; attempt++) {
                const target = await findBubble();
                if (target) {
                    await page.mouse.click(box.x + ((target.x + 240) / 480 * box.width),
                        box.y + ((180 - target.y) / 360 * box.height));
                }
                await page.waitForTimeout(400);
            }
            check(await stageVar('Score') >= 1, 'Bubble Pop: tapping a bubble scores a point');
        }
    },
    {
        title: 'Gem Maze', sprite: 'Hero', controls: {joystick: true, buttons: []},
        test: async () => {
            const x = await spriteX('Hero');
            await holdKey('ArrowRight', 600);
            check(await spriteX('Hero') > x + 30, 'Gem Maze: the hero walks right');
        }
    }
];

for (const game of GAMES) {
    await page.goto(`${BASE_URL}/games`);
    await page.getByRole('link', {name: `Play ${game.title}`}).click();
    await page.waitForFunction(s => window.vm && vm.runtime.targets.some(t => t.getName() === s), game.sprite,
        {timeout: 60000});
    await page.waitForTimeout(1200);
    check(true, `${game.title}: opens on the game page from the gallery`);
    check(await page.locator('h1', {hasText: game.title.toUpperCase()}).isVisible(),
        `${game.title}: the side panel names the game`);
    const shown = await controls();
    check(shown.joystick === game.controls.joystick &&
        JSON.stringify(shown.buttons) === JSON.stringify(game.controls.buttons),
    `${game.title}: shows ${game.controls.joystick ? 'a joystick' : 'no joystick'} and ` +
        `buttons [${game.controls.buttons}] (got ${shown.joystick ? 'a joystick' : 'no joystick'}, [${shown.buttons}])`);
    await game.test();
}

await page.goto(`${BASE_URL}/games`);
await page.getByRole('link', {name: 'Remix Gem Maze'}).click();
await page.waitForSelector('.blocklyWorkspace', {timeout: 60000});
await page.waitForFunction(() => vm.runtime.targets.some(t => t.getName() === 'Hero'), null, {timeout: 30000});
check(true, 'Remix opens Gem Maze in the editor');

// Full-screen play on a phone: pause freezes the clock, resume carries on.
await page.goto(`${BASE_URL}/game?sample=spark-hop`);
await page.waitForFunction(() => window.vm && vm.runtime.targets.length > 1, null, {timeout: 60000});
await page.waitForTimeout(1200);
await page.getByRole('button', {name: 'Play full screen'}).first().click();
await page.waitForTimeout(1000);
await page.getByRole('button', {name: 'Pause'}).click();
const pausedTime = await stageVar('Time');
await page.waitForTimeout(2200);
check(await stageVar('Time') === pausedTime, 'Pause freezes the game');
await page.getByRole('button', {name: '▶ RESUME'}).click();
await page.waitForTimeout(2200);
check(await stageVar('Time') < pausedTime, 'Resume carries on');
check(await page.locator('[class*="pause-screen"]').count() === 0, 'Resume closes the pause menu');

// The editor on a computer: the new game picker, saving to My games, and reopening.
const desk = await browser.newPage({viewport: {width: 1440, height: 900}});
desk.on('pageerror', err => pageErrors.push(err.message));
await desk.goto(`${BASE_URL}/editor.html?new`);
await desk.getByText('START A NEW GAME').waitFor({timeout: 120000});
await desk.waitForFunction(() => window.vm && vm.runtime.targets.length > 0, null, {timeout: 60000});
await desk.waitForTimeout(1500);
await desk.locator('button[data-id="lane-dash"]').click();
await desk.getByRole('button', {name: 'START WITH RACER'}).click();
await desk.waitForFunction(() => vm.runtime.targets.some(t => t.getName() === 'Stripes'), null, {timeout: 30000});
check(true, 'The new game picker starts a game from a template');
// A just-loaded game gets a few seconds to settle before changes count as edits.
await desk.waitForTimeout(5500);
check((await desk.textContent('a[class*="save-status_pill"]')).includes('Not saved yet'),
    'Opening a game without changing it saves nothing');
await desk.evaluate(() => vm.renameSprite(vm.runtime.getSpriteTargetByName('Stripes').id, 'Lines'));
await desk.waitForURL(/[?&]game=/, {timeout: 15000});
check((await desk.textContent('a[class*="save-status_pill"]')).includes('Saved on this device'),
    'Editing saves the game on this device');
const savedUrl = desk.url();
await desk.goto(`${BASE_URL}/my-games`);
await desk.locator('article').first()
    .waitFor();
check(await desk.locator('article h2', {hasText: 'My racer'}).count() === 1, 'My games lists the saved game');
await desk.goto(savedUrl);
await desk.waitForFunction(() => window.vm && vm.runtime.targets.some(t => t.getName() === 'Lines'), null,
    {timeout: 60000});
check(true, 'A saved game reopens with its changes');
check(!await desk.locator('[data-sj-menu-button]').isVisible(), 'Computers see the wordmark, not the menu button');
await desk.close();

// On a phone the editor hides the site nav, so the menu button is the way back to the site.
const phoneEditor = await context.newPage();
phoneEditor.on('pageerror', err => pageErrors.push(err.message));
await phoneEditor.goto(`${BASE_URL}/editor.html`);
await phoneEditor.waitForFunction(() => window.vm && vm.runtime.targets.length > 0, null, {timeout: 60000});
check(await phoneEditor.evaluate(() => {
    try {
        return document.createElement('canvas').getContext('2d')
            .getImageData(0, 0, 0, 10).width === 1;
    } catch (e) {
        return false;
    }
}), 'Reading an empty area of a costume does not crash the editor');
const menuButton = phoneEditor.locator('[data-sj-menu-button]');
check(await menuButton.isVisible(), 'The phone editor shows the menu button');
await menuButton.click();
await phoneEditor.keyboard.press('Escape');
await phoneEditor.locator('[data-sj-menu="home"]').waitFor({state: 'detached', timeout: 5000})
    .then(() => check(true, 'Escape closes the menu'), () => check(false, 'Escape closes the menu'));
await menuButton.click();
await phoneEditor.locator('[data-sj-menu="mine"]').click();
await phoneEditor.waitForURL(/my-games/, {timeout: 15000});
check(await phoneEditor.locator('[data-sj-menu-button]').isVisible(),
    'The menu leads to My games, which has the menu too');
// Picking a sprite in Stage view loads its blocks while the code pane is hidden; they must still lay out.
await phoneEditor.goto(`${BASE_URL}/editor.html?sample=lane-dash`);
await phoneEditor.waitForFunction(() => window.vm && vm.runtime.getSpriteTargetByName('Hitbox'), null,
    {timeout: 60000});
await phoneEditor.waitForTimeout(1500);
await phoneEditor.getByRole('button', {name: 'Stage & sprites'}).click();
await phoneEditor.locator('[class*="sprite-selector-item_sprite-name"]', {hasText: 'Player'}).click();
await phoneEditor.waitForTimeout(800);
await phoneEditor.getByRole('button', {name: 'Code', exact: true}).click();
await phoneEditor.waitForTimeout(800);
check(await phoneEditor.evaluate(() => ScratchBlocks.getMainWorkspace().getAllBlocks()
    .every(block => block.inputList.every(input => input.fieldRow.every(field =>
        !field.getText || !field.getText() || field.size_.width > 4)))),
'Blocks loaded while Stage view is showing still lay out their text');
await phoneEditor.close();

check(pageErrors.length === 0, `No page errors${pageErrors.length ? `: ${pageErrors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();

if (failures.length) {
    console.log(`\n${failures.length} check(s) failed`);
    process.exit(1);
}
console.log('\nAll checks passed');
