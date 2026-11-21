// ScratchPro: the Spark Hop sample game opens the first time the page loads, to show off the
// on-screen controls. After that (eg. File > New) the usual blank project is used.
// Rebuild spark-hop.sb3 with: node scripts/build-sample-project.js

/* eslint-disable import/no-unresolved */
import sampleProject from '!arraybuffer-loader!./spark-hop.sb3';
/* eslint-enable import/no-unresolved */

let firstLoad = true;

/**
 * Call once per project load. Returns the sample game for the very first load of the default
 * project, and null otherwise.
 * @param {boolean} isDefaultProject True when the default (new) project is being loaded.
 * @returns {?ArrayBuffer} A copy of the sample project, or null.
 */
const takeSampleProject = isDefaultProject => {
    const useSample = firstLoad && isDefaultProject;
    firstLoad = false;
    return useSample ? sampleProject.slice(0) : null;
};

export default takeSampleProject;
