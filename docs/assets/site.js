/* ClipMark showcase: OS detection, hero markup demo, scroll reveal, theme switch,
   and the live releases dashboard. No dependencies, no trackers.
   Untrusted text from the GitHub API is only ever set through textContent. */
(function () {
  'use strict';

  var REPO = 'pow3rcycle/clipmark-releases';
  var API = 'https://api.github.com/repos/' + REPO + '/releases?per_page=100';
  var RELEASES_PAGE = 'https://github.com/' + REPO + '/releases';
  var CACHE_KEY = 'clipmark-releases-v1';
  var CACHE_MS = 15 * 60 * 1000;
  var TIMELINE_INITIAL = 5;

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function store(kind) { try { return window[kind]; } catch (e) { return null; } }

  /* ---------- OS detection ---------- */
  function detectOS() {
    var p = '';
    try { p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || ''; } catch (e) { /* ignore */ }
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod|Android/i.test(ua)) return 'other';
    if (/mac/i.test(p) || /Macintosh/.test(ua)) return 'mac';
    if (/win/i.test(p) || /Windows/.test(ua)) return 'win';
    return 'other';
  }
  var os = detectOS();
  if (os !== 'other') root.classList.add('os-' + os);

  function applyPrimary() {
    // Exactly one primary download: the visitor's OS, Windows when unknown.
    var primary = os === 'mac' ? 'mac' : 'win';
    var win = $('#dl-win'), mac = $('#dl-mac');
    if (!win || !mac) return;
    var first = primary === 'mac' ? mac : win;
    var second = primary === 'mac' ? win : mac;
    first.classList.add('btn-primary'); first.classList.remove('btn-secondary');
    second.classList.add('btn-secondary'); second.classList.remove('btn-primary');
    first.parentNode.insertBefore(first, first.parentNode.firstChild);
    $all('.rel-card').forEach(function (card) {
      var btn = $('[data-field="link"]', card);
      if (!btn) return;
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    });
  }
  applyPrimary();

  /* ---------- theme switch (system / light / dark) ---------- */
  var THEMES = ['system', 'light', 'dark'];
  var ls = store('localStorage');
  var theme = 'system';
  try { theme = (ls && ls.getItem('clipmark-theme')) || 'system'; } catch (e) { theme = 'system'; }
  if (THEMES.indexOf(theme) < 0) theme = 'system';
  function setTheme(t) {
    theme = t;
    if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    var label = $('#theme-label');
    if (label) label.textContent = 'Theme: ' + t;
    try { if (ls) ls.setItem('clipmark-theme', t); } catch (e) { /* storage blocked */ }
  }
  setTheme(theme);
  var themeBtn = $('#theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
  });

  /* ---------- hero markup demo ---------- */
  var stage = $('#stage');
  var replay = $('#replay');
  function play() {
    if (!stage) return;
    stage.classList.remove('play');
    void stage.offsetWidth; // restart the CSS animations
    stage.classList.add('play');
  }
  if (stage) {
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      stage.classList.add('play');
    } else {
      var so = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio > 0.35) { play(); so.disconnect(); }
        });
      }, { threshold: [0, 0.35, 0.6] });
      so.observe(stage);
      if (replay) {
        replay.hidden = false;
        replay.addEventListener('click', play);
      }
    }
  }

  /* ---------- scroll reveal: only content that starts below the fold ---------- */
  var reveals = $all('.reveal');
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var vh = window.innerHeight || 800;
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) {
      if (el.getBoundingClientRect().top < vh) { el.classList.add('instant', 'in'); }
      else ro.observe(el);
    });
  }

  /* ---------- formatting helpers ---------- */
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    try { return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (e) { return iso.slice(0, 10); }
  }
  function fmtSize(bytes) {
    if (typeof bytes !== 'number' || !isFinite(bytes)) return 'n/a';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  }
  function fmtCount(n) {
    if (typeof n !== 'number') return 'n/a';
    try { return n.toLocaleString(); } catch (e) { return String(n); }
  }
  function versionOf(tag) { return String(tag || '').replace(/^mac-/, '').replace(/^v/, ''); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(id, cls) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('class', cls || 'icon-16');
    s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(ns, 'use');
    u.setAttribute('href', '#' + id);
    s.appendChild(u);
    return s;
  }
  function safeUrl(u) {
    try {
      var url = new URL(u, 'https://github.com/');
      return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : null;
    } catch (e) { return null; }
  }

  /* ---------- tiny markdown renderer (DOM-built, never innerHTML) ---------- */
  function renderInline(text, parent) {
    // Supports **bold**, `code`, [label](http...), and plain text.
    var re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
    var last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1]) parent.appendChild(el('strong', null, m[2]));
      else if (m[3]) parent.appendChild(el('code', null, m[4]));
      else if (m[5]) {
        var href = safeUrl(m[7]);
        if (href) {
          var a = el('a', null, m[6]);
          a.href = href; a.rel = 'noopener noreferrer';
          parent.appendChild(a);
        } else parent.appendChild(document.createTextNode(m[6]));
      }
      last = re.lastIndex;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }
  function renderMarkdown(src) {
    var frag = document.createDocumentFragment();
    var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
    var para = [], list = null;
    function flushPara() {
      if (para.length) { var p = el('p'); renderInline(para.join(' '), p); frag.appendChild(p); para = []; }
    }
    function flushList() { if (list) { frag.appendChild(list); list = null; } }
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, '');
      var h = /^(#{1,6})\s+(.*)$/.exec(line);
      var li = /^\s*[-*+]\s+(.*)$/.exec(line);
      if (!line.trim()) { flushPara(); flushList(); return; }
      if (h) {
        flushPara(); flushList();
        var hx = el(h[1].length <= 2 ? 'h4' : 'h5');
        renderInline(h[2], hx); frag.appendChild(hx); return;
      }
      if (li) {
        flushPara();
        if (!list) list = el('ul');
        var item = el('li'); renderInline(li[1], item); list.appendChild(item); return;
      }
      if (list && /^\s{2,}\S/.test(raw)) { // continuation of a list item
        var lastLi = list.lastChild; lastLi.appendChild(document.createTextNode(' '));
        renderInline(line.trim(), lastLi); return;
      }
      flushList(); para.push(line.trim());
    });
    flushPara(); flushList();
    return frag;
  }
  function firstSentence(md) {
    // A plain-text teaser for collapsed timeline rows.
    var text = String(md || '').replace(/\r/g, '').split('\n').filter(function (l) {
      return l.trim() && !/^#/.test(l.trim());
    })[0] || '';
    text = text.replace(/^\s*[-*+]\s+/, '').replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    var m = /^(.{0,180}?[.!?])(\s|$)/.exec(text);
    if (m) return m[1];
    return text.length > 180 ? text.slice(0, 180) + '...' : text;
  }

  /* ---------- releases ---------- */
  function classify(list) {
    var clean = (Array.isArray(list) ? list : []).filter(function (r) {
      return r && !r.draft && !r.prerelease && typeof r.tag_name === 'string';
    }).map(function (r) {
      var tag = r.tag_name;
      var platform = /^mac-v\d/i.test(tag) ? 'mac' : (/^v\d/i.test(tag) ? 'win' : null);
      var ext = platform === 'mac' ? /\.dmg$/i : /\.exe$/i;
      var asset = (r.assets || []).filter(function (a) { return a && ext.test(a.name || ''); })[0] || null;
      return { r: r, platform: platform, asset: asset, when: Date.parse(r.published_at || r.created_at || 0) || 0 };
    }).filter(function (x) { return x.platform; });
    clean.sort(function (a, b) { return b.when - a.when; });
    function latest(p) { return clean.filter(function (x) { return x.platform === p && x.asset; })[0] || null; }
    return { all: clean, win: latest('win'), mac: latest('mac') };
  }

  function fillCard(osKey, rel) {
    var card = $('.rel-card[data-os="' + osKey + '"]');
    if (!card) return;
    var f = function (n) { return $('[data-field="' + n + '"]', card); };
    var link = f('link'), label = f('link-label');
    var hero = $(osKey === 'mac' ? '#dl-mac' : '#dl-win');
    var heroSub = $('[data-field="' + osKey + '-sub"]');
    if (!rel) {
      f('version').textContent = osKey === 'mac' ? 'Coming soon' : 'Not available';
      f('version').classList.add('pending');
      f('date').textContent = 'n/a'; f('size').textContent = 'n/a'; f('downloads').textContent = 'n/a';
      link.href = RELEASES_PAGE;
      label.textContent = 'Watch the releases page';
      if (hero) { hero.href = RELEASES_PAGE; }
      if (heroSub && osKey === 'mac') heroSub.textContent = 'Coming soon';
      return;
    }
    var v = versionOf(rel.r.tag_name);
    f('version').textContent = v;
    f('version').classList.remove('pending');
    f('date').textContent = fmtDate(rel.r.published_at);
    f('size').textContent = fmtSize(rel.asset.size);
    f('downloads').textContent = fmtCount(rel.asset.download_count);
    var href = safeUrl(rel.asset.browser_download_url) || safeUrl(rel.r.html_url) || RELEASES_PAGE;
    link.href = href;
    label.textContent = 'Download ' + v + ' (' + (osKey === 'mac' ? '.dmg' : '.exe') + ')';
    if (hero) hero.href = href;
    if (heroSub) heroSub.textContent = 'Version ' + v;
  }

  function renderTimeline(all) {
    var box = $('#timeline'), ol = $('#tl'), moreRow = $('#more-row'), moreBtn = $('#more-btn');
    if (!box || !ol) return;
    ol.textContent = '';
    all.forEach(function (x, i) {
      var r = x.r;
      var li = el('li');
      if (i >= TIMELINE_INITIAL) li.hidden = true;
      var meta = el('div', 'tl-meta');
      var chip = el('span', 'os-chip');
      chip.appendChild(icon(x.platform === 'mac' ? 'i-apple-logo' : 'i-windows-logo'));
      chip.appendChild(document.createTextNode(x.platform === 'mac' ? 'macOS' : 'Windows'));
      meta.appendChild(chip);
      meta.appendChild(el('span', 'ver', versionOf(r.tag_name)));
      var t = el('time', 'date', fmtDate(r.published_at));
      t.setAttribute('datetime', r.published_at || '');
      meta.appendChild(t);
      li.appendChild(meta);

      var body = el('div');
      var notes = String(r.body || '').trim();
      if (!notes) {
        body.appendChild(el('p', 'md', 'No release notes for this version.'));
      } else if (i === 0) {
        var md = el('div', 'md'); md.appendChild(renderMarkdown(notes)); body.appendChild(md);
      } else {
        body.appendChild(el('p', 'first-line', firstSentence(notes)));
        var det = el('details');
        det.appendChild(el('summary', null, 'Full notes'));
        var md2 = el('div', 'md');
        det.addEventListener('toggle', function once() {
          if (det.open && !md2.hasChildNodes()) md2.appendChild(renderMarkdown(notes));
        });
        det.appendChild(md2);
        body.appendChild(det);
      }
      var gh = safeUrl(r.html_url);
      if (gh) {
        var a = el('a', null, 'View on GitHub');
        a.href = gh; a.rel = 'noopener noreferrer';
        var p = el('p'); p.style.marginTop = '8px'; p.appendChild(a); body.appendChild(p);
      }
      li.appendChild(body);
      ol.appendChild(li);
    });
    box.hidden = false;
    var hiddenCount = Math.max(0, all.length - TIMELINE_INITIAL);
    if (hiddenCount && moreRow && moreBtn) {
      moreRow.hidden = false;
      moreBtn.textContent = 'Show ' + hiddenCount + ' older version' + (hiddenCount === 1 ? '' : 's');
      moreBtn.onclick = function () {
        $all('#tl > li[hidden]').forEach(function (n) { n.hidden = false; });
        moreRow.hidden = true;
        var next = ol.children[TIMELINE_INITIAL];
        var focusTarget = next && next.querySelector('summary, a');
        if (focusTarget) focusTarget.focus();
      };
    }
  }

  function showFallback(reason) {
    ['win', 'mac'].forEach(function (k) {
      var card = $('.rel-card[data-os="' + k + '"]');
      if (!card) return;
      ['version', 'date', 'size', 'downloads'].forEach(function (n) {
        var node = $('[data-field="' + n + '"]', card);
        if (node) node.textContent = n === 'version' ? 'See GitHub' : 'n/a';
        if (n === 'version' && node) node.classList.add('pending');
      });
      var link = $('[data-field="link"]', card);
      if (link) link.href = k === 'win' ? RELEASES_PAGE + '/latest' : RELEASES_PAGE;
      var label = $('[data-field="link-label"]', card);
      if (label) label.textContent = k === 'win' ? 'Latest Windows release' : 'All releases';
    });
    var status = $('#rel-status');
    if (status) {
      status.textContent = '';
      status.appendChild(document.createTextNode(reason + ' '));
      var a = el('a', null, 'Browse every release on GitHub');
      a.href = RELEASES_PAGE;
      status.appendChild(a);
      status.appendChild(document.createTextNode('.'));
    }
  }

  function render(list) {
    var c = classify(list);
    fillCard('win', c.win);
    fillCard('mac', c.mac);
    applyPrimary();
    renderTimeline(c.all);
    var status = $('#rel-status');
    if (status) status.textContent = c.all.length ? '' : 'No releases published yet.';
  }

  function sourceUrl() {
    // Local testing hook: ?releases=<same-origin json> works on localhost only.
    try {
      var h = location.hostname;
      if (h === 'localhost' || h === '127.0.0.1') {
        var q = new URLSearchParams(location.search).get('releases');
        if (q) { var u = new URL(q, location.href); if (u.origin === location.origin) return { url: u.href, cache: false }; }
      }
    } catch (e) { /* ignore */ }
    return { url: API, cache: true };
  }

  function load() {
    var src = sourceUrl();
    var ss = store('sessionStorage');
    if (src.cache && ss) {
      try {
        var hit = JSON.parse(ss.getItem(CACHE_KEY) || 'null');
        if (hit && Date.now() - hit.t < CACHE_MS && Array.isArray(hit.d)) { render(hit.d); return; }
      } catch (e) { /* ignore bad cache */ }
    }
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
    fetch(src.url, { headers: { Accept: 'application/vnd.github+json' }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        clearTimeout(timer);
        if (res.status === 403 || res.status === 429) throw new Error('rate');
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error('shape');
        if (src.cache && ss) {
          try { ss.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), d: data.map(slim) })); } catch (e) { /* quota */ }
        }
        render(data);
      })
      .catch(function (err) {
        clearTimeout(timer);
        showFallback(err && err.message === 'rate'
          ? 'GitHub is limiting live requests from your network right now.'
          : 'Live release data could not be loaded.');
      });
  }
  function slim(r) {
    return {
      tag_name: r.tag_name, name: r.name, draft: r.draft, prerelease: r.prerelease,
      published_at: r.published_at, created_at: r.created_at, html_url: r.html_url, body: r.body,
      assets: (r.assets || []).map(function (a) {
        return { name: a.name, size: a.size, download_count: a.download_count, browser_download_url: a.browser_download_url };
      })
    };
  }

  load();
})();
