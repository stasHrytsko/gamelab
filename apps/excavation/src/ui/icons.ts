const svg = (body: string, cls = ''): string =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const icon = {
  levels: svg('<g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></g>'),
  back: svg('<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  play: svg('<path d="M7 4.5v15c0 .8.9 1.3 1.6.8l11-7.5c.6-.4.6-1.2 0-1.6l-11-7.5C7.9 3.2 7 3.7 7 4.5z" fill="currentColor"/>'),
  lock: svg('<rect x="4.5" y="10.5" width="15" height="10.5" rx="3" fill="currentColor"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none" stroke="currentColor" stroke-width="2.6"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  cross: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>'),
  cup: svg('<path d="M7 3.5h10v6.5a5 5 0 01-10 0z" fill="currentColor"/><path d="M7 5.5H4.5a3 3 0 003 4.5M17 5.5h2.5a3 3 0 01-3 4.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10.8" y="14.5" width="2.4" height="3.5" fill="currentColor"/><rect x="7.5" y="18" width="9" height="2.8" rx="1.2" fill="currentColor"/>'),
  arrow: svg('<path d="M4 12h14m-5-5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'),
  replay: svg('<path d="M5 12a7 7 0 107-7H8.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M10.5 2.5L8 5l2.5 2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
};

/** Игровые значки (§7): у каждого состояния плиты своя форма, не только цвет. */
export const glyph = {
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="1.6"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z" fill="currentColor"/></svg>',
  spikes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20 6.5 8 10 20zM8.5 20 12 4l3.5 16zM14 20l3.5-12L21 20z" fill="currentColor"/></svg>',
  cracks: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9l5 2 3-4M13 17l4-3 3 1" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  // Вход — круглый лаз, которым спустились в гробницу: кольцо и стрелка вниз.
  arch: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.3"/><path d="M8 10.5 12 14.5 16 10.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // Выход — прямоугольная дверь на полу: рамка, ручка и линия пола под ней —
  // силуэт нарочно не похож на круглый лаз входа.
  exit: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="17.5" rx="1.4" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="14.5" cy="11.5" r="1.2" fill="currentColor"/><path d="M3 21.5h18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
};

/** Ряд монеток под цифрой: столько же штук, сколько число (§7). */
export const pips = (n: number): string => (n > 0 ? `<div class="pips">${'<i></i>'.repeat(n)}</div>` : '');
