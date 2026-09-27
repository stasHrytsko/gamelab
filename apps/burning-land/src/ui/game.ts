import {
  anyFits,
  cellOf,
  cellsAt,
  centerOffset,
  createState,
  fits,
  houseCells,
  nextBurn,
  place,
  ROTATIONS_PER_LEVEL,
  rotateSlot,
  savedCount,
  shapeCells,
  skipTurn,
  trayOf,
  type TurnResult,
} from '../engine/fireEngine.ts';
import type { Cell, CellKind, GameState, ShapeLetter } from '../engine/types.ts';
import { SIZE } from '../engine/types.ts';
import { getLevel, LEVEL_COUNT } from '../levels/levels.ts';
import { glyph, icon } from './icons.ts';
import { reducedMotion, vibrate, wait } from './feedback.ts';
import { log, nextAttempt } from './log.ts';
import { openPopup } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, markPassed } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

// Тайминги — §7.2 спеки (черновые, поправляются на показе).
const T = {
  place: 120, // стена защёлкивается
  fireDelay: 150, // пауза перед шагом огня
  fire: 250, // новые клетки разгораются, фронт гаснет
  tray: 200, // фигуры «дальше» въезжают в трей
  next: 150, // новый ряд «дальше» проявляется
  rotate: 150,
  shake: 160, // поворотов не осталось
  back: 200, // недопустимое отпускание: фигура летит в трей
  noFit: 900, // «Некуда поставить»
  douse: 300, // победа: огонь догорает в отданной части
  wave: 40, // шаг волны победы
  bounce: 250,
  winPopup: 500,
  failPopup: 900,
} as const;

// Геометрия поля (§7.1): клетка 32–48 px, зазор 4 px.
const GAP = 4;
const PAD = 7;
const CELL_MIN = 32;
const CELL_MAX = 48;
const DRAG_THRESHOLD = 8;

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="demo-cell"><div class="tile fire">${glyph.flame}</div></div>
    <div class="demo-cell dot"></div>
    <div class="demo-cell"><div class="tile wall">${glyph.brick}</div></div>
    <div class="demo-cell"></div>
    <div class="demo-cell"><div class="tile house">${glyph.house}</div></div>
  </div>
  <ol class="rules">
    <li><b>1</b><span>Перетащи фигуру на поле — она станет стеной. Стрелки по бокам фигуры поворачивают её влево и вправо.</span></li>
    <li><b>2</b><span>После каждого хода огонь шагает на соседние клетки — туда, где точки.</span></li>
    <li><b>3</b><span>Огонь не проходит через стены и выгоревшие клетки.</span></li>
    <li><b>4</b><span>Отрежь огонь от всех домов. Поворотов — 3 на весь уровень.</span></li>
  </ol>`;

/** Мини-фигура из клеток: `size` — сторона клетки, `gap` — зазор. */
function shapeHtml(letter: ShapeLetter, rot: number, cls: string): string {
  const cells = shapeCells(letter, rot);
  const h = Math.max(...cells.map((p) => p[0])) + 1;
  const w = Math.max(...cells.map((p) => p[1])) + 1;
  let html = `<div class="${cls}" style="grid-template-columns:repeat(${String(w)},var(--mc));grid-template-rows:repeat(${String(h)},var(--mc))">`;
  for (let r = 0; r < h; r += 1) for (let c = 0; c < w; c += 1) html += cells.some((p) => p[0] === r && p[1] === c) ? '<i></i>' : '<i class="e"></i>';
  return `${html}</div>`;
}

function tileHtml(kind: CellKind): string {
  if (kind === 'fire') return `<div class="tile fire">${glyph.flame}</div>`;
  if (kind === 'wall') return `<div class="tile wall">${glyph.brick}</div>`;
  if (kind === 'house') return `<div class="tile house">${glyph.house}</div>`;
  if (kind === 'ash') return `<div class="ash">${glyph.ember}</div>`;
  return '';
}

interface Drag {
  readonly slot: number;
  readonly pointerId: number;
  readonly x0: number;
  readonly y0: number;
  moved: boolean;
  float: HTMLElement | null;
  anchor: Cell | null;
  at: number[] | null;
  valid: boolean;
  lastX: number;
  lastY: number;
  /** Направление, если это окажется тапом (не перетаскиванием) — по цели самого pointerdown,
      потому что setPointerCapture перенацеливает дальнейшие события на .slot целиком (§4). */
  readonly tapDirection: 1 | -1;
}

export function gameScreen(levelNumber: number, go: Go): Screen {
  const level = getLevel(levelNumber);
  const houses = houseCells(level);
  let state: GameState = createState(level);
  /** Что сейчас нарисовано в клетках — отстаёт от `state` на время анимации хода. */
  const shown: CellKind[] = [...state.cells];
  let busy = false;
  let popupOpen = false;
  let drag: Drag | null = null;
  const attempt = nextAttempt(levelNumber);
  let turnStartedAt = performance.now();
  let rotationsThisTurn = 0;
  let failedDrops = 0;

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
    <div class="stats">
      <div class="stat" data-testid="turn">Ход <b></b></div>
      <div class="stat" data-testid="houses">Дома <b></b></div>
    </div>
    <div class="stage">
      <div class="board" data-testid="board"></div>
      ${levelNumber === 1 ? `<div class="hint-card" data-testid="hint">${glyph.finger}<span>Перетащи фигуру на поле</span></div>` : ''}
      <div class="toast" data-testid="no-fit">Некуда поставить</div>
    </div>
    <div class="rot-row">
      <div class="rot-pill" data-testid="rotations" aria-label="Повороты">
        ${glyph.rotate}
        <div class="rot-dots">${[0, 1, 2].map((i) => `<i class="rd" data-i="${String(i)}"></i>`).join('')}</div>
        <b></b>
      </div>
    </div>
    <div class="tray" data-testid="tray">
      ${[0, 1, 2].map((i) => `<button class="slot" data-slot="${String(i)}" data-testid="slot-${String(i)}"></button>`).join('')}
    </div>
    <div class="next-row" data-testid="next-row">${[0, 1, 2].map((i) => `<div class="nx" data-testid="next-${String(i)}"></div>`).join('')}</div>`;

  const q = <E extends HTMLElement>(sel: string): E => {
    const found = el.querySelector<E>(sel);
    if (found === null) throw new Error(`game markup: ${sel}`);
    return found;
  };
  const stage = q('.stage');
  const boardEl = q('.board');
  const turnNum = q('[data-testid="turn"] b');
  const housesStat = q('[data-testid="houses"]');
  const housesNum = q('[data-testid="houses"] b');
  const rotStat = q('[data-testid="rotations"]');
  const rotNum = q('[data-testid="rotations"] b');
  const rotDots = [...el.querySelectorAll<HTMLElement>('.rd')];
  const toast = q('[data-testid="no-fit"]');
  const slots = [...el.querySelectorAll<HTMLElement>('.slot')];
  const nexts = [...el.querySelectorAll<HTMLElement>('.nx')];

  // ---------- клетки ----------
  const cellEls: HTMLDivElement[] = [];
  for (let i = 0; i < SIZE * SIZE; i += 1) {
    const { row, col } = cellOf(i);
    const box = document.createElement('div');
    box.className = 'cell';
    box.dataset['testid'] = `cell-${String(row)}-${String(col)}`;
    box.dataset['kind'] = shown[i];
    box.innerHTML = tileHtml(shown[i] ?? 'grass');
    boardEl.append(box);
    cellEls.push(box);
  }
  const cellEl = (i: number): HTMLDivElement => {
    const found = cellEls[i];
    if (found === undefined) throw new Error(`no cell ${String(i)}`);
    return found;
  };

  /** Переводит клетку в новый вид; возвращает её тайл (или пепел) для анимации. */
  function setKind(i: number, kind: CellKind): HTMLElement | null {
    shown[i] = kind;
    const box = cellEl(i);
    box.dataset['kind'] = kind;
    box.innerHTML = tileHtml(kind);
    return box.firstElementChild as HTMLElement | null;
  }

  // ---------- размеры от экрана ----------
  let cellPx = CELL_MAX;
  function fit(): void {
    const box = stage.getBoundingClientRect();
    const byW = (box.width - 2 * PAD - GAP * (SIZE - 1)) / SIZE;
    const byH = (box.height - 2 * PAD - GAP * (SIZE - 1)) / SIZE;
    cellPx = Math.floor(Math.max(CELL_MIN, Math.min(byW, byH, CELL_MAX)));
    el.style.setProperty('--cell', `${String(cellPx)}px`);
  }
  const observer = new ResizeObserver(fit);
  observer.observe(stage);
  const pitch = (): number => cellPx + GAP;

  // ---------- состояние на экране ----------
  const locked = (): boolean => popupOpen || busy || state.status !== 'playing';

  function renderStats(): void {
    turnNum.textContent = String(state.turn + 1);
    const alive = houses.filter((i) => state.cells[i] === 'house').length;
    housesNum.textContent = `${String(alive)}/${String(houses.length)}`;
    housesStat.classList.toggle('alarm', alive < houses.length);
    rotNum.textContent = String(state.rotationsLeft);
    rotStat.classList.toggle('out', state.rotationsLeft === 0);
    el.classList.toggle('no-rotations', state.rotationsLeft === 0);
    el.dataset['rotationsLeft'] = String(state.rotationsLeft);
    rotDots.forEach((dot, i) => dot.classList.toggle('spent', i >= state.rotationsLeft));
    el.dataset['status'] = state.status;
    el.dataset['turn'] = String(state.turn);
    el.toggleAttribute('data-busy', busy);
  }

  /** Точки превью (§7): куда огонь шагнёт после постановки; с призраком — с учётом его клеток. */
  function renderDots(): void {
    let dots = new Set<number>();
    if (state.status === 'playing' && !busy) {
      if (drag?.valid === true && drag.at !== null) {
        const hypo = [...state.cells];
        for (const i of drag.at) hypo[i] = 'wall';
        dots = nextBurn(hypo);
      } else dots = nextBurn(state.cells);
    }
    cellEls.forEach((box, i) => box.classList.toggle('dot', dots.has(i)));
  }

  function renderGhost(): void {
    const ghost = new Set(drag?.anchor ? ghostCells() : []);
    const bad = drag?.valid !== true;
    cellEls.forEach((box, i) => {
      box.classList.toggle('ghost', ghost.has(i) && !bad);
      box.classList.toggle('ghost-bad', ghost.has(i) && bad);
    });
  }

  /** Клетки призрака, которые попали на поле (частично за краем — только видимые). */
  function ghostCells(): number[] {
    if (drag?.anchor == null) return [];
    const letter = trayOf(level, state.turn)[drag.slot];
    if (letter === undefined) return [];
    const out: number[] = [];
    for (const [dy, dx] of shapeCells(letter, state.rotations[drag.slot] ?? 0)) {
      const r = drag.anchor.row + dy;
      const c = drag.anchor.col + dx;
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) out.push(r * SIZE + c);
    }
    return out;
  }

  function renderTray(): void {
    const letters = trayOf(level, state.turn);
    slots.forEach((slot, i) => {
      const letter = letters[i];
      const empty = letter === undefined || state.status !== 'playing';
      slot.classList.toggle('empty', empty);
      slot.classList.toggle('lifted', drag?.slot === i && drag.moved);
      slot.dataset['letter'] = letter ?? '';
      slot.dataset['rot'] = String(state.rotations[i] ?? 0);
      slot.innerHTML = empty
        ? ''
        : `${shapeHtml(letter, state.rotations[i] ?? 0, 'mini')}<span class="rot rot-left" data-testid="rotate-left-${String(i)}">${glyph.rotate}</span><span class="rot rot-right" data-testid="rotate-right-${String(i)}">${glyph.rotate}</span>`;
    });
    const upcoming = trayOf(level, state.turn + 1);
    nexts.forEach((box, i) => {
      const letter = upcoming[i];
      box.innerHTML = letter === undefined || state.status !== 'playing' ? '' : shapeHtml(letter, 0, 'mini');
    });
  }

  function render(): void {
    renderStats();
    renderDots();
    renderGhost();
  }

  // ---------- перетаскивание (§4) ----------
  function floatEl(slot: number): HTMLElement {
    const letter = trayOf(level, state.turn)[slot] as ShapeLetter;
    const f = document.createElement('div');
    f.className = 'float';
    f.innerHTML = shapeHtml(letter, state.rotations[slot] ?? 0, 'float-shape');
    f.style.setProperty('--cell', `${String(cellPx)}px`);
    // В body, а не в экран: у экрана transform-анимация входа, fixed внутри неё поехал бы.
    document.body.append(f);
    return f;
  }

  /** Точка на экране, куда смотрит призрак: на 1 клетку выше пальца (§4). */
  function updateDrag(x: number, y: number): void {
    if (drag === null) return;
    drag.lastX = x;
    drag.lastY = y;
    const letter = trayOf(level, state.turn)[drag.slot];
    if (letter === undefined) return;
    const rot = state.rotations[drag.slot] ?? 0;
    const tx = x;
    const ty = y - pitch();
    const rect = boardEl.getBoundingClientRect();
    const col = Math.floor((tx - rect.left - PAD + GAP / 2) / pitch());
    const row = Math.floor((ty - rect.top - PAD + GAP / 2) / pitch());
    const onBoard = tx >= rect.left && tx <= rect.right && ty >= rect.top && ty <= rect.bottom && row >= 0 && row < SIZE && col >= 0 && col < SIZE;
    if (onBoard) {
      const [cr, cc] = centerOffset(letter, rot);
      drag.anchor = { row: row - cr, col: col - cc };
      drag.at = cellsAt(letter, rot, drag.anchor);
      drag.valid = fits(state.cells, drag.at);
    } else {
      drag.anchor = null;
      drag.at = null;
      drag.valid = false;
    }
    if (drag.float !== null) {
      const [cr, cc] = centerOffset(letter, rot);
      const fx = tx - (cc * pitch() + cellPx / 2);
      const fy = ty - (cr * pitch() + cellPx / 2);
      drag.float.style.transform = `translate(${String(fx)}px, ${String(fy)}px)`;
      drag.float.classList.toggle('hidden', onBoard);
    }
    renderGhost();
    renderDots();
  }

  function flyBack(d: Drag): Promise<void> {
    const f = d.float;
    if (f === null) return Promise.resolve();
    f.classList.remove('hidden');
    const slot = slots[d.slot];
    const to = slot?.getBoundingClientRect();
    const from = f.getBoundingClientRect();
    if (to === undefined) {
      f.remove();
      return Promise.resolve();
    }
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const base = f.style.transform;
    const anim = f.animate(
      [
        { transform: base, opacity: 1 },
        { transform: `${base} translate(${String(dx)}px, ${String(dy)}px) scale(.5)`, opacity: 0.2 },
      ],
      { duration: T.back, easing: 'ease-in', fill: 'forwards' },
    );
    return anim.finished.then(() => f.remove());
  }

  function endDrag(): void {
    drag = null;
    renderTray();
    render();
  }

  slots.forEach((slot, i) => {
    slot.addEventListener('pointerdown', (event) => {
      if (locked() || drag !== null || slot.classList.contains('empty')) return;
      slot.setPointerCapture(event.pointerId);
      const tapDirection: 1 | -1 = (event.target as HTMLElement).closest('.rot-left') ? -1 : 1;
      drag = { slot: i, pointerId: event.pointerId, x0: event.clientX, y0: event.clientY, moved: false, float: null, anchor: null, at: null, valid: false, lastX: event.clientX, lastY: event.clientY, tapDirection };
    });
    slot.addEventListener('pointermove', (event) => {
      if (drag === null || drag.slot !== i || drag.pointerId !== event.pointerId) return;
      if (!drag.moved) {
        if (Math.hypot(event.clientX - drag.x0, event.clientY - drag.y0) <= DRAG_THRESHOLD) return;
        drag.moved = true;
        drag.float = floatEl(i);
        slot.classList.add('lifted');
        vibrate(8);
      }
      updateDrag(event.clientX, event.clientY);
    });
    const finish = (event: PointerEvent, cancelled: boolean): void => {
      if (drag === null || drag.slot !== i || drag.pointerId !== event.pointerId) return;
      const d = drag;
      if (!d.moved) {
        drag = null;
        if (!cancelled) rotate(i, d.tapDirection);
        return;
      }
      if (!cancelled) updateDrag(event.clientX, event.clientY);
      if (!cancelled && d.valid && d.anchor !== null) {
        d.float?.remove();
        void commit(i, d.anchor);
        return;
      }
      if (!cancelled && d.anchor !== null) {
        failedDrops += 1;
        vibrate(15);
      }
      busy = true;
      drag = null;
      render();
      void flyBack(d).then(() => {
        busy = false;
        endDrag();
      });
    };
    slot.addEventListener('pointerup', (event) => finish(event, false));
    slot.addEventListener('pointercancel', (event) => finish(event, true));
  });

  function rotate(slot: number, direction: 1 | -1 = 1): void {
    const next = rotateSlot(level, state, slot, direction);
    if (next === null) {
      // Повороты хода кончились (§4): фигура покачивается, счётчик мигает, ход не тратится.
      if (state.status === 'playing' && state.rotationsLeft === 0) {
        slots[slot]?.querySelector('.mini')?.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
          { duration: T.shake, easing: 'ease-out' },
        );
        rotStat.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: T.shake * 2 });
        vibrate(15);
      }
      return;
    }
    // Отдельный дот гаснет и подпрыгивает счётчик — видно, что потрачен именно этот поворот (§7.2).
    const spentDot = rotDots[ROTATIONS_PER_LEVEL - 1 - state.rotationsLeft];
    state = next;
    rotationsThisTurn += 1;
    renderStats();
    renderTray();
    spentDot?.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.4)', opacity: 0 }], { duration: T.rotate, easing: 'ease-in' });
    rotStat.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: T.rotate, easing: 'ease-out' });
    const mini = slots[slot]?.querySelector<HTMLElement>('.mini');
    mini?.animate([{ transform: `rotate(${String(direction * -90)}deg)` }, { transform: 'rotate(0)' }], { duration: T.rotate, easing: 'ease-out' });
  }

  // ---------- ход ----------
  async function commit(slot: number, anchor: Cell): Promise<void> {
    const letter = trayOf(level, state.turn)[slot] as ShapeLetter;
    const rot = state.rotations[slot] ?? 0;
    const before = state;
    const result = place(level, state, slot, anchor);
    if (result === null) {
      endDrag();
      return;
    }
    const preview = nextBurn(before.cells);
    const now = performance.now();
    log({
      type: 'place',
      level: levelNumber,
      attempt,
      turn: before.turn + 1,
      slot,
      letter,
      rot,
      cells: [...result.placed],
      onPreview: result.placed.filter((i) => preview.has(i)).length,
      rotations: rotationsThisTurn,
      failedDrops,
      ms: Math.round(now - turnStartedAt),
    });
    el.querySelector('[data-testid="hint"]')?.classList.add('gone');
    await playTurn(result);
  }

  async function playTurn(result: TurnResult): Promise<void> {
    busy = true;
    drag = null;
    state = result.state;
    // Постановка: фигура из трея исчезает, клетки становятся стеной (§7.2).
    slots.forEach((s) => {
      s.classList.remove('lifted');
      s.innerHTML = '';
      s.classList.add('empty');
    });
    render();
    for (const i of result.placed) {
      setKind(i, 'wall')?.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: T.place, easing: 'ease-out' });
    }
    if (result.placed.length > 0) vibrate(10);
    await wait(T.place);

    if (result.stepped) {
      await wait(T.fireDelay);
      for (const i of result.ashed) setKind(i, 'ash')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.fire, easing: 'ease-out' });
      for (const i of result.ignited) {
        setKind(i, 'fire')?.animate([{ transform: 'scale(.3)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], { duration: T.fire, easing: 'ease-out' });
      }
      for (const i of result.burnedHouses) cellEl(i).classList.add('lost');
      await wait(T.fire);
    }
    // Всё нарисованное совпадает с состоянием.
    state.cells.forEach((k, i) => {
      if (shown[i] !== k) setKind(i, k);
    });

    if (state.status === 'won') {
      busy = false;
      renderStats();
      renderTray();
      await winSequence();
      return;
    }
    if (state.status === 'failed') {
      busy = false;
      render();
      renderTray();
      log({ type: 'level_fail', level: levelNumber, attempt, reason: 'house_burned', turn: state.turn + 1 });
      vibrate([30, 60, 30]);
      await wait(T.failPopup);
      showLose();
      return;
    }

    // Смена хода: фигуры «дальше» въезжают в трей.
    renderTray();
    slots.forEach((s) => s.firstElementChild?.animate([{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: T.tray, easing: 'ease-out' }));
    nexts.forEach((n) => n.firstElementChild?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.next }));
    await wait(T.tray);
    rotationsThisTurn = 0;
    failedDrops = 0;
    turnStartedAt = performance.now();

    // Правило 8: ни одна фигура не помещается — ход пропускается сам.
    if (!anyFits(level, state)) {
      renderStats();
      toast.classList.add('show');
      log({ type: 'skip', level: levelNumber, attempt, turn: state.turn + 1 });
      await wait(T.noFit);
      toast.classList.remove('show');
      const skipped = skipTurn(level, state);
      if (skipped !== null) {
        await playTurn(skipped);
        return;
      }
    }
    busy = false;
    render();
  }

  // ---------- победа: остаток огня гаснет на месте, волна по всей спасённой земле (§7.2) ----------
  async function winSequence(): Promise<void> {
    markPassed(levelNumber);
    const saved = savedCount(state.cells);
    log({ type: 'level_win', level: levelNumber, attempt, turn: state.turn + 1, saved });
    busy = true;
    renderStats();
    cellEls.forEach((box) => box.classList.remove('dot', 'ghost', 'ghost-bad'));
    // Раунд окончен: живой фронт дальше не пойдёт и просто гаснет в пепел на месте.
    // Никакая трава дальше не сгорает — то, что уцелело к победе, уцелело насовсем.
    state.cells.forEach((k, i) => {
      if (k === 'fire') setKind(i, 'ash')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: T.douse, easing: 'ease-out' });
    });
    await wait(T.douse);
    const dist = (i: number): number => {
      const a = cellOf(i);
      return Math.min(...houses.map((h) => Math.abs(cellOf(h).row - a.row) + Math.abs(cellOf(h).col - a.col)));
    };
    let far = 0;
    state.cells.forEach((k, i) => {
      if (k !== 'grass') return;
      const d = dist(i);
      far = Math.max(far, d);
      const glow = document.createElement('div');
      glow.className = 'glow';
      cellEl(i).append(glow);
      glow.animate([{ opacity: 0 }, { opacity: 0.7 }, { opacity: 0 }], { duration: 420, delay: reducedMotion() ? 0 : d * T.wave, easing: 'ease-out', fill: 'forwards' });
    });
    for (const h of houses) cellEl(h).firstElementChild?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: T.bounce, easing: 'ease-out' });
    vibrate([20, 40, 20]);
    await wait(far * T.wave + 420 + T.winPopup);
    busy = false;
    renderStats();
    showWin(saved);
  }

  // ---------- попапы ----------
  const replay = (): void => go(`#/level/${String(levelNumber)}`);
  const toLevels = (): void => go('#/levels');

  function popup(content: string, actions: Parameters<typeof openPopup>[2], testId: string, onClose?: () => void): void {
    popupOpen = true;
    render();
    openPopup(
      el,
      content,
      actions.map((action) => ({
        ...action,
        run: () => {
          popupOpen = false;
          onClose?.();
          render();
          action.run();
        },
      })),
      testId,
    );
  }

  function showWin(saved: number): void {
    const sub = `<div class="saved" data-testid="saved"><b>${String(saved)}</b><span>${plural(saved, 'клетка спасена', 'клетки спасены', 'клеток спасено')} от огня</span></div><p class="sub">Дома в безопасности на ходу ${String(state.turn + 1)}</p>`;
    if (levelNumber === LEVEL_COUNT) {
      popup(
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2>${sub}`,
        [
          { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
          { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
        ],
        'popup-final',
      );
      return;
    }
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Дома спасены!</h2>${sub}`,
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
      `<div class="badge-big badge-lose">${icon.cross}</div><h2>Дом сгорел</h2><p class="sub">Огонь добрался до дома</p>`,
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

  renderTray();
  render();
  fit();
  log({ type: 'level_start', level: levelNumber, attempt });
  if (levelNumber === 1 && !loadProgress().howToPlaySeen) {
    popupOpen = true;
    render();
    setTimeout(showHowToPlay, 350);
  }
  return {
    el,
    destroy: () => {
      observer.disconnect();
      drag?.float?.remove();
    },
  };
}

const plural = (n: number, one: string, few: string, many: string): string =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;
