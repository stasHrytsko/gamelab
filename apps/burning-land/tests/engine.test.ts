import { describe, expect, it } from 'vitest';
import { anyFits, cellsAt, centerOffset, createState, housesSafe, nextBurn, place, ROTATIONS_PER_TURN, rotateSlot, rotationCount, savedCount, skipTurn, trayOf } from '../src/engine/fireEngine.ts';
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

  it('огонь может взять только карман без домов — победа первой же постановкой, без шага', () => {
    // a8 горит, b8 — трава в тупике из стен: до дома h1 огонь не доберётся.
    const pocket: Level = { ...level, rows: ['F.W.....', 'WW......', ...level.rows.slice(2)], shapes: 'MMMMMM' };
    expect(housesSafe(createState(pocket).cells)).toBe(true);
    const r = place(pocket, createState(pocket), 0, { row: 4, col: 4 });
    expect(r?.stepped).toBe(false);
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

  it('дома отрезаны от огня стеной — победа сразу, хотя огню ещё есть куда расти', () => {
    // Дом h1 в углу: стены g1 и h2 отрезают его, огонь a8 ещё может жечь всё поле.
    const corner: Level = { ...level, rows: ['F.......', '........', '........', '........', '........', '........', '.......W', '........'].map((r, i) => (i === 7 ? '.......H' : r)), shapes: 'MMM'.repeat(10) };
    const r = place(corner, createState(corner), 0, { row: 7, col: 6 });
    expect(nextBurn(r?.state.cells ?? []).size).toBeGreaterThan(0);
    expect(housesSafe(r?.state.cells ?? [])).toBe(true);
    expect(r?.state.status).toBe('won');
    expect(r?.stepped).toBe(false);
  });

  it('спасено земли — трава и дома, до которых огонь не дойдёт', () => {
    const corner: Level = { ...level, rows: ['F.......', '........', '........', '........', '........', '........', '.......W', '......WH'], shapes: 'MMM' };
    expect(savedCount(createState(corner).cells)).toBe(1); // только дом h1
    const open: Level = { ...level, rows: ['F.W.....', 'WW......', ...level.rows.slice(2)] };
    // Огонь a8 может взять только b8: спасено 64 − огонь − b8 − 3 стены = 59.
    expect(savedCount(createState(open).cells)).toBe(59);
  });

  it('повороты: 3 на ход на все три фигуры, четвёртый нельзя; на новом ходу снова 3', () => {
    let s = createState(level);
    expect(s.rotationsLeft).toBe(ROTATIONS_PER_TURN);
    s = rotateSlot(level, s, 0) as GameState;
    s = rotateSlot(level, s, 1) as GameState;
    s = rotateSlot(level, s, 0) as GameState;
    expect(s.rotationsLeft).toBe(0);
    expect(rotateSlot(level, s, 2)).toBeNull();
    const r = place(level, s, 2, { row: 5, col: 5 });
    expect(r?.state.rotationsLeft).toBe(3);
  });

  it('трёх поворотов хватает на любой поворот одной фигуры', () => {
    for (const letter of ['M', 'D', 'I', 'V', 'O', 'L', 'S', 'T'] as const) expect(rotationCount(letter) - 1).toBeLessThanOrEqual(ROTATIONS_PER_TURN);
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
      rows: ['F.H.WWWW', '.WWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWWWWWW'],
      shapes: 'OOO'.repeat(5),
    };
    const s = createState(packed);
    expect(anyFits(packed, s)).toBe(false);
    expect(place(packed, s, 0, { row: 0, col: 1 })).toBeNull();
    const r = skipTurn(packed, s);
    expect(r?.placed).toEqual([]);
    expect(r?.stepped).toBe(true);
    expect(r?.state.status).toBe('playing'); // огонь в b8 и a7, дом c8 ещё под угрозой
    expect(r?.state.turn).toBe(1);
    expect(skipTurn(level, createState(level))).toBeNull(); // когда фигура влезает, пропуска нет
  });
});
