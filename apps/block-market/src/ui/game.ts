import { baseCells, colorOf, swapPrice, TYPES, type PieceType } from '../engine/catalog.ts';
import { CFG } from '../engine/config.ts';
import {
  countFits, fits, MIN_COST, mirrorCurrent, nextLevel, place, preview, rerollCurrent, rotateCurrent, startRun, stuck, swapCurrent,
  type GameEvent, type GameState, type Outcome, type Purchase,
} from '../engine/engine.ts';
import { reducedMotion, vibrate, wait } from './feedback.ts';
import { icon } from './icons.ts';
import { log } from './log.ts';
import { pieceHtml } from './pieces.ts';
import { openPopup, type PopupAction } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, recordBest } from './storage.ts';

export interface Screen {
  el: HTMLElement;
  destroy: () => void;
}

export interface RunParams {
  readonly seed: number;
  readonly level: number;
  readonly goal: number | null;
  /** Зерно задано в адресе: «Заново» повторяет ту же партию. */
  readonly fixedSeed: boolean;
}

const N = CFG.SIZE;
const GAP = 3;
const PAD = 8;
/** Палец закрывает фигуру, поэтому она висит выше точки касания. */
const LIFT = 44;

const dur = (ms: number): number => (reducedMotion() ? 1 : ms);
const randomSeed = (): number => (Math.floor(Math.random() * 2 ** 31) ^ Date.now()) >>> 0;

const COSTS: Record<Exclude<Purchase, 'swap'>, number> = { rotate: CFG.ROTATE_COST, mirror: CFG.MIRROR_COST, reroll: CFG.REROLL_COST };
const cheapestSwap = Math.min(...TYPES.map(swapPrice));

const coinAcc = (n: number): string => (n % 10 === 1 && n % 100 !== 11 ? 'монету' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'монеты' : 'монет');
const burnText = (n: number): string => (n === 1 ? 'Фигура сгорела: некуда встать, а монет нет' : `Сгорело фигур: ${String(n)}. Некуда встать, а монет нет`);

const coinWord = (n: number): string => (n % 10 === 1 && n % 100 !== 11 ? 'монета' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'монеты' : 'монет');

export function gameScreen(go: Go, params: RunParams): Screen {
  let seed = params.seed;
  let state: GameState = startRun(seed, { level: params.level, goal: params.goal });
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
      <div class="stat" data-testid="stat-pieces"><span class="ic" style="--c:var(--ui-blue)">${icon.pieces}</span><span class="t"><small>Фигуры</small><b></b></span></div>
      <div class="stat" data-testid="stat-lines"><span class="ic" style="--c:var(--ui-green)">${icon.lines}</span><span class="t"><small>Линии</small><b></b></span></div>
      <div class="stat" data-testid="stat-coins"><span class="ic coin-ic">${icon.coin}</span><span class="t"><small>Монеты</small><b></b></span></div>
    </div>
    <div class="stage"><div class="board" data-testid="board"></div></div>
    <div class="queue">
      <div class="now" data-testid="now"><span class="lab">Сейчас</span><div class="now-slot"></div></div>
      <div class="next"><span class="lab2">Дальше</span><div class="next-row"><div class="nslot"></div><div class="nslot"></div></div></div>
    </div>
    <div class="shop">
      ${shopButton('rotate', icon.rotate, 'Поворот 90°')}
      ${shopButton('mirror', icon.mirror, 'Зеркало')}
      ${shopButton('swap', icon.swap, 'Замена')}
      ${shopButton('reroll', icon.reroll, 'Пересдача')}
    </div>
    <div class="hint" data-testid="hint"></div>`;

  const $ = <T extends HTMLElement>(sel: string): T => el.querySelector<T>(sel) as T;
  const stage = $('.stage');
  const board = $('.board');
  const nowSlot = $('.now-slot');
  const nowBox = $('.now');
  const nextSlots = [...el.querySelectorAll<HTMLElement>('.nslot')];
  const hint = $('.hint');
  const buttons = new Map<Purchase, HTMLButtonElement>(
    (['rotate', 'mirror', 'swap', 'reroll'] as const).map((k) => [k, $<HTMLButtonElement>(`[data-buy="${k}"]`)]),
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
    if (stuck(state) && state.coins >= MIN_COST) return 'Некуда встать: <b>поверни, отзеркаль, замени или пересдай</b>';
    if (state.lines >= state.goal) return '<b>Цель выполнена.</b> Доигрывай уровень и копи монеты';
    return 'Перетащи фигуру на поле';
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
    el.dataset['piece'] = s.queue[0]?.type ?? '';
    el.dataset['stuck'] = stuck(s) ? '1' : '0';
    $('[data-testid="title"]').textContent = `Уровень ${String(s.level)}`;
    $('[data-testid="stat-pieces"] b').innerHTML = `${String(s.used)}<i>/${String(CFG.PIECES)}</i>`;
    $('[data-testid="stat-lines"] b').innerHTML = `${String(s.lines)}<i>/${String(s.goal)}</i>`;
    $('[data-testid="stat-lines"]').classList.toggle('done', s.lines >= s.goal);
    $('[data-testid="stat-coins"] b').innerHTML = `${String(s.coins)}<i>/${String(CFG.CAP)}</i>`;
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

    const cur = s.queue[0];
    nowSlot.innerHTML = cur === undefined ? '' : pieceHtml(cur.cells, cur.color);
    [1, 2].forEach((k, j) => {
      const p = s.queue[k];
      (nextSlots[j] as HTMLElement).innerHTML = p === undefined ? '' : pieceHtml(p.cells, p.color);
    });

    const playing = s.status === 'playing';
    const can: Record<Purchase, boolean> = {
      rotate: playing && rotateCurrent(s) !== null,
      mirror: playing && mirrorCurrent(s) !== null,
      swap: playing && s.coins >= cheapestSwap,
      reroll: playing && rerollCurrent(s) !== null,
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
    const pv = preview(state, anchor.x, anchor.y);
    if (pv === null) { setHint(defaultHint()); return; }
    board.style.setProperty('--pc', `var(--piece-${String(state.queue[0]?.color ?? 1)})`);
    for (const i of pv.placed) cellEls[i]?.classList.add('ghost');
    for (const r of pv.rows) for (let c = 0; c < N; c += 1) cellEls[r * N + c]?.classList.add('hot');
    for (const c of pv.cols) for (let r = 0; r < N; r += 1) cellEls[r * N + c]?.classList.add('hot');
    setHint(pv.lines > 0 ? `Закроет <b>${String(pv.lines)} ${lineWord(pv.lines)}</b> и вернёт <b>${String(pv.income)} ${coinAcc(pv.income)}</b>` : defaultHint());
  }

  const lineWord = (n: number): string => (n === 1 ? 'линию' : n < 5 ? 'линии' : 'линий');

  // ---------- перетаскивание фигуры ----------
  let drag: HTMLElement | null = null;
  let anchor: { x: number; y: number } | null = null;

  function anchorAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const piece = state.queue[0];
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
    nowBox.classList.remove('lifted');
    clearPreview();
  }

  nowBox.addEventListener('pointerdown', (e) => {
    const piece = state.queue[0];
    if (busy || sheetOpen || popupOpen || state.status !== 'playing' || piece === undefined) return;
    e.preventDefault();
    nowBox.setPointerCapture(e.pointerId);
    drag = document.createElement('div');
    drag.className = 'drag';
    drag.style.setProperty('--u', `${String(cell)}px`);
    drag.style.setProperty('--g', `${String(GAP)}px`);
    drag.innerHTML = pieceHtml(piece.cells, piece.color);
    el.append(drag);
    nowBox.classList.add('lifted');
    moveDrag(e);
  });
  nowBox.addEventListener('pointermove', (e) => { if (drag !== null) moveDrag(e); });
  nowBox.addEventListener('pointerup', (e) => {
    if (drag === null) return;
    moveDrag(e);
    const target = anchor;
    if (target === null) {
      const over = board.getBoundingClientRect();
      if (e.clientY - LIFT > over.top - 20 && e.clientY < over.bottom + 40) { vibrate(20); shake(board); }
      endDrag();
      return;
    }
    const held = drag;
    void commitPlace(target.x, target.y, held);
  });
  nowBox.addEventListener('pointercancel', endDrag);

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

  async function commitPlace(x: number, y: number, held: HTMLElement | null): Promise<void> {
    const piece = state.queue[0];
    const fitsBefore = piece === undefined ? 0 : countFits(state.board, piece.cells);
    const out = place(state, x, y);
    if (out === null || piece === undefined) { endDrag(); return; }
    const ev = out.event as Extract<GameEvent, { kind: 'place' }>;
    setBusy(true);
    endDrag();
    void held;
    // 1. фигура встаёт на поле
    for (const i of ev.placed) {
      const c = cellEls[i] as HTMLElement;
      const t = document.createElement('i');
      t.className = `tile c-${String(piece.color)}`;
      c.append(t);
      t.animate([{ transform: 'scale(.7)' }, { transform: 'scale(1.06)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: dur(180), easing: 'ease-out' });
    }
    log({ type: 'place', level: state.level, turn: state.used, piece: piece.type, fits: fitsBefore, lines: ev.lines, income: ev.income, gained: ev.gained, coins: out.state.coins, burned: ev.burned.length });
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

  const labelFor = (k: Purchase): string => ({ rotate: 'Поворот', mirror: 'Зеркало', swap: 'Замена', reroll: 'Пересдача' })[k];

  async function buy(kind: Purchase, type?: PieceType): Promise<void> {
    if (busy || sheetOpen || popupOpen || state.status !== 'playing') return;
    const button = buttons.get(kind) as HTMLButtonElement;
    const out: Outcome | null =
      kind === 'rotate' ? rotateCurrent(state)
      : kind === 'mirror' ? mirrorCurrent(state)
      : kind === 'reroll' ? rerollCurrent(state)
      : type === undefined ? null : swapCurrent(state, type);
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
    const wasType = state.queue[0]?.type ?? '';
    setBusy(true);
    state = out.state;
    render();
    log({ type: 'buy', level: state.level, purchase: kind, piece: wasType, cost: ev.cost, coins: state.coins, burned: ev.burned.length });
    const slot = nowSlot.firstElementChild as HTMLElement | null;
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
    const cur = state.queue[0];
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
    if (!params.fixedSeed) seed = randomSeed();
    state = startRun(seed, { level: params.level, goal: params.goal });
    setBusy(false);
    render();
    log({ type: 'level_start', level: state.level, seed, coins: state.coins });
  }

  function showEnd(): void {
    popupOpen = true;
    const host = el;
    const done = (fn: () => void) => (): void => { popupOpen = false; fn(); };
    const menu: PopupAction = { id: 'menu', html: 'В меню', className: 'btn-ghost', run: done(() => go('#/')) };
    const again: PopupAction = { id: 'again', html: `${icon.replay} Новый забег`, className: 'btn-primary', run: done(restart) };
    recordBest(state.levelsCleared);
    if (state.status === 'level_won') {
      log({ type: 'level_win', level: state.level, lines: state.lines, goal: state.goal, coins: state.coins });
      openPopup(host, `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень ${String(state.level)} пройден</h2><p class="sub">Линий: ${String(state.lines)} из ${String(state.goal)}. В кошельке ${String(state.coins)} ${coinWord(state.coins)}.</p>`, [
        { id: 'next', html: `Дальше ${icon.play}`, className: 'btn-success', run: done(() => {
          const next = nextLevel(state);
          if (next === null) return;
          state = next;
          setBusy(false);
          render();
          log({ type: 'level_start', level: state.level, seed, coins: state.coins });
        }) },
        menu,
      ], 'popup-win');
    } else if (state.status === 'run_won') {
      log({ type: 'run_win', levelsCleared: state.levelsCleared });
      openPopup(host, `<div class="badge-big badge-cup">${icon.cup}</div><h2>Забег пройден!</h2><p class="sub">Все ${String(CFG.MAX_LEVELS)} уровней позади.</p>`, [again, menu], 'popup-final');
    } else {
      log({ type: 'level_fail', level: state.level, reason: 'goal_missed', lines: state.lines, goal: state.goal, levelsCleared: state.levelsCleared });
      openPopup(host, `<div class="badge-big badge-lose">${icon.cross}</div><h2>Цель не набрана</h2><p class="sub">Линий: ${String(state.lines)} из ${String(state.goal)}. Пройдено уровней: ${String(state.levelsCleared)}.</p>`, [again, menu], 'popup-lose');
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
        <li><b>1</b><span>Перетащи фигуру на поле. Полная строка или столбец исчезает и платит монеты: <b>1, 4, 9</b> за 1, 2, 3 линии сразу.</span></li>
        <li><b>2</b><span>Фигура неудобная? За монеты можно <b>повернуть</b>, <b>отзеркалить</b>, <b>заменить</b> или <b>пересдать</b> её. В кошельке до ${String(CFG.CAP)}.</span></li>
        <li><b>3</b><span>На уровне ${String(CFG.PIECES)} фигур. Собери нужное число линий.</span></li>
        <li><b>4</b><span>Фигура, которой некуда встать, когда монет меньше ${String(MIN_COST)}, сгорает.</span></li>
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
