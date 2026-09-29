import { describe, expect, it } from 'vitest';
import { DIRS, createState, planReturn, planSwipe } from '../src/engine/gapEngine.ts';
import type { GameState, Level } from '../src/engine/types.ts';
import { LEVELS } from '../src/levels/levels.ts';
import { moves as solverMoves } from '../../../tools/the-gap-solver.mjs';

// Движок игры и солвер — одни правила (specs/40-the-gap.md, приложение A).
// На случайных партиях из старта каждого уровня допустимые ходы совпадают
// с `moves` солвера, а результаты одинаковы клетка в клетку.
const key = (s: { field: readonly number[]; flasks: readonly (readonly number[])[] }): string => `${s.field.join('')}|${s.flasks.map((f) => f.join('')).join(',')}`;

function engineMoves(level: Level, s: GameState): string[] {
  const out: string[] = [];
  for (let y = 0; y < level.h; y += 1) {
    for (let x = 0; x < level.w; x += 1) {
      for (const dir of DIRS) {
        const p = planSwipe(level, s, x, y, dir);
        if (p !== null) out.push(`swipe ${String(x)},${String(y)},${dir} => ${key(p)}`);
      }
    }
  }
  for (let n = 1; n <= 4; n += 1) {
    const p = planReturn(level, s, n);
    if (p !== null) out.push(`tap ${String(n)} => ${key(p)}`);
  }
  return out.sort();
}

function referenceMoves(level: Level, s: GameState): string[] {
  const lv = { w: level.w, h: level.h, exits: [...level.exits], caps: [...level.caps], field: [...level.field], flasks: level.flasks.map((f) => [...f]) };
  const st = { field: [...s.field], flasks: s.flasks.map((f) => [...f]) };
  return solverMoves(lv, st, true)
    .map((m) => (m.act.type === 'swipe' ? `swipe ${String(m.act.x)},${String(m.act.y)},${m.act.dir} => ${key(m)}` : `tap ${String(m.act.n)} => ${key(m)}`))
    .sort();
}

describe('движок = солвер', () => {
  for (const level of LEVELS) {
    it(`${level.name}: случайные партии дают одинаковые ходы`, () => {
      let seed = level.seed * 7919 + 13;
      const rand = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      for (let game = 0; game < 12; game += 1) {
        let s = createState(level);
        for (let step = 0; step < 25; step += 1) {
          const ours = engineMoves(level, s);
          expect(ours).toEqual(referenceMoves(level, s));
          if (ours.length === 0) break;
          const pick = ours[Math.floor(rand() * ours.length)] ?? '';
          const swipeMatch = /^swipe (\d+),(\d+),(\w+)/.exec(pick);
          const p = swipeMatch !== null
            ? planSwipe(level, s, Number(swipeMatch[1]), Number(swipeMatch[2]), swipeMatch[3] as (typeof DIRS)[number])
            : planReturn(level, s, Number(/^tap (\d)/.exec(pick)?.[1]));
          if (p === null) throw new Error('ход из списка недопустим');
          s = { ...s, field: p.field, flasks: p.flasks, moves: s.moves + 1 };
        }
      }
    });
  }
});
