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
  clear: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'),
  grid: svg('<g fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1.5"/><rect x="9.5" y="3" width="5" height="5" rx="1.5"/><rect x="16" y="3" width="5" height="5" rx="1.5"/><rect x="3" y="9.5" width="5" height="5" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.5"/><rect x="16" y="9.5" width="5" height="5" rx="1.5"/></g>'),
};

/** Клетка фигуры размера n: тайл кита с белой «таблеткой». Цвет — только подсказка. */
export const sq = (n: number, extra = ''): string => `<div class="sq c${String(n)} ${extra}"></div>`;
