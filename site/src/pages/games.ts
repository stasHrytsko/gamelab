import { gameBanner, gameCard } from '../cards.ts';
import { newestGames } from '../data.ts';
import { footer, header } from '../layout.ts';
import { escapeHtml, t, type Lang } from '../i18n.ts';

export function renderGames(lang: Lang): string {
  const d = t(lang);
  const [newest, ...rest] = newestGames;
  return `
    ${header(lang, 'games')}
    <main id="top">
      <div class="wrap">
        <section class="page-head">
          <h1>${escapeHtml(d.gamesTitle)}</h1>
          <p>${escapeHtml(d.gamesLead)}</p>
        </section>
        ${newest === undefined ? '' : gameBanner(newest, lang, d.latestGame)}
        ${rest.length === 0 ? '' : `<section class="games-grid" aria-label="${escapeHtml(d.gamesTitle)}">${rest.map((g) => gameCard(g, lang)).join('')}</section>`}
      </div>
    </main>
    ${footer(lang)}`;
}
