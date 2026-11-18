/* Ferrofluid CTA. Each primary button holds a small pool of glossy black fluid; the pointer
   is a magnet. Near the button the pool leans toward it; on it, the fluid heaps into a mound
   rooted in the pool, crowned with soft spikes that lean toward it (ferrofluid on a dish, seen
   from the side), and the label stays readable because it is redrawn in light ink wherever
   the fluid covers it.
   Rendering: drops + tapered spikes as a smooth-union signed distance field, shaded per pixel
   (height from depth, normals from the height grid, a key light, a neutral sky reflection and
   a glint from the magnet). Physics: gravity, the magnet's pull, soft drop repulsion, walls.
   Left alone, the pool drifts like a lava lamp: each drop warms on its own slow cycle, rises,
   cools and sinks. Scrolling sloshes it (the fluid lags the button, so it is flung the other
   way). Only buttons on screen animate; away from the pointer they draw at 30 fps.
   Reduced motion: the pool is drawn once and never moves.
   Touch: a tap pulls the fluid to the finger for a moment. */
(function () {
  'use strict';
  if (!window.requestAnimationFrame || !document.createElement('canvas').getContext) return;

  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var RS = Math.min(DPR, 1.25);          /* fluid render scale (per CSS px) */
  var REACH = 150;                        /* px outside the button where the magnet is felt */
  var G = 1100, K = 150000, ACAP = 3200;   /* gravity, magnet strength, accel cap (px/s^2) */
  var ICON = ['M12 15V3', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5'];
  var INK = '#F6F9FD';
  var ptr = { x: -1e4, y: -1e4, on: false };
  var all = [], awake = [], raf = 0, last = 0, frameNo = 0;
  var lastScroll = window.scrollY || 0;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smin(a, b, k) { var h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

  function Ferro(btn) {
    this.btn = btn;
    this.fl = document.createElement('canvas'); this.fl.className = 'ferro-fluid';
    this.tx = document.createElement('canvas'); this.tx.className = 'ferro-ink';
    this.fl.setAttribute('aria-hidden', 'true'); this.tx.setAttribute('aria-hidden', 'true');
    btn.insertBefore(this.fl, btn.firstChild); btn.appendChild(this.tx);
    btn.classList.add('ferro');
    this.p = []; this.S = 0; this.Sv = 0; this.t = Math.random() * 10; this.still = 0; this.touchUntil = 0; this.vis = false;
    this.icon = btn.hasAttribute('data-ferro-icon'); this.F = 0; this.Fv = 0;   /* icon mode: hover pours the fluid into the download glyph */
    this.layout();
    var self = this;
    if (window.ResizeObserver) new ResizeObserver(function () { self.layout(); self.draw(); }).observe(btn);
    if (window.IntersectionObserver) new IntersectionObserver(function (es) {
      self.vis = es[es.length - 1].isIntersecting;
      if (self.vis) wake(self);
    }).observe(btn);
    else { this.vis = true; wake(this); }
    if (!FINE && !REDUCED) btn.addEventListener('pointerdown', function (e) {
      ptr.x = e.clientX; ptr.y = e.clientY; self.touchUntil = performance.now() + 700; wake(self);
    });
  }
  Ferro.prototype.layout = function () {
    var w = this.btn.clientWidth, h = this.btn.clientHeight;
    if (!w || !h) return;
    var old = this.w ? { w: this.w, h: this.h } : null;
    this.w = w; this.h = h;
    /* the capsule's drops scale with its area, so the hand-over from the hero button matches
       and the pool shrinks smoothly as the button narrows */
    this.r = this.icon ? Math.max(4, 0.068 * Math.sqrt(w * h)) : Math.max(5, h * 0.14);
    if (this.icon) this.iconGeo();
    this.rs = w * h > 18000 ? 1 : RS;
    this.fl.width = Math.round(w * this.rs); this.fl.height = Math.round(h * this.rs);
    this.tx.width = Math.round(w * DPR); this.tx.height = Math.round(h * DPR);
    this.img = this.fl.getContext('2d').createImageData(this.fl.width, this.fl.height);
    this.hgt = new Float32Array(this.fl.width * this.fl.height);
    var n = this.icon ? 22 : clamp(Math.round(w / 12), 10, 48);
    if (old && this.p.length === n) {
      for (var i = 0; i < n; i++) { this.p[i].x *= w / old.w; this.p[i].y *= h / old.h; }
    } else {
      this.p = [];
      for (var j = 0; j < n; j++) this.p.push({ x: (j + 0.5) * w / n, y: h - this.r, vx: 0, vy: 0, om: (2 * Math.PI) / (7 + Math.random() * 7), ph: Math.random() * 6.3 });
      for (var s = 0; s < 90; s++) this.step(1 / 120, null);
    }
  };
  /* The download glyph (Lucide "download", 24-unit box) as capsule segments in local px,
     plus evenly spaced targets along it for the drops to flow into. */
  Ferro.prototype.iconGeo = function () {
    var u = Math.min(this.w * 0.5, this.h * 0.38) / 24, ox = this.w / 2 - 12 * u, oy = this.h * 0.44 - 12 * u;
    var S = [[12, 3, 12, 15], [7, 10, 12, 15], [12, 15, 17, 10],
             [3, 15, 3, 19.4], [3, 19.4, 4.6, 21], [4.6, 21, 19.4, 21], [19.4, 21, 21, 19.4], [21, 19.4, 21, 15]];
    this.seg = S.map(function (q) { return [ox + q[0] * u, oy + q[1] * u, ox + q[2] * u, oy + q[3] * u]; });
    this.iu = u;
    var len = this.seg.map(function (g) { return Math.hypot(g[2] - g[0], g[3] - g[1]); });
    var tot = len.reduce(function (a, b) { return a + b; }, 0), pts = [], N = 22;
    for (var i = 0; i < N; i++) {
      var d = (i + 0.5) * tot / N, j = 0;
      while (j < len.length - 1 && d > len[j]) { d -= len[j]; j++; }
      var g = this.seg[j], t = len[j] ? d / len[j] : 0;
      pts.push({ x: g[0] + (g[2] - g[0]) * t, y: g[1] + (g[3] - g[1]) * t });
    }
    this.ipts = pts;
  };
  /* Magnet in local coords + its strength 0..1, or null. */
  Ferro.prototype.magnet = function () {
    var touch = performance.now() < this.touchUntil;
    if (REDUCED || (!ptr.on && !touch)) return null;
    var r = this.fl.getBoundingClientRect();
    if (!r.width) return null;
    var sx = this.w / r.width, sy = this.h / r.height;
    var x = (ptr.x - r.left) * sx, y = (ptr.y - r.top) * sy;
    var dx = Math.max(-x, 0, x - this.w), dy = Math.max(-y, 0, y - this.h);
    var out = Math.sqrt(dx * dx + dy * dy);
    var f = clamp(1 - out / REACH, 0, 1);
    return f > 0 ? { x: x, y: y, f: f * f * (3 - 2 * f), inside: out === 0 } : null;
  };
  Ferro.prototype.step = function (dt, m) {
    var p = this.p, n = p.length, r = this.r, w = this.w, h = this.h, i, j, a, b;
    if (this.icon) {
      var want = m && m.inside && !this.melt ? 1 : 0;
      this.Fv += ((want - this.F) * 110 - this.Fv * 17) * dt;
      this.F = clamp(this.F + this.Fv * dt, 0, 1.08);
    }
    var F = this.icon ? clamp(this.F, 0, 1) : 0;
    if (F > 0.02) m = null;                          /* while it holds the glyph, no magnet tug */
    var lava = REDUCED ? 0 : (1 - (m ? m.f : 0)) * (1 - F);
    var minD = r * 1.7, coh = r * 2.9, damp = Math.exp(-(4.5 + 2.5 * lava) * dt);
    for (i = 0; i < n; i++) {
      a = p[i]; var ax = 0, ay = G * (1 - F);
      if (F > 0.02) { var tg = this.ipts[i % this.ipts.length]; ax += (tg.x - a.x) * 140 * F; ay += (tg.y - a.y) * 140 * F; }
      if (lava > 0) {                                /* warm drops rise, cool ones sink */
        var heat = Math.sin(this.t * a.om + a.ph);
        heat = heat > 0.55 ? (heat - 0.55) / 0.45 : 0;
        ay -= G * 1.22 * heat * heat * (3 - 2 * heat) * lava;
        ax += Math.sin(this.t * a.om * 1.7 + a.ph * 2) * 22 * lava;
      }
      if (m) {
        var dx = m.x - a.x, dy = m.y - a.y, d = Math.sqrt(dx * dx + dy * dy) + 1e-3;
        var acc = Math.min(K * m.f / (d + 24), ACAP) * Math.exp(-d / 75);   /* nearby fluid answers; far fluid stays in the pool */
        if (d < r * 0.6) acc *= d / (r * 0.6);
        ax += acc * dx / d; ay += acc * dy / d;
        if (m.inside) ay -= G * 0.15 * m.f;          /* the mound stays rooted in the pool */
      }
      a.vx += ax * dt; a.vy += ay * dt;
    }
    if (F < 0.3) for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      a = p[i]; b = p[j];
      var ex = b.x - a.x, ey = b.y - a.y, e = Math.sqrt(ex * ex + ey * ey) + 1e-3, k = 0;
      if (e < minD) k = (minD - e) * 260;            /* keep volume */
      else if (e < coh) k = -(e - minD) * 18;        /* surface tension */
      if (k) { var fx = k * ex / e * dt, fy = k * ey / e * dt; a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy; }
    }
    var x0 = r * 0.55, x1 = w - r * 0.55, y0 = r * 0.55, y1 = h - r * 0.95, moving = 0;
    for (i = 0; i < n; i++) {
      a = p[i]; a.vx *= damp; a.vy *= damp;
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.x < x0) { a.x = x0; a.vx *= -0.3; } else if (a.x > x1) { a.x = x1; a.vx *= -0.3; }
      if (a.y < y0) { a.y = y0; a.vy *= -0.3; } else if (a.y > y1) { a.y = y1; a.vy *= -0.2; a.vx *= 0.96; }
      moving = Math.max(moving, Math.abs(a.vx) + Math.abs(a.vy));
    }
    /* Spike strength: a spring toward how much fluid sits under an engaged magnet. */
    var target = 0;
    if (m && m.f > 0.35) {
      var near = 0;
      for (i = 0; i < n; i++) { var qx = p[i].x - m.x, qy = p[i].y - m.y; near += Math.exp(-(qx * qx + qy * qy) / (2 * 34 * 34)); }
      target = clamp(near / (n * 0.55), 0, 1) * clamp((m.f - 0.35) / 0.65, 0, 1);
    }
    this.Sv += ((target - this.S) * 170 - this.Sv * 16) * dt;
    this.S = clamp(this.S + this.Sv * dt, 0, 1.15);
    this.t += dt;
    return moving + Math.abs(this.Sv) * 40 + Math.abs(this.Fv) * 40;
  };
  /* Spikes: from the clump nearest the magnet, crowning the top of the mound. */
  Ferro.prototype.spikes = function (m) {
    var out = [];
    if (!m || this.S < 0.02) return out;
    var p = this.p, n = p.length, cx = 0, cy = 0, ws = 0, i;
    for (i = 0; i < n; i++) {
      var qx = p[i].x - m.x, qy = p[i].y - m.y, wgt = Math.exp(-(qx * qx + qy * qy) / (2 * 30 * 30));
      cx += p[i].x * wgt; cy += p[i].y * wgt; ws += wgt;
    }
    if (ws < 0.15) return out;
    cx /= ws; cy /= ws;
    var dx = m.x - cx, dy = m.y - cy, dist = Math.sqrt(dx * dx + dy * dy), r = this.r;
    /* the clump under the magnet: which drops belong to it and how far it reaches */
    var near = [], R = r;
    for (i = 0; i < n; i++) {
      var ex = p[i].x - cx, ey = p[i].y - cy, e = Math.sqrt(ex * ex + ey * ey);
      if (e < r * 4.5) { near.push(p[i]); R = Math.max(R, e + r); }
    }
    var g = clamp(dist / (R * 0.8), 0, 1), N = 17;
    /* side view, like ferrofluid on a dish: spikes crown the top of the mound and lean toward
       the magnet; none point down into the pool */
    var th0 = Math.atan2(dy - R * 0.9 * (1 - g), dx), spread = (1 - g) * 3.3 + g * 2.5;
    var L0 = (R * 0.34 + 7) * this.S;
    for (i = 0; i < N; i++) {
      var o = i / (N - 1) - 0.5, th = th0 + spread * o;
      var ux = Math.cos(th), uy = Math.sin(th), Ru = r;
      /* start each spike on the clump's actual surface in its direction, so none is buried */
      for (var j = 0; j < near.length; j++) {
        var qx2 = near[j].x - cx, qy2 = near[j].y - cy, along = qx2 * ux + qy2 * uy, across = Math.abs(qx2 * uy - qy2 * ux);
        if (across < r) Ru = Math.max(Ru, along + Math.sqrt(r * r - across * across));
      }
      var len = L0 * (1 - 0.45 * g * 4 * o * o) * (0.82 + 0.18 * Math.sin(i * 2.399)) * (1 + 0.06 * Math.sin(this.t * 7 + i * 1.7));
      var bx = cx + ux * (Ru - r * 0.3), by = cy + uy * (Ru - r * 0.3);
      out.push({ ax: bx, ay: by, bx: bx + ux * len, by: by + uy * len, ra: Math.max(3.4, r * 0.72), rb: 0.9 });
    }
    return out;
  };
  /* Text to fluid (the floating CTA). this.melt = scroll progress q (0..1) of the hero-to-
     capsule morph. The label and icon are drawn into a mask that the fluid field takes in:
     first as crisp glossy letters (where the HTML label fades out), then blurred, stretched and
     dripped down into the pool, then gone. */
  function sm(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  Ferro.prototype.meltMask = function () {
    var q = this.melt || 0;
    this.sT = q > 0 && q < 1 ? sm(0.02, 0.22, q) * (1 - sm(0.5, 0.82, q)) : 0;
    if (this.sT < 0.002) return null;
    var W = this.fl.width, H = this.fl.height, br = this.btn.getBoundingClientRect();
    if (!br.width) return null;
    if (!this.mc) this.mc = document.createElement('canvas');
    if (this.mc.width !== W || this.mc.height !== H) { this.mc.width = W; this.mc.height = H; }
    var c = this.mc.getContext('2d', { willReadFrequently: true }), k = this.rs * this.w / br.width, kc = this.w / br.width;
    var drip = sm(0.3, 0.82, q), dy = this.h * 0.55 * drip * drip, sy = 1 + 0.7 * drip;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
    c.filter = 'blur(' + ((0.2 + 6 * sm(0.28, 0.8, q)) * this.rs).toFixed(2) + 'px)';
    c.fillStyle = '#000'; c.strokeStyle = '#000';
    var nodes = this.btn.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i], rect;
      if (nd.nodeType !== 1 || nd.tagName === 'CANVAS') continue;
      rect = nd.getBoundingClientRect(); if (!rect.width) continue;
      var lx = (rect.left - br.left) * kc, ly = (rect.top - br.top) * kc;
      if (nd.tagName.toLowerCase() === 'svg') {
        var u = rect.width * kc / 24;
        c.setTransform(k * u, 0, 0, k * u * sy, k * lx, k * (ly * sy + dy));
        c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round';
        for (var j = 0; j < ICON.length; j++) c.stroke(new Path2D(ICON[j]));
        continue;
      }
      var txt = (nd.textContent || '').replace(/\s+/g, ' ').trim(); if (!txt) continue;
      var cs = getComputedStyle(nd);
      c.setTransform(k, 0, 0, k * sy, 0, k * dy);
      c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var mt = c.measureText(txt), fs = parseFloat(cs.fontSize);
      var asc = mt.fontBoundingBoxAscent || fs * 0.8, des = mt.fontBoundingBoxDescent || fs * 0.2;
      c.textBaseline = 'alphabetic';
      c.fillText(txt, lx, ly + (rect.height * kc + asc - des) / 2);
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'none';
    return c.getImageData(0, 0, W, H).data;
  };
  Ferro.prototype.draw = function () {
    if (!this.w) return;
    var F = this.icon ? clamp(this.F, 0, 1) : 0, m = this.magnet(), sp = F > 0.02 ? [] : this.spikes(m), p = this.p, n = p.length;
    var r = this.r * (1 - 0.85 * F), seg = this.seg, rI = F > 0.02 ? this.iu * 1.75 * F : 0, kI = 2 + 5 * (1 - F);
    var RS = this.rs, W = this.fl.width, H = this.fl.height, inv = 1 / RS, data = this.img.data, hg = this.hgt;
    var kB = Math.max(r * 2.3, 2.5), kS = Math.max(2.6, r * 0.62), x, y, i;
    var minY = 1e9;
    for (i = 0; i < n; i++) minY = Math.min(minY, p[i].y);
    for (i = 0; i < sp.length; i++) minY = Math.min(minY, sp[i].by);
    if (rI) for (i = 0; i < seg.length; i++) minY = Math.min(minY, seg[i][1], seg[i][3]);
    var mm = this.icon ? this.meltMask() : null, sT = this.sT || 0;
    if (mm) minY = 0;
    var Y0 = clamp(Math.floor((minY - r * 2.2) * RS), 0, H), Y1 = H;
    data.fill(0); hg.fill(0);
    var D = 6;                                   /* meniscus depth, CSS px */
    for (y = Y0; y < Y1; y++) {
      var py = (y + 0.5) * inv;
      for (x = 0; x < W; x++) {
        var px = (x + 0.5) * inv, d = 1e9;
        for (i = 0; i < n; i++) {
          var ex = px - p[i].x, ey = py - p[i].y, lim = d + kB + r;
          if (ex > lim || ex < -lim || ey > lim || ey < -lim) continue;   /* cannot change d */
          d = smin(d, Math.sqrt(ex * ex + ey * ey) - r, kB);
        }
        if (rI) for (i = 0; i < seg.length; i++) {      /* the glyph, poured */
          var g = seg[i], gx = g[2] - g[0], gy = g[3] - g[1], gl = gx * gx + gy * gy || 1;
          var gh = clamp(((px - g[0]) * gx + (py - g[1]) * gy) / gl, 0, 1), ux = px - g[0] - gx * gh, uy = py - g[1] - gy * gh;
          d = smin(d, Math.sqrt(ux * ux + uy * uy) - rI, kI);
        }
        for (i = 0; i < sp.length; i++) {
          var s = sp[i], vx = s.bx - s.ax, vy = s.by - s.ay, ll = vx * vx + vy * vy || 1;
          var hh = clamp(((px - s.ax) * vx + (py - s.ay) * vy) / ll, 0, 1);
          var qx = px - s.ax - vx * hh, qy = py - s.ay - vy * hh;
          d = smin(d, Math.sqrt(qx * qx + qy * qy) - (s.ra + (s.rb - s.ra) * hh), kS);
        }
        var idx = y * W + x;
        if (mm) { var ma = mm[idx * 4 + 3] / 255; if (ma > 0.02) d = smin(d, (0.5 - ma) * 5 + (1 - sT) * 14, 3); }
        var al = clamp(0.5 - d * RS, 0, 1);
        if (al <= 0) continue;
        var t = clamp(-d / D, 0, 1);
        hg[idx] = D * Math.sqrt(1 - (1 - t) * (1 - t));
        data[idx * 4 + 3] = al * 255;
      }
    }
    /* shade from the height grid */
    var lx = -0.42, ly = -0.72, lz = 0.55, ll2 = Math.sqrt(lx * lx + ly * ly + lz * lz);
    lx /= ll2; ly /= ll2; lz /= ll2;
    var hx = lx, hy = ly, hz = lz + 1, hl = Math.sqrt(hx * hx + hy * hy + hz * hz); hx /= hl; hy /= hl; hz /= hl;
    var mf = m ? m.f : 0;
    for (y = Math.max(Y0, 1); y < Math.min(Y1, H - 1); y++) {
      for (x = 1; x < W - 1; x++) {
        var k = y * W + x;
        if (!data[k * 4 + 3]) continue;
        var gx3 = (hg[k + 1] - hg[k - 1]) * RS * 0.5, gy3 = (hg[k + W] - hg[k - W]) * RS * 0.5;
        var nx = -gx3, ny = -gy3, nz = 1, nl = Math.sqrt(nx * nx + ny * ny + 1); nx /= nl; ny /= nl; nz /= nl;
        var fres = Math.pow(1 - nz, 1.6);
        var sky = clamp((-ny - 0.05) / 0.6, 0, 1);
        var spec = Math.pow(Math.max(nx * hx + ny * hy + nz * hz, 0), 60);
        var gl3 = 0;
        if (mf > 0) {
          var mx = m.x - x * inv, my = m.y - y * inv, mz = 26, ml = Math.sqrt(mx * mx + my * my + mz * mz);
          var gx2 = mx / ml, gy2 = my / ml, gz2 = mz / ml + 1, gl2 = Math.sqrt(gx2 * gx2 + gy2 * gy2 + gz2 * gz2);
          gl3 = Math.pow(Math.max((nx * gx2 + ny * gy2 + nz * gz2) / gl2, 0), 110) * mf;
        }
        var env = (0.1 + 0.6 * sky) * fres;
        var hi = 255 * Math.min(1, spec * 0.95 + gl3 * 0.85);
        data[k * 4] = 8 + 168 * env + hi;          /* neutral reflections: no blue cast */
        data[k * 4 + 1] = 8 + 170 * env + hi;
        data[k * 4 + 2] = 9 + 173 * env + hi;
      }
    }
    this.fl.getContext('2d').putImageData(this.img, 0, 0);
    this.ink();
  };
  /* Light copy of the label, kept only where the fluid is. */
  Ferro.prototype.ink = function () {
    if (this.icon) return;
    var c = this.tx.getContext('2d'), br = this.tx.getBoundingClientRect();
    if (!br.width) return;
    var sx = this.tx.width / br.width, sy = this.tx.height / br.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, this.tx.width, this.tx.height);
    c.fillStyle = INK; c.strokeStyle = INK;
    var nodes = this.btn.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i], rect, cs, txt;
      if (nd.nodeType === 1 && nd.tagName.toLowerCase() === 'svg') {
        rect = nd.getBoundingClientRect(); if (!rect.width) continue;
        var u = rect.width / 24;
        c.setTransform(sx * u, 0, 0, sy * u, (rect.left - br.left) * sx, (rect.top - br.top) * sy);
        c.lineWidth = 2; c.lineCap = 'round'; c.lineJoin = 'round';
        for (var q = 0; q < ICON.length; q++) c.stroke(new Path2D(ICON[q]));
        c.setTransform(1, 0, 0, 1, 0, 0);
        continue;
      }
      if (nd.nodeType === 1 && nd.tagName === 'CANVAS') continue;
      txt = (nd.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt) continue;
      var el = nd.nodeType === 1 ? nd : this.btn;
      if (nd.nodeType === 3) { var rg = document.createRange(); rg.selectNodeContents(nd); rect = rg.getBoundingClientRect(); }
      else rect = nd.getBoundingClientRect();
      if (!rect.width) continue;
      cs = getComputedStyle(el);
      c.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      c.globalAlpha = parseFloat(cs.opacity) || 1;
      var mt = c.measureText(txt), asc = mt.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.8, des = mt.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.2;
      var base = rect.top - br.top + (rect.height + asc - des) / 2;
      c.setTransform(sx, 0, 0, sy, 0, 0);
      c.textBaseline = 'alphabetic';
      c.fillText(txt, rect.left - br.left, base);
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    }
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(this.fl, 0, 0, this.tx.width, this.tx.height);
    c.globalCompositeOperation = 'source-over';
  };

  function near(f) {
    if (performance.now() < f.touchUntil) return true;
    if (!ptr.on) return false;
    var r = f.btn.getBoundingClientRect();
    return ptr.x > r.left - REACH && ptr.x < r.right + REACH && ptr.y > r.top - REACH && ptr.y < r.bottom + REACH;
  }
  function parked(f) { return f.btn.hidden || f.btn.style.visibility === 'hidden'; }
  function wake(f) {
    if (REDUCED || !f.vis || parked(f) || awake.indexOf(f) >= 0) return;
    f.still = 0; awake.push(f);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function tick(now) {
    raf = 0;
    var dt = Math.min((now - last) / 1000, 1 / 30); last = now; frameNo++;
    /* Scroll: scrolling down throws the fluid up, scrolling up throws it down. */
    var sy = window.scrollY || 0, ds = clamp(sy - lastScroll, -160, 160); lastScroll = sy;
    if (ds) for (var a = 0; a < awake.length; a++) {
      var pp = awake[a].p;
      for (var b2 = 0; b2 < pp.length; b2++) { pp[b2].vy -= ds * (7 + (b2 % 3)); pp[b2].vx += ds * ((b2 % 2) ? 0.8 : -0.8); }
    }
    for (var i = awake.length - 1; i >= 0; i--) {
      var f = awake[i], m = f.magnet(), steps = Math.max(1, Math.round(dt * 240)), mv = 0;
      for (var s = 0; s < steps; s++) mv = f.step(dt / steps, m);
      /* near the pointer: every frame; drifting alone: every other frame */
      if (near(f) || mv > 400 || frameNo % 2 === 0) f.draw();
      if (!f.vis || parked(f)) awake.splice(i, 1);
    }
    if (awake.length) raf = requestAnimationFrame(tick);
  }

  function scan() {
    var list = document.querySelectorAll('.btn-primary');
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b._ferro) continue;
      if (!b.clientWidth) continue;
      b._ferro = new Ferro(b); all.push(b._ferro); b._ferro.draw();
    }
    /* A button that stopped being primary (the hero swaps for Mac visitors) loses its pool. */
    for (var j = all.length - 1; j >= 0; j--) {
      var f = all[j];
      if (!f.btn.isConnected || !f.btn.classList.contains('btn-primary')) {
        if (f.fl.parentNode) f.fl.remove(); if (f.tx.parentNode) f.tx.remove();
        f.btn.classList.remove('ferro'); f.btn._ferro = null; all.splice(j, 1);
        var k = awake.indexOf(f); if (k >= 0) awake.splice(k, 1);
      }
    }
  }

  document.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true;
    for (var i = 0; i < all.length; i++) if (near(all[i])) wake(all[i]);
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', function () { ptr.on = false; });
  window.addEventListener('blur', function () { ptr.on = false; });

  var pending = 0;
  function later(recs) {
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i];
      if (r.type === 'childList' ? r.target.closest && !r.target.closest('svg') : r.target.classList && r.target.classList.contains('btn')) {
        if (!pending) pending = setTimeout(function () { pending = 0; scan(); }, 60);
        return;
      }
    }
  }
  if (window.MutationObserver) new MutationObserver(later).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { all.forEach(function (f) { f.draw(); }); });
  /* the floating CTA un-parks buttons by script; it calls this so they start moving again */
  window.__ferroWake = function (b) { if (b) wake(b); };
  scan();
})();
