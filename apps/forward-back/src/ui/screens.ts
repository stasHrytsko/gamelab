import { LEVELS } from '../levels/levels.ts';
import { enemyGlyph, heroGlyph, icon } from './icons.ts';
import { currentLevel, isUnlocked, loadProgress } from './storage.ts';

export type Go = (route: string) => void;

export function homeScreen(go: Go): HTMLElement {
  const el = document.createElement('main');
  el.className = 'screen home';
  el.dataset['testid'] = 'home';
  // Быстрая версия без арта автора: заставка собрана из тайлов кита (герой + три врага).
  el.innerHTML = `
    <div class="home-hero" aria-hidden="true">
      <div class="home-row">
        <div class="piece enemy"><svg viewBox="0 0 24 24">${enemyGlyph}</svg></div>
        <div class="piece enemy"><svg viewBox="0 0 24 24">${enemyGlyph}</svg></div>
        <div class="piece hero"><svg viewBox="0 0 24 24">${heroGlyph}</svg></div>
        <div class="piece ghost"></div>
        <div class="piece enemy"><svg viewBox="0 0 24 24">${enemyGlyph}</svg></div>
      </div>
      <div class="home-pills"><span class="pill back">Back ×2</span><span class="pill fwd">Forward ×1</span></div>
    </div>
    <a class="site-link" href="/games/" data-testid="to-site" aria-label="All games">${icon.back}<span>All games</span></a>
    <h1 class="home-title">Forward<br>or back</h1>
    <p class="home-sub">One step, two options. Choose who to remove.</p>
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
    const sub = `${level.enemies.length} ${enemiesWord(level.enemies.length)} · ${String(level.moveLimit)} ${movesWord(level.moveLimit)}`;
    return `<button class="level-card ${state === 'open' ? '' : state}" data-level="${String(n)}" data-testid="level-${String(n)}" style="animation-delay:${String(n * 50)}ms">
        ${tile}
        <div><h3>Level ${String(n)}</h3><p>${icon.moves}${sub}</p></div>
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

const enemiesWord = (n: number): string =>
  n === 1 ? 'enemy' : 'enemies';
