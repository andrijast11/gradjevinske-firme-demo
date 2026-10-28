/* =========================================================
   ARMATURA GRADNJA — interakcije i animacije
   Vanilla JS, bez biblioteka.
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const fmt = (n, dec = 0) => {
    const [i, d] = Math.abs(n).toFixed(dec).split('.');
    return (n < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d ? ',' + d : '');
  };

  /* ---------- Personalizacija za email kampanje: ?firma=Ime&grad=Grad ---------- */
  (function personalize() {
    const q = new URLSearchParams(location.search);
    const firma = (q.get('firma') || '').trim().slice(0, 24);
    const grad = (q.get('grad') || '').trim().slice(0, 24);
    if (firma) {
      $$('[data-company]').forEach(el => {
        const orig = el.textContent;
        el.textContent = orig === orig.toUpperCase() ? firma.toUpperCase() : firma;
      });
      document.title = document.title.replace('Armatura', firma);
    }
    if (grad) {
      const eb = $('.eyebrow');
      if (eb) eb.lastChild.textContent = ' Od 1998. · ' + grad;
    }
  })();

  /* ---------- Ilustracije ---------- */
  const artCache = {};
  function art(name, mode, seed) {
    const key = name + mode + seed;
    return artCache[key] || (artCache[key] = window.IsoArt.render(name, mode, seed));
  }
  $$('.proj__art').forEach((el, i) => { el.innerHTML = art(el.dataset.art, 'solid', 11 + i * 7); });
  const baAfter = $('[data-art="ba-solid"]'), baBefore = $('[data-art="ba-blueprint"]');
  if (baAfter) baAfter.innerHTML = art('ba', 'solid', 5);
  if (baBefore) baBefore.innerHTML = art('ba', 'blueprint', 5);

  /* ---------- Split helpers ---------- */
  function splitWords(el, cls) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(w => `<span class="${cls}">${w}</span>`).join(' ');
    return $$('.' + cls, el);
  }

  /* =========================================================
     PRELOADER
     ========================================================= */
  const loader = $('.loader');
  const msgs = ['Iskop temelja…', 'Armiranje ploče…', 'Betoniranje stubova…', 'Montaža fasade…', 'Tehnički prijem…', 'Ključ u ruke.'];
  function runLoader(done) {
    const countEl = $('.js-count'), bar = $('.js-loader-bar'), msgEl = $('.js-loader-msg');
    const dur = reduced ? 300 : 2300;
    const t0 = performance.now();
    let lastMsg = -1;
    (function tick(now) {
      const t = clamp((now - t0) / dur);
      const p = Math.round(easeOut(t) * 100);
      countEl.textContent = String(p).padStart(3, '0');
      bar.style.width = p + '%';
      const mi = Math.min(msgs.length - 1, Math.floor(t * msgs.length));
      if (mi !== lastMsg) { msgEl.textContent = msgs[mi]; lastMsg = mi; }
      if (t < 1) requestAnimationFrame(tick);
      else setTimeout(() => {
        loader.classList.add('is-out');
        document.body.classList.remove('is-loading');
        done();
        setTimeout(() => loader.classList.add('is-gone'), 1500);
      }, reduced ? 0 : 250);
    })(t0);
  }

  /* =========================================================
     HERO — 3D zgrada koja se gradi (canvas)
     ========================================================= */
  const Hero = (function () {
    const cv = $('.hero__canvas');
    const ctx = cv.getContext('2d');
    const hero = $('.hero');
    const floorEl = $('.js-floor'), heightEl = $('.js-height'), statusEl = $('.js-status');
    let W, H, DPR, visible = true;
    const N = 16, FH = 0.5, HW = 1.5;
    let built = 0, target = 0, startT = 0;
    let mx = 0, my = 0, smx = 0, smy = 0, scrollP = 0;
    let particles = [];

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * DPR; cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      particles = Array.from({ length: W < 700 ? 40 : 90 }, () => ({
        x: (Math.random() - .5) * 14, y: Math.random() * 10, z: (Math.random() - .5) * 14, s: Math.random() * .004 + .002
      }));
    }

    let cam = {};
    function setupCam(t) {
      const mobile = W < 900;
      const yaw = t * 0.00012 + smx * 0.5 + scrollP * 1.4 + 0.6;
      const pitch = 0.42 + smy * 0.12 + scrollP * 0.25;
      cam = {
        cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch),
        ox: mobile ? W * 0.62 : W * 0.74,
        oy: mobile ? H * 0.36 : H * 0.5,
        S: mobile ? Math.min(W * 0.13, H * 0.05) : Math.min(H * 0.08, W * 0.058),
        pivot: N * FH * 0.5
      };
    }
    function P(x, y, z) {
      const c = cam;
      const rx = x * c.cy - z * c.sy;
      const rz = x * c.sy + z * c.cy;
      const y2 = y - c.pivot;
      const py = y2 * c.cp + rz * c.sp;
      const pz = -y2 * c.sp + rz * c.cp;
      const k = 16 / (16 + pz);
      return [c.ox + rx * k * c.S, c.oy - py * k * c.S, pz];
    }
    function L(a, b, color, alpha, width = 1) {
      const fog = clamp(1 - (Math.min(a[2], b[2]) + 5) / 18, 0.08, 1);
      ctx.globalAlpha = alpha * fog;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    function seg(p, q, color, alpha, w) { L(P(...p), P(...q), color, alpha, w); }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      setupCam(t);
      const explode = scrollP * 1.6;
      const FG = '#ece8df', OR = '#ff5a1f';

      // tlo
      for (let i = -7; i <= 7; i++) {
        seg([i, 0, -7], [i, 0, 7], FG, i === 0 ? .25 : .1, 1);
        seg([-7, 0, i], [7, 0, i], FG, i === 0 ? .25 : .1, 1);
      }
      // kota temelja
      const fp = [[-HW, 0, -HW], [HW, 0, -HW], [HW, 0, HW], [-HW, 0, HW]];
      for (let i = 0; i < 4; i++) seg(fp[i], fp[(i + 1) % 4], OR, .9, 2);

      const full = Math.floor(built), frac = built - full;
      const cols = [-HW, 0, HW];
      for (let f = 0; f <= Math.min(full, N - 1); f++) {
        const isCurrent = f === full;
        const g = isCurrent ? easeOut(frac) : 1;
        if (isCurrent && frac <= 0) break;
        const y0 = f * FH + f * explode * 0.35, y1 = y0 + FH * g;
        const hot = isCurrent || f === full - 1;
        const col = hot ? OR : FG;
        const a = hot ? 1 : .75;
        // stubovi
        cols.forEach(x => cols.forEach(z => {
          if (x === 0 && z === 0) return;
          seg([x, y0, z], [x, y1, z], col, a, hot ? 1.6 : 1);
        }));
        // ploča
        const sl = [[-HW, y1, -HW], [HW, y1, -HW], [HW, y1, HW], [-HW, y1, HW]];
        if (g > .98) {
          for (let i = 0; i < 4; i++) seg(sl[i], sl[(i + 1) % 4], col, a, hot ? 2 : 1.2);
          // fasadni rasteri
          if (!isCurrent) {
            for (let k = 1; k < 6; k++) {
              const u = -HW + (2 * HW) * k / 6;
              seg([u, y0, HW], [u, y1, HW], FG, .22, 1);
              seg([HW, y0, u], [HW, y1, u], FG, .22, 1);
              seg([u, y0, -HW], [u, y1, -HW], FG, .08, 1);
              seg([-HW, y0, u], [-HW, y1, u], FG, .08, 1);
            }
          }
        }
      }
      // krov i antena kada je završeno
      const topY = Math.min(built, N) * FH + Math.min(full, N - 1) * explode * 0.35;
      if (built >= N) {
        seg([0, topY, 0], [0, topY + 1.4, 0], OR, 1, 1.5);
        const blink = (Math.sin(t * 0.006) + 1) / 2;
        const p = P(0, topY + 1.4, 0);
        ctx.globalAlpha = .4 + blink * .6; ctx.fillStyle = OR;
        ctx.beginPath(); ctx.arc(p[0], p[1], 3 + blink * 2, 0, Math.PI * 2); ctx.fill();
      }

      // laserski sken
      const scanY = ((t * 0.0006) % 1) * (topY + 0.4);
      const sc = [[-HW - .3, scanY, -HW - .3], [HW + .3, scanY, -HW - .3], [HW + .3, scanY, HW + .3], [-HW - .3, scanY, HW + .3]];
      for (let i = 0; i < 4; i++) seg(sc[i], sc[(i + 1) % 4], OR, .35, 1);

      // kran
      const cx = 3.6, cz = -2.4, mastH = N * FH + 2.6;
      seg([cx, 0, cz], [cx, mastH, cz], OR, .9, 2);
      seg([cx + .25, 0, cz], [cx + .25, mastH, cz], OR, .5, 1);
      for (let y = 0; y < mastH; y += .5) seg([cx, y, cz], [cx + .25, y + .5, cz], OR, .3, 1);
      const ja = t * 0.00025 + 2.2;
      const jx = Math.cos(ja), jz = Math.sin(ja);
      const tip = [cx + jx * 6, mastH, cz + jz * 6];
      const tail = [cx - jx * 2, mastH, cz - jz * 2];
      seg(tail, tip, OR, 1, 2);
      seg([cx, mastH + 1.2, cz], tip, OR, .5, 1);
      seg([cx, mastH + 1.2, cz], tail, OR, .5, 1);
      seg([cx, mastH, cz], [cx, mastH + 1.2, cz], OR, 1, 1.5);
      const tr = 2.4 + Math.sin(t * 0.0004) * 1.6;
      const hx = cx + jx * tr, hz = cz + jz * tr;
      const hookY = mastH - 1.5 - (Math.sin(t * 0.0007) + 1) * 1.6;
      seg([hx, mastH, hz], [hx, hookY, hz], FG, .6, 1);
      seg([hx - jz * .8, hookY, hz + jx * .8], [hx + jz * .8, hookY, hz - jx * .8], FG, .9, 3);

      // čestice prašine
      ctx.fillStyle = FG;
      particles.forEach(p => {
        p.y += p.s * 6; if (p.y > 10) p.y = 0;
        const q = P(p.x, p.y, p.z);
        ctx.globalAlpha = .25 * clamp(1 - (q[2] + 5) / 18);
        ctx.fillRect(q[0], q[1], 1.5, 1.5);
      });
      ctx.globalAlpha = 1;
    }

    function updateHUD() {
      const f = Math.min(N, Math.floor(built));
      floorEl.textContent = String(f).padStart(2, '0') + ' / ' + N;
      heightEl.textContent = fmt(Math.min(built, N) * 3.2, 2) + ' m';
      statusEl.textContent = built >= N ? 'ZAVRŠENO ✓' : 'U IZGRADNJI';
    }

    function frame(t) {
      if (visible) {
        if (target > built) built = Math.min(target, built + (reduced ? 99 : 0.045));
        smx = lerp(smx, mx, .05); smy = lerp(smy, my, .05);
        draw(t);
        updateHUD();
      }
      requestAnimationFrame(frame);
    }

    function init() {
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('mousemove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
      requestAnimationFrame(frame);
    }
    return {
      init,
      build() { startT = performance.now(); target = N; },
      setScroll(p) { scrollP = p; }
    };
  })();

  /* =========================================================
     REVEAL OBSERVER
     ========================================================= */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      if (e.target.classList.contains('js-counter-wrap')) startCounter(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -5% 0px' });

  function observeReveals() {
    $$('.reveal-up:not(.hero .reveal-up), .split-lines, .footer__big').forEach(el => io.observe(el));
    $$('.stat').forEach(el => { el.classList.add('js-counter-wrap'); io.observe(el); });
  }

  /* ---------- counters ---------- */
  function startCounter(wrap) {
    const el = $('.js-counter', wrap);
    if (!el) return;
    const to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.decimals || 0, 10);
    const t0 = performance.now(), dur = reduced ? 1 : 2200;
    (function tick(now) {
      const t = clamp((now - t0) / dur);
      el.textContent = fmt(to * easeOut(t), dec);
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* =========================================================
     MANIFEST — reči se pale dok skroluješ
     ========================================================= */
  const manifestEl = $('.js-words');
  const mWords = manifestEl ? splitWords(manifestEl, 'w') : [];
  mWords.forEach(w => { if (/^(27|godina|obećanjem\.|rokovima)$/.test(w.textContent)) w.classList.add('hl'); });

  /* ---------- quote words ---------- */
  $$('.quote p').forEach(p => {
    splitWords(p, 'wd').forEach((w, i) => { w.style.transitionDelay = (i * 0.025) + 's'; });
  });

  /* ---------- footer letters ---------- */
  const fw = $('.js-footer-word');
  if (fw) {
    fw.innerHTML = fw.textContent.split('').map((c, i) => `<span class="ch" style="transition-delay:${i * 0.05}s">${c === ' ' ? '&nbsp;' : c.replace(/[<>&]/g, '')}</span>`).join('');
  }

  /* =========================================================
     MARQUEE
     ========================================================= */
  const marquees = $$('.js-marquee').map(el => {
    el.innerHTML += el.innerHTML + el.innerHTML;
    return { el, x: 0, speed: parseFloat(el.dataset.speed || 1), w: 0 };
  });
  function measureMarquees() { marquees.forEach(m => { m.w = m.el.scrollWidth / 3; }); }

  /* =========================================================
     PROJECTS — horizontalni skrol
     ========================================================= */
  const projSec = $('.projects'), track = $('.js-proj-track');
  const projBar = $('.js-proj-progress'), projIdx = $('.js-proj-index');
  const projCards = $$('.proj');
  let projTop = 0, projDist = 0;
  function measureProjects() {
    projDist = Math.max(0, track.scrollWidth - innerWidth);
    projSec.style.height = (projDist + innerHeight) + 'px';
    projTop = projSec.getBoundingClientRect().top + scrollY;
  }

  /* =========================================================
     PROCESS
     ========================================================= */
  const procWrap = $('.process__wrap'), procPath = $('.js-proc-path'), steps = $$('.step');

  /* =========================================================
     SCROLL LOOP
     ========================================================= */
  const nav = $('.nav');
  const heroContent = $('.hero__content'), heroHud = $('.hero__hud');
  const ticker = $('.ticker');
  const salty = $('.salty');
  let booted = false;
  let lastY = scrollY, vel = 0, navLastY = scrollY;
  const navLinks = $$('.nav__links a');
  const sections = navLinks.map(a => $(a.getAttribute('href')));

  function onFrame() {
    const y = scrollY, vh = innerHeight;
    vel = lerp(vel, y - lastY, 0.15);
    lastY = y;

    // hero parallax
    const hp = clamp(y / vh);
    Hero.setScroll(hp);
    if (!reduced && hp < 1) {
      heroContent.style.transform = `translate3d(0, ${y * 0.35}px, 0)`;
      heroContent.style.opacity = 1 - hp * 1.3;
      heroHud.style.opacity = 1 - hp * 2;
    }

    // nav
    nav.classList.toggle('is-scrolled', y > 40);
    if (booted) salty.classList.toggle('is-in', y > vh * 0.5);
    if (Math.abs(y - navLastY) > 8) {
      nav.classList.toggle('is-hidden', y > navLastY && y > 400 && !document.body.classList.contains('menu-open'));
      navLastY = y;
    }
    let active = -1;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < vh * 0.4) active = i; });
    navLinks.forEach((a, i) => a.classList.toggle('is-active', i === active));

    // marquee
    marquees.forEach(m => {
      if (!m.w) return;
      const boost = reduced ? 0 : Math.abs(vel) * 0.25;
      m.x -= (0.6 + boost) * m.speed;
      if (m.x <= -m.w) m.x += m.w;
      if (m.x > 0) m.x -= m.w;
      m.el.style.transform = `translate3d(${m.x}px,0,0)`;
    });
    if (!reduced) ticker.style.transform = `rotate(-2deg) scale(1.04) skewX(${clamp(-vel * 0.25, -12, 12)}deg)`;

    // manifest
    if (manifestEl) {
      const r = manifestEl.getBoundingClientRect();
      const p = clamp((vh * 0.8 - r.top) / (r.height + vh * 0.2));
      const n = Math.round(p * mWords.length);
      mWords.forEach((w, i) => w.classList.toggle('on', i < n));
    }

    // projects
    const pp = clamp((y - projTop) / (projDist || 1));
    track.style.transform = `translate3d(${-pp * projDist}px,0,0)`;
    projBar.style.transform = `scaleX(${pp})`;
    projIdx.textContent = String(Math.min(5, Math.floor(pp * 5) + 1)).padStart(2, '0');
    if (!reduced) {
      projCards.forEach(c => {
        const r = c.getBoundingClientRect();
        if (r.right < -200 || r.left > innerWidth + 200) return;
        const off = (r.left + r.width / 2 - innerWidth / 2) / innerWidth;
        c.firstElementChild.firstElementChild.style.transform = `translate3d(${off * -60}px,0,0) scale(1.02)`;
      });
    }

    // process
    if (procWrap) {
      const r = procWrap.getBoundingClientRect();
      const p = clamp((vh * 0.6 - r.top) / r.height);
      procPath.style.strokeDashoffset = 1000 * (1 - p);
      steps.forEach(s => s.classList.toggle('is-in', s.getBoundingClientRect().top < vh * 0.65));
    }

    requestAnimationFrame(onFrame);
  }

  /* =========================================================
     CURSOR + MAGNETIC
     ========================================================= */
  function initCursor() {
    if (!finePointer) return;
    document.body.classList.add('has-cursor');
    const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__label');
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    window.addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; });
    document.addEventListener('mouseleave', () => cur.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cur.classList.remove('is-hidden'));
    (function loop() {
      rx = lerp(rx, x, .18); ry = lerp(ry, y, .18);
      dot.style.transform = `translate3d(${x}px,${y}px,0)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', e => {
      const t = e.target.closest('[data-hover]');
      if (!t) { cur.classList.remove('is-hover', 'is-label'); return; }
      if (t.dataset.cursor) { label.textContent = t.dataset.cursor; cur.classList.add('is-label'); cur.classList.remove('is-hover'); }
      else { cur.classList.add('is-hover'); cur.classList.remove('is-label'); }
    });
  }

  function initMagnetic() {
    if (!finePointer || reduced) return;
    $$('.magnetic').forEach(el => {
      const inner = el.firstElementChild;
      el.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1), color .5s';
      if (inner) inner.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)';
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.3}px, ${dy * 0.4}px)`;
        if (inner) inner.style.transform = `translate(${dx * 0.12}px, ${dy * 0.15}px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
        if (inner) inner.style.transform = '';
      });
    });
  }

  /* =========================================================
     SERVICES hover preview
     ========================================================= */
  function initServices() {
    if (!finePointer) return;
    const prev = $('.svc-preview'), inner = $('.svc-preview__inner');
    let x = 0, y = 0, px = 0, py = 0, on = false;
    $$('.svc').forEach((s, i) => {
      s.addEventListener('mouseenter', () => { inner.innerHTML = art(s.dataset.art, 'solid', 3 + i); prev.classList.add('is-on'); on = true; });
      s.addEventListener('mouseleave', () => { prev.classList.remove('is-on'); on = false; });
    });
    window.addEventListener('mousemove', e => { x = e.clientX; y = e.clientY; });
    (function loop() {
      if (on || prev.classList.contains('is-on')) {
        const dx = x - px;
        px = lerp(px, x, .12); py = lerp(py, y, .12);
        prev.style.left = (px + 40) + 'px';
        prev.style.top = py + 'px';
        inner.style.transform = `rotate(${clamp(dx * 0.06, -14, 14)}deg)`;
      } else { px = x; py = y; }
      requestAnimationFrame(loop);
    })();
  }

  /* =========================================================
     BEFORE / AFTER
     ========================================================= */
  function initBA() {
    const f = $('.js-ba');
    if (!f) return;
    let dragging = false, intro = false;
    const set = clientX => {
      const r = f.getBoundingClientRect();
      f.style.setProperty('--pos', (clamp((clientX - r.left) / r.width, 0.02, 0.98) * 100) + '%');
    };
    f.addEventListener('pointerdown', e => { dragging = true; intro = true; f.setPointerCapture(e.pointerId); set(e.clientX); });
    f.addEventListener('pointermove', e => { if (dragging || e.pointerType === 'mouse') { intro = true; set(e.clientX); } });
    f.addEventListener('pointerup', () => { dragging = false; });
    f.addEventListener('pointercancel', () => { dragging = false; });
    // uvodna animacija klizača
    new IntersectionObserver(([e], obs) => {
      if (!e.isIntersecting || reduced) return;
      obs.disconnect();
      const t0 = performance.now();
      (function tick(now) {
        if (intro) return;
        const t = clamp((now - t0) / 2600);
        const v = 50 + Math.sin(t * Math.PI * 2) * 38 * (1 - t);
        f.style.setProperty('--pos', v + '%');
        if (t < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: 0.5 }).observe(f);
  }

  /* =========================================================
     CALCULATOR
     ========================================================= */
  function initCalc() {
    const area = $('.js-area'), areaOut = $('.js-area-out');
    const priceEl = $('.js-price'), rangeEl = $('.js-range');
    const monthsEl = $('.js-months'), workersEl = $('.js-workers');
    const bars = $$('.js-bar'), barV = $$('.js-bar-v');
    let type = $('.js-type .is-active'), finish = $('.js-finish .is-active');
    let shown = 0, anim;

    function chipGroup(sel, cb) {
      $$(sel + ' .chip').forEach(c => c.addEventListener('click', () => {
        $$(sel + ' .chip').forEach(x => x.classList.remove('is-active'));
        c.classList.add('is-active'); cb(c); update();
      }));
    }
    chipGroup('.js-type', c => { type = c; });
    chipGroup('.js-finish', c => { finish = c; });
    area.addEventListener('input', update);

    const priceBox = priceEl.parentElement;
    function fitPrice() {
      const max = priceBox.clientWidth;
      priceBox.style.fontSize = '88px';
      const w = priceBox.scrollWidth;
      if (w > max) priceBox.style.fontSize = Math.floor(88 * max / w) + 'px';
    }
    function update() {
      const a = +area.value;
      const price = +type.dataset.price, speed = +type.dataset.speed, mult = +finish.dataset.mult;
      const total = Math.round(a * price * mult / 1000) * 1000;
      area.style.setProperty('--p', ((a - area.min) / (area.max - area.min) * 100) + '%');
      areaOut.textContent = fmt(a) + ' m²';
      rangeEl.textContent = `± 8% · ${fmt(Math.round(total * .92 / 1000) * 1000)} – ${fmt(Math.round(total * 1.08 / 1000) * 1000)} €`;
      const months = Math.round(clamp(3 + Math.sqrt(a) * 0.2 * speed * (mult > 1.2 ? 1.15 : 1), 3, 36));
      monthsEl.textContent = months + (months % 10 === 1 && months !== 11 ? ' mesec' : ' meseci');
      workersEl.textContent = Math.round(clamp(6 + a / 45 * speed, 8, 240));
      // udeli
      const raw = [0.42, 0.24, 0.26 * Math.pow(mult, 1.6), 0.08];
      const sum = raw.reduce((s, v) => s + v, 0);
      raw.forEach((v, i) => { const pct = Math.round(v / sum * 100); bars[i].style.width = pct + '%'; barV[i].textContent = pct + '%'; });
      // animacija broja
      cancelAnimationFrame(anim);
      const from = shown, t0 = performance.now();
      (function tick(now) {
        const t = clamp((now - t0) / 700);
        shown = Math.round(lerp(from, total, easeOut(t)));
        priceEl.textContent = fmt(shown);
        fitPrice();
        if (t < 1) anim = requestAnimationFrame(tick);
      })(t0);
    }
    // start kada je u vidu
    new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); update(); } }, { threshold: .3 }).observe($('.calc__card'));
    priceEl.textContent = '0';
  }

  /* =========================================================
     QUOTES
     ========================================================= */
  function initQuotes() {
    const qs = $$('.quote'), count = $('.js-q-count');
    let i = 0, timer;
    const go = n => {
      qs[i].classList.remove('is-active');
      i = (n + qs.length) % qs.length;
      qs[i].classList.add('is-active');
      count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(qs.length).padStart(2, '0');
      clearInterval(timer); timer = setInterval(() => go(i + 1), 6500);
    };
    $('.js-q-prev').addEventListener('click', () => go(i - 1));
    $('.js-q-next').addEventListener('click', () => go(i + 1));
    qs[0].classList.remove('is-active');
    new IntersectionObserver(([e], obs) => { if (e.isIntersecting) { obs.disconnect(); go(0); } }, { threshold: .4 }).observe($('.quotes__slider'));
  }

  /* =========================================================
     FORM
     ========================================================= */
  function initForm() {
    const f = $('.js-form');
    f.addEventListener('submit', e => {
      e.preventDefault();
      let ok = true;
      $$('[required]', f).forEach(inp => {
        const bad = !inp.value.trim();
        inp.parentElement.classList.toggle('is-error', bad);
        if (bad) ok = false;
      });
      if (ok) f.classList.add('is-sent');
    });
    $$('input, textarea', f).forEach(inp => inp.addEventListener('input', () => inp.parentElement.classList.remove('is-error')));
  }

  /* =========================================================
     MENU
     ========================================================= */
  function initMenu() {
    const b = $('.burger'), m = $('.menu');
    const toggle = force => {
      const open = force ?? !document.body.classList.contains('menu-open');
      document.body.classList.toggle('menu-open', open);
      b.setAttribute('aria-expanded', open);
      m.setAttribute('aria-hidden', !open);
    };
    b.addEventListener('click', () => toggle());
    $$('.menu a').forEach(a => a.addEventListener('click', () => toggle(false)));
  }

  /* =========================================================
     BOOT
     ========================================================= */
  function fitFooter() {
    if (!fw) return;
    fw.style.fontSize = '100px';
    fw.style.fontSize = (100 * innerWidth * 0.92 / fw.scrollWidth) + 'px';
  }
  function measure() { measureMarquees(); measureProjects(); fitFooter(); }

  Hero.init();
  initCursor();
  initMagnetic();
  initServices();
  initBA();
  initCalc();
  initQuotes();
  initForm();
  initMenu();
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  requestAnimationFrame(onFrame);

  runLoader(() => {
    document.documentElement.classList.add('has-smooth');
    $('.hero__title').classList.add('is-in');
    $$('.hero .reveal-up').forEach(el => el.classList.add('is-in'));
    setTimeout(() => Hero.build(), reduced ? 0 : 500);
    observeReveals();
    booted = true;
  });
})();
