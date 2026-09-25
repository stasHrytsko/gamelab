# Такси-пятнашки — прототип

Спека — `specs/done/02-two-moves-later.md`, макеты — `UI Design/prototypes/taxi-slide/`.
Веб-игра под телефон: TypeScript + Vite, без фреймворка, экран на HTML/CSS,
стиль — токены и шрифт из `UI Design/` (подключаются напрямую, не копией).

## Ссылки

| Ссылка | Что открывает |
|---|---|
| `https://<домен>/` | главный экран — эту ссылку и рассылать |
| `https://<домен>/#/levels` | экран уровней |
| `https://<домен>/#/level/3` | сразу уровень 3, если он уже открыт у игрока; иначе экран уровней |
| `https://<домен>/?unlock=all#/level/5` | любой уровень без прохождения предыдущих — для проверки, прогресс не трогает |

- Маршруты в `#`, поэтому ссылка работает на любом статическом хостинге и во
  встроенных браузерах Telegram, WhatsApp, Instagram без настройки сервера.
- Превью ссылки в мессенджере — `public/og.png` (1200×630). На Vercel адрес
  картинки становится абсолютным сам, из `VERCEL_PROJECT_PRODUCTION_URL`.
- «На экран Домой» (Safari → Поделиться, Chrome → меню) ставит иконку, и игра
  открывается на весь экран без адресной строки (`manifest.webmanifest`).
- Прогресс хранится в браузере телефона. Встроенный браузер мессенджера и
  Safari — это разные хранилища: начатое в Telegram в Safari не продолжится.

## Vercel

1. Vercel → Add New → Project → импортировать репозиторий `gamelab`.
2. **Root Directory: `apps/taxi-slide`.** Остальное Vercel возьмёт из
   `vercel.json` (Vite, `npm run build`, `dist`).
3. Опция «Include files outside the Root Directory» должна остаться
   включённой (по умолчанию так): сборка читает `../../UI Design`.
4. Каждый пуш в `main` публикуется сам; превью-ветки получают свой адрес.

## Команды

```sh
npm install
npm run dev          # http://<ip-компьютера>:5173 — открыть с телефона в той же Wi-Fi
npm test             # движок и пакет уровней, включая kill-критерий
npm run e2e          # пять уровней свайпами на экране iPhone 13, тач, проигрыш
npm run levels       # пересобрать src/levels/levels.json из зёрен
npx tsx tools/generate-levels.ts search 5 5000 500   # искать новое зерно уровня 5
npx tsx tools/make-images.ts                          # иконки и og.png из tools/brand.html
```

## Устройство

- `src/engine/` — правила из §4–5 спеки, чистые функции; перенесены из play.
- `src/levels/levels.json` — пять уровней; генерирует `tools/generate-levels.ts`,
  маршруты солвера — `tools/solutions.json`.
- `src/ui/board.ts` — поле: такси едет за пальцем до соседней клетки,
  упирается в занятую, жест короче 18 px — тап.
- `src/ui/game.ts` — игровой экран, строка пассажиров, попапы.
- Лог §8 пишется только на устройство: `localStorage['taxi-slide:log']`.
