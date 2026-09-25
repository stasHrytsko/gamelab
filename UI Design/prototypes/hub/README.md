# Hub mockup

Prototype Validation Project — title, short description, "Prototype log"
with the newest prototype as a hero: 1/3 dark text panel (tag, title, date,
genre, pitch, button when there's a live link) and 2/3 the real banner
image, full clarity, no scrim. Then "Coming up" — a row of small placeholder
cards with generic gradient art, not real screenshots.

**Desktop web page, not a phone mockup** (2026-09-25, revised same day):
first pass was a 390×844 phone frame, then a full-bleed banner with a dark
scrim over the whole image and a "Soon" button. Author asked to drop the
scrim, split hero into a solid text panel + clean image, remove the dead
"Soon" button entirely, and shrink the placeholder cards.

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
