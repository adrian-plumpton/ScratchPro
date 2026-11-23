// Sparkjam: the paint editor reads costume pixels with getImageData in several places (opening a
// bitmap costume, the fill tool, saving) without checking for an empty area. Browsers throw on a
// zero-width or zero-height read, and that one throw takes down the whole editor. Reading nothing
// now returns a single transparent pixel instead, which every caller already treats as "empty".

const guard = Proto => {
    if (!Proto || !Proto.prototype || !Proto.prototype.getImageData) return;
    const original = Proto.prototype.getImageData;
    if (original.sjGuarded) return;
    const guarded = function (sx, sy, sw, sh, ...rest) {
        if (arguments.length >= 4 && (!Math.trunc(sw) || !Math.trunc(sh))) {
            return new ImageData(1, 1);
        }
        return original.call(this, sx, sy, sw, sh, ...rest); // eslint-disable-line no-invalid-this
    };
    guarded.sjGuarded = true;
    Proto.prototype.getImageData = guarded;
};

if (typeof window !== 'undefined' && typeof ImageData !== 'undefined') {
    guard(window.CanvasRenderingContext2D);
    guard(window.OffscreenCanvasRenderingContext2D);
}
