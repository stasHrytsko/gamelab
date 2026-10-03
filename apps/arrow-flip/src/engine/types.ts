/** Поле 4×4 (§3). Направление стрелки: `^` вверх, `>` вправо, `v` вниз, `<` влево. */
export const SIZE = 4;

export type Dir = '^' | '>' | 'v' | '<';

export interface Block {
  readonly id: string;
  readonly row: number;
  readonly col: number;
  readonly dir: Dir;
}

export interface Level {
  readonly id: number;
  readonly name: string;
  readonly moveLimit: number;
  readonly blocks: readonly Block[];
  /** Level не содержит ловушки: жадная стратегия решает, проиграть нельзя (§6). */
  readonly tutorial: boolean;
}

export type Status = 'playing' | 'won' | 'failed';
export type FailReason = 'moves_exhausted' | 'no_moves' | null;

export interface GameState {
  readonly level: number;
  readonly blocks: readonly Block[];
  readonly moves: number;
  readonly moveLimit: number;
  readonly status: Status;
  readonly failReason: FailReason;
}
