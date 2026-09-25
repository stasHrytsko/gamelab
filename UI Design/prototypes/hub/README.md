# Hub mockup

Prototype Validation Project — title, short description, "Prototype log"
with the newest prototype as a full-width hero banner (image, scrim, title,
date, genre, "New game" tag, pitch, button), then "Coming up" — a grid of
placeholder cards with generic gradient art, not real screenshots.

**Desktop web page, not a phone mockup** (2026-09-25): the earlier
390×844 phone-frame version was replaced after the author asked for a
proper wide layout, big images, and the real game banner instead of a
cramped screenshot.

**Not PuzzleKit.** The hub borrows its visual language — warm off-white
background, `Inter` for headings/body, `IBM Plex Mono` for uppercase labels
and meta, flat bordered cards, no rounded playful shadows — from the
author's personal site (play-mocha-chi.vercel.app). Games inside their own
`apps/<slug>` keep using `UI Design/design-tokens.css`; this is the one
place in the repo that doesn't. The tokens live inline in `index.html` here
and in `apps/hub/src/styles.css` — that file is the source of truth, this
one is only a record of the agreed look.

- `index.html` — mockup source, self-contained, references the real banner
  at `apps/hub/public/games/taxi-slide-banner.jpg`.
- `preview.png` — snapshot, 1440×900 desktop viewport.
- `render.mjs` — rebuilds `preview.png`.
