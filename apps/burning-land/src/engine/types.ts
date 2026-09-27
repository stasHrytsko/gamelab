/** Поле 8×8 (§3). Клетка — `row` (0–7, сверху вниз) и `col` (0–7, слева направо); индекс `row * 8 + col`. */
export const SIZE = 8;

export interface Cell {
  readonly row: number;
  readonly col: number;
}

export type CellKind = 'grass' | 'wall' | 'fire' | 'ash' | 'house';
export type ShapeLetter = 'M' | 'D' | 'I' | 'V' | 'O' | 'L' | 'S' | 'T';

/**
 * Уровень в формате солвера (§6): строки сверху вниз, `.` трава, `F` огонь,
 * `H` дом. `shapes` — очередь фигур, по три на ход.
 */
export interface Level {
  readonly id: number;
  readonly name: string;
  readonly rows: readonly string[];
  readonly shapes: string;
  /** Обучающий уровень (1–2): обе наивные стратегии проходят (§6). */
  readonly tutorial: boolean;
}

export type Status = 'playing' | 'won' | 'failed';
export type FailReason = 'house_burned';

export interface GameState {
  readonly level: number;
  readonly cells: readonly CellKind[];
  /** Номер хода с 0: фигуры хода — `shapes[turn*3 .. turn*3+2]`. */
  readonly turn: number;
  /** Поворот каждой из трёх фигур хода; на новом ходу — 0. */
  readonly rotations: readonly [number, number, number];
  /** Сколько поворотов осталось в этом ходу (§4: 3 на ход, общий на три фигуры). */
  readonly rotationsLeft: number;
  readonly status: Status;
  readonly failReason: FailReason | null;
}
