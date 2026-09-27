import { describe, expect, it } from 'vitest';
import { anyFits, cellsAt, centerOffset, createState, nextBurn, place, rotateSlot, rotationCount, skipTurn, trayOf } from '../src/engine/fireEngine.ts';
import type { GameState, Level } from '../src/engine/types.ts';

// 8×8: огонь в a8 (0,0), дом в h1 (7,7). Очередь: ход 1 — D I M, ход 2 — O O O, дальше M.
const level: Level = {
  id: 99,
  name: 'T',
  tutorial: true,
  rows: ['F.......', '........', '........', '........', '........', '........', '........', '.......H'],
  shapes: `DIM${'OOO'}${'MMM'.repeat(20)}`,
};
const at = (row: number, col: number): number => row * 8 + col;

describe('постановка (§4)', () => {
  it('старт: ход 0, фигуры хода — первые три буквы очереди', () => {
    const s = createState(level);
    expect(s.turn).toBe(0);
    expect(trayOf(level, 0)).toEqual(['D', 'I', 'M']);
    expect(trayOf(level, 1)).toEqual(['O', 'O', 'O']);
  });

  it('клетки фигуры становятся стеной, огонь шагает, ход +1', () => {
    const r = place(level, createState(level), 0, { row: 5, col: 5 });
    expect(r).not.toBeNull();
    expect(r?.placed).toEqual([at(5, 5), at(5, 6)]);
    expect(r?.state.cells[at(5, 5)]).toBe('wall');
    expect(r?.state.cells[at(0, 0)]).toBe('ash');
    expect(r?.state.cells[at(0, 1)]).toBe('fire');
    expect(r?.state.cells[at(1, 0)]).toBe('fire');
    expect(r?.state.turn).toBe(1);
    expect(r?.state.status).toBe('playing');
  });

  it('на огонь, дом, стену и за край ставить нельзя', () => {
    const s = createState(level);
    expect(place(level, s, 2, { row: 0, col: 0 })).toBeNull(); // огонь
    expect(place(level, s, 2, { row: 7, col: 7 })).toBeNull(); // дом
    expect(place(level, s, 0, { row: 3, col: 7 })).toBeNull(); // домино за краем
    const s2 = place(level, s, 2, { row: 4, col: 4 })?.state as GameState;
    expect(place(level, s2, 0, { row: 4, col: 3 })).toBeNull(); // квадрат на стене
  });

  it('на пепел ставить нельзя', () => {
    const s = place(level, createState(level), 2, { row: 5, col: 5 })?.state as GameState;
    expect(s.cells[at(0, 0)]).toBe('ash');
    expect(place(level, s, 0, { row: 0, col: 0 })).toBeNull();
  });

  it('поворот по часовой: палка I встаёт вертикально, у квадрата поворот один', () => {
    const s = rotateSlot(level, createState(level), 1) as GameState;
    expect(s.rotations).toEqual([0, 1, 0]);
    expect(cellsAt('I', 1, { row: 2, col: 2 })).toEqual([at(2, 2), at(3, 2), at(4, 2)]);
    expect(rotationCount('O')).toBe(1);
    expect(rotationCount('T')).toBe(4);
    expect(rotationCount('S')).toBe(2);
    const r = place(level, s, 1, { row: 2, col: 2 });
    expect(r?.placed).toEqual([at(2, 2), at(3, 2), at(4, 2)]);
  });

  it('поворот L: зеркала нет, четыре разных поворота', () => {
    const shapes = [0, 1, 2, 3].map((k) => JSON.stringify(cellsAt('L', k, { row: 0, col: 0 })));
    expect(new Set(shapes).size).toBe(4);
    expect(shapes).not.toContain(JSON.stringify([at(0, 0), at(0, 1), at(0, 2), at(1, 2)])); // зеркальная Г
  });

  it('центр под пальцем: floor(maxRow/2), floor(maxCol/2)', () => {
    expect(centerOffset('I', 0)).toEqual([0, 1]);
    expect(centerOffset('T', 0)).toEqual([0, 1]);
    expect(centerOffset('O', 0)).toEqual([0, 0]);
  });

  it('на новом ходу повороты сбрасываются', () => {
    const s = rotateSlot(level, createState(level), 0) as GameState;
    const r = place(level, s, 2, { row: 5, col: 5 });
    expect(r?.state.rotations).toEqual([0, 0, 0]);
  });
});

describe('победа и поражение (§5)', () => {
  it('постановка, после которой огню некуда расти, — победа сразу, огонь не шагает', () => {
    const locked: Level = { ...level, rows: ['FW......', '........', ...level.rows.slice(2)], shapes: 'MMMMMM' };
    const w = place(locked, createState(locked), 0, { row: 1, col: 0 });
    expect(w?.stepped).toBe(false);
    expect(w?.ignited).toEqual([]);
    expect(w?.state.status).toBe('won');
    expect(w?.state.cells[at(0, 0)]).toBe('fire');
  });

  it('огонь шагнул, и новому фронту некуда расти — победа', () => {
    // a8 горит, b8 — трава в тупике из стен: после шага огню некуда.
    const pocket: Level = { ...level, rows: ['F.W.....', 'WW......', ...level.rows.slice(2)], shapes: 'MMMMMM' };
    const r = place(pocket, createState(pocket), 0, { row: 4, col: 4 });
    expect(r?.stepped).toBe(true);
    expect(r?.ignited).toEqual([at(0, 1)]);
    expect(r?.state.status).toBe('won');
    expect(r?.state.turn).toBe(0);
  });

  it('дом рядом с фронтом загорается — поражение house_burned', () => {
    const near: Level = { ...level, rows: ['F.H.....', '........', ...level.rows.slice(2, 7), '........'], shapes: 'MMM'.repeat(10) };
    let s = createState(near);
    s = place(near, s, 0, { row: 5, col: 5 })?.state as GameState; // огонь → b8
    expect(s.status).toBe('playing');
    const r = place(near, s, 0, { row: 6, col: 6 });
    expect(r?.burnedHouses).toEqual([at(0, 2)]);
    expect(r?.state.status).toBe('failed');
    expect(r?.state.failReason).toBe('house_burned');
    expect(r?.state.turn).toBe(s.turn);
  });

  it('после конца попытки ни постановка, ни поворот невозможны', () => {
    const locked: Level = { ...level, rows: ['FW......', '........', ...level.rows.slice(2)], shapes: 'MMMMMM' };
    const won = place(locked, createState(locked), 0, { row: 1, col: 0 })?.state as GameState;
    expect(place(locked, won, 1, { row: 4, col: 4 })).toBeNull();
    expect(rotateSlot(locked, won, 0)).toBeNull();
  });

  it('точки превью — соседи фронта по траве и домам', () => {
    const s = createState(level);
    expect([...nextBurn(s.cells)].sort((a, b) => a - b)).toEqual([at(0, 1), at(1, 0)]);
  });

  it('ни одна фигура не влезает — ход пропускается, огонь шагает (правило 8)', () => {
    // Трава — только a7 и b8 рядом с огнём и h1-угол занят; фигуры хода — квадраты.
    const packed: Level = {
      ...level,
      rows: ['F.WWWWWW', '.WWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWH'],
      shapes: 'OOO'.repeat(5),
    };
    const s = createState(packed);
    expect(anyFits(packed, s)).toBe(false);
    expect(place(packed, s, 0, { row: 0, col: 1 })).toBeNull();
    const r = skipTurn(packed, s);
    expect(r?.placed).toEqual([]);
    expect(r?.stepped).toBe(true);
    expect(r?.state.status).toBe('won'); // a7 и b8 сгорели, дальше некуда
    expect(skipTurn(level, createState(level))).toBeNull(); // когда фигура влезает, пропуска нет
  });
});
