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
  moves: svg('<g fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1.5"/><rect x="9.5" y="3" width="5" height="5" rx="1.5"/><rect x="16" y="3" width="5" height="5" rx="1.5"/><rect x="3" y="9.5" width="5" height="5" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.5"/><rect x="16" y="9.5" width="5" height="5" rx="1.5"/></g>'),
};

/** Герой: четыре стрелки в стороны — он ходит во все стороны и бьёт вперёд и назад. */
export const heroGlyph = '<path d="M12 2.5l3.2 3.6h-2.2v4.9h4.9V8.8l3.6 3.2-3.6 3.2v-2.2H13v4.9h2.2L12 21.5l-3.2-3.6H11V13H6.1v2.2L2.5 12l3.6-3.2V11H11V6.1H8.8z" fill="#fff"/>';
/** Враг: круглое лицо с глазами — не зависит от цвета. */
export const enemyGlyph = '<circle cx="12" cy="12" r="8.2" fill="#fff"/><circle cx="9" cy="10.8" r="1.7" fill="currentColor"/><circle cx="15" cy="10.8" r="1.7" fill="currentColor"/><path d="M8.6 15.6c2 1.6 4.8 1.6 6.8 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
/** Стрелка для меток «вперёд / назад»; поворачивается под направление. */
export const arrowGlyph = '<path d="M4 12h14m-5-5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
