import '../styles.css';
import './styles.css';
import games from 'virtual:games';
import { siteHeader } from '../nav';
import { escapeHtml } from '../posts';

function gameCard(game: (typeof games)[number]): string {
  return `
    <a class="game-card" href="/${game.path}/">
      <div class="game-picture"><img src="/${game.path}/og.png" alt="" loading="lazy"></div>
      <div class="game-copy">
        <p class="feature-meta">${escapeHtml(game.genre)}</p>
        <h2>${escapeHtml(game.title)}</h2>
        <p>${escapeHtml(game.pitch)}</p>
        <span class="play-button">Play <b>▶</b></span>
      </div>
    </a>`;
}

const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');

root.innerHTML = `
  <div class="site-shell">
    ${siteHeader('games')}
    <main>
      <section class="games-hero">
        <p class="eyebrow"><span></span>${games.length} playable prototypes</p>
        <h1>Games<span>.</span></h1>
        <p>Small playable ideas, mechanics and experiments. Each one opens in the browser — no install.</p>
      </section>
      <div class="games-grid">
        ${games.map(gameCard).join('')}
      </div>
    </main>
    <footer class="site-footer">
      <p>Stazzi — ideas, games & blog.</p>
      <a href="/">Back to home <span>→</span></a>
    </footer>
  </div>`;
