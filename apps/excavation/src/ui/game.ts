import { canTake, createState, goldLeft, starsFor, take, takeBlock, tap } from '../engine/digEngine.ts';
import type { GameState, Stars } from '../engine/types.ts';
import { getLevel, LEVEL_COUNT } from '../levels/levels.ts';
import { reducedMotion, vibrate, wait } from './feedback.ts';
import { glyph, icon, pips } from './icons.ts';
import { log } from './log.ts';
import { openPopup } from './popup.ts';
import { plural, type Go } from './screens.ts';
import { loadProgress, markClueTipSeen, markHowToPlaySeen, markPassed, startAttempt } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

// Тайминги — §7 спеки.
const T = {
  flip: 150, // переворот плиты
  fly: 400, // «+N» летит к счётчику
  flyEase: 'cubic-bezier(.3,0,.2,1)',
  exitGlow: 600, // найденный выход светится
  shake: 300, // «Забрать» неактивна; сработавшая ловушка
  burn: 600, // золото сгорает до 0
  starPop: 150, // каждая полученная звезда
  reveal: 300, // волна раскрытия комнаты
  popup: 900, // от «Забрать» или ловушки до попапа
  clueTip: 1500, // обучающая подсветка соседей
  hold: 350, // удержание открытой плиты с числом до подсветки соседей
} as const;

// Геометрия поля (§7.1): плита 36–60 px, зазор 5 px.
const GAP = 5;
const PAD = 8;
const CELL_MIN = 36;
const CELL_MAX = 60;

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="demo-cell ring"><div class="stone">${glyph.spikes}</div></div>
    <div class="demo-cell open"><b style="color:var(--ui-clue-2)">2</b>${pips(2)}</div>
    <div class="demo-cell ring"><div class="stone">${glyph.spikes}</div></div>
    <span class="demo-plus">+2</span>
  </div>
  <ol class="rules">
    <li><b>1</b><span>Тапни любую закрытую плиту. Цифра — сколько ловушек среди 8 соседних плит.</span></li>
    <li><b>2</b><span>Монетки под цифрой — золото с плиты, их столько же. Пустая плита — 0.</span></li>
    <li><b>3</b><span>Найди выход — он спрятан у края. С выходом и первой звездой можно «Забрать» и пройти уровень. За второй и третьей звездой — копай дальше.</span></li>
    <li><b>4</b><span>Ловушка сжигает всё золото попытки. Следующая попытка — новая комната.</span></li>
  </ol>`;

export function gameScreen(levelNumber: number, go: Go): Screen {
  const level = getLevel(levelNumber);
  const { layout, attempt } = startAttempt(levelNumber, level.layouts.length);
  let state: GameState = createState(level, layout);
  let shownGold = 0;
  let busy = false;
  let popupOpen = false;
  let taps = 0;
  let lastAt = performance.now();
  const seed = level.layouts[layout]?.seed ?? 0;

  const el = document.createElement('main');
  el.className = 'screen game';
  el.dataset['testid'] = 'game';
  el.dataset['level'] = String(levelNumber);
  el.dataset['layout'] = String(layout);
  const max = level.stars[2];
  el.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" data-testid="to-levels" aria-label="К уровням">${icon.levels}</button>
      <h2>Уровень ${String(levelNumber)}</h2>
      <div class="right">
        <button class="icon-btn q" data-testid="help" aria-label="Как играть">?</button>
        <button class="icon-btn" data-testid="restart" aria-label="Заново">${icon.replay}</button>
      </div>
    </div>
    <section class="hud">
      <div class="card gold-card" data-testid="gold">
        <div class="gold-row"><span class="coin">${glyph.coin}</span><b>0</b><small>золото попытки</small></div>
        <div class="bar"><div class="fill"></div>${level.stars
          .map((s, k) => `<div class="mark" data-testid="star-${String(k + 1)}" style="left:${String((s / max) * 100)}%">${glyph.star}<b>${String(s)}</b></div>`)
          .join('')}</div>
      </div>
      <div class="card traps" data-testid="traps"><small>${plural(level.traps, 'Ловушка', 'Ловушки', 'Ловушек')}</small><div>${glyph.spikes}<b>${String(level.traps)}</b></div></div>
    </section>
    <div class="stage"><div class="board" data-testid="board"></div><div class="clue-tip" data-testid="clue-tip" hidden></div></div>
    <section class="actions">
      <div class="hint" data-testid="hint"></div>
      <button class="take" data-testid="take"><span class="take-star">${glyph.star}</span><span class="take-label"></span></button>
    </section>`;

  const q = <E extends HTMLElement>(sel: string): E => {
    const found = el.querySelector<E>(sel);
    if (found === null) throw new Error(`game markup: ${sel}`);
    return found;
  };
  const stage = q('.stage');
  const boardEl = q('.board');
  const goldCard = q('[data-testid="gold"]');
  const goldNum = q('.gold-row b');
  const fill = q('.bar .fill');
  const marks = [...el.querySelectorAll<HTMLElement>('.mark')];
  const hintEl = q('[data-testid="hint"]');
  const takeBtn = q<HTMLButtonElement>('[data-testid="take"]');
  const takeLabel = q('.take-label');
  const tipEl = q('[data-testid="clue-tip"]');

  boardEl.style.gridTemplateColumns = `repeat(${String(level.cols)}, var(--cell))`;
  boardEl.style.gridTemplateRows = `repeat(${String(level.rows)}, var(--cell))`;

  // ---------- плиты ----------
  const cells: HTMLDivElement[] = [];
  for (let i = 0; i < level.rows * level.cols; i += 1) {
    const box = document.createElement('div');
    const row = Math.floor(i / level.cols);
    const col = i % level.cols;
    box.className = 'cell';
    box.dataset['testid'] = `cell-${String(row)}-${String(col)}`;
    box.dataset['row'] = String(row);
    box.dataset['col'] = String(col);
    boardEl.append(box);
    cells.push(box);
  }
  const cellEl = (i: number): HTMLDivElement => {
    const found = cells[i];
    if (found === undefined) throw new Error(`no cell ${String(i)}`);
    return found;
  };

  const numberHtml = (n: number): string => `<b class="num" style="color:var(--ui-clue-${String(n)})">${String(n)}</b>${pips(n)}`;

  /** Вид плиты по состоянию (§7, UI Design/prototypes/excavation/tiles.png). */
  function paint(i: number, revealed = false): void {
    const box = cellEl(i);
    const n = state.clue[i] ?? 0;
    const isOpen = state.open[i] === true;
    let kind: string;
    let html = '';
    if (i === state.entrance) {
      kind = 'entrance';
      html = glyph.arch;
    } else if (i === state.trapHit) {
      kind = 'trap-hit';
      html = `<div class="stone trap">${glyph.spikes}</div>`;
    } else if (isOpen && i === state.exit) {
      kind = 'exit';
      html = `${n > 0 ? `<b class="corner" style="color:var(--ui-clue-${String(n)})">${String(n)}</b>` : ''}${glyph.exit}${pips(n)}`;
    } else if (isOpen) {
      kind = n > 0 ? 'open' : 'empty';
      html = n > 0 ? numberHtml(n) : '';
    } else if (revealed && state.trap[i] === true) {
      kind = 'ghost-trap';
      html = glyph.spikes;
    } else if (revealed) {
      kind = i === state.exit ? 'ghost ghost-exit' : 'ghost';
      html = i === state.exit ? `${glyph.exit}${pips(n)}` : n > 0 ? numberHtml(n) : '';
    } else {
      kind = 'closed';
      html = `<div class="stone">${glyph.cracks}</div>`;
    }
    box.dataset['kind'] = kind.split(' ')[0];
    box.className = `cell ${kind}`;
    box.innerHTML = html;
  }
  for (let i = 0; i < cells.length; i += 1) paint(i);

  // ---------- размеры от экрана ----------
  function fit(): void {
    const box = stage.getBoundingClientRect();
    const byW = (box.width - 2 * PAD - GAP * (level.cols - 1)) / level.cols;
    const byH = (box.height - 2 * PAD - GAP * (level.rows - 1)) / level.rows;
    const cellPx = Math.floor(Math.max(CELL_MIN, Math.min(byW, byH, CELL_MAX)));
    el.style.setProperty('--cell', `${String(cellPx)}px`);
    el.classList.toggle('small-cells', cellPx < 44);
  }
  const observer = new ResizeObserver(fit);
  observer.observe(stage);

  // ---------- HUD и кнопка ----------
  function locked(): boolean {
    return popupOpen || busy || state.status !== 'playing';
  }

  function renderHud(): void {
    goldNum.textContent = String(shownGold);
    fill.style.width = `${String(Math.min(1, shownGold / max) * 100)}%`;
    const got = starsFor(level, shownGold);
    marks.forEach((m, k) => {
      m.classList.toggle('got', k < got);
      m.classList.toggle('next', k === got);
    });
  }

  function render(): void {
    renderHud();
    el.dataset['status'] = state.status;
    el.dataset['gold'] = String(state.gold);
    el.dataset['exit'] = String(state.exitFound);
    el.dataset['stars'] = String(starsFor(level, state.gold));
    el.toggleAttribute('data-busy', busy);
    const block = takeBlock(state);
    const stars = starsFor(level, state.gold);
    takeBtn.classList.toggle('on', block === null && state.status === 'playing');
    takeBtn.dataset['block'] = block ?? '';
    takeLabel.textContent =
      block === 'no_exit' ? 'Найди выход' : block === 'no_gold' ? `Выход с ${String(level.stars[0])}` : `Забрать ${String(state.gold)}`;
    // Строка подсказки (§7): по порядку проверки; от безопасных плит не зависит.
    hintEl.textContent =
      block === 'no_exit'
        ? 'Найди выход — он где-то у края'
        : block === 'no_gold'
          ? `Набери ${String(level.stars[0])} золота, чтобы выйти`
          : stars >= 3
            ? 'Все звёзды! Забирай'
            : 'Выйти сейчас — или копать ради следующей звезды';
  }

  // ---------- анимации ----------
  function flip(i: number): void {
    cellEl(i).animate([{ transform: 'rotateY(90deg) scale(.9)' }, { transform: 'rotateY(0) scale(1)' }], { duration: T.flip, easing: 'ease-out' });
  }

  function flyGold(i: number, n: number, target: number): void {
    const done = (): void => {
      shownGold = Math.max(shownGold, target);
      renderHud();
      goldCard.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
    };
    if (n <= 0) return;
    const fly = document.createElement('div');
    fly.className = 'fly';
    fly.textContent = `+${String(n)}`;
    el.append(fly);
    const host = el.getBoundingClientRect();
    const from = cellEl(i).getBoundingClientRect();
    const to = goldNum.getBoundingClientRect();
    const x0 = from.left + from.width / 2 - host.left;
    const y0 = from.top + from.height / 2 - host.top;
    const x1 = to.left + to.width / 2 - host.left;
    const y1 = to.top + to.height / 2 - host.top;
    const flight = fly.animate(
      [
        { transform: `translate(${String(x0)}px, ${String(y0)}px) translate(-50%, -50%) scale(1)`, opacity: 1 },
        { transform: `translate(${String(x1)}px, ${String(y1)}px) translate(-50%, -50%) scale(.8)`, opacity: 0.9 },
      ],
      { duration: reducedMotion() ? 1 : T.fly, easing: T.flyEase, fill: 'forwards' },
    );
    void flight.finished.then(() => {
      fly.remove();
      done();
    });
  }

  function shake(target: HTMLElement): void {
    target.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
      { duration: T.shake, easing: 'ease-out' },
    );
    vibrate(15);
  }

  /** Раскрытие комнаты волной от входа (§7): ловушки и неоткрытое золото. */
  async function revealRoom(): Promise<void> {
    const hidden = cells.map((_, i) => i).filter((i) => !state.open[i] && i !== state.trapHit);
    const er = Math.floor(state.entrance / level.cols);
    const ec = state.entrance % level.cols;
    const dist = (i: number): number => Math.abs(Math.floor(i / level.cols) - er) + Math.abs((i % level.cols) - ec);
    const far = Math.max(1, ...hidden.map(dist));
    for (const i of hidden) {
      paint(i, true);
      cellEl(i).animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'scale(1)' }], {
        duration: 180,
        delay: reducedMotion() ? 0 : (dist(i) / far) * (T.reveal - 180),
        easing: 'ease-out',
        fill: 'backwards',
      });
    }
    await wait(T.reveal);
  }

  function showClueTip(i: number, n: number): void {
    const closed = [...neighboursOf(i)].filter((j) => !state.open[j]);
    closed.forEach((j) => cellEl(j).classList.add('tip-ring'));
    tipEl.innerHTML = `<b>${String(n)} ${plural(n, 'ловушка', 'ловушки', 'ловушек')}</b> среди этих плит · <span>+${String(n)} ${plural(n, 'золото', 'золота', 'золота')}</span>`;
    tipEl.hidden = false;
    markClueTipSeen();
    log({ type: 'clue_tip', level: levelNumber });
    setTimeout(() => {
      closed.forEach((j) => cellEl(j).classList.remove('tip-ring'));
      tipEl.hidden = true;
    }, T.clueTip);
  }
  function neighboursOf(i: number): number[] {
    const r = Math.floor(i / level.cols);
    const c = i % level.cols;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr += 1)
      for (let dc = -1; dc <= 1; dc += 1) {
        const nr = r + dr;
        const nc = c + dc;
        if ((dr || dc) && nr >= 0 && nr < level.rows && nc >= 0 && nc < level.cols) out.push(nr * level.cols + nc);
      }
    return out;
  }

  // ---------- удержание открытой плиты: подсветка соседей (§4, §7, решение автора 2026-09-27) ----------
  // Подсвечивает только закрытые соседние плиты — тот же круг, что число уже
  // называет («N ловушек среди этих плит»). Не то, где ловушка точно, и не
  // вероятность: геометрия, которую игрок и так видит по клетке рядом.
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let holdIndex = -1;

  function clearHold(): void {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (holdIndex >= 0) {
      neighboursOf(holdIndex)
        .filter((j) => !state.open[j])
        .forEach((j) => cellEl(j).classList.remove('tip-ring'));
      cellEl(holdIndex).classList.remove('peek-source');
      tipEl.hidden = true;
      holdIndex = -1;
    }
  }

  function startHold(i: number): void {
    clearHold();
    holdTimer = setTimeout(() => {
      holdTimer = null;
      holdIndex = i;
      const n = state.clue[i] ?? 0;
      const closed = neighboursOf(i).filter((j) => !state.open[j]);
      closed.forEach((j) => cellEl(j).classList.add('tip-ring'));
      cellEl(i).classList.add('peek-source');
      tipEl.innerHTML = `<b>${String(n)} ${plural(n, 'ловушка', 'ловушки', 'ловушек')}</b> среди этих плит`;
      tipEl.hidden = false;
      vibrate(10);
      log({ type: 'peek', level: levelNumber, row: Math.floor(i / level.cols), col: i % level.cols });
    }, T.hold);
  }

  // ---------- тап по плите (§4) ----------
  function tapCell(row: number, col: number): void {
    if (locked()) return;
    const res = tap(state, row, col);
    if (res === null) return;
    state = res.state;
    taps += 1;
    const now = performance.now();
    log({ type: 'tap', level: levelNumber, attempt, row, col, result: res.kind, gold: state.gold, ms: Math.round(now - lastAt) });
    lastAt = now;

    if (res.kind === 'trap') {
      void fail();
      return;
    }
    paint(res.index);
    flip(res.index);
    vibrate(8);
    if (res.kind === 'exit') {
      cellEl(res.index).animate([{ boxShadow: '0 0 0 0 rgba(52,211,153,.8), inset 0 0 0 2px var(--ui-green)' }, { boxShadow: '0 0 0 12px rgba(52,211,153,0), inset 0 0 0 2px var(--ui-green)' }], { duration: T.exitGlow, easing: 'ease-out' });
      vibrate([10, 40, 10]);
    }
    flyGold(res.index, res.gained, state.gold);
    if (res.gained === 0) shownGold = state.gold;
    render();
    if (levelNumber === 1 && res.gained > 0 && !loadProgress().clueTipSeen) showClueTip(res.index, res.gained);
    if (res.cleared) void win('cleared');
  }

  // ---------- «Забрать» ----------
  function onTake(): void {
    if (popupOpen || busy || state.status !== 'playing') return;
    const block = takeBlock(state);
    if (block !== null || !canTake(state)) {
      shake(takeBtn);
      log({ type: 'take_blocked', level: levelNumber, attempt, why: block ?? 'no_gold' });
      return;
    }
    const left = goldLeft(state);
    const next = take(state);
    if (next === null) return;
    state = next;
    log({ type: 'take', level: levelNumber, attempt, gold: state.gold, stars: starsFor(level, state.gold), left, ms: Math.round(performance.now() - lastAt) });
    void win('take');
  }

  // ---------- победа и поражение (§5, §7) ----------
  async function win(outcome: 'take' | 'cleared'): Promise<void> {
    busy = true;
    const stars = starsFor(level, state.gold) as Stars;
    const left = goldLeft(state);
    markPassed(levelNumber, stars);
    log({ type: 'level_win', level: levelNumber, attempt, outcome, gold: state.gold, stars });
    shownGold = state.gold;
    render();
    const started = performance.now();
    for (const m of marks.slice(0, stars)) {
      m.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: T.starPop, easing: 'ease-out' });
      await wait(T.starPop);
    }
    vibrate([20, 40, 20]);
    await revealRoom();
    await wait(Math.max(0, T.popup - (performance.now() - started)));
    busy = false;
    render();
    showWin(stars, state.gold, left);
  }

  async function fail(): Promise<void> {
    busy = true;
    const lost = state.lostGold;
    log({ type: 'level_fail', level: levelNumber, attempt, reason: 'trap', lostGold: lost });
    paint(state.trapHit);
    shake(cellEl(state.trapHit));
    vibrate([30, 60, 30]);
    render();
    goldCard.classList.add('burn');
    const from = Math.max(shownGold, lost);
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (): void => {
        const k = reducedMotion() ? 1 : Math.min(1, (performance.now() - started) / T.burn);
        shownGold = Math.round(from * (1 - k));
        renderHud();
        if (k < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    await revealRoom();
    await wait(Math.max(0, T.popup - (performance.now() - started)));
    busy = false;
    render();
    showLose(lost);
  }

  // ---------- попапы ----------
  const replay = (): void => go(`#/level/${String(levelNumber)}`);
  const toLevels = (): void => go('#/levels');

  function popup(content: string, actions: Parameters<typeof openPopup>[2], testId: string, onClose?: () => void): void {
    popupOpen = true;
    render();
    openPopup(
      el,
      content,
      actions.map((action) => ({
        ...action,
        run: () => {
          popupOpen = false;
          onClose?.();
          render();
          action.run();
        },
      })),
      testId,
    );
  }

  const starsRow = (n: number): string =>
    `<div class="stars-big" data-stars="${String(n)}">${[1, 2, 3].map((k) => `<span class="${k <= n ? 'got' : ''}" style="animation-delay:${String(120 + k * 150)}ms">${glyph.star}</span>`).join('')}</div>`;

  function showWin(stars: number, gold: number, left: number): void {
    const body = `${starsRow(stars)}<div class="loot"><span>Вынесено <b>${String(gold)}</b></span><span>Осталось в комнате <b>${String(left)}</b></span></div>`;
    if (levelNumber === LEVEL_COUNT) {
      popup(
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2>${body}`,
        [
          { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
          { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
        ],
        'popup-final',
      );
      return;
    }
    popup(
      `<h2>Уровень пройден!</h2>${body}`,
      [
        { id: 'next', html: `Следующий уровень ${icon.arrow}`, className: 'btn-success', run: () => go(`#/level/${String(levelNumber + 1)}`) },
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-win',
    );
  }

  function showLose(lost: number): void {
    popup(
      `<div class="badge-big badge-lose">${icon.cross}</div><h2>Ловушка!</h2><p class="sub">Сгорело ${String(lost)} ${plural(lost, 'золото', 'золота', 'золота')}</p>`,
      [
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-primary', run: replay },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-lose',
    );
  }

  function showHowToPlay(): void {
    popup(HOW_TO_PLAY, [{ id: 'ok', html: 'Понятно!', className: 'btn-primary', run: () => undefined }], 'popup-help', () => markHowToPlaySeen());
  }

  boardEl.addEventListener('pointerdown', (event) => {
    const box = (event.target as HTMLElement).closest<HTMLElement>('.cell');
    clearHold();
    if (box === null) return;
    const row = Number(box.dataset['row']);
    const col = Number(box.dataset['col']);
    const i = row * level.cols + col;
    // Держат открытую плиту с числом — подсвечиваем соседей вместо тапа (тап по
    // открытой плите и так ничего не делает, §4).
    if (!locked() && state.open[i] === true && (state.clue[i] ?? 0) > 0) {
      startHold(i);
      return;
    }
    tapCell(row, col);
  });
  document.addEventListener('pointerup', clearHold);
  document.addEventListener('pointercancel', clearHold);
  takeBtn.addEventListener('click', onTake);
  q('[data-testid="to-levels"]').addEventListener('click', toLevels);
  q('[data-testid="restart"]').addEventListener('click', () => {
    if (!popupOpen && !busy) replay();
  });
  q('[data-testid="help"]').addEventListener('click', () => {
    if (locked()) return;
    log({ type: 'help_open', level: levelNumber });
    showHowToPlay();
  });

  render();
  fit();
  log({ type: 'level_start', level: levelNumber, attempt, layout, seed });
  if (levelNumber === 1 && !loadProgress().howToPlaySeen) {
    popupOpen = true;
    render();
    setTimeout(showHowToPlay, 350);
  }
  return {
    el,
    destroy: () => {
      observer.disconnect();
      document.removeEventListener('pointerup', clearHold);
      document.removeEventListener('pointercancel', clearHold);
      if (state.status === 'playing' && taps > 0) log({ type: 'abandon', level: levelNumber, attempt, gold: state.gold });
    },
  };
}
