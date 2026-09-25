# Брось и уложи (Roll & Pack) — прототип

Спека — `specs/38-roll-pack.md`, экраны — `UI Design/prototypes/roll-pack/`.
Веб-игра под телефон: TypeScript + Vite, без фреймворка, экран на HTML/CSS,
стиль — токены и шрифт из `UI Design/` (подключаются напрямую, не копией).

## Ссылки

| Ссылка | Что открывает |
|---|---|
| `https://<домен>/` | главный экран — эту ссылку и рассылать |
| `https://<домен>/#/levels` | экран уровней |
| `https://<домен>/#/level/3` | сразу уровень 3, если он уже открыт у игрока; иначе экран уровней |
| `https://<домен>/?unlock=all#/level/5` | любой уровень без прохождения предыдущих — для проверки, прогресс не трогает |

Маршруты в `#`, превью ссылки — `public/og.png`, иконка «На экран Домой» —
`manifest.webmanifest`; всё как у `apps/taxi-slide`.

## Vercel

1. Vercel → Add New → Project → импортировать репозиторий `gamelab`.
2. **Root Directory: `apps/roll-pack`.** Остальное Vercel возьмёт из
   `vercel.json` (Vite, `npm run build`, `dist`).
3. Опция «Include files outside the Root Directory» должна остаться
   включённой: сборка читает `../../UI Design`.

## Команды

```sh
npm install
npm run dev          # http://<ip-компьютера>:5173 — открыть с телефона в той же Wi-Fi
npm test             # движок, точные вероятности уровней, kill-тест эвристик (§6)
npm run e2e          # пять уровней ходами солвера на экране iPhone 13, тач, проигрыш
npx tsx tools/make-images.ts    # иконки и og.png из tools/brand.html
npx tsx tools/make-screens.ts   # экраны для UI Design/prototypes/roll-pack (после npm run build)
```

## Устройство

- `src/engine/` — правила §3–5 спеки, чистые функции.
- `src/levels/levels.ts` — пять уровней: поле 6 × (N + 1).
- `src/ui/board.ts` — поле и «рука»: планка едет за пальцем по горизонтали,
  снапится к столбцам, над ступенькой краснеет.
- `src/ui/game.ts` — игровой экран, кубики, попапы.
- `tools/solver.ts` — точная вероятность победы идеального игрока и эвристик.
- **Кубики — `Math.random()` без зерна** (§5). Тесты и съёмка экранов подменяют
  `Math.random` снаружи, сама игра зёрен не знает.
- Лог §8 пишется только на устройство: `localStorage['roll-pack:log']` — на
  каждом ходу бросок, выбранное число, позиция, высоты, смены кубика, время.
