import { WIDTH, type Dice, type DieIndex, type DieValue, type GameState, type Level, type Random } from './types.ts';

export function rollDie(random: Random): DieValue {
  return (Math.floor(random() * 6) + 1) as DieValue;
}

export function rollDice(random: Random): Dice {
  return [rollDie(random), rollDie(random), rollDie(random)];
}

/** §3: планка длины `length` в позиции `x` валидна, если все её столбцы одной высоты и ниже cap. */
export function isValidPosition(heights: readonly number[], cap: number, length: number, x: number): boolean {
  if (x < 0 || x + length > WIDTH) return false;
  const h = heights[x];
  if (h === undefined || h >= cap) return false;
  for (let i = x + 1; i < x + length; i += 1) {
    if (heights[i] !== h) return false;
  }
  return true;
}

export function validPositions(heights: readonly number[], cap: number, length: number): number[] {
  const out: number[] = [];
  for (let x = 0; x + length <= WIDTH; x += 1) {
    if (isValidPosition(heights, cap, length, x)) out.push(x);
  }
  return out;
}

export const fits = (heights: readonly number[], cap: number, length: number): boolean =>
  validPositions(heights, cap, length).length > 0;

export const isFull = (heights: readonly number[], cap: number): boolean => heights.every((h) => h === cap);

export const anyFits = (heights: readonly number[], cap: number, dice: Dice): boolean =>
  dice.some((value) => fits(heights, cap, value));

export function placeHeights(heights: readonly number[], length: number, x: number): number[] {
  return heights.map((h, col) => (col >= x && col < x + length ? h + 1 : h));
}

/** Новая попытка: пустое поле и первый случайный бросок. */
export function createState(level: Level, random: Random): GameState {
  const heights = Array.from({ length: WIDTH }, () => 0);
  const dice = rollDice(random);
  return {
    level: level.id,
    cap: level.cap,
    heights,
    rollsMade: 1,
    dice,
    planksPlaced: 0,
    status: anyFits(heights, level.cap, dice) ? 'playing' : 'failed',
  };
}

export type PlaceOutcome =
  | { readonly valid: false; readonly state: GameState }
  | { readonly valid: true; readonly state: GameState; readonly completedRows: number[] };

/**
 * §5: уложить планку выбранного кубика в позицию x.
 * Порядок: обновить высоты → победа → новый бросок → поражение no_fit.
 */
export function place(state: GameState, die: DieIndex, x: number, random: Random): PlaceOutcome {
  if (state.status !== 'playing') return { valid: false, state };
  const length = state.dice[die];
  if (!isValidPosition(state.heights, state.cap, length, x)) return { valid: false, state };

  const row = state.heights[x] ?? 0;
  const heights = placeHeights(state.heights, length, x);
  const completedRows = heights.every((h) => h > row) ? [row] : [];
  const placed = { ...state, heights, planksPlaced: state.planksPlaced + 1 };

  if (isFull(heights, state.cap)) return { valid: true, completedRows, state: { ...placed, status: 'won' } };

  const dice = rollDice(random);
  const status = anyFits(heights, state.cap, dice) ? 'playing' : 'failed';
  return { valid: true, completedRows, state: { ...placed, dice, rollsMade: state.rollsMade + 1, status } };
}
