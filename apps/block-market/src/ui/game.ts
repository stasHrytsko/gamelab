import { baseCells, colorOf, swapPrice, TYPES, type PieceType } from '../engine/catalog.ts';
import { CFG } from '../engine/config.ts';
import {
  countFits, fits, mirrorPiece, place, preview, rotatePiece, startLevel, stuck, swapPiece,
  type GameEvent, type GameState, type Outcome, type Purchase,
} from '../engine/engine.ts';
import { reducedMotion, vibrate, wait } from './feedback.ts';
import { icon } from './icons.ts';
import { log } from './log.ts';
import { pieceHtml } from './pieces.ts';
import { openPopup, type PopupAction } from './popup.ts';
import type { Go } from './screens.ts';
import { levelDef, LEVEL_COUNT } from '../levels/levels.ts';
import { loadProgress, markHowToPlaySeen, markPassed } from './storage.ts';

export interface Screen {
  el: HTMLElement;
  destroy: () => void;
}

export interface GameParams {
  readonly level: number;
  /** ?seed=N: своё зерно вместо зерна уровня. */
  readonly seed: number | null;
  /** ?goal=N: своя цель по линиям. */
  readonly goal: number | null;
}

const N = CFG.SIZE;
const GAP = 3;
const PAD = 8;
/** Палец закрывает фигуру, поэтому она висит выше точки касания. */
const LIFT = 44;

const dur = (ms: number): number => (reducedMotion() ? 1 : ms);

const COSTS: Record<Exclude<Purchase, 'swap'>, number> = { rotate: CFG.ROTATE_COST, mirror: CFG.MIRROR_COST };
const cheapestSwap = Math.min(...TYPES.map(swapPrice));

const coinAcc = (n: number): string => (n % 10 === 1 && n % 100 !== 11 ? 'монету' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'монеты' : 'монет');
const burnText = (n: number): string => (n === 1 ? 'Фигура сгорела: некуда встать, а монет нет' : `Сгорело фигур: ${String(n)}. Некуда встать, а монет нет`);

const coinWord = (n: number): string => (n % 10 === 1 && n % 100 !== 11 ? 'монета' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'монеты' : 'монет');

export function gameScreen(go: Go, params: GameParams): Screen {
  const def = levelDef(params.level);
  if (def === undefined) throw new Error(`no level ${String(params.level)}`);
  const seed = params.seed ?? def.seed;
  let state: GameState = startLevel(def, { seed: params.seed, goal: params.goal });
  let busy = false;
  let sheetOpen = false;
  let popupOpen = false;
  let cell = 30;

  const el = document.createElement('main');
  el.className = 'screen game';
  el.dataset['testid'] = 'game';
  el.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" data-testid="to-home" aria-label="В меню">${icon.back}</button>
      <h2 data-testid="title">Уровень 1</h2>
      <div class="right">
        <button class="icon-btn q" data-testid="help" aria-label="Как играть">${icon.help}</button>
        <button class="icon-btn" data-testid="restart" aria-label="Заново">${icon.replay}</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat" data-testid="stat-pieces" title="Фигур показано из ${String(CFG.PIECES)}"><span class="ic" style="--c:var(--ui-blue)">${icon.pieces}</span><span class="t"><b></b><small></small></span></div>
      <div class="stat" data-testid="stat-lines" title="Линий собрано"><span class="ic" style="--c:var(--ui-green)">${icon.lines}</span><span class="t"><b></b><small></small></span></div>
      <div class="stat" data-testid="stat-coins" title="Монет в кошельке"><span class="ic coin-ic">${icon.coin}</span><span class="t"><b></b><small></small></span></div>
    </div>
    <div class="stage"><div class="board" data-testid="board"></div></div>
    <div class="tray" data-testid="tray">
      ${[0, 1, 2].map((i) => `<div class="slot" data-slot="${String(i)}" data-testid="slot-${String(i)}"><div class="slot-piece"></div></div>`).join('')}
    </div>
    <div class="shop">
      ${shopButton('rotate', icon.rotate, 'Поворот 90°')}
      ${shopButton('mirror', icon.mirror, 'Зеркало')}
      ${shopButton('swap', icon.swap, 'Замена')}
    </div>
    <div class="hint" data-testid="hint"></div>`;

  const $ = <T extends HTMLElement>(sel: string): T => el.querySelector<T>(sel) as T;
  const stage = $('.stage');
  const board = $('.board');
  const slotEls = [...el.querySelectorAll<HTMLElement>('.slot')];
  /** Выбранная фигура: на неё действуют покупки. */
  let sel = 0;
  const hint = $('.hint');
  const buttons = new Map<Purchase, HTMLButtonElement>(
    (['rotate', 'mirror', 'swap'] as const).map((k) => [k, $<HTMLButtonElement>(`[data-buy="${k}"]`)]),
  );
  const cellEls: HTMLElement[] = [];
  for (let i = 0; i < N * N; i += 1) {
    const c = document.createElement('div');
    c.className = 'cell';
    c.dataset['i'] = String(i);
    cellEls.push(c);
    board.append(c);
  }

  // ---------- раскладка ----------
  const layout = (): void => {
    const w = stage.clientWidth, h = stage.clientHeight;
    cell = Math.max(18, Math.min(54, Math.floor(Math.min((w - 2 * PAD - (N - 1) * GAP) / N, (h - 2 * PAD - (N - 1) * GAP) / N))));
    board.style.setProperty('--cell', `${String(cell)}px`);
    board.style.setProperty('--gap', `${String(GAP)}px`);
    board.style.setProperty('--pad', `${String(PAD)}px`);
  };
  const observer = new ResizeObserver(layout);
  observer.observe(stage);

  // ---------- отрисовка ----------
  const setHint = (html: string): void => { hint.innerHTML = html; };

  function defaultHint(): string {
    if (state.status !== 'playing') return '';
    if (stuck(state)) return 'Ни одной фигуре некуда встать: <b>поверни, отзеркаль или замени</b>';
    if (state.lines >= state.goal) return '<b>Цель выполнена.</b> Доигрывай уровень и копи монеты';
    return 'Выбери любую фигуру и перетащи на поле';
  }

  function render(): void {
    const s = state;
    el.dataset['status'] = s.status;
    el.dataset['busy'] = busy ? '1' : '0';
    el.dataset['level'] = String(s.level);
    el.dataset['coins'] = String(s.coins);
    el.dataset['used'] = String(s.used);
    el.dataset['lines'] = String(s.lines);
    el.dataset['goal'] = String(s.goal);
    if (sel >= s.hand.length) sel = Math.max(0, s.hand.length - 1);
    el.dataset['piece'] = s.hand[sel]?.type ?? '';
    el.dataset['sel'] = String(sel);
    el.dataset['hand'] = s.hand.map((p) => p.type).join(',');
    el.dataset['stuck'] = stuck(s) ? '1' : '0';
    $('[data-testid="title"]').textContent = `Уровень ${String(s.level)}`;
    const left = Math.max(0, CFG.PIECES - s.dealIdx);
    el.dataset['shown'] = String(s.dealIdx);
    $('[data-testid="stat-pieces"] b').innerHTML = `${String(s.dealIdx)}<i>/${String(CFG.PIECES)}</i>`;
    $('[data-testid="stat-pieces"] small').textContent = left === 0 ? 'все показаны' : `осталось ${String(left)}`;
    const linesLeft = Math.max(0, s.goal - s.lines);
    $('[data-testid="stat-lines"] b').innerHTML = `${String(s.lines)}<i>/${String(s.goal)}</i>`;
    $('[data-testid="stat-lines"] small').textContent = linesLeft === 0 ? 'цель набрана' : `ещё ${String(linesLeft)}`;
    $('[data-testid="stat-lines"]').classList.toggle('done', s.lines >= s.goal);
    $('[data-testid="stat-coins"] b').innerHTML = `${String(s.coins)}<i>/${String(CFG.CAP)}</i>`;
    $('[data-testid="stat-coins"] small').textContent = s.coins >= CFG.CAP ? 'кошелёк полон' : 'монеты';
    $('[data-testid="stat-coins"]').classList.toggle('full', s.coins >= CFG.CAP);

    s.board.forEach((v, i) => {
      const c = cellEls[i] as HTMLElement;
      c.className = 'cell';
      c.replaceChildren();
      if (v !== 0) {
        const t = document.createElement('i');
        t.className = `tile c-${String(v)}`;
        c.append(t);
      }
    });

    slotEls.forEach((slotEl, i) => {
      const p = s.hand[i];
      (slotEl.firstElementChild as HTMLElement).innerHTML = p === undefined ? '' : pieceHtml(p.cells, p.color);
      slotEl.classList.toggle('empty', p === undefined);
      slotEl.classList.toggle('sel', p !== undefined && i === sel);
      slotEl.classList.toggle('lifted', false);
    });

    const playing = s.status === 'playing';
    const can: Record<Purchase, boolean> = {
      rotate: playing && rotatePiece(s, sel) !== null,
      mirror: playing && mirrorPiece(s, sel) !== null,
      swap: playing && s.hand[sel] !== undefined && s.coins >= cheapestSwap,
    };
    for (const [k, b] of buttons) {
      b.classList.toggle('off', !can[k]);
      b.setAttribute('aria-disabled', can[k] ? 'false' : 'true');
    }
    setHint(defaultHint());
  }

  // ---------- подсказка при перетаскивании ----------
  function clearPreview(): void {
    for (const c of cellEls) c.classList.remove('ghost', 'hot');
    board.style.removeProperty('--pc');
  }

  function showPreview(anchor: { x: number; y: number } | null): void {
    clearPreview();
    if (anchor === null) { setHint(defaultHint()); return; }
    const pv = preview(state, dragSlot, anchor.x, anchor.y);
    if (pv === null) { setHint(defaultHint()); return; }
    board.style.setProperty('--pc', `var(--piece-${String(state.hand[dragSlot]?.color ?? 1)})`);
    for (const i of pv.placed) cellEls[i]?.classList.add('ghost');
    for (const r of pv.rows) for (let c = 0; c < N; c += 1) cellEls[r * N + c]?.classList.add('hot');
    for (const c of pv.cols) for (let r = 0; r < N; r += 1) cellEls[r * N + c]?.classList.add('hot');
    setHint(pv.lines > 0 ? `Закроет <b>${String(pv.lines)} ${lineWord(pv.lines)}</b> и вернёт <b>${String(pv.income)} ${coinAcc(pv.income)}</b>` : defaultHint());
  }

  const lineWord = (n: number): string => (n === 1 ? 'линию' : n < 5 ? 'линии' : 'линий');

  // ---------- перетаскивание фигуры ----------
  let drag: HTMLElement | null = null;
  let dragSlot = 0;
  let dragStart = { x: 0, y: 0 };
  let dragMoved = false;
  let anchor: { x: number; y: number } | null = null;

  function anchorAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const piece = state.hand[dragSlot];
    if (piece === undefined || drag === null) return null;
    const rect = board.getBoundingClientRect();
    const box = drag.getBoundingClientRect();
    const step = cell + GAP;
    const fx = (box.left - rect.left - PAD) / step;
    const fy = (box.top - rect.top - PAD) / step;
    void clientX; void clientY;
    let best: { x: number; y: number; d: number } | null = null;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = Math.round(fx) + dx, y = Math.round(fy) + dy;
        const d = Math.hypot(x - fx, y - fy);
        if (d <= 0.95 && fits(state.board, piece.cells, x, y) && (best === null || d < best.d)) best = { x, y, d };
      }
    }
    return best === null ? null : { x: best.x, y: best.y };
  }

  function moveDrag(e: PointerEvent): void {
    if (drag === null) return;
    const box = drag.getBoundingClientRect();
    drag.style.transform = `translate(${String(e.clientX - box.width / 2)}px, ${String(e.clientY - LIFT - box.height)}px)`;
    anchor = anchorAt(e.clientX, e.clientY);
    showPreview(anchor);
  }

  function endDrag(): void {
    drag?.remove();
    drag = null;
    anchor = null;
    for (const slotEl of slotEls) slotEl.classList.remove('lifted');
    clearPreview();
  }

  slotEls.forEach((slotEl, i) => {
    slotEl.addEventListener('pointerdown', (e) => {
      const piece = state.hand[i];
      if (busy || sheetOpen || popupOpen || state.status !== 'playing' || piece === undefined) return;
      e.preventDefault();
      slotEl.setPointerCapture(e.pointerId);
      if (sel !== i) {
        sel = i;
        render();
      }
      dragSlot = i;
      dragStart = { x: e.clientX, y: e.clientY };
      dragMoved = false;
      drag = document.createElement('div');
      drag.className = 'drag';
      drag.style.setProperty('--u', `${String(cell)}px`);
      drag.style.setProperty('--g', `${String(GAP)}px`);
      drag.innerHTML = pieceHtml(piece.cells, piece.color);
      drag.style.visibility = 'hidden';
      el.append(drag);
      slotEl.classList.add('lifted');
    });
    slotEl.addEventListener('pointermove', (e) => {
      if (drag === null) return;
      if (!dragMoved && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) < 6) return;
      dragMoved = true;
      drag.style.visibility = 'visible';
      moveDrag(e);
    });
    slotEl.addEventListener('pointerup', (e) => {
      if (drag === null) return;
      if (!dragMoved) { endDrag(); return; } // просто тап: выбрали фигуру
      moveDrag(e);
      const target = anchor;
      if (target === null) {
        const over = board.getBoundingClientRect();
        if (e.clientY - LIFT > over.top - 20 && e.clientY < over.bottom + 40) { vibrate(20); shake(board); }
        endDrag();
        return;
      }
      void commitPlace(dragSlot, target.x, target.y);
    });
    slotEl.addEventListener('pointercancel', endDrag);
  });

  // ---------- анимации ----------
  function shake(node: HTMLElement): void {
    node.classList.remove('shake-x');
    void node.offsetWidth;
    node.classList.add('shake-x');
  }

  function floatText(html: string): void {
    const pop = document.createElement('div');
    pop.className = 'pop';
    pop.dataset['testid'] = 'pop';
    pop.innerHTML = html;
    stage.append(pop);
    pop.animate(
      [{ transform: 'translate(-50%, 0)', opacity: 0 }, { transform: 'translate(-50%, -14px)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%, -46px)', opacity: 0 }],
      { duration: dur(1100), easing: 'ease-out', fill: 'forwards' },
    ).finished.then(() => pop.remove(), () => pop.remove());
  }

  function bumpCoins(): void {
    const node = $('[data-testid="stat-coins"]');
    node.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: dur(260), easing: 'ease-out' });
  }

  function toast(text: string): void {
    setHint(`<span class="burn">${text}</span>`);
    setTimeout(() => { if (!busy && state.status === 'playing') setHint(defaultHint()); }, 1800);
  }

  // ---------- действия ----------
  const setBusy = (v: boolean): void => { busy = v; el.dataset['busy'] = v ? '1' : '0'; };

  async function commitPlace(slot: number, x: number, y: number): Promise<void> {
    const piece = state.hand[slot];
    const fitsBefore = piece === undefined ? 0 : countFits(state.board, piece.cells);
    const out = place(state, slot, x, y);
    if (out === null || piece === undefined) { endDrag(); return; }
    const ev = out.event as Extract<GameEvent, { kind: 'place' }>;
    setBusy(true);
    endDrag();
    // 1. фигура встаёт на поле
    for (const i of ev.placed) {
      const c = cellEls[i] as HTMLElement;
      const t = document.createElement('i');
      t.className = `tile c-${String(piece.color)}`;
      c.append(t);
      t.animate([{ transform: 'scale(.7)' }, { transform: 'scale(1.06)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: dur(180), easing: 'ease-out' });
    }
    log({ type: 'place', level: state.level, turn: state.used, slot, piece: piece.type, fits: fitsBefore, lines: ev.lines, income: ev.income, gained: ev.gained, coins: out.state.coins, burned: ev.burned.length });
    await wait(ev.cleared.length > 0 ? 170 : 90);
    // 2. линии исчезают волной от поставленной фигуры
    if (ev.cleared.length > 0) {
      const cx = ev.placed.reduce((a, i) => a + (i % N), 0) / ev.placed.length;
      const cy = ev.placed.reduce((a, i) => a + Math.floor(i / N), 0) / ev.placed.length;
      for (const i of ev.cleared) {
        const t = cellEls[i]?.firstElementChild as HTMLElement | null;
        if (t === null || t === undefined) continue;
        const d = Math.hypot((i % N) - cx, Math.floor(i / N) - cy);
        t.animate(
          [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.14)', opacity: 1, offset: 0.3 }, { transform: 'scale(0)', opacity: 0 }],
          { duration: dur(300), delay: dur(d * 28), easing: 'ease-in', fill: 'forwards' },
        );
      }
      const capNote = ev.gained < ev.income ? ` <small>(в кошельке лимит ${String(CFG.CAP)})</small>` : '';
      floatText(`${icon.coin}<b>+${String(ev.income)}</b> <small>${String(ev.lines)} ${lineWord(ev.lines)}</small>${capNote}`);
      vibrate(ev.lines > 1 ? [18, 30, 18] : 14);
      await wait(360);
    }
    // 3. новое состояние
    state = out.state;
    render();
    if (ev.gained > 0) bumpCoins();
    if (ev.burned.length > 0) toast(burnText(ev.burned.length));
    setBusy(false);
    afterChange();
  }

  const labelFor = (k: Purchase): string => ({ rotate: 'Поворот', mirror: 'Зеркало', swap: 'Замена' })[k];

  async function buy(kind: Purchase, type?: PieceType): Promise<void> {
    if (busy || sheetOpen || popupOpen || state.status !== 'playing') return;
    const button = buttons.get(kind) as HTMLButtonElement;
    const out: Outcome | null =
      kind === 'rotate' ? rotatePiece(state, sel)
      : kind === 'mirror' ? mirrorPiece(state, sel)
      : type === undefined ? null : swapPiece(state, sel, type);
    if (out === null) {
      const cost = kind === 'swap' ? cheapestSwap : COSTS[kind];
      const reason = state.coins < cost ? 'no_coins' : 'no_change';
      log({ type: 'buy_refused', level: state.level, purchase: kind, reason });
      shake(button);
      vibrate(30);
      toast(reason === 'no_coins' ? `Не хватает монет: ${labelFor(kind).toLowerCase()} стоит ${kind === 'swap' ? 'от ' : ''}${String(cost)}` : 'У этой фигуры ничего не изменится');
      return;
    }
    const ev = out.event as Extract<GameEvent, { kind: 'buy' }>;
    const wasType = state.hand[sel]?.type ?? '';
    setBusy(true);
    state = out.state;
    render();
    log({ type: 'buy', level: state.level, slot: ev.slot, purchase: kind, piece: wasType, cost: ev.cost, coins: state.coins, burned: ev.burned.length });
    const slot = (slotEls[sel]?.firstElementChild?.firstElementChild ?? null) as HTMLElement | null;
    const frames: Keyframe[] =
      kind === 'rotate' ? [{ transform: 'rotate(-90deg) scale(.85)', opacity: 0.4 }, { transform: 'none', opacity: 1 }]
      : kind === 'mirror' ? [{ transform: 'scaleX(-1)', opacity: 0.4 }, { transform: 'none', opacity: 1 }]
      : [{ transform: 'scale(.5) rotate(-12deg)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }];
    slot?.animate(frames, { duration: dur(240), easing: 'cubic-bezier(.3,1.4,.5,1)' });
    const coinNode = $('[data-testid="stat-coins"]');
    coinNode.animate([{ transform: 'scale(1)' }, { transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: dur(240) });
    await wait(240);
    if (ev.burned.length > 0) toast(burnText(ev.burned.length));
    setBusy(false);
    afterChange();
  }

  for (const [kind, b] of buttons) {
    b.addEventListener('click', () => {
      if (kind === 'swap') openSheet();
      else void buy(kind);
    });
  }

  // ---------- шторка «Замена» ----------
  function openSheet(): void {
    if (busy || sheetOpen || popupOpen || state.status !== 'playing') return;
    if (state.coins < cheapestSwap) { void buy('swap'); return; }
    sheetOpen = true;
    const cur = state.hand[sel];
    const types = [...TYPES].sort((a, b) => swapPrice(a) - swapPrice(b) || TYPES.indexOf(a) - TYPES.indexOf(b));
    const scrim = document.createElement('div');
    scrim.className = 'scrim sheet-scrim';
    scrim.dataset['testid'] = 'swap-sheet';
    scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-head"><h3>Заменить фигуру</h3><button class="icon-btn small" data-testid="swap-close" aria-label="Закрыть">${icon.close}</button></div>
        <p class="sheet-sub">Выбери фигуру. Что не по карману — приглушено. В кошельке <b>${String(state.coins)}</b>.</p>
        <div class="opts">${types.map((t) => {
          const price = swapPrice(t);
          const off = price > state.coins || (cur !== undefined && cur.type === t && cur.cells.length > 0 && countSame(cur, t));
          return `<button class="opt${off ? ' off' : ''}" data-type="${t}" data-testid="swap-option-${t}" aria-disabled="${off ? 'true' : 'false'}">${pieceHtml(baseCells(t), colorOf(t))}<span class="price">${icon.coin}${String(price)}</span></button>`;
        }).join('')}</div>
        <button class="btn btn-primary" data-testid="swap-confirm" disabled>Выбери фигуру</button>
      </div>`;
    el.append(scrim);
    let chosen: PieceType | null = null;
    const confirm = scrim.querySelector<HTMLButtonElement>('[data-testid="swap-confirm"]') as HTMLButtonElement;
    const close = (): void => {
      sheetOpen = false;
      scrim.classList.add('closing');
      setTimeout(() => scrim.remove(), 170);
    };
    scrim.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === scrim || target.closest('[data-testid="swap-close"]') !== null) { close(); return; }
      const opt = target.closest<HTMLElement>('.opt');
      if (opt !== null) {
        const t = opt.dataset['type'] as PieceType;
        if (opt.classList.contains('off')) { shake(opt); vibrate(20); return; }
        chosen = t;
        scrim.querySelectorAll('.opt').forEach((o) => o.classList.toggle('sel', o === opt));
        confirm.disabled = false;
        confirm.innerHTML = `Взять за ${String(swapPrice(t))} ${icon.coin}`;
        return;
      }
      if (target.closest('[data-testid="swap-confirm"]') !== null && chosen !== null) {
        const t = chosen;
        close();
        void buy('swap', t);
      }
    });
  }

  // ---------- конец уровня ----------
  function afterChange(): void {
    if (state.status === 'playing') return;
    const status = state.status;
    setBusy(true);
    void (async () => {
      await wait(status === 'lost' ? 900 : 520);
      showEnd();
    })();
  }

  function restart(): void {
    state = startLevel(def as NonNullable<typeof def>, { seed: params.seed, goal: params.goal });
    sel = 0;
    setBusy(false);
    render();
    log({ type: 'level_start', level: state.level, seed, coins: state.coins });
  }

  function showEnd(): void {
    popupOpen = true;
    const done = (fn: () => void) => (): void => { popupOpen = false; fn(); };
    const menu: PopupAction = { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: done(() => go('#/levels')) };
    const again: PopupAction = { id: 'again', html: `${icon.replay} Переиграть`, className: 'btn-secondary', run: done(restart) };
    if (state.status === 'won') {
      markPassed(state.level);
      log({ type: 'level_win', level: state.level, lines: state.lines, goal: state.goal, coins: state.coins });
      if (state.level >= LEVEL_COUNT) {
        openPopup(el, `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2><p class="sub">Пять из пяти. Линий на последнем: ${String(state.lines)} из ${String(state.goal)}.</p>`, [{ ...again, className: 'btn-primary' }, menu], 'popup-final');
      } else {
        const nextId = state.level + 1;
        openPopup(el, `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень ${String(state.level)} пройден</h2><p class="sub">Линий: ${String(state.lines)} из ${String(state.goal)}. В кошельке осталось ${String(state.coins)} ${coinWord(state.coins)}.</p>`, [
          { id: 'next', html: `Следующий уровень ${icon.play}`, className: 'btn-success', run: done(() => go(`#/level/${String(nextId)}`)) },
          again,
          menu,
        ], 'popup-win');
      }
    } else {
      log({ type: 'level_fail', level: state.level, reason: 'goal_missed', lines: state.lines, goal: state.goal });
      openPopup(el, `<div class="badge-big badge-lose">${icon.cross}</div><h2>Цель не набрана</h2><p class="sub">Линий: ${String(state.lines)} из ${String(state.goal)}.</p>`, [{ ...again, className: 'btn-primary' }, menu], 'popup-lose');
    }
  }

  // ---------- «Как играть» ----------
  function openHelp(): void {
    if (popupOpen || sheetOpen) return;
    popupOpen = true;
    markHowToPlaySeen();
    log({ type: 'help_open', level: state.level });
    openPopup(el, `<h2>Как играть?</h2>
      <ol class="rules">
        <li><b>1</b><span>Выбери любую из трёх фигур и перетащи на поле. Полная строка или столбец исчезает и платит монеты: <b>1, 4, 9</b> за 1, 2, 3 линии сразу.</span></li>
        <li><b>2</b><span>Фигура неудобная? За монеты можно <b>повернуть</b>, <b>отзеркалить</b> или <b>заменить</b> выбранную. В кошельке до ${String(CFG.CAP)}.</span></li>
        <li><b>3</b><span>На уровне ${String(CFG.PIECES)} фигур. Сверху видно, сколько уже показано и сколько линий ещё нужно.</span></li>
        <li><b>4</b><span>Если ни одной из трёх некуда встать и никакая покупка не поможет, одна фигура сгорает.</span></li>
      </ol>`, [{ id: 'ok', html: 'Понятно!', className: 'btn-primary', run: () => { popupOpen = false; } }], 'popup-help');
  }

  $('[data-testid="to-home"]').addEventListener('click', () => go('#/'));
  $('[data-testid="help"]').addEventListener('click', openHelp);
  $('[data-testid="restart"]').addEventListener('click', () => { if (!busy && !popupOpen && !sheetOpen) restart(); });

  layout();
  render();
  log({ type: 'level_start', level: state.level, seed, coins: state.coins });
  if (!loadProgress().howToPlaySeen) queueMicrotask(openHelp);

  return {
    el,
    destroy: () => {
      observer.disconnect();
      drag?.remove();
    },
  };
}

// ---------- мелочи ----------
const countSame = (cur: { cells: readonly (readonly [number, number])[] }, t: PieceType): boolean =>
  JSON.stringify(cur.cells) === JSON.stringify(baseCells(t));

function shopButton(kind: Purchase, ic: string, label: string): string {
  const cost = kind === 'swap' ? `от ${String(cheapestSwap)}` : String(COSTS[kind]);
  return `<button class="buy" data-buy="${kind}" data-testid="buy-${kind}"><span class="bi">${ic}</span><span class="n">${label}</span><span class="price">${icon.coin}${cost}</span></button>`;
}
