// ScratchPro smoke test: the home page opens Spark Hop, every sample game loads and responds to its
// controls on a phone, and Remix opens the editor.
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

await page.goto(`${BASE_URL}/`);
await page.waitForFunction(() => window.vm && vm.runtime.targets.length > 1, null, {timeout: 120000});
await page.waitForTimeout(1500);
check((await spriteNames()).includes('Player'), 'Spark Hop opens on the first page load');
check(await page.locator('[class*="sample-games_card"]').count() === 4, 'The home page shows 4 sample games');

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
            check(await findBubble() !== null || (await page.waitForTimeout(1000), await findBubble() !== null),
                'Bubble Pop: bubbles float up');
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
    const card = page.locator('[class*="sample-games_card"]', {hasText: game.title});
    await card.getByRole('button', {name: 'Play', exact: true}).click();
    await page.waitForFunction(s => vm.runtime.targets.some(t => t.getName() === s), game.sprite, {timeout: 30000});
    await page.waitForTimeout(1200);
    check(true, `${game.title}: loads from the gallery`);
    const shown = await controls();
    check(shown.joystick === game.controls.joystick &&
        JSON.stringify(shown.buttons) === JSON.stringify(game.controls.buttons),
    `${game.title}: shows ${game.controls.joystick ? 'a joystick' : 'no joystick'} and ` +
        `buttons [${game.controls.buttons}] (got ${shown.joystick ? 'a joystick' : 'no joystick'}, [${shown.buttons}])`);
    await game.test();
}

const mazeCard = page.locator('[class*="sample-games_card"]', {hasText: 'Gem Maze'});
await mazeCard.getByRole('button', {name: 'Remix'}).click();
await page.waitForSelector('.blocklyWorkspace', {timeout: 30000});
check(await page.evaluate(() => vm.editingTarget && vm.runtime.targets.some(t => t.getName() === 'Hero')),
    'Remix opens Gem Maze in the editor');

check(pageErrors.length === 0, `No page errors${pageErrors.length ? `: ${pageErrors.slice(0, 3).join(' | ')}` : ''}`);
await browser.close();

if (failures.length) {
    console.log(`\n${failures.length} check(s) failed`);
    process.exit(1);
}
console.log('\nAll checks passed');
