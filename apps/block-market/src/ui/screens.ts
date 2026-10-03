import art from '@ui/prototypes/block-market/assets/home-art.webp';
import { LEVELS } from '../levels/levels.ts';
import { icon } from './icons.ts';
import { currentLevel, isUnlocked, loadProgress } from './storage.ts';

export type Go = (route: string) => void;

export function homeScreen(go: Go): HTMLElement {
  const el = document.createElement('main');
  el.className = 'screen home';
  el.dataset['testid'] = 'home';
  // Арт автора: название, поле и монеты. Нарисованная кнопка обрезана;
  // низ арта растворяется в размытой копии, кнопка — настоящая, под артом.
  el.style.setProperty('--art', `url("${art}")`);
  el.innerHTML = `
    <div class="home-bg" aria-hidden="true"></div>
    <img class="home-art" src="${art}" alt="" width="941" height="1262">
    <a class="site-link" href="/games/" data-testid="to-site" aria-label="All games">${icon.back}<span>All games</span></a>
    <h1 class="sr-only">Block Market</h1>
    <button class="play-btn" data-testid="play">Play</button>`;
  el.querySelector('[data-testid="play"]')?.addEventListener('click', () => go('#/levels'));
  return el;
}

const word = (n: number, one: string, few: string, many: string): string =>
  n === 1 ? one : many;

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
    return `<button class="level-card ${state === 'open' ? '' : state}" data-level="${String(n)}" data-testid="level-${String(n)}" style="animation-delay:${String(n * 50)}ms">
        ${tile}
        <div><h3>Level ${String(n)}</h3><p>${icon.lines}${String(level.goal)} ${word(level.goal, 'line', 'lines', 'lines')} · ${String(level.stones)} ${word(level.stones, 'stone', 'stones', 'stones')}</p></div>
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
