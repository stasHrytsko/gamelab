import type { Cell, Dir, Enemy, GameState, Level, Mode, Move, StepInfo } from './types.ts';
import { SIZE } from './types.ts';

export const DIRS: readonly Dir[] = ['^', '>', 'v', '<'];
export const DELTA: Record<Dir, readonly [number, number]> = { '^': [-1, 0], '>': [0, 1], v: [1, 0], '<': [0, -1] };

const inside = (row: number, col: number): boolean => row >= 0 && row < SIZE && col >= 0 && col < SIZE;

export function createState(level: Level): GameState {
  return { level: level.id, hero: level.hero, enemies: level.enemies, moves: 0, moveLimit: level.moveLimit, status: 'playing', failReason: null };
}

const enemyAt = (enemies: readonly Enemy[], row: number, col: number): Enemy | undefined =>
  enemies.find((e) => e.row === row && e.col === col);

/** Подряд стоящие враги от (row, col) в направлении d; обрывается на пустой клетке или краю. */
function line(enemies: readonly Enemy[], row: number, col: number, d: readonly [number, number]): string[] {
  const ids: string[] = [];
  let r = row;
  let c = col;
  while (inside(r, c)) {
    const e = enemyAt(enemies, r, c);
    if (e === undefined) break;
    ids.push(e.id);
    r += d[0];
    c += d[1];
  }
  return ids;
}

/** Шаг в соседнюю свободную клетку; `null`, если клетка за краем или занята. */
export function stepInfo(state: Pick<GameState, 'hero' | 'enemies'>, dir: Dir): StepInfo | null {
  const [dr, dc] = DELTA[dir];
  const to: Cell = { row: state.hero.row + dr, col: state.hero.col + dc };
  if (!inside(to.row, to.col) || enemyAt(state.enemies, to.row, to.col) !== undefined) return null;
  return {
    dir,
    to,
    forward: line(state.enemies, to.row + dr, to.col + dc, [dr, dc]),
    back: line(state.enemies, state.hero.row - dr, state.hero.col - dc, [-dr, -dc]),
  };
}

export function legalSteps(state: Pick<GameState, 'hero' | 'enemies'>): StepInfo[] {
  const steps: StepInfo[] = [];
  for (const dir of DIRS) {
    const info = stepInfo(state, dir);
    if (info !== null) steps.push(info);
  }
  return steps;
}

/** Варианты хода для шага: если есть что взять — выбор между линиями, иначе просто шаг. */
export function modesOf(info: StepInfo): Mode[] {
  const modes: Mode[] = [];
  if (info.forward.length > 0) modes.push('forward');
  if (info.back.length > 0) modes.push('back');
  return modes.length > 0 ? modes : ['none'];
}

export const capturedBy = (info: StepInfo, mode: Mode): readonly string[] =>
  mode === 'forward' ? info.forward : mode === 'back' ? info.back : [];

/** Ход героя. `null` — недопустимый ход (занято, за краем, режим не подходит) или игра окончена. */
export function move(state: GameState, dir: Dir, mode: Mode): { state: GameState; move: Move } | null {
  if (state.status !== 'playing') return null;
  const info = stepInfo(state, dir);
  if (info === null) return null;
  if (!modesOf(info).includes(mode)) return null;
  const captured = capturedBy(info, mode);
  const gone = new Set(captured);
  const enemies = state.enemies.filter((e) => !gone.has(e.id));
  const moves = state.moves + 1;
  const next = { hero: info.to, enemies };
  let status: GameState['status'] = 'playing';
  let failReason: GameState['failReason'] = null;
  if (enemies.length === 0) status = 'won';
  else if (moves >= state.moveLimit) {
    status = 'failed';
    failReason = 'moves_exhausted';
  } else if (legalSteps(next).length === 0) {
    status = 'failed';
    failReason = 'no_moves';
  }
  return {
    state: { ...state, hero: info.to, enemies, moves, status, failReason },
    move: { dir, from: state.hero, to: info.to, mode, captured },
  };
}
