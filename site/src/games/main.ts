import '../styles.css';
import './styles.css';
import games from 'virtual:games';
import { gameCard } from '../game-card';
import { siteHeader } from '../nav';

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
        ${games.map((game) => gameCard(game, 'h2')).join('')}
      </div>
    </main>
    <footer class="site-footer">
      <p>Stazzi — ideas, games & blog.</p>
      <a href="/">Back to home <span>→</span></a>
    </footer>
  </div>`;
