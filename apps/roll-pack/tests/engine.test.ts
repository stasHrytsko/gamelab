import { describe, expect, it } from 'vitest';
import { canPlace, countSolutions, createState, fitsBuilder, isConnected, isPieceReady, normalize, parseMap, place, snakeSolves, solve } from '../src/engine/packEngine.ts';
import type { GameState, Level, Point } from '../src/engine/types.ts';

const level: Level = { id: 9, map: ['....', '....', '.#..'], numbers: [7, 4] };

describe('фигура (§3–4)', () => {
  it('связность по сторонам, диагональ не считается', () => {
    expect(isConnected([[0, 0], [0, 1], [1, 1]])).toBe(true);
    expect(isConnected([[0, 0], [1, 1]])).toBe(false);
  });
  it('готова, только когда клеток ровно N и они связны', () => {
    expect(isPieceReady([[0, 0], [0, 1], [0, 2], [0, 3]], 4)).toBe(true);
    expect(isPieceReady([[0, 0], [0, 1], [0, 2]], 4)).toBe(false);
    expect(isPieceReady([[0, 0], [0, 1], [2, 2], [2, 3]], 4)).toBe(false);
  });
  it('форма сдвигается в левый верхний угол и должна помещаться в 4×4', () => {
    expect(normalize([[2, 3], [2, 4], [3, 4]])).toEqual([[0, 0], [0, 1], [1, 1]]);
    expect(fitsBuilder([[0, 0], [0, 1], [0, 2], [0, 3]])).toBe(true);
    expect(fitsBuilder([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]])).toBe(false);
  });
});

describe('укладка (§4–5)', () => {
  const start = (): GameState => createState(level);

  it('ставится только на пустые клетки', () => {
    const board = parseMap(level.map);
    expect(canPlace(board, [[2, 0], [1, 0]])).toBe(true);
    expect(canPlace(board, [[2, 1]])).toBe(false);
    expect(canPlace(board, [[3, 0]])).toBe(false);
  });

  it('фигура не той формы или не на пустых клетках — ничего не меняется', () => {
    const s = start();
    expect(place(s, 1, [[0, 0], [0, 1], [0, 2]]).valid).toBe(false);
    expect(place(s, 1, [[2, 0], [2, 1], [2, 2], [2, 3]]).valid).toBe(false);
  });

  it('укладка занимает клетки, число гаснет, повторно его не взять', () => {
    const out = place(start(), 1, [[0, 0], [0, 1], [0, 2], [0, 3]]);
    expect(out.valid).toBe(true);
    expect(out.state.board[0]).toEqual([4, 4, 4, 4]);
    expect(out.state.used).toEqual([false, true]);
    expect(out.state.status).toBe('playing');
    expect(place(out.state, 1, [[1, 0], [1, 1], [1, 2], [1, 3]]).valid).toBe(false);
  });

  it('победа: все числа использованы', () => {
    const a = place(start(), 1, [[0, 0], [0, 1], [0, 2], [0, 3]]);
    const b = place(a.state, 0, [[1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 2], [2, 3]]);
    expect(b.state.status).toBe('won');
  });

  it('поражение unsolvable: оставшееся уже не разложить', () => {
    // Четвёрка по диагонали рвёт поле на куски, которые семёркой не закрыть.
    const out = place(start(), 1, [[0, 1], [1, 1], [1, 2], [2, 2]]);
    expect(out.valid).toBe(true);
    expect(out.state.status).toBe('failed');
  });
});

describe('солвер (§5–6)', () => {
  it('находит решение и считает решения', () => {
    const board = parseMap(level.map);
    const pieces = solve(board, level.numbers) as Point[][];
    expect(pieces.map((p) => p.length).sort()).toEqual([4, 7]);
    expect(countSolutions(board, level.numbers, 100)).toBeGreaterThan(0);
  });
  it('нет решения — null: линия из 6 клеток не помещается в 4×4', () => {
    expect(solve(parseMap(['......']), [6])).toBeNull();
    expect(solve(parseMap(['....', '#..#']), [6])).not.toBeNull();
  });
  it('змейка: два ряда по 4 решаются, поле из двух кусков — нет', () => {
    expect(snakeSolves(parseMap(['....', '....']), [4, 4])).toBe(true);
    expect(snakeSolves(parseMap(['..#.', '..#.']), [6])).toBe(false);
  });
});
