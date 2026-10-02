import { capturedBy, createState, DELTA, legalSteps, modesOf, move as engineMove, optionsForEnemy } from '../engine/forwardEngine.ts';
import type { Cell, Dir, GameState, Mode, Move, StepInfo } from '../engine/types.ts';
import { SIZE } from '../engine/types.ts';
import { getLevel, LEVEL_COUNT } from '../levels/levels.ts';
import { enemyGlyph, handGlyph, heroGlyph, hookGlyph, icon, pushGlyph } from './icons.ts';
import { reducedMotion, vibrate, wait } from './feedback.ts';
import { log } from './log.ts';
import { openPopup } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, markPassed } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

const ROT: Record<Dir, number> = { '^': -90, '>': 0, v: 90, '<': 180 };

// Тайминги хода (быстрая версия без спеки — подобраны на глаз, запишем в спеку после показа).
const T = {
  chain: 140, // цепь выстреливает от героя к первому врагу сзади
  step: 170, // шаг героя на одну клетку (рывок тянет врагов вместе с ним)
  knock: 0.4, // на сколько клеток толчок отбрасывает врагов перед исчезновением
  vanish: 230, // исчезновение одного врага
  stagger: 70, // задержка между врагами линии, считая от героя
  shake: 160,
} as const;

const GAP = 5;
const PAD = 10;

/** Метка хода: толчок — шеврон по ходу, рывок — крюк. Цвет — второй канал, значок — первый. */
const pill = (mode: 'forward' | 'back', dir: Dir, count: number): string =>
  mode === 'forward'
    ? `<span class="pill fwd"><svg viewBox="0 0 24 24" style="transform:rotate(${String(ROT[dir])}deg)">${pushGlyph}</svg>${String(count)}</span>`
    : `<span class="pill back"><svg viewBox="0 0 24 24">${hookGlyph}</svg>${String(count)}</span>`;

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="piece enemy"><svg viewBox="0 0 24 24">${enemyGlyph}</svg></div>
    <div class="piece enemy"><svg viewBox="0 0 24 24">${enemyGlyph}</svg></div>
    <div class="piece hero"><svg viewBox="0 0 24 24">${heroGlyph}</svg></div>
    <div class="piece ghost"></div>
    <div class="piece enemy"><svg viewBox="0 0 24 24">${enemyGlyph}</svg></div>
  </div>
  <div class="demo-pills" aria-hidden="true">${pill('back', '>', 2)}${pill('forward', '>', 1)}</div>
  <ol class="rules">
    <li><b>1</b><span>Герой ходит на соседнюю клетку. Каждый шаг — один ход.</span></li>
    <li><b>2</b><span><em class="k-fwd">Толчок:</em> шагнул к врагу — сбил цепочку перед собой.</span></li>
    <li><b>3</b><span><em class="k-back">Рывок:</em> шагнул от врага — цепь утянула цепочку сзади.</span></li>
    <li><b>4</b><span>Тапни врага, которого хочешь убрать. Держи палец — увидишь ход заранее. Ошибся — отмени.</span></li>
  </ol>`;

interface Sprite {
  readonly id: string;
  row: number;
  col: number;
  readonly el: HTMLDivElement;
}

/** Что сделает касание клетки: конкретный ход, «выбери, кого убрать» или ничего. */
type Intent =
  | { readonly kind: 'move'; readonly info: StepInfo; readonly mode: Mode }
  | { readonly kind: 'ambiguous'; readonly info: StepInfo }
  | null;

export function gameScreen(levelNumber: number, go: Go): Screen {
  const level = getLevel(levelNumber);
  let state: GameState = createState(level);
  const history: GameState[] = [];
  let busy = false;
  let popupOpen = false;
  let lastMoveAt = performance.now();

  const el = document.createElement('main');
  el.className = 'screen game';
  el.dataset['testid'] = 'game';
  el.dataset['level'] = String(levelNumber);
  el.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" data-testid="to-levels" aria-label="К уровням">${icon.levels}</button>
      <h2>Уровень ${String(levelNumber)}</h2>
      <div class="right">
        <button class="icon-btn q" data-testid="help" aria-label="Как играть">?</button>
        <button class="icon-btn" data-testid="restart" aria-label="Заново">${icon.replay}</button>
      </div>
    </div>
    <div class="status-row">
      <div class="moves-pill" data-testid="moves">Ходы <b>0</b><span>/ ${String(level.moveLimit)}</span></div>
      <div class="left-pill" data-testid="left"></div>
    </div>
    <div class="stage"><div class="board" data-testid="board"><div class="dests"></div><div class="fx"></div></div></div>
    <div class="bottom-bar">
      <button class="undo-btn" data-testid="undo" aria-label="Отменить ход">${icon.undo}<span>Отменить</span></button>
      <p class="hint" data-testid="hint"></p>
    </div>`;

  const q = <T extends HTMLElement>(sel: string): T => {
    const found = el.querySelector<T>(sel);
    if (found === null) throw new Error(`game markup: ${sel}`);
    return found;
  };
  const stage = q('.stage');
  const boardEl = q('.board');
  const destsEl = q('.dests');
  const fxEl = q('.fx');
  const movesEl = q('[data-testid="moves"]');
  const leftEl = q('[data-testid="left"]');
  const hintEl = q('[data-testid="hint"]');
  const undoBtn = q<HTMLButtonElement>('[data-testid="undo"]');

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset['testid'] = `cell-${String(r)}-${String(c)}`;
      boardEl.append(cell);
    }
  }

  const hero: Sprite = { id: 'hero', row: level.hero.row, col: level.hero.col, el: document.createElement('div') };
  hero.el.className = 'piece hero';
  hero.el.dataset['testid'] = 'hero';
  hero.el.innerHTML = `<svg viewBox="0 0 24 24">${heroGlyph}</svg>`;
  boardEl.append(hero.el);

  // Призрак героя для предпросмотра: показывает, куда он встанет.
  const ghost = document.createElement('div');
  ghost.className = 'piece hero ghost-hero';
  ghost.innerHTML = `<svg viewBox="0 0 24 24">${heroGlyph}</svg>`;
  ghost.hidden = true;
  boardEl.append(ghost);

  const enemies = new Map<string, Sprite>();
  function addEnemy(id: string, row: number, col: number): Sprite {
    const box = document.createElement('div');
    box.className = 'piece enemy';
    box.dataset['testid'] = `enemy-${id}`;
    box.innerHTML = `<svg viewBox="0 0 24 24">${enemyGlyph}</svg>`;
    boardEl.append(box);
    const sprite = { id, row, col, el: box };
    enemies.set(id, sprite);
    return sprite;
  }
  for (const e of level.enemies) addEnemy(e.id, e.row, e.col);

  // Рука-подсказка на обучающих уровнях: прижать палец к цели. Исчезает с первым касанием.
  let hand: HTMLDivElement | null = null;
  if (level.hand !== undefined) {
    hand = document.createElement('div');
    hand.className = 'hand';
    hand.innerHTML = `<i class="ripple"></i><svg viewBox="0 0 24 24">${handGlyph}</svg>`;
    boardEl.append(hand);
  }

  // ---------- размеры от экрана ----------
  function fit(): void {
    const box = stage.getBoundingClientRect();
    const free = Math.min(box.width, box.height) - 2 * PAD - GAP * (SIZE - 1);
    el.style.setProperty('--cell', `${String(Math.max(46, Math.min(Math.floor(free / SIZE), 80)))}px`);
    place(hero);
    for (const s of enemies.values()) place(s);
    if (hand !== null && level.hand !== undefined) {
      const [x, y] = xy(level.hand.row, level.hand.col);
      hand.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
    }
    renderDests();
  }
  const observer = new ResizeObserver(fit);
  observer.observe(stage);

  const cellSize = (): number => parseFloat(getComputedStyle(el).getPropertyValue('--cell'));
  const xy = (row: number, col: number): readonly [number, number] => {
    const cell = cellSize();
    return [PAD + col * (cell + GAP), PAD + row * (cell + GAP)];
  };
  const at = (s: { row: number; col: number }, dx = 0, dy = 0, scale = 1): string => {
    const [x, y] = xy(s.row, s.col);
    return `translate(${String(x + dx)}px, ${String(y + dy)}px) scale(${String(scale)})`;
  };
  function place(s: Sprite): void {
    s.el.style.transform = at(s);
  }

  const locked = (): boolean => popupOpen || busy || state.status !== 'playing';

  // ---------- метки на клетках, куда можно шагнуть ----------
  function renderDests(): void {
    destsEl.replaceChildren();
    if (state.status !== 'playing') return;
    for (const info of legalSteps(state)) {
      const d = document.createElement('div');
      d.className = 'dest';
      d.dataset['testid'] = `dest-${String(info.to.row)}-${String(info.to.col)}`;
      const [x, y] = xy(info.to.row, info.to.col);
      d.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
      const pills = [info.forward.length > 0 ? pill('forward', info.dir, info.forward.length) : '', info.back.length > 0 ? pill('back', info.dir, info.back.length) : ''].join('');
      d.innerHTML = pills === '' ? '<i class="dot"></i>' : `<div class="pills">${pills}</div>`;
      destsEl.append(d);
    }
  }

  // ---------- цепь рывка: от героя к первому врагу сзади ----------
  function makeChain(from: Cell, to: Cell): HTMLDivElement {
    const cell = cellSize();
    const [ax, ay] = xy(from.row, from.col);
    const [bx, by] = xy(to.row, to.col);
    const chain = document.createElement('div');
    const horizontal = from.row === to.row;
    chain.className = `chain ${horizontal ? 'h' : 'v'}`;
    const x = Math.min(ax, bx) + cell / 2;
    const y = Math.min(ay, by) + cell / 2;
    const len = Math.abs(horizontal ? bx - ax : by - ay);
    chain.style.left = `${String(horizontal ? x : x - 4)}px`;
    chain.style.top = `${String(horizontal ? y - 4 : y)}px`;
    chain.style.width = horizontal ? `${String(len)}px` : '8px';
    chain.style.height = horizontal ? '8px' : `${String(len)}px`;
    // Цепь растёт от героя: точка опоры — его сторона.
    chain.style.transformOrigin = horizontal ? (ax < bx ? 'left center' : 'right center') : ay < by ? 'center top' : 'center bottom';
    fxEl.append(chain);
    return chain;
  }

  // ---------- предпросмотр: призрак героя, обречённые враги, цепь или толчок ----------
  function intentAt(row: number, col: number): Intent {
    const enemy = [...enemies.values()].find((s) => s.row === row && s.col === col);
    if (enemy !== undefined) {
      // Каждого врага убирает не больше одного хода (проверено тестом), так что тап однозначен.
      const option = optionsForEnemy(state, enemy.id)[0];
      if (option === undefined) return null;
      const info = legalSteps(state).find((s) => s.dir === option.dir);
      return info === undefined ? null : { kind: 'move', info, mode: option.mode };
    }
    const info = legalSteps(state).find((s) => s.to.row === row && s.to.col === col);
    if (info === undefined) return null;
    const modes = modesOf(info);
    return modes.length === 1 ? { kind: 'move', info, mode: modes[0] as Mode } : { kind: 'ambiguous', info };
  }

  function clearPreview(): void {
    ghost.hidden = true;
    fxEl.replaceChildren();
    for (const s of enemies.values()) s.el.classList.remove('doomed-fwd', 'doomed-back');
    for (const d of destsEl.children) d.classList.remove('aim');
  }

  function showPreview(intent: Intent): void {
    clearPreview();
    if (intent === null) return;
    const { info } = intent;
    ghost.hidden = false;
    ghost.style.transform = at(info.to);
    destsEl.querySelector(`[data-testid="dest-${String(info.to.row)}-${String(info.to.col)}"]`)?.classList.add('aim');
    const modes: Mode[] = intent.kind === 'move' ? [intent.mode] : ['forward', 'back'];
    for (const mode of modes) {
      const ids = capturedBy(info, mode);
      for (const id of ids) enemies.get(id)?.el.classList.add(mode === 'forward' ? 'doomed-fwd' : 'doomed-back');
      const first = ids[0] === undefined ? undefined : enemies.get(ids[0]);
      if (mode === 'back' && first !== undefined) makeChain(state.hero, first);
    }
  }

  // ---------- нижняя панель: отмена + подсказка ----------
  function defaultTip(): string {
    return level.tip ?? 'Прижми палец к врагу — увидишь ход заранее. Отпусти — сделаешь. Ошибся — отмени.';
  }
  function renderBar(text = defaultTip()): void {
    hintEl.innerHTML = `<span>${text}</span>`;
    undoBtn.disabled = history.length === 0 || busy;
  }
  let tipTimer = 0;
  function flashTip(text: string): void {
    renderBar(text);
    hintEl.classList.remove('flash');
    void hintEl.offsetWidth;
    hintEl.classList.add('flash');
    window.clearTimeout(tipTimer);
    tipTimer = window.setTimeout(() => renderBar(), 2600);
  }

  function renderStatus(): void {
    movesEl.innerHTML = `Ходы <b>${String(state.moves)}</b><span>/ ${String(level.moveLimit)}</span>`;
    movesEl.classList.toggle('last', state.status === 'playing' && level.moveLimit - state.moves === 1);
    leftEl.innerHTML = `${enemyMini}Врагов <b>${String(state.enemies.length)}</b>`;
    el.dataset['status'] = state.status;
    el.dataset['moves'] = String(state.moves);
    el.dataset['enemies'] = String(state.enemies.length);
    el.toggleAttribute('data-busy', busy);
    undoBtn.disabled = history.length === 0 || busy;
  }
  const enemyMini = `<svg viewBox="0 0 24 24" class="mini">${enemyGlyph}</svg>`;

  // ---------- недопустимый тап ----------
  function shake(s: Sprite): void {
    const frames = [at(s), at(s, 5), at(s, -4), at(s)].map((transform) => ({ transform }));
    s.el.animate(frames, { duration: T.shake, easing: 'ease-out' });
    vibrate(15);
  }

  // ---------- ход: толчок отбрасывает линию вперёд, рывок утягивает её за героем ----------
  async function animateMove(m: Move): Promise<void> {
    const [dr, dc] = DELTA[m.dir];
    const pitch = cellSize() + GAP;
    const taken = m.captured.map((id) => enemies.get(id)).filter((s): s is Sprite => s !== undefined);
    const slow = reducedMotion() ? 0 : 1;

    let chain: HTMLDivElement | null = null;
    if (m.mode === 'back' && taken[0] !== undefined) {
      chain = makeChain(m.from, taken[0]);
      const axis = m.dir === '<' || m.dir === '>' ? 'X' : 'Y';
      await chain.animate([{ transform: `scale${axis}(0)` }, { transform: `scale${axis}(1)` }], { duration: T.chain * slow, easing: 'ease-out', fill: 'forwards' }).finished;
    }

    // Шаг героя. При рывке цепь и вся линия едут вместе с ним — жёстко, как на тросе.
    // fill:'forwards' — иначе после анимации герой на кадр откатится на старую клетку.
    const easing = 'cubic-bezier(.3,0,.25,1)';
    const step = hero.el.animate([{ transform: at(m.from) }, { transform: at(m.to) }], { duration: T.step * slow, easing, fill: 'forwards' });
    const dx = dc * pitch;
    const dy = dr * pitch;
    if (m.mode === 'back') {
      for (const s of taken) s.el.animate([{ transform: at(s) }, { transform: at(s, dx, dy) }], { duration: T.step * slow, easing, fill: 'forwards' });
      chain?.animate([{ translate: '0 0' }, { translate: `${String(dx)}px ${String(dy)}px` }], { duration: T.step * slow, easing, fill: 'forwards' });
    }
    await step.finished;
    hero.row = m.to.row;
    hero.col = m.to.col;
    place(hero);
    step.cancel();
    if (m.mode === 'forward' && taken.length > 0) vibrate(10);

    // Исчезновение от героя наружу. Толчок дополнительно отбрасывает врага по ходу.
    const kx = m.mode === 'forward' ? dx * T.knock : dx;
    const ky = m.mode === 'forward' ? dy * T.knock : dy;
    const sx = m.mode === 'forward' ? 0 : dx;
    const sy = m.mode === 'forward' ? 0 : dy;
    const gone = taken.map((s, i) =>
      s.el
        .animate(
          [
            { transform: at(s, sx, sy, 1), opacity: 1 },
            { transform: at(s, (sx + kx) / 2, (sy + ky) / 2, 1.12), opacity: 1, offset: 0.3 },
            { transform: at(s, kx, ky, 0), opacity: 0 },
          ],
          { duration: T.vanish * slow, delay: i * T.stagger * slow, easing: 'ease-in', fill: 'both' },
        )
        .finished.then(() => {
          // Уходящий враг держит последний кадр до remove(): cancel() вернул бы его на поле.
          s.el.remove();
          enemies.delete(s.id);
        }),
    );
    if (chain !== null) chain.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 * slow, delay: T.vanish * 0.5 * slow, fill: 'forwards' });
    await Promise.all(gone);
    fxEl.replaceChildren();
  }

  async function play(dir: Dir, mode: Mode): Promise<void> {
    if (locked()) return;
    const result = engineMove(state, dir, mode);
    const info = legalSteps(state).find((s) => s.dir === dir);
    if (info === undefined || result === null) {
      shake(hero);
      return;
    }
    const other = mode === 'forward' ? info.back : info.forward;
    const now = performance.now();
    log({
      type: 'move',
      level: levelNumber,
      dir,
      mode,
      captured: result.move.captured.length,
      choice: modesOf(info).length === 2,
      tookLess: modesOf(info).length === 2 && result.move.captured.length < other.length,
      ms: Math.round(now - lastMoveAt),
    });
    lastMoveAt = now;

    history.push(state);
    busy = true;
    clearPreview();
    destsEl.replaceChildren();
    renderStatus();
    await animateMove(result.move);
    state = result.state;
    busy = false;
    renderDests();
    renderStatus();
    renderBar();
    vibrate(result.move.captured.length > 0 ? 12 : 6);

    if (state.status === 'won') {
      markPassed(levelNumber);
      log({ type: 'level_win', level: levelNumber, moves: state.moves });
      await wave();
      showWin();
      return;
    }
    if (state.status === 'failed' && state.failReason !== null) {
      log({ type: 'level_fail', level: levelNumber, reason: state.failReason });
      for (const s of enemies.values()) s.el.classList.add('hl-fail');
      vibrate([30, 60, 30]);
      await wait(900);
      showLose(state.failReason);
    }
  }

  // ---------- отмена хода: состояние из истории, спрайты подстраиваются ----------
  function undo(): void {
    const prev = history.pop();
    if (prev === undefined || busy) return;
    state = prev;
    log({ type: 'undo', level: levelNumber, moves: state.moves });
    clearPreview();
    hero.row = state.hero.row;
    hero.col = state.hero.col;
    place(hero);
    for (const s of enemies.values()) s.el.classList.remove('hl-fail');
    for (const e of state.enemies) {
      if (enemies.has(e.id)) continue;
      const s = addEnemy(e.id, e.row, e.col);
      place(s);
      if (!reducedMotion()) s.el.animate([{ transform: at(s, 0, 0, 0.3), opacity: 0 }, { transform: at(s), opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    }
    renderDests();
    renderStatus();
    renderBar();
  }
  undoBtn.addEventListener('click', () => {
    if (!locked() || state.status === 'failed') undo();
  });

  async function wave(): Promise<void> {
    const cells = [...boardEl.querySelectorAll<HTMLElement>('.cell')];
    cells.forEach((c, i) => {
      c.animate([{ transform: 'none' }, { transform: 'translateY(-8px) scale(1.05)' }, { transform: 'none' }], {
        duration: 520,
        delay: i * 18,
        easing: 'cubic-bezier(.3,1.5,.5,1)',
      });
    });
    vibrate([20, 40, 20]);
    await wait(700);
  }

  // ---------- ввод: прижал — видишь ход, отпустил — сделал, увёл палец — отменил ----------
  let pressing = false;
  let pressCell = '';
  let intent: Intent = null;

  function cellFromEvent(event: PointerEvent): { row: number; col: number } | null {
    const rect = boardEl.getBoundingClientRect();
    const cell = cellSize();
    const col = Math.floor((event.clientX - rect.left - PAD + GAP / 2) / (cell + GAP));
    const row = Math.floor((event.clientY - rect.top - PAD + GAP / 2) / (cell + GAP));
    return row < 0 || col < 0 || row >= SIZE || col >= SIZE ? null : { row, col };
  }
  function track(event: PointerEvent): void {
    const c = cellFromEvent(event);
    const key = c === null ? '' : `${String(c.row)},${String(c.col)}`;
    if (key === pressCell) return;
    pressCell = key;
    intent = c === null ? null : intentAt(c.row, c.col);
    showPreview(intent);
  }

  boardEl.addEventListener('pointerdown', (event) => {
    if (locked()) return;
    if (hand !== null) {
      hand.remove();
      hand = null;
    }
    pressing = true;
    pressCell = '';
    try {
      boardEl.setPointerCapture(event.pointerId);
    } catch {
      // без захвата тоже работает, просто без отслеживания за пределами поля
    }
    track(event);
  });
  boardEl.addEventListener('pointermove', (event) => {
    if (pressing) track(event);
  });
  boardEl.addEventListener('pointerup', (event) => {
    if (!pressing) return;
    pressing = false;
    const c = cellFromEvent(event);
    const chosen = intent;
    intent = null;
    pressCell = '';
    if (chosen?.kind === 'move') {
      void play(chosen.info.dir, chosen.mode);
      return;
    }
    clearPreview();
    if (chosen?.kind === 'ambiguous') {
      flashTip('Отсюда можно и <b>толкнуть</b>, и <b>утянуть</b>. Тапни врага, которого хочешь убрать.');
      return;
    }
    if (c === null) return;
    if (c.row === hero.row && c.col === hero.col) return;
    const enemy = [...enemies.values()].find((s) => s.row === c.row && s.col === c.col);
    shake(enemy ?? hero);
  });
  boardEl.addEventListener('pointercancel', () => {
    pressing = false;
    intent = null;
    clearPreview();
    log({ type: 'preview_cancel', level: levelNumber });
  });

  // ---------- попапы ----------
  const replay = (): void => go(`#/level/${String(levelNumber)}`);
  const toLevels = (): void => go('#/levels');

  function popup(content: string, actions: Parameters<typeof openPopup>[2], testId: string, onClose?: () => void): void {
    popupOpen = true;
    renderStatus();
    openPopup(
      el,
      content,
      actions.map((action) => ({
        ...action,
        run: () => {
          popupOpen = false;
          onClose?.();
          renderStatus();
          action.run();
        },
      })),
      testId,
    );
  }

  function showWin(): void {
    if (levelNumber === LEVEL_COUNT) {
      popup(
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2><p class="sub">Все враги убраны</p>`,
        [
          { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
          { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
        ],
        'popup-final',
      );
      return;
    }
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень пройден!</h2><p class="sub">Все враги убраны</p>`,
      [
        { id: 'next', html: `Следующий уровень ${icon.arrow}`, className: 'btn-success', run: () => go(`#/level/${String(levelNumber + 1)}`) },
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-win',
    );
  }

  function showLose(reason: 'moves_exhausted' | 'no_moves'): void {
    const title = reason === 'moves_exhausted' ? 'Ходы закончились' : 'Ходов нет';
    const sub = reason === 'moves_exhausted' ? 'Лимит исчерпан, а враги остались на поле' : 'Герой зажат: свободных клеток рядом нет';
    popup(
      `<div class="badge-big badge-lose">${icon.cross}</div><h2>${title}</h2><p class="sub">${sub}</p>`,
      [
        { id: 'undo', html: `${icon.undo}Отменить ход`, className: 'btn-primary', run: undo },
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
        { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
      ],
      'popup-lose',
    );
  }

  function showHowToPlay(): void {
    popup(HOW_TO_PLAY, [{ id: 'ok', html: 'Понятно!', className: 'btn-primary', run: () => undefined }], 'popup-help', () => markHowToPlaySeen());
  }

  q('[data-testid="to-levels"]').addEventListener('click', toLevels);
  q('[data-testid="restart"]').addEventListener('click', () => {
    if (!popupOpen) replay();
  });
  q('[data-testid="help"]').addEventListener('click', () => {
    if (busy || popupOpen) return;
    log({ type: 'help_open', level: levelNumber });
    showHowToPlay();
  });

  renderStatus();
  renderBar();
  fit();
  log({ type: 'level_start', level: levelNumber });
  if (levelNumber === 1 && !loadProgress().howToPlaySeen) {
    popupOpen = true;
    renderStatus();
    setTimeout(showHowToPlay, 350);
  }

  return { el, destroy: () => observer.disconnect() };
}
