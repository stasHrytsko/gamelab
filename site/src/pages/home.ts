import { gameBig, gameSmall, postBig, postSmall } from '../cards.ts';
import { newestGames, postsFor } from '../data.ts';
import { footer, header, moreCard, sectionHead } from '../layout.ts';
import { escapeHtml, pageUrl, t, type Lang } from '../i18n.ts';

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
        ${sectionHead(d.gamesTitle, d.gamesLead, 'games-title')}
        <div class="feature-grid">
          ${gameBig(newest, lang, d.latestGame)}
          <div class="feature-stack">
            ${rest.slice(0, 2).map((g) => gameSmall(g, lang)).join('')}
            ${moreCard(pageUrl(lang, 'games'), d.moreGames, d.more)}
          </div>
        </div>
      </section>`;

  const blogBlock =
    latestPost === undefined
      ? ''
      : `
      <section class="block" id="blog" aria-labelledby="blog-title">
        ${sectionHead(d.blogTitle, d.blogLead, 'blog-title')}
        <div class="feature-grid">
          ${postBig(latestPost, lang)}
          <div class="feature-stack">
            ${olderPosts.slice(0, 2).map((p) => postSmall(p, lang)).join('')}
            ${moreCard(pageUrl(lang, 'blog'), d.morePosts, d.more)}
          </div>
        </div>
      </section>`;

  return `
    ${header(lang, 'home')}
    <main id="top">
      <section class="hero">
        <div class="wrap hero-grid">
          <div class="hero-art">
            <img src="/hero.svg" alt="${escapeHtml(d.heroArt)}" width="640" height="520">
          </div>
          <div class="hero-copy">
            <h1>${escapeHtml(d.heroTitle)}</h1>
            <p class="hero-lead">${escapeHtml(d.heroLead)}</p>
            <p class="hero-where"><span></span>${escapeHtml(d.heroWhere)}</p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="${pageUrl(lang, 'games')}">${escapeHtml(d.heroPlay)} <b>→</b></a>
              <a class="btn btn-ghost" href="${pageUrl(lang, 'blog')}">${escapeHtml(d.heroBlog)}</a>
            </div>
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
