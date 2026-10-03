import type { Game } from '../../tools/games.d.mts';
import type { Post } from './data.ts';
import { escapeHtml, formatDate, pageUrl, t, type Lang } from './i18n.ts';

function pitch(game: Game, lang: Lang): string {
  return lang === 'uk' ? game.pitchUk : game.pitch;
}

function chip(game: Game, lang: Lang): string {
  return `<span class="chip chip-${game.status}"><i></i>${escapeHtml(t(lang).status[game.status])}</span>`;
}

const ACCENTS = ['coral', 'mustard', 'teal', 'blue'] as const;

/** Приглушённые цвета бумаги с образца плашек: терракот, охра, шалфей, пыльно-синий. */
type Scheme = { bg: string; m1: [string, string]; m2: [string, string]; m3: [string, string]; sun: string };
const SCHEMES: Record<(typeof ACCENTS)[number], Scheme> = {
  coral: { bg: '#eadbcf', m1: ['#ba7a64', '#a2644f'], m2: ['#878e80', '#737b6c'], m3: ['#d7ac72', '#c2975a'], sun: '#d7ac72' },
  mustard: { bg: '#eee2c9', m1: ['#d7ac72', '#c2975a'], m2: ['#ba7a64', '#a2644f'], m3: ['#878e80', '#737b6c'], sun: '#ba7a64' },
  teal: { bg: '#dde1d4', m1: ['#878e80', '#737b6c'], m2: ['#718c9e', '#617b8c'], m3: ['#d7ac72', '#c2975a'], sun: '#ba7a64' },
  blue: { bg: '#dce2e4', m1: ['#718c9e', '#617b8c'], m2: ['#878e80', '#737b6c'], m3: ['#ba7a64', '#a2644f'], sun: '#d7ac72' },
};

/** Отпечаток: бумажные горы с гранями и иконка игры. Цвет зависит от номера идеи. */
function print(game: Game): string {
  const accent = ACCENTS[game.idea % ACCENTS.length] ?? 'coral';
  const c = SCHEMES[accent];
  const sunX = game.idea % 2 === 0 ? 190 : 84;
  return `<div class="print"><svg class="scene" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="400" fill="${c.bg}"/><circle cx="${sunX}" cy="84" r="32" fill="${c.sun}"/><polygon points="-30,400 120,112 270,400" fill="${c.m1[0]}"/><polygon points="120,112 270,400 184,400" fill="${c.m1[1]}"/><polygon points="196,400 312,204 430,400" fill="${c.m2[0]}"/><polygon points="312,204 430,400 362,400" fill="${c.m2[1]}"/><polygon points="-40,400 42,272 124,400" fill="${c.m3[0]}"/><polygon points="42,272 124,400 84,400" fill="${c.m3[1]}"/></svg><img class="cover-icon" src="/${game.path}/icon-512.png" alt="" width="512" height="512" loading="lazy"></div>`;
}

/** Подложка с отпечатком: лист бумаги, под ним ещё один со сдвигом, сверху приклеенная метка. */
function mount(game: Game, lang: Lang, tape: string | null): string {
  return `<div class="mount"><i class="under"></i>${print(game)}${chip(game, lang)}${tape === null ? '' : `<span class="tape"><span>${escapeHtml(tape)}</span></span>`}</div>`;
}

const DECO_GAME =
  '<svg class="deco" viewBox="0 0 64 50" aria-hidden="true"><circle cx="46" cy="14" r="11" fill="#d7ac72"/><polygon points="34,50 56,28 74,50" fill="#e4d9c6"/><polygon points="2,50 26,12 50,50" fill="#718c9e"/><polygon points="26,12 50,50 38,50" fill="#617b8c"/></svg>';
const DECO_SPRIG =
  '<svg class="deco sprig" viewBox="0 0 40 78" aria-hidden="true" fill="none" stroke="#9f8766" stroke-width="1.3" stroke-linecap="round"><path d="M22 76 C20 58 24 36 31 8"/><path d="M22 58 C16 52 13 46 11 38"/><path d="M25 44 C31 40 33 34 34 28"/><g fill="#c9a35e" stroke="none"><circle cx="10" cy="36" r="2.6"/><circle cx="34" cy="26" r="2.8"/><circle cx="31" cy="7" r="2.6"/><circle cx="12" cy="42" r="2"/><circle cx="35" cy="33" r="2"/></g></svg>';

function playButton(label: string): string {
  return `<span class="btn-paper"><i aria-hidden="true"></i>${escapeHtml(label)}</span>`;
}

export const ARROW =
  '<svg viewBox="0 0 26 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6h23M19 1l5 5-5 5"/></svg>';

function moreLink(label: string): string {
  return `<span class="more">${escapeHtml(label)}${ARROW}</span>`;
}

/** Карточка игры: отпечаток на подложке, название, строка описания, Play и More. */
export function rowGame(game: Game, lang: Lang, wide: boolean): string {
  const d = t(lang);
  const line = lang === 'uk' ? game.taglineUk : game.tagline;
  return `
    <a class="rcard ${wide ? 'is-wide' : ''} reveal" href="/${game.path}/">
      ${mount(game, lang, wide ? d.newLabel : null)}
      <div class="rbody">
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(line)}</p>
        <div class="acts">${playButton(d.play)}${moreLink(d.more)}</div>
        ${DECO_GAME}
      </div>
    </a>`;
}

/** Последняя плашка строки вместо ещё одной карточки: «Все игры →» / «Все записи →». */
export function allCard(href: string, label: string): string {
  return `
    <a class="rcard all-card reveal" href="${href}">
      <svg class="all-decor" viewBox="0 0 220 120" aria-hidden="true"><polygon points="0,120 70,26 140,120" fill="#d9ccb6"/><polygon points="70,26 140,120 100,120" fill="#c8baa2"/><polygon points="90,120 150,50 220,120" fill="#878e80"/><polygon points="150,50 220,120 182,120" fill="#737b6c"/></svg>
      ${moreLink(label)}
    </a>`;
}

/** Заметка: дата, название, строка текста, More; в углу ветка и оторванный уголок. */
export function rowPost(post: Post, lang: Lang, wide: boolean): string {
  const d = t(lang);
  return `
    <a class="rcard rpost ${wide ? 'is-wide' : ''} reveal" href="${postHref(post, lang)}">
      <i class="torn" aria-hidden="true"></i>
      <div class="rbody">
        <time class="rdate" datetime="${post.date}">${formatDate(post.date, lang)}</time>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt)}</p>
        ${post.fallback ? `<span class="only-en">${escapeHtml(d.onlyEnglish)}</span>` : ''}
        <div class="acts"><span></span>${moreLink(d.more)}</div>
        ${DECO_SPRIG}
      </div>
    </a>`;
}

/** Страница игр: большая плашка новейшей игры как на образце: отпечаток слева, название, текст, Play и More справа. */
export function gameBanner(game: Game, lang: Lang, label: string): string {
  const d = t(lang);
  return `
    <a class="rcard game-banner reveal" href="/${game.path}/">
      ${mount(game, lang, d.newLabel)}
      <div class="rbody banner-body">
        <h2>${escapeHtml(game.title)}</h2>
        <p>${escapeHtml(pitch(game, lang))}</p>
        <div class="acts acts-left">${playButton(d.play)}${moreLink(d.more)}</div>
        ${DECO_GAME}
      </div>
      <span class="sr-only">${escapeHtml(label)}</span>
    </a>`;
}

/** Маленькая плашка на странице игр: то же, что карточка в строке главной. */
export function gameCard(game: Game, lang: Lang): string {
  return rowGame(game, lang, false);
}

function postHref(post: Post, lang: Lang): string {
  return `${pageUrl(lang, 'blog')}#${post.slug}`;
}
