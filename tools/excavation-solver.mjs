#!/usr/bin/env node

/**
 * The Dig (Раскоп) — generator, exact trap-probability solver and strategy bots.
 *
 * Rules (specs/24-excavation.md §3–5):
 * - a room is a rows×cols grid with a fixed number of traps;
 * - every safe tile shows its clue = traps among its 8 neighbours, and pays exactly
 *   that much gold when opened (0 → 0 gold);
 * - the entrance tile is opened at start, its clue is 0, it pays nothing;
 * - the exit is a hidden safe tile on the edge; it is "found" once opened, pays its clue as usual;
 * - opening a trap burns all gold of the attempt → fail `trap`;
 * - the player may leave at any time once the exit is found and gold >= quota (1★);
 *   2★ / 3★ are higher thresholds;
 * - opening the last safe tile exits automatically.
 *
 * Usage:
 *   node tools/excavation-solver.mjs report [pool]     — bot table for the five levels
 *                                                        (frozen 20 layouts, or a pool of 200)
 *   node tools/excavation-solver.mjs stops             — how risky the exit decisions are (pool)
 *   node tools/excavation-solver.mjs layouts N         — print frozen layouts of level N
 *   node tools/excavation-solver.mjs json              — frozen levels as JSON (levels.json of the app)
 */

// ---------- deterministic randomness (generation only, never at play time) ----------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- geometry ----------

export function neighbours(rows, cols, i) {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc);
    }
  return out;
}

// ---------- levels (specs/24-excavation.md §6) ----------

export const LEVELS = [
  { id: 1, rows: 5, cols: 5, traps: 4, safeBand: [14, 99], clearable: true, stars: [6, 10, 14] },
  { id: 2, rows: 5, cols: 5, traps: 5, safeBand: [8, 13], stars: [8, 14, 19] },
  { id: 3, rows: 6, cols: 6, traps: 7, safeBand: [14, 21], stars: [14, 22, 30] },
  { id: 4, rows: 6, cols: 6, traps: 8, safeBand: [16, 23], stars: [16, 24, 33] },
  { id: 5, rows: 6, cols: 6, traps: 9, safeBand: [18, 25], stars: [18, 26, 36] },
];

export const LAYOUTS_PER_LEVEL = 20;
export const MAX_CLUE = 5;
export const MIN_EXIT_DISTANCE = 3;

/**
 * One room from a seed. Traps are placed uniformly, then the layout is rejected unless
 * every clue <= MAX_CLUE and there is a zero tile to serve as the entrance (the one
 * closest to the centre of the bottom row wins — the player "enters from below").
 */
export function generateRoom(rows, cols, traps, seed) {
  const rnd = mulberry32(seed);
  for (let attempt = 0; attempt < 10000; attempt++) {
    const n = rows * cols;
    const trap = new Array(n).fill(false);
    let placed = 0;
    while (placed < traps) {
      const i = Math.floor(rnd() * n);
      if (!trap[i]) {
        trap[i] = true;
        placed++;
      }
    }
    const clue = trap.map((t, i) => (t ? -1 : neighbours(rows, cols, i).filter((j) => trap[j]).length));
    if (clue.some((v) => v > MAX_CLUE)) continue;
    let entrance = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (clue[i] !== 0) continue;
      const r = Math.floor(i / cols);
      const c = i % cols;
      const d = (rows - 1 - r) * 10 + Math.abs(c - (cols - 1) / 2);
      if (d < best) {
        best = d;
        entrance = i;
      }
    }
    if (entrance < 0) continue;
    return { rows, cols, traps, trap, clue, entrance, seed };
  }
  throw new Error('no layout');
}

export const roomTotal = (room) => room.clue.filter((v) => v > 0).reduce((s, v) => s + v, 0);

/** Gold a player gets by opening only tiles that are certainly safe, and whether that clears the room. */
export function safeOnly(room) {
  const n = room.rows * room.cols;
  const open = new Array(n).fill(false);
  open[room.entrance] = true;
  let gold = 0;
  let opened = 1;
  for (;;) {
    const p = trapProbabilities(room, open);
    let s = -1;
    for (const [c, v] of p) if (v < 1e-12) {
      s = c;
      break;
    }
    if (s < 0) return { gold, cleared: opened === n - room.traps, open };
    open[s] = true;
    opened++;
    gold += room.clue[s];
  }
}

/**
 * Validity of a layout for a level (§6):
 * - level 1: logic alone clears the room, total >= 3★;
 * - levels 2–5: logic alone stalls with gold inside safeBand (1★ is always reachable
 *   without a guess, 2★ never is), and the room total reaches 3★.
 */
export function isValid(level, room) {
  const s = safeOnly(room);
  if (roomTotal(room) < level.stars[2]) return false;
  room.exit = placeExit(room, s.open);
  if (room.exit < 0) return false;
  if (level.clearable) return s.cleared;
  return !s.cleared && s.gold >= level.safeBand[0] && s.gold <= level.safeBand[1];
}

/**
 * Exit: a safe tile on the edge of the room that logic alone opens (so finding it never
 * needs a guess), not the entrance; the farthest from the entrance by Manhattan distance,
 * ties → lowest index. -1 if there is none or it is closer than MIN_EXIT_DISTANCE (layout rejected).
 */
export function placeExit(room, logicOpen) {
  const { rows, cols, entrance } = room;
  const er = Math.floor(entrance / cols);
  const ec = entrance % cols;
  let exit = -1;
  let best = -1;
  for (let i = 0; i < rows * cols; i++) {
    if (i === entrance || room.trap[i] || !logicOpen[i]) continue;
    const r = Math.floor(i / cols);
    const c = i % cols;
    if (r !== 0 && c !== 0 && r !== rows - 1 && c !== cols - 1) continue;
    const d = Math.abs(r - er) + Math.abs(c - ec);
    if (d > best) {
      best = d;
      exit = i;
    }
  }
  return best >= MIN_EXIT_DISTANCE ? exit : -1;
}

/** Frozen layouts of a level: first `count` valid seeds from `base`. Attempt k plays layouts[k % count]. */
export function layoutsFor(level, count = LAYOUTS_PER_LEVEL, base = level.id * 1000) {
  const out = [];
  for (let k = 0; out.length < count; k++) {
    const room = generateRoom(level.rows, level.cols, level.traps, base + k);
    if (isValid(level, room)) out.push(room);
  }
  return out;
}

/** Map strings: `*` trap, `.` safe tile, `E` entrance, `X` exit. Clues are derived, never stored. */
export function toMap(room) {
  const out = [];
  for (let r = 0; r < room.rows; r++) {
    let line = '';
    for (let c = 0; c < room.cols; c++) {
      const i = r * room.cols + c;
      line += i === room.entrance ? 'E' : i === room.exit ? 'X' : room.trap[i] ? '*' : '.';
    }
    out.push(line);
  }
  return out;
}

// ---------- exact solver ----------

function binom(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/**
 * P(trap) for every closed tile, given the opened tiles and the known trap count.
 * Exact: enumerates trap assignments of the frontier, weights by C(rest, traps - f).
 */
export function trapProbabilities(room, open) {
  const { rows, cols, traps, clue } = room;
  const n = rows * cols;
  const closed = [];
  for (let i = 0; i < n; i++) if (!open[i]) closed.push(i);
  const isFrontier = new Array(n).fill(false);
  const constraints = [];
  for (let i = 0; i < n; i++) {
    if (!open[i]) continue;
    const cells = neighbours(rows, cols, i).filter((j) => !open[j]);
    if (!cells.length) continue;
    constraints.push({ cells, need: clue[i] });
    cells.forEach((j) => (isFrontier[j] = true));
  }
  const frontier = closed.filter((i) => isFrontier[i]);
  const others = closed.length - frontier.length;
  const idx = new Map(frontier.map((c, k) => [c, k]));
  const cons = constraints.map((c) => ({ cells: c.cells.map((j) => idx.get(j)), need: c.need }));
  const byCell = frontier.map(() => []);
  cons.forEach((c, ci) => c.cells.forEach((k) => byCell[k].push(ci)));

  const assign = new Array(frontier.length).fill(0);
  const placedIn = cons.map(() => 0);
  const openIn = cons.map((c) => c.cells.length);
  const trapWeight = new Array(frontier.length).fill(0);
  let total = 0;
  let otherTrapWeight = 0;

  function rec(k, f) {
    if (f > traps) return;
    if (k === frontier.length) {
      const w = binom(others, traps - f);
      if (!w) return;
      total += w;
      for (let q = 0; q < frontier.length; q++) if (assign[q]) trapWeight[q] += w;
      if (others) otherTrapWeight += (w * (traps - f)) / others;
      return;
    }
    for (const v of [0, 1]) {
      let ok = true;
      for (const ci of byCell[k]) {
        const p = placedIn[ci] + v;
        const left = openIn[ci] - 1;
        if (p > cons[ci].need || p + left < cons[ci].need) ok = false;
      }
      if (!ok) continue;
      assign[k] = v;
      for (const ci of byCell[k]) {
        placedIn[ci] += v;
        openIn[ci] -= 1;
      }
      rec(k + 1, f + v);
      for (const ci of byCell[k]) {
        placedIn[ci] -= v;
        openIn[ci] += 1;
      }
    }
    assign[k] = 0;
  }
  rec(0, 0);

  const p = new Map();
  frontier.forEach((c, k) => p.set(c, trapWeight[k] / total));
  const po = others ? otherTrapWeight / total : 0;
  closed.forEach((c) => {
    if (!isFrontier[c]) p.set(c, po);
  });
  return p;
}

// ---------- bots ----------

/**
 * policy:
 *   { kind: 'random', target }        — random closed tile, exits at gold >= target
 *   { kind: 'logic',  target }        — takes every certain-safe tile first; when none are left,
 *                                        guesses the lowest-risk tile until gold >= target, then exits
 * target = Infinity → digs until the room is cleared.
 * Returns { gold, stars, failed, guesses }.
 */
export function play(room, level, policy, rnd) {
  const n = room.rows * room.cols;
  const open = new Array(n).fill(false);
  open[room.entrance] = true;
  let gold = 0;
  let guesses = 0;
  let decisions = 0;
  const safeTotal = n - room.traps;
  let opened = 1;
  const stars = (g) => level.stars.filter((s) => g >= s).length;

  while (true) {
    if (opened === safeTotal) return { gold, stars: stars(gold), failed: false, guesses, decisions };
    let pick;
    if (policy.kind === 'random') {
      if (gold >= policy.target && open[room.exit]) return { gold, stars: stars(gold), failed: false, guesses, decisions };
      const closed = [];
      for (let i = 0; i < n; i++) if (!open[i]) closed.push(i);
      pick = closed[Math.floor(rnd() * closed.length)];
    } else {
      const p = trapProbabilities(room, open);
      let safe = -1;
      for (const [c, v] of p) if (v < 1e-12 && (safe < 0 || room.clue[c] > room.clue[safe])) safe = c;
      if (safe >= 0) pick = safe;
      else {
        let best = -1;
        let bp = 2;
        for (const [c, v] of p) if (v < bp - 1e-12) {
          bp = v;
          best = c;
        }
        decisions++;
        const enough = gold >= level.stars[0] && open[room.exit];
        if (enough && gold >= policy.target) return { gold, stars: stars(gold), failed: false, guesses, decisions };
        if (enough && policy.maxRisk !== undefined && bp > policy.maxRisk)
          return { gold, stars: stars(gold), failed: false, guesses, decisions };
        pick = best;
        guesses++;
      }
    }
    if (room.trap[pick]) return { gold: 0, stars: 0, failed: true, guesses, decisions };
    open[pick] = true;
    opened++;
    gold += room.clue[pick];
  }
}

// ---------- report ----------

function summarize(results) {
  const k = results.length;
  const avg = (f) => results.reduce((s, r) => s + f(r), 0) / k;
  return {
    win: avg((r) => (r.failed ? 0 : r.stars >= 1 ? 1 : 0)),
    stars: avg((r) => r.stars),
    gold: avg((r) => r.gold),
    s3: avg((r) => (r.stars === 3 ? 1 : 0)),
    decisions: avg((r) => r.decisions ?? 0),
  };
}

export function evaluate(level, runsPerLayout = 40, layouts = layoutsFor(level)) {
  const policies = {
    random: { kind: 'random', target: level.stars[0] },
    'safe→exit': { kind: 'logic', target: 0 },
    'push 2★': { kind: 'logic', target: level.stars[1] },
    'push 3★': { kind: 'logic', target: level.stars[2] },
    'clear all': { kind: 'logic', target: Infinity },
    'risk≤15%': { kind: 'logic', target: level.stars[2], maxRisk: 0.15 },
    'risk≤20%': { kind: 'logic', target: level.stars[2], maxRisk: 0.2 },
    'risk≤25%': { kind: 'logic', target: level.stars[2], maxRisk: 0.25 },
    'risk≤30%': { kind: 'logic', target: level.stars[2], maxRisk: 0.3 },
  };
  const out = {};
  const safeOnlyGold = [];
  for (const [name, pol] of Object.entries(policies)) {
    const rnd = mulberry32(level.id * 7 + name.length);
    const res = [];
    for (const room of layouts) {
      const reps = pol.kind === 'random' ? runsPerLayout : 1;
      for (let r = 0; r < reps; r++) res.push(play(room, level, pol, rnd));
    }
    out[name] = summarize(res);
  }
  for (const room of layouts) safeOnlyGold.push(safeOnly(room).gold);
  const totals = layouts.map(roomTotal);
  return { out, safeOnlyGold, totals };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] ?? 'report';
  if (cmd === 'report') {
    for (const level of LEVELS) {
      const pool = process.argv[3] === "pool";
      const { out, safeOnlyGold, totals } = evaluate(level, 40, pool ? layoutsFor(level, 200, 100000 + level.id * 10000) : layoutsFor(level));
      const s = [...safeOnlyGold].sort((a, b) => a - b);
      const q = (p) => s[Math.floor(p * (s.length - 1))];
      console.log(
        `\nLevel ${level.id}: ${level.rows}×${level.cols}, ${level.traps} traps, stars ${level.stars.join('/')}`,
      );
      console.log(
        `  gold without guessing: min ${s[0]} p25 ${q(0.25)} median ${q(0.5)} p75 ${q(0.75)} max ${s.at(-1)}` +
          `; room total avg ${(totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1)}`,
      );
      for (const [name, r] of Object.entries(out))
        console.log(
          `  ${name.padEnd(10)} pass ${(r.win * 100).toFixed(0).padStart(3)}%  3★ ${(r.s3 * 100).toFixed(0).padStart(3)}%  ` +
            `avg stars ${r.stars.toFixed(2)}  avg gold ${r.gold.toFixed(1)}  stops ${r.decisions.toFixed(1)}`,
        );
    }
  } else if (cmd === 'stops') {
    // Follow the "push to 3★" bot; a stop is a moment with no certain-safe tile left.
    for (const level of LEVELS.slice(1)) {
      const rooms = layoutsFor(level, 200, 100000 + level.id * 10000);
      const at = [[], [], [], []];
      let reached2 = 0;
      for (const room of rooms) {
        const n = room.rows * room.cols;
        const open = new Array(n).fill(false);
        open[room.entrance] = true;
        let gold = 0;
        let opened = 1;
        let saw2 = false;
        while (opened < n - room.traps) {
          const p = trapProbabilities(room, open);
          let pick = -1;
          for (const [c, v] of p) if (v < 1e-12) {
            pick = c;
            break;
          }
          if (pick < 0) {
            const st = level.stars.filter((x) => gold >= x).length;
            if (st === 3) break;
            let bp = 2;
            for (const [c, v] of p) if (v < bp) {
              bp = v;
              pick = c;
            }
            at[st].push(bp);
            if (st === 2) saw2 = true;
            if (room.trap[pick]) break;
          }
          open[pick] = true;
          opened++;
          gold += room.clue[pick];
        }
        if (saw2) reached2++;
      }
      const f = (a) => (a.length ? `${a.length} stops, lowest risk avg ${((a.reduce((x, y) => x + y, 0) / a.length) * 100).toFixed(0)}%` : '—');
      console.log(
        `Level ${level.id}: at 1★ ${f(at[1])} | at 2★ ${f(at[2])} | attempts with a 2★ stop ${((reached2 / rooms.length) * 100).toFixed(0)}%`,
      );
    }
  } else if (cmd === 'json') {
    const levels = LEVELS.map((level) => ({
      id: level.id,
      rows: level.rows,
      cols: level.cols,
      traps: level.traps,
      stars: level.stars,
      layouts: layoutsFor(level).map((room) => ({ seed: room.seed, map: toMap(room) })),
    }));
    console.log(JSON.stringify(levels, null, 2));
  } else if (cmd === 'layouts') {
    const level = LEVELS[Number(process.argv[3]) - 1];
    for (const room of layoutsFor(level)) {
      console.log(`seed ${room.seed}`);
      for (let r = 0; r < room.rows; r++) {
        let line = '';
        for (let c = 0; c < room.cols; c++) {
          const i = r * room.cols + c;
          line += i === room.entrance ? 'E' : i === room.exit ? 'X' : room.trap[i] ? '*' : String(room.clue[i]);
        }
        console.log('  ' + line);
      }
    }
  }
}
