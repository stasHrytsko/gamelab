import { icon } from './icons.ts';
import { loadProgress } from './storage.ts';

export type Go = (route: string) => void;

const HERO = [1, 3, 0, 5, 0, 1, 3, 5, 2, 0, 1, 1, 2, 4, 4, 0];

export function homeScreen(go: Go): HTMLElement {
  const best = loadProgress().best;
  const el = document.createElement('main');
  el.className = 'screen home';
  el.dataset['testid'] = 'home';
  const tiles = HERO.map((c, i) => (c === 0 ? '<i></i>' : `<i class="tile c-${String(c)}" style="animation-delay:${String(i * 45)}ms"></i>`)).join('');
  el.innerHTML = `
    <div class="home-hero" aria-hidden="true"><div class="hero-board">${tiles}</div><span class="hero-coin">${icon.coin}<b>+4</b></span></div>
    <h1 class="home-title">Block Market</h1>
    <p class="home-sub">Собирай линии. Плати за удобство.</p>
    <button class="play-btn" data-testid="play">Играть</button>
    <p class="home-best" data-testid="best">${best > 0 ? `Рекорд: ${String(best)} ${best === 1 ? 'уровень' : [2, 3, 4].includes(best % 10) && ![12, 13, 14].includes(best % 100) ? 'уровня' : 'уровней'} подряд` : '12 уровней по 20 фигур'}</p>`;
  el.querySelector('[data-testid="play"]')?.addEventListener('click', () => go('#/play'));
  return el;
}
