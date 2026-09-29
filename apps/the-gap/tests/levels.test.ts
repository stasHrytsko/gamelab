import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { apply, createState } from '../src/engine/gapEngine.ts';
import type { Level } from '../src/engine/types.ts';
import { LEVELS } from '../src/levels/levels.ts';
import { explore, isWin } from '../../../tools/the-gap-solver.mjs';

const tools = JSON.parse(readFileSync(new URL('../../../tools/the-gap-levels.json', import.meta.url), 'utf8')) as { id: string; seed: number; opt: number; field: number[]; flasks: number[][] }[];

const toSolver = (l: Level) => ({ w: l.w, h: l.h, exits: [...l.exits], caps: [...l.caps], field: [...l.field], flasks: l.flasks.map((f) => [...f]) });

describe('уровни (§6)', () => {
  it('копия в src/levels совпадает с tools/the-gap-levels.json', () => {
    expect(LEVELS.map((l) => ({ id: l.name, seed: l.seed, opt: l.opt, field: [...l.field], flasks: l.flasks.map((f) => [...f]) }))).toEqual(
      tools.map((t) => ({ id: t.id, seed: t.seed, opt: t.opt, field: t.field, flasks: t.flasks })),
    );
  });

  for (const level of LEVELS) {
    it(`${level.name}: решение солвера через движок побеждает ровно за opt ходов`, () => {
      let s = createState(level);
      expect(level.solution).toHaveLength(level.opt);
      level.solution.forEach((action, i) => {
        const out = apply(level, s, action);
        expect(out, `ход ${String(i + 1)}`).not.toBeNull();
        if (out !== null) s = out.state;
      });
      expect(s.status).toBe('won');
      expect(s.moves).toBe(level.opt);
      expect(s.stars).toBe(3);
    });

    it(`${level.name}: лимит = ceil(2 × opt), звёзды = opt + 2 и ceil(1.5 × opt)`, () => {
      expect(level.limit).toBe(Math.ceil(2 * level.opt));
      expect(level.stars3).toBe(level.opt + 2);
      expect(level.stars2).toBe(Math.ceil(1.5 * level.opt));
    });

    // Kill-критерий в форме теста (§1, §6): без возвратов из колб уровень
    // нерешаем, значит «назначь цвет колбе и веди прямо» его не проходит.
    it(`${level.name}: без возвратов нерешаем`, () => {
      const g = explore(toSolver(level), false);
      expect(g).not.toBeNull();
      expect(g?.nodes.some((n) => isWin(toSolver(level), n))).toBe(false);
    });

    it(`${level.name}: в решении не меньше ${String(level.minReturns)} возвратов`, () => {
      const returns = level.solution.filter((a) => a.type === 'tap-flask').length;
      expect(returns).toBeGreaterThanOrEqual(level.minReturns);
      expect(level.minReturns).toBeGreaterThanOrEqual(1);
    });
  }

  it('возвратов минимум два на уровнях 3–5', () => {
    for (const level of LEVELS.slice(2)) expect(level.minReturns).toBeGreaterThanOrEqual(2);
  });
});
