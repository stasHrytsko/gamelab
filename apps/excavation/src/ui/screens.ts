import { LEVELS } from '../levels/levels.ts';
import { glyph, icon, pips } from './icons.ts';
import { currentLevel, isUnlocked, loadProgress } from './storage.ts';

export type Go = (route: string) => void;

// Главный: арта автора для «Раскопа» пока нет — название, мини-комната из
// плит игры и живая кнопка «Играть» (apps/CLAUDE.md §2). Арт заменит
// мини-комнату, когда появится.
export function homeScreen(go: Go): HTMLElement {
  const el = document.createElement('main');
  el.className = 'screen home';
  el.dataset['testid'] = 'home';
  // Честная мини-комната: числа выведены из раскладки, выход найден.
  const map = ['**..', '...X', '..*.', 'E...'];
  const opened = new Set([4, 5, 7, 8, 9, 13, 14]);
  const trapAt = (r: number, c: number): boolean => map[r]?.[c] === '*';
  const room = map
    .flatMap((line, r) =>
      [...line].map((ch, c) => {
        let n = 0;
        for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) if ((dr || dc) && trapAt(r + dr, c + dc)) n += 1;
        const i = r * 4 + c;
        if (ch === 'E') return `<div class="h-cell">${glyph.arch}</div>`;
        if (ch === 'X') return `<div class="h-cell exit"><b class="corner" style="color:var(--ui-clue-${String(n)})">${String(n)}</b>${glyph.exit}${pips(n)}</div>`;
        if (!opened.has(i)) return `<div class="h-cell"><div class="stone">${glyph.cracks}</div></div>`;
        return `<div class="h-cell">${n > 0 ? `<b style="color:var(--ui-clue-${String(n)})">${String(n)}</b>${pips(n)}` : ''}</div>`;
      }),
    )
    .join('');
  el.innerHTML = `
    <div class="home-title">
      <h1>Раскоп</h1>
      <p>Число на плите — это и ловушки рядом, и золото.<br>Найди выход и реши, когда уйти.</p>
    </div>
    <div class="home-room" aria-hidden="true">${room}</div>
    <button class="play-btn" data-testid="play">Играть</button>`;
  el.querySelector('[data-testid="play"]')?.addEventListener('click', () => go('#/levels'));
  return el;
}

export function levelsScreen(go: Go): HTMLElement {
  const { passed, best } = loadProgress();
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
      ? `<div class="num"><div class="tile ${done ? 'c-green' : 'c-stone'}"><span>${String(n)}</span></div></div>`
      : `<div class="lock">${icon.lock}</div>`;
    const got = best[String(n)] ?? 0;
    const badge = done
      ? `<div class="stars-mini" data-testid="best-${String(n)}" data-stars="${String(got)}">${[1, 2, 3].map((k) => `<span class="${k <= got ? 'got' : ''}">${glyph.star}</span>`).join('')}</div>`
      : state === 'current'
        ? `<div class="play-mini">${icon.play}</div>`
        : '';
    const sub = `${String(level.rows)}×${String(level.cols)} · ${String(level.traps)} ${plural(level.traps, 'ловушка', 'ловушки', 'ловушек')}`;
    return `<button class="level-card ${state === 'open' ? '' : state}" data-level="${String(n)}" data-testid="level-${String(n)}" style="animation-delay:${String(n * 50)}ms">
        ${tile}
        <div><h3>Уровень ${String(n)}</h3><p>${glyph.spikes}${sub}</p></div>
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

export const plural = (n: number, one: string, few: string, many: string): string =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;
