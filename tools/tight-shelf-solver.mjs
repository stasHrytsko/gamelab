#!/usr/bin/env node

/**
 * Tight Shelf — точный солвер, боты и подбор уровней (specs/06-tight-shelf.md).
 *
 * Правила (§4–5 спеки):
 * - поле 4×4, у клетки правило: цвет (B, Y, C), форма (o, s, t) или '.' — любая фигура;
 * - фигура = цвет + форма ('Bo' — синий круг); очередь фиксирована уровнем;
 * - текущая фигура ставится в пустую клетку, чьё правило ей подходит; фигуры не двигаются;
 * - после постановки: все линии из 3 клеток (гор., верт., диаг.) через эту фигуру,
 *   где у трёх фигур общий цвет или общая форма, исчезают одновременно;
 * - поражение no_moves: текущей фигуре нет ни одной подходящей пустой клетки;
 * - победа: поставлена последняя фигура очереди.
 *
 * node tools/tight-shelf-solver.mjs            — подобрать 5 уровней и напечатать JSON
 * node tools/tight-shelf-solver.mjs --report   — метрики уровней из tools/tight-shelf-levels.json
 * node tools/tight-shelf-solver.mjs --log F     — kill-метрика §8 по логу игры (JSON из localStorage)
 * node tools/tight-shelf-solver.mjs --ab       — A/B вариантов геометрии (история решения)
 */

export const SIZE = 4;
export const COLORS = ['B', 'Y', 'C'];
export const SHAPES = ['o', 's', 't'];
export const TYPES = COLORS.flatMap((c) => SHAPES.map((s) => c + s));
const RULES = [...COLORS, ...SHAPES];

export const WINDOWS = (() => {
  const out = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [0, 1, 2].map((i) => [r + dr * i, c + dc * i]);
      if (cells.every(([y, x]) => y >= 0 && y < SIZE && x >= 0 && x < SIZE)) out.push(cells.map(([y, x]) => y * SIZE + x));
    }
  }
  return out;
})();
const WINDOWS_AT = Array.from({ length: SIZE * SIZE }, (_, i) => WINDOWS.filter((w) => w.includes(i)));

export const fits = (rule, ball) => rule === '.' || rule === ball[0] || rule === ball[1];
const share = (a, b, c) => (a[0] === b[0] && a[0] === c[0]) || (a[1] === b[1] && a[1] === c[1]);

export function legal(rules, board, ball) {
  const out = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (board[i] === null && fits(rules[i], ball)) out.push(i);
  return out;
}

/** Поставить фигуру. Возвращает новое поле, число линий и исчезнувшие клетки. */
export function place(board, cell, ball) {
  const b = board.slice();
  b[cell] = ball;
  const kill = new Set();
  let lines = 0;
  for (const w of WINDOWS_AT[cell]) {
    if (w.some((x) => b[x] === null)) continue;
    if (share(b[w[0]], b[w[1]], b[w[2]])) { lines++; w.forEach((x) => kill.add(x)); }
  }
  kill.forEach((x) => (b[x] = null));
  return { board: b, lines, cleared: [...kill] };
}

export const flatRules = (level) => level.rules.join('').split('');
const empty = () => new Array(SIZE * SIZE).fill(null);

/** Точный солвер: можно ли поставить всю очередь из этого состояния. */
export function makeSolver(level) {
  const rules = flatRules(level);
  const memo = new Map();
  const solvable = (board, t) => {
    if (t === level.queue.length) return true;
    const key = t + '|' + board.map((x) => x ?? '__').join('');
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let ok = false;
    for (const c of legal(rules, board, level.queue[t])) {
      if (solvable(place(board, c, level.queue[t]).board, t + 1)) { ok = true; break; }
    }
    memo.set(key, ok);
    return ok;
  };
  return { rules, solvable, memo };
}

/** Одно решение уровня: клетка для каждой фигуры очереди по порядку, или null. */
export function solution(level) {
  const { rules, solvable } = makeSolver(level);
  let board = empty();
  if (!solvable(board, 0)) return null;
  const cells = [];
  for (let t = 0; t < level.queue.length; t++) {
    const piece = level.queue[t];
    const c = legal(rules, board, piece).find((x) => solvable(place(board, x, piece).board, t + 1));
    cells.push(c);
    board = place(board, c, piece).board;
  }
  return cells;
}

/** Переживёт ли игрок следующие k фигур очереди при лучшей игре. */
function survives(rules, queue, board, t, k) {
  if (k === 0 || t >= queue.length) return true;
  for (const c of legal(rules, board, queue[t])) {
    if (survives(rules, queue, place(board, c, queue[t]).board, t + 1, k - 1)) return true;
  }
  return false;
}

/**
 * Ловушки, видимые в превью: клетки для фигуры t, после которых одну из трёх следующих
 * фигур гарантированно некуда поставить, хотя другая подходящая клетка этого избегает.
 * Kill-критерий спеки сравнивает долю таких ходов у игроков и у случайного выбора клетки.
 */
export function visibleTraps(level, board, t, rules = flatRules(level)) {
  const mv = legal(rules, board, level.queue[t]);
  const safe = mv.filter((c) => survives(rules, level.queue, place(board, c, level.queue[t]).board, t + 1, 3));
  if (!safe.length || safe.length === mv.length) return [];
  return mv.filter((c) => !safe.includes(c));
}

/** Доля ходов в видимую ловушку среди ходов, где ловушка была, — у случайного выбора клетки. */
export function randomTrapRate(level, runs = 300) {
  const rules = flatRules(level);
  let chances = 0, hits = 0;
  for (let i = 0; i < runs; i++) {
    const r = rng(5000 + i);
    let board = empty();
    for (let t = 0; t < level.queue.length; t++) {
      const mv = legal(rules, board, level.queue[t]);
      if (!mv.length) break;
      const c = mv[Math.floor(r() * mv.length)];
      const traps = visibleTraps(level, board, t, rules);
      if (traps.length) { chances++; if (traps.includes(c)) hits++; }
      board = place(board, c, level.queue[t]).board;
    }
  }
  return chances ? hits / chances : 0;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Оценка без знания очереди: пустые клетки + сколько типов фигур ещё куда-то встанут. */
function evalBoard(rules, board) {
  let emptyCells = 0;
  const can = new Set();
  for (let i = 0; i < board.length; i++) if (board[i] === null) {
    emptyCells++;
    for (const t of TYPES) if (fits(rules[i], t)) can.add(t);
  }
  return emptyCells + 0.3 * can.size;
}

function lookahead(rules, queue, board, t, depth) {
  if (t >= queue.length) return 1e5;
  if (depth === 0) return evalBoard(rules, board);
  const mv = legal(rules, board, queue[t]);
  if (!mv.length) return -1e6 + t;
  let best = -Infinity;
  for (const c of mv) best = Math.max(best, lookahead(rules, queue, place(board, c, queue[t]).board, t + 1, depth - 1));
  return best;
}

/**
 * Боты. greedy — детерминированный: максимум исчезнувших фигур сейчас, при равенстве
 * первая клетка по порядку чтения (это kill-критерий в форме теста).
 * random — любая подходящая клетка. blind — лучшая оценка поля без очереди.
 * preview1 / preview3 — перебор текущего и 1 / 3 следующих фигур.
 */
export function playBot(level, bot, seed = 1) {
  const rules = flatRules(level);
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  let board = empty();
  for (let t = 0; t < level.queue.length; t++) {
    const ball = level.queue[t];
    const mv = legal(rules, board, ball);
    if (!mv.length) return { won: false, placed: t };
    let choice;
    if (bot === 'random') choice = pick(mv);
    else if (bot === 'greedy') {
      let best = -1;
      for (const c of mv) {
        const n = place(board, c, ball).cleared.length;
        if (n > best) { best = n; choice = c; }
      }
    } else {
      const depth = bot === 'blind' ? 0 : bot === 'preview1' ? 1 : 3;
      const sc = mv.map((c) => lookahead(rules, level.queue, place(board, c, ball).board, t + 1, depth));
      const mx = Math.max(...sc);
      choice = pick(mv.filter((_, i) => sc[i] === mx));
    }
    board = place(board, choice, ball).board;
  }
  return { won: true, placed: level.queue.length };
}

export function winRate(level, bot, runs) {
  let w = 0;
  for (let i = 0; i < runs; i++) if (playBot(level, bot, 1000 + i).won) w++;
  return w / runs;
}

/** Метрики уровня: решаемость, ловушки на пути решения, силы ботов. */
export function report(level, runs = { random: 2000, blind: 400, preview1: 200, preview3: 100 }) {
  const { rules, solvable } = makeSolver(level);
  const out = { id: level.id, solvable: solvable(empty(), 0) };
  // Ловушки: ходы, где есть подходящая клетка, после которой уровень уже не пройти,
  // хотя другой ход сохраняет решение. Считаем вдоль одного решения (первого найденного).
  let board = empty(), traps = 0, choices = 0, clears = 0, doubles = 0, firstTrap = null;
  if (out.solvable) for (let t = 0; t < level.queue.length; t++) {
    const ball = level.queue[t];
    const mv = legal(rules, board, ball);
    const ok = mv.filter((c) => solvable(place(board, c, ball).board, t + 1));
    if (mv.length >= 2) choices++;
    if (ok.length && ok.length < mv.length) { traps++; firstTrap ??= t + 1; }
    const res = place(board, ok[0], ball);
    if (res.lines) clears++;
    if (res.lines >= 2) doubles++;
    board = res.board;
  }
  Object.assign(out, {
    queue: level.queue.length,
    jokers: rules.filter((x) => x === '.').length,
    choices, traps, firstTrap, clears, doubles,
    greedy: playBot(level, 'greedy').won,
  });
  for (const [bot, n] of Object.entries(runs)) out[bot] = +winRate(level, bot, n).toFixed(2);
  return out;
}

/** Кривая уровней §6 спеки: доля джокеров, длина очереди и коридоры метрик. */
export const CURVE = [
  { id: 1, jokers: 8, queue: 18, accept: (m) => m.random >= 0.6 && m.greedy && m.traps <= 1 },
  { id: 2, jokers: 6, queue: 22, accept: (m) => m.random >= 0.3 && m.random <= 0.6 && m.greedy && m.traps >= 1 },
  { id: 3, jokers: 4, queue: 24, accept: (m) => !m.greedy && m.random <= 0.3 && m.preview3 >= 0.8 && m.traps >= 3 },
  { id: 4, jokers: 3, queue: 30, accept: (m) => !m.greedy && m.random <= 0.15 && m.blind <= 0.5 && m.preview3 >= 0.7 && m.traps >= 5 },
  { id: 5, jokers: 1, queue: 36, accept: (m) => !m.greedy && m.random <= 0.05 && m.blind <= 0.3 && m.preview3 >= 0.6 && m.traps >= 7 },
];

export function generate(spec, seed) {
  const r = rng(seed * 7919 + spec.id);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const jokerSet = new Set(cells.slice(0, spec.jokers));
  const flat = Array.from({ length: SIZE * SIZE }, (_, i) => (jokerSet.has(i) ? '.' : pick(RULES)));
  const rules = [0, 1, 2, 3].map((row) => flat.slice(row * SIZE, row * SIZE + SIZE).join(''));
  const queue = Array.from({ length: spec.queue }, () => pick(TYPES));
  return { id: spec.id, seed, rules, queue };
}

export function findLevel(spec, maxSeed = 3000) {
  for (let seed = 1; seed <= maxSeed; seed++) {
    const level = generate(spec, seed);
    const flat = flatRules(level);
    // каждое из шести правил встречается хотя бы раз, начиная с уровня 2
    if (spec.id >= 2 && RULES.some((x) => !flat.includes(x))) continue;
    if (!makeSolver(level).solvable(empty(), 0)) continue;
    // дешёвый фильтр до полной оценки
    if (spec.id >= 3 && playBot(level, 'greedy').won) continue;
    const m = report(level);
    if (spec.accept(m)) return { level, metrics: m };
  }
  return null;
}


async function main() {
  const arg = process.argv[2];
  if (arg === '--log') {
    // Лог игры: localStorage['tight-shelf:log'] одного или нескольких игроков, склеенный в массив.
    const { readFile } = await import('node:fs/promises');
    const levels = JSON.parse(await readFile('tools/tight-shelf-levels.json', 'utf8'));
    const events = JSON.parse(await readFile(process.argv[3], 'utf8'));
    const stat = new Map();
    let level = null, board = empty();
    for (const e of events) {
      if (e.type === 'level_start') { level = levels.find((l) => l.id === e.level) ?? null; board = empty(); continue; }
      if (e.type !== 'place' || level === null || level.id !== e.level) continue;
      const traps = visibleTraps(level, board, e.turn);
      const s = stat.get(level.id) ?? { moves: 0, chances: 0, hits: 0 };
      s.moves++;
      if (traps.length) { s.chances++; if (traps.includes(e.cell)) s.hits++; }
      stat.set(level.id, s);
      board = place(board, e.cell, level.queue[e.turn]).board;
    }
    for (const l of levels) {
      const s = stat.get(l.id);
      if (!s) continue;
      const rate = s.chances ? s.hits / s.chances : 0;
      console.log(`уровень ${l.id}: ходов ${s.moves}, видимых ловушек ${s.chances}, попаданий ${s.hits} (${(100 * rate).toFixed(0)}%), случайный ${(100 * randomTrapRate(l)).toFixed(0)}%`);
    }
    return;
  }
  if (arg === '--report') {
    const { readFile } = await import('node:fs/promises');
    const levels = JSON.parse(await readFile(process.argv[3] ?? 'tools/tight-shelf-levels.json', 'utf8'));
    for (const l of levels) console.log(JSON.stringify({ ...report(l), randomTrapRate: +randomTrapRate(l).toFixed(2) }));
    return;
  }
  const levels = [];
  for (const spec of CURVE) {
    const found = findLevel(spec);
    if (!found) { console.error(`уровень ${spec.id}: не найден`); process.exit(1); }
    console.error(JSON.stringify(found.metrics));
    levels.push(found.level);
  }
  console.log(JSON.stringify(levels, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
