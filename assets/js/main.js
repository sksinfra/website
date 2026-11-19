/*
 * SKS Infra Projects: landing page behaviour.
 * No dependencies. Everything is progressive: without this file the page
 * still reads top to bottom as plain content.
 */
import { worldBuilder, JOURNEY, JOURNEY_INTRO, HERO_SHOT, HERO_SHOT_TALL, STILLS, resolve, mixShots } from './world.js';
import { Renderer } from './renderer.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

const view = { y: window.scrollY, w: window.innerWidth, h: window.innerHeight };
const tasks = [];          // run every animation frame
const onScroll = [];       // run on frames where the scroll position or viewport changed
let dirty = true;

addEventListener('scroll', () => { view.y = window.scrollY; dirty = true; }, { passive: true });
addEventListener('resize', () => { view.w = window.innerWidth; view.h = window.innerHeight; view.y = window.scrollY; dirty = true; });

let clock = 0, last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; clock += dt;
  if (dirty) { dirty = false; for (const f of onScroll) f(); }
  for (const f of tasks) f(clock, dt);
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------------ */
/* Navigation                                                                */
/* ------------------------------------------------------------------------ */
function initNav() {
  const nav = $('[data-nav]');
  if (!nav) return;
  const bar = $('[data-progress]');
  const themed = $$('[data-theme]');
  const links = $$('.nav__links a');
  const targets = links.map((a) => $(a.getAttribute('href')));
  const menu = $('#menu'), toggle = $('.nav__toggle'), label = $('.nav__toggle-label');
  let lastY = view.y, hidden = false, tone = '', open = false;

  function update() {
    const y = view.y;
    nav.classList.toggle('is-stuck', y > 24);
    const dy = y - lastY;
    if (Math.abs(dy) > 5) {
      const want = dy > 0 && y > view.h * 0.8 && !open;
      if (want !== hidden) { hidden = want; nav.classList.toggle('is-hidden', hidden); }
      lastY = y;
    }
    let t = 'dark';
    for (const s of themed) { const r = s.getBoundingClientRect(); if (r.top <= 40 && r.bottom > 40) t = s.dataset.theme; }
    if (open) t = 'dark';
    if (t !== tone) { tone = t; nav.dataset.tone = t; }
    const max = document.documentElement.scrollHeight - view.h;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1).toFixed(4) : 0})`;
    let cur = -1;
    targets.forEach((el, i) => { if (!el) return; const r = el.getBoundingClientRect(); if (r.top <= view.h * 0.45 && r.bottom > view.h * 0.45) cur = i; });
    links.forEach((a, i) => a.classList.toggle('is-current', i === cur));
  }
  onScroll.push(update);

  function setMenu(state) {
    open = state;
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Close' : 'Menu';
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      menu.hidden = false;
      nav.classList.remove('is-hidden'); hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!open) menu.hidden = true; }, 420);
    }
    dirty = true;
  }
  toggle.addEventListener('click', () => setMenu(!open));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { setMenu(false); toggle.focus(); } });
  const wide = matchMedia('(min-width: 60.01rem)');
  if (wide.addEventListener) wide.addEventListener('change', (e) => { if (e.matches && open) setMenu(false); });
}

/* ------------------------------------------------------------------------ */
/* Reveal on scroll, word-by-word statement                                  */
/* ------------------------------------------------------------------------ */
function initReveal() {
  const els = $$('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  els.forEach((e) => io.observe(e));
}

function initWords() {
  const host = $('[data-words]');
  if (!host) return;
  const words = [];
  (function walk(node) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }
          const span = document.createElement('span');
          span.className = 'w'; span.textContent = part;
          frag.appendChild(span); words.push(span);
        }
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) walk(child);
    }
  })(host);
  if (reduce) { words.forEach((w) => w.classList.add('is-on')); return; }
  let shown = -1;
  onScroll.push(() => {
    const r = host.getBoundingClientRect();
    if (r.bottom < -200 || r.top > view.h + 200) return;
    const p = clamp((view.h * 0.9 - r.top) / (r.height + view.h * 0.22), 0, 1);
    const n = Math.round(p * words.length * 1.12);
    if (n <= shown) return;                         // one-way: text never dims again once read
    for (let i = Math.max(0, shown); i < Math.min(n, words.length); i++) words[i].classList.add('is-on');
    shown = n;
  });
}

/* ------------------------------------------------------------------------ */
/* Film: one renderer bound to one stage element                             */
/* ------------------------------------------------------------------------ */
let world = null;

/* True when the browser is drawing without a graphics processor (virtual
   desktops, some locked-down office PCs, automated test tools). The film then
   runs in a light setup so the page stays responsive. */
function softwareRendering() {
  try {
    const gl = document.createElement('canvas').getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (!gl) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch { return false; }
}
let lite = false;

class Film {
  constructor(el, opts) {
    this.el = el;
    this.r = new Renderer(el, world, lite ? Object.assign({}, opts, { maxPixels: Math.min(opts.maxPixels || 1e9, 5.2e5), glow: 0 }) : opts);
    this.cam = { eye: [0, 0, 0], tgt: [0, 0, 0], fov: 50 };
    this.stale = true; this.ready = false;
    this.every = lite ? 2 : 1;          // draw every n-th frame
    this.count = 0; this.lastDraw = 0; this.acc = 0; this.frames = 0; this.warm = 2;
    this.size();
    if ('ResizeObserver' in window) new ResizeObserver(() => this.size()).observe(el);
  }
  size() {
    const r = this.el.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    if (r.width > 1 && r.height > 1 && this.r.resize(r.width, r.height)) this.stale = true;
  }
  draw(shot, time) {
    if (this.w < 2 || this.h < 2) return;
    if (this.every > 1 && ++this.count % this.every && !this.stale) return;
    resolve(shot, this.cam);
    this.r.render(this.cam, time);
    this.stale = false;
    if (!this.ready) { this.ready = true; this.el.classList.add('is-ready'); }
    this.tune();
  }
  /* Judge real frame pacing about once a second while the film runs
     continuously. If the device cannot hold roughly 40 fps, give up resolution
     and glow in steps; if it is far off, go straight to the light setup. */
  tune() {
    const now = performance.now(), gap = now - this.lastDraw;
    this.lastDraw = now;
    if (gap > 250) { this.acc = 0; this.frames = 0; return; }       // not continuous: start over
    this.acc += gap; this.frames++;
    if (this.acc < 900) return;
    const pace = this.acc / this.frames / this.every;
    this.acc = 0; this.frames = 0;
    if (this.warm > 0) { this.warm--; return; }                      // ignore the first moments after start-up
    if (pace < 27) return;
    const o = this.r.opts, px = this.r.w * this.r.h;
    if (pace > 48) {
      if (o.glow > 0 || px > 5.5e5) { o.glow = 0; o.maxPixels = Math.min(o.maxPixels, 5.2e5); this.size(); }
      else this.every = 2;
    } else if (px > 1.3e6) { o.maxPixels = px * 0.66; this.size(); }
    else if (o.glow > 1) o.glow = 1;
    else if (px > 8e5) { o.maxPixels = px * 0.66; this.size(); }
    else if (o.glow > 0) o.glow = 0;
    else if (px > 5.5e5) { o.maxPixels = 5.2e5; this.size(); }
    else this.every = 2;
  }
}
const blank = () => ({ p: [0, 0, 0], t: [0, 0, 0], fov: 50 });
const copyShot = (a, b) => { for (let i = 0; i < 3; i++) { b.p[i] = a.p[i]; b.t[i] = a.t[i]; } b.fov = a.fov; return b; };

/* ------------------------------------------------------------------------ */
/* Hero                                                                      */
/* ------------------------------------------------------------------------ */
function initHero() {
  const hero = $('.hero');
  if (!hero) return;
  const stageEl = $('[data-stage="hero"]', hero);
  const hasVideo = !!$('.hero__video', hero);
  let heroH = hero.offsetHeight, lastHp = -1;
  onScroll.push(() => {
    heroH = hero.offsetHeight;
    const hp = clamp(view.y / heroH, 0, 1);
    if (hp !== lastHp) { lastHp = hp; hero.style.setProperty('--hp', hp.toFixed(4)); }
  });
  if (!stageEl || hasVideo) return;

  const film = new Film(stageEl, { fogFar: 1700, maxPixels: view.w < 720 ? 1.6e6 : 3.2e6 });
  const shot = blank();
  let px = 0, py = 0, tx = 0, ty = 0;
  if (fine && !reduce) hero.addEventListener('pointermove', (e) => { tx = (e.clientX / view.w) * 2 - 1; ty = (e.clientY / view.h) * 2 - 1; });
  const born = performance.now();

  tasks.push((time, dt) => {
    const hp = clamp(view.y / heroH, 0, 1);
    if (hp >= 1 || document.hidden) return;
    if (reduce && !film.stale) return;
    const tall = film.w / film.h < 0.82;
    const b = tall ? HERO_SHOT_TALL : HERO_SHOT;
    film.r.opts.lift = tall ? -0.15 : 0;             // on phones, sit the horizon below the headline
    const intro = reduce ? 1 : easeOut(clamp((performance.now() - born - 120) / 2800, 0, 1));
    px += (tx - px) * Math.min(1, dt * 2.5); py += (ty - py) * Math.min(1, dt * 2.5);
    const e = smooth(hp), back = 1 - intro;
    shot.p[0] = b.p[0] - 210 * back + 16 * Math.sin(time * 0.1) + 260 * e;
    shot.p[1] = b.p[1] + 2.5 * Math.sin(time * 0.07 + 1) + px * 5;
    shot.p[2] = b.p[2] + 26 * back + 1.2 * Math.sin(time * 0.13) - 11 * e - py * 2.5;
    shot.t[0] = b.t[0] - 130 * back + 16 * Math.sin(time * 0.1) + 260 * e;
    shot.t[1] = b.t[1] + px * 14;
    shot.t[2] = b.t[2] - py * 5;
    shot.fov = b.fov;
    film.draw(shot, reduce ? 12.3 : time);
  });
}

/* ------------------------------------------------------------------------ */
/* Corridor journey                                                          */
/* ------------------------------------------------------------------------ */
let jumpTo = null;

function initJourney() {
  const track = $('[data-journey]');
  const stageEl = $('[data-stage="journey"]');
  if (!track || !stageEl) return;
  const chapters = $$('.chapter', track), intro = $('.journey__intro', track);
  const rail = $$('.journey__rail button', track), hud = $('[data-chainage]', track);
  const N = JOURNEY.length, LEAD = 0.7, T = N + LEAD, DWELL = 0.7;
  const film = new Film(stageEl, { fogNear: 170, fogFar: 1650, maxPixels: view.w < 720 ? 1.5e6 : 3.0e6 });
  const target = blank(), cur = copyShot(JOURNEY_INTRO, blank());
  let first = true, uiKey = '', lastCh = '';

  function shotAt(u, out) {
    if (u <= LEAD) return mixShots(JOURNEY_INTRO, JOURNEY[0][0], easeInOut(clamp(u / LEAD, 0, 1)), out);
    const v = Math.min(u - LEAD, N - 1e-4), i = Math.floor(v), f = v - i;
    if (f <= DWELL || i === N - 1) return mixShots(JOURNEY[i][0], JOURNEY[i][1], Math.min(1, f / DWELL), out);
    return mixShots(JOURNEY[i][1], JOURNEY[i + 1][0], easeInOut((f - DWELL) / (1 - DWELL)), out);
  }

  function ui(u) {
    const v = u - LEAD;
    let idx = -1, showing = false;
    if (v > -0.16) {
      idx = clamp(Math.floor(v), 0, N - 1);
      const f = v - idx;
      showing = f < DWELL + 0.03 || idx === N - 1;
    }
    const key = `${idx}|${showing}`;
    if (key === uiKey) return;
    uiKey = key;
    intro.classList.toggle('is-active', idx < 0);
    chapters.forEach((c, i) => { c.classList.toggle('is-active', showing && i === idx); c.classList.toggle('is-past', i < idx || (i === idx && !showing)); });
    rail.forEach((b, i) => { const on = i === idx; b.classList.toggle('is-active', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
  }

  tasks.push((time, dt) => {
    const r = track.getBoundingClientRect();
    if (r.top > view.h || r.bottom < 0 || document.hidden) { first = true; return; }
    const span = Math.max(1, r.height - view.h);
    let u = clamp(-r.top / span, 0, 1) * T;
    ui(u);
    if (reduce) {
      /* no flying: cut between held frames */
      const v = u - LEAD;
      u = v < 0 ? 0 : LEAD + clamp(Math.floor(v), 0, N - 1) + DWELL * 0.5;
    }
    shotAt(u, target);
    const k = first || reduce ? 1 : 1 - Math.exp(-dt * 5.2);
    let moved = first || film.stale;
    for (let i = 0; i < 3; i++) {
      const dp = (target.p[i] - cur.p[i]) * k, dtg = (target.t[i] - cur.t[i]) * k;
      if (Math.abs(dp) > 1e-3 || Math.abs(dtg) > 1e-3) moved = true;
      cur.p[i] += dp; cur.t[i] += dtg;
    }
    cur.fov += (target.fov - cur.fov) * k;
    first = false;
    if (reduce && !moved) return;
    film.draw(cur, reduce ? 12.3 : time);
    const ch = Math.max(0, Math.round(cur.p[0] + 640));
    const txt = `${Math.floor(ch / 1000)}+${String(ch % 1000).padStart(3, '0')}`;
    if (txt !== lastCh) { lastCh = txt; hud.textContent = txt; }
  });

  jumpTo = (i) => {
    const r = track.getBoundingClientRect();
    const span = Math.max(1, r.height - view.h);
    const u = LEAD + i + DWELL * 0.4;
    window.scrollTo({ top: view.y + r.top + (u / T) * span, behavior: reduce ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-jump]');
    if (!el) return;
    e.preventDefault();
    jumpTo(Number(el.dataset.jump));
  });
}

/* ------------------------------------------------------------------------ */
/* Project cards: stills from the film that wake up under the pointer        */
/* ------------------------------------------------------------------------ */
function initStills() {
  const cards = $$('.card[data-still]');
  if (!cards.length || !('IntersectionObserver' in window)) return;
  const live = [];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const item = e.target._still;
      item.near = e.isIntersecting;
      if (item.near && !item.film) item.film = new Film(item.stage, { fogFar: 1500, maxPixels: 7e5, maxDpr: 2 });
    }
  }, { rootMargin: '240px 480px' });
  for (const card of cards) {
    const media = $('.card__media', card), stage = $('.stage', card), base = STILLS[card.dataset.still];
    if (!stage || !base) continue;
    if ($('img, video', media)) { stage.remove(); continue; }       // a real photograph has been supplied
    const item = { card, stage, base, shot: blank(), film: null, near: false, hot: false, t: 0 };
    card._still = item; live.push(item);
    io.observe(card);
    if (fine && !reduce) {
      card.addEventListener('pointerenter', () => { item.hot = true; });
      card.addEventListener('pointerleave', () => { item.hot = false; });
    }
  }
  tasks.push((time, dt) => {
    if (document.hidden) return;
    for (const it of live) {
      if (!it.film || !it.near) continue;
      if (!it.hot && !it.film.stale) continue;
      if (it.hot) it.t += dt;
      copyShot(it.base, it.shot);
      it.shot.p[0] += 9 * Math.sin(it.t * 0.5); it.shot.t[0] += 9 * Math.sin(it.t * 0.5);
      it.shot.p[2] += 0.8 * Math.sin(it.t * 0.4);
      it.film.draw(it.shot, 12.3 + it.t);
    }
  });
}

/* ------------------------------------------------------------------------ */
/* Delivery models (tabs)                                                    */
/* ------------------------------------------------------------------------ */
function initModels() {
  const root = $('[data-models]');
  if (!root) return;
  const tabs = $$('[role="tab"]', root);
  const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  const stages = $$('.life__stages li', root);
  function select(i, focus) {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
      panels[k].hidden = !on; panels[k].classList.toggle('is-active', on);
    });
    const levels = tabs[i].dataset.levels.split(','), who = tabs[i].dataset.who.split('|');
    stages.forEach((li, k) => { li.dataset.level = levels[k]; $('em', li).textContent = who[k]; });
    if (focus) tabs[i].focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      const n = tabs.length;
      let j = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % n;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + n) % n;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      if (j >= 0) { e.preventDefault(); select(j, true); }
    });
  });
}

/* ------------------------------------------------------------------------ */
/* Projects rail                                                             */
/* ------------------------------------------------------------------------ */
function initWork() {
  const rail = $('[data-work-rail]');
  if (!rail) return;
  const prev = $('[data-work-prev]'), next = $('[data-work-next]'), bar = $('[data-work-progress]');
  const step = () => { const c = $('.card', rail); return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || '16') : 320; };
  function update() {
    const max = rail.scrollWidth - rail.clientWidth;
    const p = max > 0 ? clamp(rail.scrollLeft / max, 0, 1) : 0;
    if (bar) bar.style.transform = `scaleX(${(0.16 + 0.84 * p).toFixed(4)})`;
    if (prev) prev.disabled = rail.scrollLeft < 4;
    if (next) next.disabled = rail.scrollLeft > max - 4;
  }
  rail.addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
  if (prev) prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
  if (next) next.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));

  /* drag to scroll with a mouse */
  let down = false, moved = false, x0 = 0, left0 = 0;
  rail.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    down = true; moved = false; x0 = e.clientX; left0 = rail.scrollLeft;
  });
  addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - x0;
    if (!moved && Math.abs(dx) > 6) { moved = true; rail.classList.add('is-dragging'); }
    if (moved) rail.scrollLeft = left0 - dx;
  });
  const end = () => {
    if (!down) return;
    down = false;
    if (!moved) return;
    const s = step(), target = Math.round(rail.scrollLeft / s) * s;
    rail.scrollTo({ left: target, behavior: reduce ? 'auto' : 'smooth' });
    setTimeout(() => rail.classList.remove('is-dragging'), 450);
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
}

/* ------------------------------------------------------------------------ */
/* Presence map (loaded when the section approaches)                         */
/* ------------------------------------------------------------------------ */
function initPresence() {
  const mapEl = $('[data-map]'), list = $('[data-states]');
  if (!mapEl || !list || !('IntersectionObserver' in window)) return;
  const buttons = $$('button', list);
  const order = [1, 2, 4, 5, 6, 3, 7, 10, 9, 8];
  let api = null, touched = 0, inView = false, pinned = 0;

  function set(i) {
    if (!api) return;
    api.setActive(i);
    buttons.forEach((b) => b.classList.toggle('is-active', Number(b.dataset.state) === i));
  }
  buttons.forEach((b) => {
    const i = Number(b.dataset.state);
    b.setAttribute('aria-pressed', 'false');
    if (fine) {
      b.addEventListener('pointerenter', () => { touched = performance.now(); set(i); });
      b.addEventListener('pointerleave', () => { touched = performance.now(); set(pinned); });
    }
    b.addEventListener('focus', () => { touched = performance.now(); set(i); });
    b.addEventListener('click', () => {
      touched = performance.now();
      pinned = pinned === i ? 0 : i;
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.state) === pinned)));
      set(pinned || (fine ? i : 0));
    });
  });
  mapEl.addEventListener('pointerenter', () => { touched = performance.now(); });

  const load = new IntersectionObserver(async (entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    load.disconnect();
    try {
      const mod = await import('./presence.js');
      api = mod.mountMap(mapEl, { reduce });
      new IntersectionObserver((es) => {
        for (const e of es) { inView = e.isIntersecting; if (inView) api.reveal(); }
      }, { threshold: 0.2 }).observe(mapEl);
      if (!reduce) {
        let k = -1;
        setInterval(() => {
          if (!inView || document.hidden || pinned || performance.now() - touched < 7000) return;
          k = (k + 1) % (order.length + 2);
          set(k < order.length ? order[k] : 0);
        }, 2400);
      }
    } catch { /* map is an enhancement; the list of states remains */ }
  }, { rootMargin: '1000px 0px' });
  load.observe(mapEl);
}

/* ------------------------------------------------------------------------ */
/* Contact form                                                              */
/* ------------------------------------------------------------------------ */
/* The site is static, so there is no server to post to. If the form's
   data-endpoint holds a form-service URL the enquiry is sent there; otherwise
   the visitor's own email app is opened with the message filled in. */
function initContact() {
  const form = $('[data-contact-form]');
  if (!form) return;
  form.noValidate = true;                                    // we show our own messages below
  const status = $('.form__status', form), button = $('button[type="submit"]', form);
  const controls = $$('input, textarea', form);
  const to = form.dataset.to;

  function check(el) {
    const ok = el.checkValidity();
    const holder = el.closest('.field, .check'), err = document.getElementById(`${el.id}-err`);
    el.setAttribute('aria-invalid', String(!ok));
    if (holder) holder.classList.toggle('is-invalid', !ok);
    if (err) { err.hidden = ok; err.textContent = ok ? '' : el.dataset.error; }
    return ok;
  }
  for (const el of controls) {
    el.addEventListener('blur', () => { if (el.value.trim() || el.getAttribute('aria-invalid') === 'true') check(el); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(el); });
    el.addEventListener('change', () => { if (el.type === 'checkbox') check(el); });
  }
  const say = (text, tone) => { status.textContent = text; if (tone) status.dataset.tone = tone; else delete status.dataset.tone; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = controls.filter((el) => !check(el));
    if (bad.length) { say('Please complete the highlighted fields.', 'error'); bad[0].focus(); return; }
    const data = new FormData(form);
    const name = String(data.get('name')).trim(), email = String(data.get('email')).trim(), message = String(data.get('message')).trim();
    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      const subject = `Website enquiry from ${name}`;
      const body = `${message}\n\n${name}\n${email}`;
      window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      say(`Your email app should now be open with the message ready to send. If nothing opened, write to us at ${to}.`, 'ok');
      return;
    }
    button.disabled = true;
    say('Sending…');
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: data });
      if (!res.ok) throw new Error(`Form service answered ${res.status}`);
      form.reset();
      say('Thank you. Your enquiry has been sent and our team will be in touch.', 'ok');
    } catch {
      say(`Sorry, that did not go through. Please email us at ${to}.`, 'error');
    } finally {
      button.disabled = false;
    }
  });
}

/* ------------------------------------------------------------------------ */
/* Pointer micro-interactions                                                */
/* ------------------------------------------------------------------------ */
function initPointer() {
  if (!fine || reduce) return;
  for (const el of $$('[data-glow]')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
    });
  }
  for (const el of $$('[data-magnetic]')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = `translate3d(${(dx * 10).toFixed(2)}px, ${(dy * 8).toFixed(2)}px, 0)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  }
}

/* ------------------------------------------------------------------------ */
const safe = (fn) => { try { fn(); } catch (err) { console.error(err); } };
[initNav, initReveal, initWords, initModels, initWork, initPresence, initContact, initPointer].forEach(safe);
requestAnimationFrame(frame);

/* The film is prepared after first paint, a slice at a time, so the text is
   never waiting on it and the page stays responsive while it builds. */
const pause = () => new Promise((done) => setTimeout(done, 0));
async function startFilm() {
  if (!$('.stage')) return;
  await pause();
  lite = softwareRendering();
  const builder = worldBuilder();
  while (builder.next()) await pause();
  world = builder.finish();
  await pause();
  for (const init of [initHero, initJourney, initStills]) { safe(init); await pause(); }
  dirty = true;
}
requestAnimationFrame(() => setTimeout(() => startFilm().catch((err) => console.error(err)), 30));
