// Gem Maze: a top-down maze. Joystick only: find all six gems while a ghost drifts through the walls.

const {svgDoc} = require('./builder');
const {SFX} = require('./sfx');

const C = {
    floor: '#1e1b2e',
    floor2: '#26223a',
    wall: '#3d3a5c',
    wallTop: '#6c63ff',
    gem: '#2ee6a6',
    gem2: '#b8ffe5',
    ink: '#14121f',
    ghost: '#e8e6ff',
    glow: '#ffd166'
};

// 12 x 9 cells of 40 pixels. '#' is a wall.
const MAZE = [
    '############',
    '#....#.....#',
    '#.##.#.###.#',
    '#.#......#.#',
    '#.#.####.#.#',
    '#...#..#...#',
    '###.#.##.#.#',
    '#.....#..#.#',
    '############'
];
const START = [1, 1];
const GHOST_START = [10, 5];
const GEMS = [[10, 1], [6, 5], [1, 7], [10, 7], [7, 3], [8, 7]];
const cellX = col => (col * 40) + 20 - 240;
const cellY = row => 180 - ((row * 40) + 20);

// Make sure every gem can be reached from the start.
(() => {
    const seen = new Set([START.join()]);
    const queue = [START];
    while (queue.length) {
        const [c, r] = queue.shift();
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const next = [c + dc, r + dr];
            if (MAZE[next[1]][next[0]] === '.' && !seen.has(next.join())) {
                seen.add(next.join());
                queue.push(next);
            }
        }
    }
    for (const gem of GEMS.concat([GHOST_START])) {
        if (!seen.has(gem.join())) throw new Error(`Gem Maze: cell ${gem} cannot be reached`);
    }
})();

const backdropSvg = (() => {
    let tiles = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 12; c++) {
            if ((r + c) % 2) tiles += `<rect x="${c * 40}" y="${r * 40}" width="40" height="40" fill="${C.floor2}"/>`;
        }
    }
    return svgDoc(480, 360, `<rect width="480" height="360" fill="${C.floor}"/>${tiles}`);
})();

const wallsSvg = (() => {
    let walls = '';
    MAZE.forEach((row, r) => {
        [...row].forEach((cell, c) => {
            if (cell === '#') {
                walls += `<rect x="${c * 40}" y="${r * 40}" width="40" height="40" fill="${C.wall}"/>` +
                    `<rect x="${c * 40}" y="${r * 40}" width="40" height="6" fill="${C.wallTop}" fill-opacity="0.55"/>`;
            }
        });
    });
    return svgDoc(480, 360, walls);
})();

const gemSvg = svgDoc(24, 24,
    `<circle cx="12" cy="12" r="11" fill="${C.gem}" fill-opacity="0.18"/>` +
    `<path d="M12 3 L20 11 L12 21 L4 11Z" fill="${C.gem}"/>` +
    `<path d="M12 3 L15 11 L12 21 L9 11Z" fill="${C.gem2}" fill-opacity="0.6"/>`);

// A small robot explorer with a lantern, like the one in Spark Hop.
const heroSvg = svgDoc(24, 24,
    `<circle cx="18" cy="5" r="4.5" fill="${C.glow}" fill-opacity="0.3"/>` +
    `<circle cx="18" cy="5" r="2.4" fill="${C.glow}"/>` +
    `<rect x="3" y="7" width="17" height="15" rx="6" fill="#f3efe6"/>` +
    `<rect x="7" y="10" width="12" height="7" rx="3.5" fill="${C.ink}"/>` +
    `<rect x="12.5" y="11.5" width="2" height="4" rx="1" fill="${C.gem}"/>` +
    `<rect x="15.5" y="11.5" width="2" height="4" rx="1" fill="${C.gem}"/>`);

const ghostSvg = svgDoc(30, 32,
    `<path d="M3 30 L3 14 A12 12 0 0 1 27 14 L27 30 L22 26 L18 30 L15 26 L12 30 L8 26Z" fill="${C.ghost}"/>` +
    `<circle cx="11" cy="14" r="3" fill="${C.ink}"/><circle cx="19" cy="14" r="3" fill="${C.ink}"/>`);

const build = project => {
    project.stage({
        costumes: [['Floor', backdropSvg]],
        variables: {Gems: 0, Time: 0, state: 'play'},
        lists: {'gem x': GEMS.map(([c]) => cellX(c)), 'gem y': GEMS.map(([, r]) => cellY(r))},
        broadcasts: ['caught', 'all found'],
        scripts: ({script, whenFlag, setv, chg, repeatUntil, wait, eq, v, broadcast}) => {
            script(whenFlag(), [
                setv('state', 'play'),
                setv('Gems', 0),
                setv('Time', 0),
                repeatUntil(eq(v('Gems'), GEMS.length), [wait(1), chg('Time', 1)]),
                setv('state', 'won'),
                broadcast('all found')
            ]);
        }
    });
    project.monitor('Gems', 5, 5);
    project.monitor('Time', 400, 5);

    project.sprite('Walls', {
        costumes: [['Walls', wallsSvg, 240, 180]],
        scripts: ({script, whenFlag, gotoXY, show}) => {
            script(whenFlag(), [gotoXY(0, 0), show()]);
        }
    });

    project.sprite('Gem', {
        costumes: [['gem', gemSvg, 12, 12]],
        sounds: [['gem', SFX.gem()]],
        variables: {number: 0},
        visible: false,
        scripts: b => {
            const {script, whenFlag, whenClone, hide, show, setv, chg, v, repeat, lengthOf, cloneMyself,
                gotoXY, item, setSize, clearEffects, waitUntil, touching, changeSize, changeEffect,
                deleteClone, play, wait} = b;
            script(whenFlag(), [
                hide(),
                setv('number', 0),
                repeat(lengthOf('gem x'), [chg('number', 1), cloneMyself()])
            ]);
            script(whenClone(), [
                gotoXY(item('gem x', v('number')), item('gem y', v('number'))),
                setSize(100),
                clearEffects(),
                show(),
                waitUntil(touching('Hero')),
                chg('Gems', 1),
                play('gem'),
                repeat(5, [changeSize(20), changeEffect('ghost', 20)]),
                hide(),
                wait(0.3),
                deleteClone()
            ]);
        }
    });

    const ghostX = cellX(GHOST_START[0]);
    const ghostY = cellY(GHOST_START[1]);
    project.sprite('Ghost', {
        costumes: [['ghost', ghostSvg, 15, 16]],
        x: ghostX,
        y: ghostY,
        rotationStyle: "don't rotate",
        scripts: b => {
            const {script, whenFlag, whenReceive, gotoXY, rotationStyle, setEffect, wait, forever, ifThen, and,
                eq, v, pointTowards, move, touching, broadcast} = b;
            script(whenFlag(), [
                rotationStyle("don't rotate"),
                gotoXY(ghostX, ghostY),
                setEffect('ghost', 35),
                wait(2),
                forever([
                    ifThen(eq(v('state'), 'play'), [
                        // Ghosts float through walls, slowly.
                        pointTowards('Hero'),
                        move(0.9),
                        ifThen(and(touching('Hero'), eq(v('state'), 'play')), [broadcast('caught'), wait(0.5)])
                    ])
                ])
            ]);
            script(whenReceive('caught'), [gotoXY(ghostX, ghostY)]);
        }
    });

    const heroX = cellX(START[0]);
    const heroY = cellY(START[1]);
    project.sprite('Hero', {
        costumes: [['hero', heroSvg, 12, 12]],
        sounds: [['boo', SFX.boo()], ['win', SFX.win()]],
        variables: {dx: 0, dy: 0, lane: 0},
        x: heroX,
        y: heroY,
        rotationStyle: 'left-right',
        scripts: b => {
            const {script, define, whenFlag, whenReceive, gotoXY, point, rotationStyle, toFront, setv, v, sub,
                add, mul, div, round, key, forever, call, ifThen, eq, not, and, touching, changeX, changeY,
                xpos, ypos, setX, setY, sayFor, say, join, play} = b;
            const SPEED = 3;
            define('step', true, [
                ifThen(eq(v('state'), 'play'), [
                    // The joystick presses the arrow keys.
                    setv('dx', sub(key('right arrow'), key('left arrow'))),
                    setv('dy', sub(key('up arrow'), key('down arrow'))),
                    ifThen(not(eq(v('dx'), 0)), [point(mul(90, v('dx')))]),
                    changeX(mul(v('dx'), SPEED)),
                    ifThen(touching('Walls'), [changeX(mul(v('dx'), -SPEED))]),
                    changeY(mul(v('dy'), SPEED)),
                    ifThen(touching('Walls'), [changeY(mul(v('dy'), -SPEED))]),
                    // Corner help: while moving one way, ease into the middle of the corridor.
                    ifThen(and(not(eq(v('dx'), 0)), eq(v('dy'), 0)), [
                        setv('lane', sub(160, mul(40, round(div(sub(160, ypos()), 40))))),
                        setY(add(ypos(), mul(sub(v('lane'), ypos()), 0.25))),
                        ifThen(touching('Walls'), [setY(v('lane'))])
                    ]),
                    ifThen(and(not(eq(v('dy'), 0)), eq(v('dx'), 0)), [
                        setv('lane', add(-220, mul(40, round(div(add(xpos(), 220), 40))))),
                        setX(add(xpos(), mul(sub(v('lane'), xpos()), 0.25))),
                        ifThen(touching('Walls'), [setX(v('lane'))])
                    ])
                ])
            ]);
            script(whenFlag(), [
                rotationStyle('left-right'),
                point(90),
                gotoXY(heroX, heroY),
                toFront(),
                forever([call('step', true)])
            ]);
            script(whenFlag(), [
                sayFor(`Find all ${GEMS.length} gems with the joystick.`, 2.5),
                sayFor('Watch out for the ghost!', 2)
            ]);
            script(whenReceive('caught'), [
                gotoXY(heroX, heroY),
                play('boo'),
                sayFor('Boo! Back to the start.', 1.5)
            ]);
            script(whenReceive('all found'), [
                play('win'),
                say(join('You found every gem in ', join(v('Time'), ' seconds! Press the green flag to go again.')))
            ]);
        }
    });

    return [
        [wallsSvg, 0, 0, 240, 180]
    ].concat(GEMS.map(([c, r]) => [gemSvg, cellX(c), cellY(r), 12, 12])).concat([
        [ghostSvg, ghostX, ghostY, 15, 16, 1.2],
        [heroSvg, cellX(3), cellY(3), 12, 12, 1.3]
    ]);
};

module.exports = {
    id: 'gem-maze',
    build,
    backdropSvg
};
