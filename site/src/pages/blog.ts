import { ARROW } from '../cards.ts';
import { postsFor, type Post } from '../data.ts';
import { footer, header } from '../layout.ts';
import { renderMarkdown } from '../markdown.ts';
import { escapeHtml, formatDate, pageUrl, t, type Lang } from '../i18n.ts';

function row(post: Post, index: number, lang: Lang): string {
  const d = t(lang);
  return `
    <a class="archive-row reveal" href="#${post.slug}" data-tag="${escapeHtml(post.tag.toLowerCase())}">
      <span class="archive-number">${String(index + 1).padStart(2, '0')}</span>
      <time datetime="${post.date}">${formatDate(post.date, lang)}</time>
      <div>
        <h2>${escapeHtml(post.title)}</h2>
        <p>${escapeHtml(post.excerpt)}</p>
      </div>
      <span class="archive-tag">${escapeHtml(post.tag)}${post.fallback ? ` · ${escapeHtml(d.onlyEnglish)}` : ''}</span>
    </a>`;
}

function renderIndex(lang: Lang, posts: Post[]): string {
  const d = t(lang);
  const latest = posts[0];
  if (latest === undefined) return `<main id="top"><div class="wrap"><p>${d.noPosts}</p></div></main>`;
  const tags = [...new Set(posts.map((p) => p.tag))];
  return `
    <main id="top">
      <div class="wrap">
        <section class="page-head">
          <h1>${escapeHtml(d.blogTitle)}</h1>
          <p>${escapeHtml(d.blogLead)} <span class="count">${escapeHtml(d.postsCount(posts.length))}</span></p>
        </section>
        <a class="card latest-post reveal" href="#${latest.slug}">
          <div class="card-body">
            <div class="card-meta"><span class="flag-inline">${escapeHtml(d.latestPost)}</span><time datetime="${latest.date}">${formatDate(latest.date, lang)}</time><span>${escapeHtml(latest.tag)}</span><span>${escapeHtml(d.minRead(latest.readingTime))}</span></div>
            <h2>${escapeHtml(latest.title)}</h2>
            <p>${escapeHtml(latest.excerpt)}</p>
            <span class="card-go">${escapeHtml(d.readPost)}${ARROW}</span>
          </div>
        </a>
        <section class="archive" aria-labelledby="archive-title">
          <div class="archive-head">
            <h2 id="archive-title">${escapeHtml(d.archive)}</h2>
            <div class="filters" role="group">
              <button class="is-active" type="button" data-filter="all">${escapeHtml(d.filterAll)}</button>
              ${tags.map((tag) => `<button type="button" data-filter="${escapeHtml(tag.toLowerCase())}">${escapeHtml(tag)}</button>`).join('')}
            </div>
          </div>
          <div class="archive-list">${posts.map((p, i) => row(p, i, lang)).join('')}</div>
        </section>
      </div>
    </main>`;
}

function renderPost(lang: Lang, posts: Post[], post: Post): string {
  const d = t(lang);
  const index = posts.findIndex((p) => p.slug === post.slug);
  const next = posts[index + 1] ?? posts[0];
  return `
    <main id="top">
      <div class="wrap">
        <article class="article" id="${post.slug}" ${post.fallback ? 'lang="en"' : ''}>
          <a class="article-back" href="${pageUrl(lang, 'blog')}">← ${escapeHtml(d.allPosts)}</a>
          <header class="article-header">
            <div class="card-meta"><span>${escapeHtml(post.tag)}</span><time datetime="${post.date}">${formatDate(post.date, lang)}</time><span>${escapeHtml(d.minRead(post.readingTime))}</span>${post.fallback ? `<span class="only-en">${escapeHtml(d.onlyEnglish)}</span>` : ''}</div>
            <h1>${escapeHtml(post.title)}</h1>
            <p>${escapeHtml(post.excerpt)}</p>
          </header>
          <div class="article-layout">
            <aside><span>${escapeHtml(d.postNumber)} ${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(d.articleAside)}</p></aside>
            <div class="article-body">${renderMarkdown(post.body)}</div>
          </div>
        </article>
        ${next === undefined ? '' : `
        <a class="next-post" href="#${next.slug}">
          <span>${escapeHtml(d.nextPost)}</span>
          <strong>${escapeHtml(next.title)}</strong>
          <b>→</b>
        </a>`}
      </div>
    </main>`;
}

/** Блог: список или статья (по хэшу #slug). Возвращает разметку и заголовок документа. */
export function renderBlog(lang: Lang): { html: string; title: string; description: string } {
  const d = t(lang);
  const posts = postsFor(lang);
  const slug = decodeURIComponent(window.location.hash.slice(1));
  const post = posts.find((p) => p.slug === slug);
  return {
    html: `${header(lang, 'blog')}${post === undefined ? renderIndex(lang, posts) : renderPost(lang, posts, post)}${footer(lang)}`,
    title: post === undefined ? d.blogPageTitle : `${post.title} — Stazzi`,
    description: post?.excerpt ?? d.blogPageDesc,
  };
}
