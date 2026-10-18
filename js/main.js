(() => {
  'use strict';

  // Tunables (the design tool exposed these as props)
  const CONFIG = { rippleStrength: 1, idleRain: true, parallax: true };

  const PRODUCTS = [
    { id: 'ink', name: 'Ink' },
    { id: 'paper', name: 'Paper' },
    { id: 'tide', name: 'Tide' },
  ];
  const SIZES = [{ label: '500 ml', short: '500', price: 165 }, { label: '750 ml', short: '750', price: 185 }, { label: '1 L', short: '1L', price: 210 }];
  const TITLES = ['The 750', 'Shell', 'Capacity', 'Collar', 'Cap', 'Boot', 'Seal', 'Finish', 'Yours'];
  const FREE_SHIP = 250;
  // One keyframe per scroll step: screen x (−1…1), lift (m), rotations (rad), camera distance/target, cap lift/spin, boot drop
  const K = [
    { fx: 0, lift: 0, rx: 0, ry: 0.3, rz: 0, dist: 0.66, ty: 0.13, cap: 0, cs: 0, boot: 0 },
    { fx: -0.36, lift: 0.02, rx: 0.12, ry: 1.6, rz: 0.34, dist: 0.6, ty: 0.13, cap: 0, cs: 0, boot: 0 },
    { fx: 0.34, lift: 0, rx: 0, ry: 2.9, rz: 0, dist: 0.56, ty: 0.125, cap: 0, cs: 0, boot: 0 },
    { fx: 0.22, lift: 0, rx: 0.16, ry: 4.3, rz: -0.06, dist: 0.24, ty: 0.218, cap: 0, cs: 0, boot: 0 },
    { fx: -0.28, lift: 0, rx: 0.06, ry: 5.4, rz: 0.04, dist: 0.4, ty: 0.2, cap: 0.065, cs: 9.42, boot: 0 },
    { fx: 0.3, lift: 0.05, rx: -0.28, ry: 6.5, rz: 0.1, dist: 0.5, ty: 0.1, cap: 0, cs: 9.42, boot: 0.05 },
    { fx: -0.26, lift: 0.05, rx: 0.18, ry: 7.6, rz: 1.12, dist: 0.6, ty: 0.15, cap: 0, cs: 9.42, boot: 0 },
    { fx: 0.28, lift: 0.01, rx: 0, ry: 12.87, rz: 0, dist: 0.62, ty: 0.13, cap: 0, cs: 9.42, boot: 0 },
    { fx: -0.3, lift: 0, rx: 0, ry: 19.15, rz: 0, dist: 0.6, ty: 0.13, cap: 0, cs: 9.42, boot: 0 },
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = n => '$' + n.toLocaleString('en-US');
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const later = (fn, ms) => setTimeout(fn, ms);

  const state = { variant: 'ink', shown: 'ink', size: 1, cart: [], cartOpen: false, adding: false, quick: {}, checkout: 0, step: 0 };

  // ---------- Elements ----------
  const el = {
    header: $('[data-header]'),
    story: $('#story'),
    frame: $('[data-frame]'),
    panels: $$('[data-step]'),
    intro: $('[data-intro]'),
    ml: $('[data-ml]'),
    progress: $('[data-progress]'),
    bar: $('[data-bar]'),
    stepNum: $('[data-step-num]'),
    stepTitle: $('[data-step-title]'),
    finishRows: $$('[data-finish]'),
    heroName: $('[data-hero-name]'),
    heroPrices: $$('[data-hero-price]'),
    sizeThumb: $('[data-size-thumb]'),
    sizeBtns: $$('[data-size]'),
    swatches: $$('[data-variant]'),
    addHero: $('[data-add-hero]'),
    quickBtns: $$('[data-quick-add]'),
    marquee: $('[data-marquee]'),
    bagBtn: $('[data-open-bag]'),
    bagCounts: $$('[data-bag-count]'),
    drawer: $('#bag'),
    shipMsg: $('[data-ship-msg]'),
    shipBar: $('[data-ship-bar]'),
    empty: $('[data-empty]'),
    lines: $('[data-lines]'),
    foot: $('[data-foot]'),
    subtotal: $('[data-subtotal]'),
    checkout: $('[data-checkout]'),
    checkoutTrack: $('[data-checkout-track]'),
    water: $('[data-water]'),
    waterCv: $('[data-water-canvas]'),
    waterHint: $('[data-water-hint]'),
    subscribe: $('[data-subscribe]'),
  };

  // ---------- 3D iframe bridge ----------
  let frameReady = false, lastPoseKey = '';
  const post = m => { try { el.frame.contentWindow && el.frame.contentWindow.postMessage(m, '*'); } catch (e) {} };
  const onFrameReady = () => {
    frameReady = true; lastPoseKey = '';
    post({ vessel: 'variant', id: state.shown });
  };
  window.addEventListener('message', e => {
    const d = e.data; if (d && d.vessel === 'ready' && e.source === el.frame.contentWindow) onFrameReady();
  });
  // The iframe is in the static markup, so its "ready" message can arrive before this script runs.
  // Its module script finishes before the load event, so treat load as ready too.
  el.frame.addEventListener('load', onFrameReady);
  try { if (el.frame.contentDocument && el.frame.contentDocument.readyState === 'complete' && el.frame.contentWindow.location.href !== 'about:blank') onFrameReady(); } catch (e) {}

  // ---------- Buy panel ----------
  function renderBuy() {
    const sz = SIZES[state.size], v = PRODUCTS.find(p => p.id === state.variant);
    el.heroName.textContent = `Vessel ${sz.short} — ${v.name}`;
    el.heroPrices.forEach(n => { n.textContent = money(sz.price); });
    el.sizeThumb.style.transform = `translateX(${state.size * 100}%)`;
    el.sizeBtns.forEach(b => b.setAttribute('aria-checked', String(+b.dataset.size === state.size)));
    el.swatches.forEach(b => b.setAttribute('aria-checked', String(b.dataset.variant === state.variant)));
    el.addHero.classList.toggle('is-pouring', state.adding);
  }
  function renderFinishes() {
    el.finishRows.forEach(r => r.classList.toggle('is-current', r.dataset.finish === state.shown));
  }
  function setShown(id) {
    if (id === state.shown) return;
    state.shown = id; renderFinishes();
    post({ vessel: 'variant', id });
  }
  function pickVariant(id) {
    if (id === state.variant) return;
    state.variant = id; renderBuy(); setShown(id);
    post({ vessel: 'slosh', soft: true });
  }
  el.sizeBtns.forEach(b => b.addEventListener('click', () => { state.size = +b.dataset.size; renderBuy(); }));
  el.swatches.forEach(b => b.addEventListener('click', () => pickVariant(b.dataset.variant)));
  el.addHero.addEventListener('click', () => {
    if (state.adding) return;
    state.adding = true; renderBuy();
    post({ vessel: 'slosh' });
    later(() => addItem(state.variant, state.size), 600);
    later(() => setCartOpen(true), 1200);
    later(() => { state.adding = false; renderBuy(); }, 2100);
  });
  el.quickBtns.forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.quickAdd;
    if (state.quick[id]) return;
    state.quick[id] = true; b.classList.add('is-pouring');
    later(() => addItem(id, 1), 550);
    later(() => { state.quick[id] = false; b.classList.remove('is-pouring'); }, 1900);
  }));

  // ---------- Bag ----------
  let bumpTimer = 0;
  function addItem(variant, size) {
    const key = variant + '-' + size, line = state.cart.find(c => c.key === key);
    if (line) line.qty += 1; else state.cart.push({ key, variant, size, qty: 1 });
    renderCart();
    el.bagCounts[0].classList.add('is-bumped');
    clearTimeout(bumpTimer);
    bumpTimer = later(() => el.bagCounts[0].classList.remove('is-bumped'), 280);
  }
  function setQty(key, d) {
    state.cart = state.cart.map(c => c.key === key ? { ...c, qty: c.qty + d } : c).filter(c => c.qty > 0);
    renderCart();
  }
  function setCartOpen(open) {
    if (open === state.cartOpen) return;
    state.cartOpen = open;
    document.documentElement.classList.toggle('is-bag-open', open);
    el.drawer.setAttribute('aria-hidden', String(!open));
    el.drawer.inert = !open;
    el.bagBtn.setAttribute('aria-expanded', String(open));
    if (open) later(() => $('.drawer__close', el.drawer).focus({ preventScroll: true }), 50);
    else if (el.drawer.contains(document.activeElement)) el.bagBtn.focus({ preventScroll: true });
  }
  function renderCart() {
    const count = state.cart.reduce((a, c) => a + c.qty, 0);
    const subtotal = state.cart.reduce((a, c) => a + c.qty * SIZES[c.size].price, 0);
    const left = Math.max(0, FREE_SHIP - subtotal);
    el.bagCounts.forEach(n => { n.textContent = count; });
    el.shipMsg.textContent = subtotal === 0 ? 'Free carbon-neutral shipping over $250'
      : left > 0 ? `You’re ${money(left)} away from free shipping` : 'Free shipping unlocked ✓';
    el.shipBar.style.width = Math.min(100, subtotal / FREE_SHIP * 100) + '%';
    el.empty.hidden = count > 0;
    el.foot.hidden = count === 0;
    el.subtotal.textContent = money(subtotal);
    el.lines.innerHTML = state.cart.map(c => {
      const p = PRODUCTS.find(x => x.id === c.variant), z = SIZES[c.size];
      return `<div class="line" data-key="${c.key}">
        <div class="line__thumb"><img src="assets/vessel-${c.variant}.png" alt="" width="88" height="110"></div>
        <div class="line__info">
          <div class="line__text"><span class="line__name">Vessel ${z.short} — ${p.name}</span><span class="line__meta">${z.label} · ${p.name} finish</span></div>
          <div class="stepper">
            <button type="button" data-qty="-1" aria-label="Decrease">−</button>
            <span class="stepper__qty">${c.qty}</span>
            <button type="button" data-qty="1" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="line__end">
          <span class="line__price">${money(z.price * c.qty)}</span>
          <button type="button" class="line__remove" data-remove>Remove</button>
        </div>
      </div>`;
    }).join('');
  }
  function renderCheckout() {
    el.checkout.classList.toggle('is-pouring', state.checkout > 0);
    el.checkoutTrack.style.transform = `translateY(${-state.checkout * 20}px)`;
  }
  el.lines.addEventListener('click', e => {
    const line = e.target.closest('[data-key]'); if (!line) return;
    const key = line.dataset.key, qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) setQty(key, +qtyBtn.dataset.qty);
    else if (e.target.closest('[data-remove]')) setQty(key, -Infinity);
  });
  el.checkout.addEventListener('click', () => {
    if (state.checkout) return;
    state.checkout = 1; renderCheckout();
    later(() => { state.checkout = 2; renderCheckout(); }, 1100);
    later(() => { state.checkout = 0; state.cart = []; renderCheckout(); renderCart(); setCartOpen(false); }, 2900);
  });
  el.bagBtn.addEventListener('click', () => setCartOpen(true));
  $$('[data-close-bag]').forEach(n => n.addEventListener('click', () => setCartOpen(false)));
  window.addEventListener('keydown', e => { if (e.key === 'Escape') setCartOpen(false); });

  // ---------- Newsletter ----------
  el.subscribe.addEventListener('submit', e => {
    e.preventDefault();
    const input = el.subscribe.elements.email;
    if (input.value.includes('@')) el.subscribe.classList.add('is-pouring');
  });

  // ---------- Pointer: parallax + drag-to-turn on the story stage ----------
  let ptr = { x: 0, y: 0 }, drag = null;
  window.addEventListener('pointermove', e => {
    ptr = { x: (e.clientX / innerWidth - 0.5) * 2, y: (e.clientY / innerHeight - 0.5) * 2 };
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    post({ vessel: 'drag', phase: 'move', dx: dx / innerWidth, dy: dy / innerHeight });
  });
  // Vertical touch still scrolls (touch-action: pan-y on the stage)
  window.addEventListener('pointerdown', e => {
    const st = e.target.closest && e.target.closest('[data-stage]');
    if (!st || e.target.closest('button,a,input,[data-interactive]')) return;
    drag = { x: e.clientX, y: e.clientY, el: st, id: e.pointerId };
    st.classList.add('is-dragging');
    try { st.setPointerCapture(e.pointerId); } catch (_) {}
    post({ vessel: 'drag', phase: 'start' });
  });
  const endDrag = () => {
    if (!drag) return;
    drag.el.classList.remove('is-dragging'); drag = null;
    post({ vessel: 'drag', phase: 'end' });
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // ---------- Per-frame: header, marquee, story ----------
  let hdrY = scrollY, hdrHidden = false;
  function headerStep() {
    const y = scrollY, d = y - hdrY;
    let hide = hdrHidden;
    if (y < 80) hide = false;
    else if (d > 4) hide = true;
    else if (d < -4) hide = false;
    if (Math.abs(d) > 4 || y < 80) hdrY = y;
    // Keep the header visible while the bag is open so its button stays reachable
    if (state.cartOpen) hide = false;
    if (hide !== hdrHidden) { hdrHidden = hide; el.header.classList.toggle('is-hidden', hide); }
  }

  let mx = 0, lastY = scrollY, boost = 0;
  function marqueeStep() {
    const y = scrollY;
    boost = Math.min(18, boost + Math.abs(y - lastY) * 0.06) * 0.93; lastY = y;
    mx -= 0.55 + boost;
    const half = el.marquee.scrollWidth / 2;
    if (half > 0 && -mx >= half) mx += half;
    el.marquee.style.transform = `translate3d(${mx}px,0,0)`;
  }

  function fillAt(P) {
    const L = (a, b, e) => a + (b - a) * e, s = (a, b) => ss(a, b, P);
    if (P <= 1.2) return 0.14;
    if (P <= 1.8) return L(0.14, 0.035, s(1.2, 1.8));
    if (P <= 2.27) return L(0.035, 0.16, s(1.86, 2.25));
    if (P <= 2.8) return L(0.16, 0.14, s(2.3, 2.8));
    return 0.14;
  }

  function storyStep() {
    const r = el.story.getBoundingClientRect(), vh = innerHeight;
    if (r.bottom < -vh || r.top > vh * 2) return;
    const N = K.length, prog = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - vh))), P = prog * (N - 1);
    const narrow = innerWidth < 760;
    for (const p of el.panels) {
      const i = +p.dataset.step, d = P - i, o = 1 - ss(0.24, 0.44, Math.abs(d));
      const base = p.dataset.base || (narrow ? '0%' : '-50%');
      p.style.opacity = o.toFixed(3);
      p.style.transform = `translate3d(0,calc(${base} + ${(-d * 120).toFixed(1)}px),0)`;
      p.style.visibility = o < 0.01 ? 'hidden' : 'visible';
      p.style.pointerEvents = o > 0.6 && p.dataset.interactive !== undefined ? 'auto' : 'none';
    }
    el.intro.style.opacity = (1 - ss(0.05, 0.5, P)).toFixed(3);
    el.intro.style.transform = `translateX(-50%) scale(${(1 + P * 0.35).toFixed(3)})`;
    const fill = fillAt(P);
    el.ml.textContent = Math.round(750 * Math.max(0, Math.min(1, (fill - 0.035) / 0.125)));
    el.progress.style.opacity = ss(0.3, 0.6, P).toFixed(3);
    el.bar.style.width = (prog * 100).toFixed(2) + '%';
    const step = Math.round(P);
    if (step !== state.step) {
      state.step = step;
      el.stepNum.textContent = String(step).padStart(2, '0');
      el.stepTitle.textContent = TITLES[step];
    }
    // During "Three finishes" the bottle cycles through each finish
    let shown = state.variant;
    if (P > 6.55 && P < 7.6) shown = ['ink', 'paper', 'tide'][Math.max(0, Math.min(2, Math.floor((P - 6.6) / 0.27)))];
    setShown(shown);
    const px = CONFIG.parallax ? ptr.x : 0, py = CONFIG.parallax ? ptr.y : 0;
    const poseKey = P.toFixed(4) + '|' + px.toFixed(3) + '|' + py.toFixed(3);
    if (!frameReady || poseKey === lastPoseKey) return;
    lastPoseKey = poseKey;
    const i0 = Math.min(N - 2, Math.floor(P)), e = ss(0.2, 0.8, P - i0), a = K[i0], b = K[i0 + 1], pose = {};
    for (const k in a) pose[k] = a[k] + (b[k] - a[k]) * e;
    pose.fill = fill; pose.px = px; pose.py = py;
    post({ vessel: 'pose', pose });
  }

  const loop = () => { headerStep(); marqueeStep(); storyStep(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  // ---------- Water: 2D ripple field under a 1D surface spring chain ----------
  function initWater(sec, cv) {
    const ctx = cv.getContext('2d'), off = document.createElement('canvas'), octx = off.getContext('2d');
    const CELL = 5, SSTEP = 6, LEVEL = 0.75, WC = [28, 149, 230], LC = [243, 243, 239], DK = [13, 14, 14];
    const rnd = Math.random, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    let W = 1, H = 1, dpr = 1, sy = 0, gy = 0, cols = 0, rows = 0, rS = 0, A, B, img, N = 0, sh, sv, lD, rD, ys;
    let drops = [], bubbles = [], t = 0, nextRain = 1.2, down = false, has = false, lx = 0, ly = 0, mvx = 0, mvy = 0, touched = false;
    const str = () => CONFIG.rippleStrength;
    const resize = () => {
      const r = sec.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      sy = H * (1 - LEVEL); gy = sy - 90;
      cols = Math.ceil(W / CELL) + 3; rows = Math.ceil((H - gy) / CELL) + 2; rS = Math.round((sy - gy) / CELL) + 3;
      A = new Float32Array(cols * rows); B = new Float32Array(cols * rows);
      off.width = cols; off.height = rows; img = octx.createImageData(cols, rows);
      for (let i = 0; i < img.data.length; i += 4) { img.data[i] = WC[0]; img.data[i + 1] = WC[1]; img.data[i + 2] = WC[2]; img.data[i + 3] = 255; }
      N = Math.ceil(W / SSTEP) + 2;
      sh = new Float32Array(N); sv = new Float32Array(N); lD = new Float32Array(N); rD = new Float32Array(N); ys = new Float32Array(N);
      drops = []; bubbles = [];
    };
    const amb = x => Math.sin(t * 0.9 + x * 0.006) * 1.4 + Math.sin(t * 0.53 - x * 0.011) * 0.9;
    const surfY = x => { const f = x / SSTEP, i = clamp(Math.floor(f), 0, N - 2), u = clamp(f - i, 0, 1); return sy + sh[i] * (1 - u) + sh[i + 1] * u + amb(x); };
    const disturb = (x, y, amt, rad) => {
      const cx = Math.round(x / CELL + 1), cy = Math.round((y - gy) / CELL), r = Math.ceil(rad);
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const gx = cx + i, gyy = cy + j; if (gx < 1 || gx >= cols - 1 || gyy < 1 || gyy >= rows - 1) continue;
        const d = Math.hypot(i, j) / rad; if (d > 1) continue;
        A[gyy * cols + gx] += amt * (1 - d * d);
      }
    };
    const pushSurface = (x, v, w = 3) => { const i = Math.round(x / SSTEP); for (let k = -w; k <= w; k++) { const j = i + k; if (j >= 0 && j < N) sv[j] += v * (0.5 + 0.5 * Math.cos(Math.PI * k / (w + 1))); } };
    const splash = (x, power, dir) => {
      const n = Math.min(40, 6 + (power * 0.9 | 0)), y0 = surfY(x) - 1;
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 1.5 + dir * 0.45, sp = power * (0.06 + rnd() * 0.12) + 1;
        drops.push({ x: x + (rnd() - 0.5) * 16, y: y0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 0.8 + rnd() * (1.4 + Math.min(3, power * 0.04)) });
      }
      if (drops.length > 520) drops.splice(0, drops.length - 520);
    };
    const bubble = (x, y, n) => {
      for (let k = 0; k < n; k++) bubbles.push({ x: x + (rnd() - 0.5) * 12, y: y + (rnd() - 0.5) * 12, r: 1 + rnd() * 3.6, vy: 0, ph: rnd() * 6 });
      if (bubbles.length > 280) bubbles.splice(0, bubbles.length - 280);
    };
    const pt = e => { const r = sec.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const interact = (x0, y0, x1, y1, mult) => {
      const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy); if (dist < 0.5) return;
      const s = str(), sp = Math.min(90, dist), steps = Math.max(1, Math.ceil(dist / (CELL * 1.2)));
      for (let k = 1; k <= steps; k++) {
        const x = x0 + dx * k / steps, y = y0 + dy * k / steps, depth = y - surfY(x);
        if (depth > 2) {
          disturb(x, y, (20 + sp * 2) * mult * s, 2.6);
          if (depth < 150) pushSurface(x, -(1 - depth / 150) * (0.25 + sp * 0.035) * mult * s * 2 / steps, 3);
        }
      }
      const a0 = y0 < surfY(x0), a1 = y1 < surfY(x1);
      if (a0 !== a1) {
        pushSurface(x1, clamp(dy * 0.6, -24, 24) * mult * s, 4);
        disturb(x1, surfY(x1) + 8, 160 * mult * s, 3);
        if (mult > 0.5 && sp > 5) splash(x1, Math.min(80, sp * 1.1) * s, clamp(dx / 30, -1, 1));
        if (!a1) bubble(x1, y1, 3 + (sp / 10 | 0));
      } else if (a1 && surfY(x1) - y1 < 14) pushSurface(x1, clamp(dx * 0.05, -1.5, 1.5) * (mult > 0.5 ? 3 : 1), 2);
      if (!a1 && mult > 0.5 && sp > 3 && rnd() < 0.7) bubble(x1, y1, 1 + (sp / 18 | 0));
    };
    sec.addEventListener('pointerdown', e => {
      if (e.target.closest && e.target.closest('a,button,input')) return;
      down = true; has = true; [lx, ly] = pt(e); mvx = mvy = 0; sec.classList.add('is-dragging');
      try { sec.setPointerCapture(e.pointerId); } catch (_) {}
      const s = str();
      if (ly > surfY(lx)) { disturb(lx, ly, 340 * s, 3.6); bubble(lx, ly, 8); pushSurface(lx, -2.5 * s, 3); }
      else drops.push({ x: lx, y: ly, vx: 0, vy: 0.5, r: 6 + rnd() * 2, big: true });
      if (!touched) { touched = true; el.waterHint.classList.add('is-gone'); }
    });
    sec.addEventListener('pointermove', e => {
      const [x, y] = pt(e);
      if (has) { interact(lx, ly, x, y, down ? 1 : 0.16); mvx = mvx * 0.5 + (x - lx) * 0.5; mvy = mvy * 0.5 + (y - ly) * 0.5; }
      lx = x; ly = y; has = true;
    });
    const onUp = () => {
      if (down) {
        const d = ly - surfY(lx);
        if (mvy < -5 && d > -24 && d < 160) { splash(lx, Math.min(80, -mvy * 4) * str(), clamp(mvx / 20, -1, 1)); pushSurface(lx, -Math.min(20, -mvy * 1.2), 4); }
      }
      down = false; sec.classList.remove('is-dragging');
    };
    sec.addEventListener('pointerup', onUp);
    sec.addEventListener('pointercancel', onUp);
    sec.addEventListener('pointerleave', () => { if (!down) has = false; });

    // Only simulate while the section is on screen
    let vis = false;
    new IntersectionObserver(([en]) => { vis = en.isIntersecting; }).observe(sec);

    const frame = () => {
      requestAnimationFrame(frame);
      if (!vis) return;
      if (Math.abs(sec.clientWidth - W) > 1 || Math.abs(sec.clientHeight - H) > 1) resize();
      t += 1 / 60;
      const s = str();
      if (CONFIG.idleRain && t > nextRain) {
        nextRain = t + 1.1 + rnd() * 2.2;
        drops.push({ x: W * (0.05 + rnd() * 0.9), y: -10, vx: (rnd() - 0.5) * 0.6, vy: 3 + rnd() * 3, r: 2 + rnd() * 2.6, big: rnd() < 0.25 });
      }
      for (let y = 1; y < rows - 1; y++) {
        const o = y * cols;
        for (let x = 1; x < cols - 1; x++) { const i = o + x; B[i] = ((A[i - 1] + A[i + 1] + A[i - cols] + A[i + cols]) * 0.5 - B[i]) * 0.989; }
      }
      const T = A; A = B; B = T;
      const ro = rS * cols;
      for (let i = 0; i < N; i++) { const gx = clamp(Math.round(i * SSTEP / CELL + 1), 1, cols - 2); sv[i] += A[ro + gx] * 0.0011; }
      for (let i = 0; i < N; i++) { sv[i] = clamp(sv[i] - 0.014 * sh[i] - 0.016 * sv[i], -40, 40); sh[i] = clamp(sh[i] + sv[i], -220, 220); }
      for (let p = 0; p < 6; p++) {
        for (let i = 0; i < N; i++) {
          if (i > 0) { lD[i] = 0.24 * (sh[i] - sh[i - 1]); sv[i - 1] += lD[i]; }
          if (i < N - 1) { rD[i] = 0.24 * (sh[i] - sh[i + 1]); sv[i + 1] += rD[i]; }
        }
        for (let i = 0; i < N; i++) { if (i > 0) sh[i - 1] += lD[i]; if (i < N - 1) sh[i + 1] += rD[i]; }
      }
      for (let k = drops.length - 1; k >= 0; k--) {
        const d = drops[k]; d.vy += 0.3; d.vx *= 0.996; d.x += d.vx; d.y += d.vy;
        if (d.x < -30 || d.x > W + 30 || d.y > H + 30) { drops.splice(k, 1); continue; }
        const sY = surfY(d.x);
        if (d.vy > 0 && d.y > sY) {
          const en = d.r * d.vy;
          pushSurface(d.x, Math.min(d.big ? 26 : 12, en * 0.32) * s, d.big ? 5 : 2);
          disturb(d.x, sY + 6, Math.min(d.big ? 520 : 260, 18 * en) * s, d.big ? 3.4 : 1.5);
          if (d.big) { splash(d.x, Math.min(80, 20 + d.vy * 3) * s, 0); bubble(d.x, sY + 14, 10); }
          else if (d.r > 2 && d.vy > 5) for (let q = 0; q < 2; q++) drops.push({ x: d.x, y: sY - 1, vx: (rnd() - 0.5) * 2.4, vy: -(1 + rnd() * d.vy * 0.35), r: d.r * 0.45 });
          drops.splice(k, 1);
        }
      }
      for (let k = bubbles.length - 1; k >= 0; k--) {
        const b = bubbles[k]; b.vy = b.vy * 0.94 - (0.05 + b.r * 0.012); b.y += b.vy; b.x += Math.sin(t * 4 + b.ph) * 0.35;
        const sY = surfY(b.x);
        if (b.y < sY + b.r) { disturb(b.x, sY + 4, 14 * b.r, 1.2); pushSurface(b.x, -0.25 * b.r, 1); bubbles.splice(k, 1); }
      }
      const D = img.data;
      for (let y = 1; y < rows - 1; y++) {
        for (let x = 1; x < cols - 1; x++) {
          const i = y * cols + x, sl = (A[i - 1] - A[i + 1]) + (A[i - cols] - A[i + cols]) * 1.2;
          let r = WC[0], g = WC[1], b = WC[2];
          if (sl > 0) { const m = Math.min(0.75, sl * 0.0062); r += (LC[0] - r) * m; g += (LC[1] - g) * m; b += (LC[2] - b) * m; }
          else { const m = Math.min(0.34, -sl * 0.003); r += (DK[0] - r) * m; g += (DK[1] - g) * m; b += (DK[2] - b) * m; }
          const o = i * 4; D[o] = r; D[o + 1] = g; D[o + 2] = b;
        }
      }
      octx.putImageData(img, 0, 0);
      for (let i = 0; i < N; i++) ys[i] = sy + sh[i] + amb(i * SSTEP);
      const surfPath = () => { ctx.beginPath(); for (let i = 0; i < N; i++) i ? ctx.lineTo(i * SSTEP, ys[i]) : ctx.moveTo(0, ys[0]); };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      surfPath(); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(off, -CELL, gy, cols * CELL, rows * CELL);
      surfPath(); ctx.strokeStyle = 'rgba(243,243,239,.2)'; ctx.lineWidth = 20; ctx.stroke();
      ctx.strokeStyle = 'rgba(243,243,239,.85)'; ctx.fillStyle = 'rgba(243,243,239,.2)'; ctx.lineWidth = 1;
      for (const b of bubbles) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      surfPath(); ctx.strokeStyle = 'rgba(243,243,239,.95)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgb(28,149,230)';
      for (const d of drops) {
        const v = Math.hypot(d.vx, d.vy), st = 1 + Math.min(2.2, v * 0.09), a = Math.atan2(d.vy, d.vx);
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * st, d.r, a, 0, Math.PI * 2); ctx.fill();
      }
    };
    resize();
    requestAnimationFrame(frame);
  }

  renderBuy();
  renderCart();
  initWater(el.water, el.waterCv);
})();
