#!/usr/bin/env node

/**
 * Burning Land (Брандмауэр) solver + level generator.
 *
 * Rules (specs/11-burning-land.md §4–5):
 * - board 8×8; cells: grass, stone, wall, fire (active front), ash, house;
 * - a turn gives three shapes; the player puts exactly one of them (any of its rotations)
 *   onto grass cells, they become wall; the other two are discarded;
 * - if after the placement the fire has no grass/house neighbour → win at once;
 * - fire step: every grass/house neighbour (up/down/left/right) of the front ignites,
 *   the old front turns to ash;
 * - a house ignited → fail `house_burned`; fire with no grass/house neighbour → win;
 * - if none of the three shapes fits anywhere, the turn is skipped and the fire still steps.
 *
 * Level map: 8 strings of 8 chars. `.` grass, `#` stone, `F` fire, `H` house.
 * Shape queue: string of shape letters, three per turn (see SHAPES).
 */

export const N = 8;
export const GRASS = 0;
export const WALL = 1;
export const FIRE = 2;
export const ASH = 3;
export const STONE = 4;
export const HOUSE = 5;

const DIRS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

/** Wall shapes — same set as the old burning-land prototype. Letter = id in level data. */
export const SHAPES = {
  M: [[0, 0]],
  D: [[0, 0], [0, 1]],
  I: [[0, 0], [0, 1], [0, 2]],
  V: [[0, 0], [0, 1], [1, 0]],
  O: [[0, 0], [0, 1], [1, 0], [1, 1]],
  L: [[0, 0], [0, 1], [0, 2], [1, 0]],
  S: [[0, 0], [0, 1], [1, 1], [1, 2]],
  T: [[0, 0], [0, 1], [0, 2], [1, 1]],
};
const BIG = ['D', 'I', 'V', 'O', 'L', 'S', 'T'];

function normalize(cells) {
  const my = Math.min(...cells.map((p) => p[0]));
  const mx = Math.min(...cells.map((p) => p[1]));
  return cells.map(([y, x]) => [y - my, x - mx]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function rotate(cells) {
  return normalize(cells.map(([y, x]) => [x, -y]));
}

/** Distinct rotations of a shape (mirror images are NOT included — no flip in the game). */
export function orientations(letter) {
  const out = [];
  let cur = normalize(SHAPES[letter]);
  for (let k = 0; k < 4; k++) {
    const key = JSON.stringify(cur);
    if (!out.some((o) => JSON.stringify(o) === key)) out.push(cur);
    cur = rotate(cur);
  }
  return out;
}
const ORIENT = Object.fromEntries(Object.keys(SHAPES).map((k) => [k, orientations(k)]));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shape queue from a seed: 10% mono, else one of the 7 big shapes; `turns` triples. */
export function shapeQueue(seed, turns = 20) {
  const rnd = mulberry32(seed ^ 0x5bd1e995);
  let s = '';
  for (let i = 0; i < turns * 3; i++) s += rnd() < 0.1 ? 'M' : BIG[Math.floor(rnd() * BIG.length)];
  return s;
}

export function parse(level) {
  const grid = new Uint8Array(N * N);
  level.rows.forEach((line, r) =>
    [...line].forEach((ch, c) => {
      grid[r * N + c] = { '.': GRASS, '#': STONE, F: FIRE, H: HOUSE, W: WALL, x: ASH }[ch];
    }),
  );
  return grid;
}

export function toRows(grid) {
  const ch = ['.', 'W', 'F', 'x', '#', 'H'];
  return Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => ch[grid[r * N + c]]).join(''));
}

const NB = Array.from({ length: N * N }, (_, i) => {
  const r = (i / N) | 0;
  const c = i % N;
  return DIRS.map(([dr, dc]) => [r + dr, c + dc])
    .filter(([y, x]) => y >= 0 && y < N && x >= 0 && x < N)
    .map(([y, x]) => y * N + x);
});

const burnable = (v) => v === GRASS || v === HOUSE;

/** Cells the fire takes on its next step. Empty = fire is locked (win). */
export function nextBurn(grid) {
  const out = new Set();
  for (let i = 0; i < N * N; i++) {
    if (grid[i] !== FIRE) continue;
    for (const n of NB[i]) if (burnable(grid[n])) out.add(n);
  }
  return out;
}

/** One fire step. Returns { grid, status: 'playing' | 'won' | 'failed' }. */
export function spread(grid) {
  const g = grid.slice();
  const add = nextBurn(g);
  let houseHit = false;
  for (let i = 0; i < N * N; i++) if (g[i] === FIRE) g[i] = ASH;
  for (const i of add) {
    if (g[i] === HOUSE) houseHit = true;
    g[i] = FIRE;
  }
  if (houseHit) return { grid: g, status: 'failed' };
  if (nextBurn(g).size === 0) return { grid: g, status: 'won' };
  return { grid: g, status: 'playing' };
}

/** Every legal placement of one shape letter: { letter, rot, row, col, cells }. */
export function placementsOf(grid, letter) {
  const out = [];
  ORIENT[letter].forEach((cells, rot) => {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const abs = [];
        let ok = true;
        for (const [dy, dx] of cells) {
          const y = r + dy;
          const x = c + dx;
          if (y >= N || x >= N || grid[y * N + x] !== GRASS) {
            ok = false;
            break;
          }
          abs.push(y * N + x);
        }
        if (ok) out.push({ letter, rot, row: r, col: c, cells: abs });
      }
    }
  });
  return out;
}

export function triple(queue, turn) {
  return queue.slice(turn * 3, turn * 3 + 3).split('');
}

/**
 * One full turn: place (or skip if `move` is null), then fire.
 * Returns { grid, status } or null if the placement is illegal.
 */
export function playTurn(grid, move) {
  const g = grid.slice();
  if (move) {
    for (const i of move.cells) {
      if (g[i] !== GRASS) return null;
      g[i] = WALL;
    }
  }
  if (nextBurn(g).size === 0) return { grid: g, status: 'won' };
  return spread(g);
}

/** All legal placements for the current turn (three shapes, all rotations), deduped by cell set. */
export function turnMoves(grid, letters) {
  const seen = new Set();
  const out = [];
  letters.forEach((letter, slot) => {
    for (const m of placementsOf(grid, letter)) {
      const key = [...m.cells].sort((a, b) => a - b).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...m, slot });
    }
  });
  return out;
}

/** BFS distance from the fire front through burnable cells. -1 = unreachable. */
export function fireDist(grid) {
  const d = new Int16Array(N * N).fill(-1);
  const q = [];
  for (let i = 0; i < N * N; i++) if (grid[i] === FIRE) (d[i] = 0), q.push(i);
  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    for (const n of NB[cur]) {
      if (d[n] >= 0 || !burnable(grid[n])) continue;
      d[n] = d[cur] + 1;
      q.push(n);
    }
  }
  return d;
}

function houseScore(grid) {
  const d = fireDist(grid);
  let min = 99;
  let sum = 0;
  for (let i = 0; i < N * N; i++) {
    if (grid[i] !== HOUSE) continue;
    const v = d[i] < 0 ? 99 : d[i];
    min = Math.min(min, v);
    sum += v;
  }
  return { min, sum, dist: d };
}

/** A placement touching no cell the fire can still reach is the same as a skip. */
function useful(move, dist) {
  return move.cells.some((i) => dist[i] >= 0);
}

/** After a fire step, a house next to the front burns on the next step no matter what. */
function doomed(grid) {
  for (let i = 0; i < N * N; i++) {
    if (grid[i] !== HOUSE) continue;
    if (NB[i].some((n) => grid[n] === FIRE)) return true;
  }
  return false;
}

/**
 * DFS over placements with memo of lost positions. `all: true` also counts winning
 * first moves (for the "how many first moves win" metric). Returns
 * { solvable, line, nodes, aborted }.
 */
export function solve(level, { nodeBudget = 300_000, from = null, turn: startTurn = 0 } = {}) {
  const queue = level.shapes;
  const lost = new Set();
  let nodes = 0;
  let aborted = false;
  const line = [];

  function dfs(grid, turn) {
    if (++nodes > nodeBudget) {
      aborted = true;
      return false;
    }
    if (turn * 3 + 3 > queue.length) return false;
    const key = turn + ':' + grid.join('');
    if (lost.has(key)) return false;
    const dist = fireDist(grid);
    let moves = turnMoves(grid, triple(queue, turn)).filter((m) => useful(m, dist));
    const scored = [];
    for (const m of moves) {
      const res = playTurn(grid, m);
      if (res.status === 'failed') continue;
      if (res.status === 'won') {
        line.push(m);
        return true;
      }
      if (doomed(res.grid)) continue;
      const hs = houseScore(res.grid);
      scored.push({ m, res, k: hs.min * 100 + hs.sum });
    }
    if (moves.length === 0) {
      // nothing useful fits: skip (only legal if nothing fits at all; a useless placement equals a skip)
      const res = playTurn(grid, null);
      if (res.status === 'won') return line.push(null), true;
      if (res.status === 'playing' && !doomed(res.grid)) scored.push({ m: null, res, k: 0 });
    }
    scored.sort((a, b) => b.k - a.k);
    for (const { m, res } of scored) {
      line.push(m);
      if (dfs(res.grid, turn + 1)) return true;
      line.pop();
      if (aborted) return false;
    }
    if (!aborted) lost.add(key);
    return false;
  }

  const solvable = dfs(from ?? parse(level), startTurn);
  return { solvable, line: solvable ? line : null, nodes, aborted };
}

/** Plays a policy to the end. `pick(grid, moves, turn)` returns a move (or null to skip). */
export function playPolicy(level, pick) {
  let grid = parse(level);
  const log = [];
  for (let turn = 0; turn * 3 + 3 <= level.shapes.length; turn++) {
    const moves = turnMoves(grid, triple(level.shapes, turn));
    const m = moves.length ? pick(grid, moves, turn) : null;
    const res = playTurn(grid, m);
    log.push(m);
    grid = res.grid;
    if (res.status !== 'playing') return { won: res.status === 'won', turns: turn + 1, log, grid };
  }
  return { won: false, turns: -1, log, grid };
}

/**
 * Kill-criterion strategy «закрывай фронт»: cover as many cells of the fire's next step as
 * possible; ties → keep the nearest house farthest from the fire; ties → first in order.
 */
export function greedyFront(level) {
  return playPolicy(level, (grid, moves) => {
    const nb = nextBurn(grid);
    let best = null;
    let bestK = -1;
    for (const m of moves) {
      const cover = m.cells.filter((i) => nb.has(i)).length;
      const after = grid.slice();
      for (const i of m.cells) after[i] = WALL;
      const hs = houseScore(after);
      const k = cover * 10000 + hs.min * 100 + hs.sum;
      if (k > bestK) (bestK = k), (best = m);
    }
    return best;
  });
}

/**
 * Second naive strategy «отодвинь огонь от ближайшего дома»: maximise the fire distance to
 * the nearest house after the placement, then the sum over all houses.
 */
export function greedyHouse(level) {
  return playPolicy(level, (grid, moves) => {
    let best = null;
    let bestK = -1;
    for (const m of moves) {
      const after = grid.slice();
      for (const i of m.cells) after[i] = WALL;
      const hs = houseScore(after);
      const k = hs.min * 100 + hs.sum;
      if (k > bestK) (bestK = k), (best = m);
    }
    return best;
  });
}

/** Share of wins of uniformly random legal placements. */
export function randomShare(level, runs = 40, seed = 1) {
  const rnd = mulberry32(seed);
  let wins = 0;
  for (let k = 0; k < runs; k++) {
    if (playPolicy(level, (_g, moves) => moves[Math.floor(rnd() * moves.length)]).won) wins++;
  }
  return wins / runs;
}

/** Would the houses survive with no walls at all? (then walls are not needed). */
export function winsWithoutWalls(level) {
  return playPolicy(level, () => null).won;
}

/** How many distinct first placements (by cell set) keep the level solvable. */
export function winningFirstMoves(level, nodeBudget = 60_000) {
  const grid = parse(level);
  const moves = turnMoves(grid, triple(level.shapes, 0));
  let wins = 0;
  let unknown = 0;
  for (const m of moves) {
    const res = playTurn(grid, m);
    if (res.status === 'won') {
      wins++;
      continue;
    }
    if (res.status === 'failed' || doomed(res.grid)) continue;
    const r = solve(level, { from: res.grid, turn: 1, nodeBudget });
    if (r.solvable) wins++;
    else if (r.aborted) unknown++;
  }
  return { total: moves.length, wins, unknown };
}

/** Burned grass (ash + fire) at the end of a line — territory given to the fire. */
export function burned(grid) {
  let n = 0;
  for (let i = 0; i < N * N; i++) if (grid[i] === ASH || grid[i] === FIRE) n++;
  return n;
}

export function replay(level, line) {
  let grid = parse(level);
  for (let turn = 0; turn < line.length; turn++) {
    const res = playTurn(grid, line[turn]);
    if (!res) return { status: 'illegal', grid };
    grid = res.grid;
    if (res.status !== 'playing') return { status: res.status, grid, turns: turn + 1 };
  }
  return { status: 'playing', grid };
}

const manhattan = (a, b) => Math.abs(((a / N) | 0) - ((b / N) | 0)) + Math.abs((a % N) - (b % N));

/**
 * Random board from a seed. Fires anywhere (not only edges), houses at least `minDist`
 * (Manhattan) from every fire, stones anywhere else.
 */
export function randomLevel(seed, { fires = 1, houses = 3, stones = 0, minDist = 4, inner = 0 } = {}) {
  const rnd = mulberry32(seed);
  const grid = new Uint8Array(N * N);
  const free = () => {
    for (let t = 0; t < 500; t++) {
      const i = Math.floor(rnd() * N * N);
      if (grid[i] === GRASS) return i;
    }
    return -1;
  };
  const fireCells = [];
  for (let k = 0; k < fires; k++) {
    const i = free();
    grid[i] = FIRE;
    fireCells.push(i);
  }
  let placed = 0;
  for (let t = 0; t < 500 && placed < houses; t++) {
    const i = free();
    if (i < 0 || fireCells.some((f) => manhattan(f, i) < minDist)) continue;
    const r = (i / N) | 0;
    const c = i % N;
    if (r < inner || c < inner || r >= N - inner || c >= N - inner) continue;
    grid[i] = HOUSE;
    placed++;
  }
  for (let k = 0; k < stones; k++) {
    const i = free();
    if (i >= 0) grid[i] = STONE;
  }
  if (placed < houses) return null;
  return { name: `BL-${fires}${houses}${stones}-${seed}`, rows: toRows(grid), shapes: shapeQueue(seed) };
}

/** A generated level is valid when walls are needed and the solver finds a win. */
export function validate(level, nodeBudget = 300_000) {
  if (!level) return null;
  const grid = parse(level);
  if (nextBurn(grid).size === 0 || doomed(grid)) return null;
  if (winsWithoutWalls(level)) return null;
  const r = solve(level, { nodeBudget });
  if (!r.solvable) return null;
  return level;
}

export function pool({ from = 1, count = 100, maxSeeds = 20_000, ...cfg } = {}) {
  const out = [];
  for (let seed = from; seed < from + maxSeeds && out.length < count; seed++) {
    const l = validate(randomLevel(seed, cfg));
    if (l) out.push(l);
  }
  return out;
}

export function analyze(level) {
  const r = solve(level);
  const end = r.solvable ? replay(level, r.line) : null;
  return {
    name: level.name,
    solvable: r.solvable,
    solverTurns: end?.turns ?? null,
    burnedBySolver: end ? burned(end.grid) : null,
    nodes: r.nodes,
    greedyFront: greedyFront(level).won,
    greedyHouse: greedyHouse(level).won,
    random: randomShare(level),
    firstMoves: winningFirstMoves(level),
  };
}

export function cellName(i) {
  return 'abcdefgh'[i % N] + (N - ((i / N) | 0));
}

export function moveName(m) {
  if (!m) return 'skip';
  return `${m.letter}:${[...m.cells].sort((a, b) => a - b).map(cellName).join(' ')}`;
}

/**
 * Trap level: both naive strategies lose, the win is not a single pixel-perfect first move
 * (at least 2 winning first placements) and not almost any (at most a third of them).
 */
export function isTrapPick(level) {
  if (greedyFront(level).won || greedyHouse(level).won) return null;
  const fm = winningFirstMoves(level);
  if (fm.unknown > 0 || fm.wins < 2 || fm.wins * 3 > fm.total) return null;
  return fm;
}

/** Tutorial level: the obvious strategy wins and most first placements still win. */
export function tutorialPick(level) {
  if (!greedyHouse(level).won || !greedyFront(level).won) return null;
  const fm = winningFirstMoves(level);
  if (fm.unknown > 0 || fm.wins * 2 < fm.total) return null;
  return fm;
}

// ---------------------------------------------------------------------------
// Game levels (spec §6) — filled in after `pick`.
const lvl = (name, seed, cfg, tutorial = false) => ({ ...randomLevel(seed, cfg), name, seed, cfg, tutorial });

/** Generator settings of the trap levels 3–5; the kill pool uses the same ones. */
export const POOL_CONFIGS = [
  { fires: 2, houses: 3, stones: 0, minDist: 3, inner: 1 },
  { fires: 3, houses: 4, stones: 0, minDist: 3, inner: 1 },
  { fires: 3, houses: 5, stones: 0, minDist: 3, inner: 0 },
];

export const GAME_LEVELS = [
  lvl('BL-T1', 1, { fires: 1, houses: 2, stones: 0, minDist: 4, inner: 1 }, true),
  lvl('BL-T2', 5, { fires: 2, houses: 3, stones: 0, minDist: 4, inner: 1 }, true),
  lvl('BL-3-51', 51, POOL_CONFIGS[0]),
  lvl('BL-4-17', 17, POOL_CONFIGS[1]),
  lvl('BL-5-28', 28, POOL_CONFIGS[2]),
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] ?? 'levels';
  const num = (i, d) => (process.argv[i] === undefined ? d : Number(process.argv[i]));
  if (cmd === 'levels') {
    for (const level of GAME_LEVELS) {
      const a = analyze(level);
      const r = solve(level);
      const gf = greedyFront(level);
      const gh = greedyHouse(level);
      console.log(level.name, JSON.stringify(level.rows), level.shapes.slice(0, 24));
      console.log(' ', JSON.stringify(a));
      console.log('  solver:', r.line.map(moveName).join(' | '));
      console.log('  front :', gf.won, gf.log.map(moveName).join(' | '));
      console.log('  house :', gh.won, gh.log.map(moveName).join(' | '));
    }
  } else if (cmd === 'kill') {
    for (const cfg of POOL_CONFIGS) {
      const levels = pool({ ...cfg, count: 100 });
      const house = levels.filter((l) => greedyHouse(l).won).length;
      const front = levels.filter((l) => greedyFront(l).won).length;
      const rnd = levels.reduce((s, l) => s + randomShare(l, 20), 0) / levels.length;
      console.log(JSON.stringify({ ...cfg, valid: levels.length, house, houseShare: house / levels.length, front, frontShare: front / levels.length, randomMean: rnd }));
    }
  } else if (cmd === 'pool') {
    // node tools/burning-land-solver.mjs pool <fires> <houses> <stones> <minDist> [count]
    const cfg = { fires: num(3, 1), houses: num(4, 3), stones: num(5, 0), minDist: num(6, 4), inner: num(8, 0) };
    const t = Date.now();
    let tried = 0;
    const levels = [];
    for (let seed = 1; levels.length < num(7, 100) && seed < 5000; seed++) {
      tried++;
      const l = validate(randomLevel(seed, cfg));
      if (l) levels.push(l);
    }
    const front = levels.filter((l) => greedyFront(l).won).length;
    const house = levels.filter((l) => greedyHouse(l).won).length;
    const rnd = levels.reduce((s, l) => s + randomShare(l, 20), 0) / levels.length;
    console.log(JSON.stringify({ ...cfg, tried, valid: levels.length, front, house, frontShare: front / levels.length, houseShare: house / levels.length, randomMean: rnd, ms: Date.now() - t }));
  } else if (cmd === 'pick') {
    // node tools/burning-land-solver.mjs pick <fires> <houses> <stones> <minDist> <inner> [count] [tutorial] [fromSeed]
    const cfg = { fires: num(3, 3), houses: num(4, 3), stones: num(5, 0), minDist: num(6, 3), inner: num(7, 1) };
    const tutorial = process.argv[9] === 'tutorial';
    let found = 0;
    for (let seed = num(10, 1); seed < 20_000 && found < num(8, 5); seed++) {
      const l = validate(randomLevel(seed, cfg));
      if (!l) continue;
      const ok = tutorial ? tutorialPick(l) : isTrapPick(l);
      if (!ok) continue;
      found++;
      console.log(seed, JSON.stringify(l.rows), l.shapes.slice(0, 18), JSON.stringify(ok));
    }
  } else if (cmd === 'show') {
    const l = randomLevel(num(3, 1), { fires: num(4, 1), houses: num(5, 3), stones: num(6, 0), minDist: num(7, 4), inner: num(8, 0) });
    console.log(l.rows.join('\n'));
    console.log(l.shapes);
    const a = analyze(l);
    console.log(JSON.stringify(a));
    const r = solve(l);
    if (r.solvable) console.log(r.line.map(moveName).join(' | '));
  }
}
