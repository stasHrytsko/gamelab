import { createState, deadRegion, fitsBuilder, isPieceReady, normalize, place, shift } from '../engine/packEngine.ts';
import { BUILDER, type GameState, type Point } from '../engine/types.ts';
import { getLevel, LEVEL_COUNT } from '../levels/levels.ts';
import { vibrate, wait } from './feedback.ts';
import { icon, sq } from './icons.ts';
import { log } from './log.ts';
import { openPopup } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, markPassed } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="chip demo-chip c5">5</div>
    ${icon.arrow.replace('class=""', 'class="arrow"')}
    <div class="demo-shape">${sq(5)}${sq(5)}${sq(5)}<div></div>${sq(5)}${sq(5)}</div>
  </div>
  <ol class="rules">
    <li><b>1</b><span>Выбери число — столько клеток будет в фигуре.</span></li>
    <li><b>2</b><span>Собери фигуру: тапай по сетке 4×4 внизу. Клетки должны касаться сторонами.</span></li>
    <li><b>3</b><span>Потяни готовую фигуру вверх, на пустые клетки поля.</span></li>
    <li><b>4</b><span>Используй все числа и заполни поле целиком. Кусок поля, который уже не закрыть, — проигрыш.</span></li>
  </ol>`;

const key = (r: number, c: number): string => `${String(r)},${String(c)}`;

export function gameScreen(levelNumber: number, go: Go): Screen {
  const level = getLevel(levelNumber);
  let state: GameState = createState(level);
  let selected: number | null = null;
  let built: Point[] = [];
  let popupOpen = false;
  let busy = false;
  let clears = 0;
  let selectedAt = performance.now();

  const rows = state.board.length;
  const cols = state.board[0]?.length ?? 0;

  const el = document.createElement('main');
  el.className = 'screen game';
  el.dataset['testid'] = 'game';
  el.dataset['level'] = String(levelNumber);
  el.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" data-testid="to-levels" aria-label="К уровням">${icon.levels}</button>
      <h2>Уровень ${String(levelNumber)}</h2>
      <div class="right">
        <button class="icon-btn q" data-testid="help" aria-label="Как играть">?</button>
        <button class="icon-btn" data-testid="restart" aria-label="Заново">${icon.replay}</button>
      </div>
    </div>
    <div class="stage"><div class="board" data-testid="board"></div></div>
    <div class="tray off">
      <div class="hint" data-testid="hint"></div>
      <div class="tray-row">
        <div class="builder" data-testid="builder"></div>
        <div class="tray-side">
          <div class="chips" data-testid="numbers"></div>
          <button class="clear-btn" data-testid="clear" disabled>${icon.clear}Очистить</button>
        </div>
      </div>
    </div>`;
  const q = <T extends HTMLElement>(sel: string): T => {
    const found = el.querySelector<T>(sel);
    if (found === null) throw new Error(`game markup: ${sel}`);
    return found;
  };
  const stage = q('.stage');
  const boardEl = q('.board');
  const tray = q('.tray');
  const hintEl = q('.hint');
  const builderEl = q('.builder');
  const chipsEl = q('.chips');
  const clearBtn = q<HTMLButtonElement>('.clear-btn');

  // ---------- поле ----------
  boardEl.style.gridTemplateColumns = `repeat(${String(cols)}, var(--cell))`;
  const cellEls: HTMLElement[][] = state.board.map((row, r) =>
    row.map((cell, c) => {
      const d = document.createElement('div');
      d.className = 'cell';
      d.dataset['r'] = String(r);
      d.dataset['c'] = String(c);
      // Пробел в карте — клетка вне формы поля: не рисуется. `#` — препятствие.
      if (level.map[r]?.[c] === ' ') d.classList.add('void');
      else if (cell === 'wall') d.classList.add('wall');
      boardEl.append(d);
      return d;
    }),
  );
  const cellAt = (r: number, c: number): HTMLElement | undefined => cellEls[r]?.[c];

  // ---------- конструктор ----------
  const bcells: HTMLElement[] = [];
  for (let r = 0; r < BUILDER; r += 1) {
    for (let c = 0; c < BUILDER; c += 1) {
      const d = document.createElement('div');
      d.className = 'bcell';
      d.dataset['r'] = String(r);
      d.dataset['c'] = String(c);
      d.dataset['testid'] = `b-${String(r)}-${String(c)}`;
      builderEl.append(d);
      bcells.push(d);
    }
  }

  const need = (): number => (selected === null ? 0 : state.numbers[selected] ?? 0);
  const ready = (): boolean => selected !== null && isPieceReady(built, need()) && fitsBuilder(built);
  const locked = (): boolean => popupOpen || busy || state.status !== 'playing';

  function render(): void {
    chipsEl.innerHTML = state.numbers
      .map((n, i) => {
        const cls = ['chip', `c${String(n)}`, state.used[i] === true ? 'used' : '', selected === i ? 'sel' : ''].join(' ');
        return `<button class="${cls}" data-i="${String(i)}" data-testid="num-${String(i)}" ${state.used[i] === true ? 'disabled' : ''} aria-label="Число ${String(n)}">${String(n)}</button>`;
      })
      .join('');
    const n = need();
    const isReady = ready();
    tray.classList.toggle('off', selected === null);
    tray.classList.toggle('ready', isReady);
    clearBtn.disabled = built.length === 0;
    const on = new Set(built.map(([r, c]) => key(r, c)));
    for (const d of bcells) {
      const has = on.has(key(Number(d.dataset['r']), Number(d.dataset['c'])));
      d.classList.toggle('on', has);
      d.innerHTML = has ? sq(n) : '';
    }
    // Счётчик клеток — прямо в подсказке (§7).
    const count = `<span class="count${built.length === n ? ' full' : ''}" data-testid="count">${String(built.length)}/${String(n)}</span>`;
    if (state.status !== 'playing') hintEl.innerHTML = '';
    else if (selected === null) hintEl.innerHTML = 'Выбери число справа';
    else if (isReady) hintEl.innerHTML = `<b>Тяни фигуру на поле</b>${count}`;
    else if (built.length === n) hintEl.innerHTML = `Клетки должны касаться сторонами${count}`;
    else hintEl.innerHTML = `Собери фигуру из <b>${String(n)}</b> клеток${count}`;
    el.dataset['status'] = state.status;
    el.dataset['used'] = String(state.used.filter(Boolean).length);
    el.toggleAttribute('data-busy', locked());
  }

  // ---------- размеры от экрана (§7.1) ----------
  function fit(): void {
    const mini = innerHeight < 620 ? 32 : innerHeight < 720 ? 36 : 40;
    el.style.setProperty('--mini', `${String(mini)}px`);
    const box = stage.getBoundingClientRect();
    const cell = Math.floor(Math.min((box.width - 16 - 4 * (cols - 1)) / cols, (box.height - 16 - 4 * (rows - 1)) / rows));
    el.style.setProperty('--cell', `${String(Math.max(28, Math.min(cell, 60)))}px`);
  }
  const observer = new ResizeObserver(fit);
  observer.observe(stage);

  // ---------- ввод ----------
  chipsEl.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (button === null || locked()) return;
    const i = Number(button.dataset['i']);
    if (state.used[i] === true) return;
    if (selected === i) {
      selected = null;
      built = [];
    } else {
      if (selected !== null && state.numbers[selected] !== state.numbers[i]) built = [];
      selected = i;
      selectedAt = performance.now();
      clears = 0;
    }
    render();
  });

  clearBtn.addEventListener('click', () => {
    if (locked() || built.length === 0) return;
    built = [];
    clears += 1;
    render();
  });

  builderEl.addEventListener('pointerdown', (event) => {
    const d = (event.target as HTMLElement).closest<HTMLElement>('.bcell');
    if (d === null || selected === null || locked()) return;
    const r = Number(d.dataset['r']);
    const c = Number(d.dataset['c']);
    const has = built.some(([a, b]) => a === r && b === c);
    if (ready() && has) {
      startDrag(event, [r, c]);
      return;
    }
    if (has) built = built.filter(([a, b]) => a !== r || b !== c);
    else if (built.length < need()) built = [...built, [r, c]];
    else return;
    vibrate(6);
    render();
  });

  // ---------- перетаскивание на поле ----------
  interface Drag {
    readonly pointer: number;
    readonly shape: Point[];
    readonly grab: Point;
    readonly step: number;
    readonly size: number;
    readonly ghost: HTMLElement;
    target: Point[] | null;
  }
  let drag: Drag | null = null;

  function startDrag(event: PointerEvent, grabbed: Point): void {
    event.preventDefault();
    const shape = normalize(built);
    const r0 = Math.min(...built.map((p) => p[0]));
    const c0 = Math.min(...built.map((p) => p[1]));
    const first = cellEls[0]?.[0]?.getBoundingClientRect();
    const second = cellEls[0]?.[1]?.getBoundingClientRect();
    if (first === undefined || second === undefined) return;
    const ghost = document.createElement('div');
    ghost.className = 'ghost';
    const h = Math.max(...shape.map((p) => p[0])) + 1;
    const w = Math.max(...shape.map((p) => p[1])) + 1;
    ghost.style.gridTemplateColumns = `repeat(${String(w)}, var(--cell))`;
    ghost.style.gridTemplateRows = `repeat(${String(h)}, var(--cell))`;
    const set = new Set(shape.map(([r, c]) => key(r, c)));
    for (let r = 0; r < h; r += 1) for (let c = 0; c < w; c += 1) ghost.insertAdjacentHTML('beforeend', set.has(key(r, c)) ? sq(need()) : '<div></div>');
    el.append(ghost);
    drag = { pointer: event.pointerId, shape, grab: [grabbed[0] - r0, grabbed[1] - c0], step: second.left - first.left, size: first.width, ghost, target: null };
    builderEl.setPointerCapture(event.pointerId);
    moveDrag(event);
  }

  function clearAim(): void {
    boardEl.querySelectorAll('.aim-ok, .aim-bad').forEach((d) => d.classList.remove('aim-ok', 'aim-bad'));
  }

  function moveDrag(event: PointerEvent): void {
    if (drag === null) return;
    // Фигура едет над пальцем на одну клетку выше, чтобы её было видно (§4).
    const gx = event.clientX - drag.grab[1] * drag.step - drag.size / 2;
    const gy = event.clientY - drag.step * 1.2 - drag.grab[0] * drag.step - drag.size / 2;
    drag.ghost.style.transform = `translate(${String(gx)}px, ${String(gy)}px)`;
    const origin = cellEls[0]?.[0]?.getBoundingClientRect();
    if (origin === undefined) return;
    const col = Math.round((gx - origin.left) / drag.step);
    const row = Math.round((gy - origin.top) / drag.step);
    const cells = shift(drag.shape, row, col);
    clearAim();
    if (!cells.some(([r, c]) => cellAt(r, c) !== undefined)) {
      drag.target = null;
      return;
    }
    const valid = cells.every(([r, c]) => state.board[r]?.[c] === null);
    for (const [r, c] of cells) cellAt(r, c)?.classList.add(valid ? 'aim-ok' : 'aim-bad');
    drag.target = valid ? cells : null;
  }

  function endDrag(cancelled: boolean): void {
    const d = drag;
    if (d === null) return;
    drag = null;
    d.ghost.remove();
    clearAim();
    if (cancelled || d.target === null) {
      hintEl.innerHTML = 'Сюда не встаёт: нужны пустые клетки';
      vibrate(20);
      return;
    }
    void commit(d.target);
  }

  builderEl.addEventListener('pointermove', (event) => {
    if (drag !== null && event.pointerId === drag.pointer) moveDrag(event);
  });
  builderEl.addEventListener('pointerup', (event) => {
    if (drag !== null && event.pointerId === drag.pointer) endDrag(false);
  });
  builderEl.addEventListener('pointercancel', () => endDrag(true));

  async function commit(cells: Point[]): Promise<void> {
    if (selected === null) return;
    const index = selected;
    const size = state.numbers[index] ?? 0;
    const outcome = place(state, index, cells);
    if (!outcome.valid) return;
    log({
      type: 'place', level: levelNumber, size, shape: normalize(cells).map(([r, c]) => [r, c]),
      at: [Math.min(...cells.map((p) => p[0])), Math.min(...cells.map((p) => p[1]))],
      clears, ms: Math.round(performance.now() - selectedAt),
    });
    state = outcome.state;
    selected = null;
    built = [];
    clears = 0;
    for (const [r, c] of cells) {
      const d = cellAt(r, c);
      if (d === undefined) continue;
      d.classList.add('filled');
      d.innerHTML = sq(size, 'land');
    }
    vibrate(12);
    busy = true;
    render();

    if (state.status === 'won') {
      markPassed(levelNumber);
      log({ type: 'level_win', level: levelNumber });
      await wait(300);
      boardEl.querySelectorAll<HTMLElement>('.sq').forEach((tile, i) => {
        tile.classList.remove('land');
        tile.style.animationDelay = `${String(i * 12)}ms`;
        tile.classList.add('hop');
      });
      vibrate([20, 40, 20]);
      await wait(700);
      busy = false;
      showWin();
      return;
    }
    if (state.status === 'failed') {
      const left = state.numbers.filter((_, i) => state.used[i] !== true);
      for (const [r, c] of deadRegion(state.board, left)) cellAt(r, c)?.classList.add('dead');
      log({ type: 'level_fail', level: levelNumber, reason: 'unsolvable', left });
      vibrate([30, 60, 30]);
      await wait(900);
      busy = false;
      showLose();
      return;
    }
    await wait(200);
    busy = false;
    render();
  }

  // ---------- попапы ----------
  const replay = (): void => go(`#/level/${String(levelNumber)}`);
  const toLevels = (): void => go('#/levels');

  function popup(content: string, actions: Parameters<typeof openPopup>[2], testId: string, onClose?: () => void): void {
    popupOpen = true;
    render();
    openPopup(el, content, actions.map((action) => ({
      ...action,
      run: () => {
        popupOpen = false;
        onClose?.();
        render();
        action.run();
      },
    })), testId);
  }

  function showWin(): void {
    if (levelNumber === LEVEL_COUNT) {
      popup(
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2><p class="sub">Поле заполнено целиком</p>`,
        [
          { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
          { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
        ],
        'popup-final',
      );
      return;
    }
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень пройден!</h2><p class="sub">Поле заполнено целиком</p>`,
      [
        { id: 'next', html: `Следующий уровень ${icon.arrow}`, className: 'btn-success', run: () => go(`#/level/${String(levelNumber + 1)}`) },
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-win',
    );
  }

  function showLose(): void {
    popup(
      `<div class="badge-big badge-lose">${icon.cross}</div><h2>Не собрать</h2><p class="sub">Красный кусок поля уже не закрыть оставшимися числами</p>`,
      [
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-primary', run: replay },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-lose',
    );
  }

  function showHowToPlay(): void {
    popup(HOW_TO_PLAY, [{ id: 'ok', html: 'Понятно!', className: 'btn-primary', run: () => undefined }], 'popup-help', () => markHowToPlaySeen());
  }

  q('[data-testid="to-levels"]').addEventListener('click', toLevels);
  q('[data-testid="restart"]').addEventListener('click', () => {
    if (!popupOpen) replay();
  });
  q('[data-testid="help"]').addEventListener('click', () => {
    if (locked()) return;
    log({ type: 'help_open', level: levelNumber });
    showHowToPlay();
  });

  render();
  log({ type: 'level_start', level: levelNumber });
  if (levelNumber === 1 && !loadProgress().howToPlaySeen) {
    popupOpen = true;
    render();
    setTimeout(showHowToPlay, 350);
  }

  return { el, destroy: () => observer.disconnect() };
}
