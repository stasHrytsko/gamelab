import type { Game } from '../../tools/games.d.mts';
import type { Post } from './data.ts';
import { escapeHtml, formatDate, pageUrl, t, type Lang } from './i18n.ts';

function pitch(game: Game, lang: Lang): string {
  return lang === 'uk' ? game.pitchUk : game.pitch;
}

function chip(game: Game, lang: Lang): string {
  return `<span class="chip chip-${game.status}"><i></i>${escapeHtml(t(lang).status[game.status])}</span>`;
}

export function gameBig(game: Game, lang: Lang, label?: string, variant: 'game-big' | 'game-tile' = 'game-big'): string {
  const d = t(lang);
  return `
    <a class="card ${variant} reveal" href="/${game.path}/">
      <div class="cover">
        <img src="/${game.path}/og.png" alt="" loading="lazy">
        ${chip(game, lang)}
        ${label === undefined ? '' : `<span class="flag">${escapeHtml(label)}</span>`}
      </div>
      <div class="card-body">
        <div class="card-meta"><span>${escapeHtml(d.genre[game.genre] ?? game.genre)}</span><time datetime="${game.added}">${formatDate(game.added, lang)}</time></div>
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(pitch(game, lang))}</p>
        <span class="card-go">${d.play} <b>→</b></span>
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

export function gameTile(game: Game, lang: Lang): string {
  return gameBig(game, lang, undefined, 'game-tile');
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
        <span class="card-go">${d.readMore} <b>→</b></span>
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
