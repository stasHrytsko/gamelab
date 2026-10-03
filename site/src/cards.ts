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

type Scheme = { bg: string; m1: [string, string]; m2: [string, string]; m3: [string, string]; sun: string };
const SCHEMES: Record<(typeof ACCENTS)[number], Scheme> = {
  coral: { bg: '#ecd3c4', m1: ['#d98c6b', '#c4724f'], m2: ['#8aa38a', '#6f8c72'], m3: ['#e6c27a', '#d0a653'], sun: '#d9734f' },
  mustard: { bg: '#efe0bb', m1: ['#e0b050', '#c99a3a'], m2: ['#d98c6b', '#c4724f'], m3: ['#8aa38a', '#6f8c72'], sun: '#d9734f' },
  teal: { bg: '#d8e0d2', m1: ['#7fa58f', '#648b75'], m2: ['#8fa7c7', '#7790b3'], m3: ['#e0b050', '#c99a3a'], sun: '#d9734f' },
  blue: { bg: '#d6dee9', m1: ['#8fa7c7', '#7790b3'], m2: ['#7fa58f', '#648b75'], m3: ['#d98c6b', '#c4724f'], sun: '#e0b050' },
};

/** Обложка-заглушка: бумажные горы с гранями и иконка игры. Цвет зависит от номера идеи. */
function cover(game: Game): string {
  const accent = ACCENTS[game.idea % ACCENTS.length] ?? 'coral';
  const c = SCHEMES[accent];
  const sunX = game.idea % 2 === 0 ? 190 : 84;
  return `<div class="cover"><svg class="scene" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="400" height="400" fill="${c.bg}"/><circle cx="${sunX}" cy="84" r="34" fill="${c.sun}"/><polygon points="-30,400 120,112 270,400" fill="${c.m1[0]}"/><polygon points="120,112 270,400 184,400" fill="${c.m1[1]}"/><polygon points="196,400 312,204 430,400" fill="${c.m2[0]}"/><polygon points="312,204 430,400 362,400" fill="${c.m2[1]}"/><polygon points="-40,400 42,272 124,400" fill="${c.m3[0]}"/><polygon points="42,272 124,400 84,400" fill="${c.m3[1]}"/></svg><img class="cover-icon" src="/${game.path}/icon-512.png" alt="" width="512" height="512" loading="lazy"></div>`;
}

/** Карточка игры в строке главной: картинка сверху, название, строка описания, стрелка справа внизу. */
export function rowGame(game: Game, lang: Lang, wide: boolean): string {
  const d = t(lang);
  const line = lang === 'uk' ? game.taglineUk : game.tagline;
  return `
    <a class="rcard ${wide ? 'is-wide' : ''} reveal" href="/${game.path}/">
      <div class="cover-wrap">${cover(game)}${chip(game, lang)}</div>${wide ? `<span class="tape">${escapeHtml(d.newLabel)}</span>` : ''}
      <div class="rbody">
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(line)}</p>
        <span class="go"><span class="sr-only">${d.play}</span><b aria-hidden="true">→</b></span>
      </div>
    </a>`;
}

/** Последняя плашка строки вместо ещё одной карточки: «Все игры →» / «Все записи →». */
export function allCard(href: string, label: string): string {
  return `
    <a class="rcard all-card reveal" href="${href}">
      <svg class="all-decor" viewBox="0 0 220 120" aria-hidden="true"><polygon points="0,120 70,26 140,120" fill="#cdb995"/><polygon points="70,26 140,120 100,120" fill="#bba67f"/><polygon points="90,120 150,50 220,120" fill="#7fa58f"/><polygon points="150,50 220,120 182,120" fill="#648b75"/></svg>
      <span class="all-label">${escapeHtml(label)}</span>
      <b class="all-arrow" aria-hidden="true">→</b>
    </a>`;
}

const NOTE_ART = [
  '<svg viewBox="0 0 150 100" aria-hidden="true"><polygon points="4,96 40,30 76,96" fill="#6e93ad"/><polygon points="40,30 76,96 56,96" fill="#58798f"/><polygon points="52,96 92,18 132,96" fill="#d8c19a"/><polygon points="92,18 132,96 108,96" fill="#c4a97c"/></svg>',
  '<svg viewBox="0 0 150 100" aria-hidden="true"><polygon points="20,40 62,22 104,40 62,58" fill="#d8bf98"/><polygon points="20,40 62,58 62,98 20,80" fill="#c9a97e"/><polygon points="62,58 104,40 104,80 62,98" fill="#b89368"/><polygon points="68,50 100,36 132,50 100,64" fill="#8a8a82"/><polygon points="68,50 100,64 100,98 68,84" fill="#d98c6b"/><polygon points="100,64 132,50 132,84 100,98" fill="#5f5f5a"/></svg>',
  '<svg viewBox="0 0 150 100" aria-hidden="true"><polygon points="10,96 38,36 66,96" fill="#6f9a86"/><polygon points="38,36 66,96 50,96" fill="#5a8571"/><polygon points="48,96 98,8 148,96" fill="#d8bd8f"/><polygon points="98,8 148,96 118,96" fill="#c4a374"/><polygon points="30,96 70,56 110,96" fill="#e0aa6a"/></svg>',
] as const;

/** Заметка в строке блога: дата, название, строка текста, маленькая оригами-иллюстрация, стрелка. */
export function rowPost(post: Post, lang: Lang, wide: boolean, index: number): string {
  const d = t(lang);
  return `
    <a class="rcard rpost ${wide ? 'is-wide' : ''} reveal" href="${postHref(post, lang)}">
      <div class="rbody">
        <time class="rdate" datetime="${post.date}">${formatDate(post.date, lang)}</time>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt)}</p>
        ${post.fallback ? `<span class="only-en">${escapeHtml(d.onlyEnglish)}</span>` : ''}
        <span class="go"><span class="sr-only">${d.readMore}</span><b aria-hidden="true">→</b></span>
      </div>
      <div class="note-art" aria-hidden="true">${NOTE_ART[index % NOTE_ART.length] ?? ''}</div>
    </a>`;
}

/** Страница игр: большая плашка новейшей игры — обложка слева, описание и Play справа. */
export function gameBanner(game: Game, lang: Lang, label: string): string {
  const d = t(lang);
  return `
    <a class="card game-banner reveal" href="/${game.path}/">
      <div class="cover-wrap">
        ${cover(game)}
        <span class="flag">${escapeHtml(label)}</span>
      </div>
      <div class="banner-body">
        <div class="card-meta">${chip(game, lang)}<span>${escapeHtml(d.genre[game.genre] ?? game.genre)}</span><time datetime="${game.added}">${formatDate(game.added, lang)}</time></div>
        <h2>${escapeHtml(game.title)}</h2>
        <p>${escapeHtml(pitch(game, lang))}</p>
        <span class="btn btn-primary">${d.play} <b>→</b></span>
      </div>
    </a>`;
}

/** Маленькая плашка: обложка, название и Play. */
export function gameCard(game: Game, lang: Lang): string {
  const d = t(lang);
  return `
    <a class="card game-card reveal" href="/${game.path}/">
      <div class="cover-wrap">${cover(game)}</div>
      <div class="card-body">
        <h3>${escapeHtml(game.title)}</h3>
        <span class="btn-sm">${d.play} <b>→</b></span>
      </div>
    </a>`;
}

function postHref(post: Post, lang: Lang): string {
  return `${pageUrl(lang, 'blog')}#${post.slug}`;
}

function postMeta(post: Post, lang: Lang): string {
  const d = t(lang);
  return `<div class="card-meta"><time datetime="${post.date}">${formatDate(post.date, lang)}</time><span>${escapeHtml(post.tag)}</span>${post.fallback ? `<span class="only-en">${escapeHtml(d.onlyEnglish)}</span>` : ''}</div>`;
}
