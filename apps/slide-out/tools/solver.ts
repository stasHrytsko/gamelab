import { createState, resolveSwipe } from '../src/engine/slideEngine.ts';
import type { Direction, Level, LevelState, GoalState } from '../src/engine/types.ts';

export interface SolutionMove {
  readonly blockId: string;
  readonly row: number;
  readonly col: number;
}

export interface Solution {
  readonly moves: readonly SolutionMove[];
  /** Per goal id: valid swipes between its activation and its match, match swipe included. */
  readonly waited: Readonly<Record<string, number>>;
  /**
   * Swipes of a block whose colour is not the colour of the most urgent waiting
   * goal — the spec's `support_move_rate` numerator (§8).
   */
  readonly supportMoves: number;
  /** Matches that happened on activation without a swipe (§5 п.6); authored levels avoid them. */
  readonly automaticMatches: number;
}

const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];
/** Distinct end layouts kept per segment by default; enough to back out of a dead end. */
const BRANCHES = 8;
/** Hard ceiling on explored states, so a bad candidate fails fast instead of hanging. */
const BUDGET = 150_000;

interface Node {
  readonly state: LevelState;
  readonly moves: readonly SolutionMove[];
}

function layoutKey(state: LevelState): string {
  const cells = new Array<string>(25).fill('.');
  for (const block of state.blocks) cells[block.row * 5 + block.col] = block.color[0] ?? '?';
  return cells.join('');
}

function segmentKey(state: LevelState): string {
  const goals = state.goals
    .map((goal) => `${goal.status[0] ?? '?'}${String(goal.countdown)}`)
    .join(',');
  return `${layoutKey(state)}|${goals}`;
}

export interface SolveOptions {
  /**
   * Only swipe blocks of a colour some waiting goal wants. A level that
   * still solves this way never forces a support move — the spec's
   * kill-criterion (§1) in solver form.
   */
  readonly targetColorsOnly?: boolean;
  /** Segment ends tried per match; Infinity makes the search exhaustive. */
  readonly branches?: number;
  /** Explored-state ceiling; defaults to BUDGET. */
  readonly budget?: number;
}

export interface SolveResult {
  readonly solution: Solution | null;
  /** False when the budget ran out: a null solution then proves nothing. */
  readonly complete: boolean;
}

export function nextStates(level: Level, state: LevelState, options: SolveOptions = {}): Node[] {
  const result: Node[] = [];
  const wanted = new Set(
    state.goals.filter((goal) => goal.status === 'waiting').map((goal) => goal.color),
  );
  for (const block of state.blocks) {
    if (options.targetColorsOnly === true && !wanted.has(block.color)) continue;
    for (const direction of DIRECTIONS) {
      const outcome = resolveSwipe(level, state, { type: 'swipe-block', blockId: block.id, direction });
      if (!outcome.valid || outcome.to === null) continue;
      result.push({
        state: outcome.state,
        moves: [{ blockId: block.id, row: outcome.to.row, col: outcome.to.col }],
      });
    }
  }
  return result;
}

/**
 * Every layout reachable from `start` in which the served count first grows,
 * fewest swipes first. Within one segment the set of waiting goals is
 * fixed and every swipe costs each of them one countdown, so the first time a
 * layout is reached is also the best time — a plain BFS over layouts is exact.
 */
function segment(
  level: Level,
  start: LevelState,
  budget: { left: number },
  options: SolveOptions,
): Node[] {
  const ends: Node[] = [];
  const endKeys = new Set<string>();
  const seen = new Set<string>([layoutKey(start)]);
  let frontier: Node[] = [{ state: start, moves: [] }];

  const branches = options.branches ?? BRANCHES;
  while (frontier.length > 0 && ends.length < branches && budget.left > 0) {
    const next: Node[] = [];
    for (const node of frontier) {
      for (const step of nextStates(level, node.state, options)) {
        budget.left -= 1;
        const moves = [...node.moves, ...step.moves];
        if (step.state.status === 'failed') continue;
        const key = layoutKey(step.state);
        if (step.state.served > start.served) {
          if (!endKeys.has(key)) {
            endKeys.add(key);
            ends.push({ state: step.state, moves });
          }
          continue;
        }
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ state: step.state, moves });
      }
    }
    frontier = next;
    // Cheapest matches only: deeper ends cost countdown the next goals
    // would miss, and exploring past them is where the time goes.
    if (ends.length > 0 && options.branches !== Number.POSITIVE_INFINITY) break;
  }
  return ends;
}

function mostUrgent(goals: readonly GoalState[]): GoalState | undefined {
  let best: GoalState | undefined;
  for (const goal of goals) {
    if (goal.status !== 'waiting') continue;
    if (best === undefined || goal.countdown < best.countdown) best = goal;
  }
  return best;
}

/** Replays a move list through the engine and measures it. Throws on an illegal move. */
export function replay(level: Level, moves: readonly SolutionMove[]): { final: LevelState; solution: Solution } {
  let state = createState(level);
  const activatedAt = new Map<string, number>();
  const waited: Record<string, number> = {};
  let supportMoves = 0;
  let automaticMatches = 0;
  const markActive = (at: number): void => {
    for (const goal of state.goals) {
      if (goal.status === 'waiting' && !activatedAt.has(goal.id)) activatedAt.set(goal.id, at);
    }
  };
  markActive(0);

  moves.forEach((move, index) => {
    const block = state.blocks.find((candidate) => candidate.id === move.blockId);
    if (block === undefined) throw new Error(`Move ${String(index + 1)}: ${move.blockId} is not on the grid.`);
    const direction: Direction =
      move.row < block.row ? 'up' : move.row > block.row ? 'down' : move.col < block.col ? 'left' : 'right';
    const urgent = mostUrgent(state.goals);
    if (urgent !== undefined && urgent.color !== block.color) supportMoves += 1;
    const outcome = resolveSwipe(level, state, { type: 'swipe-block', blockId: move.blockId, direction });
    if (!outcome.valid) throw new Error(`Move ${String(index + 1)}: ${move.blockId} ${direction} is invalid.`);
    for (const match of outcome.matches) {
      if (match.automatic) automaticMatches += 1;
      waited[match.goalId] = index + 1 - (activatedAt.get(match.goalId) ?? 0);
    }
    state = outcome.state;
    markActive(index + 1);
  });

  return { final: state, solution: { moves, waited, supportMoves, automaticMatches } };
}

/**
 * Finds a winning move list. Depth-first over "segments" (stretches between
 * two matches), trying the cheapest segment ends first.
 */
export function solveLevel(level: Level, options: SolveOptions = {}): SolveResult {
  const start = createState(level);
  if (start.status === 'won') return { solution: replay(level, []).solution, complete: true };
  const budget = { left: options.budget ?? BUDGET };
  const deadEnds = new Set<string>();

  const search = (state: LevelState, moves: readonly SolutionMove[]): readonly SolutionMove[] | null => {
    if (state.status === 'won') return moves;
    const key = segmentKey(state);
    if (deadEnds.has(key) || budget.left <= 0) return null;
    for (const end of segment(level, state, budget, options)) {
      const found = search(end.state, [...moves, ...end.moves]);
      if (found !== null) return found;
    }
    if (budget.left > 0) deadEnds.add(key);
    return null;
  };

  const moves = search(start, []);
  return {
    solution: moves === null ? null : replay(level, moves).solution,
    complete: moves !== null || (budget.left > 0 && (options.branches ?? BRANCHES) === Number.POSITIVE_INFINITY),
  };
}

export function solve(level: Level, options: SolveOptions = {}): Solution | null {
  return solveLevel(level, options).solution;
}
