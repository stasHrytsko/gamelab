# Hub mockup

Prototype Validation Project — title, short description, "Prototype log":
the newest prototype as one big featured card, five empty "Soon" slots below
for the ones that don't exist yet.

**Not PuzzleKit.** By explicit request (2026-09-25) the hub borrows its
visual language — warm off-white background, `Inter` for headings/body,
`IBM Plex Mono` for uppercase labels and meta, flat bordered cards, no
rounded playful shadows — from the author's personal site
(play-mocha-chi.vercel.app). Games inside their own `apps/<slug>` keep using
`UI Design/design-tokens.css`; this is the one place in the repo that
doesn't. The tokens live inline in `index.html` here and in
`apps/hub/src/styles.css` — that file is the source of truth, this one is
only a record of the agreed look.

- `index.html` — mockup source, self-contained.
- `preview.png` — snapshot, 390×844.
- `render.mjs` — rebuilds `preview.png`.
