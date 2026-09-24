import { createState, resolveSwipe } from '../src/engine/taxiEngine.ts';
import type { Direction, Level, LevelState, PassengerState } from '../src/engine/types.ts';

export interface SolutionMove {
  readonly taxiId: string;
  readonly row: number;
  readonly col: number;
}

export interface Solution {
  readonly moves: readonly SolutionMove[];
  /** Per passenger id: valid swipes between its activation and its pickup, pickup swipe included. */
  readonly waited: Readonly<Record<string, number>>;
  /**
   * Swipes of a taxi whose colour is not the colour of the most urgent waiting
   * passenger — the spec's `support_move_rate` numerator (§8).
   */
  readonly supportMoves: number;
  /** Pickups that happened on activation without a swipe (§5 п.6); authored levels avoid them. */
  readonly automaticPickups: number;
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
  for (const taxi of state.taxis) cells[taxi.row * 5 + taxi.col] = taxi.color[0] ?? '?';
  return cells.join('');
}

function segmentKey(state: LevelState): string {
  const passengers = state.passengers
    .map((passenger) => `${passenger.status[0] ?? '?'}${String(passenger.patience)}`)
    .join(',');
  return `${layoutKey(state)}|${passengers}`;
}

export interface SolveOptions {
  /**
   * Only swipe taxis of a colour some waiting passenger wants. A level that
   * still solves this way never forces a support move — the spec's
   * kill-criterion (§1) in solver form.
   */
  readonly targetColorsOnly?: boolean;
  /** Segment ends tried per pickup; Infinity makes the search exhaustive. */
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
    state.passengers.filter((passenger) => passenger.status === 'waiting').map((passenger) => passenger.color),
  );
  for (const taxi of state.taxis) {
    if (options.targetColorsOnly === true && !wanted.has(taxi.color)) continue;
    for (const direction of DIRECTIONS) {
      const outcome = resolveSwipe(level, state, { type: 'swipe-taxi', taxiId: taxi.id, direction });
      if (!outcome.valid || outcome.to === null) continue;
      result.push({
        state: outcome.state,
        moves: [{ taxiId: taxi.id, row: outcome.to.row, col: outcome.to.col }],
      });
    }
  }
  return result;
}

/**
 * Every layout reachable from `start` in which the served count first grows,
 * fewest swipes first. Within one segment the set of waiting passengers is
 * fixed and every swipe costs each of them one patience, so the first time a
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
    // Cheapest pickups only: deeper ends cost patience the next passengers
    // would miss, and exploring past them is where the time goes.
    if (ends.length > 0 && options.branches !== Number.POSITIVE_INFINITY) break;
  }
  return ends;
}

function mostUrgent(passengers: readonly PassengerState[]): PassengerState | undefined {
  let best: PassengerState | undefined;
  for (const passenger of passengers) {
    if (passenger.status !== 'waiting') continue;
    if (best === undefined || passenger.patience < best.patience) best = passenger;
  }
  return best;
}

/** Replays a move list through the engine and measures it. Throws on an illegal move. */
export function replay(level: Level, moves: readonly SolutionMove[]): { final: LevelState; solution: Solution } {
  let state = createState(level);
  const activatedAt = new Map<string, number>();
  const waited: Record<string, number> = {};
  let supportMoves = 0;
  let automaticPickups = 0;
  const markActive = (at: number): void => {
    for (const passenger of state.passengers) {
      if (passenger.status === 'waiting' && !activatedAt.has(passenger.id)) activatedAt.set(passenger.id, at);
    }
  };
  markActive(0);

  moves.forEach((move, index) => {
    const taxi = state.taxis.find((candidate) => candidate.id === move.taxiId);
    if (taxi === undefined) throw new Error(`Move ${String(index + 1)}: ${move.taxiId} is not on the grid.`);
    const direction: Direction =
      move.row < taxi.row ? 'up' : move.row > taxi.row ? 'down' : move.col < taxi.col ? 'left' : 'right';
    const urgent = mostUrgent(state.passengers);
    if (urgent !== undefined && urgent.color !== taxi.color) supportMoves += 1;
    const outcome = resolveSwipe(level, state, { type: 'swipe-taxi', taxiId: move.taxiId, direction });
    if (!outcome.valid) throw new Error(`Move ${String(index + 1)}: ${move.taxiId} ${direction} is invalid.`);
    for (const pickup of outcome.pickups) {
      if (pickup.automatic) automaticPickups += 1;
      waited[pickup.passengerId] = index + 1 - (activatedAt.get(pickup.passengerId) ?? 0);
    }
    state = outcome.state;
    markActive(index + 1);
  });

  return { final: state, solution: { moves, waited, supportMoves, automaticPickups } };
}

/**
 * Finds a winning move list. Depth-first over "segments" (stretches between
 * two pickups), trying the cheapest segment ends first.
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
