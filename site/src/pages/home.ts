import { allCard, rowGame, rowPost } from '../cards.ts';
import { newestGames, postsFor } from '../data.ts';
import { footer, header, sectionHead } from '../layout.ts';
import { escapeHtml, pageUrl, t, type Lang } from '../i18n.ts';

/** Две бумажные горы рядом с «Stas / Valencia» (синяя и оранжевая, как на макете). */
const WHERE_MARK = '<svg class="where-mark" viewBox="0 0 74 38" aria-hidden="true"><polygon points="2,36 24,4 46,36" fill="#7ea0b0"/><polygon points="24,4 46,36 34,36" fill="#628798"/><polygon points="36,36 52,12 70,36" fill="#e08a4d"/><polygon points="52,12 70,36 60,36" fill="#c9692f"/></svg>';

export function renderHome(lang: Lang): string {
  const d = t(lang);
  const [newest, ...rest] = newestGames;
  const posts = postsFor(lang);
  const [latestPost, ...olderPosts] = posts;

  const gamesBlock =
    newest === undefined
      ? ''
      : `
      <section class="block" id="games" aria-labelledby="games-title">
        ${sectionHead(d.gamesTitle, '', 'games-title')}
        <div class="cards-row">
          ${rowGame(newest, lang, true)}
          ${rest.slice(0, 2).map((g) => rowGame(g, lang, false)).join('')}
          ${allCard(pageUrl(lang, 'games'), d.moreGames)}
        </div>
      </section>`;

  const blogBlock =
    latestPost === undefined
      ? ''
      : `
      <section class="block" id="blog" aria-labelledby="blog-title">
        ${sectionHead(d.blogTitle, '', 'blog-title')}
        <div class="cards-row is-notes">
          ${rowPost(latestPost, lang, true, 0)}
          ${olderPosts.slice(0, 2).map((p, i) => rowPost(p, lang, false, i + 1)).join('')}
          ${allCard(pageUrl(lang, 'blog'), d.morePosts)}
        </div>
      </section>`;

  return `
    ${header(lang, 'home')}
    <main id="top">
      <section class="hero">
        <div class="hero-art">
          <img src="/hero.webp" alt="${escapeHtml(d.heroArt)}" width="1149" height="1369" fetchpriority="high">
        </div>
        <p class="hero-note" aria-hidden="true">${d.heroNote}</p>
        <div class="wrap">
          <div class="hero-copy">
            <h1>${escapeHtml(d.heroTitle).replace('|', '<br>')}</h1>
            <p class="hero-lead">${escapeHtml(d.heroLead)}</p>
            <p class="hero-where"><span>${escapeHtml(d.heroWhere)}${WHERE_MARK}</span></p>
          </div>
        </div>
      </section>
      <div class="wrap">
        ${gamesBlock}
        ${blogBlock}
      </div>
    </main>
    ${footer(lang)}`;
}
