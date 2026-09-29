#!/usr/bin/env node

/**
 * Block Market — Monte Carlo экономики (ideas/backlog/41-block-market.md).
 *
 * Игра: поле 8×8, забег из уровней по 20 фигур. Клетки строки/столбца заполнены —
 * линия исчезает и платит монеты нелинейно (n-я линия за раз: n(n+1)/2).
 * Игра сдаёт неудобные фигуры (тетромино + пентомино + мелочь); удобство покупается:
 * поворот, зеркало, замена на выбранную фигуру, пересдача, сброс.
 *
 * node tools/block-market-sim.mjs --selftest        — инварианты и юнит-проверки
 * node tools/block-market-sim.mjs --tune            — быстрый подбор констант (1 поток)
 * node tools/block-market-sim.mjs --full [N=10000]  — полный прогон (4 потока) в markdown
 *
 * Боты — не игроки: они жадные, глубина 1 хода. Результат — про экономику и
 * логику правил, а не про то, насколько игра нравится людям.
 */

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

// ───────────────────────── константы игры ─────────────────────────

export const CFG = {
  N: 8,
  PIECES: 20,            // фигур на уровень
  START_COINS: 5,
  CAP: 10,               // потолок кошелька
  LEVEL_BONUS: 1,        // монет за пройденный уровень
  MAX_LEVELS: 12,        // забег «пройден», если дошёл до конца
  goal: (L) => Math.min(4 + Math.ceil(L * 0.8), 9), // линий на уровне L (L с 1)
  blockers: (L) => Math.min(2 + L, 12),     // предзаполненных клеток на старте
  hostK: (L) => Math.min(2 + Math.ceil(L / 2), 5), // из скольких кандидатов выбирается самая неудобная
  ROT90: 2, ROT180: 4, FLIP: 2,             // цена возможностей
  REROLL: 2, DISCARD: 2, DISCARD_BUY: false,   // платный сброс убран (v2); бесплатное сгорание остаётся
  HOSTILE_EVERY: 2,                         // неудобную фигуру сдают каждым вторым ходом
  SWAP_ADD: 2,                              // надбавка к цене замены из каталога
  income: (lines) => lines * lines,   // 1→1, 2→4, 3→9, 4→16 (v2)
};

// каталог: форма, цена замены (магазин), класс неудобства
const DEFS = {
  mono: { rows: ['#'], price: 5, cls: 'help' },
  domino: { rows: ['##'], price: 3, cls: 'help' },
  I3: { rows: ['###'], price: 3, cls: 'help' },
  L3: { rows: ['#.', '##'], price: 3, cls: 'help' },
  I4: { rows: ['####'], price: 5, cls: 'tetro' },
  O: { rows: ['##', '##'], price: 4, cls: 'tetro' },
  T: { rows: ['###', '.#.'], price: 4, cls: 'tetro' },
  S: { rows: ['.##', '##.'], price: 3, cls: 'tetro' },
  Z: { rows: ['##.', '.##'], price: 3, cls: 'tetro' },
  L: { rows: ['#.', '#.', '##'], price: 4, cls: 'tetro' },
  J: { rows: ['.#', '.#', '##'], price: 4, cls: 'tetro' },
  I5: { rows: ['#####'], price: 6, cls: 'penta-easy' },
  L5: { rows: ['#.', '#.', '#.', '##'], price: 4, cls: 'penta-easy' },
  P5: { rows: ['##', '##', '#.'], price: 4, cls: 'penta-easy' },
  V5: { rows: ['#..', '#..', '###'], price: 4, cls: 'penta-easy' },
  T5: { rows: ['###', '.#.', '.#.'], price: 4, cls: 'penta-hard' },
  U5: { rows: ['#.#', '###'], price: 3, cls: 'penta-hard' },
  Y5: { rows: ['.#', '##', '.#', '.#'], price: 4, cls: 'penta-hard' },
  N5: { rows: ['.#', '.#', '##', '#.'], price: 3, cls: 'penta-hard' },
  W5: { rows: ['#..', '##.', '.##'], price: 3, cls: 'penta-hard' },
  X5: { rows: ['.#.', '###', '.#.'], price: 3, cls: 'penta-hard' },
  F5: { rows: ['.##', '##.', '.#.'], price: 3, cls: 'penta-hard' },
  Z5: { rows: ['##.', '.#.', '.##'], price: 3, cls: 'penta-hard' },
};
export const TYPES = Object.keys(DEFS);

// вес типа в сдаче на уровне L: мелочь редка, тяжёлые пентомино растут с уровнем
export function weightOf(cls, L) {
  switch (cls) {
    case 'help': return 0.8;
    case 'tetro': return 3;
    case 'penta-easy': return 0.6 + 0.2 * L;
    case 'penta-hard': return 0.4 + 0.5 * L;
    default: return 1;
  }
}

// ───────────────────────── RNG ─────────────────────────

export function hash(...xs) {
  let h = 2166136261 >>> 0;
  for (const x of xs) {
    h ^= x >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 15;
    h = Math.imul(h, 2246822507) >>> 0;
  }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────────────────────── фигуры и ориентации ─────────────────────────

const N = CFG.N;
const parse = (rows) => {
  const cells = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && cells.push([y, x])));
  return cells;
};
const norm = (cells) => {
  const my = Math.min(...cells.map((c) => c[0]));
  const mx = Math.min(...cells.map((c) => c[1]));
  return cells.map(([y, x]) => [y - my, x - mx]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
const keyOf = (cells) => cells.map((c) => c.join(',')).join(';');
const rot90 = (cells) => cells.map(([y, x]) => [x, -y]);
const flipH = (cells) => cells.map(([y, x]) => [y, -x]);
const flipV = (cells) => cells.map(([y, x]) => [-y, x]);
const ROT_COST = [0, CFG.ROT90, CFG.ROT180, CFG.ROT90];

/** Все различимые ориентации формы с минимальной ценой достижения из `cells`. */
function buildOptions(cells) {
  const best = new Map();
  const starts = [
    [cells, 0, 'none'],
    [flipH(cells), CFG.FLIP, 'flip'],
    [flipV(cells), CFG.FLIP, 'flip'],
  ];
  for (const [c0, base, kindBase] of starts) {
    let c = c0;
    for (let r = 0; r < 4; r++) {
      const cost = base + ROT_COST[r];
      const nc = norm(c);
      const k = keyOf(nc);
      const kind = kindBase === 'flip' ? 'flip' : r === 0 ? 'none' : r === 2 ? 'rot180' : 'rot90';
      const prev = best.get(k);
      if (!prev || cost < prev.cost) best.set(k, { cells: nc, cost, kind });
      c = rot90(c);
    }
  }
  return [...best.values()].map((o) => {
    const h = Math.max(...o.cells.map((c) => c[0])) + 1;
    const w = Math.max(...o.cells.map((c) => c[1])) + 1;
    const masks = new Array(h).fill(0);
    for (const [y, x] of o.cells) masks[y] |= 1 << x;
    return { masks, w, h, cost: o.cost, kind: o.kind, size: o.cells.length };
  });
}

const OPT_CACHE = new Map();
export function optionsFor(cells) {
  const k = keyOf(norm(cells));
  let o = OPT_CACHE.get(k);
  if (!o) OPT_CACHE.set(k, (o = buildOptions(norm(cells))));
  return o;
}

// восемь «выданных» ориентаций каждой фигуры
const DEALT = {};
const CANON = {};
for (const t of TYPES) {
  const base = norm(parse(DEFS[t].rows));
  CANON[t] = base;
  const forms = new Map();
  let c = base;
  for (let f = 0; f < 2; f++) {
    for (let r = 0; r < 4; r++) {
      const nc = norm(c);
      forms.set(keyOf(nc), nc);
      c = rot90(c);
    }
    c = flipH(base);
  }
  DEALT[t] = [...forms.values()];
}

// ───────────────────────── поле ─────────────────────────

const POP = new Uint8Array(256);
for (let i = 1; i < 256; i++) POP[i] = POP[i >> 1] + (i & 1);
const SPREAD = new Uint32Array(256);
for (let i = 0; i < 256; i++) for (let x = 0; x < 8; x++) if ((i >> x) & 1) SPREAD[i] |= 1 << (4 * x);

/** Ставит фигуру, чистит линии; возвращает число линий. Пишет результат в `out`. */
function applyPlace(board, opt, x, y, out) {
  for (let i = 0; i < 8; i++) out[i] = board[i];
  for (let i = 0; i < opt.h; i++) out[y + i] |= opt.masks[i] << x;
  let colMask = 255, rows = 0;
  for (let i = 0; i < 8; i++) {
    colMask &= out[i];
    if (out[i] === 255) rows++;
  }
  const lines = rows + POP[colMask];
  if (lines) for (let i = 0; i < 8; i++) out[i] = out[i] === 255 ? 0 : out[i] & ~colMask;
  return lines;
}

const fits = (board, opt, x, y) => {
  for (let i = 0; i < opt.h; i++) if (board[y + i] & (opt.masks[i] << x)) return false;
  return true;
};

function countFits(board, opt) {
  let n = 0;
  for (let y = 0; y + opt.h <= 8; y++) for (let x = 0; x + opt.w <= 8; x++) if (fits(board, opt, x, y)) n++;
  return n;
}

// оценка позиции для бота: меньше занятых клеток, нет мёртвых клеток, лёгкий бонус за почти полные линии
const EV = { fill: 1.0, sq: 0.06, dead4: 6, dead3: 2 };
function evalBoard(b) {
  let filled = 0, rowsq = 0, S = 0;
  for (let y = 0; y < 8; y++) {
    const p = POP[b[y]];
    filled += p; rowsq += p * p;
    S = (S + SPREAD[b[y]]) >>> 0;
  }
  let colsq = 0;
  for (let x = 0; x < 8; x++) { const c = (S >>> (4 * x)) & 15; colsq += c * c; }
  let d4 = 0, d3 = 0;
  for (let y = 0; y < 8; y++) {
    const r = b[y];
    const e = ~r & 255;
    if (!e) continue;
    const a = y > 0 ? b[y - 1] : 255, bb = y < 7 ? b[y + 1] : 255;
    const c = ((r << 1) & 255) | 1, d = (r >> 1) | 128;
    const n4 = a & bb & c & d;
    const n3 = (a & bb & (c | d)) | (c & d & (a | bb));
    d4 += POP[e & n4];
    d3 += POP[e & n3] - POP[e & n4];
  }
  return -EV.fill * filled + EV.sq * (rowsq + colsq) - EV.dead4 * d4 - EV.dead3 * d3;
}

// ───────────────────────── сдача фигур ─────────────────────────

const WCACHE = new Map();
function weightTable(L) {
  let t = WCACHE.get(L);
  if (!t) {
    const w = TYPES.map((k) => weightOf(DEFS[k].cls, L));
    const sum = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    t = w.map((x) => (acc += x / sum));
    WCACHE.set(L, t);
  }
  return t;
}

function drawType(L, r) {
  const t = weightTable(L), u = r();
  for (let i = 0; i < t.length; i++) if (u <= t[i]) return TYPES[i];
  return TYPES[TYPES.length - 1];
}

/** Сдаёт фигуру: из k случайных берётся та, что хуже всего ложится без платных действий. */
export function deal(L, board, r, hostile = true) {
  const k = hostile ? CFG.hostK(L) : 1;
  let pick = null, pickFits = Infinity;
  for (let i = 0; i < k; i++) {
    const type = drawType(L, r);
    const forms = DEALT[type];
    const cells = forms[Math.floor(r() * forms.length)];
    const opts = optionsFor(cells);
    const free = opts[opts.findIndex((o) => o.cost === 0)];
    const n = countFits(board, free);
    if (n < pickFits) { pickFits = n; pick = { type, cells, opts }; }
  }
  return pick;
}

const canonPiece = (type) => ({ type, cells: CANON[type], opts: optionsFor(CANON[type]) });

// ───────────────────────── боты ─────────────────────────

/**
 * Политика: lam — во сколько очков бот оценивает монету (∞ = никогда не платит),
 * R — резерв: не платит, если после траты остаётся меньше R (кроме безвыходных случаев).
 */
export const policy = (lam, R = 0, o = {}) => ({ lam, R, sq: o.sq ?? 0.06, look: o.look ?? 0, elastic: o.elastic ?? 0.7, never: lam === Infinity, name: o.name ?? `${lam === Infinity ? 'никогда не платит' : 'λ' + lam + '/R' + R}${o.look ? '+план' : ''}${o.sq ? '/комбо' : ''}` });

const LV = 4;            // очки за линию (сверх освободившихся клеток)
const WASTE = 10;        // штраф за сброс фигуры (потерянный ход)
const tmp = new Uint8Array(8);

function urgencyMult(need, left) {
  return 1 + Math.max(0, need - 0.3 * left) * 0.5;
}

const tmpA = new Uint8Array(8), tmpB = new Uint8Array(8);
const TOPK = 3;

/** Лучшая постановка фигуры; с `next` — учитывает лучший ответ следующей фигурой очереди (только без платных действий). */
function bestPlace(board, opt, lam, mult, next) {
  const inc = lam === Infinity ? 0 : lam;
  let top = [];
  for (let y = 0; y + opt.h <= 8; y++) {
    for (let x = 0; x + opt.w <= 8; x++) {
      if (!fits(board, opt, x, y)) continue;
      const lines = applyPlace(board, opt, x, y, tmp);
      const v = evalBoard(tmp) + LV * mult * lines + inc * CFG.income(lines);
      if (!next) {
        if (!top.length || v > top[0].v) top = [{ v, x, y, lines }];
      } else if (top.length < TOPK || v > top[top.length - 1].v) {
        top.push({ v, x, y, lines });
        top.sort((p, q) => q.v - p.v);
        if (top.length > TOPK) top.pop();
      }
    }
  }
  if (!top.length) return null;
  if (!next) return top[0];
  let best = null;
  for (const c of top) {
    applyPlace(board, opt, c.x, c.y, tmpA);
    let v2 = -Infinity;
    for (const no of next) {
      for (let y = 0; y + no.h <= 8; y++) {
        for (let x = 0; x + no.w <= 8; x++) {
          if (!fits(tmpA, no, x, y)) continue;
          const l2 = applyPlace(tmpA, no, x, y, tmpB);
          const v = evalBoard(tmpB) + LV * mult * l2 + inc * CFG.income(l2);
          if (v > v2) v2 = v;
        }
      }
    }
    if (v2 === -Infinity) v2 = evalBoard(tmpA) - WASTE;
    const total = 0.5 * c.v + 0.5 * v2;
    if (!best || total > best.v) best = { v: total, x: c.x, y: c.y, lines: c.lines };
  }
  return best;
}

// ───────────────────────── забег ─────────────────────────

function newStats() {
  return {
    runs: 0,
    levelsCleared: 0,
    phase: [0, 1, 2].map(() => ({ dec: 0, zero: 0, cap: 0, coins: 0, paid: 0 })),
    spend: { rot90: 0, rot180: 0, flip: 0, swap: 0, reroll: 0, discard: 0 },
    uses: { rot90: 0, rot180: 0, flip: 0, swap: 0, reroll: 0, discard: 0 },
    incomeBy: [0, 0, 0, 0, 0, 0, 0, 0, 0],   // монет с клира по числу линий
    clearsBy: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    income: 0, spent: 0, bonus: 0, capLost: 0,
    decisions: 0, forced: 0, closeCall: 0, tempted: 0, forcedDiscard: 0,
    levelPlays: 0, levelWins: 0,
    winByLevel: Array(CFG.MAX_LEVELS + 1).fill(0),
    playByLevel: Array(CFG.MAX_LEVELS + 1).fill(0),
    linesByLevel: Array(CFG.MAX_LEVELS + 1).fill(0),
    typeCount: {},
    outcomes: [],       // levelsCleared по seed (для корреляции политик)
    swapShare: [],      // доля монет на замены в забеге
    wasted: 0,
  };
}

/** Один забег. Возвращает число пройденных уровней. Копит статистику в `st`. */
export function playRun(seed, pol, st) {
  const botRng = rng(hash(seed, 99));
  EV.sq = pol.sq;
  let coins = CFG.START_COINS;
  let cleared = 0;
  let runSpend = 0, runSwap = 0;
  let ema = null;
  const A = (a, b) => (Math.abs(a - b) < 1e-9);

  for (let L = 1; L <= CFG.MAX_LEVELS; L++) {
    const board = new Uint8Array(8);
    const br = rng(hash(seed, L, 1));
    for (let n = 0; n < CFG.blockers(L); ) {
      const y = Math.floor(br() * 8), x = Math.floor(br() * 8);
      if (!((board[y] >> x) & 1)) { board[y] |= 1 << x; n++; }
    }
    // предзаполнение не должно быть готовой линией
    for (let y = 0; y < 8; y++) if (board[y] === 255) board[y] = 0;

    const dealRng = rng(hash(seed, L, 2));
    const rerollRng = rng(hash(seed, L, 3));
    let dealIdx = 0;
    const dealNext = () => deal(L, board, dealRng, dealIdx++ % CFG.HOSTILE_EVERY === 0);
    const queue = [dealNext(), dealNext(), dealNext()];
    const goal = CFG.goal(L);
    let lines = 0;
    st.playByLevel[L]++;
    st.levelPlays++;

    for (let i = 0; i < CFG.PIECES; i++) {
      let cur = queue.shift();
      queue.push(dealNext());
      const phase = Math.min(2, Math.floor((3 * i) / CFG.PIECES));
      const ph = st.phase[phase];
      ph.dec++; ph.coins += coins;
      if (coins === 0) ph.zero++;
      if (coins >= CFG.CAP) ph.cap++;
      st.typeCount[cur.type] = (st.typeCount[cur.type] || 0) + 1;

      const left = CFG.PIECES - i;
      const nextOpts = pol.look ? queue[0].opts.filter((o) => o.cost === 0) : null;
      const mult = urgencyMult(goal - lines, left);
      let rerolled = false;
      let acted = false;

      for (let guard = 0; guard < 3 && !acted; guard++) {
        // монета дешевеет по мере наполнения кошелька: у потолка её выгодно тратить
        const lam = pol.never ? Infinity : pol.lam * (1 - (pol.elastic * coins) / CFG.CAP);
        // ── свободные и платные повороты текущей фигуры ──
        let bestFree = null, bestNet = -Infinity, best = null;
        let anyFree = false;
        const canPay = (cost, forced) => cost === 0 || (!pol.never && coins >= cost && (forced || coins - cost >= pol.R));
        for (const o of cur.opts) if (o.cost === 0) if (bestPlace(board, o, lam, mult, nextOpts)) { anyFree = true; break; }
        const forced = !anyFree;
        for (const o of cur.opts) {
          if (o.cost > 0 && !canPay(o.cost, forced)) continue;
          const r = bestPlace(board, o, lam, mult, nextOpts);
          if (!r) continue;
          const net = r.v - (pol.never ? 0 : lam * o.cost);
          if (o.cost === 0 && (!bestFree || net > bestFree.net)) bestFree = { net, r, o };
          if (net > bestNet) { bestNet = net; best = { kind: o.kind === 'none' ? 'place' : o.kind, cost: o.cost, r, o, net }; }
        }

        // ── замена на выбранную фигуру / пересдача / сброс — только «в беде» ──
        const base = evalBoard(board);
        const poor = !best || best.net < (ema ?? -Infinity) - 1;
        let bestSwap = null, reroll = null, discard = null;
        if (!pol.never && poor) {
          for (const t of TYPES) {
            const price = DEFS[t].price + CFG.SWAP_ADD;
            if (!canPay(price, forced)) continue;
            if (t === cur.type) continue;
            for (const o of canonPiece(t).opts) {
              const cost = price + o.cost;
              if (!canPay(cost, forced)) continue;
              const r = bestPlace(board, o, lam, mult, nextOpts);
              if (!r) continue;
              const net = r.v - lam * cost;
              if (!bestSwap || net > bestSwap.net) bestSwap = { net, r, o, t, cost };
            }
          }
          if (!rerolled && canPay(CFG.REROLL, forced)) {
            let sum = 0;
            for (let s = 0; s < 2; s++) {
              const p = deal(L, board, botRng, false);
              let bv = -Infinity;
              for (const o of p.opts) {
                if (o.cost > 0 && !canPay(CFG.REROLL + o.cost, forced)) continue;
                const r = bestPlace(board, o, lam, mult, nextOpts);
                if (r) bv = Math.max(bv, r.v - lam * o.cost);
              }
              sum += bv === -Infinity ? base - WASTE - 6 : bv;
            }
            reroll = { net: sum / 2 - lam * CFG.REROLL };
          }
          if (CFG.DISCARD_BUY && canPay(CFG.DISCARD, forced)) discard = { net: base - WASTE - lam * CFG.DISCARD };
        }

        // ── выбор ──
        let choice = best ? { type: 'play', net: best.net, ref: best } : null;
        if (bestSwap && (!choice || bestSwap.net > choice.net)) choice = { type: 'swap', net: bestSwap.net, ref: bestSwap };
        if (reroll && (!choice || reroll.net > choice.net + 0.5)) choice = { type: 'reroll', net: reroll.net };
        if (discard && (!choice || discard.net > choice.net)) choice = { type: 'discard', net: discard.net };

        // статистика «выбора»: это разговор про настоящее решение
        if (guard === 0) {
          st.decisions++;
          if (forced) st.forced++;
          const paidBest = Math.max(
            bestSwap ? bestSwap.net : -Infinity,
            reroll ? reroll.net : -Infinity,
            best && best.cost > 0 ? best.net : -Infinity,
          );
          if (bestFree && paidBest > -Infinity) {
            st.tempted++;
            if (Math.abs(paidBest - bestFree.net) < 3) st.closeCall++;
          } else if (!bestFree && !forced === false && paidBest > -Infinity) {
            st.tempted++;
          }
          ema = ema === null ? (choice ? choice.net : 0) : 0.9 * ema + 0.1 * (choice ? choice.net : ema);
        }

        if (!choice) {
          // безвыходно: фигура пропадает бесплатно
          st.forcedDiscard++;
          st.wasted++;
          acted = true;
          break;
        }
        const pay = (kind, cost) => {
          coins -= cost; st.spent += cost; st.spend[kind] += cost; st.uses[kind]++;
          runSpend += cost; if (kind === 'swap') runSwap += cost; ph.paid += cost > 0 ? 1 : 0;
        };

        if (choice.type === 'reroll') {
          pay('reroll', CFG.REROLL);
          cur = deal(L, board, rerollRng, false);
          rerolled = true;
          continue; // повторный выбор с новой фигурой
        }
        if (choice.type === 'discard') {
          pay('discard', CFG.DISCARD);
          st.wasted++;
          acted = true;
          break;
        }
        let ref, o;
        if (choice.type === 'swap') {
          const s = choice.ref;
          pay('swap', DEFS[s.t].price + CFG.SWAP_ADD);
          if (s.o.cost > 0) pay(s.o.kind === 'flip' ? 'flip' : s.o.cost === CFG.ROT180 ? 'rot180' : 'rot90', s.o.cost);
          ref = s.r; o = s.o;
        } else {
          const b = choice.ref;
          if (b.cost > 0) pay(b.kind === 'flip' ? 'flip' : b.cost === CFG.ROT180 ? 'rot180' : 'rot90', b.cost);
          ref = b.r; o = b.o;
        }
        const nl = applyPlace(board, o, ref.x, ref.y, tmp);
        board.set(tmp);
        if (nl) {
          const inc = CFG.income(nl);
          const idx = Math.min(nl, 8);
          st.incomeBy[idx] += inc; st.clearsBy[idx]++;
          st.income += inc;
          const before = coins;
          coins = Math.min(CFG.CAP, coins + inc);
          st.capLost += before + inc - coins;
          lines += nl;
        }
        acted = true;
      }
    }

    st.linesByLevel[L] += lines;
    if (lines >= goal) {
      cleared++;
      st.levelWins++;
      st.winByLevel[L]++;
      const before = coins;
      coins = Math.min(CFG.CAP, coins + CFG.LEVEL_BONUS);
      st.bonus += CFG.LEVEL_BONUS;
      st.capLost += before + CFG.LEVEL_BONUS - coins;
    } else break;
  }

  st.runs++;
  st.levelsCleared += cleared;
  st.outcomes.push(cleared);
  st.swapShare.push(runSpend ? runSwap / runSpend : 0);
  st._endCoins = coins;
  // инвариант сохранения: старт + доход + бонус − потолок − траты = конец
  return cleared;
}

// ───────────────────────── самопроверка ─────────────────────────

function selftest() {
  const ok = (c, m) => { if (!c) throw new Error('selftest: ' + m); };
  // ориентации: X одна, I4 две, L — восемь, цены поворотов
  ok(optionsFor(CANON.X5).length === 1, 'X5 одна форма');
  ok(optionsFor(CANON.I4).length === 2, 'I4 две формы');
  ok(optionsFor(CANON.O).length === 1, 'O одна форма');
  const l = optionsFor(CANON.L).map((o) => o.cost).sort();
  ok(l.length === 8 && l.join() === [0, 2, 2, 2, 2, 4, 4, 4].join(), 'L: цены 0,2,2,2,2,4,4,4 got ' + l.join());
  ok(optionsFor(CANON.I4).find((o) => o.cost === CFG.ROT90), 'I4 поворот стоит ROT90');
  // линии: строка + столбец одновременно
  const b = new Uint8Array(8);
  for (let x = 1; x < 8; x++) b[0] |= 1 << x;         // строка 0 без x=0
  for (let y = 2; y < 8; y++) b[y] |= 1;              // столбец 0 без y=0,1
  b[1] |= 1;                                           // столбец 0 без y=0
  const out = new Uint8Array(8);
  const mono = optionsFor(CANON.mono)[0];
  ok(applyPlace(b, mono, 0, 0, out) === 2, 'строка+столбец = 2 линии');
  ok(out.every((v) => v === 0) || out[0] === 0, 'обе линии убраны');
  ok(CFG.income(3) === 9 && CFG.income(1) === 1, 'доход нелинейный');
  // детерминизм и инварианты по 300 забегам
  for (const p of [policy(Infinity), policy(0), policy(3, 2)]) {
    for (let s = 1; s <= 300; s++) {
      const a = newStats(), c = newStats();
      const ra = playRun(s, p, a), rc = playRun(s, p, c);
      ok(ra === rc, 'детерминизм seed ' + s);
      ok(a._endCoins >= 0 && a._endCoins <= CFG.CAP, 'кошелёк в границах');
      const bal = CFG.START_COINS + a.income + a.bonus - a.capLost - a.spent;
      ok(bal === a._endCoins, `сохранение монет seed ${s} ${p.name}: ${bal} vs ${a._endCoins}`);
    }
  }
  // сдача: тяжёлые пентомино растут с уровнем
  const hardShare = (L) => {
    const r = rng(7); let h = 0; const bd = new Uint8Array(8);
    for (let i = 0; i < 4000; i++) if (DEFS[deal(L, bd, r).type].cls === 'penta-hard') h++;
    return h / 4000;
  };
  ok(hardShare(8) > hardShare(1) + 0.15, 'сложные фигуры чаще на глубине');
  console.log('selftest ok');
}

// ───────────────────────── агрегатор ─────────────────────────

function merge(a, b) {
  const add = (x, y) => Array.isArray(x) ? x.map((v, i) => add(v, y[i])) : typeof x === 'object' && x ? Object.fromEntries(Object.keys({ ...x, ...y }).map((k) => [k, add(x[k] ?? 0, y[k] ?? 0)])) : x + y;
  const o = {};
  for (const k of Object.keys(a)) {
    if (k === 'outcomes' || k === 'swapShare') o[k] = a[k].concat(b[k]);
    else if (k === '_endCoins') o[k] = 0;
    else o[k] = add(a[k], b[k]);
  }
  return o;
}

export function runMany(seeds, pol) {
  const st = newStats();
  for (const s of seeds) playRun(s, pol, st);
  return st;
}

function pct(x, n) { return (100 * x / n).toFixed(1) + '%'; }
function summary(st) {
  const n = st.runs;
  const mean = st.levelsCleared / n;
  const sd = Math.sqrt(st.outcomes.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  return { mean, sd, se: sd / Math.sqrt(n) };
}

// ───────────────────────── запуск ─────────────────────────

const INCOME = {
  tri: (n) => (n * (n + 1)) / 2,   // 1, 3, 6, 10, 15 — как в игре
  lin: (n) => n,                   // 1, 2, 3, 4, 5 — абляция: линейный доход
  sq: (n) => n * n,                // 1, 4, 9, 16, 25 — абляция: круче
};

const spec = (p, incomeMode = 'game') => ({ lam: p.lam === Infinity ? 'inf' : p.lam, R: p.R, look: p.look, sq: p.sq, elastic: p.elastic, name: p.name, incomeMode });
const unspec = (o) => policy(o.lam === 'inf' ? Infinity : o.lam, o.R, { look: o.look, sq: o.sq, elastic: o.elastic, name: o.name });

async function parallel(seedFrom, count, pol, incomeMode = 'game') {
  const threads = Math.min(os.availableParallelism?.() ?? 4, 4);
  const chunk = Math.ceil(count / threads);
  const parts = await Promise.all(Array.from({ length: threads }, (_, i) => new Promise((res, rej) => {
    const from = seedFrom + i * chunk, to = Math.min(seedFrom + count, from + chunk);
    if (from >= to) return res(null);
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { from, to, pol: spec(pol, incomeMode) } });
    w.on('message', res); w.on('error', rej);
  })));
  return parts.filter(Boolean).reduce(merge);
}

// ───────────────────────── отчёт ─────────────────────────

const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const share = (a, b) => (b ? (100 * a) / b : 0);
const sum = (a) => a.reduce((x, y) => x + y, 0);
function pearson(a, b) {
  const n = a.length, ma = sum(a) / n, mb = sum(b) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(sa * sb);
}
function quant(arr, q) { const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
function entropyBits(counts) { const t = sum(counts); return -sum(counts.filter((c) => c > 0).map((c) => (c / t) * Math.log2(c / t))); }

function describe(st) {
  const n = st.runs;
  const mean = st.levelsCleared / n;
  const sd = Math.sqrt(sum(st.outcomes.map((v) => (v - mean) ** 2)) / n);
  const dec = sum(st.phase.map((p) => p.dec));
  const clears = sum(st.clearsBy.slice(1));
  return {
    n, mean, sd, se: sd / Math.sqrt(n),
    median: quant(st.outcomes, 0.5), p10: quant(st.outcomes, 0.1), p90: quant(st.outcomes, 0.9),
    reach: (k) => share(st.outcomes.filter((v) => v >= k).length, n),
    zeroBy: st.phase.map((p) => share(p.zero, p.dec)),
    capBy: st.phase.map((p) => share(p.cap, p.dec)),
    coinsBy: st.phase.map((p) => p.coins / p.dec),
    spendPerRun: st.spent / n, incomePerRun: (st.income + st.bonus) / n, capLostPerRun: st.capLost / n,
    forced: share(st.forced, st.decisions), tempted: share(st.tempted, st.decisions), close: share(st.closeCall, st.tempted),
    multi: share(sum(st.clearsBy.slice(2)), clears), multiIncome: share(sum(st.incomeBy.slice(2)), st.income),
    clears, dec,
  };
}

async function fullReport(N) {
  const t0 = Date.now();
  selftest();
  const out = [];
  const log = (s = '') => { out.push(s); console.log(s); };
  const P = (lam, R = 0, o = {}) => policy(lam, R, { look: 1, ...o });

  // 1. сетка λ×R на 2000 сидов — где оптимум
  const gridSeeds = 2000;
  const lams = [2, 3, 5, 8, 12, 20, 40];
  const grid = [];
  for (const R of [0, 4]) for (const lam of lams) {
    const st = await parallel(1, gridSeeds, P(lam, R));
    grid.push({ lam, R, d: describe(st) });
  }
  const best = grid.reduce((a, b) => (b.d.mean > a.d.mean ? b : a));
  log(`## Сетка политик (${gridSeeds} забегов на клетку, бот с планом на следующую фигуру)\n`);
  log('| λ (цена монеты в очках) | R=0: пройдено уровней | R=4: пройдено уровней |');
  log('|---|---|---|');
  for (const lam of lams) {
    const a = grid.find((g) => g.lam === lam && g.R === 0).d, b = grid.find((g) => g.lam === lam && g.R === 4).d;
    log(`| ${lam} | ${f2(a.mean)} ± ${f2(a.se)} | ${f2(b.mean)} ± ${f2(b.se)} |`);
  }
  log(`\nЛучшая клетка: λ=${best.lam}, R=${best.R}.\n`);

  // 2. полный прогон на N сидах
  const lineup = [
    ['Никогда не платит', P(Infinity)],
    ['Транжира (λ=2)', P(2)],
    [`Оптимум (λ=${best.lam}, R=${best.R})`, P(best.lam, best.R)],
    ['Скупой (λ=40)', P(40)],
    [`Оптимум без плана на очередь`, policy(best.lam, best.R, { look: 0 })],
    [`Охотник за комбо (λ=${best.lam}, вес почти-полных линий ×3)`, P(best.lam, best.R, { sq: 0.2 })],
  ];
  const res = [];
  for (const [name, pol] of lineup) {
    const st = await parallel(1, N, pol);
    res.push({ name, pol, st, d: describe(st) });
    console.error(`  ${name}: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  const R = (i) => res[i];
  const bestRes = R(2);

  log(`## Монте-Карло: ${N} забегов на бота\n`);
  log('| Бот | Пройдено уровней (ср. ± SE) | медиана | p10–p90 | σ | дойти до 3 | до 5 | до 8 |');
  log('|---|---|---|---|---|---|---|---|');
  for (const r of res) log(`| ${r.name} | ${f2(r.d.mean)} ± ${f2(r.d.se)} | ${r.d.median} | ${r.d.p10}–${r.d.p90} | ${f2(r.d.sd)} | ${f1(r.d.reach(3))}% | ${f1(r.d.reach(5))}% | ${f1(r.d.reach(8))}% |`);

  log('\n### Проход по уровням у оптимального бота\n');
  log('| Уровень | цель, линий | попыток | пройдено | линий в среднем |');
  log('|---|---|---|---|---|');
  for (let L = 1; L <= CFG.MAX_LEVELS; L++) {
    const s = bestRes.st;
    if (!s.playByLevel[L]) break;
    log(`| ${L} | ${CFG.goal(L)} | ${s.playByLevel[L]} | ${f1(share(s.winByLevel[L], s.playByLevel[L]))}% | ${f1(s.linesByLevel[L] / s.playByLevel[L])} |`);
  }

  const bd = bestRes.d, bs = bestRes.st;
  log('\n### Экономика оптимального бота\n');
  log('| Треть уровня | средний кошелёк | ходов с 0 монет | ходов с полным кошельком (10) |');
  log('|---|---|---|---|');
  ['первая', 'вторая', 'третья'].forEach((n, i) => log(`| ${n} | ${f1(bd.coinsBy[i])} | ${f1(bd.zeroBy[i])}% | ${f1(bd.capBy[i])}% |`));
  log(`\nДоход за забег: ${f1(bd.incomePerRun)} монет (вместе с бонусом за уровень), траты: ${f1(bd.spendPerRun)}, сгорело у потолка: ${f1(bd.capLostPerRun)}.`);
  const tot = bs.spent;
  log('\nНа что уходят монеты: ' + Object.entries(bs.spend).map(([k, v]) => `${k} ${f1(share(v, tot))}%`).join(', ') + '.');
  log('Покупок за забег: ' + Object.entries(bs.uses).map(([k, v]) => `${k} ${f1(v / bs.runs)}`).join(', ') + '.');
  log(`\nДоход по размеру клира: ` + [1, 2, 3, 4].map((k) => `${k} лин. — ${bs.clearsBy[k]} клиров, ${f1(share(bs.incomeBy[k], bs.income))}% дохода`).join('; ') + '.');
  log(`Клиров из 2+ линий: ${f1(bd.multi)}%, они дают ${f1(bd.multiIncome)}% дохода.`);

  log('\n### Настоящий ли выбор\n');
  log(`Ходов, где у бота не было ни одной постановки без платы (вынужденная трата): ${f1(bd.forced)}%.`);
  log(`Ходов, где платный вариант был на столе: ${f1(bd.tempted)}%; из них «спорных» (платный и бесплатный ближе чем на 3 очка): ${f1(bd.close)}%.`);

  log('\n### Разнообразие\n');
  const classShare = {};
  for (const [t, c] of Object.entries(bs.typeCount)) classShare[DEFS[t].cls] = (classShare[DEFS[t].cls] || 0) + c;
  const totalPieces = sum(Object.values(bs.typeCount));
  log('Сданные фигуры по классам: ' + Object.entries(classShare).map(([k, v]) => `${k} ${f1(share(v, totalPieces))}%`).join(', ') + '.');
  log(`Энтропия сдачи: ${f2(entropyBits(Object.values(bs.typeCount)))} бит из ${f2(Math.log2(TYPES.length))} возможных (${TYPES.length} видов).`);
  const swapQ = [0.1, 0.5, 0.9].map((q) => quant(bs.swapShare, q));
  log(`Доля монет, ушедшая на замену фигур, по забегам: p10 ${f2(swapQ[0])}, медиана ${f2(swapQ[1])}, p90 ${f2(swapQ[2])} — стили забегов разные, если разброс широкий.`);
  const hist = Array(CFG.MAX_LEVELS + 1).fill(0);
  bs.outcomes.forEach((v) => hist[v]++);
  log('Гистограмма исходов (уровней пройдено: доля забегов): ' + hist.map((h, i) => (h ? `${i}: ${f1(share(h, bs.runs))}%` : null)).filter(Boolean).join(', ') + '.');
  log(`Корреляция исходов на одинаковых сидах: оптимум↔никогда не платит ${f2(pearson(R(2).st.outcomes, R(0).st.outcomes))}, оптимум↔транжира ${f2(pearson(R(2).st.outcomes, R(1).st.outcomes))}, оптимум↔скупой ${f2(pearson(R(2).st.outcomes, R(3).st.outcomes))}, оптимум↔без плана ${f2(pearson(R(2).st.outcomes, R(4).st.outcomes))} (высокая — решает удача сида, низкая — решает стратегия).`);

  // 3. абляция дохода
  log('\n### Абляция дохода за линии (оптимальный бот, 3000 забегов)\n');
  log('| Доход за n линий за раз | пройдено уровней | клиров из 2+ линий |');
  log('|---|---|---|');
  for (const [nm, mode] of [['n²: 1, 4, 9, 16 (в игре, v2)', 'game'], ['n(n+1)/2: 1, 3, 6, 10 (v1)', 'tri'], ['n: 1, 2, 3, 4 (линейный)', 'lin']]) {
    const st = await parallel(1, 3000, P(best.lam, best.R), mode);
    const d = describe(st);
    log(`| ${nm} | ${f2(d.mean)} ± ${f2(d.se)} | ${f1(d.multi)}% |`);
  }
  log(`\nВремя прогона: ${((Date.now() - t0) / 1000).toFixed(0)} с.`);
  return out.join('\n');
}

// ───────────────────────── точка входа ─────────────────────────

if (!isMainThread && workerData) {
  const { from, to, pol } = workerData;
  if (pol.incomeMode !== 'game') CFG.income = INCOME[pol.incomeMode];
  const seeds = []; for (let s = from; s < to; s++) seeds.push(s);
  parentPort.postMessage(runMany(seeds, unspec(pol)));
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) selftest();
  else if (args.includes('--full')) await fullReport(Number(args[args.indexOf('--full') + 1]) || 10000);
  else console.log('node tools/block-market-sim.mjs --selftest | --full [N]');
}
