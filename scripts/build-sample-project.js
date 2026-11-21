#!/usr/bin/env node
/* eslint-disable no-console */
// ScratchPro: builds the Spark Hop sample game (src/lib/sample-project/spark-hop.sb3).
// Spark Hop opens the first time the page loads, to show off the on-screen controls: it uses the
// arrow keys (joystick), space (jump) and x (dash).
// Run: node scripts/build-sample-project.js

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const JSZip = require('@turbowarp/jszip');

const OUT = path.join(__dirname, '../src/lib/sample-project/spark-hop.sb3');

// ---------- art ----------
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
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
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
    return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">` +
        `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${C.night}"/>` +
        `<stop offset="1" stop-color="${C.night2}"/></linearGradient></defs>` +
        `<rect width="480" height="360" fill="url(#sky)"/>${stars}` +
        `<path d="${hill}" fill="${C.mint}" fill-opacity="0.07"/></svg>`;
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
    return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">${body}</svg>`;
})();

const botSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">` +
    `<path d="M13 11 Q12 4 19 3" fill="none" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="20" cy="3.5" r="5" fill="${C.amber}" fill-opacity="0.3"/>` +
    `<circle cx="20" cy="3.5" r="3" fill="${C.amber}"/>` +
    `<rect x="3" y="11" width="24" height="26" rx="9" fill="${C.ink}"/>` +
    `<rect x="8" y="16" width="18" height="10" rx="5" fill="${C.night}"/>` +
    `<rect x="17" y="18.5" width="2.6" height="5" rx="1" fill="${C.mint}"/>` +
    `<rect x="21.5" y="18.5" width="2.6" height="5" rx="1" fill="${C.mint}"/>` +
    `<rect x="5" y="36" width="8" height="5" rx="2.5" fill="${C.dim}"/>` +
    `<rect x="17" y="36" width="8" height="5" rx="2.5" fill="${C.dim}"/></svg>`;
// Invisible-in-play box used for collisions, so the antenna never snags on platforms.
const hitboxSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">` +
    `<rect x="5" y="12" width="20" height="29" fill="${C.coral}"/></svg>`;

const sparkSvg = (() => {
    let pts = '';
    for (let i = 0; i < 8; i++) {
        const r = i % 2 ? 3.5 : 10;
        const a = i * Math.PI / 4;
        pts += `${(14 + (Math.cos(a) * r)).toFixed(2)},${(14 + (Math.sin(a) * r)).toFixed(2)} `;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">` +
        `<circle cx="14" cy="14" r="13" fill="${C.amber}" fill-opacity="0.18"/>` +
        `<polygon points="${pts.trim()}" fill="${C.amber}"/></svg>`;
})();

const blobSvg = (() => {
    let pts = '';
    for (let i = 0; i < 16; i++) {
        const r = i % 2 ? 10.5 : 14;
        const a = i / 16 * Math.PI * 2;
        pts += `${(15 + (Math.cos(a) * r)).toFixed(2)},${(15 + (Math.sin(a) * r)).toFixed(2)} `;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">` +
        `<polygon points="${pts.trim()}" fill="${C.coral}"/>` +
        `<rect x="10" y="12" width="3" height="5" rx="1" fill="${C.night}"/>` +
        `<rect x="17" y="12" width="3" height="5" rx="1" fill="${C.night}"/></svg>`;
})();

const assets = new Map();
const costume = (name, svg, cx, cy) => {
    const md5 = crypto.createHash('md5').update(svg)
        .digest('hex');
    assets.set(`${md5}.svg`, svg);
    return {name,
        bitmapResolution: 1,
        dataFormat: 'svg',
        assetId: md5,
        md5ext: `${md5}.svg`,
        rotationCenterX: cx,
        rotationCenterY: cy};
};

// ---------- block builder ----------
let counter = 0;
const nextId = prefix => `${prefix}${(++counter).toString(36)}`;
const variables = {}; // name -> id, across the whole project (names are unique)
const lists = {};
const broadcasts = {};

let blocks = null; // blocks of the target being built

const R = id => ({reporter: id});
const Bool = id => ({bool: id});
const Ang = n => ({angle: n});
const isExpr = x => x && typeof x === 'object' && (x.reporter || x.bool);

const TEXT_SLOTS = ['MESSAGE', 'STRING1', 'STRING2', 'VALUE'];
const BOOLEAN_SLOTS = ['CONDITION', 'OPERAND'];
const BOOLEAN_OPS = ['operator_and', 'operator_or'];
// The shadow left behind when a reporter is dragged out of a slot.
const obscuredShadow = name => {
    if (TEXT_SLOTS.includes(name)) return [10, ''];
    if (name === 'DIRECTION') return [8, '90'];
    return [4, '0'];
};

const toInput = (value, parentId, name, opcode) => {
    if (typeof value === 'number') return [1, [4, String(value)]];
    if (typeof value === 'string') return [1, [10, value]];
    if ('angle' in value) return [1, [8, String(value.angle)]];
    if (value.varName) return [3, [12, value.varName, variables[value.varName]], obscuredShadow(name)];
    if (value.shadow) {
        blocks[value.shadow].parent = parentId;
        return [1, value.shadow];
    }
    if ('substack' in value) {
        if (!value.substack) return [2, null];
        blocks[value.substack].parent = parentId;
        return [2, value.substack];
    }
    const id = value.bool || value.reporter;
    if (!id) throw new Error(`Bad input ${JSON.stringify(value)}`);
    blocks[id].parent = parentId;
    if (value.bool && (BOOLEAN_SLOTS.includes(name) || BOOLEAN_OPS.includes(opcode))) return [2, id];
    return [3, id, obscuredShadow(name)];
};

const mk = (opcode, {inputs = {}, fields = {}, shadow = false, mutation} = {}) => {
    const id = nextId('b');
    const block = {opcode, next: null, parent: null, inputs: {}, fields, shadow, topLevel: false};
    if (mutation) block.mutation = mutation;
    blocks[id] = block;
    for (const name of Object.keys(inputs)) {
        block.inputs[name] = toInput(inputs[name], id, name, opcode);
    }
    return id;
};
const menu = (opcode, field, value) => ({shadow: mk(opcode, {fields: {[field]: [value, null]}, shadow: true})});

// Link statements into a stack; returns the first id.
const stack = statements => {
    const ids = statements.flat().filter(Boolean);
    for (let i = 1; i < ids.length; i++) {
        blocks[ids[i - 1]].next = ids[i];
        blocks[ids[i]].parent = ids[i - 1];
    }
    return ids[0] || null;
};
const sub = statements => ({substack: stack(statements)});

let scriptX = 0;
const script = (hat, statements) => {
    const first = stack(statements);
    blocks[hat].topLevel = true;
    blocks[hat].x = scriptX;
    blocks[hat].y = 0;
    scriptX += 520;
    if (first) {
        blocks[hat].next = first;
        blocks[first].parent = hat;
    }
};

// Values
const v = name => ({varName: name});
const op2 = (opcode, a, b, n1 = 'NUM1', n2 = 'NUM2') => R(mk(opcode, {inputs: {[n1]: a, [n2]: b}}));
const add = (a, b) => op2('operator_add', a, b);
const subtract = (a, b) => op2('operator_subtract', a, b);
const mul = (a, b) => op2('operator_multiply', a, b);
const div = (a, b) => op2('operator_divide', a, b);
const mod = (a, b) => op2('operator_mod', a, b);
const random = (a, b) => R(mk('operator_random', {inputs: {FROM: a, TO: b}}));
const round = a => R(mk('operator_round', {inputs: {NUM: a}}));
const join = (a, b) => op2('operator_join', a, b, 'STRING1', 'STRING2');
const cmp = (opcode, a, b) => Bool(mk(opcode, {inputs: {OPERAND1: a, OPERAND2: b}}));
const gt = (a, b) => cmp('operator_gt', a, b);
const lt = (a, b) => cmp('operator_lt', a, b);
const eq = (a, b) => cmp('operator_equals', a, b);
const and = (a, b) => cmp('operator_and', a, b);
const not = a => Bool(mk('operator_not', {inputs: {OPERAND: a}}));
const key = k => Bool(mk('sensing_keypressed', {inputs: {
    KEY_OPTION: menu('sensing_keyoptions', 'KEY_OPTION', k)
}}));
const touching = name => Bool(mk('sensing_touchingobject', {inputs: {
    TOUCHINGOBJECTMENU: menu('sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', name)
}}));
const xpos = () => R(mk('motion_xposition'));
const ypos = () => R(mk('motion_yposition'));
const item = (list, index) => R(mk('data_itemoflist', {inputs: {INDEX: index}, fields: {LIST: [list, lists[list]]}}));
const lengthOf = list => R(mk('data_lengthoflist', {fields: {LIST: [list, lists[list]]}}));
const playing = () => eq(v('state'), 'play');

// Statements
const setv = (name, value) => mk('data_setvariableto', {inputs: {VALUE: value},
    fields: {VARIABLE: [name, variables[name]]}});
const chg = (name, value) => mk('data_changevariableby', {inputs: {VALUE: value},
    fields: {VARIABLE: [name, variables[name]]}});
const ifThen = (cond, body) => mk('control_if', {inputs: {CONDITION: cond, SUBSTACK: sub(body)}});
const ifElse = (cond, yes, no) => mk('control_if_else', {inputs: {CONDITION: cond,
    SUBSTACK: sub(yes),
    SUBSTACK2: sub(no)}});
const forever = body => mk('control_forever', {inputs: {SUBSTACK: sub(body)}});
const repeat = (n, body) => mk('control_repeat', {inputs: {TIMES: n, SUBSTACK: sub(body)}});
const repeatUntil = (cond, body) => mk('control_repeat_until', {inputs: {CONDITION: cond, SUBSTACK: sub(body)}});
const wait = secs => mk('control_wait', {inputs: {DURATION: secs}});
const changeX = dx => mk('motion_changexby', {inputs: {DX: dx}});
const changeY = dy => mk('motion_changeyby', {inputs: {DY: dy}});
const gotoXY = (x, y) => mk('motion_gotoxy', {inputs: {X: x, Y: y}});
const point = dir => mk('motion_pointindirection', {inputs: {DIRECTION: isExpr(dir) ? dir : Ang(dir)}});
const turn = deg => mk('motion_turnright', {inputs: {DEGREES: deg}});
const rotationStyle = style => mk('motion_setrotationstyle', {fields: {STYLE: [style, null]}});
const wear = name => mk('looks_switchcostumeto', {inputs: {COSTUME: menu('looks_costume', 'COSTUME', name)}});
const show = () => mk('looks_show');
const hide = () => mk('looks_hide');
const toFront = () => mk('looks_gotofrontback', {fields: {FRONT_BACK: ['front', null]}});
const setEffect = (effect, value) => mk('looks_seteffectto', {
    inputs: {VALUE: value},
    fields: {EFFECT: [effect, null]}
});
const changeEffect = (effect, value) => mk('looks_changeeffectby', {inputs: {CHANGE: value},
    fields: {EFFECT: [effect, null]}});
const clearEffects = () => mk('looks_cleargraphiceffects');
const setSize = n => mk('looks_setsizeto', {inputs: {SIZE: n}});
const changeSize = n => mk('looks_changesizeby', {inputs: {CHANGE: n}});
const say = msg => mk('looks_say', {inputs: {MESSAGE: msg}});
const sayFor = (msg, secs) => mk('looks_sayforsecs', {inputs: {MESSAGE: msg, SECS: secs}});
const broadcast = name => mk('event_broadcast', {inputs: {BROADCAST_INPUT: {shadow:
    mk('event_broadcast_menu', {fields: {BROADCAST_OPTION: [name, broadcasts[name]]}, shadow: true})}}});
const cloneMyself = () => mk('control_create_clone_of', {inputs: {
    CLONE_OPTION: menu('control_create_clone_of_menu', 'CLONE_OPTION', '_myself_')
}});

// Hats
const whenFlag = () => mk('event_whenflagclicked');
const whenClone = () => mk('control_start_as_clone');
const whenReceive = name => mk('event_whenbroadcastreceived', {fields: {BROADCAST_OPTION: [name, broadcasts[name]]}});

// Custom blocks with no inputs
const procMutation = (proccode, warp) => ({tagName: 'mutation',
    children: [],
    proccode,
    argumentids: '[]',
    argumentnames: '[]',
    argumentdefaults: '[]',
    warp: String(warp)});
const define = (proccode, warp, body) => {
    const proto = mk('procedures_prototype', {shadow: true, mutation: procMutation(proccode, warp)});
    const def = mk('procedures_definition', {inputs: {custom_block: {shadow: proto}}});
    script(def, body);
};
const call = (proccode, warp) => mk('procedures_call', {mutation: {tagName: 'mutation',
    children: [],
    proccode,
    argumentids: '[]',
    warp: String(warp)}});

// ---------- data ----------
const declare = (names, store, prefix) => {
    const out = {};
    for (const name of names) {
        store[name] = nextId(prefix);
        out[store[name]] = name;
    }
    return out;
};
const varsOf = (ids, values = {}) => {
    const out = {};
    for (const id of Object.keys(ids)) out[id] = [ids[id], ids[id] in values ? values[ids[id]] : 0];
    return out;
};

const stageVarIds = declare(['Sparks', 'Time', 'state'], variables, 'v');
const playerVarIds = declare(['vx', 'vy', 'ground', 'dash', 'dash wait', 'face', 'hurt', 'move'], variables, 'v');
const sparkVarIds = declare(['spot'], variables, 'v');
const blobVarIds = declare(['speed', 'left', 'right'], variables, 'v');
declare(['spot x', 'spot y'], lists, 'l');
const broadcastIds = declare(['game over'], broadcasts, 'm');

// Where sparks can appear (Scratch coordinates, above each platform and along the ground).
const SPOTS = [[-150, -128], [40, -128], [170, -128]].concat(PLATFORMS.map(([x, y, w]) => [
    x + (w / 2) - 240, 180 - y + 18
]));

const targets = [];

// ---------- Stage ----------
blocks = {};
scriptX = 0;
script(whenFlag(), [
    setv('state', 'play'),
    setv('Sparks', 0),
    setv('Time', 60),
    repeatUntil(lt(v('Time'), 1), [
        wait(1),
        chg('Time', -1)
    ]),
    setv('Time', 0),
    setv('state', 'over'),
    broadcast('game over')
]);
targets.push({
    isStage: true,
    name: 'Stage',
    variables: varsOf(stageVarIds, {Sparks: 0, Time: 60, state: 'play'}),
    lists: {
        [lists['spot x']]: ['spot x', SPOTS.map(s => s[0])],
        [lists['spot y']]: ['spot y', SPOTS.map(s => s[1])]
    },
    broadcasts: broadcastIds,
    blocks,
    comments: {},
    currentCostume: 0,
    costumes: [costume('Night sky', backdropSvg, 240, 180)],
    sounds: [],
    volume: 100,
    layerOrder: 0,
    tempo: 60,
    videoTransparency: 50,
    videoState: 'on',
    textToSpeechLanguage: null
});

const sprite = (name, extra) => Object.assign({
    isStage: false,
    name,
    variables: {},
    lists: {},
    broadcasts: {},
    blocks,
    comments: {},
    currentCostume: 0,
    sounds: [],
    volume: 100,
    visible: true,
    x: 0,
    y: 0,
    size: 100,
    direction: 90,
    draggable: false,
    rotationStyle: 'all around'
}, extra);

// ---------- Level ----------
blocks = {};
scriptX = 0;
script(whenFlag(), [gotoXY(0, 0), show()]);
targets.push(sprite('Level', {costumes: [costume('Platforms', levelSvg, 240, 180)], layerOrder: 1}));

// ---------- Spark ----------
blocks = {};
scriptX = 0;
define('jump to a free spot', false, [
    setv('spot', random(1, lengthOf('spot x'))),
    gotoXY(item('spot x', v('spot')), item('spot y', v('spot'))),
    repeatUntil(not(touching('Spark')), [
        setv('spot', random(1, lengthOf('spot x'))),
        gotoXY(item('spot x', v('spot')), item('spot y', v('spot')))
    ])
]);
script(whenFlag(), [
    hide(),
    repeat(3, [cloneMyself()])
]);
script(whenClone(), [
    setSize(100),
    clearEffects(),
    call('jump to a free spot', false),
    show(),
    forever([
        turn(4),
        ifThen(and(touching('Player'), playing()), [
            chg('Sparks', 1),
            chg('Time', 1),
            repeat(5, [changeSize(14), changeEffect('ghost', 20)]),
            setSize(100),
            clearEffects(),
            call('jump to a free spot', false)
        ])
    ])
]);
targets.push(sprite('Spark', {
    variables: varsOf(sparkVarIds),
    costumes: [costume('Spark', sparkSvg, 14, 14)],
    layerOrder: 2,
    visible: false
}));

// ---------- Blob ----------
blocks = {};
scriptX = 0;
define('patrol', false, [
    forever([
        changeX(v('speed')),
        ifThen(Bool(mk('operator_or', {inputs: {OPERAND1: gt(xpos(), v('right')), OPERAND2: lt(xpos(), v('left'))}})), [
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
    call('patrol', false)
]);
script(whenClone(), [
    setv('speed', 1.5),
    setv('left', 95),
    setv('right', 175),
    gotoXY(130, 34),
    call('patrol', false)
]);
targets.push(sprite('Blob', {
    variables: varsOf(blobVarIds),
    costumes: [costume('Blob', blobSvg, 15, 15)],
    layerOrder: 3,
    x: 60,
    y: -136
}));

// ---------- Player ----------
blocks = {};
scriptX = 0;
define('step', true, [
    wear('hitbox'),
    // Read the controls: the joystick presses the arrow keys, Space is jump, X is dash.
    ifElse(playing(), [
        setv('move', subtract(key('right arrow'), key('left arrow')))
    ], [
        setv('move', 0)
    ]),
    ifThen(not(eq(v('move'), 0)), [
        setv('face', v('move')),
        point(mul(90, v('move')))
    ]),
    ifThen(and(and(key('x'), eq(v('dash wait'), 0)), playing()), [
        setv('dash', 6),
        setv('dash wait', 30)
    ]),
    ifThen(gt(v('dash wait'), 0), [chg('dash wait', -1)]),
    ifElse(gt(v('dash'), 0), [
        chg('dash', -1),
        setv('vx', mul(11, v('face'))),
        setv('vy', 0)
    ], [
        setv('vx', add(mul(v('vx'), 0.75), mul(v('move'), 1.6))),
        chg('vy', -1),
        // Let go of jump early for a short hop.
        ifThen(and(not(key('space')), gt(v('vy'), 4)), [setv('vy', 4)]),
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
    ifThen(and(and(key('space'), gt(v('ground'), 0)), playing()), [
        setv('vy', 13),
        setv('ground', 0)
    ]),
    ifThen(lt(ypos(), -170), [
        gotoXY(-200, -125),
        setv('vy', 0)
    ]),
    wear('bot'),
    // A blob takes 5 seconds off the clock and knocks you back.
    ifThen(and(and(touching('Blob'), eq(v('hurt'), 0)), playing()), [
        setv('hurt', 45),
        chg('Time', -5),
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
    forever([call('step', true)])
]);
script(whenFlag(), [
    sayFor('Collect the sparks! Each one adds a second.', 3),
    sayFor('Move with the joystick. Space jumps, X dashes.', 3)
]);
script(whenReceive('game over'), [
    say(join('Time! You got ', join(v('Sparks'), ' sparks. Press the green flag to play again.')))
]);
targets.push(sprite('Player', {
    variables: varsOf(playerVarIds, {face: 1}),
    costumes: [costume('bot', botSvg, 15, 24), costume('hitbox', hitboxSvg, 15, 24)],
    layerOrder: 4,
    x: -200,
    y: -125,
    rotationStyle: 'left-right'
}));

// ---------- monitors ----------
const monitor = (name, x, y) => ({
    id: variables[name],
    mode: 'default',
    opcode: 'data_variable',
    params: {VARIABLE: name},
    spriteName: null,
    value: 0,
    width: 0,
    height: 0,
    x,
    y,
    visible: true,
    sliderMin: 0,
    sliderMax: 100,
    isDiscrete: true
});

const project = {
    targets,
    monitors: [monitor('Sparks', 5, 5), monitor('Time', 5, 32)],
    extensions: [],
    meta: {semver: '3.0.0', vm: '0.2.0', agent: 'ScratchPro sample builder'}
};

const zip = new JSZip();
zip.file('project.json', JSON.stringify(project));
for (const [name, svg] of assets) zip.file(name, svg);
zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE', platform: 'UNIX'}).then(buffer => {
    fs.mkdirSync(path.dirname(OUT), {recursive: true});
    fs.writeFileSync(OUT, buffer);
    console.log(`Wrote ${path.relative(process.cwd(), OUT)} (${buffer.length} bytes)`);
});
