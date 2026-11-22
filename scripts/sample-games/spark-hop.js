// Spark Hop: a platformer. Joystick to run, Space or swipe up to jump, X or swipe sideways to dash.
// Collect sparks for extra time.

const {svgDoc, seeded} = require('./builder');
const {SFX} = require('./sfx');

const C = {
    night: '#0f1330',
    night2: '#1a2050',
    ink: '#f3efe6',
    dim: '#a9acc8',
    mint: '#2fd3b0',
    amber: '#ffc94a',
    coral: '#ff5d73',
    deck: '#1d2a5e',
    earth: '#151b44'
};

const backdropSvg = (() => {
    const rand = seeded(7);
    let stars = '';
    for (let i = 0; i < 70; i++) {
        const x = (rand() * 480).toFixed(1);
        const y = (rand() * 300).toFixed(1);
        const r = (0.4 + (rand() * 1.1)).toFixed(2);
        const o = (0.3 + (rand() * 0.6)).toFixed(2);
        stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.ink}" fill-opacity="${o}"/>`;
    }
    let hill = 'M0 360';
    for (let x = 0; x <= 480; x += 10) {
        const y = 290 - (Math.sin((x / 65) + 1) * 15) - (Math.sin(x / 22) * 3);
        hill += `L${x} ${y.toFixed(1)}`;
    }
    hill += 'L480 360Z';
    return svgDoc(480, 360,
        `<defs><linearGradient id="hop-sky" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${C.night}"/>` +
        `<stop offset="1" stop-color="${C.night2}"/></linearGradient></defs>` +
        `<rect width="480" height="360" fill="url(#hop-sky)"/>${stars}` +
        `<path d="${hill}" fill="${C.mint}" fill-opacity="0.07"/>`);
})();

// Platforms in SVG coordinates (y down). The ground is the full-width strip at the bottom.
const PLATFORMS = [
    [30, 270, 110], [175, 220, 110], [330, 260, 110], [60, 165, 100],
    [320, 160, 110], [190, 110, 100], [30, 65, 90], [360, 70, 100]
];
const levelSvg = (() => {
    let body = `<rect x="0" y="330" width="480" height="30" fill="${C.earth}"/>` +
        `<rect x="0" y="330" width="480" height="3" fill="${C.mint}"/>`;
    for (const [x, y, w] of PLATFORMS) {
        body += `<rect x="${x}" y="${y}" width="${w}" height="10" rx="5" fill="${C.deck}"/>` +
            `<rect x="${x + 2}" y="${y}" width="${w - 4}" height="3" rx="1.5" fill="${C.mint}"/>`;
    }
    return svgDoc(480, 360, body);
})();

const botSvg = svgDoc(30, 42,
    `<path d="M13 11 Q12 4 19 3" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="20" cy="3.5" r="5" fill="${C.amber}" fill-opacity="0.3"/>` +
    `<circle cx="20" cy="3.5" r="3" fill="${C.amber}"/>` +
    `<rect x="3" y="11" width="24" height="26" rx="9" fill="${C.ink}"/>` +
    `<rect x="8" y="16" width="18" height="10" rx="5" fill="${C.night}"/>` +
    `<rect x="17" y="18.5" width="2.6" height="5" rx="1" fill="${C.mint}"/>` +
    `<rect x="21.5" y="18.5" width="2.6" height="5" rx="1" fill="${C.mint}"/>` +
    `<rect x="5" y="36" width="8" height="5" rx="2.5" fill="${C.dim}"/>` +
    `<rect x="17" y="36" width="8" height="5" rx="2.5" fill="${C.dim}"/>`);
// Used for collisions only, so the antenna never snags on platforms.
const hitboxSvg = svgDoc(30, 42, `<rect x="5" y="12" width="20" height="29" fill="${C.coral}"/>`);

const sparkSvg = (() => {
    let pts = '';
    for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 3.5 : 10;
        const a = i * Math.PI / 4;
        pts += `${(14 + (Math.cos(a) * r)).toFixed(2)},${(14 + (Math.sin(a) * r)).toFixed(2)} `;
    }
    return svgDoc(28, 28,
        `<circle cx="14" cy="14" r="13" fill="${C.amber}" fill-opacity="0.18"/>` +
        `<polygon points="${pts.trim()}" fill="${C.amber}"/>`);
})();

const blobSvg = (() => {
    let pts = '';
    for (let i = 0; i < 16; i++) {
        const r = i % 2 ? 10.5 : 14;
        const a = i / 16 * Math.PI * 2;
        pts += `${(15 + (Math.cos(a) * r)).toFixed(2)},${(15 + (Math.sin(a) * r)).toFixed(2)} `;
    }
    return svgDoc(30, 30,
        `<polygon points="${pts.trim()}" fill="${C.coral}"/>` +
        `<rect x="10" y="12" width="3" height="5" rx="1" fill="${C.night}"/>` +
        `<rect x="17" y="12" width="3" height="5" rx="1" fill="${C.night}"/>`);
})();

// Where sparks can appear (Scratch coordinates, above each platform and along the ground).
const SPOTS = [[-150, -128], [40, -128], [170, -128]].concat(PLATFORMS.map(([x, y, w]) => [
    x + (w / 2) - 240, 180 - y + 18
]));

const build = project => {
    project.stage({
        costumes: [['Night sky', backdropSvg]],
        variables: {Sparks: 0, Time: 60, Best: 0, state: 'play'},
        lists: {'spot x': SPOTS.map(s => s[0]), 'spot y': SPOTS.map(s => s[1])},
        broadcasts: ['game over'],
        sounds: [['time up', SFX.timeUp()]],
        scripts: ({script, whenFlag, setv, chg, repeatUntil, wait, lt, gt, v, broadcast, ifThen, ifElse,
            isSaved, saved, saveAs, play}) => {
            script(whenFlag(), [
                // The best score is kept on the device with the Phone extension's save blocks.
                ifElse(isSaved('best sparks'), [setv('Best', saved('best sparks'))], [setv('Best', 0)]),
                setv('state', 'play'),
                setv('Sparks', 0),
                setv('Time', 60),
                repeatUntil(lt(v('Time'), 1), [wait(1), chg('Time', -1)]),
                setv('Time', 0),
                ifThen(gt(v('Sparks'), v('Best')), [
                    setv('Best', v('Sparks')),
                    saveAs(v('Sparks'), 'best sparks')
                ]),
                setv('state', 'over'),
                play('time up'),
                broadcast('game over')
            ]);
        }
    });
    project.monitor('Sparks', 5, 5);
    project.monitor('Time', 5, 32);
    project.monitor('Best', 5, 59);

    project.sprite('Level', {
        costumes: [['Platforms', levelSvg, 240, 180]],
        scripts: ({script, whenFlag, gotoXY, show}) => {
            script(whenFlag(), [gotoXY(0, 0), show()]);
        }
    });

    project.sprite('Spark', {
        costumes: [['Spark', sparkSvg, 14, 14]],
        sounds: [['collect', SFX.collect()]],
        variables: {spot: 0},
        visible: false,
        scripts: b => {
            const {script, define, whenFlag, whenClone, setv, chg, v, random, lengthOf, item, gotoXY,
                repeatUntil, not, touching, hide, show, repeat, cloneMyself, setSize, clearEffects, call,
                forever, turn, ifThen, and, eq, changeSize, changeEffect, vibrate, play} = b;
            define('jump to a free spot', false, [
                setv('spot', random(1, lengthOf('spot x'))),
                gotoXY(item('spot x', v('spot')), item('spot y', v('spot'))),
                repeatUntil(not(touching('Spark')), [
                    setv('spot', random(1, lengthOf('spot x'))),
                    gotoXY(item('spot x', v('spot')), item('spot y', v('spot')))
                ])
            ]);
            script(whenFlag(), [hide(), repeat(3, [cloneMyself()])]);
            script(whenClone(), [
                setSize(100),
                clearEffects(),
                call('jump to a free spot'),
                show(),
                forever([
                    turn(4),
                    ifThen(and(touching('Player'), eq(v('state'), 'play')), [
                        chg('Sparks', 1),
                        play('collect'),
                        chg('Time', 1),
                        vibrate(25),
                        repeat(5, [changeSize(14), changeEffect('ghost', 20)]),
                        setSize(100),
                        clearEffects(),
                        call('jump to a free spot')
                    ])
                ])
            ]);
        }
    });

    project.sprite('Blob', {
        costumes: [['Blob', blobSvg, 15, 15]],
        variables: {speed: 0, left: 0, right: 0},
        x: 60,
        y: -136,
        scripts: b => {
            const {script, define, whenFlag, whenClone, setv, v, mul, gotoXY, show, cloneMyself, call,
                forever, changeX, ifThen, or, gt, lt, xpos} = b;
            define('patrol', false, [
                forever([
                    changeX(v('speed')),
                    ifThen(or(gt(xpos(), v('right')), lt(xpos(), v('left'))), [
                        setv('speed', mul(v('speed'), -1))
                    ])
                ])
            ]);
            script(whenFlag(), [
                setv('speed', 2.5),
                setv('left', -110),
                setv('right', 200),
                gotoXY(60, -136),
                show(),
                cloneMyself(),
                call('patrol')
            ]);
            script(whenClone(), [
                setv('speed', 1.5),
                setv('left', 95),
                setv('right', 175),
                gotoXY(130, 34),
                call('patrol')
            ]);
        }
    });

    project.sprite('Player', {
        costumes: [['bot', botSvg, 15, 24], ['hitbox', hitboxSvg, 15, 24]],
        sounds: [['jump', SFX.jump()], ['dash', SFX.dash()], ['hit', SFX.hit()]],
        variables: {
            'vx': 0,
            'vy': 0,
            'ground': 0,
            'dash': 0,
            'dash wait': 0,
            'face': 1,
            'hurt': 0,
            'move': 0,
            'swipe jump': 0,
            'swipe dash': 0
        },
        x: -200,
        y: -125,
        rotationStyle: 'left-right',
        scripts: b => {
            const {script, define, whenFlag, whenReceive, setv, chg, v, add, sub, mul, div, mod, round,
                join, gt, lt, eq, and, not, key, touching, ypos, ifThen, ifElse, forever, repeatUntil,
                changeX, changeY, gotoXY, point, rotationStyle, wear, toFront, setEffect, clearEffects,
                say, sayFor, call, or, vibrate, whenSwiped, play} = b;
            const playing = () => eq(v('state'), 'play');
            define('step', true, [
                wear('hitbox'),
                // Read the controls: the joystick presses the arrow keys, Space is jump, X is dash.
                ifElse(playing(), [
                    setv('move', sub(key('right arrow'), key('left arrow')))
                ], [
                    setv('move', 0)
                ]),
                ifThen(not(eq(v('move'), 0)), [
                    setv('face', v('move')),
                    point(mul(90, v('move')))
                ]),
                // A sideways swipe dashes once; a swipe up counts as holding jump for a few frames.
                ifThen(and(and(or(key('x'), gt(v('swipe dash'), 0)), eq(v('dash wait'), 0)), playing()), [
                    setv('dash', 6),
                    play('dash'),
                    setv('dash wait', 30)
                ]),
                setv('swipe dash', 0),
                ifThen(gt(v('dash wait'), 0), [chg('dash wait', -1)]),
                ifElse(gt(v('dash'), 0), [
                    chg('dash', -1),
                    setv('vx', mul(11, v('face'))),
                    setv('vy', 0)
                ], [
                    setv('vx', add(mul(v('vx'), 0.75), mul(v('move'), 1.6))),
                    chg('vy', -1),
                    // Let go of jump early for a short hop.
                    ifThen(and(not(or(key('space'), gt(v('swipe jump'), 0))), gt(v('vy'), 4)), [setv('vy', 4)]),
                    ifThen(lt(v('vy'), -12), [setv('vy', -12)])
                ]),
                // Move sideways, and undo the move if it ran into a platform.
                changeX(v('vx')),
                ifThen(touching('Level'), [
                    changeX(mul(v('vx'), -1)),
                    setv('vx', 0)
                ]),
                // Move up or down, then push out of any platform we landed on or bumped into.
                changeY(v('vy')),
                ifElse(touching('Level'), [
                    ifElse(lt(v('vy'), 0), [
                        repeatUntil(not(touching('Level')), [changeY(1)]),
                        setv('ground', 4)
                    ], [
                        repeatUntil(not(touching('Level')), [changeY(-1)])
                    ]),
                    setv('vy', 0)
                ], [
                    ifThen(gt(v('ground'), 0), [chg('ground', -1)])
                ]),
                ifThen(and(and(or(key('space'), gt(v('swipe jump'), 0)), gt(v('ground'), 0)), playing()), [
                    setv('vy', 13),
                    play('jump'),
                    setv('ground', 0)
                ]),
                ifThen(gt(v('swipe jump'), 0), [chg('swipe jump', -1)]),
                ifThen(lt(ypos(), -170), [
                    gotoXY(-200, -125),
                    setv('vy', 0)
                ]),
                wear('bot'),
                // A blob takes 5 seconds off the clock and knocks you back.
                ifThen(and(and(touching('Blob'), eq(v('hurt'), 0)), playing()), [
                    setv('hurt', 45),
                    chg('Time', -5),
                    play('hit'),
                    vibrate(150),
                    setv('vy', 9),
                    setv('vx', mul(-7, v('face')))
                ]),
                ifElse(gt(v('hurt'), 0), [
                    chg('hurt', -1),
                    setEffect('ghost', mul(60, mod(round(div(v('hurt'), 3)), 2)))
                ], [
                    setEffect('ghost', 0)
                ])
            ]);
            script(whenFlag(), [
                rotationStyle('left-right'),
                point(90),
                wear('bot'),
                clearEffects(),
                toFront(),
                gotoXY(-200, -125),
                setv('vx', 0),
                setv('vy', 0),
                setv('ground', 0),
                setv('dash', 0),
                setv('dash wait', 0),
                setv('face', 1),
                setv('hurt', 0),
                setv('swipe jump', 0),
                setv('swipe dash', 0),
                forever([call('step', true)])
            ]);
            script(whenFlag(), [
                sayFor('Collect the sparks! Each one adds a second.', 3),
                sayFor('Move with the joystick. Space or swipe up to jump, X or swipe sideways to dash.', 4)
            ]);
            script(whenSwiped('up'), [setv('swipe jump', 12)]);
            script(whenSwiped('left'), [setv('face', -1), point(-90), setv('swipe dash', 1)]);
            script(whenSwiped('right'), [setv('face', 1), point(90), setv('swipe dash', 1)]);
            script(whenReceive('game over'), [
                say(join('Time! You got ', join(v('Sparks'), join(' sparks. Best: ',
                    join(v('Best'), '. Press the green flag to play again.')))))
            ]);
        }
    });

    return [
        [levelSvg, 0, 0, 240, 180],
        [blobSvg, 60, -136, 15, 15],
        [blobSvg, 130, 34, 15, 15],
        [sparkSvg, -10, -22, 14, 14],
        [sparkSvg, 170, 128, 14, 14],
        [sparkSvg, -130, 33, 14, 14],
        [botSvg, -120, -72, 15, 24, 1.3]
    ];
};

module.exports = {
    id: 'spark-hop',
    build,
    backdropSvg
};
