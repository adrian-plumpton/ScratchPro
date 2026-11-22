// Sparkjam: drawing costumes together in a jam.
//
// The paint editor (scratch-paint) draws with paper.js; this module shares the same paper.js copy, so it
// can see the drawing directly.
//
//  - Live strokes: while you draw, your pen path is sent a few times a second. Anyone looking at the
//    same costume sees it drawn over their canvas in your jam colour, at your brush size.
//  - Merging: when you finish an edit, the editor saves the costume. The shapes you added and removed
//    since the last save are sent (shapes are recognised by their content). Anyone with that costume
//    open gets them merged into their drawing, so two people drawing at once both keep their strokes.
//    Anyone not looking at it gets the saved costume. A change that arrives mid-stroke waits until the
//    stroke is finished.
//  - Bitmap costumes don't merge; changing one sends the whole game (as other big changes do).

import paper from '@turbowarp/paper';
import log from './log';

const STAGE = '__stage__';
const LIVE_EVERY = 50;
const MAX_FULL_SVG = 400 * 1024;
const SVG_NS = 'http://www.w3.org/2000/svg';

const nameOf = target => (target.isStage ? STAGE : target.getName());

// FNV-1a: a short, stable fingerprint for a shape's SVG.
const fingerprint = text => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16);
};

const paintingLayer = () => {
    if (!paper.project) return null;
    return paper.project.layers.find(layer => layer.data && layer.data.isPaintingLayer) || null;
};

const paintCanvas = () => {
    const canvas = document.querySelector('canvas[class*="paper-canvas_paper-canvas"]');
    return canvas && canvas.getBoundingClientRect().width > 0 ? canvas : null;
};

// The shapes in the paint editor, in order, with fingerprints. Identical shapes get #2, #3...
const shapes = () => {
    const layer = paintingLayer();
    if (!layer) return [];
    const seen = new Map();
    return layer.children.map(item => {
        const svg = item.exportSVG({asString: true});
        const base = fingerprint(svg);
        const count = (seen.get(base) || 0) + 1;
        seen.set(base, count);
        return {hash: count > 1 ? `${base}#${count}` : base, item, svg};
    });
};

/**
 * Connect costume drawing to a jam session.
 * @param {object} session The jam session: {vm, broadcast(event), isApplying(), setApplying(bool),
 *     requestFullSync(), colorOf(connectionId), myColor()}.
 * @returns {{handle: Function, detach: Function}} Handle paint events from the room; detach to stop.
 */
const attachPaint = session => {
    const vm = session.vm;
    const baselines = new Map(); // "target#costume" -> [hash]
    const queue = [];
    const remoteStrokes = new Map(); // connectionId -> {points, color, size, target, costume}
    let drawing = false;
    let myPoints = [];
    let lastSent = 0;
    let overlay = null;
    let raf = 0;

    const editing = () => {
        const target = vm.editingTarget;
        if (!target) return null;
        return {target, name: nameOf(target), costume: target.currentCostume};
    };
    const editorOpenOn = (name, costume) => {
        const here = editing();
        return !!(paintCanvas() && paintingLayer() && here && here.name === name && here.costume === costume);
    };
    const keyFor = (name, costume) => `${name}#${costume}`;
    const takeBaseline = () => {
        const here = editing();
        if (!here || !paintCanvas() || !paintingLayer()) return;
        const key = keyFor(here.name, here.costume);
        if (!baselines.has(key)) baselines.set(key, shapes().map(s => s.hash));
    };

    // Live strokes, drawn over the paint canvas.
    const drawOverlay = () => {
        raf = 0;
        const canvas = paintCanvas();
        const here = editing();
        const visible = [...remoteStrokes.values()].filter(stroke => here && canvas && paper.view &&
            stroke.target === here.name && stroke.costume === here.costume);
        if (!visible.length) {
            if (overlay) overlay.style.display = 'none';
            return;
        }
        if (!overlay) {
            overlay = document.createElement('canvas');
            overlay.style.position = 'fixed';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '60';
            document.body.appendChild(overlay);
        }
        const box = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        overlay.style.display = 'block';
        overlay.style.left = `${box.left}px`;
        overlay.style.top = `${box.top}px`;
        overlay.style.width = `${box.width}px`;
        overlay.style.height = `${box.height}px`;
        overlay.width = Math.round(box.width * ratio);
        overlay.height = Math.round(box.height * ratio);
        const ctx = overlay.getContext('2d');
        ctx.scale(ratio, ratio);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        visible.forEach(stroke => {
            if (!stroke.points.length) return;
            ctx.strokeStyle = stroke.color;
            ctx.globalAlpha = 0.75;
            ctx.lineWidth = Math.max(2, stroke.size * paper.view.zoom);
            ctx.beginPath();
            stroke.points.forEach(([x, y], i) => {
                const p = paper.view.projectToView(new paper.Point(x, y));
                if (i) ctx.lineTo(p.x, p.y);
                else ctx.moveTo(p.x, p.y);
            });
            ctx.stroke();
        });
    };
    const redraw = () => {
        if (!raf) raf = requestAnimationFrame(drawOverlay);
    };

    // My strokes: capture the pointer on the paint canvas.
    // The brush size box in the paint editor's tool bar.
    const brushSize = () => {
        const input = document.querySelector('[class*="mode-tools_mode-tools"] input');
        return (input && Number(input.value)) || 10;
    };
    const sendLive = force => {
        const here = editing();
        if (!here || !myPoints.length) return;
        const now = Date.now();
        if (!force && now - lastSent < LIVE_EVERY) return;
        lastSent = now;
        session.broadcast({
            type: 'paint-live', target: here.name, costume: here.costume, points: myPoints, size: brushSize()
        });
        myPoints = [];
    };
    const onDown = e => {
        const canvas = paintCanvas();
        if (!canvas || e.target !== canvas) return;
        takeBaseline();
        drawing = true;
        myPoints = [];
    };
    const onMove = e => {
        if (!drawing || !paper.view) return;
        const canvas = paintCanvas();
        if (!canvas) return;
        const box = canvas.getBoundingClientRect();
        const p = paper.view.viewToProject(new paper.Point(e.clientX - box.left, e.clientY - box.top));
        myPoints.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
        sendLive(false);
    };
    const onUp = () => {
        if (!drawing) return;
        drawing = false;
        sendLive(true);
        session.broadcast({type: 'paint-live-end'});
        // Changes that arrived mid-stroke are merged once the editor has saved this stroke.
        setTimeout(() => {
            if (drawing) return;
            queue.splice(0).forEach(event => applyRemote(event)); // eslint-disable-line no-use-before-define
        }, 300);
    };
    const onKey = () => takeBaseline();

    // Someone else's saved change.
    const applyRemote = event => {
        const target = event.target === STAGE ? vm.runtime.getTargetForStage() :
            vm.runtime.getSpriteTargetByName(event.target);
        const costume = target && target.getCostumes()[event.costume];
        if (!costume) return;
        const key = keyFor(event.target, event.costume);
        session.setApplying(true);
        try {
            if (event.ops && editorOpenOn(event.target, event.costume)) {
                const layer = paintingLayer();
                const removed = new Set(event.ops.removed);
                // Only what this change adds and removes moves the starting point: my own strokes that
                // aren't saved yet must still count as mine.
                const base = new Set(baselines.get(key) || []);
                shapes().forEach(shape => {
                    if (removed.has(shape.hash)) {
                        shape.item.remove();
                        base.delete(shape.hash);
                    }
                });
                event.ops.added.forEach(add => {
                    const imported = paper.project.importSVG(`<svg xmlns="${SVG_NS}">${add.svg}</svg>`,
                        {insert: false});
                    const item = imported && imported.children && imported.children[0];
                    if (!item) return;
                    item.remove();
                    layer.insertChild(Math.min(add.index, layer.children.length), item);
                });
                paper.view.update();
                // Fingerprints of the shapes just added, as they are here (identical shapes get #2...).
                const addedSvgs = new Set(event.ops.added.map(add => add.svg));
                shapes().forEach(shape => {
                    if (addedSvgs.has(shape.svg) || event.ops.added.some(add => add.hash === shape.hash)) {
                        base.add(shape.hash);
                    }
                });
                baselines.set(key, [...base]);
            } else {
                baselines.delete(key);
            }
            // The saved costume (the sender's whole drawing). Merged changes reach it with the next save
            // from here.
            if (event.full) {
                vm._updateSvg(costume, event.full, event.rx, event.ry);
                vm.emitTargetsUpdate(false);
            }
        } catch (e) {
            log.warn('Jam: could not merge a costume change', e);
        } finally {
            session.setApplying(false);
        }
    };

    // My saved change: wrap the VM's costume updates.
    const updateSvg = vm.updateSvg;
    const updateBitmap = vm.updateBitmap;
    vm.updateSvg = function (costumeIndex, svg, rotationCenterX, rotationCenterY) {
        const result = updateSvg.call(this, costumeIndex, svg, rotationCenterX, rotationCenterY);
        if (session.isApplying()) return result;
        const here = editing();
        if (!here) return result;
        // The paint editor saves by shifting the drawing, exporting it and shifting it back, and this runs
        // in the middle. Compare shapes just afterwards, once the drawing is back in place.
        setTimeout(() => {
            const event = {
                type: 'paint-ops',
                target: here.name,
                costume: costumeIndex,
                full: svg.length <= MAX_FULL_SVG ? svg : null,
                rx: rotationCenterX,
                ry: rotationCenterY
            };
            if (editorOpenOn(here.name, costumeIndex)) {
                const key = keyFor(here.name, costumeIndex);
                const now = shapes();
                const before = new Set(baselines.get(key) || []);
                const after = new Set(now.map(s => s.hash));
                event.ops = {
                    removed: [...before].filter(hash => !after.has(hash)),
                    added: now.map((s, index) => ({hash: s.hash, svg: s.svg, index}))
                        .filter(s => !before.has(s.hash))
                };
                baselines.set(key, now.map(s => s.hash));
                // Without a starting point every shape looks new; send the costume only.
                if (!before.size && now.length > 1) delete event.ops;
            }
            if (!event.full && !event.ops) {
                session.requestFullSync();
                return;
            }
            session.broadcast(event);
        }, 0);
        return result;
    };
    vm.updateBitmap = function (...args) {
        const result = updateBitmap.apply(this, args);
        if (!session.isApplying()) session.requestFullSync();
        return result;
    };

    // Note where each costume starts as soon as it opens, so the first edit (even a keyboard one) merges.
    let lastOpen = '';
    const watchOpen = setInterval(() => {
        const here = editing();
        const open = here && paintCanvas() && paintingLayer() ? keyFor(here.name, here.costume) : '';
        if (open && open !== lastOpen && !drawing) takeBaseline();
        lastOpen = open;
    }, 400);

    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('keydown', onKey, true);
    vm.on('workspaceUpdate', redraw);

    const handle = (event, connectionId) => {
        if (event.type === 'paint-live') {
            const stroke = remoteStrokes.get(connectionId) || {points: []};
            if (stroke.target !== event.target || stroke.costume !== event.costume) stroke.points = [];
            remoteStrokes.set(connectionId, {
                ...stroke,
                target: event.target,
                costume: event.costume,
                size: Number(event.size) || 10,
                color: session.colorOf(connectionId),
                points: stroke.points.concat(Array.isArray(event.points) ? event.points.slice(0, 500) : [])
            });
            redraw();
        } else if (event.type === 'paint-live-end') {
            // Keep the live stroke up until the real one has had time to arrive.
            setTimeout(() => {
                remoteStrokes.delete(connectionId);
                redraw();
            }, 700);
        } else if (event.type === 'paint-ops') {
            if (drawing) queue.push(event);
            else applyRemote(event);
        }
    };

    const detach = () => {
        clearInterval(watchOpen);
        vm.updateSvg = updateSvg;
        vm.updateBitmap = updateBitmap;
        document.removeEventListener('pointerdown', onDown, true);
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerup', onUp, true);
        document.removeEventListener('keydown', onKey, true);
        vm.off('workspaceUpdate', redraw);
        if (overlay) overlay.remove();
        if (raf) cancelAnimationFrame(raf);
    };

    return {handle, detach};
};

// Local testing only: how many shapes are in the paint editor's drawing.
if (typeof location !== 'undefined' && location.hostname === 'localhost') {
    window.__sjPaint = {
        count: () => (paintingLayer() ? paintingLayer().children.length : -1),
        hashes: () => shapes().map(shape => shape.hash)
            .sort()
    };
}

export {attachPaint};
