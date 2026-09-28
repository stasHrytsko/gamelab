import { GAMES } from './games.ts';
import './styles.css';

function tile(game: (typeof GAMES)[number]): string {
  return `
    <a class="tile" href="${game.play}" target="_blank" rel="noopener" data-testid="tile-${game.slug}">
      <img class="tile-icon" src="${game.icon}" alt="" width="72" height="72">
      <div class="tile-body">
        <div class="tile-head">
          <h3>${game.title}</h3>
          <span class="tag-genre">${game.genre}</span>
        </div>
        <p class="tile-pitch">${game.pitch}</p>
      </div>
      <span class="tile-play">Play →</span>
    </a>`;
}

const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');

root.innerHTML = `
  <div class="page">
    <div class="head">
      <h1>Prototype Validation Project</h1>
      <p>Five playable prototypes, one tap away. Each tests a single idea, not a finished game — pick one and play.</p>
    </div>

    <div class="section">
      <span class="section-label">Games — ${String(GAMES.length)}</span>
      <div class="grid">
        ${GAMES.map(tile).join('')}
      </div>
    </div>
  </div>`;
