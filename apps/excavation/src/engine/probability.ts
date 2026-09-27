import { neighbours } from './digEngine.ts';
import type { GameState } from './types.ts';

// Точная вероятность ловушки под каждой закрытой плитой при известных числах и
// общем числе ловушек (§4, «Удержание», решение автора 2026-09-27). Порт
// `trapProbabilities` из tools/excavation-solver.mjs без изменений —
// tests/engine.test.ts сверяет результаты. Перебор назначений ловушек на
// «границу» (закрытые плиты рядом с открытыми числами), каждое назначение
// весит C(остальные закрытые, ловушек − на границе).

function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
  return r;
}

/** Индекс закрытой плиты → вероятность ловушки 0..1. */
export function trapProbabilities(s: GameState): Map<number, number> {
  const { rows, cols, clue, open } = s;
  const traps = s.level.traps;
  const n = rows * cols;
  const closed: number[] = [];
  for (let i = 0; i < n; i += 1) if (!open[i]) closed.push(i);

  const isFrontier = new Array<boolean>(n).fill(false);
  const constraints: Array<{ cells: number[]; need: number }> = [];
  for (let i = 0; i < n; i += 1) {
    if (!open[i]) continue;
    const cells = neighbours(rows, cols, i).filter((j) => !open[j]);
    if (cells.length === 0) continue;
    constraints.push({ cells, need: clue[i] ?? 0 });
    for (const j of cells) isFrontier[j] = true;
  }
  const frontier = closed.filter((i) => isFrontier[i]);
  const others = closed.length - frontier.length;
  const idx = new Map(frontier.map((c, k) => [c, k]));
  const cons = constraints.map((c) => ({ cells: c.cells.map((j) => idx.get(j) ?? -1), need: c.need }));
  const byCell: number[][] = frontier.map(() => []);
  cons.forEach((c, ci) => c.cells.forEach((k) => byCell[k]?.push(ci)));

  const assign = new Array<number>(frontier.length).fill(0);
  const placedIn = cons.map(() => 0);
  const openIn = cons.map((c) => c.cells.length);
  const trapWeight = new Array<number>(frontier.length).fill(0);
  let total = 0;
  let otherTrapWeight = 0;

  const rec = (k: number, f: number): void => {
    if (f > traps) return;
    if (k === frontier.length) {
      const w = binom(others, traps - f);
      if (!w) return;
      total += w;
      for (let q = 0; q < frontier.length; q += 1) if (assign[q]) trapWeight[q] = (trapWeight[q] ?? 0) + w;
      if (others) otherTrapWeight += (w * (traps - f)) / others;
      return;
    }
    const mine = byCell[k] ?? [];
    for (const v of [0, 1]) {
      let ok = true;
      for (const ci of mine) {
        const need = cons[ci]?.need ?? 0;
        const p = (placedIn[ci] ?? 0) + v;
        const left = (openIn[ci] ?? 0) - 1;
        if (p > need || p + left < need) ok = false;
      }
      if (!ok) continue;
      assign[k] = v;
      for (const ci of mine) {
        placedIn[ci] = (placedIn[ci] ?? 0) + v;
        openIn[ci] = (openIn[ci] ?? 0) - 1;
      }
      rec(k + 1, f + v);
      for (const ci of mine) {
        placedIn[ci] = (placedIn[ci] ?? 0) - v;
        openIn[ci] = (openIn[ci] ?? 0) + 1;
      }
    }
    assign[k] = 0;
  };
  rec(0, 0);

  const p = new Map<number, number>();
  if (total === 0) return p;
  frontier.forEach((c, k) => p.set(c, (trapWeight[k] ?? 0) / total));
  const po = others ? otherTrapWeight / total : 0;
  for (const c of closed) if (!isFrontier[c]) p.set(c, po);
  return p;
}
