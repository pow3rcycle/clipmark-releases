/* ClipMark site: dock, theme, release data and the "stage" showcases.
   Every showcase is a pure function of time (render(t)), drawn in SVG with the app's
   scene tokens (CSS classes in studio.css). Draw-on marks trace their real stroke path;
   reduced motion renders each scene's settled end frame and never starts a loop.
   No dependencies, no trackers. */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var ICONS = 'assets/icons.svg#i-';
  var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function E(tag, a, p) {
    var e = document.createElementNS(NS, tag);
    if (a) for (var k in a) if (a[k] !== undefined && a[k] !== null) e.setAttribute(k, a[k]);
    if (p) p.appendChild(e);
    return e;
  }
  function S(e, a) { for (var k in a) e.setAttribute(k, a[k]); return e; }
  function T(e, s) { if (e.textContent !== s) e.textContent = s; return e; }
  function clamp(v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return v < a ? a : v > b ? b : v; }
  function seg(t, a, b) { return clamp((t - a) / (b - a)); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function eo(p) { return 1 - Math.pow(1 - p, 3); }
  function eio(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function pop(p) { var c = 1.7; return p <= 0 ? 0 : 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }
  function op(e, o) { o = clamp(o); e.setAttribute('opacity', o.toFixed(3)); e.style.display = o <= 0.001 ? 'none' : ''; }
  function tr(e, x, y, s, r) {
    var v = 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')';
    if (r) v += ' rotate(' + r.toFixed(2) + ')';
    if (s != null && s !== 1) v += ' scale(' + s.toFixed(3) + ')';
    e.setAttribute('transform', v);
  }
  function f1(n) { return n.toFixed(1); }

  /* Interpolate a position along keyed points: [[t, x, y], ...], eased between keys. */
  function track(t, k) {
    if (t <= k[0][0]) return [k[0][1], k[0][2]];
    for (var i = 1; i < k.length; i++) {
      if (t <= k[i][0]) {
        var p = eio(seg(t, k[i - 1][0], k[i][0]));
        return [lerp(k[i - 1][1], k[i][1], p), lerp(k[i - 1][2], k[i][2], p)];
      }
    }
    var l = k[k.length - 1];
    return [l[1], l[2]];
  }
  function pressedAt(t, times) { for (var i = 0; i < times.length; i++) if (t >= times[i] && t < times[i] + 140) return true; return false; }

  /* Draw-on along the element's real path length. */
  function drawOn(e, p) {
    if (!e._L) { try { e._L = e.getTotalLength() || 1; } catch (x) { e._L = 1000; } }
    e.setAttribute('stroke-dasharray', f1(e._L) + ' ' + f1(e._L + 2));
    e.setAttribute('stroke-dashoffset', f1(e._L * (1 - clamp(p))));
    e.style.display = p <= 0 ? 'none' : '';
  }
  function pointAt(e, p) {
    if (!e._L) { try { e._L = e.getTotalLength() || 1; } catch (x) { e._L = 1; } }
    var q = e.getPointAtLength(e._L * clamp(p));
    return [q.x, q.y];
  }

  /* Deterministic random + smooth closed/open curves for the hand-drawn look. */
  function rnd(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; }; }
  function smooth(pts, closed) {
    var n = pts.length, d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
    for (var i = 0; i < (closed ? n : n - 1); i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      if (!closed) { p0 = pts[Math.max(i - 1, 0)]; p3 = pts[Math.min(i + 2, n - 1)]; }
      d += ' C' + f1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' +
        f1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
    }
    return d;
  }
  function roughEllipse(cx, cy, rx, ry, seed, amp) {
    var r = rnd(seed), pts = [], n = 16;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 - 0.4, k = 1 + (r() - 0.5) * amp;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    pts.push([pts[0][0] + 6, pts[0][1] - 3]); /* overshoot past the start, like a pen */
    return smooth(pts, false);
  }
  function roughRect(x, y, w, h, seed, amp) {
    var r = rnd(seed); function j() { return (r() - 0.5) * 2 * amp; }
    var c = [[x + j(), y + j()], [x + w + j(), y + j()], [x + w + j(), y + h + j()], [x + j(), y + h + j()], [x + j() + 3, y + j() - 2]];
    var d = 'M' + f1(c[0][0]) + ' ' + f1(c[0][1]);
    for (var i = 1; i < c.length; i++) {
      var a = c[i - 1], b = c[i];
      d += ' Q' + f1((a[0] + b[0]) / 2 + j()) + ' ' + f1((a[1] + b[1]) / 2 + j()) + ' ' + f1(b[0]) + ' ' + f1(b[1]);
    }
    return d;
  }

  /* ---------------- scene primitives ---------------- */
  var uid = 0;
  function makeSvg(host, w, h) {
    var svg = E('svg', { viewBox: '0 0 ' + w + ' ' + h, 'class': 'scene', role: 'img', 'aria-hidden': 'true', focusable: 'false' });
    host.insertBefore(svg, host.firstChild);
    var id = 'k' + (++uid), d = E('defs', null, svg);
    var f = E('filter', { id: id + 'sh', x: '-20%', y: '-20%', width: '140%', height: '150%' }, d);
    E('feDropShadow', { dx: 0, dy: 6, stdDeviation: 10, 'class': 'sh-flood' }, f);
    var b = E('filter', { id: id + 'bl', x: '-10%', y: '-30%', width: '120%', height: '160%' }, d);
    E('feGaussianBlur', { stdDeviation: 5 }, b);
    return { svg: svg, defs: d, id: id, shadow: 'url(#' + id + 'sh)', blur: 'url(#' + id + 'bl)', w: w, h: h, n: 0 };
  }
  function nid(c, s) { return c.id + s + (++c.n); }
  function clip(c, x, y, w, h, rx) {
    var id = nid(c, 'c'), cp = E('clipPath', { id: id }, c.defs);
    return { url: 'url(#' + id + ')', rect: E('rect', { x: x, y: y, width: w, height: h, rx: rx || 0 }, cp), el: cp };
  }
  function icon(p, name, x, y, size, cls) {
    var g = E('g', { 'class': cls || 's-icon-g', transform: 'translate(' + x + ' ' + y + ')' }, p);
    E('use', { href: ICONS + name, width: size, height: size, 'class': 's-icon' }, g);
    return g;
  }
  function text(p, x, y, s, size, cls, weight, anchor) {
    var e = E('text', { x: x, y: y, 'font-size': size || 14, 'class': cls || 's-text', 'font-weight': weight || 400, 'text-anchor': anchor || 'start' }, p);
    e.textContent = s;
    return e;
  }

  /* An app window: body, title bar, the app's min / max / close glyphs. */
  function win(p, c, x, y, w, h, o) {
    o = o || {};
    var g = E('g', { transform: 'translate(' + x + ' ' + y + ')' }, p);
    E('rect', { width: w, height: h, rx: 10, 'class': 's-win', filter: o.flat ? null : c.shadow }, g);
    E('path', { d: 'M0 10a10 10 0 0 1 10-10h' + (w - 20) + 'a10 10 0 0 1 10 10v18h-' + w + 'z', 'class': 's-title' }, g);
    var gx = w - 64;
    E('path', { d: 'M' + gx + ' 14.5h9', 'class': 's-glyph' }, g);
    E('rect', { x: gx + 21, y: 10, width: 9, height: 9, rx: 1.5, 'class': 's-glyph' }, g);
    E('path', { d: 'M' + (gx + 42) + ' 10l9 9M' + (gx + 51) + ' 10l-9 9', 'class': 's-glyph' }, g);
    if (o.title) text(g, 14, 18.5, o.title, 12, 's-text3', 500);
    else E('rect', { x: 14, y: 11, width: o.titleW || 64, height: 6, rx: 3, 'class': 's-line-strong' }, g);
    var body = E('g', { transform: 'translate(0 28)' }, g);
    return { g: g, body: body, x: x, y: y, w: w, h: h - 28 };
  }
  /* Generic page: heading, two lines, three tiles (sky / sage / sand). */
  function page(b, w, h, o) {
    o = o || {};
    if (o.title) text(b, 20, 31, o.title, 16, 's-text', 700);
    else E('rect', { x: 20, y: 18, width: w * 0.32, height: 9, rx: 4.5, 'class': 's-line-strong' }, b);
    if (o.sub) text(b, 20, 50, o.sub, 12, 's-text3');
    else {
      E('rect', { x: 20, y: 40, width: w * 0.56, height: 6, rx: 3, 'class': 's-line' }, b);
      E('rect', { x: 20, y: 52, width: w * 0.42, height: 6, rx: 3, 'class': 's-line' }, b);
    }
    var tw = (w - 40 - 24) / 3, ty = 70, th = Math.max(h - ty - 20, 30);
    var tiles = ['s-sky', 's-sage', 's-sand'].map(function (k, i) {
      var r = E('rect', { x: 20 + i * (tw + 12), y: ty, width: tw, height: th, rx: 6, 'class': k }, b);
      if (o.tiles && th > 40) text(b, 32 + i * (tw + 12), ty + 24, o.tiles[i], 12, 's-text', 600);
      return r;
    });
    return { tiles: tiles, tw: tw, ty: ty, th: th };
  }
  function cursor(p) {
    var g = E('g', { 'class': 'cur' }, p), inner = E('g', null, g);
    E('path', { d: 'M0 0V18.5L4.6 14.1 7.7 21.2 10.6 20 7.5 13H14Z', 'class': 's-cursor' }, inner);
    return { g: g, inner: inner };
  }
  function crosshair(p) {
    var g = E('g', null, p);
    E('path', { d: 'M-11 0H-3M3 0H11M0 -11V-3M0 3V11', 'class': 's-cross-o' }, g);
    E('path', { d: 'M-11 0H-3M3 0H11M0 -11V-3M0 3V11', 'class': 's-cross' }, g);
    return g;
  }
  function putCur(c, xy, press) { tr(c.g, xy[0], xy[1]); c.inner.setAttribute('transform', press ? 'scale(0.86)' : ''); }
  function keycaps(p, x, y, labels) {
    var g = E('g', { transform: 'translate(' + x + ' ' + y + ')' }, p), keys = [], cx = 0;
    labels.forEach(function (l) {
      var w = l.length > 1 ? 58 : 40, k = E('g', { transform: 'translate(' + cx + ' 0)' }, g);
      E('rect', { width: w, height: 40, rx: 9, 'class': 's-key', filter: null }, k);
      text(k, w / 2, 25.5, l, 14, 's-text', 600, 'middle');
      keys.push(k); cx += w + 8;
    });
    return { g: g, keys: keys, w: cx - 8 };
  }
  function toast(p, c, x, y, label, iconName) {
    var g = E('g', { transform: 'translate(' + x + ' ' + y + ')' }, p);
    var w = 32 + label.length * 7.6 + 26;
    E('rect', { x: -w / 2, y: -20, width: w, height: 40, rx: 12, 'class': 's-surface s-ring-f', filter: c.shadow }, g);
    icon(g, iconName, -w / 2 + 14, -9, 18, 's-accent-icon');
    text(g, -w / 2 + 40, 5, label, 14, 's-text', 500);
    return g;
  }
  /* Recording pill, as in the app: dot + timer | mic | system audio | webcam. */
  function recPill(p, x, y) {
    var g = E('g', { transform: 'translate(' + x + ' ' + y + ')' }, p);
    E('rect', { x: 0, y: 0, width: 220, height: 44, rx: 22, 'class': 's-recbar' }, g);
    var dot = E('circle', { cx: 24, cy: 22, r: 6, 'class': 's-accent' }, g);
    var time = text(g, 38, 27.5, '0:00', 14, 's-rec-text', 600);
    E('path', { d: 'M90 12V32', 'class': 's-rec-div' }, g);
    var mic = icon(g, 'Mute', 104, 13, 18, 's-rec-off-g');
    var sys = icon(g, 'SystemAudio', 140, 13, 18, 's-rec-off-g');
    var cam = icon(g, 'Webcam', 176, 13, 18, 's-rec-off-g');
    return { g: g, dot: dot, time: time, mic: mic, sys: sys, cam: cam };
  }
  function setIcon(g, name) { var u = g.firstChild; var h = ICONS + name; if (u.getAttribute('href') !== h) u.setAttribute('href', h); }
  function plate(p, x, y, n) {
    var g = E('g', { transform: 'translate(' + x + ' ' + y + ')' }, p);
    E('circle', { r: 14, 'class': 's-accent-solid' }, g);
    text(g, 0, 5, String(n), 14, 's-on-accent-text', 700, 'middle');
    return g;
  }
  function flash(p, c) { return E('rect', { x: 0, y: 0, width: c.w, height: c.h, 'class': 's-flash' }, p); }

  /* Editor frame shared by the Annotate scenes. Tools mirror the editor's dock. */
  var TOOLS = ['Select', 'Rectangle', 'Arrow', 'Bubble', 'Counter', 'Highlighter', 'Blur', 'Spotlight', 'Pen'];
  function editor(p, c, x, y, w, h) {
    var wn = win(p, c, x, y, w, h, { title: 'ClipMark Editor' });
    var tbW = TOOLS.length * 34 + 8, tbX = (w - tbW) / 2;
    var tb = E('g', { transform: 'translate(' + tbX + ' 10)' }, wn.body);
    E('rect', { width: tbW, height: 38, rx: 12, 'class': 's-surface s-ring-f' }, tb);
    var sel = E('rect', { x: 4, y: 4, width: 30, height: 30, rx: 9, 'class': 's-dock-sel' }, tb);
    var icons = TOOLS.map(function (n, i) { return icon(tb, n, 10 + i * 34, 10, 18, 's-tool-g'); });
    var cy = 58, ch = wn.h - cy - 12;
    E('rect', { x: 12, y: cy, width: w - 24, height: ch, rx: 8, 'class': 's-editor' }, wn.body);
    var ox = x, oy = y + 28;
    return {
      win: wn, body: wn.body, canvas: { x: 12, y: cy, w: w - 24, h: ch },
      toolXY: function (i) { return [ox + tbX + 4 + i * 34 + 15, oy + 10 + 19]; },
      tool: function (i) {
        sel.setAttribute('x', 4 + i * 34);
        icons.forEach(function (g, k) { g.setAttribute('class', k === i ? 's-tool-g on' : 's-tool-g'); });
      },
      abs: function (bx, by) { return [ox + bx, oy + by]; }
    };
  }
  /* A captured "page" image placed on an editor canvas. Returns its group and box. */
  function shot(p, x, y, w, h) {
    var g = E('g', { transform: 'translate(' + x + ' ' + y + ')' }, p);
    E('rect', { width: w, height: h, rx: 4, 'class': 's-win', filter: null }, g);
    return { g: g, x: x, y: y, w: w, h: h };
  }

  /* ---------------- HERO: the whole flow ---------------- */
  function heroScene(L, c) {
    var W = c.w, H = c.h;
    /* Desktop: a browser with a checkout form. */
    var pageWin = win(L, c, 70, 50, 700, 500, { title: 'Checkout' });
    var content = E('g', { id: nid(c, 'pg') }, pageWin.body);
    function pageContent(b) {
      text(b, 36, 52, 'Checkout', 24, 's-text', 700);
      E('rect', { x: 36, y: 66, width: 210, height: 6, rx: 3, 'class': 's-line' }, b);
      var card = E('g', { transform: 'translate(36 92)' }, b);
      E('rect', { width: 360, height: 326, rx: 12, 'class': 's-surface s-ring-f' }, card);
      text(card, 22, 36, 'Email', 13, 's-text3', 500);
      E('rect', { x: 22, y: 46, width: 316, height: 40, rx: 8, 'class': 's-sunken' }, card);
      text(card, 36, 71.5, 'name@example.com', 15, 's-text2');
      text(card, 22, 116, 'Shipping', 13, 's-text3', 500);
      E('rect', { x: 22, y: 126, width: 316, height: 40, rx: 8, 'class': 's-sunken' }, card);
      text(card, 36, 151.5, '14 Harbour Road', 15, 's-text2');
      E('rect', { x: 22, y: 186, width: 150, height: 40, rx: 8, 'class': 's-sunken' }, card);
      text(card, 36, 211.5, 'Boston', 15, 's-text2');
      E('rect', { x: 188, y: 186, width: 150, height: 40, rx: 8, 'class': 's-sunken' }, card);
      text(card, 202, 211.5, '02110', 15, 's-text2');
      E('rect', { x: 22, y: 254, width: 316, height: 46, rx: 10, 'class': 's-accent-solid' }, card);
      text(card, 180, 282.5, 'Place order', 15, 's-on-accent-text', 600, 'middle');
      var sum = E('g', { transform: 'translate(420 92)' }, b);
      E('rect', { width: 244, height: 210, rx: 12, 'class': 's-surface s-ring-f' }, sum);
      [['Desk lamp', '$48.00'], ['USB-C cable', '$12.00'], ['Notebook', '$9.50']].forEach(function (it, i) {
        E('rect', { x: 20, y: 26 + i * 36, width: 40, height: 26, rx: 6, 'class': ['s-sky', 's-sage', 's-sand'][i] }, sum);
        text(sum, 72, 44 + i * 36, it[0], 14, 's-text', 500);
        text(sum, 224, 44 + i * 36, it[1], 14, 's-text2', 400, 'end');
      });
      E('rect', { x: 20, y: 140, width: 204, height: 1, 'class': 's-line' }, sum);
      text(sum, 20, 174, 'Total', 15, 's-text', 600);
      text(sum, 224, 174, '$69.50', 15, 's-text', 700, 'end');
    }
    pageContent(content);
    /* page-body coordinates -> stage coordinates */
    var PX = 70, PY = 78;

    /* Capture overlay */
    var dim = E('path', { 'class': 's-dim', 'fill-rule': 'evenodd' }, L);
    var mq = E('rect', { 'class': 's-marquee-solid' }, L);
    var tag = E('g', null, L), tagBg = E('rect', { height: 24, rx: 7, 'class': 's-tag' }, tag), tagT = text(tag, 0, 0, '', 12, 's-tag-text', 600, 'middle');
    var fl = flash(L, c);

    /* Region captured, in page-body coords */
    var R = { x: 22, y: 70, w: 400, h: 366 };
    var RA = { x: PX + R.x, y: PY + R.y };

    /* Thumbnail card with the captured image + drain bar + actions */
    var thumb = E('g', null, L);
    var tw = 240, th = 210;
    E('rect', { width: tw, height: th, rx: 14, 'class': 's-surface s-ring-f', filter: c.shadow }, thumb);
    var tcl = clip(c, 0, 0, tw - 24, 150, 6);
    var tImg = E('g', { transform: 'translate(12 12)', 'clip-path': tcl.url }, thumb);
    E('rect', { width: tw - 24, height: 150, 'class': 's-win' }, tImg);
    var tUse = E('use', { href: '#' + content.id }, tImg);
    var ks = (tw - 24) / R.w;
    tUse.setAttribute('transform', 'scale(' + ks.toFixed(4) + ') translate(' + (-R.x) + ' ' + (-R.y) + ')');
    var acts = ['Pen', 'Copy', 'Ocr', 'Pin', 'Save'];
    var actG = acts.map(function (n, i) {
      var g = E('g', { transform: 'translate(' + (18 + i * 42) + ' 170)' }, thumb);
      E('rect', { width: 34, height: 28, rx: 8, 'class': 's-act-bg' }, g);
      icon(g, n, 8, 5, 18, 's-tool-g');
      return g;
    });
    var drain = E('rect', { x: 0, y: th - 3, height: 3, rx: 1.5, 'class': 's-accent' }, thumb);

    /* Editor */
    var edG = E('g', null, L);
    var ed = editor(edG, c, 150, 26, 900, 588);
    var annId = nid(c, 'ann'), ann = E('g', { id: annId }, ed.body);
    var scale = 1.18, imgW = R.w * scale, imgH = R.h * scale;
    var ix = (900 - imgW) / 2, iy = ed.canvas.y + (ed.canvas.h - imgH) / 2;
    var imgG = E('g', { transform: 'translate(' + f1(ix) + ' ' + f1(iy) + ')' }, ann);
    var icl = clip(c, 0, 0, R.w, R.h, 0);
    var inner = E('g', { transform: 'scale(' + scale + ')' }, imgG);
    var innerClip = E('g', { 'clip-path': icl.url }, inner);
    E('rect', { width: R.w, height: R.h, 'class': 's-win' }, innerClip);
    E('use', { href: '#' + content.id, transform: 'translate(' + (-R.x) + ' ' + (-R.y) + ')' }, innerClip);
    /* image-local (region) coords -> editor body coords */
    function I(x, y) { return [ix + x * scale, iy + y * scale]; }
    function A(x, y) { var b = I(x, y); return ed.abs(b[0], b[1]); }
    /* Marks (in editor body coords) */
    var marks = E('g', null, ann);
    var emailBox = { x: 36 + 22 - R.x + 0, y: 92 + 46 - R.y, w: 200, h: 40 }; /* region coords of the email text area */
    var bl = clip(c, 0, 0, 0, 0, 4);
    var blurG = E('g', { 'clip-path': bl.url }, marks);
    var bOrigin = I(emailBox.x + 8, emailBox.y + 6);
    E('rect', { x: f1(bOrigin[0]), y: f1(bOrigin[1]), width: f1(184 * scale), height: f1(28 * scale), 'class': 's-sunken' }, blurG);
    var blurText = text(blurG, 0, 0, 'name@example.com', 15 * scale, 's-text2');
    var bt = I(36 + 36 - R.x, 92 + 71.5 - R.y); S(blurText, { x: f1(bt[0]), y: f1(bt[1]), filter: c.blur });
    /* Arrow: from the open canvas right of the image into the button's right end. */
    var btnR = I(36 + 22 + 316 - R.x + 8, 92 + 254 + 23 - R.y);
    var aS = I(R.w + 92, 92 + 254 + 23 - R.y - 118);
    var arrowPath = E('path', { d: 'M' + f1(aS[0]) + ' ' + f1(aS[1]) + ' C' + f1(aS[0] + 6) + ' ' + f1(aS[1] + 86) + ' ' + f1(btnR[0] + 96) + ' ' + f1(btnR[1] + 4) + ' ' + f1(btnR[0] + 30) + ' ' + f1(btnR[1]), 'class': 's-mark' }, marks);
    var head = E('path', { d: 'M-15 -9L0 0L-15 9', 'class': 's-mark' }, marks);
    var p1xy = I(36 + 22 - R.x + 316 - 6, 92 + 46 - R.y + 20), p2xy = I(36 + 22 - R.x + 316 - 6, 92 + 254 - R.y + 23);
    var plate1 = plate(marks, p1xy[0], p1xy[1], 1), plate2 = plate(marks, p2xy[0], p2xy[1], 2);
    var bub = E('g', null, marks), bubXY = [aS[0] - 150, aS[1] - 92];
    var bubBox = E('path', { d: 'M0 0h200a12 12 0 0 1 12 12v30a12 12 0 0 1-12 12H40l-16 16v-16H12A12 12 0 0 1 0 42V12A12 12 0 0 1 12 0z', 'class': 's-bubble' }, bub);
    var bubText = text(bub, 16, 33, '', 16, 's-text', 600);
    var BUB = 'Button does nothing';
    var ec = cursor(edG);

    /* Copy: keycaps + toast */
    var copyKeys = keycaps(L, W / 2 - 53, H - 92, ['Ctrl', 'C']);
    var copied = toast(L, c, W / 2, H - 132, 'Copied to clipboard', 'ClipboardCheck');

    /* Chat */
    var chat = E('g', null, L);
    var cw = win(chat, c, 0, 0, 380, 520, { title: 'Team chat' });
    var cb = cw.body;
    function bubbleIn(y, msg, mine) {
      var w = 30 + msg.length * 7.1;
      var g = E('g', { transform: 'translate(' + f1(mine ? 380 - 20 - w : 20) + ' ' + y + ')' }, cb);
      E('rect', { width: f1(w), height: 38, rx: 12, 'class': mine ? 's-dock-sel' : 's-surface2' }, g);
      text(g, 15, 24, msg, 13.5, 's-text');
      return g;
    }
    bubbleIn(26, 'Checkout fails for some people', false); bubbleIn(76, 'Looking now', true);
    var sent = E('g', null, cb);
    E('rect', { x: 0, y: 0, width: 340, height: 300, rx: 14, 'class': 's-dock-sel' }, sent);
    var sentImg = E('g', { transform: 'translate(10 10)' }, sent);
    var scl = clip(c, 0, 0, 320, 252, 8);
    var sentClip = E('g', { 'clip-path': scl.url }, sentImg);
    E('rect', { width: 320, height: 252, 'class': 's-editor' }, sentClip);
    /* The pasted image is the whole annotated result: screenshot plus every mark. */
    var bx0 = ix - 10, bx1 = Math.max(bubXY[0] + 214, aS[0] + 20) + 10, by0 = Math.min(iy, bubXY[1]) - 10, by1 = iy + imgH + 10;
    var ss = Math.min(320 / (bx1 - bx0), 252 / (by1 - by0));
    E('use', { href: '#' + annId, transform: 'translate(' + f1((320 - (bx1 - bx0) * ss) / 2) + ' ' + f1((252 - (by1 - by0) * ss) / 2) + ') scale(' + ss.toFixed(4) + ') translate(' + f1(-bx0) + ' ' + f1(-by0) + ')' }, sentClip);
    text(sent, 12, 284, 'Found it. The button does nothing.', 13.5, 's-text');
    E('rect', { x: 20, y: 440, width: 340, height: 40, rx: 12, 'class': 's-sunken' }, cb);
    var pasteKeys = keycaps(L, W / 2 - 53, H - 92, ['Ctrl', 'V']);

    var cur = cursor(L), cross = crosshair(L);

    /* Tool click times (editor) */
    var ARROW = 2, COUNTER = 4, BLUR = 6, BUBBLE = 3;

    function render(t) {
      /* ---- 0: capture ---- */
      var start = [RA.x, RA.y], end = [RA.x + R.w, RA.y + R.h];
      var dragP = eio(seg(t, 1000, 2200));
      var cx = lerp(start[0], end[0], dragP), cy = lerp(start[1], end[1], dragP);
      var inCapture = t < 2300;
      var dimO = t < 1000 ? 0 : t < 2200 ? seg(t, 1000, 1150) * 0.32 / 0.32 : 1 - seg(t, 2200, 2350);
      if (t >= 1000 && t < 2350) {
        op(dim, dimO);
        var hx = Math.min(start[0], cx), hy = Math.min(start[1], cy), hw = Math.abs(cx - start[0]), hh = Math.abs(cy - start[1]);
        S(dim, { d: 'M0 0H' + W + 'V' + H + 'H0Z M' + f1(hx) + ' ' + f1(hy) + 'h' + f1(hw) + 'v' + f1(hh) + 'h' + f1(-hw) + 'Z' });
        op(mq, t < 2300 ? 1 : 0); S(mq, { x: f1(hx), y: f1(hy), width: f1(hw), height: f1(hh) });
        var label = Math.round(hw * 2) + ' × ' + Math.round(hh * 2);
        op(tag, hw > 30 ? 1 : 0); T(tagT, label);
        var lw = 16 + label.length * 7.2;
        S(tagBg, { x: f1(-lw / 2), y: -17, width: f1(lw) }); S(tagT, { x: 0, y: -0.5 });
        tr(tag, hx + hw / 2, hy + hh + 26);
      } else { op(dim, 0); op(mq, 0); op(tag, 0); }
      op(fl, t >= 2200 && t < 2550 ? (1 - seg(t, 2200, 2550)) * 0.55 : 0);

      /* ---- thumbnail ---- */
      var thIn = eo(seg(t, 2350, 2800)), thOut = seg(t, 3450, 3700);
      if (t >= 2350 && t < 3700) {
        op(thumb, 1 - thOut);
        tr(thumb, lerp(W + 10, W - tw - 72, thIn), H - th - 40);
        S(drain, { width: f1(tw * (1 - seg(t, 2800, 6800))) });
        actG.forEach(function (g, i) { g.firstChild.setAttribute('class', i === 0 && t > 3150 ? 's-act-bg on' : 's-act-bg'); });
      } else op(thumb, 0);

      /* ---- editor ---- */
      var edIn = seg(t, 3450, 3800), edOut = seg(t, 8600, 8950);
      var edO = t < 3450 ? 0 : t < 8600 ? edIn : 1 - edOut;
      op(edG, edO);
      if (edO > 0) {
        tr(edG, 0, 0, 1);
        var tool = t < 4000 ? 0 : t < 5250 ? ARROW : t < 6250 ? COUNTER : t < 7050 ? BLUR : BUBBLE;
        ed.tool(tool);
        /* arrow */
        var ap = eio(seg(t, 4150, 4900));
        drawOn(arrowPath, ap);
        var ae = pointAt(arrowPath, 1), ab = pointAt(arrowPath, 0.97);
        op(head, seg(t, 4850, 4950));
        tr(head, ae[0], ae[1], 1, Math.atan2(ae[1] - ab[1], ae[0] - ab[0]) * 180 / Math.PI);
        /* plates */
        var s1 = pop(seg(t, 5450, 5700)), s2 = pop(seg(t, 5850, 6100));
        op(plate1, s1 > 0 ? 1 : 0); tr(plate1, p1xy[0], p1xy[1], Math.max(s1, 0.001));
        op(plate2, s2 > 0 ? 1 : 0); tr(plate2, p2xy[0], p2xy[1], Math.max(s2, 0.001));
        /* blur, the drag reveals it */
        var bp = eio(seg(t, 6350, 6900));
        S(bl.rect, { x: f1(bOrigin[0]), y: f1(bOrigin[1]), width: f1(184 * scale * bp), height: f1(28 * scale) });
        op(blurG, bp > 0 ? 1 : 0);
        /* bubble */
        var bubP = pop(seg(t, 7150, 7400));
        op(bub, bubP > 0 ? 1 : 0); tr(bub, bubXY[0], bubXY[1], Math.max(bubP, 0.001));
        T(bubText, BUB.slice(0, Math.round(BUB.length * seg(t, 7300, 7750))));
        /* editor cursor */
        var arrowCur = pointAt(arrowPath, ap);
        var ex;
        if (t < 4150) ex = track(t, [[3800, 760, 520], [3990, ed.toolXY(ARROW)[0], ed.toolXY(ARROW)[1]], [4140, ed.abs(aS[0], aS[1])[0], ed.abs(aS[0], aS[1])[1]]]);
        else if (t < 4950) ex = ed.abs(arrowCur[0], arrowCur[1]);
        else if (t < 6300) ex = track(t, [[4950, ed.abs(ae[0], ae[1])[0], ed.abs(ae[0], ae[1])[1]], [5200, ed.toolXY(COUNTER)[0], ed.toolXY(COUNTER)[1]], [5420, ed.abs(p1xy[0], p1xy[1])[0], ed.abs(p1xy[0], p1xy[1])[1]], [5820, ed.abs(p2xy[0], p2xy[1])[0], ed.abs(p2xy[0], p2xy[1])[1]], [6200, ed.toolXY(BLUR)[0], ed.toolXY(BLUR)[1]], [6340, ed.abs(bOrigin[0], bOrigin[1])[0], ed.abs(bOrigin[0], bOrigin[1])[1]]]);
        else if (t < 6950) { var bx = bOrigin[0] + 184 * scale * bp, by = bOrigin[1] + 28 * scale * Math.min(bp * 1.4, 1); ex = ed.abs(bx, by); }
        else ex = track(t, [[6950, ed.abs(bOrigin[0] + 184 * scale, bOrigin[1] + 28 * scale)[0], ed.abs(bOrigin[0] + 184 * scale, bOrigin[1] + 28 * scale)[1]], [7040, ed.toolXY(BUBBLE)[0], ed.toolXY(BUBBLE)[1]], [7140, ed.abs(bubXY[0] + 10, bubXY[1] + 10)[0], ed.abs(bubXY[0] + 10, bubXY[1] + 10)[1]], [8400, ed.abs(bubXY[0] + 60, bubXY[1] + 120)[0], ed.abs(bubXY[0] + 60, bubXY[1] + 120)[1]]]);
        putCur(ec, ex, pressedAt(t, [3990, 5200, 5450, 5850, 6200, 7040, 7150]) || (t > 4150 && t < 4900) || (t > 6350 && t < 6900));
        op(ec.g, t < 3800 ? 0 : 1);
      }

      /* ---- copy ---- */
      var ck = t >= 7850 && t < 8700;
      op(copyKeys.g, ck ? Math.min(seg(t, 7850, 7950), 1 - seg(t, 8550, 8700)) : 0);
      copyKeys.keys.forEach(function (k, i) { tr(k, i === 0 ? 0 : 66, t > 8000 + i * 120 && t < 8350 ? 3 : 0); });
      op(copied, t >= 8150 && t < 8750 ? Math.min(seg(t, 8150, 8250), 1 - seg(t, 8600, 8750)) : 0);

      /* ---- paste ---- */
      var chIn = eo(seg(t, 8700, 9150)), chOut = seg(t, 12600, 13100);
      if (t >= 8700) { op(chat, 1 - chOut); tr(chat, lerp(W + 20, 760, chIn), 60); } else op(chat, 0);
      var pk = t >= 9300 && t < 10100;
      op(pasteKeys.g, pk ? Math.min(seg(t, 9300, 9400), 1 - seg(t, 9950, 10100)) : 0);
      pasteKeys.keys.forEach(function (k, i) { tr(k, i === 0 ? 0 : 66, t > 9450 + i * 120 && t < 9800 ? 3 : 0); });
      var sp = pop(seg(t, 9700, 10000));
      op(sent, sp > 0 ? 1 : 0); tr(sent, 380 - 20 - 340 * Math.max(sp, 0.001), 128, Math.max(sp, 0.001));

      /* page fades back in for the loop */
      op(pageWin.g, t < 8700 ? 1 : t < 12600 ? 1 : 1);

      /* ---- desktop cursor ---- */
      var dk = track(t, [[200, W - 120, H - 40], [950, RA.x, RA.y]]);
      if (t >= 1000 && t < 2300) dk = [cx, cy];
      if (t >= 2300) dk = track(t, [[2300, end[0], end[1]], [3100, W - tw - 72 + 18 + 17, H - th - 40 + 170 + 14]]);
      var useCross = t >= 800 && t < 2300;
      op(cross, useCross && t < 2300 ? 1 : 0); tr(cross, dk[0], dk[1]);
      op(cur.g, !useCross && t < 3500 ? 1 : 0); putCur(cur, dk, pressedAt(t, [3250]));
    }
    return {
      dur: 13600, settle: 7900, render: render,
      phase: function (t) { return t < 3450 ? 0 : t < 7850 ? 1 : t < 8700 ? 2 : 3; }
    };
  }

  /* ---------------- CAPTURE ---------------- */
  var CAPTURE = {
    region: function (L, c) {
      var w = win(L, c, 70, 44, 500, 330); page(w.body, 500, 302, { title: 'Release plan', sub: 'Three teams, one launch date', tiles: ['Design', 'Build', 'Launch'] });
      var dim = E('path', { 'class': 's-dim', 'fill-rule': 'evenodd' }, L);
      var mq = E('rect', { 'class': 's-marquee-solid' }, L);
      var tag = E('g', null, L), tagBg = E('rect', { height: 22, rx: 6, 'class': 's-tag' }, tag), tagT = text(tag, 0, -1, '', 11, 's-tag-text', 600, 'middle');
      var fl = flash(L, c), cross = crosshair(L);
      var a = [150, 118], b = [452, 330];
      return {
        dur: 4600, settle: 3000, render: function (t) {
          var p = eio(seg(t, 900, 2300)), x = lerp(a[0], b[0], p), y = lerp(a[1], b[1], p);
          var on = t >= 900;
          op(dim, on ? (t < 2400 ? seg(t, 900, 1000) : 1 - seg(t, 2400, 2550)) : 0);
          S(dim, { d: 'M0 0H640V420H0Z M' + a[0] + ' ' + a[1] + 'H' + f1(x) + 'V' + f1(y) + 'H' + a[0] + 'Z' });
          op(mq, on ? 1 : 0); S(mq, { x: a[0], y: a[1], width: f1(x - a[0]), height: f1(y - a[1]) });
          var label = Math.round((x - a[0]) * 2) + ' × ' + Math.round((y - a[1]) * 2), lw = 14 + label.length * 6.6;
          op(tag, on && t < 2400 && x - a[0] > 40 ? 1 : 0); T(tagT, label); S(tagBg, { x: f1(-lw / 2), y: -15, width: f1(lw) });
          tr(tag, (a[0] + x) / 2, y + 22);
          op(fl, t >= 2350 && t < 2700 ? (1 - seg(t, 2350, 2700)) * 0.5 : 0);
          var k = track(t, [[0, 560, 390], [850, a[0], a[1]]]);
          if (t > 900) k = [x, y];
          tr(cross, k[0], k[1]); op(cross, t < 2400 ? 1 : 0);
        }
      };
    },
    window: function (L, c) {
      var A = win(L, c, 40, 36, 330, 236); page(A.body, 330, 208, { title: 'Inbox', tiles: ['Today', 'Earlier', 'Later'] });
      var B = win(L, c, 236, 130, 360, 256); page(B.body, 360, 228, { title: 'Design review', sub: 'Comments due Friday', tiles: ['Header', 'Cards', 'Footer'] });
      var ring = E('rect', { rx: 12, 'class': 's-ring-accent' }, L);
      var fl = flash(L, c), cur = cursor(L);
      var ra = [36, 32, 338, 244], rb = [232, 126, 368, 264];
      return {
        dur: 4400, settle: 3000, render: function (t) {
          var k = track(t, [[0, 600, 400], [700, 150, 90], [1600, 150, 100], [2200, 470, 300]]);
          var onB = t >= 2000, p = eio(seg(t, 1900, 2200));
          var r = onB ? ra.map(function (v, i) { return lerp(v, rb[i], p); }) : ra;
          op(ring, t >= 650 ? 1 : 0); S(ring, { x: f1(r[0]), y: f1(r[1]), width: f1(r[2]), height: f1(r[3]) });
          op(fl, t >= 2600 && t < 2950 ? (1 - seg(t, 2600, 2950)) * 0.5 : 0);
          putCur(cur, k, pressedAt(t, [2550]));
        }
      };
    },
    scroll: function (L, c) {
      var w = win(L, c, 40, 30, 360, 360);
      var vh = 332, cl = clip(c, 0, 0, 360, vh, 0);
      var vp = E('g', { 'clip-path': cl.url }, w.body);
      var tallId = nid(c, 'tall'), tall = E('g', { id: tallId }, vp);
      var y = 18, rows = ['s-sky', 's-sage', 's-sand', 's-sky', 's-sage', 's-sand'];
      E('rect', { width: 360, height: 1000, 'class': 's-win' }, tall);
      var heads = ['Changelog', 'Version 2.8', 'Version 2.7.6', 'Version 2.7.5', 'Version 2.7.4', 'Version 2.7.3'];
      for (var i = 0; i < 6; i++) {
        text(tall, 20, y + 10, heads[i], i ? 14 : 18, 's-text', 700);
        E('rect', { x: 20, y: y + 18, width: 300, height: 6, rx: 3, 'class': 's-line' }, tall);
        E('rect', { x: 20, y: y + 30, width: 240, height: 6, rx: 3, 'class': 's-line' }, tall);
        E('rect', { x: 20, y: y + 48, width: 320, height: 90, rx: 6, 'class': rows[i] }, tall);
        y += 160;
      }
      var thumb = E('rect', { x: 350, width: 4, rx: 2, height: 60, 'class': 's-line-strong' }, w.body);
      /* stitched strip */
      var sx = 440, sy = 30, sw = 150, sc = sw / 360;
      var strip = E('g', { transform: 'translate(' + sx + ' ' + sy + ')' }, L);
      var scl = clip(c, 0, 0, sw, 10, 8);
      var sbg = E('rect', { width: sw, height: 10, rx: 8, 'class': 's-surface s-ring-f', filter: c.shadow }, strip);
      var sg = E('g', { 'clip-path': scl.url }, strip);
      E('use', { href: '#' + tallId, transform: 'scale(' + sc.toFixed(4) + ')' }, sg);
      var seam = E('rect', { x: 0, width: sw, height: 2, 'class': 's-accent' }, strip);
      var maxS = 1000 - vh;
      return {
        dur: 5600, settle: 4400, render: function (t) {
          /* scroll in ticks, like the wheel */
          var p = 0, ticks = 5;
          for (var i = 0; i < ticks; i++) p += eo(seg(t, 700 + i * 650, 700 + i * 650 + 420)) / ticks;
          var s = p * maxS;
          tall.setAttribute('transform', 'translate(0 ' + f1(-s) + ')');
          S(thumb, { y: f1(6 + p * (vh - 72)) });
          var hgt = Math.min((vh + s) * sc, 360);
          S(scl.rect, { height: f1(hgt) }); S(sbg, { height: f1(hgt) });
          S(seam, { y: f1(hgt - 2) }); op(seam, t > 600 && t < 4200 ? 1 : 0);
        }
      };
    },
    delay: function (L, c) {
      var w = win(L, c, 70, 44, 500, 330); page(w.body, 500, 302, { title: 'Dashboard', sub: 'Updated a moment ago', tiles: ['Visitors', 'Sign-ups', 'Revenue'] });
      var g = E('g', { transform: 'translate(320 210)' }, L);
      E('circle', { r: 54, 'class': 's-plate' }, g);
      var num = text(g, 0, 20, '3', 56, 's-numeral-text', 700, 'middle');
      var fl = flash(L, c);
      var frame = E('rect', { x: 150, y: 118, width: 302, height: 212, 'class': 's-marquee-solid' }, L);
      var badge = E('g', { transform: 'translate(452 118)' }, L);
      E('circle', { r: 16, 'class': 's-accent-solid' }, badge);
      icon(badge, 'CaptureRepeat', -9, -9, 18, 's-on-accent-g');
      return {
        dur: 5200, settle: 3600, render: function (t) {
          var n = t < 1300 ? 3 : t < 2100 ? 2 : t < 2900 ? 1 : 0;
          var since = n === 3 ? t - 500 : n === 2 ? t - 1300 : t - 2100;
          op(g, t >= 500 && t < 2900 ? 1 : 0);
          T(num, String(n || 1)); tr(g, 320, 210, 0.85 + 0.15 * pop(clamp(since / 260)));
          op(fl, t >= 2900 && t < 3250 ? (1 - seg(t, 2900, 3250)) * 0.55 : 0);
          var fp = seg(t, 3300, 3600);
          op(frame, fp); op(badge, fp); tr(badge, 452, 118, Math.max(pop(fp), 0.001));
        }
      };
    },
    after: function (L, c) {
      var w = win(L, c, 40, 30, 440, 300); page(w.body, 440, 272, { title: 'Sprint board', tiles: ['To do', 'Doing', 'Done'] });
      var card = E('g', null, L), cw = 236, chh = 196;
      E('rect', { width: cw, height: chh, rx: 14, 'class': 's-surface s-ring-f', filter: c.shadow }, card);
      var img = E('g', { transform: 'translate(12 12)' }, card);
      E('rect', { width: cw - 24, height: 120, rx: 6, 'class': 's-win' }, img);
      E('rect', { x: 14, y: 14, width: 80, height: 7, rx: 3.5, 'class': 's-line-strong' }, img);
      ['s-sky', 's-sage', 's-sand'].forEach(function (k, i) { E('rect', { x: 14 + i * 62, y: 34, width: 54, height: 72, rx: 5, 'class': k }, img); });
      var names = ['Edit', 'Copy', 'OCR', 'Pin', 'Save'], icons = ['Pen', 'Copy', 'Ocr', 'Pin', 'Save'];
      var acts = icons.map(function (n, i) {
        var g = E('g', { transform: 'translate(' + (12 + i * 43) + ' 142)' }, card);
        E('rect', { width: 38, height: 32, rx: 9, 'class': 's-act-bg' }, g);
        icon(g, n, 10, 7, 18, 's-tool-g');
        return g;
      });
      var drain = E('rect', { x: 0, y: chh - 3, height: 3, 'class': 's-accent' }, card);
      var tip = E('g', null, L), tipBg = E('rect', { height: 24, rx: 7, y: -16, 'class': 's-tag' }, tip), tipT = text(tip, 0, 0, '', 12, 's-tag-text', 600, 'middle');
      var cur = cursor(L);
      var X = 640 - cw - 64, Y = 420 - chh - 30;
      return {
        dur: 6200, settle: 2200, render: function (t) {
          var p = eo(seg(t, 200, 650));
          tr(card, lerp(660, X, p), Y);
          S(drain, { width: f1(cw * (1 - seg(t, 650, 6000))) });
          var idx = t < 1500 ? -1 : Math.min(4, Math.floor((t - 1500) / 800));
          acts.forEach(function (g, i) { g.firstChild.setAttribute('class', i === idx ? 's-act-bg on' : 's-act-bg'); });
          var ax = X + 12 + Math.max(idx, 0) * 43 + 19, ay = Y + 142 + 16;
          var k = t < 1500 ? track(t, [[600, 300, 380], [1450, X + 31, ay + 6]]) : track(t, [[1500 + Math.max(idx, 0) * 800, ax, ay + 6], [1500 + Math.max(idx, 0) * 800 + 300, ax, ay + 6]]);
          putCur(cur, k, false);
          op(tip, idx >= 0 ? 1 : 0);
          if (idx >= 0) { var s = names[idx], lw = 18 + s.length * 7; T(tipT, s); S(tipBg, { x: f1(-lw / 2), width: f1(lw) }); tr(tip, ax, Y - 18 + 160 - 160 + 0 - 4 + 0 + 0); tr(tip, ax, Y + 142 - 14); }
        }
      };
    }
  };

  /* ---------------- ANNOTATE ---------------- */
  function annotBase(L, c) {
    var ed = editor(L, c, 24, 18, 592, 384);
    var cv = ed.canvas, sh = shot(ed.body, cv.x + 30, cv.y + 22, cv.w - 60, cv.h - 44);
    return { ed: ed, sh: sh, cur: cursor(L) };
  }
  function abs(b, x, y) { return b.ed.abs(b.sh.x + x, b.sh.y + y); }
  var ANNOTATE = {
    arrow: function (L, c) {
      var b = annotBase(L, c), s = b.sh;
      page(s.g, s.w, s.h, { title: 'Onboarding', sub: 'Step 2 of 3', tiles: ['Profile', 'Team', 'Invite'] });
      var m = s.g, ARR = 2;
      var curved = E('path', { d: 'M60 230 C 90 140, 170 110, 250 120', 'class': 's-mark' }, m);
      var head1 = E('path', { d: 'M-14 -8L0 0L-14 8', 'class': 's-mark' }, m);
      var elbow = E('path', { d: 'M300 60 H 420 V 150', 'class': 's-mark' }, m);
      var head2 = E('path', { d: 'M-14 -8L0 0L-14 8', 'class': 's-mark' }, m);
      function headAt(h, path, p) { var e = pointAt(path, 1), q = pointAt(path, 0.96); op(h, p); tr(h, e[0], e[1], 1, Math.atan2(e[1] - q[1], e[0] - q[0]) * 180 / Math.PI); }
      return {
        dur: 5000, settle: 3600, render: function (t) {
          b.ed.tool(t < 500 ? 0 : ARR);
          var p1 = eio(seg(t, 700, 1700)), p2 = eio(seg(t, 2200, 3200));
          drawOn(curved, p1); headAt(head1, curved, seg(t, 1650, 1750));
          drawOn(elbow, p2); headAt(head2, elbow, seg(t, 3150, 3250));
          var k;
          if (t < 700) k = track(t, [[0, 560, 380], [450, b.ed.toolXY(ARR)[0], b.ed.toolXY(ARR)[1]], [650, abs(b, 60, 230)[0], abs(b, 60, 230)[1]]]);
          else if (t < 1750) { var q = pointAt(curved, p1); k = abs(b, q[0], q[1]); }
          else if (t < 2200) k = track(t, [[1750, abs(b, 250, 120)[0], abs(b, 250, 120)[1]], [2150, abs(b, 300, 60)[0], abs(b, 300, 60)[1]]]);
          else if (t < 3250) { var q2 = pointAt(elbow, p2); k = abs(b, q2[0], q2[1]); }
          else k = track(t, [[3250, abs(b, 420, 150)[0], abs(b, 420, 150)[1]], [4200, abs(b, 470, 220)[0], abs(b, 470, 220)[1]]]);
          putCur(b.cur, k, pressedAt(t, [480]) || (t > 700 && t < 1700) || (t > 2200 && t < 3200));
        }
      };
    },
    steps: function (L, c) {
      var b = annotBase(L, c), s = b.sh, pg = page(s.g, s.w, s.h, { title: 'Set up your account', tiles: ['Sign in', 'Pick a plan', 'Invite'] }), CNT = 4;
      var spots = [[20 + pg.tw / 2, pg.ty + 30], [20 + pg.tw * 1.5 + 12, pg.ty + 60], [20 + pg.tw * 2.5 + 24, pg.ty + 30]];
      var plates = spots.map(function (p, i) { return plate(s.g, p[0], p[1], i + 1); });
      var times = [1000, 1700, 2400];
      return {
        dur: 4600, settle: 3000, render: function (t) {
          b.ed.tool(t < 500 ? 0 : CNT);
          plates.forEach(function (g, i) { var p = pop(seg(t, times[i], times[i] + 260)); op(g, p > 0 ? 1 : 0); tr(g, spots[i][0], spots[i][1], Math.max(p, 0.001)); });
          var keys = [[0, 560, 380], [450, b.ed.toolXY(CNT)[0], b.ed.toolXY(CNT)[1]]];
          spots.forEach(function (p, i) { var a = abs(b, p[0], p[1]); keys.push([times[i] - 30, a[0], a[1]]); });
          keys.push([3600, abs(b, 480, 230)[0], abs(b, 480, 230)[1]]);
          putCur(b.cur, track(t, keys), pressedAt(t, [480].concat(times)));
        }
      };
    },
    highlight: function (L, c) {
      var b = annotBase(L, c), s = b.sh, HL = 5;
      var lines = [[40, 50, 300], [40, 92, 380], [40, 134, 340], [40, 176, 260], [40, 218, 360]];
      text(s.g, 40, 34, 'Release notes', 16, 's-text', 700);
      var hl = E('rect', { rx: 3, 'class': 's-hl' }, s.g);
      lines.forEach(function (l) { E('rect', { x: l[0], y: l[1], width: l[2], height: 10, rx: 5, 'class': 's-line-strong' }, s.g); });
      var hl2 = E('rect', { rx: 3, 'class': 's-hl' }, s.g);
      return {
        dur: 4600, settle: 3400, render: function (t) {
          b.ed.tool(t < 500 ? 0 : HL);
          var p = eio(seg(t, 900, 1900)), x = 36 + 388 * p;
          op(hl, p > 0 ? 1 : 0); S(hl, { x: 34, y: 85, width: f1(x - 34), height: 24 });
          var p2 = eio(seg(t, 2300, 3100)), x2 = 36 + 268 * p2;
          op(hl2, p2 > 0 ? 1 : 0); S(hl2, { x: 34, y: 169, width: f1(x2 - 34), height: 24 });
          var k;
          if (t < 900) k = track(t, [[0, 560, 380], [450, b.ed.toolXY(HL)[0], b.ed.toolXY(HL)[1]], [850, abs(b, 36, 104)[0], abs(b, 36, 104)[1]]]);
          else if (t < 1950) k = abs(b, x, 104 + Math.sin(p * 9) * 5);
          else if (t < 2300) k = track(t, [[1950, abs(b, 424, 104)[0], abs(b, 424, 104)[1]], [2250, abs(b, 36, 186)[0], abs(b, 36, 186)[1]]]);
          else if (t < 3150) k = abs(b, x2, 186 + Math.sin(p2 * 7) * 6);
          else k = track(t, [[3150, abs(b, 304, 186)[0], abs(b, 304, 186)[1]], [4000, abs(b, 420, 250)[0], abs(b, 420, 250)[1]]]);
          putCur(b.cur, k, pressedAt(t, [480]) || (t > 900 && t < 1900) || (t > 2300 && t < 3100));
        }
      };
    },
    blur: function (L, c) {
      var b = annotBase(L, c), s = b.sh, BL = 6;
      text(s.g, 40, 40, 'Account', 16, 's-text', 700);
      function field(y, label, value) {
        text(s.g, 40, y, label, 12, 's-text3', 500);
        E('rect', { x: 40, y: y + 10, width: 340, height: 40, rx: 8, 'class': 's-sunken' }, s.g);
        return text(s.g, 54, y + 35.5, value, 15, 's-text2');
      }
      field(70, 'Email', 'name@example.com');
      field(150, 'Card', '4242 4242 4242 4242');
      var cl1 = clip(c, 0, 0, 0, 0, 4), g1 = E('g', { 'clip-path': cl1.url }, s.g);
      E('rect', { x: 46, y: 84, width: 220, height: 32, 'class': 's-sunken' }, g1);
      S(text(g1, 54, 105.5, 'name@example.com', 15, 's-text2'), { filter: c.blur });
      var cl2 = clip(c, 0, 0, 0, 0, 2), g2 = E('g', { 'clip-path': cl2.url }, s.g);
      E('rect', { x: 46, y: 164, width: 204, height: 32, 'class': 's-sunken' }, g2);
      var r = rnd(7);
      for (var yy = 164; yy < 196; yy += 8) for (var xx = 46; xx < 250; xx += 8) {
        E('rect', { x: xx, y: yy, width: 8, height: 8, 'class': r() > 0.5 ? 's-px-a' : 's-px-b' }, g2);
      }
      return {
        dur: 4800, settle: 3500, render: function (t) {
          b.ed.tool(t < 500 ? 0 : BL);
          var p1 = eio(seg(t, 900, 1700)), p2 = eio(seg(t, 2200, 3000));
          S(cl1.rect, { x: 46, y: 84, width: f1(220 * p1), height: 32 }); op(g1, p1 > 0 ? 1 : 0);
          S(cl2.rect, { x: 46, y: 164, width: f1(204 * p2), height: 32 }); op(g2, p2 > 0 ? 1 : 0);
          var k;
          if (t < 900) k = track(t, [[0, 560, 380], [450, b.ed.toolXY(BL)[0], b.ed.toolXY(BL)[1]], [850, abs(b, 46, 84)[0], abs(b, 46, 84)[1]]]);
          else if (t < 1750) k = abs(b, 46 + 220 * p1, 84 + 32 * Math.min(p1 * 2, 1));
          else if (t < 2200) k = track(t, [[1750, abs(b, 266, 116)[0], abs(b, 266, 116)[1]], [2150, abs(b, 46, 164)[0], abs(b, 46, 164)[1]]]);
          else if (t < 3050) k = abs(b, 46 + 204 * p2, 164 + 32 * Math.min(p2 * 2, 1));
          else k = track(t, [[3050, abs(b, 250, 196)[0], abs(b, 250, 196)[1]], [4000, abs(b, 440, 250)[0], abs(b, 440, 250)[1]]]);
          putCur(b.cur, k, pressedAt(t, [480]) || (t > 900 && t < 1700) || (t > 2200 && t < 3000));
        }
      };
    },
    spot: function (L, c) {
      var b = annotBase(L, c), s = b.sh, SP = 7;
      var imgId = nid(c, 'sp'), img = E('g', { id: imgId }, s.g);
      var pg = page(img, s.w, s.h, { title: 'Pricing', tiles: ['Free', 'Team', 'Business'] });
      var cx = 20 + pg.tw * 1.5 + 12, cy = pg.ty + pg.th / 2;
      var dim = E('path', { 'class': 's-dim', 'fill-rule': 'evenodd' }, s.g);
      var ring = E('ellipse', { cx: cx, cy: cy, rx: pg.tw / 2 + 18, ry: pg.th / 2 + 18, 'class': 's-spot-ring' }, s.g);
      var lcl = clip(c, 0, 0, 0, 0, 0); lcl.el.removeChild(lcl.rect);
      var lc = E('circle', { r: 50 }, lcl.el);
      var lz = E('g', { 'clip-path': lcl.url }, s.g);
      E('rect', { width: s.w, height: s.h, 'class': 's-win' }, lz);
      var lu = E('use', { href: '#' + imgId }, lz);
      var lring = E('circle', { r: 50, 'class': 's-loupe-ring', filter: c.shadow }, s.g);
      return {
        dur: 6000, settle: 2200, render: function (t) {
          b.ed.tool(t < 500 ? 0 : SP);
          var d = t < 3000 ? seg(t, 800, 1200) : 1 - seg(t, 3000, 3300);
          op(dim, d); op(ring, d);
          var rx = pg.tw / 2 + 18, ry = pg.th / 2 + 18;
          S(dim, { d: 'M0 0H' + s.w + 'V' + s.h + 'H0Z M' + f1(cx - rx) + ' ' + cy + 'a' + rx + ' ' + ry + ' 0 1 0 ' + f1(rx * 2) + ' 0a' + rx + ' ' + ry + ' 0 1 0 ' + f1(-rx * 2) + ' 0Z' });
          var lp = seg(t, 3300, 3600) * (1 - seg(t, 5600, 5900));
          var lx = lerp(120, 400, eio(seg(t, 3500, 5400))), ly = 150 + Math.sin(t / 500) * 30;
          op(lz, lp); op(lring, lp);
          S(lc, { cx: f1(lx), cy: f1(ly) }); S(lring, { cx: f1(lx), cy: f1(ly) });
          lu.setAttribute('transform', 'translate(' + f1(lx) + ' ' + f1(ly) + ') scale(2) translate(' + f1(-lx) + ' ' + f1(-ly) + ')');
          var k = t < 800 ? track(t, [[0, 560, 380], [450, b.ed.toolXY(SP)[0], b.ed.toolXY(SP)[1]], [780, abs(b, cx, cy)[0], abs(b, cx, cy)[1]]]) :
            t < 3300 ? abs(b, cx + 30, cy + 40) : abs(b, lx + 36, ly + 36);
          putCur(b.cur, k, pressedAt(t, [480, 790]));
        }
      };
    },
    text: function (L, c) {
      var b = annotBase(L, c), s = b.sh, pg = page(s.g, s.w, s.h, { title: 'Weekly report', tiles: ['Mon', 'Wed', 'Fri'] }), TX = 3;
      var bub = E('g', null, s.g), bx = 40 + pg.tw * 1.5, by = pg.ty - 46;
      E('path', { d: 'M0 0h168a12 12 0 0 1 12 12v24a12 12 0 0 1-12 12H44l-14 14v-14H12A12 12 0 0 1 0 36V12A12 12 0 0 1 12 0z', 'class': 's-bubble' }, bub);
      var bt = text(bub, 16, 30, '', 16, 's-text', 600);
      var lab = text(s.g, 30, s.h - 26, '', 18, 's-accent-text', 700);
      var S1 = 'Start here', S2 = 'Saved automatically';
      return {
        dur: 5000, settle: 3800, render: function (t) {
          b.ed.tool(t < 500 ? 0 : TX);
          var p = pop(seg(t, 900, 1150));
          op(bub, p > 0 ? 1 : 0); tr(bub, bx, by, Math.max(p, 0.001));
          T(bt, S1.slice(0, Math.round(S1.length * seg(t, 1150, 1800))));
          T(lab, S2.slice(0, Math.round(S2.length * seg(t, 2500, 3500))));
          var k = track(t, [[0, 560, 380], [450, b.ed.toolXY(TX)[0], b.ed.toolXY(TX)[1]], [880, abs(b, bx + 6, by + 6)[0], abs(b, bx + 6, by + 6)[1]], [2300, abs(b, 30, s.h - 44)[0], abs(b, 30, s.h - 44)[1]], [4200, abs(b, 300, s.h - 60)[0], abs(b, 300, s.h - 60)[1]]]);
          putCur(b.cur, k, pressedAt(t, [480, 900, 2350]));
        }
      };
    },
    sketch: function (L, c) {
      var b = annotBase(L, c), s = b.sh, pg = page(s.g, s.w, s.h, { title: 'Homepage draft', tiles: ['Hero', 'Features', 'Footer'] }), PEN = 8;
      var rx = 20 + pg.tw + 12 - 8, ry = pg.ty - 8, rw = pg.tw + 16, rh = pg.th + 16;
      var r1 = E('path', { d: roughRect(rx, ry, rw, rh, 11, 4), 'class': 's-mark s-sketch' }, s.g);
      var r2 = E('path', { d: roughRect(rx, ry, rw, rh, 29, 4), 'class': 's-mark s-sketch' }, s.g);
      var e1 = E('path', { d: roughEllipse(20 + pg.tw / 2, 30, 110, 24, 5, 0.08), 'class': 's-mark s-sketch' }, s.g);
      return {
        dur: 5200, settle: 4000, render: function (t) {
          b.ed.tool(t < 500 ? 1 : PEN);
          var p1 = eio(seg(t, 800, 1700)), p2 = eio(seg(t, 1700, 2400)), p3 = eio(seg(t, 2700, 3700));
          drawOn(r1, p1); drawOn(r2, p2); drawOn(e1, p3);
          var k, q;
          if (t < 800) k = track(t, [[0, 560, 380], [450, b.ed.toolXY(1)[0], b.ed.toolXY(1)[1]], [780, abs(b, rx, ry)[0], abs(b, rx, ry)[1]]]);
          else if (t < 1700) { q = pointAt(r1, p1); k = abs(b, q[0], q[1]); }
          else if (t < 2400) { q = pointAt(r2, p2); k = abs(b, q[0], q[1]); }
          else if (t < 2700) k = track(t, [[2400, abs(b, rx, ry)[0], abs(b, rx, ry)[1]], [2680, abs(b, 20 + pg.tw / 2 + 102, 22)[0], abs(b, 20 + pg.tw / 2 + 102, 22)[1]]]);
          else if (t < 3750) { q = pointAt(e1, p3); k = abs(b, q[0], q[1]); }
          else k = track(t, [[3750, abs(b, 200, 40)[0], abs(b, 200, 40)[1]], [4600, abs(b, 460, 230)[0], abs(b, 460, 230)[1]]]);
          putCur(b.cur, k, pressedAt(t, [480]) || (t > 800 && t < 2400) || (t > 2700 && t < 3700));
        }
      };
    }
  };

  /* ---------------- RECORD ---------------- */
  function recBase(L, c) {
    var w = win(L, c, 50, 22, 540, 316); var pg = page(w.body, 540, 288, { title: 'Product tour', sub: 'Recording the new sharing flow', tiles: ['Open', 'Edit', 'Share'] });
    var frame = E('rect', { x: 44, y: 16, width: 552, height: 328, rx: 13, 'class': 's-rec-frame' }, L);
    var pill = recPill(L, 210, 356);
    return { w: w, pg: pg, frame: frame, pill: pill, cur: cursor(L) };
  }
  function clock(pill, t, t0) {
    var s = Math.max(0, Math.floor((t - t0) / 1000));
    T(pill.time, Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60));
    pill.dot.setAttribute('opacity', (0.55 + 0.45 * Math.cos((t - t0) / 260)).toFixed(2));
  }
  var RECORD = {
    region: function (L, c) {
      var b = recBase(L, c);
      return {
        dur: 6200, settle: 3000, render: function (t) {
          clock(b.pill, t, 0);
          putCur(b.cur, [300 + Math.sin(t / 900) * 160, 190 + Math.sin(t / 650) * 70], false);
        }
      };
    },
    clicks: function (L, c) {
      var b = recBase(L, c);
      var pts = [[170, 150], [330, 250], [470, 140], [260, 280]];
      var rings = pts.map(function () { return [E('circle', { 'class': 's-ripple' }, L), E('circle', { 'class': 's-ripple' }, L)]; });
      L.appendChild(b.cur.g);
      var T0 = [600, 1700, 2800, 3900];
      return {
        dur: 5200, settle: 1950, render: function (t) {
          clock(b.pill, t, 0);
          var keys = [[0, 560, 300]]; pts.forEach(function (p, i) { keys.push([T0[i] - 40, p[0], p[1]]); keys.push([T0[i] + 300, p[0], p[1]]); });
          putCur(b.cur, track(t, keys), pressedAt(t, T0));
          rings.forEach(function (pair, i) {
            pair.forEach(function (r, j) {
              var p = seg(t, T0[i] + j * 160, T0[i] + j * 160 + 600);
              op(r, p > 0 && p < 1 ? 1 - p : 0); S(r, { cx: pts[i][0], cy: pts[i][1], r: f1(5 + 26 * eo(p)) });
            });
          });
        }
      };
    },
    cam: function (L, c) {
      var b = recBase(L, c);
      var cam = E('g', null, L), ccl = clip(c, -52, -52, 104, 104, 52);
      var face = E('g', { 'clip-path': ccl.url }, cam);
      E('rect', { x: -52, y: -52, width: 104, height: 104, 'class': 's-cam-bg' }, face);
      E('ellipse', { cx: 0, cy: 62, rx: 48, ry: 34, 'class': 's-cam-shirt' }, face);
      E('rect', { x: -9, y: 10, width: 18, height: 18, 'class': 's-cam-skin' }, face);
      E('circle', { cx: 0, cy: -6, r: 22, 'class': 's-cam-skin' }, face);
      E('path', { d: 'M-23 -6c0-17 10-27 23-27s24 9 23 27c-5-10-13-14-23-14s-18 4-23 14z', 'class': 's-cam-hair' }, face);
      E('circle', { r: 52, 'class': 's-cam-ring', filter: c.shadow }, cam);
      return {
        dur: 5000, settle: 1600, render: function (t) {
          clock(b.pill, t, 0);
          var p = pop(seg(t, 400, 800));
          op(cam, p > 0 ? 1 : 0); tr(cam, 520, 262 + Math.sin(t / 700) * 1.5, Math.max(p, 0.001));
          setIcon(b.pill.cam, 'Webcam'); b.pill.cam.setAttribute('class', t > 400 ? 's-rec-on-g' : 's-rec-off-g');
          putCur(b.cur, [240 + Math.sin(t / 1100) * 90, 180 + Math.cos(t / 800) * 50], false);
        }
      };
    },
    audio: function (L, c) {
      var b = recBase(L, c);
      var meter = E('g', { transform: 'translate(406 368)' }, L);
      E('rect', { x: -8, y: -6, width: 70, height: 32, rx: 10, 'class': 's-recbar' }, meter);
      var bars = [0, 1, 2, 3, 4, 5].map(function (i) { return E('rect', { x: i * 9, width: 5, rx: 2.5, 'class': 's-meter' }, meter); });
      return {
        dur: 5200, settle: 2000, render: function (t) {
          clock(b.pill, t, 0);
          var on = t > 500;
          setIcon(b.pill.mic, on ? 'Mic' : 'Mute');
          b.pill.mic.setAttribute('class', on ? 's-rec-on-g' : 's-rec-off-g');
          b.pill.sys.setAttribute('class', t > 900 ? 's-rec-on-g' : 's-rec-off-g');
          op(meter, seg(t, 500, 700));
          bars.forEach(function (r, i) {
            var lv = Math.abs(Math.sin(t / 170 + i * 1.3) * Math.sin(t / 430 + i * 0.7));
            var h = 4 + 16 * lv * (on ? 1 : 0);
            S(r, { y: f1(10 - h / 2), height: f1(h) });
          });
          putCur(b.cur, [300, 200], false); op(b.cur.g, 0);
        }
      };
    },
    save: function (L, c) {
      var b = recBase(L, c);
      function file(cls, ink, label) {
        var g = E('g', null, L);
        E('rect', { width: 96, height: 116, rx: 12, 'class': cls, filter: c.shadow }, g);
        E('path', { d: 'M66 0v22a8 8 0 0 0 8 8h22', 'class': 's-fold' }, g);
        text(g, 48, 82, label, 20, ink, 700, 'middle');
        return g;
      }
      var mp4 = file('s-png', 's-png-ink-t', 'MP4'), gif = file('s-jpg', 's-jpg-ink-t', 'GIF');
      var sel = E('rect', { width: 108, height: 128, rx: 16, 'class': 's-ring-accent' }, L);
      L.appendChild(b.cur.g);
      return {
        dur: 5000, settle: 2600, render: function (t) {
          clock(b.pill, Math.min(t, 1200), 0);
          var p = eo(seg(t, 900, 1500));
          op(b.frame, 1 - seg(t, 800, 1100));
          tr(mp4, lerp(270, 196, p), lerp(360, 150, p)); op(mp4, seg(t, 900, 1100));
          tr(gif, lerp(270, 348, p), lerp(360, 150, p)); op(gif, seg(t, 900, 1100));
          var pick = t > 2400 ? 1 : t > 1900 ? 0 : -1;
          op(sel, pick >= 0 ? 1 : 0); S(sel, { x: pick === 1 ? 342 : 190, y: 144 });
          putCur(b.cur, track(t, [[0, 500, 300], [1800, 250, 230], [2300, 405, 232]]), pressedAt(t, [1850, 2350]));
        }
      };
    }
  };

  /* ---------------- WHITEBOARD (1200 x 460) ---------------- */
  function board(L, c) {
    var W = c.w, H = c.h;
    E('rect', { x: 24, y: 24, width: W - 48, height: H - 48, rx: 14, 'class': 's-board', filter: c.shadow }, L);
    var pid = nid(c, 'dots'), pat = E('pattern', { id: pid, width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, c.defs);
    E('circle', { cx: 12, cy: 12, r: 1.3, 'class': 's-dot' }, pat);
    E('rect', { x: 24, y: 24, width: W - 48, height: H - 48, rx: 14, fill: 'url(#' + pid + ')' }, L);
    var tools = ['Select', 'Rectangle', 'Arrow', 'Pen', 'Text', 'InsertImage'];
    var tb = E('g', { transform: 'translate(' + (W / 2 - (tools.length * 34 + 8) / 2) + ' 40)' }, L);
    E('rect', { width: tools.length * 34 + 8, height: 38, rx: 12, 'class': 's-surface s-ring-f' }, tb);
    var sel = E('rect', { x: 4, y: 4, width: 30, height: 30, rx: 9, 'class': 's-dock-sel' }, tb);
    var ic = tools.map(function (n, i) { return icon(tb, n, 10 + i * 34, 10, 18, 's-tool-g'); });
    return { tool: function (i) { sel.setAttribute('x', 4 + i * 34); ic.forEach(function (g, k) { g.setAttribute('class', k === i ? 's-tool-g on' : 's-tool-g'); }); } };
  }
  function card(p, c, w, h, name) {
    var g = E('g', null, p), wn = win(g, c, 0, 0, w, h, { title: name });
    page(wn.body, w, h - 28, { title: name, tiles: CARD_TILES[name] });
    return g;
  }
  var CARD_TILES = { Login: ['Email', 'Password', 'Sign in'], Checkout: ['Cart', 'Address', 'Pay'], Receipt: ['Order', 'Total', 'Email'] };
  var WHITEBOARD = {
    place: function (L, c) {
      var bd = board(L, c);
      var cards = [[150, 120, 280, 200, -6, 'Login'], [480, 150, 260, 190, 4, 'Checkout'], [800, 110, 280, 210, -3, 'Receipt']].map(function (d) { var g = card(L, c, d[2], d[3], d[5]); g._d = d; return g; });
      var ul = E('path', { d: roughEllipse(610, 248, 170, 125, 3, 0.07), 'class': 's-mark s-sketch' }, L);
      return {
        dur: 5600, settle: 3800, render: function (t) {
          bd.tool(t < 2400 ? 5 : 3);
          cards.forEach(function (g, i) {
            var d = g._d, p = eo(seg(t, 300 + i * 450, 900 + i * 450));
            op(g, p > 0 ? 1 : 0); tr(g, d[0], lerp(d[1] + 90, d[1], p), 1, lerp(d[4] * 2.5, 0, p));
          });
          drawOn(ul, eio(seg(t, 2600, 3600)));
        }
      };
    },
    connect: function (L, c) {
      var bd = board(L, c);
      var A = card(L, c, 280, 200, 'Login'), B = card(L, c, 280, 200, 'Checkout');
      tr(A, 170, 140);
      var line = E('path', { 'class': 's-connector' }, L);
      var a1 = E('circle', { r: 6, 'class': 's-anchor' }, L), a2 = E('circle', { r: 6, 'class': 's-anchor' }, L);
      var cur = cursor(L);
      return {
        dur: 6000, settle: 0, render: function (t) {
          bd.tool(0);
          var bp = track(t, [[0, 740, 160], [1200, 740, 160], [2600, 780, 60], [3400, 780, 60], [4800, 720, 220]]);
          tr(B, bp[0], bp[1]);
          var sx = 170 + 280, sy = 140 + 100, ex = bp[0], ey = bp[1] + 100, mx = (sx + ex) / 2;
          S(line, { d: 'M' + sx + ' ' + sy + ' H' + f1(mx) + ' V' + f1(ey) + ' H' + f1(ex) });
          S(a1, { cx: sx, cy: sy }); S(a2, { cx: f1(ex), cy: f1(ey) });
          var drag = (t > 1200 && t < 2600) || (t > 3400 && t < 4800);
          putCur(cur, [bp[0] + 140, bp[1] + 14], drag);
        }
      };
    },
    notes: function (L, c) {
      var bd = board(L, c);
      var A = card(L, c, 300, 210, 'Checkout'); tr(A, 560, 130);
      var note = E('g', null, L);
      E('rect', { width: 170, height: 150, rx: 6, 'class': 's-note', filter: c.shadow }, note);
      E('rect', { x: 18, y: 26, width: 120, height: 7, rx: 3.5, 'class': 's-note-ink' }, note);
      E('rect', { x: 18, y: 44, width: 96, height: 7, rx: 3.5, 'class': 's-note-ink' }, note);
      E('rect', { x: 18, y: 62, width: 110, height: 7, rx: 3.5, 'class': 's-note-ink' }, note);
      var circ = E('path', { d: roughEllipse(710, 265, 180, 140, 9, 0.06), 'class': 's-mark s-sketch' }, L);
      var arr = E('path', { d: 'M330 300 C 400 330, 450 320, 515 285', 'class': 's-mark s-sketch' }, L);
      var head = E('path', { d: 'M-14 -8L0 0L-14 8', 'class': 's-mark s-sketch' }, L);
      return {
        dur: 5600, settle: 4200, render: function (t) {
          bd.tool(t < 1500 ? 4 : 3);
          var p = pop(seg(t, 300, 650));
          op(note, p > 0 ? 1 : 0); tr(note, 150, 190, Math.max(p, 0.001), -3);
          drawOn(circ, eio(seg(t, 1500, 2700)));
          var ap = eio(seg(t, 2900, 3600)); drawOn(arr, ap);
          var e = pointAt(arr, 1), q = pointAt(arr, 0.95);
          op(head, seg(t, 3550, 3650)); tr(head, e[0], e[1], 1, Math.atan2(e[1] - q[1], e[0] - q[0]) * 180 / Math.PI);
        }
      };
    },
    export: function (L, c) {
      var bd = board(L, c);
      var A = card(L, c, 260, 180, 'Login'), B = card(L, c, 260, 180, 'Checkout');
      tr(A, 300, 130); tr(B, 600, 170);
      var pg = E('g', null, L);
      E('rect', { x: 260, y: 96, width: 640, height: 300, rx: 4, 'class': 's-page' }, pg);
      E('rect', { x: 290, y: 116, width: 580, height: 260, 'class': 's-page-margin' }, pg);
      var files = [['PNG', 's-png', 's-png-ink-t'], ['JPEG', 's-png', 's-png-ink-t'], ['PDF', 's-jpg', 's-jpg-ink-t']].map(function (f) {
        var g = E('g', null, L);
        E('rect', { width: 92, height: 50, rx: 12, 'class': f[1], filter: c.shadow }, g);
        text(g, 46, 32, f[0], 17, f[2], 700, 'middle');
        return g;
      });
      var sel = E('rect', { width: 102, height: 60, rx: 15, 'class': 's-ring-accent' }, L);
      return {
        dur: 5600, settle: 3800, render: function (t) {
          bd.tool(0);
          var p = eo(seg(t, 400, 1100));
          op(pg, p); tr(pg, 0, lerp(30, 0, p));
          files.forEach(function (g, i) { var q = eo(seg(t, 1500 + i * 220, 2000 + i * 220)); op(g, q); tr(g, lerp(1100, 990, q), 110 + i * 76); });
          op(sel, t > 2800 ? 1 : 0); S(sel, { x: 985, y: 105 + 2 * 76 });
        }
      };
    }
  };

  /* ---------------- COMPRESS ---------------- */
  var COMPRESS = {
    explorer: function (L, c) {
      var w = win(L, c, 40, 30, 560, 360, { title: 'Downloads' });
      var rows = [['recording.mp4', 's-png', 'MP4'], ['capture.png', 's-jpg', 'PNG'], ['walkthrough.mp4', 's-png', 'MP4'], ['board.png', 's-jpg', 'PNG']];
      var rowG = rows.map(function (r, i) {
        var g = E('g', { transform: 'translate(16 ' + (14 + i * 52) + ')' }, w.body);
        var bg = E('rect', { width: 528, height: 44, rx: 8, 'class': 's-row-bg' }, g);
        E('rect', { x: 8, y: 6, width: 32, height: 32, rx: 7, 'class': r[1] }, g);
        text(g, 54, 27, r[0], 14, 's-text');
        var bar = E('rect', { x: 330, y: 19, width: 0, height: 6, rx: 3, 'class': 's-accent' }, g);
        var ok = icon(g, 'Check', 490, 13, 18, 's-accent-icon');
        g._bg = bg; g._bar = bar; g._ok = ok;
        return g;
      });
      var menu = E('g', null, L);
      E('rect', { width: 250, height: 168, rx: 12, 'class': 's-surface s-ring-f', filter: c.shadow }, menu);
      [0, 1, 3, 4].forEach(function (i) { E('rect', { x: 18, y: 18 + i * 34, width: 120 - i * 8, height: 7, rx: 3.5, 'class': 's-line-strong' }, menu); });
      var hi = E('rect', { x: 6, y: 72, width: 238, height: 32, rx: 8, 'class': 's-dock-sel' }, menu);
      icon(menu, 'Compress', 18, 79, 18, 's-accent-icon');
      text(menu, 44, 93, 'Compress with ClipMark', 14, 's-text', 500);
      var cur = cursor(L);
      return {
        dur: 5600, settle: 4300, render: function (t) {
          var selRows = t > 600 ? [0, 2] : [];
          rowG.forEach(function (g, i) {
            g._bg.setAttribute('class', selRows.indexOf(i) >= 0 ? 's-row-bg on' : 's-row-bg');
            var p = selRows.indexOf(i) >= 0 ? eo(seg(t, 2400 + i * 200, 3600 + i * 200)) : 0;
            S(g._bar, { width: f1(150 * p) }); op(g._bar, p > 0 && p < 1 ? 1 : 0); op(g._ok, p >= 1 ? 1 : 0);
          });
          var mo = t > 1200 && t < 2300 ? seg(t, 1200, 1300) : 0;
          op(menu, mo); tr(menu, 260, 150);
          op(hi, t > 1700 ? 1 : 0);
          putCur(cur, track(t, [[0, 560, 400], [500, 160, 98], [700, 160, 98], [1100, 250, 150], [1650, 300, 238]]), pressedAt(t, [550, 1150, 2200]));
        }
      };
    },
    drop: function (L, c) {
      var w = win(L, c, 220, 30, 380, 360, { title: 'Compress' });
      var zone = E('rect', { x: 20, y: 18, width: 340, height: 150, rx: 12, 'class': 's-drop' }, w.body);
      icon(w.body, 'DropImport', 178, 70, 24, 's-ink3-icon');
      var list = [0, 1].map(function (i) {
        var g = E('g', { transform: 'translate(20 ' + (186 + i * 54) + ')' }, w.body);
        E('rect', { width: 340, height: 46, rx: 10, 'class': 's-surface2' }, g);
        E('rect', { x: 8, y: 7, width: 32, height: 32, rx: 7, 'class': i ? 's-jpg' : 's-png' }, g);
        E('rect', { x: 52, y: 14, width: 120, height: 7, rx: 3.5, 'class': 's-line-strong' }, g);
        var bar = E('rect', { x: 52, y: 28, height: 5, rx: 2.5, 'class': 's-accent' }, g);
        g._bar = bar; return g;
      });
      var f1g = E('g', null, L), f2g = E('g', null, L);
      [f1g, f2g].forEach(function (g, i) { E('rect', { width: 64, height: 80, rx: 10, 'class': i ? 's-jpg' : 's-png', filter: c.shadow }, g); E('path', { d: 'M44 0v14a6 6 0 0 0 6 6h14', 'class': 's-fold' }, g); });
      var cur = cursor(L);
      return {
        dur: 5400, settle: 4000, render: function (t) {
          var p = eio(seg(t, 700, 1900));
          var fx = lerp(70, 370, p), fy = lerp(150, 110, p);
          var dropped = t > 1950;
          op(f1g, dropped ? 1 - seg(t, 1950, 2100) : 1); op(f2g, dropped ? 1 - seg(t, 1950, 2100) : 1);
          tr(f1g, fx, fy); tr(f2g, fx + 16, fy + 12);
          zone.setAttribute('class', p > 0.55 && !dropped ? 's-drop on' : 's-drop');
          list.forEach(function (g, i) {
            var q = seg(t, 2100 + i * 150, 2300 + i * 150);
            op(g, q); S(g._bar, { width: f1(240 * eo(seg(t, 2400 + i * 300, 3800 + i * 300))) });
          });
          putCur(cur, track(t, [[0, 120, 380], [600, fx + 40, fy + 46], [1900, 410, 156], [2600, 420, 170]]).map(function (v, i) { return t > 600 && t < 1950 ? (i ? fy + 46 : fx + 40) : v; }), (t > 600 && t < 1950));
        }
      };
    },
    quality: function (L, c) {
      var w = win(L, c, 60, 24, 520, 372, { title: 'Compress' });
      var b = w.body;
      var prev = E('g', { transform: 'translate(20 18)' }, b);
      E('rect', { width: 480, height: 168, rx: 10, 'class': 's-checker-a' }, prev);
      ['s-sky', 's-sage', 's-sand'].forEach(function (k, i) { E('rect', { x: 20 + i * 150, y: 20, width: 140, height: 128, rx: 8, 'class': k }, prev); });
      text(b, 20, 222, 'Quality', 14, 's-text', 500);
      E('rect', { x: 120, y: 214, width: 380, height: 6, rx: 3, 'class': 's-off' }, b);
      var fill = E('rect', { x: 120, y: 214, height: 6, rx: 3, 'class': 's-accent' }, b);
      var knob = E('circle', { cy: 217, r: 11, 'class': 's-knob', filter: c.shadow }, b);
      text(b, 20, 270, 'Original', 13, 's-text3', 500);
      E('rect', { x: 120, y: 260, width: 380, height: 14, rx: 7, 'class': 's-line-strong' }, b);
      text(b, 20, 304, 'Estimate', 13, 's-text3', 500);
      var est = E('rect', { x: 120, y: 294, height: 14, rx: 7, 'class': 's-accent' }, b);
      var cur = cursor(L);
      return {
        dur: 5600, settle: 0, render: function (t) {
          var q = 0.7 + 0.25 * Math.sin(seg(t, 600, 5000) * Math.PI * 2 - 0.2) * (t > 600 ? 1 : 0);
          q = clamp(q, 0.15, 0.98);
          var kx = 120 + 380 * q;
          S(fill, { width: f1(380 * q) }); S(knob, { cx: f1(kx) });
          S(est, { width: f1(380 * (0.18 + 0.7 * q * q)) });
          putCur(cur, [60 + kx - 4, 24 + 28 + 217 - 4], t > 600 && t < 5000);
        }
      };
    }
  };

  /* ---------------- stage runner ---------------- */
  var SIZES = { hero: [1200, 640], capture: [640, 420], annotate: [640, 420], record: [640, 420], whiteboard: [1200, 460], compress: [640, 420] };
  var SCENES = { capture: CAPTURE, annotate: ANNOTATE, record: RECORD, whiteboard: WHITEBOARD, compress: COMPRESS };

  function Stage(fig) {
    var key = fig.getAttribute('data-stage'), size = SIZES[key];
    var c = makeSvg(fig, size[0], size[1]);
    var rowsHost = $('[data-for="' + key + '"]');
    var rows = rowsHost ? $$('.row', rowsHost) : [];
    var plateEl = rowsHost ? $('.plate', rowsHost) : null;
    var ctl = $('.stage-ctl', fig);
    var layers = {}, scenes = {}, order = [];
    function build(topic, factory) {
      var L = E('g', { 'class': 'layer' }, c.svg);
      layers[topic] = L; scenes[topic] = factory(L, c); order.push(topic);
      L.style.opacity = '0';
    }
    if (key === 'hero') build('hero', heroScene);
    else rows.forEach(function (r) { var tp = r.getAttribute('data-topic'); build(tp, SCENES[key][tp]); });

    var st = { topic: order[0], t0: 0, auto: true, paused: false, visible: false, raf: 0, frozen: 0 };
    var flow = key === 'hero' ? $$('#flow li') : [];

    function showTopic(tp) {
      order.forEach(function (k) { layers[k].style.opacity = k === tp ? '1' : '0'; layers[k].style.visibility = k === tp ? 'visible' : 'hidden'; });
      rows.forEach(function (r) { r.setAttribute('aria-pressed', r.getAttribute('data-topic') === tp ? 'true' : 'false'); });
      if (plateEl && !st.hover) movePlate(rowOf(tp));
    }
    function rowOf(tp) { for (var i = 0; i < rows.length; i++) if (rows[i].getAttribute('data-topic') === tp) return rows[i]; return null; }
    function movePlate(r) {
      if (!plateEl || !r) return;
      plateEl.style.transform = 'translateY(' + r.offsetTop + 'px)';
      plateEl.style.height = r.offsetHeight + 'px';
      plateEl.style.opacity = '1';
    }
    function drawAt(t) {
      var sc = scenes[st.topic];
      sc.render(t);
      if (flow.length) { var ph = sc.phase(t); flow.forEach(function (li, i) { li.classList.toggle('on', i === ph); }); }
    }
    function settled() { drawAt(scenes[st.topic].settle); }
    function select(tp, user) {
      if (user) st.auto = false;
      if (tp === st.topic && !user) return;
      if (tp !== st.topic) { st.topic = tp; st.t0 = performance.now(); }
      showTopic(tp);
      if (reduceMq.matches || st.paused) settled(); else drawAt(0);
    }
    function frame(now) {
      st.raf = 0;
      if (st.paused || !st.visible || reduceMq.matches) return;
      var sc = scenes[st.topic], t = now - st.t0;
      if (st.auto && order.length > 1 && t >= sc.dur) {
        var i = order.indexOf(st.topic);
        select(order[(i + 1) % order.length], false);
        t = 0;
      }
      drawAt(t % sc.dur);
      st.raf = requestAnimationFrame(frame);
    }
    function run() { if (!st.raf && st.visible && !st.paused && !reduceMq.matches) { st.t0 = performance.now() - (st.frozen || 0); st.frozen = 0; st.raf = requestAnimationFrame(frame); } }
    function stop() { if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; } }

    /* rows: plate follows the pointer at once; the scene follows after a 200 ms dwell */
    var dwell = 0;
    rows.forEach(function (r) {
      var tp = r.getAttribute('data-topic');
      r.addEventListener('click', function () { select(tp, true); run(); });
      r.addEventListener('focus', function () { st.hover = false; select(tp, true); run(); });
      r.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch') return;
        st.hover = true; movePlate(r); clearTimeout(dwell);
        dwell = setTimeout(function () { select(tp, true); run(); }, 200);
      });
    });
    if (rowsHost) rowsHost.addEventListener('pointerleave', function () { clearTimeout(dwell); st.hover = false; movePlate(rowOf(st.topic)); });
    window.addEventListener('resize', function () { movePlate(rowOf(st.topic)); });

    function setCtl() {
      if (!ctl) return;
      ctl.hidden = reduceMq.matches;
      ctl.setAttribute('aria-label', st.paused ? 'Play animation' : 'Pause animation');
      ctl.querySelector('use').setAttribute('href', ICONS + (st.paused ? 'Play' : 'Pause'));
    }
    if (ctl) ctl.addEventListener('click', function () {
      st.paused = !st.paused;
      if (st.paused) { st.frozen = (performance.now() - st.t0) % scenes[st.topic].dur; stop(); }
      else run();
      setCtl();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { st.visible = e.isIntersecting; if (st.visible) run(); else stop(); });
      }, { threshold: 0.2 }).observe(fig);
    } else { st.visible = true; }

    function onMotion() { stop(); setCtl(); if (reduceMq.matches) settled(); else { drawAt(0); run(); } }
    if (reduceMq.addEventListener) reduceMq.addEventListener('change', onMotion);

    showTopic(st.topic);
    settled();
    setCtl();
    run();

    /* Frame inspection for render checks: __stages.capture.seek('scroll', 2400) */
    (window.__stages = window.__stages || {})[key] = {
      topics: order.slice(),
      seek: function (tp, t) { st.paused = true; stop(); setCtl(); select(tp || st.topic, true); drawAt(t); }
    };
  }

  /* ---------------- dock: section tracking + sliding pill ---------------- */
  function initDock() {
    var dock = $('#dock'), pill = $('#dock-pill');
    if (!dock) return;
    var links = $$('a', dock);
    var secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var current = -1, ticking = false;
    function place(i, instant) {
      if (i < 0) { pill.style.width = '0'; return; }
      var a = links[i];
      if (instant) pill.style.transition = 'none';
      pill.style.transform = 'translateX(' + a.offsetLeft + 'px)';
      pill.style.width = a.offsetWidth + 'px';
      if (instant) { pill.offsetWidth; pill.style.transition = ''; }
      var l = a.offsetLeft - 12, r = a.offsetLeft + a.offsetWidth + 12;
      if (l < dock.scrollLeft || r > dock.scrollLeft + dock.clientWidth) dock.scrollTo({ left: l, behavior: reduceMq.matches ? 'auto' : 'smooth' });
    }
    function update() {
      ticking = false;
      var y = window.scrollY + 120, idx = -1;
      secs.forEach(function (s, i) { if (s && s.offsetTop <= y) idx = i; });
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) idx = secs.length - 1;
      if (idx === current) return;
      current = idx;
      links.forEach(function (a, i) { if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      place(idx, false);
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', function () { place(current, true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(current, true); });
    update();
  }

  /* ---------------- theme: system -> light -> dark ---------------- */
  function initTheme() {
    var btn = $('#theme');
    if (!btn) return;
    var modes = ['system', 'light', 'dark'], icons = { system: 'CaptureScreen', light: 'Sun', dark: 'Moon' };
    var labels = { system: 'Theme: follow system', light: 'Theme: light', dark: 'Theme: dark' };
    function get() { var a = document.documentElement.getAttribute('data-theme'); return a === 'light' || a === 'dark' ? a : 'system'; }
    function set(m) {
      if (m === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', m);
      try { if (m === 'system') localStorage.removeItem('clipmark-theme'); else localStorage.setItem('clipmark-theme', m); } catch (e) {}
      btn.querySelector('use').setAttribute('href', ICONS + icons[m]);
      btn.setAttribute('aria-label', labels[m]);
      btn.title = labels[m];
    }
    btn.addEventListener('click', function () { set(modes[(modes.indexOf(get()) + 1) % 3]); });
    set(get());
  }

  /* ---------------- platform + releases ---------------- */
  var REPO = 'pow3rcycle/clipmark-releases';
  var RELEASES = 'https://github.com/' + REPO + '/releases';
  var API = 'https://api.github.com/repos/' + REPO + '/releases?per_page=30';
  var CACHE = 'clipmark-releases-v2', TTL = 10 * 60 * 1000;

  function platform() {
    var ua = navigator.userAgent || '', pf = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/iPhone|iPad|Android/i.test(ua)) return null;
    if (/Mac/i.test(pf) || /Macintosh/i.test(ua)) return 'mac';
    if (/Win/i.test(pf) || /Windows/i.test(ua)) return 'win';
    return null;
  }
  function safeUrl(u) { return typeof u === 'string' && /^https:\/\/(github\.com|objects\.githubusercontent\.com)\//.test(u) ? u : null; }
  function versionOf(tag) { return String(tag || '').replace(/^mac-/i, '').replace(/^v/i, ''); }
  function fmtDate(s) { var d = new Date(s); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  function fmtSize(b) { return typeof b === 'number' ? (b / 1048576).toFixed(1) + ' MB' : ''; }
  function classify(list) {
    var all = (Array.isArray(list) ? list : []).filter(function (r) { return r && !r.draft && !r.prerelease && typeof r.tag_name === 'string'; }).map(function (r) {
      var os = /^mac-v\d/i.test(r.tag_name) ? 'mac' : /^v\d/i.test(r.tag_name) ? 'win' : null;
      var ext = os === 'mac' ? /\.dmg$/i : /\.exe$/i;
      var asset = (r.assets || []).filter(function (a) { return a && ext.test(a.name || ''); })[0] || null;
      return { r: r, os: os, asset: asset, when: Date.parse(r.published_at || r.created_at || 0) || 0 };
    }).filter(function (x) { return x.os; });
    all.sort(function (a, b) { return b.when - a.when; });
    function latest(os) { return all.filter(function (x) { return x.os === os && x.asset; })[0] || null; }
    return { all: all, win: latest('win'), mac: latest('mac') };
  }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  /* Release notes: a small safe subset of Markdown (headings, bullets, paragraphs, bold), text only. */
  function notes(md, box) {
    var list = null;
    String(md || '').replace(/\r/g, '').split('\n').forEach(function (line) {
      var l = line.trim();
      if (!l || /^!\[/.test(l) || /^<.*>$/.test(l)) { list = null; return; }
      var h = /^#{1,6}\s+(.*)$/.exec(l), li = /^[-*]\s+(.*)$/.exec(l);
      if (h) { box.appendChild(inline(el('h4'), h[1])); list = null; }
      else if (li) { if (!list) { list = el('ul'); box.appendChild(list); } list.appendChild(inline(el('li'), li[1])); }
      else { box.appendChild(inline(el('p'), l)); list = null; }
    });
  }
  function inline(e, s) {
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`([^`]+)`/g, '$1');
    s.split(/(\*\*[^*]+\*\*)/).forEach(function (part) {
      if (/^\*\*[^*]+\*\*$/.test(part)) e.appendChild(el('strong', null, part.slice(2, -2)));
      else if (part) e.appendChild(document.createTextNode(part));
    });
    return e;
  }
  function fill(c) {
    ['win', 'mac'].forEach(function (os) {
      var card = $('.card[data-os="' + os + '"]'), rel = c[os];
      if (!card) return;
      var f = function (n) { return $('[data-field="' + n + '"]', card); };
      var hero = $(os === 'mac' ? '#dl-mac' : '#dl-win'), sub = $('[data-field="' + os + '-sub"]');
      if (!rel) {
        T(f('version'), os === 'mac' ? 'See the releases page' : 'Not available');
        T(f('date'), ''); T(f('size'), '');
        f('link').href = RELEASES;
        return;
      }
      var v = versionOf(rel.r.tag_name), href = safeUrl(rel.asset.browser_download_url) || safeUrl(rel.r.html_url) || RELEASES;
      f('version').classList.remove('ver-pending');
      T(f('version'), v); T(f('date'), fmtDate(rel.r.published_at)); T(f('size'), fmtSize(rel.asset.size));
      f('link').href = href;
      T(f('link-label'), 'Download ' + v + (os === 'mac' ? ' (.dmg)' : ' (.exe)'));
      if (hero) hero.href = href;
      if (sub) T(sub, (os === 'mac' ? 'Mac ' : 'Windows ') + v);
    });
    var ol = $('#timeline');
    if (!ol) return;
    ol.textContent = '';
    c.all.slice(0, 3).forEach(function (x) {
      var li = el('li'), meta = el('div', 'tl-meta');
      meta.appendChild(el('span', 'tl-os', x.os === 'mac' ? 'macOS' : 'Windows'));
      meta.appendChild(el('span', 'ver', versionOf(x.r.tag_name)));
      var tm = el('time', null, fmtDate(x.r.published_at)); tm.dateTime = x.r.published_at || ''; meta.appendChild(tm);
      li.appendChild(meta);
      var body = el('div', 'tl-body'); notes(x.r.body, body);
      if (!body.childNodes.length) body.appendChild(el('p', null, 'No notes for this release.'));
      li.appendChild(body);
      var more = el('div', 'tl-more'), a = el('a', null, 'Release page'); a.href = safeUrl(x.r.html_url) || RELEASES; more.appendChild(a); li.appendChild(more);
      ol.appendChild(li);
    });
    T($('#rel-status'), c.all.length ? '' : 'No releases yet.');
  }
  function initReleases() {
    var os = platform();
    if (os) {
      var card = $('.card[data-os="' + os + '"] .you'); if (card) card.hidden = false;
      if (os === 'mac') {
        var w = $('#dl-win'), m = $('#dl-mac'), box = $('#hero-cta');
        w.className = 'btn btn-quiet'; m.className = 'btn btn-primary'; box.insertBefore(m, w);
      }
    }
    $$('.matrix td[data-yes]').forEach(function (td) {
      var s = el('span', 'yes'); s.innerHTML = '<svg class="ico" aria-hidden="true"><use href="' + ICONS + 'Check"/></svg>'; s.appendChild(document.createTextNode('Yes')); td.appendChild(s);
    });
    $$('.matrix td[data-no]').forEach(function (td) { td.appendChild(el('span', 'no', 'Not yet')); });

    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { cached = null; }
    if (cached && cached.list) fill(classify(cached.list));
    if (cached && Date.now() - cached.at < TTL) return;
    if (!window.fetch) return;
    fetch(API, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (list) {
      try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), list: list })); } catch (e) {}
      fill(classify(list));
    }).catch(function () {
      if (!cached) {
        T($('#rel-status'), 'Release details could not be loaded.');
        $$('.card [data-field="version"]').forEach(function (e) { T(e, 'See the releases page'); });
      }
    });
  }

  initTheme();
  initDock();
  initReleases();
  $$('[data-stage]').forEach(function (f) { try { Stage(f); } catch (e) { if (window.console) console.error(e); } });
})();
