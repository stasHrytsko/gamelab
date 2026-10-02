import { createState, legalSteps, modesOf, move as engineMove, optionsForEnemy, stepInfo } from '../engine/forwardEngine.ts';
import type { Dir, GameState, Mode, Move } from '../engine/types.ts';
import { SIZE } from '../engine/types.ts';
import { getLevel, LEVEL_COUNT } from '../levels/levels.ts';
import { arrowGlyph, enemyGlyph, heroGlyph, icon } from './icons.ts';
import { vibrate, wait } from './feedback.ts';
import { log } from './log.ts';
import { openPopup } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, markPassed } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

const ROT: Record<Dir, number> = { '^': -90, '>': 0, v: 90, '<': 180 };
const OPPOSITE: Record<Dir, Dir> = { '^': 'v', v: '^', '<': '>', '>': '<' };

// Тайминги хода (быстрая версия без спеки — подобраны на глаз, запишем в спеку после показа).
const T = {
  step: 150, // шаг героя на одну клетку
  vanish: 240, // исчезновение одного врага
  stagger: 70, // задержка между врагами линии, считая от героя
  shake: 160,
} as const;

const GAP = 5;
const PAD = 10;

const pill = (kind: 'fwd' | 'back', dir: Dir, count: number): string =>
  `<span class="pill ${kind}"><svg viewBox="0 0 24 24" style="transform:rotate(${String(ROT[kind === 'fwd' ? dir : OPPOSITE[dir]])}deg)">${arrowGlyph}</svg>${String(count)}</span>`;

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="piece enemy"><svg viewBox="0 0 24 24">${enemyGlyph}</svg></div>
    <div class="piece enemy"><svg viewBox="0 0 24 24">${enemyGlyph}</svg></div>
    <div class="piece hero"><svg viewBox="0 0 24 24">${heroGlyph}</svg></div>
    <div class="piece ghost"></div>
    <div class="piece enemy"><svg viewBox="0 0 24 24">${enemyGlyph}</svg></div>
  </div>
  <div class="demo-pills" aria-hidden="true">${pill('back', '>', 2)}${pill('fwd', '>', 1)}</div>
  <ol class="rules">
    <li><b>1</b><span>Тапни соседнюю пустую клетку — герой шагнёт туда. Шаг стоит один ход.</span></li>
    <li><b>2</b><span><em class="k-fwd">Вперёд:</em> уберёшь цепочку врагов прямо перед клеткой, куда пришёл.</span></li>
    <li><b>3</b><span><em class="k-back">Назад:</em> уберёшь цепочку врагов прямо за клеткой, которую покинул.</span></li>
    <li><b>4</b><span>Если доступны оба — выбираешь один. Убери всех, пока есть ходы.</span></li>
  </ol>`;

interface Sprite {
  readonly id: string;
  row: number;
  col: number;
  readonly el: HTMLDivElement;
}

export function gameScreen(levelNumber: number, go: Go): Screen {
  const level = getLevel(levelNumber);
  let state: GameState = createState(level);
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
    <div class="stage"><div class="board" data-testid="board"><div class="dests"></div></div></div>
    <div class="choice-bar" data-testid="choice-bar"></div>`;

  const q = <T extends HTMLElement>(sel: string): T => {
    const found = el.querySelector<T>(sel);
    if (found === null) throw new Error(`game markup: ${sel}`);
    return found;
  };
  const stage = q('.stage');
  const boardEl = q('.board');
  const destsEl = q('.dests');
  const movesEl = q('[data-testid="moves"]');
  const leftEl = q('[data-testid="left"]');
  const barEl = q('.choice-bar');

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

  const enemies = new Map<string, Sprite>();
  for (const e of level.enemies) {
    const box = document.createElement('div');
    box.className = 'piece enemy';
    box.dataset['testid'] = `enemy-${e.id}`;
    box.innerHTML = `<svg viewBox="0 0 24 24">${enemyGlyph}</svg>`;
    boardEl.append(box);
    enemies.set(e.id, { id: e.id, row: e.row, col: e.col, el: box });
  }

  // ---------- размеры от экрана ----------
  function fit(): void {
    const box = stage.getBoundingClientRect();
    const free = Math.min(box.width, box.height) - 2 * PAD - GAP * (SIZE - 1);
    el.style.setProperty('--cell', `${String(Math.max(46, Math.min(Math.floor(free / SIZE), 80)))}px`);
    place(hero);
    for (const s of enemies.values()) place(s);
    renderDests();
  }
  const observer = new ResizeObserver(fit);
  observer.observe(stage);

  const cellSize = (): number => parseFloat(getComputedStyle(el).getPropertyValue('--cell'));
  const xy = (row: number, col: number): readonly [number, number] => {
    const cell = cellSize();
    return [PAD + col * (cell + GAP), PAD + row * (cell + GAP)];
  };
  function place(s: Sprite): void {
    const [x, y] = xy(s.row, s.col);
    s.el.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
  }

  const locked = (): boolean => popupOpen || busy || state.status !== 'playing';

  // ---------- подсказки: метки на соседних клетках и выбор линии ----------
  // Враги, которых уберёт какой-нибудь из возможных ходов, подсвечены сразу: зелёным — вперёд, жёлтым — назад.
  // Если врага можно убрать и так и так, у него два кольца.
  function renderHints(): void {
    for (const s of enemies.values()) s.el.classList.remove('hl-fwd', 'hl-back');
    if (state.status !== 'playing') return;
    for (const info of legalSteps(state)) {
      for (const id of info.forward) enemies.get(id)?.el.classList.add('hl-fwd');
      for (const id of info.back) enemies.get(id)?.el.classList.add('hl-back');
    }
  }

  function renderDests(): void {
    destsEl.replaceChildren();
    renderHints();
    if (state.status !== 'playing') return;
    for (const info of legalSteps(state)) {
      const d = document.createElement('div');
      d.className = 'dest';
      d.dataset['testid'] = `dest-${String(info.to.row)}-${String(info.to.col)}`;
      const [x, y] = xy(info.to.row, info.to.col);
      d.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
      const hasF = info.forward.length > 0;
      const hasB = info.back.length > 0;
      if (hasF && hasB) {
        // Выбор без второго тапа: клетка делится пополам вдоль хода. Половина «по ходу» — вперёд,
        // половина «против хода» — назад. Тап в нужную половину сразу делает ход.
        d.classList.add('split', `axis-${info.dir === '<' || info.dir === '>' ? 'h' : 'v'}`, `dir-${dirName[info.dir]}`);
        d.innerHTML = `<div class="half back">${pill('back', info.dir, info.back.length)}</div><div class="half fwd">${pill('fwd', info.dir, info.forward.length)}</div>`;
      } else if (hasF || hasB) {
        d.innerHTML = `<div class="pills">${hasF ? pill('fwd', info.dir, info.forward.length) : pill('back', info.dir, info.back.length)}</div>`;
      } else {
        d.innerHTML = '<i class="dot"></i>';
      }
      destsEl.append(d);
    }
  }
  const dirName: Record<Dir, string> = { '^': 'up', v: 'down', '<': 'left', '>': 'right' };

  function renderBar(): void {
    barEl.className = 'choice-bar';
    barEl.innerHTML = level.tutorial
      ? `<p class="hint"><b>Тапни врага — и его уберёшь.</b><span>Или тапни соседнюю клетку: на метках видно, сколько врагов уйдёт вперёд и назад.</span></p>`
      : `<p class="hint">Тапни врага или соседнюю клетку. Клетка с двумя метками делится: тапни нужную половину.</p>`;
  }

  function renderStatus(): void {
    movesEl.innerHTML = `Ходы <b>${String(state.moves)}</b><span>/ ${String(level.moveLimit)}</span>`;
    movesEl.classList.toggle('last', state.status === 'playing' && level.moveLimit - state.moves === 1);
    leftEl.innerHTML = `${enemyMini}Врагов <b>${String(state.enemies.length)}</b>`;
    el.dataset['status'] = state.status;
    el.dataset['moves'] = String(state.moves);
    el.dataset['enemies'] = String(state.enemies.length);
    el.toggleAttribute('data-busy', busy);
  }
  const enemyMini = `<svg viewBox="0 0 24 24" class="mini">${enemyGlyph}</svg>`;

  // ---------- недопустимый тап ----------
  function shake(s: Sprite): void {
    const [x, y] = xy(s.row, s.col);
    s.el.animate(
      [
        { transform: `translate(${String(x)}px,${String(y)}px)` },
        { transform: `translate(${String(x + 5)}px,${String(y)}px)` },
        { transform: `translate(${String(x - 4)}px,${String(y)}px)` },
        { transform: `translate(${String(x)}px,${String(y)}px)` },
      ],
      { duration: T.shake, easing: 'ease-out' },
    );
    vibrate(15);
  }

  // ---------- ход: шаг героя, затем линия исчезает от героя наружу ----------
  async function animateMove(m: Move): Promise<void> {
    const [x0, y0] = xy(m.from.row, m.from.col);
    const [x1, y1] = xy(m.to.row, m.to.col);
    const taken = m.captured.map((id) => enemies.get(id)).filter((s): s is Sprite => s !== undefined);
    const cls = m.mode === 'forward' ? 'hl-fwd' : 'hl-back';
    for (const s of taken) s.el.classList.add(cls);

    // fill:'forwards' — иначе после анимации герой на кадр откатится на старую клетку.
    const step = hero.el.animate(
      [{ transform: `translate(${String(x0)}px,${String(y0)}px)` }, { transform: `translate(${String(x1)}px,${String(y1)}px)` }],
      { duration: T.step, easing: 'cubic-bezier(.3,0,.25,1)', fill: 'forwards' },
    );
    await step.finished;
    hero.row = m.to.row;
    hero.col = m.to.col;
    place(hero);
    step.cancel();

    const gone = taken.map((s, i) =>
      s.el
        .animate(
          [
            { transform: `${s.el.style.transform} scale(1)`, opacity: 1 },
            { transform: `${s.el.style.transform} scale(1.12)`, opacity: 1, offset: 0.3 },
            { transform: `${s.el.style.transform} scale(0)`, opacity: 0 },
          ],
          { duration: T.vanish, delay: i * T.stagger, easing: 'ease-in', fill: 'both' },
        )
        .finished.then(() => {
          // Уходящий враг держит последний кадр до remove(): cancel() вернул бы его на поле.
          s.el.remove();
          enemies.delete(s.id);
        }),
    );
    await Promise.all(gone);
  }

  async function play(dir: Dir, mode: Mode): Promise<void> {
    if (locked()) return;
    const info = stepInfo(state, dir);
    const result = engineMove(state, dir, mode);
    if (info === null || result === null) {
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

    busy = true;
    destsEl.replaceChildren();
    for (const s of enemies.values()) s.el.classList.remove('hl-fwd', 'hl-back');
    renderStatus();
    await animateMove(result.move);
    state = result.state;
    busy = false;
    renderDests();
    renderStatus();
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

  // ---------- ввод: один тап = один ход ----------
  boardEl.addEventListener('pointerdown', (event) => {
    if (locked()) return;
    const rect = boardEl.getBoundingClientRect();
    const cell = cellSize();
    const px = event.clientX - rect.left - PAD;
    const py = event.clientY - rect.top - PAD;
    const col = Math.floor((px + GAP / 2) / (cell + GAP));
    const row = Math.floor((py + GAP / 2) / (cell + GAP));
    if (row < 0 || col < 0 || row >= SIZE || col >= SIZE) return;

    // 1) Тап по врагу: «убери именно его». Шаг и линия определяются сами.
    const enemy = [...enemies.values()].find((s) => s.row === row && s.col === col);
    if (enemy !== undefined) {
      const best = optionsForEnemy(state, enemy.id)[0];
      if (best === undefined) shake(enemy);
      else void play(best.dir, best.mode);
      return;
    }

    // 2) Тап по соседней пустой клетке: шаг. Двойную клетку выбирает половина, в которую попал палец.
    const target = legalSteps(state).find((s) => s.to.row === row && s.to.col === col);
    if (target === undefined) {
      if (row !== hero.row || col !== hero.col) shake(hero);
      return;
    }
    const modes = modesOf(target);
    if (modes.length === 1) return void play(target.dir, modes[0] as Mode);
    const lx = px - col * (cell + GAP);
    const ly = py - row * (cell + GAP);
    const along = target.dir === '>' ? lx - cell / 2 : target.dir === '<' ? cell / 2 - lx : target.dir === 'v' ? ly - cell / 2 : cell / 2 - ly;
    void play(target.dir, along >= 0 ? 'forward' : 'back');
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
        { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-primary', run: replay },
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
