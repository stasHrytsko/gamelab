import { targetCell } from '../engine/slideEngine.ts';
import type { Cell, Direction, LevelState, GoalState, Side, Block } from '../engine/types.ts';
import { vibrate, wait } from './feedback.ts';
import { glyph } from './icons.ts';

export interface BoardHandlers {
  /** Можно ли сдвинуть плитку — спрашивает движок, доска не знает правил. */
  canMove(blockId: string, direction: Direction): boolean;
  /** Сдвиг подтверждён пальцем; доска заблокирована, пока промис не завершится. */
  commit(blockId: string, direction: Direction): Promise<void>;
}

interface Geometry {
  readonly cell: number;
  readonly gap: number;
  readonly pad: number;
  readonly lane: number;
  readonly goal: number;
  readonly size: number;
}

/** Жест короче этого — тап, он игнорируется (§4). */
const TAP_LIMIT = 18;
const AXIS_LOCK = 6;

const SIDE_VECTOR: Readonly<Record<Side, Cell>> = {
  top: { row: -1, col: 0 },
  bottom: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

const colorVar = (color: string): string =>
  color === 'red' ? 'var(--ui-coral)' : color === 'blue' ? 'var(--ui-blue)' : 'var(--ui-yellow)';

interface Drag {
  readonly pointerId: number;
  readonly blockId: string;
  readonly el: HTMLElement;
  readonly startX: number;
  readonly startY: number;
  axis: 'x' | 'y' | null;
  delta: number;
  direction: Direction | null;
  movable: boolean;
}

export class Board {
  readonly el: HTMLElement;
  private readonly boardEl: HTMLElement;
  private readonly slots: HTMLElement[] = [];
  private readonly blocks = new Map<string, { el: HTMLElement; block: Block }>();
  private readonly goals = new Map<string, HTMLElement>();
  private geo: Geometry = { cell: 48, gap: 5, pad: 8, lane: 40, goal: 36, size: 360 };
  private drag: Drag | null = null;
  private locked = false;
  private aimed: HTMLElement | null = null;

  constructor(
    state: LevelState,
    private readonly handlers: BoardHandlers,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'board-wrap';
    this.el.dataset['testid'] = 'board';
    this.boardEl = document.createElement('div');
    this.boardEl.className = 'board';
    this.el.append(this.boardEl);

    for (let index = 0; index < 25; index += 1) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      this.boardEl.append(slot);
      this.slots.push(slot);
    }
    for (const block of state.blocks) this.addBlock(block);
    for (const goal of state.goals) {
      if (goal.status === 'waiting') this.addGoal(goal, false);
    }

    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onCancel);
    this.el.addEventListener('lostpointercapture', this.onCancel);
  }

  // ---------- геометрия ----------

  fit(width: number, height: number): void {
    // Всё поле — 7.4 клетки: 5 клеток, зазоры, поля доски и две полосы целей.
    const cell = Math.max(34, Math.min(76, Math.floor(Math.min(width, height) / 7.4)));
    const gap = Math.round(cell * 0.1);
    const pad = Math.round(cell * 0.16);
    const lane = Math.round(cell * 0.84);
    const goal = Math.round(Math.min(lane - 4, cell * 0.8));
    const size = cell * 5 + gap * 4 + pad * 2 + lane * 2;
    this.geo = { cell, gap, pad, lane, goal, size };

    this.el.style.width = `${String(size)}px`;
    this.el.style.height = `${String(size)}px`;
    const inner = size - lane * 2;
    Object.assign(this.boardEl.style, {
      left: `${String(lane)}px`, top: `${String(lane)}px`,
      width: `${String(inner)}px`, height: `${String(inner)}px`,
    });
    this.slots.forEach((slot, index) => {
      const { x, y } = this.cellXY({ row: Math.floor(index / 5), col: index % 5 });
      Object.assign(slot.style, {
        left: `${String(x - lane)}px`, top: `${String(y - lane)}px`,
        width: `${String(cell)}px`, height: `${String(cell)}px`,
      });
    });
    for (const { el, block } of this.blocks.values()) {
      el.style.transition = 'none';
      el.style.width = el.style.height = `${String(cell)}px`;
      this.place(el, block);
    }
    for (const el of this.goals.values()) this.placeGoal(el);
  }

  private cellXY(cell: Cell): { x: number; y: number } {
    const { cell: size, gap, pad, lane } = this.geo;
    return { x: lane + pad + cell.col * (size + gap), y: lane + pad + cell.row * (size + gap) };
  }

  private place(el: HTMLElement, cell: Cell, dx = 0, dy = 0): void {
    const { x, y } = this.cellXY(cell);
    el.style.transform = `translate3d(${String(x + dx)}px, ${String(y + dy)}px, 0)`;
  }

  private slotAt(cell: Cell): HTMLElement | undefined {
    return this.slots[cell.row * 5 + cell.col];
  }

  // ---------- плитки ----------

  private addBlock(block: Block): void {
    const el = document.createElement('div');
    el.className = 'block';
    el.dataset['block'] = block.id;
    el.dataset['color'] = block.color;
    el.innerHTML = `<div class="tile c-${block.color}">${glyph(block.color)}</div>`;
    this.el.append(el);
    this.blocks.set(block.id, { el, block });
  }

  async moveBlock(blockId: string, to: Cell): Promise<void> {
    const entry = this.blocks.get(blockId);
    if (entry === undefined) return;
    entry.block = { ...entry.block, ...to };
    entry.el.style.transition = 'transform 130ms cubic-bezier(.2,.9,.3,1.15)';
    this.place(entry.el, to);
    entry.el.classList.remove('lifted');
    vibrate(8);
    await wait(130);
  }

  /** Плитка сливается со своей целью и выезжает за край; её клетка вспыхивает новой пустотой. */
  async match(blockId: string, goal: GoalState): Promise<void> {
    const entry = this.blocks.get(blockId);
    const goalEl = this.goals.get(goal.id);
    if (entry === undefined) return;
    const cell = { row: entry.block.row, col: entry.block.col };
    const out = SIDE_VECTOR[goal.target.side];
    const distance = this.geo.cell + this.geo.lane + 24;

    if (goalEl !== undefined) {
      const { x, y } = this.cellXY(cell);
      const px = parseFloat(goalEl.style.left) + this.geo.goal / 2;
      const py = parseFloat(goalEl.style.top) + this.geo.goal / 2;
      goalEl.style.setProperty('--to', `translate(${String(x + this.geo.cell / 2 - px)}px, ${String(y + this.geo.cell / 2 - py)}px)`);
      goalEl.classList.remove('critical');
      goalEl.classList.add('board-in');
    }
    this.sparks(cell, goal.color);
    vibrate([12, 30, 18]);
    await wait(180);
    goalEl?.remove();
    this.goals.delete(goal.id);

    entry.el.style.transition = 'transform 240ms cubic-bezier(.5,0,.8,.4), opacity 240ms ease-in';
    this.place(entry.el, cell, out.col * distance, out.row * distance);
    entry.el.style.opacity = '0';
    const slot = this.slotAt(cell);
    slot?.classList.remove('target');
    slot?.style.removeProperty('--tc');
    await wait(120);
    slot?.classList.remove('flash');
    void slot?.offsetWidth;
    slot?.classList.add('flash');
    await wait(140);
    entry.el.remove();
    this.blocks.delete(blockId);
  }

  private sparks(cell: Cell, color: string): void {
    const { x, y } = this.cellXY(cell);
    const cx = x + this.geo.cell / 2;
    const cy = y + this.geo.cell / 2;
    for (let index = 0; index < 10; index += 1) {
      const angle = (Math.PI * 2 * index) / 10 + Math.random() * 0.4;
      const radius = this.geo.cell * (0.7 + Math.random() * 0.5);
      const spark = document.createElement('span');
      spark.className = 'spark';
      spark.style.left = `${String(cx - 4)}px`;
      spark.style.top = `${String(cy - 4)}px`;
      spark.style.background = index % 3 === 0 ? 'var(--ui-yellow)' : colorVar(color);
      spark.style.setProperty('--dx', `${String(Math.cos(angle) * radius)}px`);
      spark.style.setProperty('--dy', `${String(Math.sin(angle) * radius)}px`);
      this.el.append(spark);
      setTimeout(() => spark.remove(), 700);
    }
  }

  /** Победа: оставшиеся плитки подпрыгивают волной из угла. */
  async celebrate(): Promise<void> {
    for (const { el, block } of this.blocks.values()) {
      const tile = el.firstElementChild as HTMLElement | null;
      if (tile !== null) tile.style.animationDelay = `${String((block.row + block.col) * 50)}ms`;
      el.classList.add('hop');
    }
    vibrate([20, 40, 20, 40, 40]);
    await wait(650);
  }

  // ---------- цели ----------

  addGoal(goal: GoalState, animate = true): void {
    const el = document.createElement('div');
    el.className = 'goal';
    el.dataset['goal'] = goal.id;
    el.dataset['side'] = goal.target.side;
    el.dataset['index'] = String(goal.target.index);
    el.style.setProperty('--c', colorVar(goal.color));
    el.innerHTML = `<span class="num">${String(goal.countdown)}</span><span class="mark">${glyph(goal.color, '')}</span>`;
    if (!animate) el.style.animation = 'none';
    el.classList.toggle('critical', goal.countdown === 1);
    this.el.append(el);
    this.goals.set(goal.id, el);
    this.placeGoal(el);

    const slot = this.slotAt(targetCell(goal.target));
    if (slot !== undefined) {
      slot.style.setProperty('--tc', colorVar(goal.color));
      slot.classList.add('target');
      if (animate) {
        slot.classList.remove('arrive');
        void slot.offsetWidth;
        slot.classList.add('arrive');
      }
    }
  }

  private placeGoal(el: HTMLElement): void {
    const side = el.dataset['side'] as Side;
    const index = Number(el.dataset['index']);
    const { cell, gap, pad, lane, goal, size } = this.geo;
    const along = lane + pad + index * (cell + gap) + cell / 2 - goal / 2;
    const edge = (lane - goal) / 2 - 2;
    const far = size - edge - goal;
    const [left, top] =
      side === 'top' ? [along, edge] : side === 'bottom' ? [along, far] : side === 'left' ? [edge, along] : [far, along];
    Object.assign(el.style, {
      left: `${String(left)}px`, top: `${String(top)}px`,
      width: `${String(goal)}px`, height: `${String(goal)}px`,
    });
    const num = el.querySelector<HTMLElement>('.num');
    if (num !== null) num.style.fontSize = `${String(Math.round(goal * 0.42))}px`;
  }

  setCountdown(goal: GoalState): void {
    const el = this.goals.get(goal.id);
    const num = el?.querySelector<HTMLElement>('.num');
    if (el === undefined || num === undefined || num === null) return;
    if (num.textContent === String(goal.countdown)) return;
    num.textContent = String(goal.countdown);
    num.classList.remove('tick');
    void num.offsetWidth;
    num.classList.add('tick');
    el.classList.toggle('critical', goal.countdown === 1);
    if (goal.countdown === 1) vibrate(15);
  }

  /** Счётчик цели дошёл до нуля: цель сереет и уходит, её клетка краснеет. */
  async goalLeaves(goal: GoalState): Promise<void> {
    const el = this.goals.get(goal.id);
    const away = SIDE_VECTOR[goal.target.side];
    if (el !== undefined) {
      const num = el.querySelector('.num');
      if (num !== null) num.textContent = '0';
      el.classList.remove('critical');
      el.style.setProperty('--away', `translate(${String(away.col * 40)}px, ${String(away.row * 40)}px)`);
      el.classList.add('gone');
    }
    const slot = this.slotAt(targetCell(goal.target));
    slot?.classList.add('missed');
    vibrate([40, 60, 80]);
    await wait(750);
  }

  // ---------- ввод ----------

  setLocked(locked: boolean): void {
    this.locked = locked;
    this.el.toggleAttribute('data-busy', locked);
    if (locked) this.cancelDrag();
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (this.locked || this.drag !== null || !event.isPrimary) return;
    const el = (event.target as HTMLElement).closest<HTMLElement>('.block');
    const blockId = el?.dataset['block'];
    if (el === null || el === undefined || blockId === undefined) return;
    event.preventDefault();
    this.el.setPointerCapture(event.pointerId);
    el.style.transition = 'none';
    this.drag = {
      pointerId: event.pointerId, blockId, el,
      startX: event.clientX, startY: event.clientY,
      axis: null, delta: 0, direction: null, movable: false,
    };
  };

  private readonly onMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (drag === null || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (drag.axis === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return;
      drag.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      drag.el.classList.add('lifted');
    } else {
      // Передумал и повёл поперёк — ось переключается.
      const along = drag.axis === 'x' ? Math.abs(dx) : Math.abs(dy);
      const across = drag.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
      if (across > along + 12) drag.axis = drag.axis === 'x' ? 'y' : 'x';
    }

    const delta = drag.axis === 'x' ? dx : dy;
    const direction: Direction = drag.axis === 'x' ? (delta >= 0 ? 'right' : 'left') : delta >= 0 ? 'down' : 'up';
    if (direction !== drag.direction) {
      drag.direction = direction;
      drag.movable = this.handlers.canMove(drag.blockId, direction);
    }
    drag.delta = delta;

    const step = this.geo.cell + this.geo.gap;
    const sign = Math.sign(delta);
    // Свободно — плитка идёт за пальцем до соседней клетки; занято — чуть пружинит.
    const offset = drag.movable ? sign * Math.min(Math.abs(delta), step) : sign * Math.min(Math.abs(delta) * 0.18, 7);
    const entry = this.blocks.get(drag.blockId);
    if (entry !== undefined) {
      this.place(drag.el, entry.block, drag.axis === 'x' ? offset : 0, drag.axis === 'y' ? offset : 0);
    }
    this.aim(drag.movable && Math.abs(delta) >= TAP_LIMIT && entry !== undefined ? this.neighbour(entry.block, direction) : null);
  };

  private readonly onUp = (event: PointerEvent): void => {
    const drag = this.drag;
    if (drag === null || event.pointerId !== drag.pointerId) return;
    this.drag = null;
    this.aim(null);
    const entry = this.blocks.get(drag.blockId);
    if (entry === undefined) return;

    if (drag.axis === null || drag.direction === null || Math.abs(drag.delta) < TAP_LIMIT) {
      this.snapBack(drag.el, entry.block);
      return;
    }
    if (!drag.movable) {
      this.snapBack(drag.el, entry.block);
      drag.el.classList.remove('nudge-x', 'nudge-y');
      void drag.el.offsetWidth;
      drag.el.classList.add(drag.axis === 'x' ? 'nudge-x' : 'nudge-y');
      vibrate(6);
      return;
    }
    this.setLocked(true);
    void this.handlers.commit(drag.blockId, drag.direction).finally(() => {
      drag.el.classList.remove('lifted');
    });
  };

  private readonly onCancel = (event: Event): void => {
    const drag = this.drag;
    if (drag === null) return;
    if (event instanceof PointerEvent && event.pointerId !== drag.pointerId) return;
    // У тача браузер сам захватывает указатель на плитку; когда захват
    // переходит к полю, плитка получает lostpointercapture, и он всплывает сюда.
    if (event.type === 'lostpointercapture' && event.target !== this.el) return;
    this.cancelDrag();
  };

  private cancelDrag(): void {
    const drag = this.drag;
    this.drag = null;
    this.aim(null);
    if (drag === null) return;
    const entry = this.blocks.get(drag.blockId);
    if (entry !== undefined) this.snapBack(drag.el, entry.block);
  }

  private snapBack(el: HTMLElement, cell: Cell): void {
    el.style.transition = 'transform 180ms cubic-bezier(.3,1.4,.5,1)';
    this.place(el, cell);
    el.classList.remove('lifted');
  }

  private neighbour(cell: Cell, direction: Direction): Cell {
    const row = cell.row + (direction === 'down' ? 1 : direction === 'up' ? -1 : 0);
    const col = cell.col + (direction === 'right' ? 1 : direction === 'left' ? -1 : 0);
    return { row, col };
  }

  private aim(cell: Cell | null): void {
    const slot = cell === null ? null : this.slotAt(cell) ?? null;
    if (slot === this.aimed) return;
    this.aimed?.classList.remove('aim');
    slot?.classList.add('aim');
    this.aimed = slot;
  }
}
