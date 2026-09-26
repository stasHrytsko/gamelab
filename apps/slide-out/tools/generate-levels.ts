/**
 * Builds mechanic/levels/levels.json and tests/solutions.json.
 *
 *   npm run levels                      — пересобрать из SEEDS
 *   npm run levels -- search <level> <from> [count]  — искать зерно
 *
 * Deterministic: the same seeds give the same pack. Each level is a random
 * layout that the solver must clear; countdown is then set from the solver's
 * route plus the level's slack, and the candidate is kept only when its
 * difficulty lands in the band below.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createState } from '../src/engine/slideEngine.ts';
import type { Level, GoalDefinition, Side, Block, BlockColor } from '../src/engine/types.ts';
import { casualWinRate, rng } from './bot.ts';
import { replay, solve, solveLevel, type Solution } from './solver.ts';

interface Band {
  readonly goals: number;
  readonly empties: number;
  /** unlockAfterServed per goal, in order. */
  readonly waves: readonly number[];
  /** Extra countdown over what the solver's route needs. */
  readonly slack: number;
  /** Longest wait the route may ask of one goal. */
  readonly maxWait: number;
  readonly minWait: number;
  readonly minSupportMoves: number;
  /** Must the level be impossible when only wanted colours move? */
  readonly needsSupport: boolean;
  readonly casual: readonly [number, number];
}

// Порядок появления целей — решение автора (спека §6):
// 1→1→1, 1→1→2, 1→2→2, 1→2→2→2, 1→2→2→3.
const BANDS: readonly Band[] = [
  { goals: 3, empties: 8, waves: [0, 1, 2], slack: 5, minWait: 2, maxWait: 4, minSupportMoves: 0, needsSupport: false, casual: [0.9, 1] },
  { goals: 4, empties: 4, waves: [0, 1, 2, 2], slack: 4, minWait: 2, maxWait: 5, minSupportMoves: 1, needsSupport: true, casual: [0.35, 0.8] },
  { goals: 5, empties: 5, waves: [0, 1, 1, 3, 3], slack: 3, minWait: 2, maxWait: 6, minSupportMoves: 2, needsSupport: true, casual: [0.15, 0.6] },
  { goals: 7, empties: 4, waves: [0, 1, 1, 3, 3, 5, 5], slack: 3, minWait: 2, maxWait: 7, minSupportMoves: 3, needsSupport: true, casual: [0.05, 0.4] },
  { goals: 8, empties: 4, waves: [0, 1, 1, 3, 3, 5, 5, 5], slack: 2, minWait: 2, maxWait: 9, minSupportMoves: 10, needsSupport: true, casual: [0, 0.03] },
];

const COLORS: readonly BlockColor[] = ['red', 'blue', 'yellow'];
const EDGE: readonly { side: Side; index: number; row: number; col: number }[] = [
  ...[0, 1, 2, 3, 4].map((index) => ({ side: 'top' as const, index, row: 0, col: index })),
  ...[0, 1, 2, 3, 4].map((index) => ({ side: 'bottom' as const, index, row: 4, col: index })),
  ...[0, 1, 2, 3, 4].map((index) => ({ side: 'left' as const, index, row: index, col: 0 })),
  ...[0, 1, 2, 3, 4].map((index) => ({ side: 'right' as const, index, row: index, col: 4 })),
];

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

function candidate(id: number, band: Band, random: () => number, countdown: (index: number) => number): Level {
  const cells = shuffle(
    Array.from({ length: 25 }, (_, index) => ({ row: Math.floor(index / 5), col: index % 5 })),
    random,
  );
  const blockCells = cells.slice(band.empties);
  const colors = shuffle(
    blockCells.map((_, index) => COLORS[index % COLORS.length] as BlockColor),
    random,
  );
  const blocks: Block[] = blockCells.map((cell, index) => ({
    id: `block-${String(index + 1)}`,
    color: colors[index] as BlockColor,
    row: cell.row,
    col: cell.col,
  }));

  // Distinct match cells, so two waiting goals never share one.
  const used = new Set<string>();
  const goals: GoalDefinition[] = [];
  for (const edge of shuffle(EDGE, random)) {
    if (goals.length === band.goals) break;
    const key = `${String(edge.row)}:${String(edge.col)}`;
    if (used.has(key)) continue;
    used.add(key);
    const index = goals.length;
    // Never the colour already standing on the match cell: that would be a
    // free match the moment the goal appears.
    const standing = blocks.find((block) => block.row === edge.row && block.col === edge.col)?.color;
    const options = COLORS.filter((color) => color !== standing);
    goals.push({
      id: `goal-${String(index + 1)}`,
      color: options[Math.floor(random() * options.length)] as BlockColor,
      target: { side: edge.side, index: edge.index },
      initialCountdown: countdown(index),
      unlockAfterServed: band.waves[index] ?? 0,
    });
  }
  return { id, gridSize: 5, blocks, goals };
}

interface Built {
  readonly level: Level;
  readonly solution: Solution;
  readonly casual: number;
}

export const reasons = new Map<string, number>();
function reject(reason: string): null {
  reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  return null;
}

function build(id: number, band: Band, seed: number): Built | null {
  // Draw the layout once with the longest allowed wait to find a route…
  const draft = candidate(id, band, rng(seed), () => band.maxWait);
  for (const color of COLORS) {
    const blocks = draft.blocks.filter((block) => block.color === color).length;
    if (blocks < draft.goals.filter((goal) => goal.color === color).length) return reject('colors');
  }
  if (createState(draft).served > 0) return reject('free-start');
  const route = solve(draft, { budget: 12_000 * band.goals });
  if (route === null) return reject('no-route');
  const waits = draft.goals.map((goal) => route.waited[goal.id] ?? 0);
  if (waits.some((wait) => wait < band.minWait || wait > band.maxWait)) return reject('waits');

  // …then redraw the same layout with countdown set from that route.
  const level = candidate(id, band, rng(seed), (index) => (waits[index] ?? 0) + band.slack);
  const checked = replay(level, route.moves);
  if (checked.final.status !== 'won') return reject('replay');
  if (checked.solution.supportMoves < band.minSupportMoves) return reject('support');
  // A match that happens by itself on activation is a free win (§5 п.6).
  if (checked.solution.automaticMatches > 0) return reject('auto');

  if (band.needsSupport) {
    const direct = solveLevel(level, { targetColorsOnly: true, branches: Number.POSITIVE_INFINITY });
    if (direct.solution !== null || !direct.complete) return reject('direct');
  }
  const casual = casualWinRate(level, 40);
  if (casual < band.casual[0]) return reject(`casual-hard-${String(Math.round(casual * 10))}`);
  if (casual > band.casual[1]) return reject(`casual-easy-${String(Math.round(casual * 10))}`);
  return { level, solution: checked.solution, casual };
}

/**
 * Seeds that produced the shipped pack. `search <level> <from> <count>` looks
 * for a new one; running with no arguments rebuilds the files from these.
 */
const SEEDS: readonly number[] = [1528, 2367, 2382, 4082, 30030];

const [mode, levelArg, fromArg, countArg] = process.argv.slice(2);
if (mode === 'search') {
  const id = Number(levelArg);
  const band = BANDS[id - 1];
  if (band === undefined) throw new Error('Unknown level.');
  const from = Number(fromArg);
  for (let seed = from; seed < from + Number(countArg ?? 500); seed += 1) {
    const built = build(id, band, seed);
    if ((seed - from) % 25 === 24) process.stderr.write(`  seed ${String(seed)}: ${JSON.stringify(Object.fromEntries(reasons))}\n`);
    if (built === null) continue;
    process.stdout.write(
      `level ${String(id)}: seed ${String(seed)}, route ${String(built.solution.moves.length)} swipes, ` +
        `support ${String(built.solution.supportMoves)}, casual win ${String(Math.round(built.casual * 100))}%\n`,
    );
  }
} else {
  const levels: Level[] = [];
  const solutions: { level: number; moves: Solution['moves'] }[] = [];
  BANDS.forEach((band, index) => {
    const id = index + 1;
    const built = build(id, band, SEEDS[index] ?? 0);
    if (built === null) throw new Error(`Seed ${String(SEEDS[index])} no longer fits level ${String(id)}.`);
    levels.push(built.level);
    solutions.push({ level: id, moves: built.solution.moves });
    process.stdout.write(
      `level ${String(id)}: route ${String(built.solution.moves.length)} swipes, support ` +
        `${String(built.solution.supportMoves)}, casual win ${String(Math.round(built.casual * 100))}%\n`,
    );
  });
  const here = dirname(fileURLToPath(import.meta.url));
  writeFileSync(
    join(here, '../src/levels/levels.json'),
    `${JSON.stringify({ schemaVersion: 1, levels }, null, 2)}\n`,
  );
  writeFileSync(join(here, 'solutions.json'), `${JSON.stringify(solutions, null, 2)}\n`);
}
