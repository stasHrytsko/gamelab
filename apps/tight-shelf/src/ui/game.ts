import { createState, current, legalNow, tapCell } from '../engine/shelfEngine.ts';
import { PREVIEW, SIZE, type GameState, type Move } from '../engine/types.ts';
import { getLevel, LEVEL_COUNT } from '../levels/levels.ts';
import { reducedMotion, vibrate, wait } from './feedback.ts';
import { icon } from './icons.ts';
import { log } from './log.ts';
import { ensureDefs, pieceSvg, ruleCell } from './pieces.ts';
import { openPopup } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, markPassed } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

// Длительности §7.
const FLY_MS = 180;
const HOP_MS = 120;
const POP_MS = 260;
const SHIFT_MS = 200;

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="demo-row">${pieceSvg('Bo')}${pieceSvg('Bs')}${pieceSvg('Bt')}<i class="demo-bar"></i></div>
  </div>
  <ol class="rules">
    <li><b>1</b><span>Ставь фигуру в клетку, где совпадает цвет или форма. Клетка с точкой примет любую фигуру.</span></li>
    <li><b>2</b><span>Три в ряд — по горизонтали, вертикали или диагонали — с одним цветом или одной формой исчезают.</span></li>
    <li><b>3</b><span>Вверху видно текущую фигуру и три следующих. Береги клетки для них.</span></li>
    <li><b>4</b><span>Поставь все фигуры. Если фигуре некуда встать — попытка проиграна.</span></li>
  </ol>`;

const piecesLeft = (n: number): string => (n % 10 === 1 && n % 100 !== 11 ? 'фигура' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'фигуры' : 'фигур');

export function gameScreen(levelNumber: number, go: Go): Screen {
  ensureDefs();
  const level = getLevel(levelNumber);
  let state: GameState = createState(level);
  let popupOpen = false;
  let busy = false;

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
    <div class="queue" data-testid="queue">
      <div class="now"><div class="slot now-slot" data-testid="now"></div><div class="label">Сейчас</div></div>
      <div class="sep"></div>
      <div class="next"><div class="row" data-testid="next"></div><div class="label" data-testid="left"></div></div>
    </div>
    <div class="stage"><div class="board" data-testid="board"></div></div>
    <div class="hint">Три в ряд с общим <b>цветом</b> или общей <b>формой</b> исчезают</div>`;
  const q = <T extends HTMLElement>(sel: string): T => {
    const found = el.querySelector<T>(sel);
    if (found === null) throw new Error(`game markup: ${sel}`);
    return found;
  };
  const stage = q('.stage');
  const boardEl = q('.board');
  const nowEl = q('.now-slot');
  const nextEl = q('.next .row');
  const leftEl = q('[data-testid="left"]');

  // ---------- поле ----------
  const cellEls: HTMLElement[] = state.rules.map((rule, i) => {
    const d = document.createElement('div');
    const { cls, inner } = ruleCell(rule);
    d.className = `cell ${cls}`;
    d.dataset['i'] = String(i);
    d.dataset['testid'] = `cell-${String(i)}`;
    d.dataset['rule'] = rule;
    d.innerHTML = inner;
    boardEl.append(d);
    return d;
  });
  const pieceIn = (i: number): SVGElement | null => cellEls[i]?.querySelector<SVGElement>('.piece') ?? null;

  const locked = (): boolean => popupOpen || busy || state.status !== 'playing';

  function renderQueue(): void {
    const piece = current(state);
    nowEl.innerHTML = piece === null ? '' : pieceSvg(piece);
    const next = state.queue.slice(state.turn + 1, state.turn + 1 + PREVIEW);
    nextEl.innerHTML = Array.from({ length: PREVIEW }, (_, k) => `<div class="slot">${next[k] === undefined ? '' : pieceSvg(next[k])}</div>`).join('');
    const left = Math.max(0, state.queue.length - state.turn);
    leftEl.textContent = left === 0 ? 'Все фигуры на поле' : `Дальше · ещё ${String(left)} ${piecesLeft(left)}`;
  }

  function render(): void {
    // Подсказок «куда можно» нет: игрок сам сверяет фигуру с правилом клетки (§7, решение автора 2026-09-28).
    cellEls.forEach((d, i) => {
      const occupied = state.board[i] !== null;
      if (!occupied) pieceIn(i)?.remove();
      else if (pieceIn(i) === null) d.insertAdjacentHTML('beforeend', pieceSvg(state.board[i] ?? 'Bo'));
    });
    renderQueue();
    el.dataset['status'] = state.status;
    el.dataset['turn'] = String(state.turn);
    el.toggleAttribute('data-busy', locked());
  }

  // ---------- размеры от экрана (§7.1) ----------
  function fit(): void {
    const small = innerHeight < 620;
    el.style.setProperty('--now', small ? '48px' : '64px');
    el.style.setProperty('--nxt', small ? '34px' : '44px');
    const box = stage.getBoundingClientRect();
    const gap = 8;
    const pad = 12;
    const cell = Math.floor(Math.min((box.width - 2 * pad - gap * (SIZE - 1)) / SIZE, (box.height - 2 * pad - gap * (SIZE - 1)) / SIZE));
    el.style.setProperty('--cell', `${String(Math.max(56, Math.min(cell, 88)))}px`);
  }
  const observer = new ResizeObserver(fit);
  observer.observe(stage);

  // ---------- анимации хода ----------
  const easeOut = 'cubic-bezier(.2,.8,.2,1)';

  /** Фигура перелетает из «Сейчас» в клетку. */
  async function fly(cell: number): Promise<void> {
    const from = nowEl.querySelector('.piece')?.getBoundingClientRect();
    const target = cellEls[cell];
    if (from === undefined || target === undefined || reducedMotion()) return;
    const to = target.getBoundingClientRect();
    const size = to.width * 0.74;
    const ghost = document.createElement('div');
    ghost.className = 'fly';
    ghost.innerHTML = nowEl.innerHTML;
    ghost.style.width = `${String(from.width)}px`;
    ghost.style.height = `${String(from.height)}px`;
    ghost.style.left = `${String(from.left)}px`;
    ghost.style.top = `${String(from.top)}px`;
    el.append(ghost);
    nowEl.style.visibility = 'hidden';
    const dx = to.left + (to.width - size) / 2 - from.left;
    const dy = to.top + (to.height - size) / 2 - from.top;
    const k = size / from.width;
    const anim = ghost.animate(
      [{ transform: 'none' }, { transform: `translate(${String(dx)}px, ${String(dy)}px) scale(${String(k)})` }],
      { duration: FLY_MS, easing: easeOut, fill: 'forwards' },
    );
    await anim.finished;
    // Ghost уходит с экрана — cancel() не зовём, он держит последний кадр до remove() (apps/CLAUDE.md §5).
    ghost.remove();
    nowEl.style.visibility = '';
  }

  /** Полоса поверх собранной линии: от центра первой клетки до центра последней. */
  function drawBar(cells: readonly number[]): HTMLElement | null {
    const a = cellEls[cells[0] ?? -1];
    const b = cellEls[cells[cells.length - 1] ?? -1];
    if (a === undefined || b === undefined) return null;
    const ax = a.offsetLeft + a.offsetWidth / 2;
    const ay = a.offsetTop + a.offsetHeight / 2;
    const bx = b.offsetLeft + b.offsetWidth / 2;
    const by = b.offsetTop + b.offsetHeight / 2;
    const len = Math.hypot(bx - ax, by - ay);
    const bar = document.createElement('i');
    bar.className = 'line-bar';
    bar.style.left = `${String(ax)}px`;
    bar.style.top = `${String(ay)}px`;
    bar.style.width = `${String(len)}px`;
    bar.style.transform = `rotate(${String(Math.atan2(by - ay, bx - ax))}rad)`;
    boardEl.append(bar);
    return bar;
  }

  /** Payoff §7: полоса по линии, фигуры вспыхивают и сжимаются. Двойная — сначала подпрыгивают. */
  async function clearLines(move: Move): Promise<void> {
    const bars = move.lineCells.map(drawBar).filter((bar): bar is HTMLElement => bar !== null);
    const pieces = move.cleared.map(pieceIn).filter((p): p is SVGElement => p !== null);
    if (move.lines >= 2) {
      boardEl.classList.add('double');
      await Promise.all(pieces.map((p) => p.animate([{ transform: 'none' }, { transform: 'translateY(-14%) scale(1.08)' }, { transform: 'none' }], { duration: HOP_MS, easing: 'ease-out' }).finished));
    }
    const pops = pieces.map((p) =>
      p.animate([{ transform: 'none', filter: 'brightness(1)' }, { transform: 'scale(1.12)', filter: 'brightness(1.5)', offset: 0.3 }, { transform: 'scale(0)', filter: 'brightness(1.5)' }], { duration: POP_MS, easing: 'ease-in', fill: 'forwards' }).finished,
    );
    const fades = bars.map((bar) => bar.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: POP_MS + 80, fill: 'forwards' }).finished);
    await Promise.all([...pops, ...fades]);
    bars.forEach((bar) => bar.remove());
    boardEl.classList.remove('double');
  }

  /** Очередь сдвигается влево на одну фигуру. */
  async function shiftQueue(): Promise<void> {
    renderQueue();
    if (reducedMotion()) return;
    const step = (nextEl.querySelector('.slot')?.getBoundingClientRect().width ?? 44) + 16;
    const anims = [...nextEl.querySelectorAll<HTMLElement>('.slot')].map((slot) =>
      slot.animate([{ transform: `translateX(${String(step)}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: SHIFT_MS, easing: easeOut }).finished,
    );
    const now = nowEl.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: SHIFT_MS, easing: easeOut }).finished;
    await Promise.all([...anims, now]);
  }

  function shake(target: Element): void {
    target.classList.remove('shake-x');
    void (target as HTMLElement).offsetWidth;
    target.classList.add('shake-x');
  }

  // ---------- ввод: только тап по клетке (§4) ----------
  boardEl.addEventListener('click', (event) => {
    const d = (event.target as HTMLElement).closest<HTMLElement>('.cell');
    if (d === null || locked()) return;
    const cell = Number(d.dataset['i']);
    const before = state;
    const outcome = tapCell(state, cell);
    if (outcome === null) {
      // Занята или правило не подходит — ход не тратится.
      shake(d);
      vibrate(20);
      return;
    }
    log({ type: 'place', level: levelNumber, turn: before.turn, piece: outcome.move.piece, cell, legal: legalNow(before).length, lines: outcome.move.lines });
    void commit(outcome.state, outcome.move);
  });

  async function commit(next: GameState, move: Move): Promise<void> {
    busy = true;
    el.toggleAttribute('data-busy', true);
    vibrate(10);
    await fly(move.cell);
    // Фигура в клетке, линии ещё на поле — для анимации очистки.
    const target = cellEls[move.cell];
    if (target !== undefined && pieceIn(move.cell) === null) target.insertAdjacentHTML('beforeend', pieceSvg(move.piece, 'land'));
    if (move.lines > 0) {
      vibrate(move.lines >= 2 ? [20, 30, 20] : 16);
      await clearLines(move);
    }
    state = next;
    render();
    if (state.status === 'playing' || state.status === 'failed') await shiftQueue();

    if (state.status === 'won') {
      markPassed(levelNumber);
      log({ type: 'level_win', level: levelNumber });
      boardEl.querySelectorAll<HTMLElement>('.cell').forEach((d, i) => {
        d.style.animationDelay = `${String((Math.floor(i / SIZE) + (i % SIZE)) * 40)}ms`;
        d.classList.add('hop');
      });
      vibrate([20, 40, 20]);
      await wait(500);
      busy = false;
      showWin();
      return;
    }
    if (state.status === 'failed') {
      log({ type: 'level_fail', level: levelNumber, reason: 'no_moves', turn: state.turn });
      shake(nowEl);
      cellEls.forEach((d, i) => d.classList.toggle('dead', state.board[i] === null));
      vibrate([30, 60, 30]);
      await wait(900);
      busy = false;
      showLose();
      return;
    }
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
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2><p class="sub">Все фигуры на поле</p>`,
        [
          { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
          { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
        ],
        'popup-final',
      );
      return;
    }
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень пройден!</h2><p class="sub">Все фигуры на поле</p>`,
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
      `<div class="badge-big badge-lose">${icon.cross}</div><h2>Фигуре некуда встать</h2><p class="sub">Для этой фигуры не осталось подходящей клетки</p>`,
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
