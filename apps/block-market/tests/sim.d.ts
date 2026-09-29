// Типы симулятора экономики (tools/block-market-sim.mjs) — только то, что берёт тест парности.
declare module '*block-market-sim.mjs' {
  export function hash(...xs: number[]): number;
  export function rng(seed: number): () => number;
  export function deal(level: number, board: Uint8Array, r: () => number, hostile?: boolean): { type: string; cells: number[][] };
  export const CFG: {
    PIECES: number; START_COINS: number; CAP: number; LEVEL_BONUS: number; MAX_LEVELS: number;
    ROT90: number; FLIP: number; REROLL: number; SWAP_ADD: number; HOSTILE_EVERY: number;
    goal(level: number): number; blockers(level: number): number; hostK(level: number): number; income(lines: number): number;
  };
}
