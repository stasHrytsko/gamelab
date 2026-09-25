import { GAMES } from './games.ts';
import './styles.css';

const QUEUE_SLOTS = 5;

function heroCard(game: (typeof GAMES)[number]): string {
  const cta = game.url === '' ? '' : `<a class="btn btn-hero-primary" href="${game.url}" target="_blank" rel="noopener">Play</a>`;
  return `
    <article class="hero">
      <div class="hero-content">
        <span class="tag-new">New game</span>
        <h2>${game.title}</h2>
        <div class="meta">${game.date} · ${game.genre}</div>
        <p class="pitch">${game.pitch}</p>
        ${cta}
      </div>
      <div class="hero-image" style="background-image:url('${game.banner}')"></div>
    </article>`;
}

/** Generic gradient art — not a real screenshot, so it never reads as a game. */
function queueSlots(count: number): string {
  return `<div class="queue">${'<div class="queue-card"><span class="status">Soon</span></div>'.repeat(count)}</div>`;
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
      ${GAMES.map(heroCard).join('')}
    </div>

    <div class="section">
      <span class="section-label">Coming up</span>
      ${queueSlots(QUEUE_SLOTS)}
    </div>
  </div>`;
