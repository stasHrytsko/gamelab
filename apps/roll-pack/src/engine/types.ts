export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type Dice = readonly [DieValue, DieValue, DieValue];
export type DieIndex = 0 | 1 | 2;

/** Поле: 6 столбцов, у всех одна высота силуэта `cap` (§1, §3). */
export const WIDTH = 6;

export interface Level {
  readonly id: number;
  readonly cap: number;
}

export type Status = 'playing' | 'won' | 'failed';

export interface GameState {
  readonly level: number;
  readonly cap: number;
  /** Длина 6, значения 0..cap. */
  readonly heights: readonly number[];
  readonly rollsMade: number;
  readonly dice: Dice;
  readonly planksPlaced: number;
  readonly status: Status;
}

/** Источник случайности: число в [0, 1). В игре — Math.random. */
export type Random = () => number;
