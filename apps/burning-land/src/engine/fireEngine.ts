import type { Cell, CellKind, FailReason, GameState, Level, ShapeLetter } from './types.ts';
import { SIZE } from './types.ts';

// Правила хода — порт `playTurn`, `spread`, `nextBurn` и `placementsOf` из
// tools/burning-land-solver.mjs без изменений (§4–5). tests/levels.test.ts
// прогоняет линии солвера через этот движок.

type Offset = readonly [number, number];

/** Фигуры в базовом повороте (§3), клетки `[строка, столбец]`. */
export const SHAPES: Readonly<Record<ShapeLetter, readonly Offset[]>> = {
  M: [[0, 0]],
  D: [[0, 0], [0, 1]],
  I: [[0, 0], [0, 1], [0, 2]],
  V: [[0, 0], [0, 1], [1, 0]],
  O: [[0, 0], [0, 1], [1, 0], [1, 1]],
  L: [[0, 0], [0, 1], [0, 2], [1, 0]],
  S: [[0, 0], [0, 1], [1, 1], [1, 2]],
  T: [[0, 0], [0, 1], [0, 2], [1, 1]],
};

function normalize(cells: readonly Offset[]): Offset[] {
  const my = Math.min(...cells.map((p) => p[0]));
  const mx = Math.min(...cells.map((p) => p[1]));
  return cells.map(([y, x]): Offset => [y - my, x - mx]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** Поворот на 90° по часовой. */
const rotate = (cells: readonly Offset[]): Offset[] => normalize(cells.map(([y, x]): Offset => [x, -y]));

/** Разные повороты фигуры по порядку поворота; зеркала нет. */
function buildOrientations(letter: ShapeLetter): Offset[][] {
  const out: Offset[][] = [];
  let cur = normalize(SHAPES[letter]);
  for (let k = 0; k < 4; k += 1) {
    const key = JSON.stringify(cur);
    if (!out.some((o) => JSON.stringify(o) === key)) out.push(cur);
    cur = rotate(cur);
  }
  return out;
}
const ORIENT = Object.fromEntries((Object.keys(SHAPES) as ShapeLetter[]).map((k) => [k, buildOrientations(k)])) as Record<ShapeLetter, Offset[][]>;

export const rotationCount = (letter: ShapeLetter): number => ORIENT[letter].length;

export function shapeCells(letter: ShapeLetter, rot: number): readonly Offset[] {
  const list = ORIENT[letter];
  return list[rot % list.length] ?? list[0] ?? [];
}

/** Клетка фигуры, которая стоит под пальцем (§4): `[floor(maxRow/2), floor(maxCol/2)]`. */
export function centerOffset(letter: ShapeLetter, rot: number): Offset {
  const cells = shapeCells(letter, rot);
  return [Math.max(...cells.map((p) => p[0])) >> 1, Math.max(...cells.map((p) => p[1])) >> 1];
}

export const idx = (c: Cell): number => c.row * SIZE + c.col;
export const cellOf = (i: number): Cell => ({ row: Math.floor(i / SIZE), col: i % SIZE });

export function isLetter(ch: string | undefined): ch is ShapeLetter {
  return ch !== undefined && ch in SHAPES;
}

/** Три фигуры хода `turn`. Очередь длинная, но если кончится — фигур нет (солвер тоже). */
export function trayOf(level: Level, turn: number): ShapeLetter[] {
  return [...level.shapes.slice(turn * 3, turn * 3 + 3)].filter(isLetter);
}

const KIND: Record<string, CellKind> = { '.': 'grass', F: 'fire', H: 'house', W: 'wall', x: 'ash' };

export function parseCells(level: Level): CellKind[] {
  const out: CellKind[] = [];
  for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) out.push(KIND[level.rows[row]?.[col] ?? '.'] ?? 'grass');
  return out;
}

export function houseCells(level: Level): number[] {
  return parseCells(level).flatMap((k, i) => (k === 'house' ? [i] : []));
}

/** Поворотов на ход, общий лимит на три фигуры (§4, решение автора 2026-09-27). */
export const ROTATIONS_PER_TURN = 3;

export function createState(level: Level): GameState {
  return { level: level.id, cells: parseCells(level), turn: 0, rotations: [0, 0, 0], rotationsLeft: ROTATIONS_PER_TURN, status: 'playing', failReason: null };
}

export function neighbours(i: number): number[] {
  const { row, col } = cellOf(i);
  const out: number[] = [];
  for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]] as const) {
    const r = row + dr;
    const c = col + dc;
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) out.push(r * SIZE + c);
  }
  return out;
}

const burnable = (k: CellKind | undefined): boolean => k === 'grass' || k === 'house';

/** Клетки, которые огонь возьмёт следующим шагом. Пусто — огню некуда расти. */
export function nextBurn(cells: readonly CellKind[]): Set<number> {
  const out = new Set<number>();
  cells.forEach((k, i) => {
    if (k !== 'fire') return;
    for (const n of neighbours(i)) if (burnable(cells[n])) out.add(n);
  });
  return out;
}

/** Расстояние огня по траве и домам до каждой клетки; -1 — огонь туда не дойдёт. */
export function fireDistance(cells: readonly CellKind[]): number[] {
  const d = cells.map(() => -1);
  const queue: number[] = [];
  cells.forEach((k, i) => {
    if (k === 'fire') {
      d[i] = 0;
      queue.push(i);
    }
  });
  for (let h = 0; h < queue.length; h += 1) {
    const cur = queue[h] as number;
    for (const n of neighbours(cur)) {
      if ((d[n] ?? 0) >= 0 || !burnable(cells[n])) continue;
      d[n] = (d[cur] ?? 0) + 1;
      queue.push(n);
    }
  }
  return d;
}

/** Ни до одного дома огонь больше не доберётся — дома в безопасности, победа (§5). */
export function housesSafe(cells: readonly CellKind[]): boolean {
  const d = fireDistance(cells);
  return cells.every((k, i) => k !== 'house' || (d[i] ?? -1) < 0);
}

/**
 * Спасено земли: трава и дома, которые не сгорели к моменту победы (§7, попап
 * победы). Раунд кончается, как только дома в безопасности, — то, что не
 * сгорело к этому моменту, больше никогда не сгорит в этой партии, даже если
 * у остатков огня формально ещё был бы куда шагнуть (решение автора
 * 2026-09-27: игрок видит поле как есть, а не гипотезу «а что, если бы
 * доиграли»). Стены не считаются.
 */
export function savedCount(cells: readonly CellKind[]): number {
  return cells.filter((k) => k === 'grass' || k === 'house').length;
}

/** Клетки фигуры с якорем (клетка `0,0` повёрнутой фигуры) в `anchor`; `null` — за краем поля. */
export function cellsAt(letter: ShapeLetter, rot: number, anchor: Cell): number[] | null {
  const out: number[] = [];
  for (const [dy, dx] of shapeCells(letter, rot)) {
    const r = anchor.row + dy;
    const c = anchor.col + dx;
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
    out.push(r * SIZE + c);
  }
  return out;
}

/** Правило 1 (§4): фигура целиком на траве. */
export function fits(cells: readonly CellKind[], at: readonly number[] | null): boolean {
  return at !== null && at.every((i) => cells[i] === 'grass');
}

/** Правило 8: помещается ли хоть одна фигура хода хоть одним поворотом. */
export function anyFits(level: Level, state: GameState): boolean {
  for (const letter of trayOf(level, state.turn)) {
    for (let rot = 0; rot < rotationCount(letter); rot += 1) {
      for (let row = 0; row < SIZE; row += 1) for (let col = 0; col < SIZE; col += 1) if (fits(state.cells, cellsAt(letter, rot, { row, col }))) return true;
    }
  }
  return false;
}

export interface TurnResult {
  readonly state: GameState;
  /** Клетки, ставшие стеной (пусто при пропуске хода). */
  readonly placed: readonly number[];
  /** Сделал ли огонь шаг (нет — если постановка сразу заперла огонь). */
  readonly stepped: boolean;
  /** Загоревшиеся этим шагом клетки. */
  readonly ignited: readonly number[];
  /** Клетки прежнего фронта, ставшие пеплом. */
  readonly ashed: readonly number[];
  /** Загоревшиеся дома. */
  readonly burnedHouses: readonly number[];
}

/**
 * Один ход (§4 п.2–7, порядок §5): стена → дома в безопасности (победа, без шага) →
 * шаг огня → дом загорелся (`house_burned`) → дома в безопасности (победа) →
 * следующий ход. «Дома в безопасности» — огню некуда расти или ни до одного дома
 * он больше не доберётся. Пустой `placed` — пропуск хода (правило 8).
 */
function resolveTurn(state: GameState, placed: readonly number[]): TurnResult {
  const cells = [...state.cells];
  for (const i of placed) cells[i] = 'wall';
  if (nextBurn(cells).size === 0 || housesSafe(cells)) {
    return { state: { ...state, cells, status: 'won', failReason: null }, placed, stepped: false, ignited: [], ashed: [], burnedHouses: [] };
  }
  const add = [...nextBurn(cells)];
  const ashed: number[] = [];
  cells.forEach((k, i) => {
    if (k === 'fire') {
      cells[i] = 'ash';
      ashed.push(i);
    }
  });
  const burnedHouses = add.filter((i) => cells[i] === 'house');
  for (const i of add) cells[i] = 'fire';
  let status: GameState['status'] = 'playing';
  let failReason: FailReason | null = null;
  if (burnedHouses.length > 0) {
    status = 'failed';
    failReason = 'house_burned';
  } else if (nextBurn(cells).size === 0 || housesSafe(cells)) status = 'won';
  const next: GameState = {
    ...state,
    cells,
    turn: status === 'playing' ? state.turn + 1 : state.turn,
    rotations: status === 'playing' ? [0, 0, 0] : state.rotations,
    rotationsLeft: status === 'playing' ? ROTATIONS_PER_TURN : state.rotationsLeft,
    status,
    failReason,
  };
  return { state: next, placed, stepped: true, ignited: add, ashed, burnedHouses };
}

/** Постановка фигуры слота `slot` текущим поворотом с якорем `anchor`. `null` — нельзя (§4). */
export function place(level: Level, state: GameState, slot: number, anchor: Cell): TurnResult | null {
  if (state.status !== 'playing') return null;
  const letter = trayOf(level, state.turn)[slot];
  if (letter === undefined) return null;
  const at = cellsAt(letter, state.rotations[slot] ?? 0, anchor);
  if (at === null || !fits(state.cells, at)) return null;
  return resolveTurn(state, at);
}

/** Пропуск хода, когда ни одна фигура не помещается (правило 8). */
export function skipTurn(level: Level, state: GameState): TurnResult | null {
  if (state.status !== 'playing' || anyFits(level, state)) return null;
  return resolveTurn(state, []);
}

/** Тап по фигуре хода: следующий поворот по часовой. `null` — нельзя, в том числе когда повороты хода кончились. */
export function rotateSlot(level: Level, state: GameState, slot: number): GameState | null {
  if (state.status !== 'playing' || state.rotationsLeft <= 0) return null;
  const letter = trayOf(level, state.turn)[slot];
  if (letter === undefined) return null;
  const rotations = [...state.rotations] as [number, number, number];
  rotations[slot] = ((rotations[slot] ?? 0) + 1) % rotationCount(letter);
  return { ...state, rotations, rotationsLeft: state.rotationsLeft - 1 };
}

