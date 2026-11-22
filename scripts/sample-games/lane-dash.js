// Lane Dash: a racer seen from above. Joystick to steer, hold Space to boost. Dodge the traffic.

const {svgDoc} = require('./builder');
const {SFX} = require('./sfx');

const C = {
    grass: '#16302b',
    grass2: '#1f4037',
    road: '#2a2d3e',
    curb: '#f4a261',
    line: '#f1f1e6',
    car: '#ff5d73',
    glass: '#1d2240',
    blue: '#4cc9f0',
    amber: '#ffc94a',
    cone: '#ff8a3d',
    white: '#ffffff'
};
const LANES = [-135, -45, 45, 135];

const backdropSvg = (() => {
    let tufts = '';
    for (let y = 10; y < 360; y += 34) {
        tufts += `<circle cx="${18 + ((y * 7) % 30)}" cy="${y}" r="6" fill="${C.grass2}"/>` +
            `<circle cx="${440 + ((y * 5) % 30)}" cy="${y + 15}" r="7" fill="${C.grass2}"/>`;
    }
    let curbs = '';
    for (let y = 0; y < 360; y += 24) {
        const fill = (y / 24) % 2 ? C.white : C.curb;
        curbs += `<rect x="56" y="${y}" width="6" height="24" fill="${fill}"/>` +
            `<rect x="418" y="${y}" width="6" height="24" fill="${fill}"/>`;
    }
    return svgDoc(480, 360,
        `<rect width="480" height="360" fill="${C.grass}"/>${tufts}` +
        `<rect x="60" y="0" width="360" height="360" fill="${C.road}"/>${curbs}`);
})();

// Dashed lane lines, taller than the stage so they can scroll down and wrap.
const stripesSvg = (() => {
    let dashes = '';
    for (const x of [150, 240, 330]) {
        for (let y = 0; y < 480; y += 60) {
            dashes += `<rect x="${x - 2}" y="${y}" width="4" height="30" rx="2" fill="${C.line}" fill-opacity="0.7"/>`;
        }
    }
    return svgDoc(480, 480, dashes);
})();

const carSvg = (body, roof) => svgDoc(36, 60,
    `<rect x="1" y="9" width="6" height="12" rx="2" fill="#111"/>` +
    `<rect x="29" y="9" width="6" height="12" rx="2" fill="#111"/>` +
    `<rect x="1" y="40" width="6" height="12" rx="2" fill="#111"/>` +
    `<rect x="29" y="40" width="6" height="12" rx="2" fill="#111"/>` +
    `<rect x="4" y="2" width="28" height="56" rx="10" fill="${body}"/>` +
    `<rect x="8" y="14" width="20" height="10" rx="3" fill="${C.glass}"/>` +
    `<rect x="8" y="38" width="20" height="8" rx="3" fill="${C.glass}"/>` +
    `<rect x="9" y="25" width="18" height="12" rx="2" fill="${roof}"/>` +
    `<rect x="7" y="3" width="6" height="3" rx="1.5" fill="${C.amber}"/>` +
    `<rect x="23" y="3" width="6" height="3" rx="1.5" fill="${C.amber}"/>`);
const playerSvg = carSvg(C.car, '#ff8fa0');
const trafficSvg = svgDoc(36, 60,
    carSvg(C.blue, '#8de1f7').replace(/^<svg[^>]*>/, '')
        .replace(/<\/svg>$/, '')
        .replace(/fill="#ffc94a"/g, 'fill="#ff4d4d"'));
const truckSvg = svgDoc(38, 86,
    `<rect x="1" y="10" width="6" height="14" rx="2" fill="#111"/>` +
    `<rect x="31" y="10" width="6" height="14" rx="2" fill="#111"/>` +
    `<rect x="1" y="62" width="6" height="14" rx="2" fill="#111"/>` +
    `<rect x="31" y="62" width="6" height="14" rx="2" fill="#111"/>` +
    `<rect x="4" y="2" width="30" height="22" rx="6" fill="${C.amber}"/>` +
    `<rect x="8" y="16" width="22" height="6" rx="2" fill="${C.glass}"/>` +
    `<rect x="4" y="26" width="30" height="58" rx="4" fill="#e9e4d8"/>` +
    `<rect x="8" y="32" width="22" height="46" rx="2" fill="none" stroke="#c9c2b0" stroke-width="2"/>`);
const coneSvg = svgDoc(24, 24,
    `<rect x="2" y="2" width="20" height="20" rx="4" fill="#3a2a20"/>` +
    `<circle cx="12" cy="12" r="8" fill="${C.cone}"/>` +
    `<circle cx="12" cy="12" r="4.5" fill="${C.white}"/>` +
    `<circle cx="12" cy="12" r="2.5" fill="${C.cone}"/>`);

const build = project => {
    project.stage({
        costumes: [['Road', backdropSvg]],
        variables: {Score: 0, Best: 0, state: 'play', speed: 6, base: 6, distance: 0},
        lists: {lanes: LANES},
        broadcasts: ['crash'],
        scripts: ({script, whenFlag, setv, chg, forever, ifThen, eq, lt, v}) => {
            script(whenFlag(), [
                setv('state', 'play'),
                setv('Score', 0),
                setv('distance', 0),
                setv('base', 6),
                setv('speed', 6),
                // The road gets faster the longer you last.
                forever([
                    ifThen(eq(v('state'), 'play'), [
                        ifThen(lt(v('base'), 15), [chg('base', 0.004)])
                    ])
                ])
            ]);
        }
    });
    project.monitor('Score', 5, 5);
    project.monitor('Best', 5, 32);

    project.sprite('Stripes', {
        costumes: [['Lines', stripesSvg, 240, 240]],
        scripts: ({script, whenFlag, gotoXY, toBack, forever, ifThen, eq, lt, v, mul, changeY, ypos}) => {
            script(whenFlag(), [
                gotoXY(0, 0),
                toBack(),
                forever([
                    ifThen(eq(v('state'), 'play'), [
                        changeY(mul(v('speed'), -1)),
                        ifThen(lt(ypos(), -60), [changeY(60)])
                    ])
                ])
            ]);
        }
    });

    project.sprite('Traffic', {
        costumes: [['car', trafficSvg, 18, 30], ['truck', truckSvg, 19, 43], ['cone', coneSvg, 12, 12]],
        variables: {kind: 0, pace: 0},
        visible: false,
        scripts: b => {
            const {script, whenFlag, whenClone, hide, show, forever, wait, div, random, mul, ifThen, ifElse,
                eq, lt, and, v, setv, cloneMyself, wear, setX, setY, item, repeatUntil, ypos, changeY,
                touching, broadcast, deleteClone} = b;
            const playing = () => eq(v('state'), 'play');
            script(whenFlag(), [
                hide(),
                wait(1.5),
                forever([
                    // Faster road, more traffic.
                    wait(div(random(30, 65), mul(v('speed'), 10))),
                    ifThen(playing(), [cloneMyself()])
                ])
            ]);
            script(whenClone(), [
                setv('kind', random(1, 5)),
                // Cars and trucks drive the same way as you, so they pass more slowly than cones.
                ifElse(lt(v('kind'), 3), [wear('car'), setv('pace', 0.55)], [
                    ifElse(eq(v('kind'), 3), [wear('truck'), setv('pace', 0.45)], [wear('cone'), setv('pace', 1)])
                ]),
                setX(item('lanes', random(1, 4))),
                setY(230),
                show(),
                repeatUntil(lt(ypos(), -170), [
                    ifThen(playing(), [changeY(mul(mul(v('speed'), v('pace')), -1))]),
                    ifThen(and(touching('Player'), playing()), [broadcast('crash')])
                ]),
                deleteClone()
            ]);
        }
    });

    project.sprite('Player', {
        costumes: [['car', playerSvg, 18, 30]],
        sounds: [['start', SFX.start()], ['boost', SFX.boost()], ['crash', SFX.crash()]],
        variables: {steer: 0, boosting: 0},
        y: -125,
        scripts: b => {
            const {script, whenFlag, whenReceive, gotoXY, point, toFront, clearEffects, setv, chg, v, add, sub,
                mul, div, round, key, forever, ifThen, ifElse, eq, gt, lt, changeX, setX, xpos, sayFor, say,
                join, repeat, turn, stopOtherScripts, play} = b;
            const playing = () => eq(v('state'), 'play');
            script(whenFlag(), [
                gotoXY(0, -125),
                point(90),
                clearEffects(),
                toFront(),
                setv('steer', 0),
                setv('boosting', 0),
                play('start'),
                forever([
                    ifThen(playing(), [
                        // The joystick presses the arrow keys.
                        setv('steer', add(mul(v('steer'), 0.8), mul(sub(key('right arrow'), key('left arrow')), 1.5))),
                        changeX(v('steer')),
                        ifThen(gt(xpos(), 160), [setX(160), setv('steer', 0)]),
                        ifThen(lt(xpos(), -160), [setX(-160), setv('steer', 0)]),
                        point(add(90, mul(v('steer'), 2))),
                        // Hold Space to boost: faster, more points, more danger.
                        ifElse(key('space'), [
                            ifThen(eq(v('boosting'), 0), [play('boost')]),
                            setv('boosting', 1),
                            setv('speed', mul(v('base'), 1.7))
                        ], [
                            setv('boosting', 0),
                            setv('speed', v('base'))
                        ]),
                        chg('distance', div(v('speed'), 12)),
                        setv('Score', round(v('distance')))
                    ])
                ])
            ]);
            script(whenFlag(), [
                sayFor('Steer with the joystick. Hold Space to boost!', 3)
            ]);
            script(whenReceive('crash'), [
                ifThen(playing(), [
                    setv('state', 'over'),
                    stopOtherScripts(),
                    play('crash'),
                    ifThen(gt(v('Score'), v('Best')), [setv('Best', v('Score'))]),
                    repeat(12, [turn(30)]),
                    point(90),
                    say(join('Crash! You drove ', join(v('Score'), ' m. Press the green flag to race again.')))
                ])
            ]);
        }
    });

    return [
        [stripesSvg, 0, 0, 240, 240],
        [trafficSvg, -45, 90, 18, 30],
        [truckSvg, 135, 20, 19, 43],
        [coneSvg, 45, 140, 12, 12],
        [trafficSvg, -135, -20, 18, 30],
        [playerSvg, 45, -110, 18, 30, 1.2]
    ];
};

module.exports = {
    id: 'lane-dash',
    build,
    backdropSvg
};
