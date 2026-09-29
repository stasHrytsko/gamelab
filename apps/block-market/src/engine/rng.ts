export function hash(...xs: number[]): number {
  let h = 2166136261 >>> 0;
  for (const x of xs) {
    h ^= x >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822507) >>> 0;
  }
  return h >>> 0;
}

/** Состояние mulberry32 — одно число, чтобы его можно было хранить в GameState. */
export interface Rng {
  a: number;
}

export const makeRng = (seed: number): Rng => ({ a: seed >>> 0 });

export function nextFloat(r: Rng): number {
  r.a = (r.a + 0x6d2b79f5) >>> 0;
  let t = r.a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
