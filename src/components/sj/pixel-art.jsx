// Sparkjam: crisp pixel-art SVGs (Lumi and the spark), drawn from rows of colour codes.

import React from 'react';
import PropTypes from 'prop-types';
import {makeLumi, PALETTE, SPARK} from './lumi-pixels';

const cache = new Map();

const PixelArt = ({rows, colors, px, className, label}) => {
    const rects = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
        const fill = colors[ch];
        if (fill) {
            rects.push(<rect
                key={`${x},${y}`}
                x={x}
                y={y}
                width="1.02"
                height="1.02"
                fill={fill}
            />);
        }
    }));
    return (
        <svg
            className={className}
            width={rows[0].length * px}
            height={rows.length * px}
            viewBox={`0 0 ${rows[0].length} ${rows.length}`}
            shapeRendering="crispEdges"
            role={label ? 'img' : null}
            aria-label={label || null}
            aria-hidden={label ? null : 'true'}
        >{rects}</svg>
    );
};
PixelArt.propTypes = {
    rows: PropTypes.arrayOf(PropTypes.string).isRequired,
    colors: PropTypes.objectOf(PropTypes.string).isRequired,
    px: PropTypes.number.isRequired,
    className: PropTypes.string,
    label: PropTypes.string
};

/**
 * Lumi, the Sparkjam robot.
 * @param {object} props Pose and size: arms (down, wave, up, phone), eyes (open, happy, wink, sad),
 *     jump and phone, plus px (the size of one pixel).
 * @returns {React.ReactElement} An SVG.
 */
const Lumi = ({arms, eyes, jump, phone, px, className, label}) => {
    const key = `${arms}/${eyes}/${jump}/${phone}`;
    if (!cache.has(key)) cache.set(key, makeLumi({arms, eyes, jump, phone}));
    return (
        <PixelArt
            rows={cache.get(key)}
            colors={PALETTE}
            px={px}
            className={className}
            label={label}
        />
    );
};
Lumi.propTypes = {
    arms: PropTypes.oneOf(['down', 'wave', 'up', 'phone']),
    eyes: PropTypes.oneOf(['open', 'happy', 'wink', 'sad']),
    jump: PropTypes.bool,
    phone: PropTypes.bool,
    px: PropTypes.number,
    className: PropTypes.string,
    label: PropTypes.string
};
Lumi.defaultProps = {
    arms: 'down',
    eyes: 'open',
    jump: false,
    phone: false,
    px: 4
};

const Spark = ({px, color}) => (
    <PixelArt
        rows={SPARK}
        colors={{Y: color, W: '#ffffff'}}
        px={px}
    />
);
Spark.propTypes = {
    px: PropTypes.number,
    color: PropTypes.string
};
Spark.defaultProps = {
    px: 3,
    color: '#ffe14d'
};

export {Lumi, Spark};
