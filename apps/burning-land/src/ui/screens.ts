import { LEVELS } from '../levels/levels.ts';
import art from '@ui/prototypes/burning-land/assets/home-art.webp';
import { houseCells, parseCells } from '../engine/fireEngine.ts';
import { glyph, icon } from './icons.ts';
import { currentLevel, isUnlocked, loadProgress } from './storage.ts';

export type Go = (route: string) => void;

export function homeScreen(go: Go): HTMLElement {
  const el = document.createElement('main');
  el.className = 'screen home';
  el.dataset['testid'] = 'home';
  // Арт первого экрана автора (§7.1): название, поле с огнём, стенами и домами.
  // Низ арта растворяется в размытой копии; кнопка — настоящая, под артом.
  el.style.setProperty('--art', `url("${art}")`);
  el.innerHTML = `
    <div class="home-bg" aria-hidden="true"></div>
    <img class="home-art" src="${art}" alt="" width="941" height="1340">
    <h1 class="sr-only">Burning Land</h1>
    <button class="play-btn" data-testid="play">Играть</button>`;
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
      ? `<div class="num"><div class="tile ${done ? 'c-green' : 'c-blue'}"><span>${String(n)}</span></div></div>`
      : `<div class="lock">${icon.lock}</div>`;
    const badge = done ? `<div class="check">${icon.check}</div>` : state === 'current' ? `<div class="play-mini">${icon.play}</div>` : '';
    const fires = parseCells(level).filter((k) => k === 'fire').length;
    const homes = houseCells(level).length;
    const sub = `${String(fires)} ${plural(fires, 'очаг', 'очага', 'очагов')} · ${String(homes)} ${plural(homes, 'дом', 'дома', 'домов')}`;
    return `<button class="level-card ${state === 'open' ? '' : state}" data-level="${String(n)}" data-testid="level-${String(n)}" style="animation-delay:${String(n * 50)}ms">
        ${tile}
        <div><h3>Уровень ${String(n)}</h3><p>${glyph.flame}${sub}</p></div>
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

const plural = (n: number, one: string, few: string, many: string): string =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;
