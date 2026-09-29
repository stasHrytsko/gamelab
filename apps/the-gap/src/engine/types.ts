// Типы игры The Gap — specs/40-the-gap.md §3.
export type Color = 1 | 2 | 3;
/** 0 — пусто, -1 — стена, иначе цвет квадрата. */
export type Cell = 0 | -1 | Color;
export type Dir = 'up' | 'down' | 'left' | 'right';
export type FailReason = 'moves_exhausted' | 'no_moves';
export type Status = 'playing' | 'won' | 'failed';

export interface Exit {
  /** Клетка выхода — периметровая клетка рядом со щелью. */
  readonly x: number;
  readonly y: number;
  /** Направление наружу от рамки поля. */
  readonly dx: -1 | 0 | 1;
  readonly dy: -1 | 0 | 1;
}

export interface Level {
  readonly id: number;
  readonly name: string;
  readonly tutorial: boolean;
  readonly seed: number;
  readonly w: number;
  readonly h: number;
  readonly exits: readonly Exit[];
  readonly caps: readonly number[];
  readonly field: readonly Cell[];
  readonly flasks: readonly (readonly Color[])[];
  readonly opt: number;
  readonly limit: number;
  readonly stars3: number;
  readonly stars2: number;
  readonly minReturns: number;
  readonly solution: readonly Action[];
}

export type Action =
  | { readonly type: 'swipe'; readonly x: number; readonly y: number; readonly dir: Dir }
  | { readonly type: 'tap-flask'; readonly n: number };

export interface GameState {
  readonly field: readonly Cell[];
  readonly flasks: readonly (readonly Color[])[];
  readonly moves: number;
  readonly status: Status;
  readonly failReason: FailReason | null;
  readonly stars: 0 | 1 | 2 | 3;
}

/** Что произошло за ход — из этого строится анимация. */
export interface Move {
  readonly kind: 'slide' | 'in' | 'return';
  readonly color: Color;
  /** Клетка, откуда квадрат стартовал (для `return` — клетка выхода). */
  readonly from: { readonly x: number; readonly y: number };
  /** Клетка, где квадрат остановился (для `in` — клетка выхода). */
  readonly to: { readonly x: number; readonly y: number };
  readonly steps: number;
  /** Номер колбы 1..4 для `in` и `return`. */
  readonly flask: number | null;
}

export interface Outcome {
  readonly state: GameState;
  readonly move: Move;
}
