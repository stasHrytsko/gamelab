import './styles.css';

type Prototype = {
  number: string;
  title: string;
  copy: string;
  path: string;
  image: string;
  available: boolean;
};

const prototypes: Prototype[] = [
  {
    number: '01',
    title: 'The Gap',
    copy: 'A puzzle experiment about movement, space and routing.',
    path: '/the-gap/',
    image: '/the-gap/og.png',
    available: true,
  },
  {
    number: '02',
    title: 'Overload',
    copy: 'A risk-reward prototype built around weight and hidden limits.',
    path: '/blog/',
    image: '',
    available: false,
  },
  {
    number: '03',
    title: 'Arrow Flip',
    copy: 'A small puzzle about direction, timing and a changing board.',
    path: '/arrow-flip/',
    image: '/arrow-flip/og.png',
    available: true,
  },
  {
    number: '04',
    title: 'Sprout',
    copy: 'A pathfinding experiment about resources and route planning.',
    path: '/sprout/',
    image: '/sprout/og.png',
    available: true,
  },
];

const posts = [
  {
    date: 'Sep 30, 2026',
    slug: 'trying-to-make-the-gap-actually-work',
    title: 'Trying to make The Gap actually work',
    excerpt: 'I changed the core idea again. Moving blocks felt too passive, so now I’m testing a different kind of decision.',
    tag: 'Process',
  },
  {
    date: 'Sep 27, 2026',
    slug: 'what-i-learned-from-building-10-prototypes',
    title: 'What I learned from building 10 prototypes',
    excerpt: 'Most ideas sound better in a document than they feel when you can actually touch them.',
    tag: 'Thoughts',
  },
  {
    date: 'Sep 18, 2026',
    slug: 'mixing-water-sort-with-sliding-puzzles',
    title: 'Mixing Water Sort with sliding puzzles',
    excerpt: 'An early experiment that eventually turned into The Gap.',
    tag: 'Prototype',
  },
];

function marker(number: string): string {
  return `<div class="section-marker"><span>${number}</span><i></i></div>`;
}

function projectVisual(item: Prototype): string {
  if (item.image) return `<img src="${item.image}" alt="${item.title} prototype preview" loading="lazy">`;
  return `<div class="weight-study" aria-hidden="true"><i></i><i></i><i></i><span>?</span></div>`;
}

function prototypeCard(item: Prototype): string {
  return `
    <a class="project-card reveal" href="${item.path}">
      <div class="project-visual">
        ${projectVisual(item)}
        <span class="project-index">${item.number}</span>
      </div>
      <div class="project-copy">
        <h3>${item.title}</h3>
        <p>${item.copy}</p>
      </div>
      <div class="project-link"><span></span>${item.available ? 'View project' : 'In progress'} <b>${item.available ? '→' : '·'}</b></div>
    </a>`;
}

function postCard(item: (typeof posts)[number]): string {
  return `
    <a class="post-card reveal" href="/blog/#${item.slug}">
      <div class="post-meta"><time>${item.date}</time><span>${item.tag}</span></div>
      <h3>${item.title}</h3>
      <p>${item.excerpt}</p>
      <span class="post-arrow" aria-hidden="true">↗</span>
    </a>`;
}

const latest = prototypes[0];
if (latest === undefined) throw new Error('Latest prototype missing');

const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');

root.innerHTML = `
  <div class="scroll-progress" aria-hidden="true"></div>
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="Stazzi, back to top">Stazzi<span>.</span></a>
      <nav aria-label="Main navigation">
        <a href="#about">About</a>
        <a href="#prototypes">Prototypes</a>
        <a href="/blog/">Blog</a>
        <a href="#contacts">Contacts</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero section-grid" aria-labelledby="hero-title">
        ${marker('01')}
        <div class="hero-copy">
          <p class="eyebrow"><span></span>Independent game maker</p>
          <h1 id="hero-title">Hi, I’m Stas<span>.</span></h1>
          <p class="hero-lead">I make small games, prototypes and visual experiments.</p>
          <p class="hero-sub">Mostly to explore ideas, mix mechanics and see what happens.</p>
          <div class="hero-actions">
            <a class="round-link" href="#prototypes"><b>↓</b><span>Explore prototypes</span></a>
            <a class="simple-link" href="/blog/">Read my blog <b>→</b></a>
          </div>
        </div>
        <div class="hero-art" aria-label="Portrait placeholder for Stas">
          <div class="portrait-placeholder"><span>S</span><i></i></div>
          <p>ideas<br>prototypes<br>experiments<br>and thoughts</p>
        </div>
      </section>

      <section class="portfolio-section" id="prototypes" aria-labelledby="prototypes-title">
        <div class="section-heading section-grid reveal">
          ${marker('02')}
          <div>
            <h2 id="prototypes-title">Prototypes</h2>
            <p>Small playable ideas, mechanics and experiments.</p>
          </div>
        </div>

        <a class="featured-project reveal" href="${latest.path}">
          <div class="featured-visual">
            ${projectVisual(latest)}
            <span class="latest-label">Latest prototype</span>
          </div>
          <div class="featured-copy">
            <div class="featured-meta"><span>${latest.number}</span><span>2026</span></div>
            <h3>${latest.title}</h3>
            <p>${latest.copy}</p>
            <span class="featured-link">View project <b>→</b></span>
          </div>
        </a>

        <div class="project-grid">
          ${prototypes.slice(1).map(prototypeCard).join('')}
        </div>
      </section>

      <section class="portfolio-section blog-preview" id="blog" aria-labelledby="blog-title">
        <div class="section-heading section-grid reveal">
          ${marker('03')}
          <div>
            <h2 id="blog-title">Blog</h2>
            <p>Updates, thoughts and things I learn while making stuff.</p>
          </div>
          <a class="text-link" href="/blog/">All posts <b>→</b></a>
        </div>
        <div class="posts-grid">
          ${posts.map(postCard).join('')}
        </div>
      </section>

      <section class="portfolio-section about-section" id="about" aria-labelledby="about-title">
        <div class="about-layout section-grid">
          ${marker('04')}
          <div class="about-title reveal">
            <p class="eyebrow"><span></span>A little context</p>
            <h2 id="about-title">About</h2>
            <p class="about-statement">This site is my personal archive of ideas, prototypes and experiments.</p>
          </div>
          <div class="about-copy reveal">
            <p>I’m Stas. I like making things and exploring how ideas work.</p>
            <p>Most of my experiments are small games. I’m interested in simple mechanics, unusual combinations and the moment when a rough idea suddenly becomes fun.</p>
            <p>I also draw, collect references and write about the things I’m working on.</p>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer" id="contacts">
      <div class="footer-grid section-grid reveal">
        ${marker('05')}
        <div class="footer-intro">
          <h2>Contacts</h2>
          <p>You can find me here.</p>
        </div>
        <div class="contact-links">
          <a href="https://github.com/stasHrytsko" target="_blank" rel="noreferrer"><span>GH</span>GitHub <b>↗</b></a>
          <a href="https://www.behance.net/" target="_blank" rel="noreferrer" class="placeholder-link" aria-label="Behance profile link to be added"><span>Bē</span>Behance <b>↗</b></a>
          <span class="contact-placeholder" title="Email address to be added"><span>@</span>Email <b>·</b></span>
          <a href="https://es.linkedin.com/in/stas-hrytsko" target="_blank" rel="noreferrer"><span>in</span>LinkedIn <b>↗</b></a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>Stazzi — ideas, prototypes & blog.</p>
        <a class="back-top" href="#top"><span>↑</span>Back to top</a>
      </div>
    </footer>
  </div>`;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const progress = document.querySelector<HTMLElement>('.scroll-progress');
let renderQueued = false;

function updateProgress(): void {
  renderQueued = false;
  const range = document.documentElement.scrollHeight - window.innerHeight;
  if (progress !== null) progress.style.transform = `scaleX(${range > 0 ? window.scrollY / range : 0})`;
}

function queueProgress(): void {
  if (renderQueued) return;
  renderQueued = true;
  window.requestAnimationFrame(updateProgress);
}

window.addEventListener('scroll', queueProgress, { passive: true });
queueProgress();

if (reducedMotion) {
  document.querySelectorAll<HTMLElement>('.reveal').forEach((node) => node.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  document.querySelectorAll<HTMLElement>('.reveal').forEach((node) => revealObserver.observe(node));
}

const sections = document.querySelectorAll<HTMLElement>('main section[id], footer[id]');
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.topbar nav a[href^="#"]');
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => link.classList.toggle('is-active', link.hash === `#${entry.target.id}`));
  });
}, { rootMargin: '-35% 0px -58% 0px' });
sections.forEach((section) => navObserver.observe(section));
