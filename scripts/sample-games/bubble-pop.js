// Bubble Pop: tap the bubbles before they float away, and leave the spiky urchins alone.
// It uses no keys, so it shows that tap-only games get no on-screen controls.

const {svgDoc, seeded} = require('./builder');

const C = {
    top: '#1b9aaa',
    bottom: '#0b2545',
    ray: '#ffffff',
    sand: '#e9c46a',
    sand2: '#d4a64a',
    weed: '#2a9d8f',
    bubble: '#dff8ff',
    urchin: '#9b5de5',
    urchinDark: '#5a189a',
    fish: '#ffb703',
    ink: '#0b2545'
};

const backdropSvg = (() => {
    const rand = seeded(11);
    let specks = '';
    for (let i = 0; i < 40; i++) {
        specks += `<circle cx="${(rand() * 480).toFixed(1)}" cy="${(rand() * 300).toFixed(1)}" ` +
            `r="${(0.6 + rand()).toFixed(2)}" fill="${C.ray}" fill-opacity="${(0.1 + (rand() * 0.25)).toFixed(2)}"/>`;
    }
    let weeds = '';
    for (const x of [40, 70, 300, 330, 430]) {
        weeds += `<path d="M${x} 360 C${x - 14} 320 ${x + 14} 300 ${x} 262" fill="none" ` +
            `stroke="${C.weed}" stroke-width="6" stroke-linecap="round"/>`;
    }
    return svgDoc(480, 360,
        `<defs><linearGradient id="pop-sea" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${C.top}"/><stop offset="1" stop-color="${C.bottom}"/></linearGradient></defs>` +
        `<rect width="480" height="360" fill="url(#pop-sea)"/>` +
        `<path d="M60 0 L120 0 L40 300 L0 300Z" fill="${C.ray}" fill-opacity="0.05"/>` +
        `<path d="M250 0 L300 0 L360 300 L260 300Z" fill="${C.ray}" fill-opacity="0.05"/>${specks}${weeds}` +
        `<path d="M0 340 Q120 320 240 338 T480 332 L480 360 L0 360Z" fill="${C.sand}"/>` +
        `<path d="M0 352 Q140 340 260 352 T480 348 L480 360 L0 360Z" fill="${C.sand2}"/>`);
})();

const bubbleSvg = svgDoc(52, 52,
    `<circle cx="26" cy="26" r="23" fill="${C.bubble}" fill-opacity="0.25" stroke="${C.bubble}" stroke-width="2.5"/>` +
    `<path d="M14 20 Q17 12 25 10" fill="none" stroke="${C.ray}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="34" cy="36" r="2.5" fill="${C.ray}" fill-opacity="0.8"/>`);

const urchinSvg = (() => {
    let spikes = '';
    for (let i = 0; i < 18; i++) {
        const a = i / 18 * Math.PI * 2;
        const x1 = 26 + (Math.cos(a) * 12);
        const y1 = 26 + (Math.sin(a) * 12);
        const x2 = 26 + (Math.cos(a) * 24);
        const y2 = 26 + (Math.sin(a) * 24);
        spikes += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ` +
            `stroke="${C.urchinDark}" stroke-width="3" stroke-linecap="round"/>`;
    }
    return svgDoc(52, 52, `${spikes}<circle cx="26" cy="26" r="14" fill="${C.urchin}"/>` +
        `<circle cx="21" cy="24" r="2.5" fill="${C.ink}"/><circle cx="31" cy="24" r="2.5" fill="${C.ink}"/>` +
        `<path d="M21 31 Q26 28 31 31" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>`);
})();

const fishSvg = svgDoc(56, 36,
    `<path d="M40 18 L56 4 L54 18 L56 32Z" fill="${C.fish}"/>` +
    `<ellipse cx="24" cy="18" rx="22" ry="15" fill="${C.fish}"/>` +
    `<path d="M24 4 Q30 10 28 18 Q30 26 24 32" fill="none" stroke="#fb8500" stroke-width="3"/>` +
    `<circle cx="12" cy="14" r="4" fill="#fff"/><circle cx="11" cy="14" r="2" fill="${C.ink}"/>`);

const build = project => {
    project.stage({
        costumes: [['Sea', backdropSvg]],
        variables: {Score: 0, Time: 30, Best: 0, state: 'play'},
        broadcasts: ['game over'],
        scripts: ({script, whenFlag, setv, chg, repeatUntil, wait, lt, gt, v, ifThen, broadcast}) => {
            script(whenFlag(), [
                setv('state', 'play'),
                setv('Score', 0),
                setv('Time', 30),
                repeatUntil(lt(v('Time'), 1), [wait(1), chg('Time', -1)]),
                setv('Time', 0),
                setv('state', 'over'),
                ifThen(gt(v('Score'), v('Best')), [setv('Best', v('Score'))]),
                broadcast('game over')
            ]);
        }
    });
    project.monitor('Score', 5, 5);
    project.monitor('Time', 5, 32);

    project.sprite('Bubble', {
        costumes: [['bubble', bubbleSvg, 26, 26], ['urchin', urchinSvg, 26, 26]],
        variables: {rise: 0, wobble: 0, popped: 0},
        visible: false,
        scripts: b => {
            const {script, whenFlag, whenClone, whenClicked, hide, show, forever, wait, ifThen, ifElse, eq, lt,
                gt, and, v, setv, chg, cloneMyself, wear, random, setSize, gotoXY, repeatUntil, ypos, changeY,
                setX, xpos, add, mul, mathop, costumeNumber, repeat, changeSize, changeEffect,
                deleteClone} = b;
            const playing = () => eq(v('state'), 'play');
            script(whenFlag(), [
                hide(),
                wait(1),
                forever([
                    ifThen(playing(), [cloneMyself()]),
                    wait(0.4)
                ])
            ]);
            script(whenClone(), [
                setv('popped', 0),
                // About one in four is a spiky urchin.
                ifElse(lt(random(1, 4), 2), [wear('urchin')], [wear('bubble')]),
                setSize(random(75, 125)),
                setv('rise', random(1.2, 2.6)),
                setv('wobble', random(0, 360)),
                gotoXY(random(-200, 200), -175),
                show(),
                repeatUntil(gt(ypos(), 168), [
                    changeY(v('rise')),
                    chg('wobble', 5),
                    setX(add(xpos(), mul(mathop('sin', v('wobble')), 0.9)))
                ]),
                deleteClone()
            ]);
            script(whenClicked(), [
                ifThen(and(playing(), eq(v('popped'), 0)), [
                    setv('popped', 1),
                    ifElse(eq(costumeNumber(), 2), [chg('Time', -3)], [chg('Score', 1)]),
                    repeat(4, [changeSize(18), changeEffect('ghost', 25)]),
                    deleteClone()
                ])
            ]);
        }
    });

    project.sprite('Fish', {
        costumes: [['fish', fishSvg, 28, 18]],
        variables: {swim: 0},
        x: -150,
        y: -110,
        rotationStyle: 'left-right',
        scripts: b => {
            const {script, whenFlag, whenReceive, gotoXY, point, rotationStyle, toFront, sayFor, say, join, v,
                forever, move, setv, chg, mul, setY, add, mathop, ifThen, gt, lt, xpos} = b;
            script(whenFlag(), [
                rotationStyle('left-right'),
                point(90),
                gotoXY(-150, -110),
                toFront(),
                sayFor('Tap the bubbles to pop them!', 2.5),
                sayFor('Leave the spiky urchins alone: they cost 3 seconds.', 3)
            ]);
            script(whenFlag(), [
                setv('swim', 0),
                forever([
                    move(1),
                    chg('swim', 3),
                    setY(add(-110, mul(mathop('sin', v('swim')), 6))),
                    ifThen(gt(xpos(), 190), [point(-90)]),
                    ifThen(lt(xpos(), -190), [point(90)])
                ])
            ]);
            script(whenReceive('game over'), [
                say(join('Time! You popped ', join(v('Score'), ' bubbles. Press the green flag to play again.')))
            ]);
        }
    });

    return [
        [bubbleSvg, -120, 60, 26, 26],
        [bubbleSvg, 40, 110, 26, 26, 1.3],
        [urchinSvg, 140, 20, 26, 26],
        [bubbleSvg, 180, 120, 26, 26, 0.8],
        [bubbleSvg, -20, -20, 26, 26, 1.1],
        [bubbleSvg, -190, -40, 26, 26, 0.9],
        [fishSvg, -120, -110, 28, 18, 1.2]
    ];
};

module.exports = {
    id: 'bubble-pop',
    build,
    backdropSvg
};
