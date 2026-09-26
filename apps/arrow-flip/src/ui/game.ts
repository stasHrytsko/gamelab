import { createState, frontNeighbor, isExitReady, tap as engineTap } from '../engine/flipEngine.ts';
import type { Dir, GameState } from '../engine/types.ts';
import { SIZE } from '../engine/types.ts';
import { getLevel, LEVEL_COUNT } from '../levels/levels.ts';
import { blockArrow, icon } from './icons.ts';
import { vibrate, wait } from './feedback.ts';
import { log } from './log.ts';
import { openPopup } from './popup.ts';
import type { Go } from './screens.ts';
import { loadProgress, markHowToPlaySeen, markPassed } from './storage.ts';

export interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

// Углы стрелки в градусах при загрузке уровня (до накопления поворотов, §7.2).
const DEG: Record<Dir, number> = { '^': 0, '>': 90, v: 180, '<': 270 };
const DELTA: Record<Dir, readonly [number, number]> = { '^': [-1, 0], '>': [0, 1], v: [1, 0], '<': [0, -1] };
// Цвет блока — прямое отражение направления (§7): цвет читается раньше, чем
// стрелка успевает прорисоваться глазом. Токены кита, без нового цвета —
// «красный» здесь coral, чистый ui-danger оставлен за проигрышем.
const DIR_COLOR: Record<Dir, string> = { '<': 'var(--ui-blue)', '>': 'var(--ui-green)', '^': 'var(--ui-coral)', v: 'var(--ui-yellow)' };

// Тайминги хода — §7.2 спеки, взяты из живого демо
// (UI Design/prototypes/arrow-flip/animation-demo.html).
const T = {
  cell: 90, // мс на клетку, скорость постоянная
  exitTail: 1.3, // клеток за краем, пока уходящий блок гаснет
  stopEase: 110, // доводка при остановке у блока
  lead: 0.35, // сбоку: поворот стартует за столько клеток до соседа
  rotate: 320, // длительность поворота стрелки
  rotateEase: 'cubic-bezier(.34,1.5,.52,1)',
  glowPeak: 1.35, // пиковая яркость повёрнутого блока
  glow: 700, // мс, за которые свечение гаснет к обычному цвету
  shake: 160,
} as const;

const HOW_TO_PLAY = `
  <h2>Как играть?</h2>
  <div class="demo" aria-hidden="true">
    <div class="demo-block" style="--c:${DIR_COLOR['>']}"><svg viewBox="0 0 24 24" style="transform:rotate(90deg)">${blockArrow}</svg></div>
    ${icon.arrow.replace('class=""', 'class="arrow-hint"')}
    <div class="demo-block" style="--c:${DIR_COLOR.v}"><svg viewBox="0 0 24 24" style="transform:rotate(180deg)">${blockArrow}</svg></div>
  </div>
  <ol class="rules">
    <li><b>1</b><span>Тапни блок — он поедет туда, куда смотрит стрелка.</span></li>
    <li><b>2</b><span>Блок едет до другого блока или уходит за край поля.</span></li>
    <li><b>3</b><span>Каждый блок, которого он коснётся по пути, повернётся на 90° по часовой.</span></li>
    <li><b>4</b><span>Выведи все блоки за край, пока не кончились ходы.</span></li>
  </ol>`;

interface Sprite {
  readonly id: string;
  row: number;
  col: number;
  /** Накопленный угол: после `<` идёт 360°, а не 0° (§7.2 п.3). */
  angle: number;
  readonly el: HTMLDivElement;
  readonly arrow: SVGElement;
}

export function gameScreen(levelNumber: number, go: Go): Screen {
  const level = getLevel(levelNumber);
  let state: GameState = createState(level);
  let busy = false;
  let popupOpen = false;
  let lastTapAt = performance.now();

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
    <div class="moves-pill" data-testid="moves">Ходы <b>0</b><span>/ ${String(level.moveLimit)}</span></div>
    <div class="stage"><div class="board" data-testid="board"></div></div>
    ${level.tutorial ? '<div class="hint-card" data-testid="hint">Тапни блок — он поедет по стрелке.<br><b>Кого заденет по пути — повернёт на 90°.</b></div>' : ''}`;

  const q = <T extends HTMLElement>(sel: string): T => {
    const found = el.querySelector<T>(sel);
    if (found === null) throw new Error(`game markup: ${sel}`);
    return found;
  };
  const stage = q('.stage');
  const boardEl = q('.board');
  const movesEl = q('[data-testid="moves"]');
  const hintEl = el.querySelector<HTMLElement>('[data-testid="hint"]');

  for (let i = 0; i < SIZE * SIZE; i += 1) boardEl.append(Object.assign(document.createElement('div'), { className: 'cell' }));

  const sprites = new Map<string, Sprite>();
  for (const b of level.blocks) {
    const box = document.createElement('div');
    box.className = 'block';
    box.dataset['testid'] = `block-${b.id}`;
    box.innerHTML = `<svg class="arrow" viewBox="0 0 24 24">${blockArrow}</svg>`;
    const arrow = box.querySelector('svg') as SVGElement;
    arrow.style.transform = `rotate(${String(DEG[b.dir])}deg)`;
    box.style.setProperty('--c', DIR_COLOR[b.dir]);
    box.addEventListener('pointerdown', () => tapBlock(b.id));
    boardEl.append(box);
    sprites.set(b.id, { id: b.id, row: b.row, col: b.col, angle: DEG[b.dir], el: box, arrow });
  }

  // ---------- размеры от экрана (§7.1: клетка 56–88 px) ----------
  function fit(): void {
    const box = stage.getBoundingClientRect();
    const cell = Math.floor(Math.min((box.width - 20 - 6 * (SIZE - 1)) / SIZE, (box.height - 20 - 6 * (SIZE - 1)) / SIZE));
    el.style.setProperty('--cell', `${String(Math.max(56, Math.min(cell, 88)))}px`);
    for (const s of sprites.values()) place(s);
  }
  const observer = new ResizeObserver(fit);
  observer.observe(stage);

  function metrics(): { cell: number; gap: number; pad: number } {
    const s = getComputedStyle(el);
    return { cell: parseFloat(s.getPropertyValue('--cell')), gap: 6, pad: 10 };
  }
  function xy(row: number, col: number): readonly [number, number] {
    const { cell, gap, pad } = metrics();
    return [pad + col * (cell + gap), pad + row * (cell + gap)];
  }
  function place(s: Sprite): void {
    const [x, y] = xy(s.row, s.col);
    s.el.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
  }

  function locked(): boolean {
    return popupOpen || busy || state.status !== 'playing';
  }

  function renderMoves(): void {
    const left = level.moveLimit - state.moves;
    movesEl.innerHTML = `Ходы <b>${String(state.moves)}</b><span>/ ${String(level.moveLimit)}</span>`;
    movesEl.classList.toggle('last', state.status === 'playing' && left === 1);
    el.dataset['status'] = state.status;
    el.dataset['moves'] = String(state.moves);
    el.toggleAttribute('data-busy', busy);
  }

  // ---------- недопустимый тап: покачивание и вспышка соседа (§4, §7) ----------
  function shakeInvalid(id: string): void {
    const s = sprites.get(id);
    if (s === undefined) return;
    const [x, y] = xy(s.row, s.col);
    const dir = state.blocks.find((b) => b.id === id)?.dir ?? '^';
    const [ddr, ddc] = DELTA[dir];
    s.el.animate(
      [
        { transform: `translate(${String(x)}px,${String(y)}px)` },
        { transform: `translate(${String(x + ddc * 5)}px,${String(y + ddr * 5)}px)` },
        { transform: `translate(${String(x - ddc * 2)}px,${String(y - ddr * 2)}px)` },
        { transform: `translate(${String(x)}px,${String(y)}px)` },
      ],
      { duration: T.shake, easing: 'ease-out' },
    );
    const blockerId = frontNeighbor(state.blocks, id);
    const blocker = blockerId === null ? undefined : sprites.get(blockerId);
    if (blocker !== undefined) {
      blocker.el.classList.remove('stuck-flash');
      void blocker.el.offsetWidth;
      blocker.el.classList.add('stuck-flash');
    }
    vibrate(15);
  }

  // ---------- ход: движение + повороты, привязанные к позиции едущего (§7.2) ----------
  function animateMove(mover: Sprite, result: NonNullable<ReturnType<typeof engineTap>>): Promise<void> {
    return new Promise((resolve) => {
      const { move } = result;
      const [dr, dc] = DELTA[move.dir];
      const steps = move.steps;
      const [x0, y0] = xy(mover.row, mover.col);
      const dist = move.exited ? steps + T.exitTail : steps;
      const [xe, ye] = xy(mover.row + dr * dist, mover.col + dc * dist);
      const travel = dist * T.cell + (move.exited ? 0 : T.stopEase);
      const { cell, gap } = metrics();
      const pitch = cell + gap;

      const frames: Keyframe[] = move.exited
        ? steps > 0
          ? [
              { transform: `translate(${String(x0)}px,${String(y0)}px)`, opacity: 1 },
              { transform: `translate(${String(x0 + ((xe - x0) * steps) / dist)}px,${String(y0 + ((ye - y0) * steps) / dist)}px)`, opacity: 1, offset: steps / dist },
              { transform: `translate(${String(xe)}px,${String(ye)}px)`, opacity: 0 },
            ]
          : [
              { transform: `translate(${String(x0)}px,${String(y0)}px)`, opacity: 1 },
              { transform: `translate(${String(xe)}px,${String(ye)}px)`, opacity: 0 },
            ]
        : [{ transform: `translate(${String(x0)}px,${String(y0)}px)` }, { transform: `translate(${String(xe)}px,${String(ye)}px)` }];
      // fill:'forwards' — иначе по окончании WAAPI-анимации блок на кадр
      // откатывается к позиции до хода (браузер снимает эффект), и до того,
      // как игра его переставит или удалит, на старом месте вспыхивает призрак.
      const anim = mover.el.animate(frames, {
        duration: Math.max(travel, 1),
        easing: move.exited ? (steps ? 'cubic-bezier(.45,0,1,1)' : 'ease-in') : 'cubic-bezier(.3,0,.25,1)',
        fill: 'forwards',
      });
      void anim.finished.then(() => {
        if (!move.exited) {
          mover.row = mover.row + dr * steps;
          mover.col = mover.col + dc * steps;
          place(mover); // инлайновый transform уже на конечном месте
          anim.cancel(); // снимает fill:'forwards', чтобы дальнейший place() (resize) снова работал
        }
        // Уезжающий блок отменять нельзя: cancel() снял бы fill:'forwards' и
        // откатил бы его на исходную клетку до самого удаления из DOM — это
        // и был баг «призрака». Блок просто держит конечный кадр до remove().
      });

      const triggers = move.touches.map((t) => ({
        sprite: sprites.get(t.id),
        newDir: result.state.blocks.find((b) => b.id === t.id)?.dir,
        at: t.pathIndex === 0 ? 0 : t.front ? steps - 0.04 : t.pathIndex - T.lead,
        fired: false,
      }));
      const fire = (tr: (typeof triggers)[number]): void => {
        tr.fired = true;
        const s = tr.sprite;
        if (s === undefined) return;
        s.angle += 90;
        const to = s.angle;
        const from = to - 90;
        const rotateAnim = s.arrow.animate([{ transform: `rotate(${String(from)}deg)` }, { transform: `rotate(${String(to)}deg)` }], {
          duration: T.rotate,
          easing: T.rotateEase,
          fill: 'forwards',
        });
        rotateAnim.finished
          .then(() => { s.arrow.style.transform = `rotate(${String(to)}deg)`; rotateAnim.cancel(); })
          .catch(() => undefined);
        s.el.animate([{ filter: `brightness(${String(T.glowPeak)})` }, { filter: 'brightness(1)' }], { duration: T.glow, easing: 'ease-out' });
        // Цвет меняется вместе со стрелкой — CSS сам плавно ведёт градиент
        // от старого --c к новому (@property в styles.css).
        if (tr.newDir !== undefined) s.el.style.setProperty('--c', DIR_COLOR[tr.newDir]);
      };

      let pending = triggers.length;
      if (pending === 0) {
        setTimeout(resolve, travel);
        return;
      }
      const start = performance.now();
      const watch = (): void => {
        const m = new DOMMatrix(getComputedStyle(mover.el).transform);
        const progress = (Math.abs(m.e - x0) + Math.abs(m.f - y0)) / pitch;
        const late = performance.now() - start >= travel;
        for (const tr of triggers) {
          if (!tr.fired && (progress >= tr.at || late)) {
            fire(tr);
            pending -= 1;
          }
        }
        if (pending > 0) requestAnimationFrame(watch);
        else setTimeout(resolve, Math.max(0, travel - (performance.now() - start)) + T.rotate);
      };
      requestAnimationFrame(watch);
    });
  }

  async function tapBlock(id: string): Promise<void> {
    if (locked()) return;
    const wasExitReady = isExitReady(state.blocks, id);
    const result = engineTap(state, id);
    if (result === null) {
      shakeInvalid(id);
      return;
    }
    const mover = sprites.get(id);
    if (mover === undefined) return;
    busy = true;
    renderMoves();
    const now = performance.now();
    log({ type: 'tap', level: levelNumber, blockId: id, exitReady: wasExitReady, exited: result.move.exited, touched: result.move.touches.length, ms: Math.round(now - lastTapAt) });
    lastTapAt = now;

    await animateMove(mover, result);
    if (result.move.exited) {
      mover.el.remove();
      sprites.delete(id);
    }
    state = result.state;
    busy = false;
    renderMoves();
    vibrate(result.move.touches.length > 0 ? 12 : 8);

    if (state.status === 'won') {
      markPassed(levelNumber);
      log({ type: 'level_win', level: levelNumber, moves: state.moves });
      await wave();
      showWin();
      return;
    }
    if (state.status === 'failed' && state.failReason !== null) {
      log({ type: 'level_fail', level: levelNumber, reason: state.failReason });
      for (const s of sprites.values()) {
        s.el.classList.remove('stuck-flash');
        void s.el.offsetWidth;
        s.el.classList.add('stuck-flash');
      }
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

  // ---------- попапы ----------
  const replay = (): void => go(`#/level/${String(levelNumber)}`);
  const toLevels = (): void => go('#/levels');

  function popup(content: string, actions: Parameters<typeof openPopup>[2], testId: string, onClose?: () => void): void {
    popupOpen = true;
    renderMoves();
    openPopup(
      el,
      content,
      actions.map((action) => ({
        ...action,
        run: () => {
          popupOpen = false;
          onClose?.();
          renderMoves();
          action.run();
        },
      })),
      testId,
    );
  }

  function showWin(): void {
    if (levelNumber === LEVEL_COUNT) {
      popup(
        `<div class="badge-big badge-cup">${icon.cup}</div><h2>Все уровни пройдены!</h2><p class="sub">Все блоки за краем поля</p>`,
        [
          { id: 'replay', html: `${icon.replay}Переиграть`, className: 'btn-secondary', run: replay },
          { id: 'levels', html: 'К уровням', className: 'btn-ghost', run: toLevels },
        ],
        'popup-final',
      );
      return;
    }
    popup(
      `<div class="badge-big badge-win">${icon.check}</div><h2>Уровень пройден!</h2><p class="sub">Все блоки за краем поля</p>`,
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
    const sub = reason === 'moves_exhausted' ? 'Лимит ходов исчерпан, блоки остались на поле' : 'Все оставшиеся блоки упёрлись друг в друга';
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
    if (locked()) return;
    log({ type: 'help_open', level: levelNumber });
    showHowToPlay();
  });

  void hintEl;
  renderMoves();
  fit();
  log({ type: 'level_start', level: levelNumber });
  if (levelNumber === 1 && !loadProgress().howToPlaySeen) {
    popupOpen = true;
    renderMoves();
    setTimeout(showHowToPlay, 350);
  }

  return { el, destroy: () => observer.disconnect() };
}
