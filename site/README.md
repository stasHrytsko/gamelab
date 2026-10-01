# Stazzi — personal portfolio

The main page of the Stazzi repository: a personal archive of ideas, playable
prototypes, sketches and process notes.

## Structure

- `src/main.ts` — content, sections and motion behaviour.
- `blog/index.html` and `src/blog/` — the separate Notes page and article reader.
- `content/posts/*.md` — one Markdown file per blog post.
- `src/styles.css` — layout, visual system, responsive states and animation.
- `public/og.png` — social preview image.
- `apps/*/game.json` — playable prototypes included in the root build.

The portfolio is served at `/`. Playable games keep their own paths such as
`/the-gap/`, `/arrow-flip/` and `/sprout/`. The journal is served at `/blog/`.

## Add a blog post

Create a Markdown file in `content/posts/` and include `title`, `date`, `tag`
and `excerpt` in its frontmatter. Full formatting examples are in
`content/README.md`. Posts are sorted automatically, newest first.

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
