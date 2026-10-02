/** Поле 5×5. Направление шага: `^` вверх, `>` вправо, `v` вниз, `<` влево. */
export const SIZE = 5;

export type Dir = '^' | '>' | 'v' | '<';
export type Mode = 'forward' | 'back' | 'none';

export interface Cell {
  readonly row: number;
  readonly col: number;
}

export interface Enemy extends Cell {
  readonly id: string;
}

export interface Level {
  readonly id: number;
  readonly name: string;
  readonly moveLimit: number;
  readonly hero: Cell;
  readonly enemies: readonly Enemy[];
  /** Обучающий уровень: проиграть нельзя, жадный выбор тоже решает. */
  readonly tutorial: boolean;
  /** Подсказка внизу экрана для этого уровня. */
  readonly tip?: string;
  /** Куда показывает рука-подсказка до первого касания (обучающие уровни). */
  readonly hand?: Cell;
}

export type Status = 'playing' | 'won' | 'failed';
export type FailReason = 'moves_exhausted' | 'no_moves' | null;

export interface GameState {
  readonly level: number;
  readonly hero: Cell;
  readonly enemies: readonly Enemy[];
  readonly moves: number;
  readonly moveLimit: number;
  readonly status: Status;
  readonly failReason: FailReason;
}

/** Что даст шаг в клетку `to`: две линии, из которых нужно выбрать одну. */
export interface StepInfo {
  readonly dir: Dir;
  readonly to: Cell;
  /** Враги прямо за клеткой `to` (по ходу движения), в порядке от героя. */
  readonly forward: readonly string[];
  /** Враги прямо за клеткой, которую герой покинул (против хода), в порядке от героя. */
  readonly back: readonly string[];
}

export interface Move {
  readonly dir: Dir;
  readonly from: Cell;
  readonly to: Cell;
  readonly mode: Mode;
  /** id убранных врагов, в порядке «от героя». */
  readonly captured: readonly string[];
}
