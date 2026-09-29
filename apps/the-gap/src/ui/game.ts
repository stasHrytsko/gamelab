import { colorProgress, createState, planReturn, planSwipe, swipeDir, swipe as engineSwipe, tapFlask as engineTap } from '../engine/gapEngine.ts';
import type { Action, Color, Dir, GameState, Move, Outcome } from '../engine/types.ts';
import { DELTA } from '../engine/gapEngine.ts';
import { getLevel, LEVEL_COUNT } from '../levels/levels.ts';
import { COLOR, glyph, icon, star } from './icons.ts';
import { vibrate, wait } from './feedback.ts';
import { log } from './log.ts';
import { openPopup } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, markPassed, recordResult } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

// Тайминги хода — §7 спеки: скольжение 80 мс на клетку, но не дольше 320 мс
// на ход; въезд в колбу и выезд из неё по 220 мс; покачивание 160 мс.
const T = { cell: 80, maxSlide: 320, dive: 220, shake: 160, deny: 300, demoPause: 850 } as const;
const GAP = 6;
const PAD = 10;
/** Поле вокруг доски под бейджи выходов, px. */
const MARGIN = 20;

const attempts = new Map<number, number>();

const tile = (color: Color): string => `<svg viewBox="0 0 24 24" aria-hidden="true">${glyph[color]}</svg>`;

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="demo-block" style="--c:${COLOR[1]}">${tile(1)}</div>
    ${icon.arrow.replace('class=""', 'class="arrow-hint"')}
    <div class="demo-flask"><div class="demo-block" style="--c:${COLOR[1]}">${tile(1)}</div></div>
  </div>
  <ol class="rules">
    <li><b>1</b><span>Свайпни квадрат — он скользит до упора.</span></li>
    <li><b>2</b><span>Доехал до выхода с цифрой — упал в колбу с той же цифрой.</span></li>
    <li><b>3</b><span>Тап по колбе достаёт верхний квадрат на поле, если клетка у выхода свободна.</span></li>
    <li><b>4</b><span>Собери каждый цвет в одной колбе, счётчики над полем показывают прогресс. Чем меньше ходов, тем больше звёзд.</span></li>
  </ol>`;

interface Sprite {
  readonly el: HTMLDivElement;
  color: Color;
  x: number;
  y: number;
}

export function gameScreen(levelNumber: number, go: Go, opts: { demo?: boolean } = {}): Screen {
  const demo = opts.demo === true;
  const level = getLevel(levelNumber);
  let state: GameState = createState(level);
  let busy = false;
  let popupOpen = false;
  let lastMoveAt = performance.now();
  let returns = 0;
  let onPath = true;
  let pathIndex = 0;
  /** Номер хода, на котором путь игрока впервые разошёлся с сохранённым образцом (§7). */
  let divergedAt: number | null = null;
  const attempt = (attempts.get(levelNumber) ?? 0) + 1;
  attempts.set(levelNumber, attempt);

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
    <div class="meta">
      <div class="moves-pill" data-testid="moves">Ходы <b>0</b><span>/ ${String(level.limit)}</span></div>
      <div class="moves-pill stars-pill" data-testid="stars-live" title="Звёзды за текущий счёт">${[1, 2, 3].map((i) => `<span class="st on" data-star="${String(i)}">${star}</span>`).join('')}<span class="lim">≤ ${String(level.stars3)}</span></div>
    </div>
    <div class="budget" data-testid="budget" aria-hidden="true"><i class="fill"></i><b class="tick" style="left:${String((level.stars3 / level.limit) * 100)}%"></b><b class="tick" style="left:${String((level.stars2 / level.limit) * 100)}%"></b></div>
    <div class="goals" data-testid="goals"></div>
    ${demo ? '<div class="demo-banner" data-testid="demo-banner">Образец решения</div>' : ''}
    <div class="stage"><div class="field" data-testid="field"><div class="board" data-testid="board"></div></div></div>
    <div class="flasks" data-testid="flasks"></div>
    ${level.tutorial ? '<div class="hint-card" data-testid="hint">Свайп — квадрат скользит до упора.<br><b>Тап по колбе — верхний квадрат выходит на поле.</b></div>' : ''}`;

  const q = <E extends HTMLElement>(sel: string): E => {
    const found = el.querySelector<E>(sel);
    if (found === null) throw new Error(`game markup: ${sel}`);
    return found;
  };
  const stage = q('.stage');
  const fieldEl = q('.field');
  const boardEl = q('.board');
  const flasksEl = q('.flasks');
  const movesEl = q('[data-testid="moves"]');
  const budgetFill = q('.budget .fill');
  const goalsEl = q('.goals');
  const starEls = [...el.querySelectorAll<HTMLElement>('.stars-pill .st')];
  const demoBanner = el.querySelector<HTMLElement>('.demo-banner');

  // ---------- доска: клетки, стены, выходы ----------
  for (let i = 0; i < level.w * level.h; i += 1) {
    const cell = document.createElement('div');
    cell.className = `cell${level.field[i] === -1 ? ' wall' : ''}`;
    cell.dataset['cell'] = String(i);
    boardEl.append(cell);
  }
  boardEl.style.gridTemplateColumns = `repeat(${String(level.w)}, var(--cell))`;
  boardEl.style.gridTemplateRows = `repeat(${String(level.h)}, var(--cell))`;

  const exitMarks: { badge: HTMLElement; gap: HTMLElement; n: number }[] = [];
  level.exits.forEach((exit, i) => {
    const badge = document.createElement('div');
    badge.className = 'exit';
    badge.textContent = String(i + 1);
    badge.dataset['testid'] = `exit-${String(i + 1)}`;
    const gap = document.createElement('div');
    gap.className = `gapmark ${exit.dx !== 0 ? 'v' : 'h'}`;
    fieldEl.append(gap, badge);
    exitMarks.push({ badge, gap, n: i + 1 });
  });

  // ---------- квадраты на поле ----------
  const sprites = new Map<string, Sprite>();
  const keyOf = (x: number, y: number): string => `${String(x)},${String(y)}`;
  function makeSprite(color: Color, x: number, y: number): Sprite {
    const box = document.createElement('div');
    box.className = 'sq';
    box.dataset['testid'] = `sq-${String(x)}-${String(y)}`;
    box.style.setProperty('--c', COLOR[color]);
    box.innerHTML = tile(color);
    const sprite: Sprite = { el: box, color, x, y };
    attach(sprite);
    boardEl.append(box);
    sprites.set(keyOf(x, y), sprite);
    return sprite;
  }
  level.field.forEach((c, i) => {
    if (c > 0) makeSprite(c as Color, i % level.w, Math.floor(i / level.w));
  });

  /** Призрак назначения (§7): пока палец ведёт квадрат, видно, где он остановится и в какую колбу упадёт. */
  let ghost: HTMLElement | null = null;
  let targetFlask: HTMLElement | null = null;
  function clearGhost(): void {
    ghost?.remove();
    ghost = null;
    targetFlask?.classList.remove('target');
    targetFlask = null;
  }
  function showGhost(sprite: Sprite, dir: Dir | null): void {
    clearGhost();
    if (dir === null || locked()) return;
    const plan = planSwipe(level, state, sprite.x, sprite.y, dir);
    if (plan === null) return;
    const [gx, gy] = xy(plan.move.to.x, plan.move.to.y);
    ghost = document.createElement('div');
    ghost.className = `ghost${plan.move.kind === 'in' ? ' into' : ''}`;
    ghost.dataset['testid'] = 'ghost';
    ghost.style.setProperty('--c', COLOR[sprite.color]);
    ghost.style.transform = tr(gx, gy);
    boardEl.append(ghost);
    if (plan.move.kind === 'in') {
      targetFlask = flaskEls[(plan.move.flask ?? 1) - 1] ?? null;
      targetFlask?.classList.add('target');
    }
  }

  /** Свайп по квадрату (§4): направление — по доминирующей оси, порог 24 px; ход совершается при отпускании. */
  function attach(sprite: Sprite): void {
    sprite.el.addEventListener('pointerdown', (event) => {
      if (demo || event.button > 0) return;
      const sx = event.clientX;
      const sy = event.clientY;
      let shown: Dir | null = null;
      let commit: Dir | null = null;
      sprite.el.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent): void => {
        const preview = swipeDir(e.clientX - sx, e.clientY - sy, 12);
        commit = swipeDir(e.clientX - sx, e.clientY - sy);
        if (preview !== shown) {
          shown = preview;
          showGhost(sprite, preview);
        }
      };
      const end = (e: PointerEvent): void => {
        sprite.el.removeEventListener('pointermove', move);
        sprite.el.removeEventListener('pointerup', end);
        sprite.el.removeEventListener('pointercancel', end);
        clearGhost();
        if (e.type === 'pointerup' && commit !== null) void doSwipe(sprite, commit);
      };
      sprite.el.addEventListener('pointermove', move);
      sprite.el.addEventListener('pointerup', end);
      sprite.el.addEventListener('pointercancel', end);
    });
  }

  // ---------- колбы ----------
  const flaskEls: HTMLButtonElement[] = [];
  level.caps.forEach((cap, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'flask-wrap';
    const flask = document.createElement('button');
    flask.className = 'flask';
    flask.dataset['testid'] = `flask-${String(i + 1)}`;
    flask.setAttribute('aria-label', `Колба ${String(i + 1)}`);
    flask.innerHTML = Array.from({ length: cap }, () => '<div class="slot"></div>').join('');
    flask.addEventListener('pointerdown', () => {
      if (!demo) void doReturn(i + 1);
    });
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = String(i + 1);
    wrap.append(flask, badge);
    flasksEl.append(wrap);
    flaskEls.push(flask);
  });

  function renderFlasks(): void {
    flaskEls.forEach((flask, i) => {
      const stack = state.flasks[i] ?? [];
      flask.querySelectorAll<HTMLElement>('.slot').forEach((slot, s) => {
        const color = stack[s];
        slot.innerHTML = color === undefined ? '' : `<div class="sq mini" style="--c:${COLOR[color]}">${tile(color)}</div>`;
      });
      const exit = level.exits[i];
      const blocked = exit !== undefined && state.field[exit.y * level.w + exit.x] !== 0;
      flask.classList.toggle('ready', stack.length > 0 && !blocked);
      flask.classList.toggle('blocked', stack.length > 0 && blocked);
      const full = stack.length === (level.caps[i] ?? 0);
      flask.dataset['count'] = String(stack.length);
      flask.classList.toggle('full', full);
    });
  }

  // ---------- размеры от экрана (§7.1: клетка 40–64 px) ----------
  function fit(): void {
    const box = stage.getBoundingClientRect();
    const w = (box.width - 2 * MARGIN - 2 * PAD - GAP * (level.w - 1)) / level.w;
    const h = (box.height - 2 * MARGIN - 2 * PAD - GAP * (level.h - 1)) / level.h;
    const cell = Math.max(40, Math.min(Math.floor(Math.min(w, h)), 64));
    el.style.setProperty('--cell', `${String(cell)}px`);
    const bw = level.w * cell + (level.w - 1) * GAP + 2 * PAD;
    const bh = level.h * cell + (level.h - 1) * GAP + 2 * PAD;
    for (const s of sprites.values()) place(s);
    for (const m of exitMarks) {
      const exit = level.exits[m.n - 1];
      if (exit === undefined) continue;
      const cx = MARGIN + PAD + exit.x * (cell + GAP) + cell / 2;
      const cy = MARGIN + PAD + exit.y * (cell + GAP) + cell / 2;
      const p = exit.dy < 0 ? [cx, MARGIN - 4] : exit.dy > 0 ? [cx, MARGIN + bh + 4] : exit.dx < 0 ? [MARGIN - 4, cy] : [MARGIN + bw + 4, cy];
      const g = exit.dy < 0 ? [cx, MARGIN] : exit.dy > 0 ? [cx, MARGIN + bh] : exit.dx < 0 ? [MARGIN, cy] : [MARGIN + bw, cy];
      m.badge.style.left = `${String((p[0] ?? 0) - 12)}px`;
      m.badge.style.top = `${String((p[1] ?? 0) - 12)}px`;
      const horiz = exit.dy !== 0;
      m.gap.style.left = `${String((g[0] ?? 0) - (horiz ? cell / 2 : 3))}px`;
      m.gap.style.top = `${String((g[1] ?? 0) - (horiz ? 3 : cell / 2))}px`;
      m.gap.style.width = horiz ? `${String(cell)}px` : '';
      m.gap.style.height = horiz ? '' : `${String(cell)}px`;
    }
  }
  const observer = new ResizeObserver(fit);
  observer.observe(stage);

  const cellPx = (): number => parseFloat(getComputedStyle(el).getPropertyValue('--cell'));
  const xy = (x: number, y: number): readonly [number, number] => [PAD + x * (cellPx() + GAP), PAD + y * (cellPx() + GAP)];
  function place(s: Sprite): void {
    const [x, y] = xy(s.x, s.y);
    s.el.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
  }
  const tr = (x: number, y: number, scale = 1): string => `translate(${String(x)}px,${String(y)}px) scale(${String(scale)})`;

  /** Клетка (px) внутри доски по прямоугольнику слота колбы (для въезда/выезда). */
  function slotTarget(flaskIndex: number, slotIndex: number): { x: number; y: number; scale: number } | null {
    const slot = flaskEls[flaskIndex]?.querySelectorAll<HTMLElement>('.slot')[slotIndex];
    if (slot === undefined) return null;
    const r = slot.getBoundingClientRect();
    const b = boardEl.getBoundingClientRect();
    return { x: r.left - b.left, y: r.top - b.top, scale: r.width / cellPx() };
  }

  const locked = (): boolean => popupOpen || busy || state.status !== 'playing';

  function renderMoves(): void {
    const left = level.limit - state.moves;
    movesEl.innerHTML = `Ходы <b>${String(state.moves)}</b><span>/ ${String(level.limit)}</span>`;
    movesEl.classList.toggle('last', state.status === 'playing' && left === 1);
    el.dataset['status'] = state.status;
    el.dataset['moves'] = String(state.moves);
    el.toggleAttribute('data-busy', busy);
    renderFlasks();
    renderBudget();
    renderGoals();
  }

  /** Запас ходов (§7): заливка растёт с ходами, метки — пороги трёх и двух звёзд. */
  function renderBudget(): void {
    const share = Math.min(state.moves / level.limit, 1);
    budgetFill.style.transform = `scaleX(${String(share)})`;
    budgetFill.dataset['tier'] = state.moves >= level.stars2 ? 'low' : state.moves >= level.stars3 ? 'mid' : 'top';
    // после хода №stars3 без победы третья звезда уже недостижима, после №stars2 — вторая
    starEls.forEach((s, i) => {
      const need = i === 2 ? level.stars3 : i === 1 ? level.stars2 : level.limit;
      s.classList.toggle('on', state.moves < need);
    });
    el.dataset['starsLeft'] = String(starEls.filter((s) => s.classList.contains('on')).length);
  }

  /** Счётчики целей (§7): по значку на цвет, собранный цвет отмечен галочкой. */
  function renderGoals(): void {
    goalsEl.innerHTML = colorProgress(level, state)
      .map(
        (p) =>
          `<span class="goal${p.done ? ' done' : ''}" data-testid="goal-${String(p.color)}" data-done="${String(p.done)}"><i class="sq goal-sq" style="--c:${COLOR[p.color]}">${tile(p.color)}</i><b>${String(p.have)}/${String(p.total)}</b>${p.done ? icon.check : ''}</span>`,
      )
      .join('');
  }

  // ---------- недопустимое действие: покачивание, вспышка клетки выхода (§7) ----------
  function shakeSprite(s: Sprite, dir: Dir): void {
    const [x, y] = xy(s.x, s.y);
    const [dx, dy] = DELTA[dir];
    s.el.animate(
      [
        { transform: tr(x, y) },
        { transform: tr(x + dx * 5, y + dy * 5) },
        { transform: tr(x - dx * 2, y - dy * 2) },
        { transform: tr(x, y) },
      ],
      { duration: T.shake, easing: 'ease-out' },
    );
    vibrate(15);
  }
  function denyFlask(n: number): void {
    const flask = flaskEls[n - 1];
    const exit = level.exits[n - 1];
    if (flask === undefined || exit === undefined) return;
    flask.classList.remove('shake-x');
    void flask.offsetWidth;
    flask.classList.add('shake-x');
    const cell = boardEl.querySelector<HTMLElement>(`[data-cell="${String(exit.y * level.w + exit.x)}"]`);
    cell?.animate([{ background: 'var(--ui-danger)' }, { background: 'var(--ui-surface-muted)' }], { duration: T.deny, easing: 'ease-out' });
    vibrate(15);
  }

  // ---------- анимация хода ----------
  function glide(s: Sprite, from: readonly [number, number], to: readonly [number, number], duration: number, easing: string, fill = true): Promise<void> {
    const anim = s.el.animate([{ transform: tr(from[0], from[1]) }, { transform: tr(to[0], to[1]) }], { duration: Math.max(duration, 1), easing, fill: 'forwards' });
    return anim.finished.then(() => {
      // fill:'forwards' держит конечный кадр; ставим его инлайном и снимаем
      // эффект, иначе после resize `place()` не сработает (Ловушка WAAPI).
      if (fill) {
        s.el.style.transform = tr(to[0], to[1]);
        anim.cancel();
      }
    });
  }

  async function animateMove(result: Outcome, sprite: Sprite | null): Promise<void> {
    const move: Move = result.move;
    if (move.kind === 'return') {
      const flaskIndex = (move.flask ?? 1) - 1;
      const before = state.flasks[flaskIndex]?.length ?? 1;
      const start = slotTarget(flaskIndex, before - 1);
      const made = makeSprite(move.color, move.from.x, move.from.y);
      const [ex, ey] = xy(move.from.x, move.from.y);
      if (start === null) {
        place(made);
        return;
      }
      made.el.style.transform = tr(start.x, start.y, start.scale);
      state = { ...state, flasks: result.state.flasks };
      renderFlasks();
      const anim = made.el.animate([{ transform: tr(start.x, start.y, start.scale) }, { transform: tr(ex, ey) }], { duration: T.dive, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'forwards' });
      await anim.finished;
      made.el.style.transform = tr(ex, ey);
      anim.cancel();
      return;
    }
    if (sprite === null) return;
    const from = xy(sprite.x, sprite.y);
    const to = xy(move.to.x, move.to.y);
    const slide = Math.min(move.steps * T.cell, T.maxSlide);
    sprites.delete(keyOf(sprite.x, sprite.y));
    if (move.steps > 0) await glide(sprite, from, to, slide, 'cubic-bezier(.3,0,.25,1)');
    sprite.x = move.to.x;
    sprite.y = move.to.y;
    if (move.kind === 'slide') {
      sprites.set(keyOf(sprite.x, sprite.y), sprite);
      sprite.el.dataset['testid'] = `sq-${String(sprite.x)}-${String(sprite.y)}`;
      return;
    }
    // въезд в колбу: в слот, который займёт квадрат (§7: 220 мс)
    const flaskIndex = (move.flask ?? 1) - 1;
    const slotIndex = result.state.flasks[flaskIndex]?.length ?? 1;
    const target = slotTarget(flaskIndex, slotIndex - 1);
    if (target !== null) {
      const anim = sprite.el.animate([{ transform: tr(to[0], to[1]), opacity: 1 }, { transform: tr(target.x, target.y, target.scale), opacity: 1 }], { duration: T.dive, easing: 'cubic-bezier(.5,0,.75,.5)', fill: 'forwards' });
      await anim.finished;
    }
    sprite.el.remove();
  }

  async function commit(result: Outcome, action: Action, sprite: Sprite | null): Promise<void> {
    busy = true;
    renderMoves();
    const now = performance.now();
    const isReturn = result.move.kind === 'return';
    if (isReturn) returns += 1;
    const expected = level.solution[pathIndex];
    if (onPath && expected !== undefined && JSON.stringify(expected) === JSON.stringify(action)) pathIndex += 1;
    else {
      if (onPath) divergedAt = result.state.moves;
      onPath = false;
    }
    if (!demo) log({ type: 'move', level: levelNumber, attempt, n: result.state.moves, kind: isReturn ? 'return' : 'swipe', onSolution: onPath, returns, ms: Math.round(now - lastMoveAt) });
    lastMoveAt = now;

    await animateMove(result, sprite);
    state = result.state;
    busy = false;
    renderMoves();
    vibrate(isReturn ? 12 : 8);

    if (demo) {
      if (demoBanner !== null) demoBanner.textContent = `Образец: ход ${String(state.moves)} из ${String(level.opt)}`;
      if (state.status === 'won') {
        await wave();
        showDemoEnd();
      }
      return;
    }
    if (state.status === 'won') {
      markPassed(levelNumber);
      const record = recordResult(levelNumber, state.moves, state.stars);
      log({ type: 'level_win', level: levelNumber, moves: state.moves, stars: state.stars, returns, divergedAt });
      await wave();
      showWin(record);
      return;
    }
    if (state.status === 'failed' && state.failReason !== null) {
      log({ type: 'level_fail', level: levelNumber, reason: state.failReason, divergedAt });
      for (const s of sprites.values()) {
        s.el.classList.remove('stuck-flash');
        void s.el.offsetWidth;
        s.el.classList.add('stuck-flash');
      }
      vibrate([30, 60, 30]);
      await wait(900);
      showLose(state.failReason);
    }
  }

  async function doSwipe(sprite: Sprite, dir: Dir): Promise<void> {
    if (locked()) return;
    const result = engineSwipe(level, state, sprite.x, sprite.y, dir);
    if (result === null) {
      // недопустимо: квадрат покачивается, ход не тратится
      if (planSwipe(level, state, sprite.x, sprite.y, dir) === null) shakeSprite(sprite, dir);
      return;
    }
    await commit(result, { type: 'swipe', x: sprite.x, y: sprite.y, dir }, sprite);
  }

  async function doReturn(n: number): Promise<void> {
    if (locked()) return;
    const result = engineTap(level, state, n);
    if (result === null) {
      // пустая колба — ничего; клетка выхода занята — вспышка и покачивание (§4)
      if ((state.flasks[n - 1]?.length ?? 0) > 0 && planReturn(level, state, n) === null) denyFlask(n);
      return;
    }
    await commit(result, { type: 'tap-flask', n }, null);
  }

  async function wave(): Promise<void> {
    const cells = [...boardEl.querySelectorAll<HTMLElement>('.cell')];
    cells.forEach((c, i) => {
      c.animate([{ transform: 'none' }, { transform: 'translateY(-8px) scale(1.05)' }, { transform: 'none' }], {
        duration: 520,
        delay: i * 18,
        easing: 'cubic-bezier(.3,1.5,.5,1)',
      });
    });
    flaskEls.forEach((f, i) => {
      if (f.dataset['count'] !== '0') f.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.12)' }, { filter: 'brightness(1)' }], { duration: 400, delay: i * 60 });
    });
    vibrate([20, 40, 20]);
    await wait(700);
  }

  // ---------- попапы ----------
  const replay = (): void => go(`#/level/${String(levelNumber)}`);
  const toLevels = (): void => go('#/levels');

  function popup(content: string, actions: Parameters<typeof openPopup>[2], testId: string, onClose?: () => void): void {
    popupOpen = true;
    renderMoves();
    openPopup(
      el,
      content,
      actions.map((action) => ({
        ...action,
        run: () => {
          popupOpen = false;
          onClose?.();
          renderMoves();
          action.run();
        },
      })),
      testId,
    );
  }

  const starsRow = (n: number): string => `<div class="stars" data-testid="stars" data-count="${String(n)}">${[1, 2, 3].map((i) => `<span class="${i <= n ? 'on' : ''}" style="animation-delay:${String(200 * i)}ms">${star}</span>`).join('')}</div>`;

  const divergeLine = (): string =>
    divergedAt !== null && divergedAt <= state.moves ? `<p class="sub diverge" data-testid="diverge">С образцом разошлись на ходу ${String(divergedAt)}</p>` : '';
  const toDemo = (): void => go(`#/level/${String(levelNumber)}/demo`);
  const review = { id: 'review', html: 'Разбор', className: 'btn-secondary btn-half', run: toDemo };

  function showWin(record: boolean): void {
    const extra = state.moves - level.opt;
    const sub = extra <= 0 ? `${String(state.moves)} ходов, как в образце` : `${String(state.moves)} ходов, образец — ${String(level.opt)}, лишних: ${String(extra)}`;
    const badge = record ? '<p class="sub record" data-testid="record">Новый рекорд!</p>' : '';
    const body = `${starsRow(state.stars)}<p class="sub">${sub}</p>${badge}${divergeLine()}`;
    // «Разбор» — образец решения; когда счёт равен образцу, разбирать нечего
    const secondary = [
      { id: 'replay', html: `${icon.replay}Переиграть`, className: extra > 0 ? 'btn-secondary btn-half' : 'btn-secondary', run: replay },
      ...(extra > 0 ? [review] : []),
    ];
    if (levelNumber === LEVEL_COUNT) {
      popup(
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2>${body}`,
        [...secondary, { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels }],
        'popup-final',
      );
      return;
    }
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень пройден!</h2>${body}`,
      [{ id: 'next', html: `Следующий уровень ${icon.arrow}`, className: 'btn-success', run: () => go(`#/level/${String(levelNumber + 1)}`) }, ...secondary, { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels }],
      'popup-win',
    );
  }

  function showLose(reason: 'moves_exhausted' | 'no_moves'): void {
    const title = reason === 'moves_exhausted' ? 'Ходы закончились' : 'Ходов нет';
    const sub = reason === 'moves_exhausted' ? 'Лимит ходов исчерпан, цвета не собраны' : 'Ни один квадрат не сдвинуть и ни одну колбу не открыть';
    popup(
      `<div class="badge-big badge-lose">${icon.cross}</div><h2>${title}</h2><p class="sub">${sub}</p>${divergeLine()}`,
      [
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-primary', run: replay },
        { ...review, className: 'btn-secondary' },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-lose',
    );
  }

  function showDemoEnd(): void {
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Образец: ${String(level.opt)} ходов</h2><p class="sub">Так этот уровень проходится за минимум</p>`,
      [
        { id: 'play', html: `${icon.replay}Играть`, className: 'btn-primary', run: replay },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-demo',
    );
  }

  /** Разбор: образец (сохранённое оптимальное решение) проигрывается сам, ввод закрыт. */
  async function runDemo(): Promise<void> {
    await wait(700);
    for (const action of level.solution) {
      if (action.type === 'swipe') {
        const sprite = sprites.get(keyOf(action.x, action.y));
        const result = engineSwipe(level, state, action.x, action.y, action.dir);
        if (sprite === undefined || result === null) return;
        await commit(result, action, sprite);
      } else {
        const result = engineTap(level, state, action.n);
        if (result === null) return;
        await commit(result, action, null);
      }
      if (state.status !== 'playing') return;
      await wait(T.demoPause);
    }
  }

  function showHowToPlay(): void {
    popup(HOW_TO_PLAY, [{ id: 'ok', html: 'Понятно!', className: 'btn-primary', run: () => undefined }], 'popup-help', () => markHowToPlaySeen());
  }

  q('[data-testid="to-levels"]').addEventListener('click', toLevels);
  q('[data-testid="restart"]').addEventListener('click', () => {
    if (!popupOpen) replay();
  });
  q('[data-testid="help"]').addEventListener('click', () => {
    if (locked() || demo) return;
    log({ type: 'help_open', level: levelNumber });
    showHowToPlay();
  });

  renderMoves();
  fit();
  if (demo) {
    log({ type: 'demo_open', level: levelNumber });
    void runDemo();
  } else log({ type: 'level_start', level: levelNumber });
  if (!demo && levelNumber === 1 && !loadProgress().howToPlaySeen) {
    popupOpen = true;
    renderMoves();
    setTimeout(showHowToPlay, 350);
  }

  return { el, destroy: () => observer.disconnect() };
}
