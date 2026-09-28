import { describe, expect, it } from 'vitest';
import * as solver from '../../../tools/tight-shelf-solver.mjs';
import { createState, fits, legal, legalNow, place, tapCell, WINDOWS } from '../src/engine/shelfEngine.ts';
import type { GameState, Level, Piece, Rule } from '../src/engine/types.ts';

const empty = (): (Piece | null)[] => new Array<Piece | null>(16).fill(null);
const level = (rules: string[], queue: Piece[]): Level => ({ id: 1, seed: 0, rules, queue });

describe('правило клетки (§3)', () => {
  it('фигура подходит по цвету, по форме или в джокер', () => {
    expect(fits('B', 'Bt')).toBe(true);
    expect(fits('t', 'Bt')).toBe(true);
    expect(fits('.', 'Bt')).toBe(true);
    expect(fits('Y', 'Bt')).toBe(false);
    expect(fits('o', 'Bt')).toBe(false);
  });

  it('24 линии по три клетки', () => {
    expect(WINDOWS).toHaveLength(24);
  });
});

describe('исчезновение линий (§4)', () => {
  it('в ряду Yo Bs Bt _ фигура Bo убирает синюю тройку, Yo остаётся', () => {
    const b = empty();
    b[0] = 'Yo'; b[1] = 'Bs'; b[2] = 'Bt';
    const r = place(b, 3, 'Bo');
    expect(r.lines).toBe(1);
    expect(r.cleared.sort()).toEqual([1, 2, 3]);
    expect(r.board.slice(0, 4)).toEqual(['Yo', null, null, null]);
  });

  it('линия по форме: три круга разных цветов', () => {
    const b = empty();
    b[0] = 'Bo'; b[4] = 'Yo';
    const r = place(b, 8, 'Co');
    expect(r.cleared.sort((x, y) => x - y)).toEqual([0, 4, 8]);
  });

  it('двойная очистка: фигура на пересечении закрывает обе линии', () => {
    const b = empty();
    b[1] = 'Bs'; b[2] = 'Bt'; b[4] = 'Yo'; b[8] = 'Co';
    const r = place(b, 0, 'Bo');
    expect(r.lines).toBe(2);
    expect(r.cleared.sort((x, y) => x - y)).toEqual([0, 1, 2, 4, 8]);
  });

  it('три без общего признака не исчезают', () => {
    const b = empty();
    b[0] = 'Bo'; b[1] = 'Ys';
    const r = place(b, 2, 'Ct');
    expect(r.lines).toBe(0);
    expect(r.board.slice(0, 3)).toEqual(['Bo', 'Ys', 'Ct']);
  });

  it('линии не через поставленную фигуру не проверяются, каскадов нет', () => {
    const b = empty();
    // Собранная синяя линия 12-13-14 (такого в игре не бывает) не трогается ходом в клетку 0.
    b[12] = 'Bo'; b[13] = 'Bs'; b[14] = 'Bt';
    const r = place(b, 0, 'Yo');
    expect(r.lines).toBe(0);
    expect(r.board[12]).toBe('Bo');
  });
});

describe('ход (§4–5)', () => {
  const lv = level(['BYC.', 'osto', '....', '....'], ['Bt', 'Ys', 'Co']);

  it('ставит фигуру в подходящую клетку и сдвигает очередь', () => {
    const out = tapCell(createState(lv), 0);
    expect(out).not.toBeNull();
    expect(out?.state.board[0]).toBe('Bt');
    expect(out?.state.turn).toBe(1);
    expect(out?.state.status).toBe('playing');
  });

  it('клетка с чужим правилом — ход не тратится', () => {
    const s = createState(lv);
    expect(tapCell(s, 1)).toBeNull(); // Y
    expect(tapCell(s, 4)).toBeNull(); // o
  });

  it('занятая клетка — ход не тратится', () => {
    const s1 = tapCell(createState(lv), 3)?.state as GameState;
    expect(tapCell(s1, 3)).toBeNull();
    expect(s1.turn).toBe(1);
  });

  it('последняя фигура поставлена — победа, фигуры на поле не мешают', () => {
    let s = createState(lv);
    for (const cell of [0, 1, 2]) s = (tapCell(s, cell) as { state: GameState }).state;
    expect(s.status).toBe('won');
    expect(s.board.filter((p) => p !== null)).toHaveLength(3);
    expect(tapCell(s, 3)).toBeNull();
  });

  it('следующей фигуре некуда встать — no_moves', () => {
    // Единственная клетка для Yo — 0; Bs занимает её, следующей Yo некуда.
    const tight = level(['.BBB', 'BBBB', 'BBBB', 'BBBB'], ['Bs', 'Yo', 'Bt']);
    const out = tapCell(createState(tight), 0);
    expect(out?.state.status).toBe('failed');
    expect(out?.state.failReason).toBe('no_moves');
  });

  it('проигрыш не объявляется, пока текущей фигуре есть куда встать', () => {
    const s = createState(level(['....', '....', '....', '....'], ['Bo', 'Ys']));
    expect(legalNow(s)).toHaveLength(16);
  });
});

describe('движок = солвер (правило записано один раз)', () => {
  it('legal и place совпадают на 3000 случайных позиций', () => {
    let seed = 7;
    const rnd = (n: number): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % n;
    };
    const types = solver.TYPES as Piece[];
    const ruleSet: Rule[] = ['B', 'Y', 'C', 'o', 's', 't', '.'];
    for (let k = 0; k < 3000; k += 1) {
      const rules = Array.from({ length: 16 }, () => ruleSet[rnd(7)] as Rule);
      const board = Array.from({ length: 16 }, () => (rnd(3) === 0 ? (types[rnd(9)] as Piece) : null));
      const piece = types[rnd(9)] as Piece;
      const mine = legal(rules, board, piece);
      expect(mine).toEqual(solver.legal(rules, board, piece));
      for (const cell of mine) {
        const a = place(board, cell, piece);
        const b = solver.place(board, cell, piece);
        expect(a.board).toEqual(b.board);
        expect(a.lines).toBe(b.lines);
        expect([...a.cleared].sort()).toEqual([...b.cleared].sort());
      }
    }
  });
});
