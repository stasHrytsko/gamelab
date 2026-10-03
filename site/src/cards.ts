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

/** Обложка без текста: иконка игры на бумажном фоне. Цвет акцента зависит от номера идеи. */
function cover(game: Game): string {
  const accent = ACCENTS[game.idea % ACCENTS.length] ?? 'coral';
  return `<div class="cover cover-${accent}"><i class="shape s1"></i><i class="shape s2"></i><i class="shape s3"></i><img class="cover-icon" src="/${game.path}/icon-512.png" alt="" width="512" height="512" loading="lazy"></div>`;
}

export function gameBig(game: Game, lang: Lang, label?: string): string {
  const d = t(lang);
  return `
    <a class="card game-big reveal" href="/${game.path}/">
      <div class="cover-wrap">
        ${cover(game)}
        ${chip(game, lang)}
        ${label === undefined ? '' : `<span class="flag">${escapeHtml(label)}</span>`}
      </div>
      <div class="card-body">
        <div class="card-meta"><span>${escapeHtml(d.genre[game.genre] ?? game.genre)}</span><time datetime="${game.added}">${formatDate(game.added, lang)}</time></div>
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(pitch(game, lang))}</p>
        <span class="card-go"><span class="sr-only">${d.play}</span><b aria-hidden="true">→</b></span>
      </div>
    </a>`;
}

export function gameSmall(game: Game, lang: Lang): string {
  const d = t(lang);
  return `
    <a class="card game-small reveal" href="/${game.path}/">
      <div class="thumb"><img src="/${game.path}/icon-192.png" alt="" loading="lazy"></div>
      <div class="card-body">
        ${chip(game, lang)}
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(d.genre[game.genre] ?? game.genre)}</p>
      </div>
      <b class="card-arrow" aria-hidden="true">→</b>
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

export function postBig(post: Post, lang: Lang): string {
  const d = t(lang);
  return `
    <a class="card post-big reveal" href="${postHref(post, lang)}">
      <div class="card-body">
        ${postMeta(post, lang)}
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt)}</p>
        <span class="card-go"><span class="sr-only">${d.readMore}</span><b aria-hidden="true">→</b></span>
      </div>
      <div class="post-shapes" aria-hidden="true"><i></i><i></i><i></i></div>
    </a>`;
}

export function postSmall(post: Post, lang: Lang): string {
  return `
    <a class="card post-small reveal" href="${postHref(post, lang)}">
      <div class="card-body">
        ${postMeta(post, lang)}
        <h3>${escapeHtml(post.title)}</h3>
      </div>
      <b class="card-arrow" aria-hidden="true">→</b>
    </a>`;
}
