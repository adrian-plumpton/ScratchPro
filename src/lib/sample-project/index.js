// ScratchPro: the sample games. The first load of the default project opens one of them:
// the one named by ?sample=<id> (see src/lib/sample-games.js), or Spark Hop, which is bundled so it
// opens instantly and works offline. After that (eg. File > New) the usual blank project is used.
// Rebuild the samples with: npm run build:samples

/* eslint-disable import/no-unresolved */
import sparkHop from '!arraybuffer-loader!../../../static/samples/spark-hop.sb3';
/* eslint-enable import/no-unresolved */
import {SAMPLE_GAMES, sampleFileUrl} from '../sample-games';
import {loadGameData} from '../sj-library';

const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);

// editor.html?blank and editor.html?new (Start making, which shows the new game picker) skip the
// sample and open an empty project. editor.html?game=<id> opens a game from My games instead.
let firstLoad = !params.has('blank') && !params.has('new');

/**
 * The sample game named in the page's ?sample= parameter, if it is one of ours.
 * @returns {?object} The game from SAMPLE_GAMES, or null.
 */
const requestedSample = () => SAMPLE_GAMES.find(game => game.id === params.get('sample')) || null;

/**
 * Call once per project load. Returns the sample game for the very first load of the default
 * project, and null otherwise.
 * @param {boolean} isDefaultProject True when the default (new) project is being loaded.
 * @returns {?(ArrayBuffer|Promise<ArrayBuffer>)} The sample or saved game (or a promise for it), or null.
 */
const takeSampleProject = isDefaultProject => {
    const useSample = firstLoad && isDefaultProject;
    firstLoad = false;
    if (!useSample) return null;
    if (params.has('game')) return loadGameData(params.get('game'));
    const game = requestedSample();
    if (!game || game.id === 'spark-hop') return sparkHop.slice(0);
    return fetch(sampleFileUrl(game.id, 'sb3')).then(r => {
        if (!r.ok) throw new Error(`Could not load sample game ${game.id}: ${r.status}`);
        return r.arrayBuffer();
    });
};

export {requestedSample};
export default takeSampleProject;
