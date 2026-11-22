import {hex2hsv, hsv2hex} from '../../tw-color-utils';

// Sparkjam block colours: bright brand colours with dark labels (design M1). Each category keeps
// its place and meaning from Scratch; only the shades change.
const shades = (primary, secondary, tertiary) => ({
    primary,
    secondary,
    tertiary,
    quaternary: tertiary
});

const blockColors = {
    motion: shades('#36f9c6', '#2ee0b2', '#1fb58f'),
    looks: shades('#ff7ab8', '#f2649f', '#d94a88'),
    sounds: shades('#e89cff', '#d985f2', '#bf68d9'),
    control: shades('#c9a7ff', '#b590f5', '#9a74db'),
    event: shades('#ffe14d', '#f2d03a', '#d9b628'),
    sensing: shades('#ffb347', '#f5a033', '#d98a22'),
    pen: shades('#7fe8f5', '#62d6e6', '#45b8c9'),
    operators: shades('#9be870', '#86d95a', '#6dbf45'),
    data: shades('#ff9466', '#f57f4f', '#d9673a'),
    data_lists: shades('#ffa98a', '#f59473', '#d97a5a'),
    more: shades('#ffa3c4', '#f28db0', '#d97396'),
    addons: shades('#5cf0dc', '#45dcc8', '#30bfac'),
    text: '#14001f',
    textField: '#ffffff',
    textFieldText: '#14001f',
    fieldShadow: 'rgba(20, 0, 31, 0.18)',
    menuHover: 'rgba(20, 0, 31, 0.15)'
};

const extensions = {};

// Extensions with their own colours get a light shade of them, so the dark labels stay readable.
const shade = (color, value) => {
    const hsv = hex2hsv(color);
    hsv[1] = Math.min(hsv[1], 55);
    hsv[2] = value;
    return hsv2hex(hsv);
};
const customExtensionColors = {
    primary: color => shade(color, 98),
    secondary: color => shade(color, 90),
    tertiary: color => shade(color, 76),
    quaternary: color => shade(color, 76),
    categoryIconBackground: color => shade(color, 98),
    categoryIconBorder: color => shade(color, 76)
};

export {
    blockColors,
    extensions,
    customExtensionColors
};
