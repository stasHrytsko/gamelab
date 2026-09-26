#!/usr/bin/env node

/**
 * Arrow Flip exact solver + Gate 1 candidate finder.
 *
 * Rules:
 * - tap a block; it travels in its arrow direction until it exits or stops before the first blocker;
 * - a move that cannot advance at least one cell because of an adjacent blocker is illegal;
 * - exiting from an edge cell is legal even with zero in-grid travel;
 * - every stationary block that shares an edge with the moving block at any point of its route,
 *   including its starting cell and the blocking contact at the end, rotates 90° clockwise once;
 * - diagonal contact does not count;
 * - touched blocks rotate once per move;
 * - the moving block itself never rotates from its own movement.
 */

const DIRS = ['^', '>', 'v', '<'];
const DELTA = {
  '^': [-1, 0],
  '>': [0, 1],
  'v': [1, 0],
  '<': [0, -1],
};
const ROTATE = { '^': '>', '>': 'v', 'v': '<', '<': '^' };

function canonical(blocks) {
  return [...blocks]
    .map((b) => ({ ...b }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function stateKey(blocks) {
  return canonical(blocks)
    .map((b) => `${b.id}:${b.row},${b.col},${b.dir}`)
    .join('|');
}

function occupied(blocks) {
  const map = new Map();
  for (const b of blocks) map.set(`${b.row},${b.col}`, b.id);
  return map;
}

export function isExitReady(level, blockId) {
  const b = level.blocks.find((x) => x.id === blockId);
  if (!b) return false;
  const occ = occupied(level.blocks);
  const [dr, dc] = DELTA[b.dir];
  let row = b.row + dr;
  let col = b.col + dc;
  while (row >= 0 && row < level.size && col >= 0 && col < level.size) {
    const hit = occ.get(`${row},${col}`);
    if (hit !== undefined && hit !== blockId) return false;
    row += dr;
    col += dc;
  }
  return true;
}

export function applyMove(level, blockId) {
  const blocks = canonical(level.blocks);
  const mover = blocks.find((b) => b.id === blockId);
  if (!mover) return null;

  const occ = occupied(blocks);
  const [dr, dc] = DELTA[mover.dir];
  let row = mover.row;
  let col = mover.col;
  let steps = 0;
  let exited = false;
  const path = [[row, col]];

  for (;;) {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (nextRow < 0 || nextRow >= level.size || nextCol < 0 || nextCol >= level.size) {
      exited = true;
      break;
    }
    const hit = occ.get(`${nextRow},${nextCol}`);
    if (hit !== undefined && hit !== blockId) break;
    row = nextRow;
    col = nextCol;
    steps += 1;
    path.push([row, col]);
  }

  if (!exited && steps === 0) return null;

  const touched = new Set();
  for (const [r, c] of path) {
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      const hit = occ.get(`${nr},${nc}`);
      if (hit !== undefined && hit !== blockId) touched.add(hit);
    }
  }

  const nextBlocks = [];
  for (const b of blocks) {
    if (b.id === blockId) {
      if (!exited) nextBlocks.push({ ...b, row, col });
    } else {
      nextBlocks.push({ ...b, dir: touched.has(b.id) ? ROTATE[b.dir] : b.dir });
    }
  }

  return {
    level: { size: level.size, blocks: canonical(nextBlocks) },
    move: {
      blockId,
      from: [mover.row, mover.col],
      to: exited ? null : [row, col],
      dir: mover.dir,
      steps,
      exited,
      touched: [...touched].sort(),
    },
  };
}

export function legalMoves(level) {
  const result = [];
  for (const b of level.blocks) {
    const outcome = applyMove(level, b.id);
    if (outcome) result.push(outcome);
  }
  return result;
}

/** Exact breadth-first search. */
export function solve(level, { maxDepth = 20, nodeBudget = 500_000, greedyOnly = false } = {}) {
  const start = { size: level.size, blocks: canonical(level.blocks) };
  if (start.blocks.length === 0) return { solution: [], complete: true, explored: 0 };

  const queue = [{ level: start, moves: [] }];
  let head = 0;
  const seen = new Set([stateKey(start.blocks)]);
  let explored = 0;

  while (head < queue.length) {
    const node = queue[head++];
    explored += 1;
    if (explored > nodeBudget) return { solution: null, complete: false, explored };
    if (node.moves.length >= maxDepth) continue;

    let next = legalMoves(node.level);
    if (greedyOnly) {
      next = next.filter((x) => isExitReady(node.level, x.move.blockId));
    }

    for (const outcome of next) {
      const moves = [...node.moves, outcome.move];
      if (outcome.level.blocks.length === 0) return { solution: moves, complete: true, explored };
      const key = stateKey(outcome.level.blocks);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ level: outcome.level, moves });
    }
  }

  return { solution: null, complete: true, explored };
}

export function replay(level, moves) {
  let current = { size: level.size, blocks: canonical(level.blocks) };
  const trace = [];
  for (const requested of moves) {
    const outcome = applyMove(current, requested.blockId ?? requested);
    if (!outcome) throw new Error(`Illegal move: ${requested.blockId ?? requested}`);
    trace.push(outcome.move);
    current = outcome.level;
  }
  return { final: current, trace };
}

export function analyze(level, { maxDepth = 20, nodeBudget = 500_000 } = {}) {
  const exact = solve(level, { maxDepth, nodeBudget });
  if (!exact.complete || !exact.solution) {
    return { solvable: false, complete: exact.complete, explored: exact.explored };
  }

  const optimalMoves = exact.solution.length;
  const firstMoves = [];
  for (const outcome of legalMoves(level)) {
    const remainder = solve(outcome.level, {
      maxDepth: optimalMoves - 1,
      nodeBudget,
    });
    firstMoves.push({
      blockId: outcome.move.blockId,
      exitReady: isExitReady(level, outcome.move.blockId),
      optimal: Boolean(remainder.solution && remainder.solution.length + 1 === optimalMoves),
      touched: outcome.move.touched,
    });
  }

  // Greedy moves always remove a block, so block count is an exact depth ceiling.
  const greedy = solve(level, {
    maxDepth: level.blocks.length,
    nodeBudget,
    greedyOnly: true,
  });

  return {
    solvable: true,
    complete: exact.complete,
    optimalMoves,
    solution: exact.solution,
    explored: exact.explored,
    greedySolvable: Boolean(greedy.solution),
    greedyComplete: greedy.complete,
    firstMoves,
  };
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(array, random) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomLevel(size, blockCount, random = Math.random) {
  const cells = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) cells.push([row, col]);
  }
  const chosen = shuffle(cells, random).slice(0, blockCount);
  return {
    size,
    blocks: chosen.map(([row, col], i) => ({
      id: String(i),
      row,
      col,
      dir: DIRS[Math.floor(random() * DIRS.length)],
    })),
  };
}

/**
 * Gate 1 proof search:
 * - an exit-ready bait exists initially;
 * - a setup move exists initially;
 * - greedy-only play cannot solve the level;
 * - no exit-ready first move belongs to an optimal solution;
 * - at least one optimal first move is a setup move.
 */
export function findGate1Levels({
  size = 4,
  blockCount = 6,
  count = 5,
  trials = 20_000,
  seed = 36,
  maxDepth = blockCount + 4,
  nodeBudget = 100_000,
} = {}) {
  const random = mulberry32(seed);
  const found = [];

  for (let trial = 1; trial <= trials && found.length < count; trial += 1) {
    const level = randomLevel(size, blockCount, random);
    const initial = legalMoves(level);
    const exits = initial.filter((x) => isExitReady(level, x.move.blockId));
    const setups = initial.filter((x) => !isExitReady(level, x.move.blockId));
    if (exits.length === 0 || setups.length === 0) continue;

    const report = analyze(level, { maxDepth, nodeBudget });
    if (!report.solvable || !report.complete || report.greedySolvable) continue;
    if (report.firstMoves.some((m) => m.exitReady && m.optimal)) continue;
    if (!report.firstMoves.some((m) => !m.exitReady && m.optimal)) continue;

    found.push({ trial, level, report });
  }
  return found;
}

export const CURATED_LEVELS = [
  {
    name: 'AF-01', size: 4, moveLimit: 6,
    blocks: [
      { id: '0', row: 0, col: 2, dir: '<' },
      { id: '1', row: 1, col: 1, dir: '<' },
      { id: '2', row: 0, col: 0, dir: 'v' },
      { id: '3', row: 1, col: 0, dir: '>' },
      { id: '4', row: 0, col: 3, dir: 'v' },
    ],
  },
  {
    name: 'AF-02', size: 4, moveLimit: 6,
    blocks: [
      { id: '0', row: 3, col: 3, dir: '<' },
      { id: '1', row: 2, col: 2, dir: '>' },
      { id: '2', row: 3, col: 0, dir: '^' },
      { id: '3', row: 2, col: 0, dir: 'v' },
      { id: '4', row: 1, col: 1, dir: '>' },
    ],
  },
  {
    name: 'AF-03', size: 4, moveLimit: 8,
    blocks: [
      { id: '0', row: 1, col: 3, dir: '<' },
      { id: '1', row: 3, col: 3, dir: '<' },
      { id: '2', row: 0, col: 0, dir: 'v' },
      { id: '3', row: 0, col: 3, dir: '>' },
      { id: '4', row: 0, col: 2, dir: '<' },
      { id: '5', row: 3, col: 2, dir: '>' },
    ],
  },
  {
    name: 'AF-04', size: 4, moveLimit: 9,
    blocks: [
      { id: '0', row: 3, col: 0, dir: '>' },
      { id: '1', row: 1, col: 3, dir: '<' },
      { id: '2', row: 1, col: 2, dir: '>' },
      { id: '3', row: 3, col: 2, dir: 'v' },
      { id: '4', row: 3, col: 1, dir: '^' },
      { id: '5', row: 0, col: 3, dir: 'v' },
      { id: '6', row: 0, col: 1, dir: '^' },
    ],
  },
  {
    name: 'AF-05', size: 4, moveLimit: 10,
    blocks: [
      { id: '0', row: 2, col: 0, dir: '>' },
      { id: '1', row: 3, col: 0, dir: '^' },
      { id: '2', row: 2, col: 3, dir: '>' },
      { id: '3', row: 3, col: 3, dir: '<' },
      { id: '4', row: 2, col: 1, dir: '>' },
      { id: '5', row: 1, col: 1, dir: 'v' },
      { id: '6', row: 1, col: 0, dir: 'v' },
    ],
  },
];

function compact(report) {
  return {
    optimalMoves: report.optimalMoves,
    greedySolvable: report.greedySolvable,
    optimalFirstMoves: report.firstMoves.filter((m) => m.optimal).map((m) => m.blockId),
    baitExits: report.firstMoves.filter((m) => m.exitReady).map((m) => m.blockId),
    solution: report.solution?.map((m) => m.blockId),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let failed = false;
  for (const level of CURATED_LEVELS) {
    const report = analyze(level, { maxDepth: level.moveLimit, nodeBudget: 500_000 });
    const ok = report.solvable
      && report.complete
      && report.optimalMoves === level.moveLimit
      && !report.greedySolvable
      && report.firstMoves.some((m) => !m.exitReady && m.optimal)
      && !report.firstMoves.some((m) => m.exitReady && m.optimal);
    console.log(level.name, ok ? 'PASS' : 'FAIL', JSON.stringify(compact(report)));
    if (!ok) failed = true;
  }
  if (failed) process.exitCode = 1;
}
