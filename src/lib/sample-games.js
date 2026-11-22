// Sparkjam: the sample games, shown on the landing page, the games gallery and the game page.
// Each game's project and preview picture are built into static/samples/ by scripts/build-sample-games.js.

const SAMPLE_GAMES = [
    {
        id: 'spark-hop',
        title: 'Spark Hop',
        kind: 'Platformer',
        filter: 'platformers',
        chips: ['JOYSTICK', 'JUMP', 'DASH'],
        short: 'Joystick, jump, dash',
        description: 'Hop between platforms and grab sparks before time runs out.',
        long: 'Hop between floating platforms and grab sparks before the clock runs out. ' +
            'Each spark adds a second. Blobs take five away.',
        controls: [
            ['JOYSTICK', 'lav', 'Run left and right', 'arrow keys'],
            ['SPACE', 'yellow', 'Jump, hold for higher', 'space bar or swipe up'],
            ['X', 'cyan', 'Dash', 'X key or swipe sideways']
        ],
        tip: 'Hold Space for a higher jump.'
    },
    {
        id: 'lane-dash',
        title: 'Lane Dash',
        kind: 'Racer',
        filter: 'racers',
        chips: ['JOYSTICK', 'BOOST'],
        short: 'Joystick, boost',
        description: 'Weave through traffic on a road that keeps speeding up.',
        long: 'Weave through traffic on a road that keeps getting faster. ' +
            'Hold boost to go faster still, and see how far you can drive before you crash.',
        controls: [
            ['JOYSTICK', 'lav', 'Change lanes', 'arrow keys'],
            ['SPACE', 'yellow', 'Boost, hold it down', 'space bar']
        ],
        tip: 'Steer early. The road only gets faster.'
    },
    {
        id: 'bubble-pop',
        title: 'Bubble Pop',
        kind: 'Tap game',
        filter: 'tap',
        chips: ['TAP ONLY'],
        short: 'Tap only',
        description: 'Pop the bubbles. Leave the urchins alone.',
        long: 'Tap the bubbles before they float away. Leave the spiky urchins alone: ' +
            'each one you tap costs three seconds.',
        controls: [
            ['TAP', 'pink', 'Pop a bubble', 'click with the mouse']
        ],
        tip: 'Urchins cost 3 seconds. Look before you tap.'
    },
    {
        id: 'gem-maze',
        title: 'Gem Maze',
        kind: 'Maze',
        filter: 'mazes',
        chips: ['JOYSTICK'],
        short: 'Joystick',
        description: 'Find six gems while a ghost drifts through the walls.',
        long: 'Find all six gems in the maze as fast as you can. A ghost drifts through the walls, ' +
            'and if it catches you, it is back to the start.',
        controls: [
            ['JOYSTICK', 'lav', 'Walk through the maze', 'arrow keys']
        ],
        tip: 'The ghost goes through walls. You can\'t.'
    }
];

const getSampleGame = id => SAMPLE_GAMES.find(game => game.id === id) || null;

const sampleFileUrl = (id, extension) => `${process.env.ROOT || '/'}samples/${id}.${extension}`;

export {
    SAMPLE_GAMES,
    getSampleGame,
    sampleFileUrl
};
