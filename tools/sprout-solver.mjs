#!/usr/bin/env node

/**
 * Sprout exact solver + level generator.
 *
 * Rules (specs/09-sprout.md §4–5):
 * - the root tip grows into an edge-adjacent cell: no diagonals, no stones, no visited cells;
 * - a step is allowed only while moves >= 1 and costs exactly one move;
 * - stepping onto B wins immediately (even with the last move);
 * - stepping onto water adds its +X right after the −1 (entering water with the last move is fine);
 * - after the step: moves = 0 → fail `moves_exhausted`; no free neighbour → fail `no_moves`.
 *
 * Level map: 6 strings of 6 chars. `.` soil, `#` stone, `A` start, `B` goal, `1`–`9` water +X.
 */

export const DIRS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

export function parse(level) {
  const size = level.rows.length;
  let a = -1;
  let b = -1;
  const stone = [];
  const bonus = [];
  level.rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      const i = r * size + c;
      stone[i] = ch === '#';
      bonus[i] = /[1-9]/.test(ch) ? Number(ch) : 0;
      if (ch === 'A') a = i;
      if (ch === 'B') b = i;
    });
  });
  const water = bonus.map((x, i) => (x > 0 ? i : -1)).filter((i) => i >= 0);
  return { size, a, b, stone, bonus, water, start: level.start };
}

export function neighbours(g, i) {
  const r = Math.floor(i / g.size);
  const c = i % g.size;
  const out = [];
  for (const [dr, dc] of DIRS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < g.size && nc >= 0 && nc < g.size) out.push(nr * g.size + nc);
  }
  return out;
}

export function createState(g) {
  return { tip: g.a, path: [g.a], moves: g.start, status: 'playing', failReason: null };
}

/** One step. Returns the new state, or null if the step is not allowed. */
export function step(g, s, cell, bonusOverride = g.bonus) {
  if (s.status !== 'playing' || s.moves < 1) return null;
  if (!neighbours(g, s.tip).includes(cell)) return null;
  if (g.stone[cell] || s.path.includes(cell)) return null;
  const path = [...s.path, cell];
  let moves = s.moves - 1;
  if (cell === g.b) return { tip: cell, path, moves, status: 'won', failReason: null };
  moves += bonusOverride[cell];
  const next = { tip: cell, path, moves, status: 'playing', failReason: null };
  if (moves === 0) return { ...next, status: 'failed', failReason: 'moves_exhausted' };
  if (freeNeighbours(g, next).length === 0) return { ...next, status: 'failed', failReason: 'no_moves' };
  return next;
}

export function freeNeighbours(g, s) {
  return neighbours(g, s.tip).filter((n) => !g.stone[n] && !s.path.includes(n));
}

export function replay(level, cells) {
  const g = parse(level);
  let s = createState(g);
  for (const cell of cells) {
    const next = step(g, s, cell);
    if (!next) return { ...s, status: 'illegal' };
    s = next;
  }
  return s;
}

const POW2 = Array.from({ length: 64 }, (_, i) => 2 ** i);

/**
 * Exhaustive DFS over root paths. Prunes a node when B is cut off or when the
 * moves left plus every still-reachable bonus cannot cover the distance to B.
 * `bonus` may override the level's bonuses (used by the necessity check).
 * `orders: false` stops at the first win; `orders: true` collects every
 * distinct water order of a winning path and one shortest path for each.
 */
export function solve(g, { start = g.start, bonus = g.bonus, orders: wantOrders = false, nodeBudget = 20_000_000 } = {}) {
  const N = g.size * g.size;
  const adj = Array.from({ length: N }, (_, i) => neighbours(g, i).filter((n) => !g.stone[n]));
  const visited = new Uint8Array(N);
  const dist = new Int16Array(N);
  const queue = new Int16Array(N);
  const isWater = g.bonus.map((x, i) => x > 0 || bonus[i] > 0);
  const orders = new Map();
  const seen = new Map();
  const path = [g.a];
  const order = [];
  let nodes = 0;
  let aborted = false;
  let found = false;

  // BFS from tip through free cells; B is a target but not traversed.
  function bound(tip, moves) {
    dist.fill(-1);
    dist[tip] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = tip;
    let reach = 0;
    while (head < tail) {
      const cur = queue[head++];
      if (cur === g.b) continue;
      for (const n of adj[cur]) {
        if (visited[n] || dist[n] >= 0) continue;
        dist[n] = dist[cur] + 1;
        reach += bonus[n];
        queue[tail++] = n;
      }
    }
    return dist[g.b] >= 0 && moves + reach >= dist[g.b];
  }

  function dfs(tip, mask, moves) {
    if (aborted || (found && !wantOrders)) return;
    if (++nodes > nodeBudget) {
      aborted = true;
      return;
    }
    if (!wantOrders) {
      const key = tip * POW2[N] + mask;
      const prev = seen.get(key);
      if (prev !== undefined && prev >= moves) return;
      seen.set(key, moves);
    }
    if (!bound(tip, moves)) return;
    for (const n of adj[tip]) {
      if (visited[n]) continue;
      path.push(n);
      if (n === g.b) {
        found = true;
        const k = order.join(',');
        const best = orders.get(k);
        if (!best || best.length > path.length) orders.set(k, [...path]);
      } else {
        const left = moves - 1 + bonus[n];
        if (left > 0) {
          visited[n] = 1;
          if (isWater[n]) order.push(n);
          dfs(n, mask + POW2[n], left);
          if (isWater[n]) order.pop();
          visited[n] = 0;
        }
      }
      path.pop();
      if (found && !wantOrders) return;
    }
  }

  visited[g.a] = 1;
  if (start >= 1) dfs(g.a, POW2[g.a], start);
  return { solvable: found, orders, nodes, aborted };
}

/** Smallest starting budget that still has a winning path. */
export function minStart(g, max = 40) {
  for (let s = 1; s <= max; s++) {
    const r = solve(g, { start: s });
    if (r.aborted) return null;
    if (r.solvable) return s;
  }
  return null;
}

function bfs(g, s, from, isTarget) {
  const prev = new Map([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur !== from && isTarget(cur)) {
      const route = [];
      for (let x = cur; x !== from; x = prev.get(x)) route.unshift(x);
      return route;
    }
    if (cur !== from && cur === g.b) continue;
    for (const n of neighbours(g, cur)) {
      if (g.stone[n] || s.path.includes(n) || prev.has(n)) continue;
      prev.set(n, cur);
      queue.push(n);
    }
  }
  return null;
}

/**
 * Kill-criterion strategy: walk a shortest free route to the nearest uncollected
 * water (ties: bigger +X, then reading order), then a shortest route to B.
 * Neighbour order is fixed (up, right, down, left), so the walk is deterministic.
 */
export function greedy(g) {
  let s = createState(g);
  const order = [];
  while (s.status === 'playing') {
    const left = g.water.filter((w) => !s.path.includes(w));
    let route = null;
    let target = null;
    for (const w of left) {
      const r = bfs(g, s, s.tip, (x) => x === w);
      if (!r) continue;
      if (!route || r.length < route.length || (r.length === route.length && g.bonus[w] > g.bonus[target])) {
        route = r;
        target = w;
      }
    }
    if (!route) route = bfs(g, s, s.tip, (x) => x === g.b);
    if (!route) return { won: false, order, state: { ...s, status: 'failed', failReason: 'no_route' } };
    if (target !== null) order.push(target);
    for (const cell of route) {
      s = step(g, s, cell);
      if (s.status !== 'playing') break;
    }
  }
  return { won: s.status === 'won', order, state: s };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sources reachable from A with the starting budget and no other water. */
export function firstChoices(g) {
  const s = createState(g);
  return g.water.filter((w) => {
    const r = bfs(g, s, g.a, (x) => x === w);
    return r && r.length <= g.start && r.slice(0, -1).every((x) => g.bonus[x] === 0);
  });
}

/** Every source is required: zeroing any one bonus (cell stays passable) kills all wins. */
export function everySourceNeeded(g) {
  return g.water.every((w) => {
    const bonus = [...g.bonus];
    bonus[w] = 0;
    const r = solve(g, { bonus });
    return !r.aborted && !r.solvable;
  });
}

export function cellName(g, i) {
  return `${String.fromCharCode(97 + (i % g.size))}${g.size - Math.floor(i / g.size)}`;
}

export function analyze(level) {
  const g = parse(level);
  const sol = solve(g, { orders: true });
  const opt = minStart(g);
  const gr = greedy(g);
  const orders = [...sol.orders.keys()].map((k) =>
    k === '' ? [] : k.split(',').map(Number),
  );
  const allWater = orders.every((o) => o.length === g.water.length);
  return {
    name: level.name,
    start: level.start,
    minStart: opt,
    water: g.water.length,
    stones: g.stone.filter(Boolean).length,
    solvable: sol.solvable,
    aborted: sol.aborted,
    nodes: sol.nodes,
    winningOrders: orders.map((o) => o.map((i) => cellName(g, i)).join('→')),
    winningFirst: [...new Set(orders.map((o) => (o[0] === undefined ? '-' : cellName(g, o[0]))))],
    allWaterInEveryWin: allWater,
    everySourceNeeded: everySourceNeeded(g),
    firstChoices: firstChoices(g).map((i) => cellName(g, i)),
    greedyWon: gr.won,
    greedyOrder: gr.order.map((i) => cellName(g, i)).join('→'),
    greedyFail: gr.state.failReason,
    slack: opt === null ? null : level.start - opt,
    solution: sol.orders.size ? [...sol.orders.values()][0].map((i) => cellName(g, i)).join(' ') : null,
  };
}

// ---------------------------------------------------------------------------
// Generator

function shuffle(array, random) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** Random 6×6 map: A in the bottom row, B in the top row, stones and water scattered. */
export function randomLevel(seed, { size = 6, water = 5, stones = 7, bonusMin = 3, bonusMax = 6 } = {}) {
  const random = mulberry32(seed);
  const grid = Array.from({ length: size * size }, () => '.');
  const a = (size - 1) * size + Math.floor(random() * size);
  const b = Math.floor(random() * size);
  grid[a] = 'A';
  grid[b] = 'B';
  const free = shuffle(
    grid.map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0),
    random,
  );
  for (let k = 0; k < stones; k++) grid[free.pop()] = '#';
  for (let k = 0; k < water; k++) {
    grid[free.pop()] = String(bonusMin + Math.floor(random() * (bonusMax - bonusMin + 1)));
  }
  const rows = Array.from({ length: size }, (_, r) => grid.slice(r * size, r * size + size).join(''));
  return { name: `SP-${seed}`, rows, start: 0 };
}

/**
 * Valid non-tutorial level (spec §6): tight start (= minStart), every source
 * needed, every win collects all water, at least two sources reachable first.
 * Greedy is NOT part of validity — the kill criterion is measured on this pool.
 */
export function validate(level, { needFirstChoices = 2 } = {}) {
  const g0 = parse(level);
  const start = minStart(g0);
  if (start === null) return null;
  const tuned = { ...level, start };
  const g = parse(tuned);
  if (!everySourceNeeded(g)) return null;
  if (firstChoices(g).length < needFirstChoices) return null;
  return tuned;
}

export function pool({ from = 1, count = 200, water = 5, stones = 7, bonusMin = 3, bonusMax = 6, maxSeeds = 200_000 } = {}) {
  const out = [];
  for (let seed = from; seed < from + maxSeeds && out.length < count; seed++) {
    const lvl = validate(randomLevel(seed, { water, stones, bonusMin, bonusMax }));
    if (lvl) out.push(lvl);
  }
  return out;
}

function distances(g) {
  const d = new Map([[g.a, 0]]);
  const queue = [g.a];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === g.b) continue;
    for (const n of neighbours(g, cur)) {
      if (g.stone[n] || d.has(n)) continue;
      d.set(n, d.get(cur) + 1);
      queue.push(n);
    }
  }
  return d;
}

/**
 * Game pick for levels 3–5 (spec §6): valid, greedy loses, the nearest source
 * is unique and no win starts with it (it is the bait), start >= 3.
 */
export function isTrapPick(level) {
  const g = parse(level);
  if (level.start < 3 || greedy(g).won) return false;
  const d = distances(g);
  const byDist = [...g.water].sort((x, y) => (d.get(x) ?? 99) - (d.get(y) ?? 99));
  if ((d.get(byDist[0]) ?? 99) === (d.get(byDist[1]) ?? 99)) return false;
  const firsts = [...solve(g, { orders: true }).orders.keys()].map((k) => Number(k.split(',')[0]));
  return !firsts.includes(byDist[0]);
}

/**
 * Tutorial pick for levels 1–2 (spec §6): start = the largest one that keeps
 * every source needed, at least 2 above the optimum, greedy wins, every source
 * is reachable first, and with two sources both orders win.
 */
export function tutorialPick(raw) {
  const opt = minStart(parse(raw));
  if (opt === null) return null;
  let start = null;
  for (let s = opt; s < opt + 8; s++) {
    if (!everySourceNeeded(parse({ ...raw, start: s }))) break;
    start = s;
  }
  if (start === null || start - opt < 2) return null;
  const level = { ...raw, start };
  const g = parse(level);
  if (!greedy(g).won) return null;
  if (firstChoices(g).length < g.water.length) return null;
  if (g.water.length === 2 && solve(g, { orders: true }).orders.size < 2) return null;
  return level;
}

// ---------------------------------------------------------------------------
// Game levels (spec §6). Maps are copied into apps/sprout/src/levels/levels.ts
// and tests/levels.test.ts checks them against this file.

export const GAME_LEVELS = [
  {
    // randomLevel(1, { water: 1, stones: 4, bonusMin: 5, bonusMax: 6 }), start = max with water still needed
    name: 'SP-T1',
    tutorial: true,
    start: 7,
    rows: ['B.....', '...#..', '......', '#6....', '......', '.#.A#.'],
  },
  {
    // randomLevel(1392, { water: 2, stones: 5, bonusMin: 3, bonusMax: 5 }), start = max with both sources needed
    name: 'SP-T2',
    tutorial: true,
    start: 4,
    rows: ['B.....', '#.....', '#...#.', '.#....', '...5..', '.A.5.#'],
  },
  {
    // validate(randomLevel(1992, { water: 4, stones: 8, bonusMin: 3, bonusMax: 6 }))
    name: 'SP-4-1992',
    start: 4,
    rows: ['...6B.', '.#..#.', '..####', '..#.4.', '6..#3.', '.....A'],
  },
  {
    // validate(randomLevel(21657, { water: 5, stones: 8, bonusMin: 2, bonusMax: 5 }))
    name: 'SP-5-21657',
    start: 4,
    rows: ['B.####', '#...2.', '.##...', '....2.', '522..#', '....A.'],
  },
  {
    // validate(randomLevel(1630, { water: 6, stones: 8, bonusMin: 2, bonusMax: 4 }))
    name: 'SP-6-1630',
    start: 4,
    rows: ['..#..B', '4..#3#', '3.2#..', '.#3.#.', '4#....', '...A#.'],
  },
];

/** Generator settings of the trap levels 3–5; the kill pool uses the same ones. */
export const POOL_CONFIGS = [
  { water: 4, stones: 8, bonusMin: 3, bonusMax: 6 },
  { water: 5, stones: 8, bonusMin: 2, bonusMax: 5 },
  { water: 6, stones: 8, bonusMin: 2, bonusMax: 4 },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] ?? 'levels';
  if (cmd === 'levels') {
    for (const level of GAME_LEVELS) console.log(JSON.stringify(analyze(level)));
  } else if (cmd === 'kill') {
    for (const cfg of POOL_CONFIGS) {
      const levels = pool({ ...cfg, count: 100 });
      const greedyWins = levels.filter((l) => greedy(parse(l)).won).length;
      console.log(JSON.stringify({ ...cfg, valid: levels.length, greedyWins, greedyShare: greedyWins / levels.length }));
    }
  } else if (cmd === 'pool') {
    const water = Number(process.argv[3] ?? 5);
    const stones = Number(process.argv[4] ?? 7);
    const count = Number(process.argv[5] ?? 200);
    const bonusMin = Number(process.argv[6] ?? 3);
    const bonusMax = Number(process.argv[7] ?? 6);
    const t = Date.now();
    const levels = pool({ water, stones, count, bonusMin, bonusMax });
    const greedyWins = levels.filter((l) => greedy(parse(l)).won).length;
    console.log(
      JSON.stringify({ water, stones, bonusMin, bonusMax, valid: levels.length, greedyWins, greedyShare: greedyWins / levels.length, ms: Date.now() - t }),
    );
  } else if (cmd === 'pick') {
    // node tools/sprout-solver.mjs pick <water> <stones> <bonusMin> <bonusMax> [count] [tutorial]
    const [water, stones, bonusMin, bonusMax, count = 3] = process.argv.slice(3, 8).map(Number);
    const tutorial = process.argv[8] === 'tutorial';
    let found = 0;
    for (let seed = 1; seed < 200_000 && found < count; seed++) {
      const raw = randomLevel(seed, { water, stones, bonusMin, bonusMax });
      const level = tutorial ? tutorialPick(raw) : validate(raw);
      if (!level || (!tutorial && !isTrapPick(level))) continue;
      found++;
      console.log(seed, JSON.stringify(level.rows), level.start);
    }
  } else if (cmd === 'show') {
    const lvl = validate(randomLevel(Number(process.argv[3]), { water: Number(process.argv[4] ?? 5), stones: Number(process.argv[5] ?? 7) }));
    if (!lvl) console.log('invalid');
    else console.log(lvl.rows.join('\n'), '\n', JSON.stringify(analyze(lvl), null, 1));
  }
}
