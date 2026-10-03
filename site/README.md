# Stazzi — personal site

Ideas, playable prototypes and a blog. Two languages: English (`/`) and
Ukrainian (`/uk/`).

## Pages

| English | Ukrainian | What |
|---|---|---|
| `/` | `/uk/` | Home: intro and hero, newest game + two more + "More", newest post + two more + "More", contacts |
| `/games/` | `/uk/games/` | All games, newest first. A card opens the game itself |
| `/blog/` | `/uk/blog/` | Post list and reader (a post opens inside the page at `#slug`) |

"About" in the menu scrolls to the top of the home page, "Contacts" to the
footer. Playable games keep their own paths (`/the-dig/`, `/arrow-flip/`…);
their home screen has an "All games" link back to `/games/`.

## Structure

- `index.html`, `games/index.html`, `blog/index.html` and the same under
  `uk/` — one tiny HTML per page (`<html lang>` and `data-page` pick the
  language and the page). All of them load `src/main.ts`.
- `src/i18n.ts` — all interface text in EN and UK, URLs, date formats.
- `src/data.ts` — games (from `apps/*/game.json`, newest by `added`) and posts.
- `src/layout.ts`, `src/cards.ts` — header, footer, game and post cards.
- `src/pages/` — `home.ts`, `games.ts`, `blog.ts`.
- `src/styles.css` — the paper/origami look (palette from `UI Design/`).
- `content/posts/<slug>.en.md` and `<slug>.uk.md` — blog posts per language.
- `public/hero.webp` — the hero picture (change it in `src/pages/home.ts`).
- `public/og.png` — social preview image.

## Add a blog post

See `content/README.md`. One file per language; without a Ukrainian file the
Ukrainian site shows the English post with an "English only" label.

## Add a game

Add `apps/<slug>/game.json` (see `apps/CLAUDE.md` §8). The game shows up on
`/games/` and, if it is the newest by `added`, as the big card on the home page.
Its card picture is `apps/<slug>/public/og.png`, the small thumbnail is
`icon-192.png`.

## Add a language string

Edit `src/i18n.ts`; the English and Ukrainian entries must match.

## Local development

```sh
# from the repository root
npm install
npm run build
npm run preview

# site only
cd site
npm run dev
```
