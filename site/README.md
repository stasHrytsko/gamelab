# Stazzi — personal portfolio

The main page of the Stazzi repository: a personal archive of ideas, playable
prototypes and blog posts.

## Structure

- `src/main.ts` — home page: About, latest game, latest post, Contacts.
- `games/index.html` and `src/games/` — the Games page listing every game.
- `src/nav.ts` — shared header (About and Contact scroll the home page, Games and Blog open their pages).
- `src/posts.ts` — blog posts parsed from `content/posts/`, shared by home and blog.
- `blog/index.html` and `src/blog/` — the separate Blog page and article reader.
- `content/posts/*.md` — one Markdown file per blog post.
- `src/styles.css` — layout, visual system, responsive states and animation.
- `public/og.png` — social preview image.
- `apps/*/game.json` — playable prototypes included in the root build.

The home page is served at `/`, the games list at `/games/`. Playable games keep their own paths such as
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

The featured game on the home page is set by `FEATURED_GAME` in `src/main.ts`;
the latest post is picked automatically by date.
