module.exports = {
    extends: ['scratch', 'scratch/node', 'scratch/es6'],
    overrides: [
        {
            // ScratchPro's own extensions: plain browser scripts loaded by the VM, with Scratch as a
            // global. (Kept here rather than in static/, which is copied to the site as is.)
            files: ['static/extensions/sp*.js'],
            env: {
                browser: true,
                node: false
            },
            parserOptions: {
                sourceType: 'script'
            },
            globals: {
                Scratch: 'readonly'
            },
            rules: {
                // each extension is wrapped in a function with 'use strict'
                strict: ['error', 'function']
            }
        }
    ]
};
