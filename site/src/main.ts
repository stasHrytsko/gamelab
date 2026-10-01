import sketchSprout from '../../UI Design/prototypes/sprout/reference-sketch.png';
import sketchBuild from '../../UI Design/prototypes/build-pack/mockup-v3.png';
import sketchDig from '../../UI Design/prototypes/excavation/tiles.png';
import sketchGap from '../../UI Design/prototypes/the-gap/game-screen.png';
import sketchArrow from '../../UI Design/prototypes/arrow-flip/game-screen.png';
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
    copy: 'Movement, space and routing — all in one small puzzle.',
    path: '/the-gap/',
    image: '/the-gap/og.png',
    available: true,
  },
  {
    number: '02',
    title: 'Overload',
    copy: 'Weight, hidden limits and knowing when to stop.',
    path: '#blog',
    image: '',
    available: false,
  },
  {
    number: '03',
    title: 'Arrow Flip',
    copy: 'Direction, timing and a board that changes with every move.',
    path: '/arrow-flip/',
    image: '/arrow-flip/og.png',
    available: true,
  },
  {
    number: '04',
    title: 'Sprout',
    copy: 'Resources, exploration and planning the route ahead.',
    path: '/sprout/',
    image: '/sprout/og.png',
    available: true,
  },
];

const sketches = [
  { image: sketchSprout, alt: 'Early route and landscape sketch for Sprout', label: 'Sprout / early route study' },
  { image: sketchBuild, alt: 'Interface exploration for Build and Pack', label: 'Build & Pack / shape study' },
  { image: sketchDig, alt: 'Tile study for The Dig', label: 'The Dig / tile language' },
  { image: sketchGap, alt: 'Game screen study for The Gap', label: 'The Gap / board study' },
  { image: sketchArrow, alt: 'Game screen study for Arrow Flip', label: 'Arrow Flip / motion study' },
];

const notes = [
  {
    date: 'Sep 30, 2026',
    slug: 'trying-to-make-the-gap-actually-work',
    title: 'Trying to make The Gap actually work',
    excerpt: 'I changed the core idea again. Moving blocks felt too passive, so now I’m testing what happens when sorting and spatial decisions become the same move.',
    tag: 'Process',
  },
  {
    date: 'Sep 27, 2026',
    slug: 'what-i-learned-from-building-10-prototypes',
    title: 'What I learned from building 10 prototypes',
    excerpt: 'Most ideas sound better in a document than they feel when you can actually touch them. The useful part starts when the first interaction pushes back.',
    tag: 'Learning',
  },
  {
    date: 'Sep 18, 2026',
    slug: 'mixing-water-sort-with-sliding-puzzles',
    title: 'Mixing Water Sort with sliding puzzles',
    excerpt: 'An experiment about containers, exits and reversible mistakes that eventually turned into The Gap.',
    tag: 'Experiment',
  },
];

function marker(number: string): string {
  return `<div class="section-marker"><span>${number}</span><i></i></div>`;
}

function prototypeCard(item: Prototype): string {
  const visual = item.image
    ? `<img src="${item.image}" alt="${item.title} prototype preview" loading="lazy">`
    : `<div class="weight-study" aria-hidden="true"><i></i><i></i><i></i><span>?</span></div>`;
  const label = item.available ? 'View project' : 'In progress';

  return `
    <a class="project-card reveal" href="${item.path}" data-tilt data-delay="${Number(item.number) * 70}">
      <div class="project-visual">
        ${visual}
        <span class="project-index">${item.number}</span>
        <span class="project-open" aria-hidden="true">↗</span>
      </div>
      <div class="project-copy">
        <h3>${item.title}</h3>
        <p>${item.copy}</p>
      </div>
      <div class="project-link"><span></span>${label} <b>${item.available ? '→' : '·'}</b></div>
    </a>`;
}

function sketchCard(item: (typeof sketches)[number], index: number): string {
  return `
    <figure class="sketch-card reveal" data-delay="${index * 65}">
      <div class="sketch-image"><img src="${item.image}" alt="${item.alt}" loading="lazy"></div>
      <figcaption><span>0${index + 1}</span>${item.label}</figcaption>
    </figure>`;
}

function noteCard(item: (typeof notes)[number], index: number): string {
  return `
    <a class="note-card reveal" href="/blog/#${item.slug}" data-delay="${index * 90}">
      <div class="note-meta"><time>${item.date}</time><span>${item.tag}</span></div>
      <h3>${item.title}</h3>
      <p>${item.excerpt}</p>
      <span class="note-arrow" aria-hidden="true">↗</span>
    </a>`;
}

const root = document.getElementById('app');
if (root === null) throw new Error('#app missing');

root.innerHTML = `
  <div class="scroll-progress" aria-hidden="true"></div>
  <div class="pointer-glow" aria-hidden="true"></div>
  <div class="site-shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="Stazzi, back to top">Stazzi<span>.</span></a>
      <nav aria-label="Main navigation">
        <a href="#about">About</a>
        <a href="#prototypes">Prototypes</a>
        <a href="#sketches">Sketches</a>
        <a href="/blog/">Blog</a>
        <a href="#contacts">Contacts</a>
      </nav>
    </header>

    <main id="top">
      <section class="hero section-grid" aria-labelledby="hero-title">
        ${marker('01')}
        <div class="hero-copy">
          <p class="eyebrow"><span></span>Independent maker / Barcelona</p>
          <h1 id="hero-title">Hi, I’m Stas<span>.</span></h1>
          <p class="hero-lead">I make small games, prototypes and visual experiments.</p>
          <p class="hero-sub">Mostly to explore ideas, mix mechanics and see what happens.</p>
          <a class="round-link magnetic" href="#prototypes"><b>↓</b><span>Explore my work</span></a>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="orbit orbit-one"></div>
          <div class="orbit orbit-two"></div>
          <div class="monogram"><span>S</span><i></i></div>
          <p class="orbit-copy">ideas<br>prototypes<br>sketches<br>and more</p>
          <span class="float-dot dot-one"></span>
          <span class="float-dot dot-two"></span>
        </div>
      </section>

      <section class="portfolio-section" id="prototypes" aria-labelledby="prototypes-title">
        <div class="section-heading section-grid reveal">
          ${marker('02')}
          <div>
            <h2 id="prototypes-title">Prototypes</h2>
            <p>Small playable ideas, mechanics and experiments.</p>
          </div>
          <a href="#sketches" class="text-link">Keep exploring <b>→</b></a>
        </div>
        <div class="project-grid">
          ${prototypes.map(prototypeCard).join('')}
        </div>
      </section>

      <section class="portfolio-section sketches-section" id="sketches" aria-labelledby="sketches-title">
        <div class="section-heading section-grid reveal">
          ${marker('03')}
          <div>
            <h2 id="sketches-title">Sketches</h2>
            <p>Drawings, visual ideas and things I make away from code.</p>
          </div>
          <a href="https://www.behance.net/" target="_blank" rel="noreferrer" class="text-link placeholder-link" aria-label="Behance profile link to be added">More on Behance <b>→</b></a>
        </div>
        <div class="sketch-rail" data-drift>
          ${sketches.map(sketchCard).join('')}
        </div>
      </section>

      <section class="portfolio-section notes-section" id="blog" aria-labelledby="notes-title">
        <div class="section-heading section-grid reveal">
          ${marker('04')}
          <div>
            <h2 id="notes-title">Notes</h2>
            <p>Updates, thoughts and things I learn while making stuff.</p>
          </div>
          <a class="text-link" href="/blog/">View all notes <b>→</b></a>
        </div>
        <div class="notes-grid">
          ${notes.map(noteCard).join('')}
        </div>
      </section>

      <section class="portfolio-section about-section" id="about" aria-labelledby="about-title">
        <div class="about-layout section-grid">
          ${marker('05')}
          <div class="about-title reveal">
            <p class="eyebrow"><span></span>A little context</p>
            <h2 id="about-title">About</h2>
            <p class="about-statement">This site is my personal archive of ideas, prototypes and experiments.</p>
          </div>
          <div class="about-copy reveal" data-delay="120">
            <p>I’m Stas. I like making things and exploring how ideas work.</p>
            <p>Most of my experiments are small games. I’m interested in simple mechanics, unusual combinations and the moment when a rough idea suddenly becomes fun.</p>
            <p>I also draw, collect references and occasionally write about the things I’m working on.</p>
          </div>
        </div>
        <div class="ticker" aria-hidden="true">
          <div>IDEAS <i></i> PROTOTYPES <i></i> SKETCHES <i></i> SMALL GAMES <i></i> VISUAL EXPERIMENTS <i></i> IDEAS <i></i> PROTOTYPES <i></i></div>
        </div>
      </section>
    </main>

    <footer class="footer" id="contacts">
      <div class="footer-grid section-grid reveal">
        ${marker('06')}
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
        <p>Stazzi — ideas, prototypes & sketches.</p>
        <a class="back-top magnetic" href="#top"><span>↑</span>Back to top</a>
      </div>
    </footer>
  </div>`;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const progress = document.querySelector<HTMLElement>('.scroll-progress');
const glow = document.querySelector<HTMLElement>('.pointer-glow');
const heroArt = document.querySelector<HTMLElement>('.hero-art');
const drift = document.querySelector<HTMLElement>('[data-drift]');
let pointerX = window.innerWidth / 2;
let pointerY = window.innerHeight / 2;
let renderQueued = false;

function renderMotion(): void {
  renderQueued = false;
  const range = document.documentElement.scrollHeight - window.innerHeight;
  if (progress !== null) progress.style.transform = `scaleX(${range > 0 ? window.scrollY / range : 0})`;
  if (glow !== null) glow.style.transform = `translate3d(${pointerX - 180}px, ${pointerY - 180}px, 0)`;

  if (!reducedMotion) {
    if (heroArt !== null) {
      const px = (pointerX / window.innerWidth - .5) * 14;
      const py = (pointerY / window.innerHeight - .5) * 10;
      heroArt.style.setProperty('--parallax-x', `${px}px`);
      heroArt.style.setProperty('--parallax-y', `${py}px`);
    }
    if (drift !== null) {
      const rect = drift.getBoundingClientRect();
      const factor = Math.max(-1, Math.min(1, (window.innerHeight / 2 - rect.top) / window.innerHeight));
      drift.style.setProperty('--drift', `${factor * -16}px`);
    }
  }
}

function queueMotion(): void {
  if (renderQueued) return;
  renderQueued = true;
  window.requestAnimationFrame(renderMotion);
}

window.addEventListener('scroll', queueMotion, { passive: true });
window.addEventListener('pointermove', (event) => {
  pointerX = event.clientX;
  pointerY = event.clientY;
  queueMotion();
}, { passive: true });
queueMotion();

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    const element = entry.target as HTMLElement;
    const delay = Number(element.dataset['delay'] ?? 0);
    window.setTimeout(() => element.classList.add('is-visible'), reducedMotion ? 0 : delay);
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.12 });

document.querySelectorAll<HTMLElement>('.reveal').forEach((node) => revealObserver.observe(node));

if (!reducedMotion) {
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      card.style.setProperty('--tilt-x', `${y * -4}deg`);
      card.style.setProperty('--tilt-y', `${x * 5}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  });

  document.querySelectorAll<HTMLElement>('.magnetic').forEach((item) => {
    item.addEventListener('pointermove', (event) => {
      const rect = item.getBoundingClientRect();
      item.style.transform = `translate(${(event.clientX - rect.left - rect.width / 2) * .12}px, ${(event.clientY - rect.top - rect.height / 2) * .12}px)`;
    });
    item.addEventListener('pointerleave', () => { item.style.transform = ''; });
  });
}

const sections = document.querySelectorAll<HTMLElement>('main section[id], footer[id]');
const navLinks = document.querySelectorAll<HTMLAnchorElement>('.topbar nav a');
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => link.classList.toggle('is-active', link.hash === `#${entry.target.id}`));
  });
}, { rootMargin: '-35% 0px -58% 0px' });
sections.forEach((section) => navObserver.observe(section));
