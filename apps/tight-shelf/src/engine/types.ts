/** Поле 4×4, клетка — индекс `row * 4 + col` (§3). */
export const SIZE = 4;
/** Сколько следующих фигур видно в очереди, кроме текущей (§3). */
export const PREVIEW = 3;

export type Color = 'B' | 'Y' | 'C';
export type Shape = 'o' | 's' | 't';
/** Фигура: цвет + форма, `'Bt'` — синий треугольник. */
export type Piece = `${Color}${Shape}`;
/** Правило клетки: цвет, форма или `.` — любая фигура. */
export type Rule = Color | Shape | '.';

export interface Level {
  readonly id: number;
  readonly seed: number;
  /** Четыре строки поля сверху вниз, по символу на клетку. */
  readonly rules: readonly string[];
  readonly queue: readonly Piece[];
}

export type Status = 'playing' | 'won' | 'failed';
export type FailReason = 'no_moves';

export interface GameState {
  readonly level: number;
  readonly rules: readonly Rule[];
  readonly board: readonly (Piece | null)[];
  readonly queue: readonly Piece[];
  /** Индекс текущей фигуры в очереди. */
  readonly turn: number;
  readonly status: Status;
  readonly failReason: FailReason | null;
}

/** Что произошло за ход — для анимации и лога. */
export interface Move {
  readonly cell: number;
  readonly piece: Piece;
  /** Число собранных линий: 2 и больше — двойная очистка. */
  readonly lines: number;
  /** Клетки исчезнувших фигур. */
  readonly cleared: readonly number[];
  /** Клетки каждой собранной линии — для подсветки полосой. */
  readonly lineCells: readonly (readonly number[])[];
}
