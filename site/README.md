# Stazzi — personal portfolio

The main page of the Stazzi repository: a personal archive of ideas, playable
prototypes, sketches and process notes.

## Structure

- `src/main.ts` — content, sections and motion behaviour.
- `src/styles.css` — layout, visual system, responsive states and animation.
- `public/og.png` — social preview image.
- `apps/*/game.json` — playable prototypes included in the root build.

The portfolio is served at `/`. Playable games keep their own paths such as
`/the-gap/`, `/arrow-flip/` and `/sprout/`.

## Local development

```sh
# from the repository root
npm install
npm run build
npm run preview

# portfolio only
cd site
npm run dev
```

The page follows `prefers-reduced-motion`, stays keyboard accessible and uses
the existing game previews and visual studies as its project imagery.
