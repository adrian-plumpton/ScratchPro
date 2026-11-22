// Sparkjam: links in jam chat. Everyone in a jam has the same game, so instead of copying sprites or
// code into chat, a message can point at them: a sprite ("look at Player") or a script ("look at this
// bit"). Following a link opens the sprite, and for a script scrolls the code area to it and makes it glow.

const STAGE = '__stage__';
const GLOW_FOR = 2500;

const nameOf = target => (target.isStage ? STAGE : target.getName());
const workspace = () => window.ScratchBlocks && window.ScratchBlocks.getMainWorkspace &&
    window.ScratchBlocks.getMainWorkspace();

/**
 * @param {object} vm The VM.
 * @param {string} targetId The sprite's id.
 * @returns {?object} A sprite link.
 */
const spriteLink = (vm, targetId) => {
    const target = vm.runtime.getTargetById(targetId);
    if (!target) return null;
    return {kind: 'sprite', target: nameOf(target), label: target.isStage ? 'Stage' : target.getName()};
};

/**
 * @param {object} vm The VM.
 * @param {string} blockId Any block in the script, in the sprite being edited.
 * @returns {?object} A script link, labelled with the script's first block.
 */
const scriptLink = (vm, blockId) => {
    const target = vm.editingTarget;
    if (!target) return null;
    const topId = target.blocks.getTopLevelScript(blockId) || blockId;
    if (!target.blocks.getBlock(topId)) return null;
    const ws = workspace();
    const block = ws && ws.getBlockById(topId);
    let label = block ? block.toString(40) : 'a script';
    if (label.length > 40) label = `${label.slice(0, 39)}…`;
    return {kind: 'script', target: nameOf(target), blockId: topId, label};
};

/**
 * The script with a selected block in the code area, if any.
 * @param {object} vm The VM.
 * @returns {?object} A script link.
 */
const selectedScriptLink = vm => {
    const selected = window.ScratchBlocks && window.ScratchBlocks.selected;
    if (!selected || !selected.workspace || selected.workspace !== workspace() || selected.isInFlyout) return null;
    return scriptLink(vm, selected.getRootBlock().id);
};

/**
 * Follow a link: open the sprite, and for a script, centre and glow it.
 * @param {object} vm The VM.
 * @param {object} link The link.
 * @returns {Promise<?string>} A problem to show, or null.
 */
const followLink = async (vm, link) => {
    const target = link.target === STAGE ? vm.runtime.getTargetForStage() :
        vm.runtime.getSpriteTargetByName(link.target);
    if (!target) return 'That sprite isn\'t in the game any more.';
    if (vm.editingTarget !== target) {
        vm.setEditingTarget(target.id);
        // Give the code area a moment to show the sprite's blocks.
        await new Promise(resolve => setTimeout(resolve, 350));
    }
    if (link.kind !== 'script') return null;
    const ws = workspace();
    if (!ws || !ws.getBlockById(link.blockId)) return 'That code has been moved or deleted.';
    ws.centerOnBlock(link.blockId);
    ws.glowStack(link.blockId, true);
    setTimeout(() => {
        if (ws.getBlockById(link.blockId)) ws.glowStack(link.blockId, false);
    }, GLOW_FOR);
    return null;
};

export {spriteLink, scriptLink, selectedScriptLink, followLink};
