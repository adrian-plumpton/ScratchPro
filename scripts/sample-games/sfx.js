// Sparkjam: retro sound effects for the sample games, made in code (no recordings), as small WAV files.
// Each effect is a list of notes: a wave (square, triangle, saw, noise) that slides from one pitch to
// another, with a quick fade so nothing clicks.

const RATE = 22050;

// Seeded, so rebuilding gives byte-identical sounds.
let seed = 1;
const noise = () => {
    seed = ((seed * 1103515245) + 12345) % 2147483648;
    return ((seed / 2147483648) * 2) - 1;
};

const wave = (type, phase) => {
    const p = phase - Math.floor(phase);
    if (type === 'square') return p < 0.5 ? 1 : -1;
    if (type === 'triangle') return p < 0.5 ? (4 * p) - 1 : 3 - (4 * p);
    if (type === 'saw') return (2 * p) - 1;
    return noise();
};

/**
 * @param {Array<object>} notes Notes in order: {type, from, to, length (s), volume, gap (s)}.
 * @returns {Buffer} A mono 16-bit WAV file.
 */
const render = notes => {
    seed = 1;
    const samples = [];
    notes.forEach(({type = 'square', from = 440, to = from, length = 0.1, volume = 0.5, gap = 0}) => {
        const count = Math.round(length * RATE);
        let phase = 0;
        for (let i = 0; i < count; i++) {
            const t = i / count;
            const frequency = from * Math.pow(to / from, t);
            phase += frequency / RATE;
            // Short attack, then fade out to the end of the note.
            const envelope = Math.min(1, i / (RATE * 0.004)) * Math.pow(1 - t, 1.5);
            samples.push(wave(type, phase) * envelope * volume);
        }
        for (let i = 0; i < Math.round(gap * RATE); i++) samples.push(0);
    });
    const data = Buffer.alloc(samples.length * 2);
    samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(RATE, 24);
    header.writeUInt32LE(RATE * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);
    return Buffer.concat([header, data]);
};

const note = (frequency, length, type = 'square', volume = 0.35) => ({type, from: frequency, length, volume});

/* eslint-disable max-len */ // One effect per line reads best.
const SFX = {
    jump: () => render([{type: 'square', from: 260, to: 720, length: 0.14, volume: 0.3}]),
    dash: () => render([{type: 'noise', from: 1, length: 0.16, volume: 0.35}, {type: 'square', from: 600, to: 200, length: 0.08, volume: 0.15}]),
    collect: () => render([note(988, 0.06), note(1319, 0.12)]),
    hit: () => render([{type: 'saw', from: 300, to: 70, length: 0.25, volume: 0.4}, {type: 'noise', from: 1, length: 0.08, volume: 0.2}]),
    timeUp: () => render([note(784, 0.12), note(659, 0.12), note(523, 0.12), note(392, 0.35, 'triangle', 0.45)]),
    boost: () => render([{type: 'saw', from: 120, to: 420, length: 0.3, volume: 0.25}]),
    crash: () => render([{type: 'noise', from: 1, length: 0.4, volume: 0.5}, {type: 'square', from: 180, to: 50, length: 0.3, volume: 0.25}]),
    pop: () => render([{type: 'triangle', from: 900, to: 1500, length: 0.06, volume: 0.45}, {type: 'noise', from: 1, length: 0.03, volume: 0.15}]),
    ouch: () => render([{type: 'square', from: 220, to: 110, length: 0.22, volume: 0.35}]),
    gem: () => render([note(1047, 0.07, 'triangle', 0.4), note(1568, 0.07, 'triangle', 0.4), note(2093, 0.16, 'triangle', 0.35)]),
    boo: () => render([{type: 'triangle', from: 330, to: 180, length: 0.45, volume: 0.45}]),
    win: () => render([note(523, 0.1), note(659, 0.1), note(784, 0.1), note(1047, 0.3, 'triangle', 0.45)]),
    start: () => render([note(659, 0.08), note(988, 0.14)])
/* eslint-enable max-len */
};

module.exports = {SFX, RATE};
