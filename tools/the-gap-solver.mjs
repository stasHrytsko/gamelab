// The Gap — solver и A/B-эксперимент «есть возврат из колбы / нет возврата».
// Правила (черновые, до спеки): квадраты скользят до упора; выход — щель в
// рамке поля; квадрат, доехавший до клетки выхода в его сторону, падает в колбу
// (если есть место), иначе остаётся у выхода; верхний квадрат колбы можно
// вернуть только на клетку у своего выхода, если она свободна.
// Запуск: node tools/the-gap-solver.mjs [число_уровней] [seed]

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// level: { w, h, walls:Set<cell>, exits:[{x,y,dx,dy}], caps:[..], field:[..], flasks:[[..]] }
export function moves(level, st, allowReturn) {
  const { w, h, exits, caps } = level;
  const out = [];
  const { field, flasks } = st;
  for (let i = 0; i < w * h; i++) {
    const c = field[i];
    if (c <= 0) continue;
    const x0 = i % w, y0 = (i / w) | 0;
    for (const [dx, dy] of DIRS) {
      let x = x0, y = y0;
      for (;;) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) break;
        if (field[ny * w + nx] !== 0) break;
        x = nx; y = ny;
      }
      // дошли до края: есть ли здесь выход в эту сторону?
      const ex = exits.findIndex((e) => e.x === x && e.y === y && e.dx === dx && e.dy === dy);
      const nf = field.slice();
      nf[i] = 0;
      if (ex >= 0 && flasks[ex].length < caps[ex]) {
        const fl = flasks.map((f) => f.slice());
        fl[ex].push(c);
        out.push({ field: nf, flasks: fl, kind: 'in' });
      } else if (x !== x0 || y !== y0) {
        nf[y * w + x] = c;
        out.push({ field: nf, flasks, kind: 'slide' });
      }
    }
  }
  if (allowReturn) {
    for (let k = 0; k < exits.length; k++) {
      if (!flasks[k].length) continue;
      const e = exits[k];
      if (field[e.y * w + e.x] !== 0) continue;
      const nf = field.slice();
      const fl = flasks.map((f) => f.slice());
      nf[e.y * w + e.x] = fl[k].pop();
      out.push({ field: nf, flasks: fl, kind: 'ret' });
    }
  }
  return out;
}

const key = (st) => st.field.join('') + '|' + st.flasks.map((f) => f.join('')).join(',');

export function isWin(level, st) {
  if (st.field.some((c) => c > 0)) return false;
  const seen = new Set();
  for (const f of st.flasks) {
    if (!f.length) continue;
    if (f.some((c) => c !== f[0])) return false;
    if (seen.has(f[0])) return false; // цвет разбит на две колбы
    seen.add(f[0]);
  }
  return true;
}

// Полный обход достижимых состояний. cost: 0/1 для возвратов (0-1 BFS не нужен —
// минимум возвратов считаем вторым проходом по графу).
export function explore(level, allowReturn, cap = 250000) {
  const start = { field: level.field.slice(), flasks: level.flasks.map((f) => f.slice()) };
  const ids = new Map();
  const nodes = [];
  const edges = []; // [{to, kind}]
  const add = (st) => {
    const k = key(st);
    let id = ids.get(k);
    if (id === undefined) {
      id = nodes.length;
      ids.set(k, id);
      nodes.push(st);
      edges.push(null);
    }
    return id;
  };
  add(start);
  for (let i = 0; i < nodes.length; i++) {
    if (nodes.length > cap) return null;
    const st = nodes[i];
    const list = [];
    for (const m of moves(level, st, allowReturn)) {
      list.push({ to: add(m), kind: m.kind });
    }
    edges[i] = list;
  }
  return { nodes, edges };
}

export function analyse(level, allowReturn) {
  const g = explore(level, allowReturn);
  if (!g) return null;
  const { nodes, edges } = g;
  const n = nodes.length;
  const win = nodes.map((s) => isWin(level, s));
  // BFS от старта — оптимум по ходам
  const dist = new Int32Array(n).fill(-1);
  dist[0] = 0;
  const q = [0];
  for (let h = 0; h < q.length; h++) {
    for (const e of edges[q[h]]) {
      if (dist[e.to] < 0) { dist[e.to] = dist[q[h]] + 1; q.push(e.to); }
    }
  }
  let opt = Infinity;
  for (let i = 0; i < n; i++) if (win[i] && dist[i] >= 0 && dist[i] < opt) opt = dist[i];
  // достижимость победы (для доли тупиков)
  const rev = Array.from({ length: n }, () => []);
  edges.forEach((es, i) => es.forEach((e) => rev[e.to].push(i)));
  const good = new Uint8Array(n);
  const st = [];
  win.forEach((wv, i) => { if (wv) { good[i] = 1; st.push(i); } });
  while (st.length) {
    const v = st.pop();
    for (const u of rev[v]) if (!good[u]) { good[u] = 1; st.push(u); }
  }
  let dead = 0, br = 0;
  for (let i = 0; i < n; i++) { if (!good[i]) dead++; br += edges[i].length; }
  // минимум возвратов на пути к победе: 0-1 BFS
  let minRet = Infinity;
  if (opt !== Infinity) {
    const d = new Int32Array(n).fill(1e9);
    d[0] = 0;
    const dq = [0];
    // простой Дейкстра-подобный цикл на массиве (графы небольшие)
    const buckets = [[0]];
    for (let c = 0; c < buckets.length; c++) {
      const b = buckets[c];
      for (let bi = 0; bi < b.length; bi++) {
        const v = b[bi];
        if (d[v] !== c) continue;
        for (const e of edges[v]) {
          const nc = c + (e.kind === 'ret' ? 1 : 0);
          if (nc < d[e.to]) { d[e.to] = nc; (buckets[nc] ??= []).push(e.to); }
        }
      }
    }
    for (let i = 0; i < n; i++) if (win[i] && d[i] < minRet) minRet = d[i];
    void dq;
  }
  return { states: n, opt, minRet, deadShare: dead / n, branching: br / n };
}

// ---------- генератор ----------
export function genLevel(rand, cfg) {
  const { w, h, colors, perColor, capsPool, walls } = cfg;
  const total = colors * perColor;
  // выходы: 4 разных клетки/стороны по периметру
  const cand = [];
  for (let y = 0; y < h; y++) { cand.push({ x: 0, y, dx: -1, dy: 0 }); cand.push({ x: w - 1, y, dx: 1, dy: 0 }); }
  for (let x = 0; x < w; x++) { cand.push({ x, y: 0, dx: 0, dy: -1 }); cand.push({ x, y: h - 1, dx: 0, dy: 1 }); }
  for (let i = cand.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const exits = [];
  for (const c of cand) {
    if (exits.length === 4) break;
    if (exits.some((e) => e.x === c.x && e.y === c.y)) continue; // одна клетка — один выход
    exits.push(c);
  }
  const caps = Array.from({ length: 4 }, () => capsPool[(rand() * capsPool.length) | 0]);
  if (Math.max(...caps) < perColor || caps.reduce((a, b) => a + b, 0) < total) return null;
  const items = [];
  for (let c = 1; c <= colors; c++) for (let k = 0; k < perColor; k++) items.push(c);
  for (let i = items.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [items[i], items[j]] = [items[j], items[i]]; }
  // часть квадратов — сразу в колбах (перемешаны)
  const flasks = [[], [], [], []];
  const inFlask = Math.round(total * cfg.prefill);
  for (let i = 0; i < inFlask; i++) {
    const open = [0, 1, 2, 3].filter((k) => flasks[k].length < caps[k]);
    if (!open.length) break;
    flasks[open[(rand() * open.length) | 0]].push(items.pop());
  }
  const field = new Array(w * h).fill(0);
  const cells = [...Array(w * h).keys()];
  for (let i = cells.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const wallCells = cells.splice(0, walls);
  for (const wc of wallCells) field[wc] = -1;
  if (cells.length < items.length + 4) return null;
  for (const it of items) field[cells.pop()] = it;
  return { w, h, exits, caps, field, flasks };
}

function stats(a) {
  if (!a.length) return { n: 0, mean: NaN, med: NaN };
  const s = a.slice().sort((x, y) => x - y);
  return { n: a.length, mean: a.reduce((x, y) => x + y, 0) / a.length, med: s[s.length >> 1] };
}

export function experiment(cfg, count, seed) {
  const rand = rng(seed);
  const rows = [];
  let tried = 0;
  while (rows.length < count && tried < count * 40) {
    tried++;
    const lv = genLevel(rand, cfg);
    if (!lv) continue;
    const A = analyse(lv, true);
    if (!A || A.opt === Infinity || A.opt < cfg.minOpt || A.opt > cfg.maxOpt) continue;
    const B = analyse(lv, false);
    if (!B) continue;
    rows.push({ A, B });
  }
  const bSolv = rows.filter((r) => r.B.opt !== Infinity);
  const need = rows.filter((r) => r.B.opt === Infinity);
  const sameOpt = bSolv.filter((r) => r.B.opt === r.A.opt);
  return {
    levels: rows.length,
    triedLevels: tried,
    'returns required (B unsolvable)': need.length / rows.length,
    'B solvable, same optimum as A (kill zone)': sameOpt.length / rows.length,
    'B solvable, optimum longer': (bSolv.length - sameOpt.length) / rows.length,
    'optA moves': stats(rows.map((r) => r.A.opt)),
    'optB moves (where solvable)': stats(bSolv.map((r) => r.B.opt)),
    'min returns in A (mean)': stats(rows.map((r) => r.A.minRet)).mean,
    'returns ≥2 share': rows.filter((r) => r.A.minRet >= 2).length / rows.length,
    'dead-state share A': stats(rows.map((r) => r.A.deadShare)).mean,
    'dead-state share B (solvable only)': stats(bSolv.map((r) => r.B.deadShare)).mean,
    'branching A': stats(rows.map((r) => r.A.branching)).mean,
    'branching B': stats(rows.map((r) => r.B.branching)).mean,
    'states A': stats(rows.map((r) => r.A.states)).mean,
  };
}

if (process.argv[1] && process.argv[1].endsWith('the-gap-solver.mjs')) {
  const count = Number(process.argv[2] ?? 150);
  const seed = Number(process.argv[3] ?? 1);
  const configs = {
    'empty flasks, 2 colours x3': { w: 4, h: 3, colors: 2, perColor: 3, capsPool: [3, 4], walls: 2, prefill: 0, minOpt: 4, maxOpt: 60 },
    'prefilled 50%, 2 colours x3': { w: 4, h: 3, colors: 2, perColor: 3, capsPool: [3, 4], walls: 2, prefill: 0.5, minOpt: 4, maxOpt: 60 },
    'prefilled 50%, 3 colours x2': { w: 4, h: 3, colors: 3, perColor: 2, capsPool: [2, 3], walls: 2, prefill: 0.5, minOpt: 4, maxOpt: 60 },
  };
  for (const [name, cfg] of Object.entries(configs)) {
    const t = Date.now();
    console.log('\n== ' + name);
    console.log(JSON.stringify(experiment(cfg, count, seed), (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v), 1));
    console.log('(' + ((Date.now() - t) / 1000).toFixed(1) + 's)');
  }
}
