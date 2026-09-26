import { createState, targetCell } from '../src/engine/slideEngine.ts';
import type { Level, LevelState } from '../src/engine/types.ts';
import { nextStates } from './solver.ts';

/** Small deterministic PRNG so difficulty numbers are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How far the most urgent goal is from an exit: distance of the nearest
 * block of its colour to its cell, plus how far the nearest hole is from that
 * block (a block with no hole next to it can't move at all).
 */
function score(state: LevelState, served: number): number {
  if (state.status === 'failed') return Number.POSITIVE_INFINITY;
  if (state.status === 'won') return Number.NEGATIVE_INFINITY;
  const urgent = state.goals
    .filter((goal) => goal.status === 'waiting')
    .sort((a, b) => a.countdown - b.countdown)[0];
  const bonus = (state.served - served) * -100;
  if (urgent === undefined) return bonus;
  const target = targetCell(urgent.target);
  const occupied = new Set(state.blocks.map((block) => block.row * 5 + block.col));
  let best = Number.POSITIVE_INFINITY;
  for (const block of state.blocks) {
    if (block.color !== urgent.color) continue;
    const distance = Math.abs(block.row - target.row) + Math.abs(block.col - target.col);
    let hole = Number.POSITIVE_INFINITY;
    for (let cell = 0; cell < 25; cell += 1) {
      if (occupied.has(cell)) continue;
      hole = Math.min(hole, Math.abs(Math.floor(cell / 5) - block.row) + Math.abs((cell % 5) - block.col));
    }
    best = Math.min(best, distance * 3 + hole);
  }
  return bonus + best;
}

/**
 * A first-time player who thinks two swipes ahead for the most urgent
 * goal and now and then swipes something at random. Its win rate is the
 * difficulty signal: near-certain on level 1, rare on level 5.
 */
export function casualWinRate(level: Level, runs = 60, blunder = 0.15, seed = 1): number {
  const random = rng(seed);
  let wins = 0;
  for (let run = 0; run < runs; run += 1) {
    let state = createState(level);
    for (let step = 0; step < 120 && state.status === 'playing'; step += 1) {
      const first = nextStates(level, state);
      if (first.length === 0) break;
      let pick = first[Math.floor(random() * first.length)];
      if (random() >= blunder) {
        let bestScore = Number.POSITIVE_INFINITY;
        let best: typeof first = [];
        for (const option of first) {
          let value = score(option.state, state.served);
          if (option.state.status === 'playing' && option.state.served === state.served) {
            for (const second of nextStates(level, option.state)) {
              value = Math.min(value, score(second.state, state.served) + 0.5);
            }
          }
          if (value < bestScore) {
            bestScore = value;
            best = [option];
          } else if (value === bestScore) {
            best.push(option);
          }
        }
        pick = best[Math.floor(random() * best.length)] ?? pick;
      }
      if (pick === undefined) break;
      state = pick.state;
    }
    if (state.status === 'won') wins += 1;
  }
  return wins / runs;
}
