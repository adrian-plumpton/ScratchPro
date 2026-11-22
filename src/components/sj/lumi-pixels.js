// Sparkjam: Lumi, the pixel robot mascot, drawn on a 22 x 25 grid. Every pose shares one design.
// makeLumi returns rows of single-letter colour codes; '.' is transparent and 'O' is the outline.

const W = 22;
const H = 25;

const PALETTE = {
    W: '#f3efe6',
    w: '#d9d2e9',
    V: '#0f1330',
    E: '#36f9c6',
    L: '#ffe14d',
    Y: '#ffffff',
    l: '#ffb347',
    A: '#f3efe6',
    F: '#a9acc8',
    O: '#14001f',
    P: '#ff8fb8',
    H: '#f3efe6',
    N: '#0f1330',
    C: '#36f9c6'
};
const OUTLINED = 'WwFHN';

/* eslint-disable max-statements-per-line */
const makeLumi = ({arms = 'down', eyes = 'open', jump = false, phone = false} = {}) => {
    const g = Array.from({length: H}, () => Array(W).fill('.'));
    const set = (x, y, c) => {
        const yy = y - (jump ? 2 : 0);
        if (x >= 0 && x < W && yy >= 0 && yy < H) g[yy][x] = c;
    };
    const rect = (x0, y0, x1, y1, c) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
    };
    // Lantern and antenna.
    rect(14, 2, 16, 4, 'L'); set(15, 1, 'L'); set(13, 3, 'l'); set(17, 3, 'l'); set(15, 5, 'l'); set(14, 3, 'Y');
    set(14, 6, 'A'); set(13, 7, 'A'); set(12, 8, 'A');
    // Body with rounded corners and a shaded belly.
    rect(4, 9, 17, 21, 'W');
    rect(4, 20, 17, 21, 'w');
    [[4, 9], [17, 9], [4, 21], [17, 21]].forEach(([x, y]) => set(x, y, '.'));
    // Visor.
    rect(6, 11, 16, 15, 'V');
    [[6, 11], [16, 11], [6, 15], [16, 15]].forEach(([x, y]) => set(x, y, 'W'));
    // Eyes, looking right.
    const eye = x => {
        if (eyes === 'open') rect(x, 12, x, 14, 'E');
        if (eyes === 'happy') {
            set(x - 1, 13, 'E'); set(x, 12, 'E'); set(x + 1, 13, 'E');
        }
        if (eyes === 'wink') rect(x - 1, 13, x + 1, 13, 'E');
        if (eyes === 'sad') {
            set(x - 1, 12, 'E'); set(x, 13, 'E'); set(x + 1, 12, 'E');
        }
    };
    eye(11);
    if (eyes === 'wink') rect(14, 12, 14, 14, 'E');
    else eye(14);
    // Blush.
    set(7, 17, 'P'); set(15, 17, 'P');
    // Feet.
    if (jump) {
        rect(6, 22, 8, 22, 'F'); rect(13, 22, 15, 22, 'F');
    } else {
        rect(6, 22, 8, 23, 'F'); rect(13, 22, 15, 23, 'F');
    }
    // Arms sit one pixel away from the body, joined at the shoulder, so they read as arms.
    const armDown = left => {
        rect(left ? 1 : 19, 15, left ? 2 : 20, 18, 'H');
        set(left ? 3 : 18, 15, 'H');
    };
    const armUp = left => {
        rect(left ? 1 : 19, 9, left ? 2 : 20, 13, 'H');
        set(left ? 3 : 18, 14, 'H');
        set(left ? 2 : 19, 14, 'H');
    };
    if (arms === 'down') {
        armDown(true); armDown(false);
    }
    if (arms === 'wave') {
        armDown(true); armUp(false); set(20, 8, 'H'); set(21, 9, 'H');
    }
    if (arms === 'up') {
        armUp(true); armUp(false);
    }
    if (arms === 'phone') {
        armDown(true); rect(18, 15, 19, 16, 'H');
    }
    if (phone) {
        rect(19, 12, 21, 17, 'N'); rect(20, 13, 20, 16, 'C');
    }
    // Outline around the body, arms, feet and phone.
    const isBody = (x, y) => y >= 0 && y < H && x >= 0 && x < W && OUTLINED.includes(g[y][x]);
    const out = g.map(r => r.slice());
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (g[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isBody(x + dx, y + dy))) {
                out[y][x] = 'O';
            }
        }
    }
    return out.map(r => r.join(''));
};
/* eslint-enable max-statements-per-line */

const SPARK = ['...Y...', '...Y...', '..YYY..', 'YYYWYYY', '..YYY..', '...Y...', '...Y...'];

export {makeLumi, PALETTE, SPARK};
