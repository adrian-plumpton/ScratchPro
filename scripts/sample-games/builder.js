// ScratchPro: a small toolkit for writing Scratch projects in code, used to build the sample games.
// Each game file gets a fresh `project` from createProject() and describes its stage and sprites
// with the block helpers below. project.write(file) saves an .sb3.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const JSZip = require('@turbowarp/jszip');

const TEXT_SLOTS = ['MESSAGE', 'STRING1', 'STRING2', 'VALUE'];
const BOOLEAN_SLOTS = ['CONDITION', 'OPERAND'];
const BOOLEAN_OPS = ['operator_and', 'operator_or'];

// The shadow left behind when a reporter is dragged out of a slot.
const obscuredShadow = name => {
    if (TEXT_SLOTS.includes(name)) return [10, ''];
    if (name === 'DIRECTION') return [8, '90'];
    return [4, '0'];
};

// The Phone extension (static/extensions/sptouch.js): swipes, vibration and saved values.
const PHONE = 'sptouch';

const svgDoc = (w, h, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const createProject = () => {
    let counter = 0;
    const nextId = prefix => `${prefix}${(++counter).toString(36)}`;
    const variables = {}; // name -> id (names are unique across the project)
    const lists = {};
    const broadcasts = {};
    const assets = new Map();
    const targets = [];
    const monitors = [];
    let blocks = null; // blocks of the target being built
    let scriptX = 0;

    const R = id => ({reporter: id});
    const Bool = id => ({bool: id});
    const isExpr = x => x && typeof x === 'object' && (x.reporter || x.bool);

    const toInput = (value, parentId, name, opcode) => {
        if (typeof value === 'number') return [1, [4, String(value)]];
        if (typeof value === 'string') return [1, [10, value]];
        if ('angle' in value) return [1, [8, String(value.angle)]];
        if (value.varName) {
            if (!variables[value.varName]) throw new Error(`Unknown variable ${value.varName}`);
            return [3, [12, value.varName, variables[value.varName]], obscuredShadow(name)];
        }
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

    const usedExtensions = new Set();
    const mk = (opcode, {inputs = {}, fields = {}, shadow = false, mutation} = {}) => {
        const id = nextId('b');
        if (opcode.startsWith(`${PHONE}_`)) usedExtensions.add(PHONE);
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

    const varField = name => {
        if (!variables[name]) throw new Error(`Unknown variable ${name}`);
        return [name, variables[name]];
    };
    const listField = name => {
        if (!lists[name]) throw new Error(`Unknown list ${name}`);
        return [name, lists[name]];
    };

    const op2 = (opcode, a, b, n1 = 'NUM1', n2 = 'NUM2') => R(mk(opcode, {inputs: {[n1]: a, [n2]: b}}));
    const cmp = (opcode, a, b) => Bool(mk(opcode, {inputs: {OPERAND1: a, OPERAND2: b}}));

    const b = {
        // Values
        v: name => ({varName: name}),
        add: (x, y) => op2('operator_add', x, y),
        sub: (x, y) => op2('operator_subtract', x, y),
        mul: (x, y) => op2('operator_multiply', x, y),
        div: (x, y) => op2('operator_divide', x, y),
        mod: (x, y) => op2('operator_mod', x, y),
        random: (x, y) => R(mk('operator_random', {inputs: {FROM: x, TO: y}})),
        round: x => R(mk('operator_round', {inputs: {NUM: x}})),
        abs: x => R(mk('operator_mathop', {inputs: {NUM: x}, fields: {OPERATOR: ['abs', null]}})),
        mathop: (op, x) => R(mk('operator_mathop', {inputs: {NUM: x}, fields: {OPERATOR: [op, null]}})),
        costumeNumber: () => R(mk('looks_costumenumbername', {fields: {NUMBER_NAME: ['number', null]}})),
        join: (x, y) => op2('operator_join', x, y, 'STRING1', 'STRING2'),
        gt: (x, y) => cmp('operator_gt', x, y),
        lt: (x, y) => cmp('operator_lt', x, y),
        eq: (x, y) => cmp('operator_equals', x, y),
        and: (x, y) => cmp('operator_and', x, y),
        or: (x, y) => cmp('operator_or', x, y),
        not: x => Bool(mk('operator_not', {inputs: {OPERAND: x}})),
        key: k => Bool(mk('sensing_keypressed', {inputs: {
            KEY_OPTION: menu('sensing_keyoptions', 'KEY_OPTION', k)
        }})),
        touching: name => Bool(mk('sensing_touchingobject', {inputs: {
            TOUCHINGOBJECTMENU: menu('sensing_touchingobjectmenu', 'TOUCHINGOBJECTMENU', name)
        }})),
        xpos: () => R(mk('motion_xposition')),
        ypos: () => R(mk('motion_yposition')),
        size: () => R(mk('looks_size')),
        item: (list, index) => R(mk('data_itemoflist', {inputs: {INDEX: index}, fields: {LIST: listField(list)}})),
        lengthOf: list => R(mk('data_lengthoflist', {fields: {LIST: listField(list)}})),

        // Statements
        setv: (name, value) => mk('data_setvariableto', {inputs: {VALUE: value}, fields: {VARIABLE: varField(name)}}),
        chg: (name, value) => mk('data_changevariableby', {inputs: {VALUE: value}, fields: {VARIABLE: varField(name)}}),
        ifThen: (cond, body) => mk('control_if', {inputs: {CONDITION: cond, SUBSTACK: sub(body)}}),
        ifElse: (cond, yes, no) => mk('control_if_else', {inputs: {
            CONDITION: cond,
            SUBSTACK: sub(yes),
            SUBSTACK2: sub(no)
        }}),
        forever: body => mk('control_forever', {inputs: {SUBSTACK: sub(body)}}),
        repeat: (n, body) => mk('control_repeat', {inputs: {TIMES: n, SUBSTACK: sub(body)}}),
        repeatUntil: (cond, body) => mk('control_repeat_until', {inputs: {CONDITION: cond, SUBSTACK: sub(body)}}),
        wait: secs => mk('control_wait', {inputs: {DURATION: secs}}),
        waitUntil: cond => mk('control_wait_until', {inputs: {CONDITION: cond}}),
        changeX: dx => mk('motion_changexby', {inputs: {DX: dx}}),
        changeY: dy => mk('motion_changeyby', {inputs: {DY: dy}}),
        setX: x => mk('motion_setx', {inputs: {X: x}}),
        setY: y => mk('motion_sety', {inputs: {Y: y}}),
        gotoXY: (x, y) => mk('motion_gotoxy', {inputs: {X: x, Y: y}}),
        point: dir => mk('motion_pointindirection', {inputs: {DIRECTION: isExpr(dir) ? dir : {angle: dir}}}),
        turn: deg => mk('motion_turnright', {inputs: {DEGREES: deg}}),
        move: steps => mk('motion_movesteps', {inputs: {STEPS: steps}}),
        pointTowards: name => mk('motion_pointtowards', {inputs: {
            TOWARDS: menu('motion_pointtowards_menu', 'TOWARDS', name)
        }}),
        rotationStyle: style => mk('motion_setrotationstyle', {fields: {STYLE: [style, null]}}),
        wear: name => mk('looks_switchcostumeto', {inputs: {COSTUME: menu('looks_costume', 'COSTUME', name)}}),
        show: () => mk('looks_show'),
        hide: () => mk('looks_hide'),
        toFront: () => mk('looks_gotofrontback', {fields: {FRONT_BACK: ['front', null]}}),
        toBack: () => mk('looks_gotofrontback', {fields: {FRONT_BACK: ['back', null]}}),
        setEffect: (effect, value) => mk('looks_seteffectto', {
            inputs: {VALUE: value},
            fields: {EFFECT: [effect, null]}
        }),
        changeEffect: (effect, value) => mk('looks_changeeffectby', {
            inputs: {CHANGE: value},
            fields: {EFFECT: [effect, null]}
        }),
        clearEffects: () => mk('looks_cleargraphiceffects'),
        setSize: n => mk('looks_setsizeto', {inputs: {SIZE: n}}),
        changeSize: n => mk('looks_changesizeby', {inputs: {CHANGE: n}}),
        say: msg => mk('looks_say', {inputs: {MESSAGE: msg}}),
        sayFor: (msg, secs) => mk('looks_sayforsecs', {inputs: {MESSAGE: msg, SECS: secs}}),
        broadcast: name => mk('event_broadcast', {inputs: {BROADCAST_INPUT: {shadow: mk('event_broadcast_menu', {
            fields: {BROADCAST_OPTION: [name, broadcasts[name]]},
            shadow: true
        })}}}),
        cloneMyself: () => mk('control_create_clone_of', {inputs: {
            CLONE_OPTION: menu('control_create_clone_of_menu', 'CLONE_OPTION', '_myself_')
        }}),
        deleteClone: () => mk('control_delete_this_clone'),
        stopThisScript: () => mk('control_stop', {
            fields: {STOP_OPTION: ['this script', null]},
            mutation: {tagName: 'mutation', children: [], hasnext: 'false'}
        }),
        stopOtherScripts: () => mk('control_stop', {
            fields: {STOP_OPTION: ['other scripts in sprite', null]},
            mutation: {tagName: 'mutation', children: [], hasnext: 'true'}
        }),

        // Hats
        whenFlag: () => mk('event_whenflagclicked'),
        whenClone: () => mk('control_start_as_clone'),
        whenClicked: () => mk('event_whenthisspriteclicked'),
        whenReceive: name => mk('event_whenbroadcastreceived', {
            fields: {BROADCAST_OPTION: [name, broadcasts[name]]}
        }),

        // Phone blocks
        whenSwiped: direction => mk(`${PHONE}_whenSwiped`, {fields: {DIRECTION: [direction, null]}}),
        vibrate: ms => mk(`${PHONE}_vibrate`, {inputs: {MS: ms}}),
        saveAs: (value, name) => mk(`${PHONE}_save`, {inputs: {VALUE: value, NAME: name}}),
        saved: name => R(mk(`${PHONE}_load`, {inputs: {NAME: name}})),
        isSaved: name => Bool(mk(`${PHONE}_isSaved`, {inputs: {NAME: name}})),

        // Custom blocks with no inputs
        call: (proccode, warp = false) => mk('procedures_call', {mutation: {
            tagName: 'mutation',
            children: [],
            proccode,
            argumentids: '[]',
            warp: String(warp)
        }})
    };

    const define = (proccode, warp, body) => {
        const proto = mk('procedures_prototype', {shadow: true,
            mutation: {
                tagName: 'mutation',
                children: [],
                proccode,
                argumentids: '[]',
                argumentnames: '[]',
                argumentdefaults: '[]',
                warp: String(warp)
            }});
        const def = mk('procedures_definition', {inputs: {custom_block: {shadow: proto}}});
        script(def, body);
    };
    b.script = script;
    b.define = define;

    const costume = (name, svg, cx, cy) => {
        const md5 = crypto.createHash('md5').update(svg)
            .digest('hex');
        assets.set(`${md5}.svg`, svg);
        return {
            name,
            bitmapResolution: 1,
            dataFormat: 'svg',
            assetId: md5,
            md5ext: `${md5}.svg`,
            rotationCenterX: cx,
            rotationCenterY: cy
        };
    };

    // Declare variables owned by a target: {name: initialValue}.
    const declareVars = values => {
        const out = {};
        for (const name of Object.keys(values)) {
            if (variables[name]) throw new Error(`Variable ${name} declared twice`);
            variables[name] = nextId('v');
            out[variables[name]] = [name, values[name]];
        }
        return out;
    };

    /**
     * Add the stage. Declare its variables, lists and broadcasts here, before any sprite uses them.
     * @param {object} options Stage options.
     * @param {Array} options.costumes Backdrops: [name, svg].
     * @param {object} options.variables Global variables and their starting values.
     * @param {object} [options.lists] Global lists and their contents.
     * @param {Array<string>} [options.broadcasts] Message names.
     * @param {Function} [options.scripts] Called with the block helpers to add the stage's scripts.
     */
    const stage = options => {
        const stageVars = declareVars(options.variables || {});
        const stageLists = {};
        for (const name of Object.keys(options.lists || {})) {
            lists[name] = nextId('l');
            stageLists[lists[name]] = [name, options.lists[name]];
        }
        const stageBroadcasts = {};
        for (const name of options.broadcasts || []) {
            broadcasts[name] = nextId('m');
            stageBroadcasts[broadcasts[name]] = name;
        }
        blocks = {};
        scriptX = 0;
        if (options.scripts) options.scripts(b);
        targets.push({
            isStage: true,
            name: 'Stage',
            variables: stageVars,
            lists: stageLists,
            broadcasts: stageBroadcasts,
            blocks,
            comments: {},
            currentCostume: 0,
            costumes: options.costumes.map(([name, svg]) => costume(name, svg, 240, 180)),
            sounds: [],
            volume: 100,
            layerOrder: 0,
            tempo: 60,
            videoTransparency: 50,
            videoState: 'on',
            textToSpeechLanguage: null
        });
    };

    /**
     * Add a sprite, on top of the ones added before it.
     * @param {string} name Sprite name.
     * @param {object} options Sprite options.
     * @param {Array} options.costumes Costumes: [name, svg, rotationCenterX, rotationCenterY].
     * @param {object} [options.variables] Sprite-only variables and their starting values.
     * @param {Function} [options.scripts] Called with the block helpers to add the sprite's scripts.
     */
    const sprite = (name, options) => {
        const spriteVars = declareVars(options.variables || {});
        blocks = {};
        scriptX = 0;
        if (options.scripts) options.scripts(b);
        targets.push({
            isStage: false,
            name,
            variables: spriteVars,
            lists: {},
            broadcasts: {},
            blocks,
            comments: {},
            currentCostume: 0,
            costumes: options.costumes.map(([cName, svg, cx, cy]) => costume(cName, svg, cx, cy)),
            sounds: [],
            volume: 100,
            layerOrder: targets.length,
            visible: options.visible !== false,
            x: options.x || 0,
            y: options.y || 0,
            size: options.size || 100,
            direction: 90,
            draggable: false,
            rotationStyle: options.rotationStyle || 'all around'
        });
    };

    // Show a global variable on the stage.
    const monitor = (name, x, y) => monitors.push({
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

    const write = async file => {
        const project = {
            targets,
            monitors,
            extensions: [...usedExtensions],
            // Loaded from whichever site is running the game (see tw-security-manager).
            extensionURLs: Object.fromEntries([...usedExtensions].map(id => [
                id, `https://scratchpro-app.netlify.app/extensions/${id}.js`
            ])),
            meta: {semver: '3.0.0', vm: '0.2.0', agent: 'ScratchPro sample builder'}
        };
        const zip = new JSZip();
        zip.file('project.json', JSON.stringify(project));
        for (const [name, svg] of assets) zip.file(name, svg);
        const buffer = await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE', platform: 'UNIX'});
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.writeFileSync(file, buffer);
        return buffer.length;
    };

    return {stage, sprite, monitor, write};
};

// A preview picture of a game: the backdrop with sprite pictures placed at Scratch coordinates.
// sprites: [[svg, x, y, rotationCenterX, rotationCenterY, scale?], ...]
const thumbnail = (backdropSvg, sprites) => {
    const inner = svg => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const size = svg => {
        const m = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
        return [Number(m[1]), Number(m[2])];
    };
    let body = inner(backdropSvg);
    for (const [svg, x, y, cx, cy, scale = 1] of sprites) {
        const [w, h] = size(svg);
        const left = 240 + x - (cx * scale);
        const top = 180 - y - (cy * scale);
        body += `<svg x="${left}" y="${top}" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">` +
            `${inner(svg)}</svg>`;
    }
    return svgDoc(480, 360, body);
};

// A repeatable random number generator, so the art is the same on every build.
const seeded = seed => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
};

module.exports = {createProject, svgDoc, thumbnail, seeded};
