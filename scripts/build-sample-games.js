#!/usr/bin/env node
/* eslint-disable no-console */
// ScratchPro: builds the sample games shown on the home page.
// Writes static/samples/<id>.sb3 and a preview picture static/samples/<id>.svg for each game.
// The game list and card text live in src/lib/sample-games.js.
// Run: node scripts/build-sample-games.js

const fs = require('fs');
const path = require('path');
const {createProject, thumbnail} = require('./sample-games/builder');

const GAMES = ['spark-hop', 'lane-dash', 'bubble-pop', 'gem-maze']
    .map(name => require(`./sample-games/${name}`)); // eslint-disable-line global-require

const OUT_DIR = path.join(__dirname, '../static/samples');

const main = async () => {
    fs.mkdirSync(OUT_DIR, {recursive: true});
    for (const game of GAMES) {
        const project = createProject();
        const previewSprites = game.build(project);
        const bytes = await project.write(path.join(OUT_DIR, `${game.id}.sb3`));
        fs.writeFileSync(path.join(OUT_DIR, `${game.id}.svg`), thumbnail(game.backdropSvg, previewSprites));
        console.log(`Wrote static/samples/${game.id}.sb3 (${bytes} bytes) and ${game.id}.svg`);
    }
};

main().catch(err => {
    console.error(err);
    process.exit(1);
});
