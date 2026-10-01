/**
 * Подбор уровней солвером: `npx tsx tools/gen-levels.ts`.
 * Печатает кандидатов в формате levels.ts. Уровни выбирает солвер, а не человек.
 *  - ловушка: лимит равен оптимуму, жадная стратегия (всегда максимальное взятие) не решает;
 *  - обучающий: лимит оптимум+2, жадная стратегия решает.
 */
import { solve, countOptimal, type Position } from '../src/engine/solver.ts';
import type { Enemy } from '../src/engine/types.ts';
import { SIZE } from '../src/engine/types.ts';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS: readonly (readonly [number, number])[] = [[0, 1], [1, 0]];

/** Случайная раскладка из отрезков длиной 1–3: линии и есть материал для «вперёд/назад». */
function randomPosition(rand: () => number, segments: number): Position | null {
  const taken = new Set<string>();
  const heroRow = Math.floor(rand() * SIZE);
  const heroCol = Math.floor(rand() * SIZE);
  taken.add(`${String(heroRow)},${String(heroCol)}`);
  const enemies: Enemy[] = [];
  for (let s = 0; s < segments; s += 1) {
    const len = 1 + Math.floor(rand() * 3);
    const d = DIRS[Math.floor(rand() * 2)] as readonly [number, number];
    const r0 = Math.floor(rand() * SIZE);
    const c0 = Math.floor(rand() * SIZE);
    const cells: [number, number][] = [];
    for (let i = 0; i < len; i += 1) cells.push([r0 + d[0] * i, c0 + d[1] * i]);
    if (cells.some(([r, c]) => r >= SIZE || c >= SIZE || taken.has(`${String(r)},${String(c)}`))) continue;
    for (const [r, c] of cells) {
      taken.add(`${String(r)},${String(c)}`);
      enemies.push({ id: String(enemies.length), row: r, col: c });
    }
  }
  return enemies.length >= 3 ? { hero: { row: heroRow, col: heroCol }, enemies } : null;
}

const rand = rng(Number(process.argv[2] ?? 7));
const want = process.argv[3] ?? 'trap';
const found: string[] = [];
for (let i = 0; i < 400000 && found.length < 14; i += 1) {
  const pos = randomPosition(rand, 2 + Math.floor(rand() * 4));
  if (pos === null) continue;
  const best = solve(pos, 8);
  if (best === null) continue;
  const n = best.length;
  const greedy = solve(pos, n, true);
  const choices = best.path.filter((a) => a.choice).length;
  if (want === 'trap') {
    if (n < 3 || n > 6 || greedy !== null || choices < Number(process.argv[4] ?? 1) || pos.enemies.length < Number(process.argv[5] ?? 4)) continue;
    const ways = countOptimal(pos, n);
    if (ways > 6) continue;
    found.push(JSON.stringify({ n, enemies: pos.enemies.length, ways, choices, hero: pos.hero, e: pos.enemies.map((e) => [e.row, e.col]) }));
  } else {
    if (n < 2 || n > 3 || greedy === null || choices < 1) continue;
    found.push(JSON.stringify({ n, enemies: pos.enemies.length, choices, hero: pos.hero, e: pos.enemies.map((e) => [e.row, e.col]) }));
  }
}
process.stdout.write(found.join('\n') + '\n');
