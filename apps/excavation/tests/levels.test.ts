import { describe, expect, it } from 'vitest';
import {
  LEVELS as SOLVER_LEVELS,
  MAX_CLUE,
  MIN_EXIT_DISTANCE,
  evaluate,
  isValid,
  layoutsFor,
  roomFromMap,
  roomTotal,
  safeOnly,
  safeSequence,
  toMap,
  trapProbabilities as solverProbabilities,
} from '../../../tools/excavation-solver.mjs';
import { trapProbabilities } from '../src/engine/probability.ts';
import { createState, tap } from '../src/engine/digEngine.ts';
import { LEVELS } from '../src/levels/levels.ts';
import type { GameState } from '../src/engine/types.ts';

const at = (s: GameState, i: number): [number, number] => [Math.floor(i / s.cols), i % s.cols];

describe('уровни (§6)', () => {
  it('игра берёт уровни из солвера без правки', () => {
    expect(LEVELS).toHaveLength(5);
    for (const [k, def] of SOLVER_LEVELS.entries()) {
      const level = LEVELS[k];
      expect(level?.id).toBe(def.id);
      expect([level?.rows, level?.cols, level?.traps]).toEqual([def.rows, def.cols, def.traps]);
      expect(level?.stars).toEqual(def.stars);
      expect(level?.layouts.map((l) => l.map)).toEqual(layoutsFor(def).map(toMap));
    }
  });

  for (const [k, level] of LEVELS.entries()) {
    const def = SOLVER_LEVELS[k];
    if (def === undefined) throw new Error('levels mismatch');

    it(`уровень ${String(level.id)}: 20 валидных раскладок — ловушки, вход, выход, числа ≤ ${String(MAX_CLUE)}`, () => {
      expect(level.layouts).toHaveLength(20);
      for (const layout of level.layouts) {
        const room = roomFromMap(layout.map, level.traps);
        expect(room.trap.filter(Boolean)).toHaveLength(level.traps);
        expect(room.clue[room.entrance]).toBe(0);
        expect(room.trap[room.exit]).toBe(false);
        const [er, ec, xr, xc] = [Math.floor(room.entrance / room.cols), room.entrance % room.cols, Math.floor(room.exit / room.cols), room.exit % room.cols];
        expect([0, room.rows - 1].includes(xr) || [0, room.cols - 1].includes(xc)).toBe(true);
        expect(Math.abs(er - xr) + Math.abs(ec - xc)).toBeGreaterThanOrEqual(MIN_EXIT_DISTANCE);
        expect(Math.max(...room.clue)).toBeLessThanOrEqual(MAX_CLUE);
        expect(roomTotal(room)).toBeGreaterThanOrEqual(level.stars[2]);
        const copy = { ...room, exit: -1 };
        expect(isValid(def, copy)).toBe(true);
        expect(copy.exit).toBe(room.exit);
      }
    });

    it(`уровень ${String(level.id)}: логика без догадок находит выход; ${level.id === 1 ? 'открывает всю комнату' : 'останавливается между 1★ и 2★'}`, () => {
      for (const layout of level.layouts) {
        const room = roomFromMap(layout.map, level.traps);
        const s = safeOnly(room);
        expect(s.open[room.exit]).toBe(true);
        if (level.id === 1) expect(s.cleared).toBe(true);
        else {
          expect(s.cleared).toBe(false);
          expect(s.gold).toBeGreaterThanOrEqual(level.stars[0]);
          expect(s.gold).toBeLessThan(level.stars[1]);
        }
      }
    });

    it(`уровень ${String(level.id)}: логика солвера в движке даёт то же золото и находит выход`, () => {
      for (const [n, layout] of level.layouts.entries()) {
        const room = roomFromMap(layout.map, level.traps);
        let s = createState(level, n);
        for (const i of safeSequence(room)) {
          const res = tap(s, ...at(s, i));
          expect(res?.kind).not.toBe('trap');
          s = res?.state as GameState;
        }
        expect(s.gold).toBe(safeOnly(room).gold);
        expect(s.exitFound).toBe(true);
        expect(s.status).toBe(level.id === 1 ? 'won' : 'playing');
      }
    });
  }

  // Подсветка при удержании (§4) считает вероятности портом солвера — сверяем.
  it('вероятности ловушки в игре совпадают с солвером на каждом шаге логики', () => {
    for (const level of LEVELS.slice(1)) {
      for (const [n, layout] of level.layouts.slice(0, 5).entries()) {
        const room = roomFromMap(layout.map, level.traps);
        let s = createState(level, n);
        for (const i of safeSequence(room)) {
          const mine = trapProbabilities(s);
          const ref = solverProbabilities(room, s.open);
          expect(mine.size).toBe(ref.size);
          for (const [c, v] of ref) expect(mine.get(c) ?? -1).toBeCloseTo(v, 9);
          s = tap(s, ...at(s, i))?.state as GameState;
        }
      }
    }
  });

  // Закрытый вопрос backlog-версии (§6, §8): логика против случайного тапа.
  it('логический бот проходит уровни 2–5 всегда, случайный — реже 25%', () => {
    for (const def of SOLVER_LEVELS.slice(1)) {
      const { out } = evaluate(def, 40);
      expect(out['safe→exit']?.win).toBe(1);
      expect(out['random']?.win ?? 1).toBeLessThan(0.25);
    }
  });

  // Баланс под kill-критерий (§6, §8): на 3–5 «до 2★» и «до 3★» почти равны.
  it('уровни 3–5: боты «до 2★» и «до 3★» расходятся не больше чем на 0,3 звезды (пул 200)', () => {
    for (const def of SOLVER_LEVELS.slice(2)) {
      const pool = layoutsFor(def, 200, 100000 + def.id * 10000);
      const { out } = evaluate(def, 1, pool);
      const a = out['push 2★']?.stars ?? 0;
      const b = out['push 3★']?.stars ?? 0;
      expect(Math.abs(a - b), `уровень ${String(def.id)}: ${a.toFixed(2)} vs ${b.toFixed(2)}`).toBeLessThanOrEqual(0.3);
    }
  });
});
