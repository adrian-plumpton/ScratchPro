# Sparkjam accounts

Accounts use **Netlify Identity** (enabled on the site; `@netlify/identity` in the browser and in
functions). Making and playing never needs an account: games always save in the browser first.

## Signing in

- **Google**, or **email and password**. The dialog is `src/components/sj/account.jsx`; auth calls are
  in `src/lib/sj-auth.js`.
- Sign-up is currently **invite-only** (Netlify dashboard: Project configuration > Identity >
  Registration). Invite testers from the Identity page; the invite link lands on "choose a password".
  Switch registration to Open when public sign-up should start. The dialog follows the setting.
- Email confirmation is currently off (autoconfirm). If it's turned on, new email accounts get a
  "check your email" message and finish when they use the link.
- Identity does not run under a plain local server. Test on a Netlify deploy (a branch deploy works).

## New account steps

1. **Month and year of birth.** Stored as `birth_month` and `birth_year` in the user's metadata.
   Never shown to anyone.
2. **Under 13: a grown-up's OK.** For the test phase, the parent, carer or teacher helping the child
   ticks a box on the same screen (`consent: "test-phase-adult"` with a timestamp). **This is a
   placeholder.** Before launch it must be replaced by the emailed approval in design A2 (the parent
   gets an email, reviews and approves), so a child can't tick it themselves.
3. **Maker name**, picked from generated suggestions (`src/lib/sj-maker-names.js`), never typed, so no
   real names or rude words are shown to others.

An account can save online only once these are done (`isAccountReady`). The games function checks the
same thing on the server.

## Saved games

- `netlify/functions/games.mjs` (`/api/games`, `/api/games/:id`) stores each maker's games in Netlify
  Blobs (store `sparkjam-games`, keys `<user id>/meta/<game id>` and `<user id>/sb3/<game id>`).
  Only the signed-in maker can read or change their games. Limits: 5 MB per game, 200 games.
- The editor saves to the browser and, when signed in, to the account a couple of seconds after each
  change. My games lists both, labelled, with "Save to my account" for games only on this device.

## What's stored

Email, maker name, month and year of birth, consent (placeholder), and the games themselves.
