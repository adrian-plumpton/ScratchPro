// Serves build/ like Netlify does: /games and /game are served from games.html and game.html.
// Used by the smoke test in CI. Usage: node scripts/serve-build.js [port]

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'build');
const PORT = Number(process.argv[2]) || 8601;
const TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.json': 'application/json',
    '.png': 'image/png',
    '.wasm': 'application/wasm',
    '.webmanifest': 'application/manifest+json',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

http.createServer((req, res) => {
    let file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT)) {
        res.writeHead(403);
        return res.end();
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
    if (!fs.existsSync(file)) {
        res.writeHead(404);
        return res.end('Not found');
    }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Serving ${ROOT} on http://localhost:${PORT}`));
