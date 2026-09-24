import { LEVEL_COUNT, LEVELS } from '../levels/loadLevels.ts';
import { icon, taxiCar } from './icons.ts';
import { currentLevel, isUnlocked, loadProgress } from './storage.ts';

export type Go = (route: string) => void;

export function homeScreen(go: Go): HTMLElement {
  const el = document.createElement('main');
  el.className = 'screen home';
  el.dataset['testid'] = 'home';
  el.innerHTML = `
    <div class="home-logo" aria-hidden="true">
      <div class="bob">${taxiCar('red')}</div><div class="hole"></div><div class="bob">${taxiCar('blue', '', 90)}</div>
      <div class="hole"></div><div class="bob">${taxiCar('yellow')}</div><div class="hole"></div>
      <div class="bob">${taxiCar('blue', '', 270)}</div><div class="hole"></div><div class="bob">${taxiCar('red', '', 180)}</div>
    </div>
    <h1>Такси-<br>пятнашки</h1>
    <div style="flex:1"></div>
    <button class="btn btn-primary btn-large" data-testid="play">${icon.play}Играть</button>`;
  el.querySelector('[data-testid="play"]')?.addEventListener('click', () => go('#/levels'));
  return el;
}

const passengersWord = (count: number): string =>
  count % 10 === 1 && count % 100 !== 11 ? 'пассажир'
    : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'пассажира' : 'пассажиров';

export function levelsScreen(go: Go): HTMLElement {
  const { passed } = loadProgress();
  const current = currentLevel();
  const el = document.createElement('main');
  el.className = 'screen';
  el.dataset['testid'] = 'levels';
  const cards = LEVELS.slice(0, LEVEL_COUNT).map((level) => {
    const n = level.id;
    const done = passed.includes(n);
    const open = isUnlocked(n);
    const state = done ? 'done' : open && n === current ? 'current' : open ? 'open' : 'locked';
    const tile = open
      ? `<div class="num"><div class="tile ${done ? 'c-green' : 'c-blue'}"><span>${String(n)}</span></div></div>`
      : `<div class="lock">${icon.lock}</div>`;
    const badge = done ? `<div class="check">${icon.check}</div>` : state === 'current' ? `<div class="play-mini">${icon.play}</div>` : '';
    const count = level.passengers.length;
    return `<button class="level-card ${state === 'open' ? '' : state}" data-level="${String(n)}" data-testid="level-${String(n)}" style="animation-delay:${String(n * 50)}ms">
        ${tile}
        <div><h3>Уровень ${String(n)}</h3><p>${icon.person}${String(count)} ${passengersWord(count)}</p></div>
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
