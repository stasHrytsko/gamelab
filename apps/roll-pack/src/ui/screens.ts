import type { Level } from '../engine/types.ts';
import { LEVELS } from '../levels/levels.ts';
import { icon, sq } from './icons.ts';
import { currentLevel, isUnlocked, loadProgress } from './storage.ts';

export type Go = (route: string) => void;

export function homeScreen(go: Go): HTMLElement {
  const el = document.createElement('main');
  el.className = 'screen home';
  el.dataset['testid'] = 'home';
  // Поле 4×4: препятствие и три уложенные фигуры — сразу видно, во что играем.
  const logo = [
    sq(4), sq(4), sq(5), sq(5),
    sq(4), '<div class="wall-tile"></div>', sq(6), sq(5),
    sq(4), sq(6), sq(6), sq(5),
    '<div class="hole"></div>', '<div class="hole"></div>', sq(6), sq(5),
  ];
  el.innerHTML = `
    <div class="home-logo" aria-hidden="true">${logo.join('')}</div>
    <h1>Build<br>&amp; Pack</h1>
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
