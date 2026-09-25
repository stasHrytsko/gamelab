/**
 * Точная вероятность победы (§6). Игрок не знает будущих бросков и на каждом
 * ходу берёт кубик и позицию с наибольшей вероятностью победы. Считается
 * перебором всех поверхностей поля и всех бросков трёх кубиков.
 */
import { isFull, placeHeights, validPositions } from '../src/engine/rollEngine.ts';
import type { Dice, DieValue } from '../src/engine/types.ts';

export interface Move {
  readonly length: number;
  readonly x: number;
}

/** 56 наборов трёх кубиков без учёта порядка, с вероятностями. */
export const ROLLS: readonly { readonly dice: Dice; readonly p: number }[] = (() => {
  const counts = new Map<string, number>();
  for (let a = 1; a <= 6; a += 1)
    for (let b = 1; b <= 6; b += 1)
      for (let c = 1; c <= 6; c += 1) {
        const key = [a, b, c].sort().join('');
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
  return [...counts].map(([key, n]) => ({ dice: [...key].map(Number) as unknown as Dice, p: n / 216 }));
})();

export function movesFor(heights: readonly number[], cap: number, dice: readonly number[]): Move[] {
  const out: Move[] = [];
  for (const length of new Set(dice)) {
    for (const x of validPositions(heights, cap, length)) out.push({ length, x });
  }
  return out;
}

export type Policy = (heights: readonly number[], cap: number, dice: Dice) => Move | null;

export class Solver {
  private readonly memo = new Map<string, number>();
  constructor(readonly cap: number) {}

  /** Вероятность победы идеального игрока с этой поверхности (перед броском). */
  value(heights: readonly number[]): number {
    if (isFull(heights, this.cap)) return 1;
    const key = heights.join('');
    const cached = this.memo.get(key);
    if (cached !== undefined) return cached;
    let total = 0;
    for (const { dice, p } of ROLLS) total += p * this.best(heights, dice).value;
    this.memo.set(key, total);
    return total;
  }

  best(heights: readonly number[], dice: readonly number[]): { move: Move | null; value: number } {
    let move: Move | null = null;
    let value = 0;
    for (const candidate of movesFor(heights, this.cap, dice)) {
      const v = this.value(placeHeights(heights, candidate.length, candidate.x));
      if (move === null || v > value) {
        move = candidate;
        value = v;
      }
    }
    return { move, value };
  }

  readonly optimal: Policy = (heights, _cap, dice) => this.best(heights, dice).move;

  /** Точная вероятность победы игрока, который всегда ходит по policy. */
  policyValue(policy: Policy, heights: readonly number[] = Array.from({ length: 6 }, () => 0), memo = new Map<string, number>()): number {
    if (isFull(heights, this.cap)) return 1;
    const key = heights.join('');
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let total = 0;
    for (const { dice, p } of ROLLS) {
      const move = policy(heights, this.cap, dice);
      if (move !== null) total += p * this.policyValue(policy, placeHeights(heights, move.length, move.x), memo);
    }
    memo.set(key, total);
    return total;
  }
}

const steps = (heights: readonly number[]): number =>
  heights.reduce((n, h, i) => (i > 0 && h !== heights[i - 1] ? n + 1 : n), 0);

/** «Держи ровно»: меньше всего перепадов высоты после хода; при равенстве — длиннее, ниже, левее. */
export const keepFlat: Policy = (heights, cap, dice) => {
  let best: Move | null = null;
  let score: number[] = [];
  for (const move of movesFor(heights, cap, dice)) {
    const s = [steps(placeHeights(heights, move.length, move.x)), -move.length, heights[move.x] ?? 0, move.x];
    if (best === null || less(s, score)) {
      best = move;
      score = s;
    }
  }
  return best;
};

function less(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/** «Бери длинное»: самая длинная длина, у которой есть позиция, в самую левую. */
export const takeLongest: Policy = (heights, cap, dice) => {
  const lengths = [...new Set(dice)].sort((a, b) => b - a) as DieValue[];
  for (const length of lengths) {
    const x = validPositions(heights, cap, length)[0];
    if (x !== undefined) return { length, x };
  }
  return null;
};
