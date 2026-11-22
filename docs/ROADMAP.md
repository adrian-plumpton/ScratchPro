# ScratchPro roadmap

**Vision:** the easiest way for young people (about 8 to 14) to make real mobile games with
Scratch-style blocks, ideally on the phone itself, and to play or install them like any other app.
Capable but simple: no clutter, nothing that gets in the way of making and playing.

## Goals

1. **Games feel native on a phone.** Touch, full screen, tilt, vibration, saved progress, 60 fps.
2. **Making a game is quick and fun, even on a phone.** From opening the site to playing your
   own game on your phone in under 10 minutes.
3. **Games leave ScratchPro.** Share as a link, install to the home screen, export as an Android APK.
4. **A foundation that can grow.** A brand-safe name, fast loading, safe sharing for kids, easy
   to keep merging TurboWarp updates.

## Strategies

- **A. A mobile game maker, not a general editor.** Opinionated defaults: mobile stage sizes,
  automatic touch controls, phone-only blocks.
- **B. Learn by remixing.** Great templates are the onboarding; change a working game rather
  than start from a blank page.
- **C. Ship the game, not the project file.** One player page; every way out builds on it:
  link → home screen install → APK → Play Store.
- **D. Build on TurboWarp, add mobile on top.** New features as extensions and separate pages,
  not rewrites of the core.

## Tactics

| Strategy | Tactic | Status |
|---|---|---|
| A | Automatic on-screen joystick and buttons from the keys a project uses | Done |
| A | Touch blocks (joystick, fingers, vibrate, show/hide controls) | Done |
| A | Phone editor: one pane at a time, bottom bar, Play button | Done |
| A | Mobile blocks v1: tilt, swipe, save/load progress, portrait check (Phone extension) | Done |
| A | Spark Hop uses them: swipe to jump/dash, vibration, saved best score | Done |
| A | Game maker configures controls (layout, labels) saved in the project | To do |
| A | Mobile stage presets (portrait/landscape) | To do |
| B | Spark Hop sample game | Done |
| B | Kid-friendly home page: game first, "Make a game" up front, no clutter | Done |
| B | 3 to 5 templates (runner, tap game, top-down) | To do |
| C | Play-only page `play.html`, installable, works offline | Done (Spark Hop only) |
| C | Publish → short link and a play page per game (Netlify Functions + Blobs) | To do |
| C | APK export via GitHub Actions + Capacitor | To do |
| D | Check the "Scratch" trademark rules; choose a final name | To do |
| D | Smaller play-page bundle; skip the library build on Netlify | To do |
| D | Report button and moderation before public sharing | To do |

## Baseline (November 2026)

What already existed when this roadmap was written:

- **Touch controls** (`src/containers/sp-touch-controls.jsx`, `src/lib/sp-touch-*.js`): joystick and
  buttons built from the keys each project uses, multi-touch, haptics, hide/show.
- **Touch extension** (`static/extensions/sptouch.js`): 13 blocks, see README.
- **Phone editor** (`src/containers/sp-mobile-editor.jsx`) and scaled tablet editor.
- **Players**: `index.html` (home), `fullscreen.html`, `embed.html`; all work well on phones.
- **Spark Hop** sample (`scripts/build-sample-project.js`) opens on first load.
- **App manifest** (`static/manifest.webmanifest`) opened the editor; the service worker
  (`src/playground/service-worker.js`) is TurboWarp's do-nothing version and is not registered,
  so nothing worked offline.
- **Build**: Netlify runs `npm run build`, which also builds the `dist/` library bundle
  (`scratch-gui.js`, 6.65 MB) that the site does not use. About 2 minutes of npm install and
  about 1.5 minutes of webpack per deploy.
- **Home page** had TurboWarp's menu bar, a project ID box and a featured-projects feed from
  Scratch, all replaced by the new kid-friendly home page.

## Next steps

1. Decide the main audience, ambition and name (trademark check).
2. ~~Mobile blocks v1: tilt, swipe, save/load; update Spark Hop to use them.~~ Done.
3. Two more templates (one using tilt).
4. APK proof of concept: Spark Hop built by GitHub Actions.
5. Publish → short link with a play page per game.
6. Test on real Android and iPhone devices.
