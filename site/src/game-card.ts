import type games from 'virtual:games';
import { coverFor } from './covers';
import { escapeHtml } from './posts';

type Game = (typeof games)[number];

// Цвет каждой игры — снят с её арта главного меню. При наведении карточка
// заливается этим цветом. `ink: true` — на светлом цвете текст остаётся тёмным.
const palette: Record<string, { color: string; ink?: boolean }> = {
  'the-gap': { color: '#2f7cf6' },
  'slide-out': { color: '#ff5a5f' },
  'tight-shelf': { color: '#f5a524', ink: true },
  sprout: { color: '#2fb36a' },
  'the-dig': { color: '#b8801f' },
  'arrow-flip': { color: '#7c5cff' },
  'build-pack': { color: '#14b8a6' },
  'block-market': { color: '#f2c200', ink: true },
  'forward-back': { color: '#ff7a6b' },
};

export function gameStyle(path: string): string {
  const tone = palette[path] ?? { color: '#111211' };
  return `--game:${tone.color};--game-text:${tone.ink === true ? '#111211' : '#fff'}`;
}

export function gameCard(game: Game, headingTag = 'h3'): string {
  return `
    <a class="game-card" href="/${game.path}/" style="${gameStyle(game.path)}">
      <div class="game-picture"><img src="${coverFor(game.path)}" alt="" loading="lazy"></div>
      <div class="game-copy">
        <p class="game-genre">${escapeHtml(game.genre)}</p>
        <${headingTag}>${escapeHtml(game.title)}</${headingTag}>
        <p class="game-pitch">${escapeHtml(game.pitch)}</p>
        <span class="game-play">Play <b>▶</b></span>
      </div>
    </a>`;
}
