import { LEVELS } from '../levels/levels.ts';
import art from '@ui/prototypes/the-gap/assets/home-art.webp';
import { icon, star } from './icons.ts';
import { bestFor, currentLevel, isUnlocked, loadProgress } from './storage.ts';

export type Go = (route: string) => void;

export function homeScreen(go: Go): HTMLElement {
  const el = document.createElement('main');
  el.className = 'screen home';
  el.dataset['testid'] = 'home';
  // Арт первого экрана: название, поле и колбы. Низ арта растворяется в
  // размытой копии; кнопка — настоящая, под артом.
  el.style.setProperty('--art', `url("${art}")`);
  el.innerHTML = `
    <div class="home-bg" aria-hidden="true"></div>
    <img class="home-art" src="${art}" alt="" width="941" height="1290">
    <a class="site-link" href="/games/" data-testid="to-site" aria-label="All games">${icon.back}<span>All games</span></a>
    <h1 class="sr-only">The Gap</h1>
    <button class="play-btn" data-testid="play">Play</button>`;
  el.querySelector('[data-testid="play"]')?.addEventListener('click', () => go('#/levels'));
  return el;
}

export function levelsScreen(go: Go): HTMLElement {
  const { passed } = loadProgress();
  const current = currentLevel();
  const el = document.createElement('main');
  el.className = 'screen';
  el.dataset['testid'] = 'levels';
  const cards = LEVELS.map((level) => {
    const n = level.id;
    const done = passed.includes(n);
    const open = isUnlocked(n);
    const state = done ? 'done' : open && n === current ? 'current' : open ? 'open' : 'locked';
    const tile = open
      ? `<div class="num"><div class="tile ${done ? 'c-teal' : 'c-coral'}"><span>${String(n)}</span></div></div>`
      : `<div class="lock">${icon.lock}</div>`;
    const badge = done ? `<div class="check">${icon.check}</div>` : state === 'current' ? `<div class="play-mini">${icon.play}</div>` : '';
    const squares = level.field.filter((c) => c > 0).length + level.flasks.reduce((sum, f) => sum + f.length, 0);
    const best = bestFor(n);
    // пройденный уровень показывает лучший результат: звёзды и ходы (§7)
    const sub =
      best !== undefined
        ? `<span class="best" data-testid="best-${String(n)}" data-stars="${String(best.stars)}">${[1, 2, 3].map((i) => `<span class="st${i <= best.stars ? ' on' : ''}">${star}</span>`).join('')}</span>${String(best.moves)} ${movesWord(best.moves)}`
        : `${icon.moves}${String(squares)} ${squaresWord(squares)} · ${String(level.limit)} ${movesWord(level.limit)}`;
    return `<button class="level-card ${state === 'open' ? '' : state}" data-level="${String(n)}" data-testid="level-${String(n)}" style="animation-delay:${String(n * 50)}ms">
        ${tile}
        <div><h3>Level ${String(n)}</h3><p>${sub}</p></div>
        <div class="state">${badge}</div>
      </button>`;
  });
  el.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" data-testid="to-home" aria-label="Home">${icon.back}</button>
      <h2>Levels</h2><div class="spacer"></div>
    </div>
    <div class="levels">${cards.join('')}</div>`;
  el.querySelector('[data-testid="to-home"]')?.addEventListener('click', () => go('#/'));
  el.querySelectorAll<HTMLElement>('.level-card').forEach((card) => {
    card.addEventListener('click', () => {
      const n = Number(card.dataset['level']);
      if (isUnlocked(n)) {
        go(`#/level/${String(n)}`);
        return;
      }
      card.classList.remove('shake-x');
      void card.offsetWidth;
      card.classList.add('shake-x');
    });
  });
  return el;
}

const movesWord = (n: number): string =>
  n === 1 ? 'move' : 'moves';

const squaresWord = (n: number): string =>
  n === 1 ? 'square' : 'squares';
