# Sparkjam roadmap

**Sparkjam** (working name) is a tiny game studio in the browser: make games with Scratch-style blocks,
jam on them live with friends, and play them on any phone. Built for 11 to 20-year-olds, and fun for
adults too. It is built on TurboWarp and keeps Scratch's ideas (sprites, stage, Code / Costumes /
Sounds) under the hood.

Live site: https://scratchpro-app.netlify.app (Netlify deploys `main` automatically).

Related docs: `README.md` (how things work, testing), `docs/ACCOUNTS.md` (sign-in, saved games, what's
stored).

## Done

### Site and brand
- Sparkjam brand: pixel style, Lumi the robot, bundled fonts (no Google requests).
- Landing page `/`, games gallery `/games`, game page `/game?sample=…` or `/game#<scratch id>`.
- Loading screen and friendly error screens with Lumi; old `/#123` links forward to `/game`.

### Playing
- Four sample games (Spark Hop, Lane Dash, Bubble Pop, Gem Maze), built in code
  (`scripts/sample-games/`), with retro sound effects made in code (`sfx.js`).
- Automatic touch controls on phones; Phone blocks (swipe, tilt, vibrate, save progress).
- Full-screen play on phones with exit, pause and a pause menu.
- `play.html`: Spark Hop as an installable, offline game.

### Making
- Sparkjam editor theme by default (TurboWarp and Scratch looks still in Settings).
- "Start a new game" picker (four templates or blank).
- My games `/my-games`: games save in the browser as you make them, and to your account when signed in.
- On phones, a menu button in the editor and on every page opens the site menu (Home, Games, My games,
  new game, Jam, sign in).

### Accounts (Netlify Identity)
- Sign in with Google or email and password; sign-up is invite-only for now.
- New accounts: month and year of birth, a grown-up's OK for under-13s (placeholder, see below), and a
  maker name picked from safe suggestions.
- Games save to the account (Netlify Functions + Blobs) and open on any device.

### Jams (live making together, Liveblocks)
- Start a jam from the editor, game page or landing page; invite with a 4-digit code, link or QR code.
- Block edits, sprite moves and bigger changes sync live; jam copies keep block IDs.
- See who's here: avatars, live cursors, live block and sprite drags, blocks locked while someone drags
  them, faces on the sprite each person is working on.
- People panel: follow someone; the host can remove people or end the jam; everyone else can leave.
- Talk panel: text chat with a safety filter, mute and report; voice and video calls browser to browser,
  with device choice, levels, volumes and host mute.

### Quality
- `npm run test:smoke` (site, gallery, every game, saving) and `npm run test:jam` (two editors in a jam:
  sync, drags, chat, filter, calls with fake devices, ending). Both run in CI on every push.

## Must do before testing with children outside a supervised group

These are about safety and the law (COPPA in the US, the UK Children's Code), not polish.

1. **Real parent consent.** Replace the placeholder (a grown-up ticks a box on the child's screen) with
   the emailed approval in design A2: the parent gets an email, reviews and approves, and can change or
   delete the account later. Store when and how consent was given.
2. **Parent communication settings.** Parents choose what an under-13 can use: text chat, voice, video,
   sharing. Today all of these are open to everyone in a jam.
3. **Report review.** Reports are saved (`sparkjam-reports` in Netlify Blobs) but nobody is alerted and
   there's no screen to review them. Decide who reviews, add alerts and a simple review page, and act on
   reports (suspend accounts).
4. **Privacy policy and terms**, linked from the footer and sign-up, written for children and parents.
5. **Account deletion and data export** (delete the account, its games and its consent record).
6. **Server-side removal from jams.** "Remove" tells the person's browser to leave and stops them
   rejoining, but their current live connection isn't cut. Use the Liveblocks API to end it.
7. **Moderation of names and text everywhere text appears** (game titles in shared games, for example).

## Known limits and issues

- Accounts, saving online, jams, chat and calls have only been tested with simulated users; test them
  with two real accounts on real devices (phones too).
- Jams: two edits to the same block at the same moment, last one wins. Bigger changes (new sprites,
  costumes) reload the game for everyone and stop it if it's running.
- Calls are direct between browsers: some school and office networks block them (needs a relay, see
  below), and they suit small jams (about five people).
- Jam codes are 4 digits; lookups are rate-limited per account, but the code is the only invite.
- Ended jams' Liveblocks rooms aren't deleted; old jam records stay in Blobs.
- New screens are English only (TurboWarp's translations don't cover them).
- The site's name in code and on Netlify is still "scratchpro"; the GitHub repo is linked as "Source
  code" in the footer (check it's public, or remove the link).
- Pre-existing TurboWarp lint errors (menu bar, themes folder) are left as they are.

## To do

### Product
- **Make an app (parked).** Plan from the packaging discussion: one press makes a game an installable app
  (its own name, icon, touch controls, offline) at an unlisted link; single-file HTML download; later,
  signed Windows and Mac downloads (Tauri via GitHub Actions) and Android (TWA/APK).
- **Sharing and a public gallery** of games made with Sparkjam (unlisted links first; public needs
  moderation and the parent settings above).
- **Version history** for saved games (design S5): automatic versions, name a version, restore.
- **Lumi's guide** for first-time makers (design M5).
- **Phone and tablet editor** in the Sparkjam style (designs M2 and M3), and jams on phones (design J2).
- **Jam extras:** sticky notes and comments on code (design J3), reactions, a "watch and play only"
  role, an activity history.
- **Account page:** change maker name, see devices, sign out everywhere, delete the account.
- **More templates**, mobile stage presets (portrait/landscape), configurable controls (layout and labels).
- **Learn** section (the nav and designs mention it; nothing exists yet).

### Technical
- A TURN relay for calls on strict networks (eg. Cloudflare Calls TURN or Twilio), with credentials
  issued by a Netlify Function.
- Clean up ended jams (rooms, records, snapshots) on a schedule.
- Error monitoring (privacy-friendly) and basic, privacy-friendly usage numbers.
- Smaller bundles for the play and game pages.
- Tests for real sign-in flows (needs test accounts set up for automated testing).

## Decisions needed

1. **Name and domain:** confirm "Sparkjam", check trademarks and the domain, and move the site to it.
2. **Sign-up:** when to switch Identity registration from invite-only to open.
3. **Under-13 defaults** once parent settings exist: which of chat, voice, video and sharing are on.
4. **Who reviews reports**, and how quickly.
5. **Sharing rules:** unlisted links only, or a public gallery; and for which ages.
6. **Budget:** app signing (about £180 a year for Windows and Mac), a TURN relay, and Liveblocks beyond
   its free tier.

## Next steps (suggested order)

1. Test accounts, saving online and jams (with chat and calls) with two real accounts on real devices,
   including a phone, and fix what turns up.
2. Report review: alerts and a review page.
3. Real parent consent (A2) and parent communication settings.
4. Privacy policy, terms and account deletion.
5. Decide the name and domain; move the site.
6. Open sign-up for a supervised test group (a class or club).
7. Then: Make an app, sharing, version history, Lumi's guide, phone editor.
