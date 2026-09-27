import { describe, expect, it } from 'vitest';
import { GAME_LEVELS, greedyFront, greedyHouse, isTrapPick, solve, tutorialPick, winsWithoutWalls, type Move, type SolverLevel } from '../../../tools/burning-land-solver.mjs';
import { anyFits, cellOf, createState, fits, cellsAt, place, rotateSlot, skipTurn, trayOf } from '../src/engine/fireEngine.ts';
import { LEVELS } from '../src/levels/levels.ts';
import type { GameState, Level } from '../src/engine/types.ts';

/**
 * Прогоняет линию солвера через движок игры. `null` в линии — ход, где полезных
 * постановок нет: в игре ставится первая влезающая фигура (она не трогает огонь).
 */
export function play(level: Level, line: ReadonlyArray<Move | null>): GameState {
  let s = createState(level);
  for (const move of line) {
    if (s.status !== 'playing') break;
    if (!anyFits(level, s)) {
      const r = skipTurn(level, s);
      if (r === null) throw new Error('skip refused');
      s = r.state;
      continue;
    }
    const m = move ?? firstFit(level, s);
    for (let k = 0; k < m.rot; k += 1) s = rotateSlot(level, s, m.slot) as GameState;
    const r = place(level, s, m.slot, { row: m.row, col: m.col });
    if (r === null) throw new Error(`${level.name}: engine rejects ${m.letter} at ${String(m.row)},${String(m.col)}`);
    expect([...r.placed].sort((a, b) => a - b)).toEqual([...m.cells].sort((a, b) => a - b));
    s = r.state;
  }
  return s;
}

function firstFit(level: Level, s: GameState): Move {
  const letters = trayOf(level, s.turn);
  for (let slot = 0; slot < letters.length; slot += 1) {
    const letter = letters[slot];
    if (letter === undefined) continue;
    for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) {
      const at = cellsAt(letter, 0, { row, col });
      if (fits(s.cells, at) && at !== null) return { letter, rot: 0, row, col, cells: at, slot };
    }
  }
  throw new Error('nothing fits');
}

const asSolver = (l: Level): SolverLevel => ({ name: l.name, rows: l.rows, shapes: l.shapes, tutorial: l.tutorial });

describe('уровни (§6)', () => {
  it('игра берёт уровни из солвера без правки', () => {
    expect(LEVELS.map(({ name, rows, shapes, tutorial }) => ({ name, rows, shapes, tutorial }))).toEqual(
      GAME_LEVELS.map(({ name, rows, shapes, tutorial }) => ({ name, rows, shapes, tutorial: tutorial === true })),
    );
  });

  it('очагов и домов по уровням как в §6', () => {
    const count = (l: Level, ch: string): number => l.rows.join('').split(ch).length - 1;
    expect(LEVELS.map((l) => count(l, 'F'))).toEqual([1, 2, 2, 3, 3]);
    expect(LEVELS.map((l) => count(l, 'H'))).toEqual([2, 3, 3, 4, 5]);
  });

  for (const level of LEVELS) {
    const lvl = asSolver(level);

    it(`${level.name}: победная линия солвера побеждает в движке игры`, () => {
      const r = solve(lvl);
      expect(r.solvable).toBe(true);
      expect(play(level, r.line ?? []).status).toBe('won');
    });

    it(`${level.name}: без стен дома горят`, () => {
      expect(winsWithoutWalls(lvl)).toBe(false);
    });

    it(`${level.name}: линии наивных стратегий дают в движке тот же исход`, () => {
      for (const g of [greedyFront(lvl), greedyHouse(lvl)]) {
        const s = play(level, g.log);
        expect(s.status).toBe(g.won ? 'won' : 'failed');
      }
    });
  }

  for (const level of LEVELS.filter((l) => l.tutorial)) {
    it(`${level.name}: обучающий — обе наивные стратегии проходят, выигрывает больше половины первых постановок`, () => {
      expect(tutorialPick(asSolver(level))).not.toBeNull();
    });
  }

  // Kill-критерий в форме теста (§1, §6): на уровнях с ловушкой обе наивные
  // стратегии проигрывают, победных первых постановок от 2 до трети.
  for (const level of LEVELS.filter((l) => !l.tutorial)) {
    it(`${level.name}: ловушка — «отодвигай от ближайшего дома» и «закрывай фронт» проигрывают`, () => {
      const lvl = asSolver(level);
      expect(greedyHouse(lvl).won).toBe(false);
      expect(greedyFront(lvl).won).toBe(false);
      expect(isTrapPick(lvl)).not.toBeNull();
    });
  }

  it('индексы клеток совпадают с солвером (row * 8 + col)', () => {
    expect(cellOf(13)).toEqual({ row: 1, col: 5 });
  });
});
