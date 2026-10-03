/** Поле 6×6 (§3). Клетка — `row` (0–5, сверху вниз) и `col` (0–5, слева направо). */
export const SIZE = 6;

export interface Cell {
  readonly row: number;
  readonly col: number;
}

export type Kind = 'soil' | 'stone' | 'water' | 'start' | 'goal';

/**
 * Level в формате солвера (§6): строки сверху вниз, `.` земля, `#` камень,
 * `A` старт, `B` цель, цифра — вода с этим `+X`.
 */
export interface Level {
  readonly id: number;
  readonly name: string;
  /** Стартовый запас ходов. */
  readonly start: number;
  readonly rows: readonly string[];
  /** Обучающий уровень (1–2): запас с люфтом, жадная стратегия проходит (§6). */
  readonly tutorial: boolean;
}

export type Status = 'playing' | 'won' | 'failed';
export type FailReason = 'moves_exhausted' | 'no_moves';

export interface GameState {
  readonly level: number;
  /** Корень от А до кончика включительно, `path[0]` — А. */
  readonly path: readonly Cell[];
  /** Оставшийся запас. */
  readonly moves: number;
  readonly status: Status;
  readonly failReason: FailReason | null;
}
