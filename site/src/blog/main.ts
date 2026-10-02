import '../styles.css';
import './styles.css';
import { siteHeader } from '../nav';
import { escapeHtml, formatDate, posts, type Post } from '../posts';

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(source: string): string {
  return source
    .split(/\r?\n\r?\n+/)
    .map((block) => {
      const clean = block.trim();
      if (clean.startsWith('## ')) return `<h2>${inlineMarkdown(clean.slice(3))}</h2>`;
      if (clean.startsWith('### ')) return `<h3>${inlineMarkdown(clean.slice(4))}</h3>`;
      if (clean.split(/\r?\n/).every((line) => line.startsWith('- '))) {
        const items = clean.split(/\r?\n/).map((line) => `<li>${inlineMarkdown(line.slice(2))}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      if (clean.split(/\r?\n/).every((line) => line.startsWith('> '))) {
        return `<blockquote>${inlineMarkdown(clean.replace(/^> /gm, '').replace(/\r?\n/g, ' '))}</blockquote>`;
      }
      return `<p>${inlineMarkdown(clean.replace(/\r?\n/g, ' '))}</p>`;
    })
    .join('');
}

function header(): string {
  return siteHeader('blog', 'blog-topbar');
}

function footer(): string {
  return `
    <footer class="blog-footer">
      <p>Stazzi — ideas, prototypes & blog.</p>
      <a href="/">Back to home <span>→</span></a>
    </footer>`;
}

function postRow(post: Post, index: number): string {
  return `
    <a class="archive-row reveal" href="#${post.slug}" data-tag="${escapeHtml(post.tag.toLowerCase())}" style="--delay:${index * 55}ms">
      <span class="archive-number">${String(index + 1).padStart(2, '0')}</span>
      <time datetime="${post.date}">${formatDate(post.date)}</time>
      <div>
        <h2>${escapeHtml(post.title)}</h2>
        <p>${escapeHtml(post.excerpt)}</p>
      </div>
      <span class="archive-tag">${escapeHtml(post.tag)}</span>
      <span class="archive-arrow" aria-hidden="true">↗</span>
    </a>`;
}

function renderIndex(): string {
  const latest = posts[0];
  if (latest === undefined) return '<p>No posts yet.</p>';
  const tags = [...new Set(posts.map((post) => post.tag))];

  return `
    <div class="scroll-progress" aria-hidden="true"></div>
    <div class="site-shell blog-shell">
      ${header()}
      <main>
        <section class="blog-hero">
          <div>
            <p class="eyebrow"><span></span>Personal journal / ${posts.length} posts</p>
            <h1>Blog<span>.</span></h1>
          </div>
          <div class="blog-intro">
            <p>Updates, thoughts and things I learn while making stuff.</p>
            <small>No grand lessons. Just an honest record of ideas changing while I work.</small>
          </div>
        </section>

        <section class="latest-note" aria-labelledby="latest-title">
          <div class="latest-label"><span>Latest post</span><i></i></div>
          <a class="latest-card" href="#${latest.slug}">
            <div class="latest-meta"><time datetime="${latest.date}">${formatDate(latest.date)}</time><span>${escapeHtml(latest.tag)}</span><span>${latest.readingTime} min read</span></div>
            <h2 id="latest-title">${escapeHtml(latest.title)}</h2>
            <p>${escapeHtml(latest.excerpt)}</p>
            <span class="latest-action">Read the post <b>→</b></span>
          </a>
        </section>

        <section class="archive" aria-labelledby="archive-title">
          <div class="archive-head">
            <div><p class="eyebrow"><span></span>All writing</p><h2 id="archive-title">Archive</h2></div>
            <div class="filters" aria-label="Filter posts">
              <button class="is-active" type="button" data-filter="all">All</button>
              ${tags.map((tag) => `<button type="button" data-filter="${escapeHtml(tag.toLowerCase())}">${escapeHtml(tag)}</button>`).join('')}
            </div>
          </div>
          <div class="archive-list">${posts.map(postRow).join('')}</div>
        </section>
      </main>
      ${footer()}
    </div>`;
}

function renderPost(post: Post): string {
  const index = posts.findIndex((item) => item.slug === post.slug);
  const next = posts[index + 1] ?? posts[0];
  return `
    <div class="scroll-progress" aria-hidden="true"></div>
    <div class="site-shell blog-shell article-shell">
      ${header()}
      <main>
        <article class="article" id="${post.slug}">
          <a class="article-back" href="/blog/"><span>←</span>All posts</a>
          <header class="article-header">
            <div class="article-kicker"><span>${escapeHtml(post.tag)}</span><time datetime="${post.date}">${formatDate(post.date)}</time><span>${post.readingTime} min read</span></div>
            <h1>${escapeHtml(post.title)}</h1>
            <p>${escapeHtml(post.excerpt)}</p>
          </header>
          <div class="article-layout">
            <aside><span>Post ${String(index + 1).padStart(2, '0')}</span><i></i><p>Written while building, testing and changing my mind.</p></aside>
            <div class="article-body">${renderMarkdown(post.body)}</div>
          </div>
        </article>
        ${next === undefined ? '' : `
          <a class="next-note" href="#${next.slug}">
            <span>Next post</span>
            <strong>${escapeHtml(next.title)}</strong>
            <b>→</b>
          </a>`}
      </main>
      ${footer()}
    </div>`;
}

const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');
const appRoot: HTMLElement = root;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function activatePage(): void {
  const progress = document.querySelector<HTMLElement>('.scroll-progress');
  let queued = false;

  const draw = (): void => {
    queued = false;
    const range = document.documentElement.scrollHeight - window.innerHeight;
    if (progress !== null) progress.style.transform = `scaleX(${range > 0 ? window.scrollY / range : 0})`;
  };
  const queue = (): void => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(draw);
  };
  window.onscroll = queue;
  queue();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const item = entry.target as HTMLElement;
      window.setTimeout(() => item.classList.add('is-visible'), reducedMotion ? 0 : Number.parseInt(item.style.getPropertyValue('--delay')) || 0);
      observer.unobserve(item);
    });
  }, { threshold: .08 });
  document.querySelectorAll<HTMLElement>('.reveal').forEach((item) => observer.observe(item));

  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = button.dataset['filter'] ?? 'all';
      document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
      document.querySelectorAll<HTMLElement>('.archive-row').forEach((row) => {
        row.hidden = selected !== 'all' && row.dataset['tag'] !== selected;
      });
    });
  });
}

function render(): void {
  const slug = decodeURIComponent(window.location.hash.slice(1));
  const post = posts.find((item) => item.slug === slug);
  appRoot.innerHTML = post === undefined ? renderIndex() : renderPost(post);
  document.title = post === undefined ? 'Blog — Stazzi' : `${post.title} — Stazzi`;
  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (description !== null) description.content = post?.excerpt ?? 'Posts, experiments and things Stas learns while making small games.';
  window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  activatePage();
}

window.addEventListener('hashchange', render);
render();
