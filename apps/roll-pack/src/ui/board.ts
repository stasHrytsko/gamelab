import { isValidPosition } from '../engine/rollEngine.ts';
import { WIDTH } from '../engine/types.ts';
import { reducedMotion, vibrate, wait } from './feedback.ts';
import { plankTile } from './icons.ts';

export interface BoardHandlers {
  /** Планка отпущена над валидной позицией x. */
  commit(x: number): void;
}

const FALL_MS = 180;
const FLASH_MS = 300;

/**
 * Поле 6 × cap и «рука» над ним. Столбец x, ряд row (0 — нижний).
 * Планка в руке едет за пальцем по горизонтали и снапится к столбцам.
 */
export class Board {
  readonly el: HTMLElement;
  private readonly card: HTMLElement;
  private readonly lane: HTMLElement;
  private readonly slots: HTMLElement[][] = [];
  private cell = 48;
  private heights: number[] = Array.from({ length: WIDTH }, () => 0);
  private readonly planks: { el: HTMLElement; length: number; x: number; row: number }[] = [];

  private hand: HTMLElement | null = null;
  private ghost: HTMLElement | null = null;
  private length = 0;
  private handX = 0;
  private lastValidX = 0;
  private locked = false;
  private drag: { id: number; startClient: number; startLeft: number } | null = null;

  constructor(private readonly cap: number, private readonly handlers: BoardHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'board-wrap';
    this.el.dataset['testid'] = 'board';
    this.lane = document.createElement('div');
    this.lane.className = 'hand-lane';
    this.card = document.createElement('div');
    this.card.className = 'board';
    this.el.append(this.lane, this.card);
    for (let row = 0; row < cap; row += 1) {
      const line: HTMLElement[] = [];
      for (let col = 0; col < WIDTH; col += 1) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset['col'] = String(col);
        slot.dataset['row'] = String(row);
        this.card.append(slot);
        line.push(slot);
      }
      this.slots.push(line);
    }
  }

  // ---------- раскладка ----------

  private get pad(): number {
    return Math.round(this.cell * 0.16);
  }
  private get gap(): number {
    return Math.round(this.cell * 0.1);
  }
  private laneHeight(): number {
    return this.cell + this.pad * 2;
  }
  private left(x: number): number {
    return this.pad + x * this.cell + this.gap / 2;
  }
  private top(row: number): number {
    return this.pad + (this.cap - 1 - row) * this.cell + this.gap / 2;
  }

  fit(width: number, height: number): void {
    const byWidth = (width - 8) / (WIDTH + 0.32);
    const byHeight = (height - 8) / (this.cap + 1 + 0.32 * 2 + 0.3);
    this.cell = Math.max(28, Math.floor(Math.min(byWidth, byHeight, 72)));
    const boardW = WIDTH * this.cell + this.pad * 2;
    const boardH = this.cap * this.cell + this.pad * 2;
    const laneH = this.laneHeight();
    const spacing = Math.round(this.cell * 0.3);
    this.el.style.width = `${String(boardW)}px`;
    this.el.style.height = `${String(laneH + spacing + boardH)}px`;
    this.el.style.setProperty('--cell', `${String(this.cell - this.gap)}px`);
    this.lane.style.height = `${String(laneH)}px`;
    this.card.style.top = `${String(laneH + spacing)}px`;
    this.card.style.width = `${String(boardW)}px`;
    this.card.style.height = `${String(boardH)}px`;
    this.slots.forEach((line, row) =>
      line.forEach((slot, col) => this.box(slot, col, row, 1)),
    );
    for (const plank of this.planks) this.box(plank.el, plank.x, plank.row, plank.length);
    if (this.hand !== null) this.placeHand(this.handX);
    this.renderGhost();
  }

  private box(el: HTMLElement, x: number, row: number, length: number): void {
    el.style.left = `${String(this.left(x))}px`;
    el.style.top = `${String(this.top(row))}px`;
    el.style.width = `${String(length * this.cell - this.gap)}px`;
    el.style.height = `${String(this.cell - this.gap)}px`;
  }

  // ---------- состояние поля ----------

  setLocked(locked: boolean): void {
    this.locked = locked;
    if (locked) this.el.dataset['busy'] = '';
    else delete this.el.dataset['busy'];
  }

  /** Показывает планку в руке у первой валидной позиции и подсветку всех валидных мест. */
  select(length: number | null, heights: readonly number[]): void {
    this.heights = [...heights];
    this.clearHand();
    this.length = length ?? 0;
    this.highlight();
    if (length === null) return;
    const firstValid = this.validXs()[0] ?? 0;
    this.hand = document.createElement('div');
    this.hand.className = 'hand';
    this.hand.dataset['testid'] = 'hand';
    this.hand.innerHTML = plankTile(length);
    this.hand.style.width = `${String(length * this.cell - this.gap)}px`;
    this.hand.style.height = `${String(this.cell - this.gap)}px`;
    this.hand.addEventListener('pointerdown', (event) => this.onDown(event));
    this.hand.addEventListener('pointermove', (event) => this.onMove(event));
    this.hand.addEventListener('pointerup', (event) => this.onUp(event));
    this.hand.addEventListener('pointercancel', (event) => this.onUp(event));
    this.lane.append(this.hand);
    this.lastValidX = firstValid;
    this.placeHand(firstValid);
  }

  private validXs(): number[] {
    const out: number[] = [];
    for (let x = 0; x + this.length <= WIDTH; x += 1) {
      if (isValidPosition(this.heights, this.cap, this.length, x)) out.push(x);
    }
    return out;
  }

  private highlight(): void {
    this.slots.flat().forEach((slot) => slot.classList.remove('can'));
    if (this.length === 0) return;
    for (const x of this.validXs()) {
      const row = this.heights[x] ?? 0;
      for (let col = x; col < x + this.length; col += 1) this.slots[row]?.[col]?.classList.add('can');
    }
  }

  private clearHand(): void {
    this.hand?.remove();
    this.ghost?.remove();
    this.hand = null;
    this.ghost = null;
    this.drag = null;
  }

  private placeHand(x: number, pixelLeft?: number): void {
    if (this.hand === null) return;
    this.handX = x;
    this.hand.dataset['x'] = String(x);
    this.hand.style.left = `${String(pixelLeft ?? this.left(x))}px`;
    this.hand.style.top = `${String(this.pad + this.gap / 2)}px`;
    const valid = isValidPosition(this.heights, this.cap, this.length, x);
    this.hand.classList.toggle('invalid', !valid);
    this.renderGhost();
  }

  private renderGhost(): void {
    const valid = this.hand !== null && isValidPosition(this.heights, this.cap, this.length, this.handX);
    if (!valid) {
      this.ghost?.remove();
      this.ghost = null;
      return;
    }
    if (this.ghost === null) {
      this.ghost = document.createElement('div');
      this.ghost.className = 'ghost';
      this.card.append(this.ghost);
    }
    this.box(this.ghost, this.handX, this.heights[this.handX] ?? 0, this.length);
  }

  // ---------- перетаскивание ----------

  private onDown(event: PointerEvent): void {
    if (this.locked || this.hand === null || this.drag !== null) return;
    event.preventDefault();
    this.hand.setPointerCapture(event.pointerId);
    this.drag = { id: event.pointerId, startClient: event.clientX, startLeft: this.left(this.handX) };
    this.hand.classList.add('lifted');
  }

  private onMove(event: PointerEvent): void {
    if (this.drag === null || event.pointerId !== this.drag.id) return;
    const maxLeft = this.left(WIDTH - this.length);
    const pixel = Math.min(maxLeft, Math.max(this.left(0), this.drag.startLeft + event.clientX - this.drag.startClient));
    const x = Math.round((pixel - this.left(0)) / this.cell);
    if (x !== this.handX) vibrate(4);
    this.placeHand(x, pixel);
  }

  private onUp(event: PointerEvent): void {
    if (this.drag === null || event.pointerId !== this.drag.id || this.hand === null) return;
    this.drag = null;
    this.hand.classList.remove('lifted');
    const x = this.handX;
    if (!this.locked && event.type === 'pointerup' && isValidPosition(this.heights, this.cap, this.length, x)) {
      this.lastValidX = x;
      this.placeHand(x);
      this.handlers.commit(x);
      return;
    }
    const back = isValidPosition(this.heights, this.cap, this.length, this.lastValidX) ? this.lastValidX : 0;
    this.placeHand(back);
    this.nudge(this.hand);
  }

  private nudge(el: HTMLElement): void {
    el.classList.remove('shake-x');
    void el.offsetWidth;
    el.classList.add('shake-x');
    vibrate(20);
  }

  // ---------- анимации хода ----------

  /** Планка из руки падает на поле и остаётся там. */
  async drop(x: number): Promise<void> {
    const hand = this.hand;
    const length = this.length;
    const row = this.heights[x] ?? 0;
    this.ghost?.remove();
    this.ghost = null;
    this.slots.flat().forEach((slot) => slot.classList.remove('can'));
    const plank = document.createElement('div');
    plank.className = 'plank';
    plank.dataset['testid'] = 'plank';
    plank.innerHTML = plankTile(length);
    this.box(plank, x, row, length);
    const fromTop = hand === null ? 0 : -(this.card.offsetTop - hand.offsetTop);
    plank.style.setProperty('--from', `${String(fromTop - this.top(row))}px`);
    plank.classList.add('falling');
    hand?.remove();
    this.hand = null;
    this.card.append(plank);
    this.planks.push({ el: plank, length, x, row });
    for (let col = x; col < x + length; col += 1) this.slots[row]?.[col]?.classList.add('filled');
    await wait(FALL_MS);
    plank.classList.remove('falling');
    plank.classList.add('landed');
    vibrate(12);
  }

  async flashRow(row: number): Promise<void> {
    const planks = this.planks.filter((plank) => plank.row === row);
    planks.forEach((plank) => plank.el.classList.add('row-flash'));
    await wait(FLASH_MS);
    planks.forEach((plank) => plank.el.classList.remove('row-flash'));
  }

  async celebrate(): Promise<void> {
    this.planks.forEach((plank, i) => {
      plank.el.style.animationDelay = `${String(reducedMotion() ? 0 : (this.cap - 1 - plank.row) * 40 + i * 6)}ms`;
      plank.el.classList.add('hop');
    });
    vibrate([20, 40, 20]);
    await wait(700);
  }

  /** Поражение: подсветить самый широкий ровный участок и подписать его ширину. */
  showNoFit(): void {
    let best = { x: 0, width: 0 };
    let x = 0;
    while (x < WIDTH) {
      const h = this.heights[x] ?? 0;
      let end = x;
      while (end + 1 < WIDTH && this.heights[end + 1] === h) end += 1;
      if (h < this.cap && end - x + 1 > best.width) best = { x, width: end - x + 1 };
      x = end + 1;
    }
    if (best.width === 0) return;
    const row = this.heights[best.x] ?? 0;
    const mark = document.createElement('div');
    mark.className = 'no-fit';
    mark.dataset['testid'] = 'no-fit';
    mark.innerHTML = `<span>${String(best.width)}</span>`;
    this.box(mark, best.x, row, best.width);
    this.card.append(mark);
  }

  /** Обновить высоты для подсветки без смены планки в руке. */
  setHeights(heights: readonly number[]): void {
    this.heights = [...heights];
  }
}
