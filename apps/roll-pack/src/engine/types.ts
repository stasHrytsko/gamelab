/** Поле до 6×6 (§3). `#` — препятствие или клетка вне формы поля, `.` — пустая. */
export const MAX_SIZE = 6;
/** Конструктор фигуры — сетка 4×4, фигура без поворота (§3). */
export const BUILDER = 4;
export const MIN_PIECE = 4;
export const MAX_PIECE = 7;

export interface Level {
  readonly id: number;
  readonly map: readonly string[];
  /** Числа 4–7, по убыванию; сумма = числу пустых клеток. */
  readonly numbers: readonly number[];
}

/** 'wall' — препятствие, null — пусто, число — размер фигуры, занявшей клетку. */
export type Cell = 'wall' | null | number;
export type Board = readonly (readonly Cell[])[];
export type Point = readonly [row: number, col: number];

export type Status = 'playing' | 'won' | 'failed';

export interface GameState {
  readonly level: number;
  readonly board: Board;
  readonly numbers: readonly number[];
  readonly used: readonly boolean[];
  readonly status: Status;
}
