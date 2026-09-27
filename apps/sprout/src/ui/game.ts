import { createState, freeNeighbours, kindAt, nearestWaterDistance, reject, step as engineStep, tipOf } from '../engine/sproutEngine.ts';
import type { Cell, FailReason, GameState } from '../engine/types.ts';
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

// Тайминги — §7.2 спеки (решение автора 2026-09-26, поправляются на показе).
const T = {
  grow: 180, // рост на клетку
  sip: 200, // капля сжимается в метку
  fly: 400, // «+X» летит к счётчику
  flyEase: 'cubic-bezier(.3,0,.2,1)',
  bump: 200, // счётчик подпрыгивает на прибавке
  shake: 160,
  pulse: 300, // кончик пульсирует на тап вдали
  bloom: 600, // росток на Б
  wave: 40, // шаг волны победы по клеткам корня
  winPopup: 500,
  failPopup: 900,
} as const;

// Геометрия поля (§7.1): клетка 44–64 px, зазор 5 px.
const GAP = 5;
const PAD = 8;
const CELL_MIN = 44;
const CELL_MAX = 64;

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="demo-cell root">${glyph.seed}</div>
    <div class="demo-stem"></div>
    <div class="demo-cell"><div class="tile water">${glyph.drop}<b>+3</b></div></div>
    ${icon.arrow.replace('class=""', 'class="arrow-hint"')}
    <div class="demo-cell"><div class="tile goal">${glyph.rays}${glyph.sprout}</div></div>
  </div>
  <ol class="rules">
    <li><b>1</b><span>Тапни клетку рядом с кончиком корня — корень вырастет туда.</span></li>
    <li><b>2</b><span>Каждый шаг стоит 1 ход. Капля воды даёт столько ходов, сколько на ней написано.</span></li>
    <li><b>3</b><span>В камень и туда, где корень уже вырос, расти нельзя.</span></li>
    <li><b>4</b><span>Доведи корень до жёлтой клетки с ростком, пока не кончились ходы.</span></li>
  </ol>`;

const key = (c: Cell): string => `${String(c.row)}-${String(c.col)}`;

export function gameScreen(levelNumber: number, go: Go): Screen {
  const level = getLevel(levelNumber);
  let state: GameState = createState(level);
  let shownMoves = state.moves;
  let busy = false;
  let popupOpen = false;
  const attempt = nextAttempt(levelNumber);
  let lastStepAt = performance.now();

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
    <div class="moves-card" data-testid="moves"><small>Ходы</small><b>${String(state.moves)}</b></div>
    <div class="stage"><div class="board" data-testid="board"><div class="stems"></div></div></div>
    ${levelNumber === 1 ? `<div class="hint-card" data-testid="hint">${glyph.finger}<span>Нажми на соседнюю клетку,<br>чтобы вырастить корень</span></div>` : ''}`;

  const q = <E extends HTMLElement>(sel: string): E => {
    const found = el.querySelector<E>(sel);
    if (found === null) throw new Error(`game markup: ${sel}`);
    return found;
  };
  const stage = q('.stage');
  const boardEl = q('.board');
  const stemsEl = q('.stems');
  const movesEl = q('[data-testid="moves"]');
  const movesNum = q('[data-testid="moves"] b');

  // ---------- клетки ----------
  const cells = new Map<string, HTMLDivElement>();
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = { row, col };
      const box = document.createElement('div');
      const kind = kindAt(level, cell);
      box.className = 'cell';
      box.dataset['testid'] = `cell-${key(cell)}`;
      box.dataset['kind'] = kind;
      box.dataset['row'] = String(row);
      box.dataset['col'] = String(col);
      const ch = level.rows[row]?.[col] ?? '.';
      if (kind === 'stone') box.innerHTML = `<div class="tile stone">${glyph.rock}</div>`;
      else if (kind === 'water') box.innerHTML = `<div class="tile water">${glyph.drop}<b>+${ch}</b></div>`;
      else if (kind === 'goal') box.innerHTML = `<div class="tile goal">${glyph.rays}${glyph.sprout}</div>`;
      else if (kind === 'start') {
        box.classList.add('root');
        box.innerHTML = `<div class="start-mark">${glyph.seed}</div>`;
      }
      boardEl.append(box);
      cells.set(key(cell), box);
    }
  }
  const cellEl = (c: Cell): HTMLDivElement => {
    const found = cells.get(key(c));
    if (found === undefined) throw new Error(`no cell ${key(c)}`);
    return found;
  };

  // Листок на кончике — отдельный слой, переезжает с каждым шагом.
  const leaf = document.createElement('div');
  leaf.className = 'leaf';
  leaf.innerHTML = glyph.leaf;
  boardEl.append(leaf);

  // ---------- размеры от экрана ----------
  let cellPx = CELL_MAX;
  function fit(): void {
    const box = stage.getBoundingClientRect();
    const byW = (box.width - 2 * PAD - GAP * (SIZE - 1)) / SIZE;
    const byH = (box.height - 2 * PAD - GAP * (SIZE - 1)) / SIZE;
    cellPx = Math.floor(Math.max(CELL_MIN, Math.min(byW, byH, CELL_MAX)));
    el.style.setProperty('--cell', `${String(cellPx)}px`);
    layoutStems();
    placeLeaf(tipOf(state));
  }
  const observer = new ResizeObserver(fit);
  observer.observe(stage);

  const center = (c: Cell): readonly [number, number] => [PAD + c.col * (cellPx + GAP) + cellPx / 2, PAD + c.row * (cellPx + GAP) + cellPx / 2];
  const stemWidth = (): number => Math.max(6, Math.round(cellPx * 0.14));

  function stemRect(a: Cell, b: Cell): { left: number; top: number; width: number; height: number } {
    const [x1, y1] = center(a);
    const [x2, y2] = center(b);
    const w = stemWidth();
    return { left: Math.min(x1, x2) - w / 2, top: Math.min(y1, y2) - w / 2, width: Math.abs(x2 - x1) + w, height: Math.abs(y2 - y1) + w };
  }

  function layoutStems(): void {
    const segs = [...stemsEl.children] as HTMLElement[];
    segs.forEach((seg, i) => {
      const a = state.path[i];
      const b = state.path[i + 1];
      if (a === undefined || b === undefined) return;
      Object.assign(seg.style, px(stemRect(a, b)));
    });
  }
  const px = (r: Record<string, number>): Record<string, string> => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, `${String(v)}px`]));

  function leafTransform(c: Cell): string {
    const [x, y] = center(c);
    return `translate(${String(x)}px, ${String(y)}px)`;
  }
  function placeLeaf(c: Cell): void {
    leaf.style.transform = leafTransform(c);
  }

  // ---------- состояние на экране ----------
  function locked(): boolean {
    return popupOpen || busy || state.status !== 'playing';
  }

  function render(): void {
    movesNum.textContent = String(shownMoves);
    movesEl.classList.toggle('low', state.status === 'playing' && !busy && state.moves <= 2);
    el.dataset['status'] = state.status;
    el.dataset['moves'] = String(state.moves);
    el.dataset['steps'] = String(state.path.length - 1);
    el.toggleAttribute('data-busy', busy);
    const next = state.status === 'playing' && !busy ? freeNeighbours(level, state).map(key) : [];
    for (const [k, box] of cells) box.classList.toggle('next', next.includes(k));
  }

  // ---------- отклик на недопустимый тап (§4, §7.2) ----------
  function shake(target: HTMLElement): void {
    target.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
      { duration: T.shake, easing: 'ease-out' },
    );
    vibrate(15);
  }
  function pulseTip(): void {
    const base = leafTransform(tipOf(state));
    leaf.animate([{ transform: `${base} scale(1)` }, { transform: `${base} scale(1.12)` }, { transform: `${base} scale(1)` }], { duration: T.pulse, easing: 'ease-in-out' });
    cellEl(tipOf(state)).animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.12)' }, { filter: 'brightness(1)' }], { duration: T.pulse });
  }

  // ---------- шаг ----------
  function growTo(from: Cell, to: Cell): Promise<void> {
    const seg = document.createElement('div');
    seg.className = 'stem';
    Object.assign(seg.style, px(stemRect(from, to)));
    const horizontal = from.row === to.row;
    const forward = horizontal ? to.col > from.col : to.row > from.row;
    seg.style.transformOrigin = horizontal ? (forward ? 'left center' : 'right center') : forward ? 'center top' : 'center bottom';
    stemsEl.append(seg);
    const target = cellEl(to);
    target.classList.add('root');
    // WAAPI с fill:'forwards': после конца ставим конечный инлайн-стиль и
    // снимаем анимацию, иначе на кадр виден откат (apps/CLAUDE.md §5).
    const scale = horizontal ? 'scaleX' : 'scaleY';
    const stemAnim = seg.animate([{ transform: `${scale}(0)` }, { transform: `${scale}(1)` }], { duration: T.grow, easing: 'ease-out', fill: 'forwards' });
    const leafAnim = leaf.animate([{ transform: leafTransform(from) }, { transform: leafTransform(to) }], { duration: T.grow, easing: 'ease-out', fill: 'forwards' });
    return Promise.all([stemAnim.finished, leafAnim.finished]).then(() => {
      placeLeaf(to);
      leafAnim.cancel();
      stemAnim.cancel();
    });
  }

  async function sip(cell: Cell, bonus: number): Promise<void> {
    const box = cellEl(cell);
    const tile = box.querySelector<HTMLElement>('.tile.water');
    const shrink = tile?.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.35) translate(60%, -60%)', opacity: 0 }], { duration: T.sip, easing: 'ease-in', fill: 'forwards' });

    const fly = document.createElement('div');
    fly.className = 'fly';
    fly.textContent = `+${String(bonus)}`;
    el.append(fly);
    const host = el.getBoundingClientRect();
    const from = box.getBoundingClientRect();
    const to = movesNum.getBoundingClientRect();
    const x0 = from.left + from.width / 2 - host.left;
    const y0 = from.top + from.height / 2 - host.top;
    const x1 = to.left + to.width / 2 - host.left;
    const y1 = to.top + to.height / 2 - host.top;
    const flight = fly.animate(
      [
        { transform: `translate(${String(x0)}px, ${String(y0)}px) translate(-50%, -50%) scale(1)`, opacity: 1 },
        { transform: `translate(${String(x1)}px, ${String(y1)}px) translate(-50%, -50%) scale(.8)`, opacity: 0.9 },
      ],
      { duration: reducedMotion() ? 1 : T.fly, easing: T.flyEase, fill: 'forwards' },
    );
    await shrink?.finished;
    tile?.remove();
    box.insertAdjacentHTML('beforeend', `<div class="sip-mark">${glyph.drop}</div>`);
    await flight.finished;
    fly.remove();
    shownMoves = state.moves;
    render();
    movesEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: T.bump, easing: 'ease-out' });
  }

  async function tapCell(cell: Cell): Promise<void> {
    if (locked()) return;
    const why = reject(level, state, cell);
    if (why === 'stone') {
      const tile = cellEl(cell).querySelector<HTMLElement>('.tile');
      if (tile !== null) shake(tile);
      return;
    }
    if (why === 'root') {
      shake(cellEl(tipOf(state)));
      return;
    }
    if (why !== null) {
      pulseTip();
      return;
    }
    const nearest = nearestWaterDistance(level, state);
    const result = engineStep(level, state, cell);
    if (result === null) return;
    const from = tipOf(state);
    busy = true;
    // Счётчик: −1 в момент роста, +X в момент прилёта капли (§7.2).
    shownMoves = state.moves - 1;
    state = result.state;
    render();
    el.querySelector('[data-testid="hint"]')?.classList.add('gone');

    const now = performance.now();
    log({
      type: 'step',
      level: levelNumber,
      attempt,
      step: state.path.length - 1,
      row: cell.row,
      col: cell.col,
      bonus: result.bonus,
      moves: state.moves,
      nearestWater: nearest,
      ms: Math.round(now - lastStepAt),
    });
    lastStepAt = now;
    vibrate(8);

    await growTo(from, cell);
    if (result.bonus > 0) await sip(cell, result.bonus);
    busy = false;
    shownMoves = state.moves;
    render();

    if (state.status === 'won') {
      markPassed(levelNumber);
      log({ type: 'level_win', level: levelNumber, attempt, steps: state.path.length - 1 });
      await bloom();
      showWin();
      return;
    }
    if (state.status === 'failed' && state.failReason !== null) {
      const reason = state.failReason;
      log({ type: 'level_fail', level: levelNumber, attempt, reason });
      if (reason === 'moves_exhausted') movesEl.classList.add('alarm');
      else cellEl(tipOf(state)).classList.add('dead-end');
      vibrate([30, 60, 30]);
      await wait(T.failPopup);
      showLose(reason);
    }
  }

  // ---------- победа: росток на Б и волна по корню (§7.2) ----------
  async function bloom(): Promise<void> {
    const goal = cellEl(tipOf(state));
    const sprout = document.createElement('div');
    sprout.className = 'bloom';
    sprout.innerHTML = glyph.sprout;
    goal.append(sprout);
    sprout.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.2)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: T.bloom, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' });
    // Листок уступает место ростку; сама Б в волне не участвует: filter на
    // клетке создал бы свой контекст наложения, и стебель лёг бы поверх тайла.
    leaf.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    state.path.slice(0, -1).forEach((c, i) => {
      cellEl(c).animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.3)' }, { filter: 'brightness(1)' }], { duration: 360, delay: i * T.wave, easing: 'ease-out' });
    });
    vibrate([20, 40, 20]);
    await wait(Math.max(T.bloom, state.path.length * T.wave + 360) + T.winPopup);
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

  function showWin(): void {
    if (levelNumber === LEVEL_COUNT) {
      popup(
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2><p class="sub">Росток пробился к свету</p>`,
        [
          { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
          { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
        ],
        'popup-final',
      );
      return;
    }
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень пройден!</h2><p class="sub">Росток пробился к свету</p>`,
      [
        { id: 'next', html: `Следующий уровень ${icon.arrow}`, className: 'btn-success', run: () => go(`#/level/${String(levelNumber + 1)}`) },
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-win',
    );
  }

  function showLose(reason: FailReason): void {
    const title = reason === 'moves_exhausted' ? 'Ходы закончились' : 'Корню некуда расти';
    const sub = reason === 'moves_exhausted' ? 'Корень не успел дорасти до ростка' : 'Вокруг кончика камни и сам корень';
    popup(
      `<div class="badge-big badge-lose">${icon.cross}</div><h2>${title}</h2><p class="sub">${sub}</p>`,
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

  boardEl.addEventListener('pointerdown', (event) => {
    const box = (event.target as HTMLElement).closest<HTMLElement>('.cell');
    if (box === null) {
      if (!locked()) pulseTip();
      return;
    }
    void tapCell({ row: Number(box.dataset['row']), col: Number(box.dataset['col']) });
  });
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
  fit();
  log({ type: 'level_start', level: levelNumber, attempt });
  if (levelNumber === 1 && !loadProgress().howToPlaySeen) {
    popupOpen = true;
    render();
    setTimeout(showHowToPlay, 350);
  }
  return { el, destroy: () => observer.disconnect() };
}
