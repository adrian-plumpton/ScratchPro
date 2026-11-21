// ScratchPro: the sample games shown on the home page.
// Each game's project and preview picture are built into static/samples/ by scripts/build-sample-games.js.

const SAMPLE_GAMES = [
    {
        id: 'spark-hop',
        title: 'Spark Hop',
        description: 'Jump between floating platforms and grab sparks before time runs out.',
        controls: 'Joystick, jump and dash buttons'
    },
    {
        id: 'lane-dash',
        title: 'Lane Dash',
        description: 'Weave through traffic on a road that keeps getting faster.',
        controls: 'Joystick and a boost button'
    },
    {
        id: 'bubble-pop',
        title: 'Bubble Pop',
        description: 'Tap the bubbles before they float away. Leave the urchins alone.',
        controls: 'Tap only, no on-screen controls'
    },
    {
        id: 'gem-maze',
        title: 'Gem Maze',
        description: 'Find six gems in a maze while a ghost drifts through the walls.',
        controls: 'Joystick only'
    }
];

const sampleFileUrl = (id, extension) => `${process.env.ROOT || '/'}samples/${id}.${extension}`;

export {
    SAMPLE_GAMES,
    sampleFileUrl
};
