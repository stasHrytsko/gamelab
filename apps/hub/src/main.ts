import { GAMES } from './games.ts';
import './styles.css';

const QUEUE_SLOTS = 5;

function featuredCard(game: (typeof GAMES)[number], isNewest: boolean): string {
  const cta =
    game.url === ''
      ? `<button class="btn btn-soon" disabled>Soon</button>`
      : `<a class="btn btn-primary" href="${game.url}" target="_blank" rel="noopener">Play</a>`;
  return `
    <div class="featured">
      ${isNewest ? '<span class="tag-new">New game</span>' : ''}
      <div>
        <h2>${game.title}</h2>
        <div class="meta">${game.date} · ${game.genre}</div>
      </div>
      <img class="cover" src="${game.image}" alt="${game.title} screenshot" width="720" height="1480" loading="lazy">
      <p class="pitch">${game.pitch}</p>
      ${cta}
    </div>`;
}

function queueSlots(count: number): string {
  return `<div class="queue" aria-hidden="true">${'<div class="queue-slot"><span class="status">Soon</span></div>'.repeat(count)}</div>`;
}

const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');

root.innerHTML = `
  <div class="page">
    <div class="head">
      <h1>Prototype Validation Project</h1>
      <p>Playable game prototypes, one link away on your phone. Each one tests a single idea, not a finished game.</p>
    </div>
    <div class="section">
      <span class="section-label">Prototype log</span>
      ${GAMES.map((game, index) => featuredCard(game, index === 0)).join('')}
      ${queueSlots(QUEUE_SLOTS)}
    </div>
  </div>`;
