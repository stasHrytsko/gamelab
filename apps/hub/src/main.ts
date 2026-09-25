import { GAMES } from './games.ts';
import { cover, icon } from './icons.ts';
import './styles.css';

const QUEUE_SLOTS = 5;

function featuredCard(game: (typeof GAMES)[number], isNewest: boolean): string {
  const cta =
    game.url === ''
      ? `<button class="btn btn-soon" disabled>Скоро</button>`
      : `<a class="btn btn-primary" href="${game.url}" target="_blank" rel="noopener">${icon.play}Играть</a>`;
  return `
    <div class="featured">
      ${isNewest ? '<span class="badge-new">Новое</span>' : ''}
      ${cover(game.cover)}
      <div>
        <h2>${game.title}</h2>
        <div class="meta">
          <span>${game.added}</span><span class="dot"></span>
          <span>${String(game.levels)} уровней</span><span class="dot"></span>
          <span>${game.family}</span>
        </div>
      </div>
      <p class="pitch">${game.pitch}</p>
      ${cta}
    </div>`;
}

function queueSlots(count: number): string {
  return `<div class="queue" aria-hidden="true">${'<div class="queue-slot"><span class="mark"></span><span class="status">Скоро</span></div>'.repeat(count)}</div>`;
}

const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');

root.innerHTML = `
  <div class="page">
    <div class="head">
      <h1>Prototype Validation Project</h1>
      <p>Короткие игровые прототипы, которые можно сразу открыть на телефоне и сыграть. Каждый проверяет одну идею, а не готовая игра.</p>
    </div>
    <div class="section">
      <span class="section-label">Prototype log</span>
      ${GAMES.map((game, index) => featuredCard(game, index === 0)).join('')}
      ${queueSlots(QUEUE_SLOTS)}
    </div>
  </div>`;
