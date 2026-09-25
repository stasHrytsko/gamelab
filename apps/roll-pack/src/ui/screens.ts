import type { Level } from '../engine/types.ts';
import { LEVELS } from '../levels/levels.ts';
import banner from '@ui/prototypes/roll-pack/assets/home-banner.webp';
import { icon } from './icons.ts';
import { currentLevel, isUnlocked, loadProgress } from './storage.ts';

export type Go = (route: string) => void;

export function homeScreen(go: Go): HTMLElement {
  const el = document.createElement('main');
  el.className = 'screen home';
  el.dataset['testid'] = 'home';
  // Баннер — фон экрана (размытый, во весь экран) и чёткая карточка сверху (§7.1).
  el.style.setProperty('--banner', `url("${banner}")`);
  el.innerHTML = `
    <div class="home-bg" aria-hidden="true"></div>
    <img class="home-banner" src="${banner}" alt="" width="1672" height="941">
    <h1 class="sr-only">Build &amp; Pack</h1>
    <p class="home-tag">Собери фигуру — уложи на поле</p>
    <div style="flex:1"></div>
    <button class="btn btn-primary btn-large" data-testid="play">${icon.play}Играть</button>`;
  el.querySelector('[data-testid="play"]')?.addEventListener('click', () => go('#/levels'));
  return el;
}

const cellsOf = (level: Level): number => level.map.join('').split('').filter((ch) => ch === '.').length;
const piecesWord = (n: number): string => (n % 10 === 1 && n % 100 !== 11 ? 'фигура' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'фигуры' : 'фигур');

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
      ? `<div class="num"><div class="tile ${done ? 'c-green' : 'c-blue'}"><span>${String(n)}</span></div></div>`
      : `<div class="lock">${icon.lock}</div>`;
    const badge = done ? `<div class="check">${icon.check}</div>` : state === 'current' ? `<div class="play-mini">${icon.play}</div>` : '';
    return `<button class="level-card ${state === 'open' ? '' : state}" data-level="${String(n)}" data-testid="level-${String(n)}" style="animation-delay:${String(n * 50)}ms">
        ${tile}
        <div><h3>Уровень ${String(n)}</h3><p>${icon.grid}${String(cellsOf(level))} клеток · ${String(level.numbers.length)} ${piecesWord(level.numbers.length)}</p></div>
        <div class="state">${badge}</div>
      </button>`;
  });
  el.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" data-testid="to-home" aria-label="На главный">${icon.back}</button>
      <h2>Уровни</h2><div class="spacer"></div>
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
