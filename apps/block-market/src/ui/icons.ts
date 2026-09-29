const svg = (body: string, cls = ''): string => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const stroke = (d: string, w = 2.2): string =>
  `<g fill="none" stroke="currentColor" stroke-width="${String(w)}" stroke-linecap="round" stroke-linejoin="round">${d}</g>`;

// Контур 2 px со скруглениями — как иконки кита.
export const icon = {
  back: svg(stroke('<path d="M15 5l-7 7 7 7"/>', 2.6)),
  help: svg('<path d="M9.2 9.3a2.9 2.9 0 115 1.9c-.9.9-2.2 1.4-2.2 2.9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.4" fill="currentColor"/>'),
  replay: svg(stroke('<path d="M5 12a7 7 0 107-7H8.5"/><path d="M10.5 2.5L8 5l2.5 2.5"/>', 2.4)),
  play: svg('<path d="M7 4.5v15c0 .8.9 1.3 1.6.8l11-7.5c.6-.4.6-1.2 0-1.6l-11-7.5C7.9 3.2 7 3.7 7 4.5z" fill="currentColor"/>'),
  check: svg(stroke('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 3.2)),
  cross: svg(stroke('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 3.2)),
  close: svg(stroke('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 2.6)),
  cup: svg('<path d="M7 3.5h10v6.5a5 5 0 01-10 0z" fill="currentColor"/><path d="M7 5.5H4.5a3 3 0 003 4.5M17 5.5h2.5a3 3 0 01-3 4.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10.8" y="14.5" width="2.4" height="3.5" fill="currentColor"/><rect x="7.5" y="18" width="9" height="2.8" rx="1.2" fill="currentColor"/>'),
  pieces: svg('<g fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2.4"/><rect x="13" y="3" width="8" height="8" rx="2.4" opacity=".55"/><rect x="3" y="13" width="8" height="8" rx="2.4" opacity=".55"/><rect x="13" y="13" width="8" height="8" rx="2.4"/></g>'),
  lines: svg(stroke('<path d="M4 7h16M4 12h16M4 17h10"/>', 2.6)),
  rotate: svg(stroke('<path d="M20 12a8 8 0 11-2.6-5.9"/><path d="M20 4v5h-5"/>')),
  mirror: svg(stroke('<path d="M12 3v18" stroke-dasharray="2 3"/><path d="M9 7L4 17h5z" fill="currentColor" fill-opacity=".2"/><path d="M15 7l5 10h-5z"/>')),
  swap: svg(stroke('<path d="M4 8h14M14 4l4 4-4 4"/><path d="M20 16H6M10 12l-4 4 4 4"/>')),
  reroll: svg(stroke('<rect x="4" y="4" width="16" height="16" rx="4"/>') + '<g fill="currentColor"><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/></g>'),
  coin: svg('<circle cx="12" cy="12" r="11" fill="var(--ui-yellow)"/><circle cx="12" cy="12" r="10.2" fill="none" stroke="color-mix(in srgb, var(--ui-yellow) 70%, #b45309)" stroke-width="1.6"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="color-mix(in srgb, var(--ui-yellow) 55%, #b45309)" stroke-width="1.6"/><path d="M7.6 7.4a5.2 5.2 0 016.2-1.3" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" fill="none" stroke-linecap="round"/>', 'coin'),
};
