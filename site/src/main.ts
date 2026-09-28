import type { Game } from '../../tools/games.d.mts';
import GAMES from 'virtual:games';
import './styles.css';

function tile(game: Game): string {
  return `
    <a class="tile" href="/${game.path}/" data-testid="tile-${game.path}">
      <img class="tile-icon" src="/${game.path}/icon-192.png" alt="" width="72" height="72">
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
      <p>Playable prototypes, one tap away. Each tests a single idea, not a finished game — pick one and play.</p>
    </div>

    <div class="section">
      <span class="section-label">Games — ${String(GAMES.length)}</span>
      <div class="grid">
        ${GAMES.map(tile).join('')}
      </div>
    </div>
  </div>`;
