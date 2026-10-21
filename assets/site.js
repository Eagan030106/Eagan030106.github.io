/* Motion system for the portfolio. No dependencies.
   - smooth wheel scrolling (touch stays native)
   - page transition curtain
   - split-word reveals, scroll reveals, scrubbed word highlight
   - parallax plates, scroll-velocity marquee, hover previews, magnetic buttons, cursor
   - project panels (structure drawing / object, hover to open, tilt), variable-font name, chip titles
   - line fields (hero + page bottom), FLIP filtering on the work page */
(function () {
  var doc = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- smooth wheel ---------- */
  var scroll = { target: window.scrollY, current: window.scrollY, active: false, velocity: 0, last: window.scrollY };
  function maxScroll() { return Math.max(0, doc.scrollHeight - window.innerHeight); }
  if (!reduce && fine) {
    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey || e.defaultPrevented || document.body.classList.contains("is-locked")) return;
      for (var n = e.target; n && n !== document.body; n = n.parentElement) {
        var cs = getComputedStyle(n);
        if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight) return;
      }
      e.preventDefault();
      var d = e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerHeight : 1);
      if (!scroll.active) scroll.current = window.scrollY;
      scroll.target = clamp(scroll.target + d, 0, maxScroll());
      scroll.active = true;
    }, { passive: false });
    window.addEventListener("scroll", function () {
      if (!scroll.active) { scroll.target = scroll.current = window.scrollY; }
    }, { passive: true });
  }
  function scrollTo(y) {
    if (reduce || !fine) { window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" }); return; }
    scroll.current = window.scrollY; scroll.target = clamp(y, 0, maxScroll()); scroll.active = true;
  }

  /* ---------- split text ---------- */
  // Latin splits by word, CJK by character, so both languages animate
  var TOKEN = /[\u3000-\u303f\u3400-\u9fff\uff00-\uffef][\u3000-\u303f\uff0c\uff1a\uff1b\uff01\uff1f]*|[^\s\u3000-\u303f\u3400-\u9fff\uff00-\uffef]+|\s+/g;
  // with Intl.Segmenter, Chinese splits by word (视网膜 stays whole) so lines never break mid-word;
  // punctuation sticks to its neighbour so no line starts with ，。： or ends with 「
  var SEG = window.Intl && Intl.Segmenter ? new Intl.Segmenter("zh", { granularity: "word" }) : null;
  var OPEN = /^[\u300c\u300e\uff08\u300a\u201c\u3010(]+$/, PUNCT = /^[\u3000-\u303f\uff00-\uffef\u2014\u2026\u201d.,:;!?)]+$/;
  function tokens(t) {
    if (!SEG || !/[\u3400-\u9fff]/.test(t)) return t.match(TOKEN) || [];
    var out = [], lead = "";
    Array.from(SEG.segment(t)).forEach(function (s) {
      var p = s.segment;
      if (/^\s+$/.test(p)) { out.push(p); return; }
      if (OPEN.test(p)) { lead += p; return; }
      if (PUNCT.test(p) && out.length && !/^\s+$/.test(out[out.length - 1])) { out[out.length - 1] += lead + p; lead = ""; return; }
      out.push(lead + p); lead = "";
    });
    if (lead) out.push(lead);
    return out;
  }
  function split(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var parts = tokens(c.textContent);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"); w.className = "w";
            var wi = document.createElement("span"); wi.className = "wi"; wi.textContent = p;
            wi.style.setProperty("--i", i++);
            w.appendChild(wi); frag.appendChild(w);
          });
          c.parentNode.replaceChild(frag, c);
        } else if (c.nodeType === 1 && c.tagName !== "BR") { walk(c); }
      });
    })(el);
    el.classList.add("split");
  }
  $$("[data-split]").forEach(split);

  /* ---------- variable-font name ----------
     Each letter of the name is its own span; letters near the pointer narrow
     and get heavier along Archivo's wdth/wght axes, and a wave runs through
     the name once when it first comes into view. */
  var vf = { groups: [], px: 0, py: 0, on: false, idle: true };
  if (!reduce) $$("[data-vf]").forEach(function (el) {
    var g = { el: el, letters: [], wave: 0 };
    $$(".wi", el).forEach(function (wi) {
      var txt = wi.textContent; wi.textContent = "";
      Array.from(txt).forEach(function (ch) {
        var s = document.createElement("span"); s.className = "vc"; s.textContent = ch; wi.appendChild(s);
        g.letters.push({ el: s, i: g.letters.length, w: 125, g: 800, lw: 125, lg: 800, x: 0, y: 0, fs: 100 });
      });
    });
    vf.groups.push(g);
    var seen = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { g.wave = performance.now() + 1100; vf.idle = false; seen.disconnect(); }
    }, { threshold: 0.4 });
    setTimeout(function () { seen.observe(el); }, reduce ? 0 : 520);
  });
  function vfMeasure() {
    var sy = window.scrollY;
    vf.groups.forEach(function (g) {
      g.letters.forEach(function (v) { v.el.style.removeProperty("--vw"); v.el.style.removeProperty("--vg"); });
      g.letters.forEach(function (v) {
        var r = v.el.getBoundingClientRect();
        v.x = r.left + r.width / 2; v.y = r.top + r.height / 2 + sy; v.fs = parseFloat(getComputedStyle(v.el).fontSize) || 100;
        v.w = v.lw = 125; v.g = v.lg = 800;
      });
    });
  }
  if (vf.groups.length) {
    var vfLater = function () { setTimeout(vfMeasure, 1900); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(vfLater); else vfLater();
    var vfT = 0;
    window.addEventListener("resize", function () { clearTimeout(vfT); vfT = setTimeout(vfMeasure, 250); });
    window.addEventListener("pointermove", function (e) { vf.px = e.clientX; vf.py = e.clientY; vf.on = true; vf.idle = false; }, { passive: true });
    window.addEventListener("pointerdown", function (e) { vf.px = e.clientX; vf.py = e.clientY; vf.on = true; vf.idle = false; }, { passive: true });
    window.addEventListener("pointerup", function (e) { if (e.pointerType !== "mouse") vf.on = false; }, { passive: true });
    doc.addEventListener("mouseleave", function () { vf.on = false; });
  }
  function vfTick(t) {
    if (vf.idle) return;
    var sy = window.scrollY, moving = vf.on;
    vf.groups.forEach(function (g) {
      var ws = g.wave ? (t - g.wave) / 1000 : -1;
      if (ws >= 0 && ws < 2.4) moving = true;
      g.letters.forEach(function (v) {
        var k = 0;
        if (vf.on) {
          var dx = vf.px - v.x, dy = vf.py + sy - v.y, R = v.fs * 1.05;
          k = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / R); k = k * k * (3 - 2 * k);
        }
        if (ws >= 0) { var ph = ws * 1.5 - v.i * 0.08; if (ph > 0 && ph < 1) k = Math.max(k, Math.sin(ph * Math.PI) * 0.85); }
        var tw = 125 - 50 * k, tg = 800 + 100 * k;
        v.w += (tw - v.w) * 0.16; v.g += (tg - v.g) * 0.16;
        if (Math.abs(tw - v.w) > 0.3) moving = true;
        if (Math.abs(v.w - v.lw) > 0.25 || Math.abs(v.g - v.lg) > 0.6) {
          v.el.style.setProperty("--vw", v.w.toFixed(1)); v.el.style.setProperty("--vg", Math.round(v.g));
          v.lw = v.w; v.lg = v.g;
        }
      });
    });
    if (!moving) vf.idle = true;
  }

  /* section and page titles: the ink fill on hover enters from the side the
     pointer came from and leaves toward the side it went */
  if (fine) $$(".hd .hl").forEach(function (hl) {
    function side(e) { var r = hl.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? "0%" : "100%"; }
    hl.addEventListener("mouseenter", function (e) { hl.style.setProperty("--hx", side(e)); });
    hl.addEventListener("mouseleave", function (e) { hl.style.setProperty("--hx", side(e)); });
  });

  /* scrubbed words: opacity follows scroll position */
  var scrubs = $$("[data-scrub]").map(function (el) {
    var words = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          tokens(c.textContent).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            var s = document.createElement("span"); s.className = "sw"; s.textContent = p; words.push(s); frag.appendChild(s);
          });
          c.parentNode.replaceChild(frag, c);
        } else if (c.nodeType === 1) walk(c);
      });
    })(el);
    el.classList.add("scrub");
    return { el: el, words: words };
  });

  /* ---------- reveal on enter ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { (en.target._rv || en.target).classList.add("is-in"); io.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.01 });
  // wait for the curtain before revealing what is already on screen
  var introDelay = reduce ? 0 : 520;
  setTimeout(function () {
    // a clip-path of inset(100%) hides the element from the observer, so watch its parent instead
    $$(".split, [data-reveal]").forEach(function (el) {
      if (el.getAttribute("data-reveal") === "clip" && el.parentElement) { el.parentElement._rv = el; io.observe(el.parentElement); }
      else io.observe(el);
    });
  }, introDelay);
  // safety: never leave content hidden
  setTimeout(function () {
    $$(".split, [data-reveal]").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-in");
    });
  }, introDelay + 1500);

  /* ---------- open every new page at its top ----------
     A fresh visit (not a reload or back/forward) without a #hash always starts at the top,
     even if the host frame kept an earlier scroll position. */
  (function () {
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    if (location.hash || (nav && nav.type !== "navigate")) return;
    var toTop = function () { if (!scroll.active) { window.scrollTo(0, 0); scroll.target = scroll.current = 0; } };
    var touched = false;
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (ev) { window.addEventListener(ev, function () { touched = true; }, { once: true, passive: true }); });
    toTop();
    window.addEventListener("load", function () { if (!touched && window.scrollY > 0) toTop(); });
  })();

  /* ---------- page transitions ---------- */
  var curtain = $(".curtain");
  function isInternal(a) {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    var href = a.getAttribute("href") || "";
    if (!href || href[0] === "#" || /^(mailto:|tel:|https?:|\/\/)/i.test(href)) return false;
    return true;
  }
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest("a");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href[0] === "#" && href.length > 1) {
      var t = document.getElementById(href.slice(1));
      if (t) { e.preventDefault(); scrollTo(t.getBoundingClientRect().top + window.scrollY - 80); }
      return;
    }
    if (a.hash && a.hash.length > 1) {
      var norm = function (p) { return p.replace(/index\.html$/, ""); };
      if (norm(new URL(a.href, location.href).pathname) === norm(location.pathname)) {
        var tgt = document.getElementById(a.hash.slice(1));
        if (tgt) { e.preventDefault(); scrollTo(tgt.getBoundingClientRect().top + window.scrollY - 80); return; }
      }
    }
    if (!isInternal(a)) return;
    // "Back" returns to the page the visitor came from (keeping their scroll position);
    // a visitor who landed here directly goes to the projects list instead
    var goBack = false;
    if (a.hasAttribute("data-back")) {
      var from = null;
      try { from = sessionStorage.getItem("from"); } catch (err) {}
      goBack = !!from && from !== location.href && history.length > 1;
    } else {
      try { sessionStorage.setItem("from", location.href); } catch (err) {}
    }
    if (goBack && (reduce || !curtain)) { e.preventDefault(); history.back(); return; }
    if (reduce || !curtain) return;
    e.preventDefault();
    var label = a.getAttribute("data-label") || a.textContent.trim().split("\n")[0];
    var sp = curtain.querySelector("span"); if (sp) sp.textContent = label.slice(0, 48);
    curtain.classList.remove("is-leaving"); void curtain.offsetWidth; curtain.classList.add("is-leaving");
    setTimeout(function () { if (goBack) history.back(); else window.location.href = a.href; }, 680);
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && curtain) { curtain.classList.remove("is-leaving"); curtain.style.animation = "none"; curtain.style.transform = "scaleY(0)"; }
  });

  /* ---------- header + progress ---------- */
  var head = $(".site-head"), bar = $(".progress"), backFab = $(".back-fab");

  /* ---------- parallax ---------- */
  var plx = $$("[data-parallax]").map(function (el) { return { el: el, k: parseFloat(el.getAttribute("data-parallax")) || 0.12 }; });

  /* ---------- marquee ---------- */
  var mq = $(".marquee-track"), mqX = 0, mqW = 0;
  if (mq) { mq.innerHTML += mq.innerHTML; mqW = mq.scrollWidth / 2; window.addEventListener("resize", function () { mqW = mq.scrollWidth / 2; }); }

  /* ---------- cursor ---------- */
  var cur = $(".cursor"), mx = -100, my = -100, cx = -100, cy = -100, xy = cur && $(".xy", cur), xyT = 0;
  window.addEventListener("pointermove", function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
  if (cur && fine) {
    document.addEventListener("pointerover", function (e) {
      var v = e.target.closest("[data-cursor]");
      var l = e.target.closest("a, button");
      cur.classList.toggle("is-view", !!v);
      cur.classList.toggle("is-link", !v && !!l);
      if (v) cur.querySelector("span").textContent = v.getAttribute("data-cursor");
    });
  }

  /* ---------- decoding labels ----------
     Mono labels resolve from random glyphs into their text when they scroll into view
     or when their link is hovered. CJK text is scrambled with CJK glyphs so widths stay put.
     [data-scramble] opts body text in as well (the hero profile and facts): letters keep
     their width so line breaks barely move, and the block's height is held while it runs. */
  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>_";
  // body text swaps each letter for one of about the same width, so lines keep their breaks
  var WIDTHS = ["ijlrtf", "mw", "abcdeghknopqsuvxyz", "IJ", "MW", "ABCDEFGHKLNOPQRSTUVXYZ", "0123456789"];
  var sameWidth = function (ch) { for (var k = 0; k < WIDTHS.length; k++) if (WIDTHS[k].indexOf(ch) > -1) return WIDTHS[k]; return WIDTHS[2]; };
  var CJK_GLYPHS = "数据系统设计交互产品服务研究原型验证模型";
  var pick = function (set) { return set[(Math.random() * set.length) | 0]; };
  function scramble(el) {
    if (reduce || el._scr) return;
    var final = el._final || (el._final = el.textContent);
    var body = !!el.closest("[data-scramble]");
    var len = final.length, start = performance.now(), dur = Math.min(900, 260 + len * 26);
    var box = body && el.closest("p, b, div");
    if (box) { box.style.height = box.offsetHeight + "px"; box.style.overflow = "hidden"; }
    el._scr = true;
    (function step(now) {
      var p = Math.min(1, (now - start) / dur), done = Math.floor(p * p * len), out = "";
      for (var i = 0; i < len; i++) {
        var ch = final[i];
        if (i < done || /[\s·\/:.,()\-–，。、：；（）「」%]/.test(ch)) out += ch;
        else if (ch.charCodeAt(0) > 0x2e80) out += pick(CJK_GLYPHS);
        else if (!body) out += pick(GLYPHS);
        else out += pick(sameWidth(ch));
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
      else { el.textContent = final; el._scr = false; if (box) { box.style.height = ""; box.style.overflow = ""; } }
    })(start);
  }
  var scrEls = [];
  $$(".mono").forEach(function (m) {
    if (m.closest("[data-noscramble], .marquee, .cursor, .curtain, form, .lang-btn, .copy-btn")) return;
    var leaves = m.children.length ? $$("span.en, span.zh", m).filter(function (x) { return !x.children.length; }) : [m];
    leaves.forEach(function (l) { var t = l.textContent; if (t.trim() && t.length <= 64) scrEls.push(l); });
  });
  $$("[data-scramble]").forEach(function (m) {
    var leaves = $$("span.en, span.zh", m).filter(function (x) { return !x.children.length; });
    (leaves.length ? leaves : [m]).forEach(function (l) { if (l.textContent.trim() && l.textContent.length <= 400) scrEls.push(l); });
  });
  if (!reduce && "IntersectionObserver" in window) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { scramble(en.target); sio.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -6% 0px" });
    setTimeout(function () { scrEls.forEach(function (el) { sio.observe(el); }); }, 600);
    if (fine) document.addEventListener("pointerover", function (e) {
      var a = e.target.closest("a, button"); if (!a) return;
      scrEls.forEach(function (el) { if (a.contains(el) && el.offsetParent) scramble(el); });
    });
  }
  function rescrambleVisible() {
    scrEls.forEach(function (el) { var r = el.getBoundingClientRect(); if (el.offsetParent && r.bottom > 0 && r.top < window.innerHeight) scramble(el); });
  }

  /* ---------- selected projects: one open panel at a time ----------
     The open panel shows the real object, the others its structure drawing.
     Clicking a closed panel opens it; clicking the open one goes to the project.
     Until the visitor clicks or taps, the panels play through on their own:
     the progress bar in the open panel's top line ends, the next one opens.
     It pauses while a mouse is on the row and while the row is off screen. */
  var narrow = window.matchMedia("(max-width: 900px)");
  $$("[data-xp]").forEach(function (xp) {
    var panels = $$(".xp-panel", xp);
    var auto = !reduce, seen = false, over = false;
    function run() {
      xp.classList.toggle("is-paused", !(seen && !over && !document.hidden));
      xp.classList.toggle("is-off", !seen);
    }
    function stopAuto() { auto = false; xp.classList.remove("is-auto", "is-paused"); }
    if (auto) {
      xp.classList.add("is-auto");
      run();
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (es) { seen = es[0].isIntersecting; run(); }, { threshold: 0.35 }).observe(xp);
      } else { seen = true; run(); }
      document.addEventListener("visibilitychange", run);
      xp.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { over = true; run(); } });
      xp.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { over = false; run(); } });
      // keyboard users move through the panels themselves
      xp.addEventListener("keyup", function (e) { if (e.key === "Tab") stopAuto(); });
      xp.addEventListener("animationend", function (e) {
        if (!auto || e.animationName !== "xp-prog") return;
        var i = panels.indexOf($(".xp-panel.is-active", xp));
        open(panels[(i + 1) % panels.length], true);
      });
    }
    function open(p, byAuto) {
      panels.forEach(function (q) {
        var on = q === p;
        q.classList.toggle("is-active", on);
        var hit = $(".xp-hit", q);
        if (hit) hit.setAttribute("aria-expanded", on ? "true" : "false");
      });
      // stacked on phones: once the panels settle, bring the opened one into view
      if (narrow.matches && !byAuto) setTimeout(function () {
        var r = p.getBoundingClientRect();
        if (r.top < 64 || r.bottom > window.innerHeight) window.scrollTo({ top: window.scrollY + r.top - 72, behavior: reduce ? "auto" : "smooth" });
      }, 850);
    }
    // with a mouse the panel under the pointer opens (after a short pause, so
    // sweeping across the row does not flicker); touch and stacked layouts tap
    var wait = 0;
    // the open object tilts toward the pointer; closed drawings drift against it
    if (fine && !reduce) {
      xp.addEventListener("pointermove", function (e) {
        var a = $(".xp-panel.is-active", xp), g = xp.getBoundingClientRect();
        xp.style.setProperty("--gx", clamp((e.clientX - g.left) / g.width * 2 - 1, -1, 1).toFixed(3));
        xp.style.setProperty("--gy", clamp((e.clientY - g.top) / g.height * 2 - 1, -1, 1).toFixed(3));
        if (!a) return;
        var r = a.getBoundingClientRect();
        a.style.setProperty("--mx", clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1).toFixed(3));
        a.style.setProperty("--my", clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1).toFixed(3));
      });
      xp.addEventListener("pointerleave", function () {
        ["--gx", "--gy"].forEach(function (k) { xp.style.setProperty(k, 0); });
        panels.forEach(function (q) { q.style.setProperty("--mx", 0); q.style.setProperty("--my", 0); });
      });
    }
    panels.forEach(function (p) {
      p.addEventListener("mouseenter", function () {
        if (!fine || narrow.matches || p.classList.contains("is-active")) return;
        clearTimeout(wait);
        wait = setTimeout(function () { open(p); }, 80);
      });
      p.addEventListener("mouseleave", function () { clearTimeout(wait); });
      p.addEventListener("click", function (ev) {
        stopAuto();
        if (!p.classList.contains("is-active")) { clearTimeout(wait); open(p); return; }
        if (ev.target.closest("a, button")) return;
        var go = $(".xp-go", p);
        if (go) go.click();
      });
    });
  });

  /* ---------- London clock in the hero ---------- */
  var clock = $("[data-clock]");
  if (clock) {
    var fmt = null;
    try { fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }); } catch (err) {}
    var tick = function () { clock.textContent = fmt ? fmt.format(new Date()) : new Date().toTimeString().slice(0, 8); };
    tick(); setInterval(tick, 1000);
  }

  /* ---------- hover preview ---------- */
  var hp = $(".hover-preview"), hpx = 0, hpy = 0;
  if (hp && fine) {
    $$("[data-preview]").forEach(function (row) {
      row.addEventListener("pointerenter", function () {
        var src = document.getElementById(row.getAttribute("data-preview"));
        if (src) hp.innerHTML = src.innerHTML;
        hp.classList.add("is-on");
      });
      row.addEventListener("pointerleave", function () { hp.classList.remove("is-on"); });
    });
  }

  /* ---------- magnetic ---------- */
  if (fine && !reduce) {
    $$("[data-magnetic]").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = "transform .2s ease-out";
        el.style.transform = "translate(" + dx * 0.25 + "px," + dy * 0.35 + "px)";
      });
      el.addEventListener("pointerleave", function () {
        el.style.transition = "transform .8s cubic-bezier(.16,1,.3,1)";
        el.style.transform = "";
      });
    });
  }

  /* ---------- line fields (hero and page bottom) ---------- */
  var fields = $$("canvas.field").map(function (c) {
    return { cv: c, ctx: c.getContext("2d"), w: 0, h: 0, lines: parseInt(c.getAttribute("data-lines"), 10) || 26, m: { sx: -9999, sy: -9999 } };
  });
  var cv = fields.length > 0, dpr = 1, inkColor = "#000", accColor = "#00f";
  function sizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cs = getComputedStyle(doc);
    inkColor = cs.getPropertyValue("--line").trim() || "#ccc";
    accColor = cs.getPropertyValue("--accent").trim() || "#00f";
    fields.forEach(function (f) {
      f.w = f.cv.clientWidth; f.h = f.cv.clientHeight;
      f.cv.width = f.w * dpr; f.cv.height = f.h * dpr;
    });
  }
  if (cv) {
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", sizeCanvas);
  }
  function drawField(t) {
    fields.forEach(function (f) {
      if (!f.ctx || !f.w) return;
      var r = f.cv.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      if (r.height !== f.h) sizeCanvas();
      var m = f.m, x0 = mx - r.left, y0m = my - r.top;
      if (m.sx < -9000) { m.sx = x0; m.sy = y0m; }
      m.sx = lerp(m.sx, x0, 0.08); m.sy = lerp(m.sy, y0m, 0.08);
      var ctx = f.ctx, w = f.w, h = f.h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var lines = f.lines, gap = h / (lines + 1), time = reduce ? 0 : t * 0.00035;
      for (var i = 1; i <= lines; i++) {
        var y0 = i * gap;
        var hot = i % 9 === 4;
        ctx.beginPath();
        ctx.lineWidth = hot ? 1.4 : 1;
        ctx.strokeStyle = hot ? accColor : inkColor;
        for (var x = 0; x <= w + 12; x += 12) {
          var wave = Math.sin(x * 0.004 + time * 2 + i * 0.35) * 10 + Math.sin(x * 0.011 - time * 3 + i) * 4;
          var dx = x - m.sx, dy = y0 - m.sy;
          var d2 = dx * dx + dy * dy, R = 180;
          var bump = fine ? Math.exp(-d2 / (2 * R * R)) * 46 * (dy >= 0 ? 1 : -1) : 0;
          var y = y0 + wave + bump;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
  }

  /* ---------- main loop ---------- */
  var lastY = window.scrollY;
  function frame(t) {
    if (scroll.active) {
      scroll.current = lerp(scroll.current, scroll.target, 0.095);
      if (Math.abs(scroll.target - scroll.current) < 0.4) { scroll.current = scroll.target; scroll.active = false; }
      window.scrollTo(0, scroll.current);
    }
    var y = window.scrollY, vh = window.innerHeight;
    var dy = y - lastY; lastY = y;
    scroll.velocity = lerp(scroll.velocity, dy, 0.15);

    if (backFab) backFab.classList.toggle("is-on", y > 240);
    if (head) {
      head.classList.toggle("is-solid", y > 40);
      if (Math.abs(dy) > 2) head.classList.toggle("is-hidden", dy > 0 && y > 200);
    }
    if (bar) { var m = maxScroll(); bar.style.transform = "scaleX(" + (m ? y / m : 0) + ")"; }

    if (!reduce) {
      plx.forEach(function (p) {
        var r = p.el.closest(".plate").getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var c = (r.top + r.height / 2 - vh / 2);
        p.el.style.transform = "translate3d(0," + (-c * p.k).toFixed(1) + "px,0) scale(1.12)";
      });
      if (mq && mqW) {
        mqX -= 0.6 + Math.abs(scroll.velocity) * 0.35;
        if (mqX <= -mqW) mqX += mqW;
        mq.style.transform = "translate3d(" + mqX.toFixed(1) + "px,0,0)";
      }
    }
    scrubs.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      var p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
      var n = s.words.length;
      s.words.forEach(function (w, i) {
        var o = clamp(p * n * 1.15 - i, 0, 1);
        w.style.opacity = (0.16 + o * 0.84).toFixed(3);
      });
    });
    if (cur && fine) {
      cx = lerp(cx, mx, 0.2); cy = lerp(cy, my, 0.2);
      cur.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
      if (xy && (t - xyT > 60)) { xyT = t; xy.textContent = "X " + ("000" + Math.round(mx)).slice(-4) + "  Y " + ("000" + Math.round(my + window.scrollY)).slice(-5); }
    }
    if (hp && fine) {
      hpx = lerp(hpx, mx + 28, 0.12); hpy = lerp(hpy, my - 120, 0.12);
      hp.style.left = hpx.toFixed(1) + "px"; hp.style.top = hpy.toFixed(1) + "px";
    }
    drawField(t);
    vfTick(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- work filters (FLIP) ---------- */
  var grid = $("[data-filter-grid]");
  if (grid) {
    var cards = $$("[data-cat]", grid);
    $$(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var f = chip.getAttribute("data-filter");
        $$(".chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c === chip)); });
        var first = new Map(cards.map(function (c) { return [c, c.getBoundingClientRect()]; }));
        var wasHidden = new Map(cards.map(function (c) { return [c, c.hidden]; }));
        cards.forEach(function (c) { c.hidden = !(f === "all" || c.getAttribute("data-cat") === f); });
        grid.classList.toggle("is-filtered", f !== "all");
        cards.forEach(function (c, i) {
          if (c.hidden) return;
          c.classList.add("is-in");
          var a = first.get(c), b = c.getBoundingClientRect();
          if (reduce || !c.animate) return;
          if (wasHidden.get(c)) {
            c.animate([{ opacity: 0, transform: "translateY(40px) scale(.97)" }, { opacity: 1, transform: "none" }],
              { duration: 800, delay: i * 50, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
          } else {
            c.animate([{ transform: "translate(" + (a.left - b.left) + "px," + (a.top - b.top) + "px)" }, { transform: "none" }],
              { duration: 900, easing: "cubic-bezier(.16,1,.3,1)" });
          }
        });
      });
    });
  }

  /* ---------- copy email ---------- */
  $$("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy"), note = $(".copy-note");
      var zh = doc.getAttribute("data-lang") === "zh";
      function ok() { if (note) note.textContent = (zh ? "已复制 " : "Copied ") + text; }
      function fallback() {
        var el = btn.previousElementSibling; if (!el) return;
        var r = document.createRange(); r.selectNodeContents(el);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        if (note) note.textContent = zh ? "已选中，按 Ctrl/Cmd + C 复制。" : "Selected. Press Ctrl/Cmd + C to copy.";
      }
      try { navigator.clipboard.writeText(text).then(ok, fallback); } catch (e) { fallback(); }
    });
  });

  /* ---------- language toggle ---------- */
  var mainEl = $("main");
  $$("[data-lang-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = doc.getAttribute("data-lang") === "zh" ? "en" : "zh";
      function apply() {
        doc.setAttribute("data-lang", next); doc.lang = next === "zh" ? "zh-CN" : "en";
        try { localStorage.setItem("lang", next); } catch (e) {}
        if (cv) sizeCanvas();
        if (mainEl) mainEl.classList.remove("is-swapping");
        rescrambleVisible();
      }
      if (reduce || !mainEl) return apply();
      mainEl.classList.add("is-swapping");
      setTimeout(apply, 260);
    });
  });

  /* ---------- lightbox ---------- */
  /* The arrows (and ←/→ keys, or a swipe) step through the links that are
     visible on the page, so a filtered art grid only cycles its own works. */
  var lb = $(".lightbox");
  if (lb) {
    var lbBody = $(".lb-body", lb), lastFocus = null, lbList = [], lbAt = -1;
    // in reading order as laid out (column by column), which can differ from source order
    function lbLinks() {
      return $$("[data-lightbox]").filter(function (a) { return !a.closest("[hidden]"); })
        .map(function (a) { var r = a.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), a]; })
        .sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; })
        .map(function (x) { return x[2]; });
    }
    function lbPreload(a) { var h = a && a.getAttribute("href"); if (h && /\.(jpe?g|png|webp)$/i.test(h)) (new Image()).src = h; }
    function openLb(id, dir) {
      var tpl = document.getElementById(id); if (!tpl) return;
      if (lb.hidden) lastFocus = document.activeElement;
      lbList = lbLinks();
      lbAt = lbList.findIndex(function (a) { return a.getAttribute("data-lightbox") === id; });
      lb.classList.toggle("has-nav", lbList.length > 1);
      lbBody.innerHTML = tpl.innerHTML;
      lbBody.style.animation = "none"; void lbBody.offsetWidth;
      lbBody.style.animation = dir && !reduce ? (dir > 0 ? "lb-step-next" : "lb-step-prev") + " .55s var(--ease) both" : "";
      if (lb.hidden) {
        lb.classList.remove("is-closing"); lb.hidden = false;
        document.body.classList.add("is-locked");
        $(".lb-close", lb).focus();
      }
      if (dir < 0 && $$(".lb-thumb", lbBody).length) showImg($$(".lb-thumb", lbBody).length - 1);
      if (lbList.length > 1) { lbPreload(lbList[(lbAt + 1) % lbList.length]); lbPreload(lbList[(lbAt - 1 + lbList.length) % lbList.length]); }
    }
    /* a work with several images: thumbnails switch the main view, and the
       arrows walk through its images before moving on to the next work */
    function galAt() { var on = $(".lb-thumb.is-on", lbBody); return on ? $$(".lb-thumb", lbBody).indexOf(on) : -1; }
    function showImg(k) {
      var all = $$(".lb-thumb", lbBody), img = $(".lb-main img", lbBody), c = $(".lb-count", lbBody);
      if (!img || !all[k]) return;
      all.forEach(function (b, j) { b.classList.toggle("is-on", j === k); });
      img.src = all[k].getAttribute("data-src");
      img.classList.remove("is-swap"); void img.offsetWidth; if (!reduce) img.classList.add("is-swap");
      if (c) c.textContent = ("0" + (k + 1)).slice(-2) + " / " + ("0" + all.length).slice(-2);
    }
    lbBody.addEventListener("click", function (e) {
      var t = e.target.closest(".lb-thumb"); if (!t) return;
      e.stopPropagation(); showImg($$(".lb-thumb", lbBody).indexOf(t));
    });
    function stepLb(d) {
      if (lb.hidden) return;
      var g = galAt(), n = $$(".lb-thumb", lbBody).length;
      if (g > -1 && g + d >= 0 && g + d < n) { showImg(g + d); return; }
      if (lbList.length < 2 || lbAt < 0) return;
      var a = lbList[(lbAt + d + lbList.length) % lbList.length];
      lastFocus = a;
      openLb(a.getAttribute("data-lightbox"), d);
    }
    $$("[data-lb-step]", lb).forEach(function (b) {
      b.addEventListener("click", function (e) { e.stopPropagation(); stepLb(+b.getAttribute("data-lb-step")); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") stepLb(1); else if (e.key === "ArrowLeft") stepLb(-1);
    });
    var sx = 0, sy = 0;
    lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) stepLb(dx < 0 ? 1 : -1);
    }, { passive: true });
    function closeLb() {
      if (lb.hidden) return;
      lb.classList.add("is-closing");
      setTimeout(function () { lb.hidden = true; lb.classList.remove("is-closing"); document.body.classList.remove("is-locked"); if (lastFocus) lastFocus.focus(); }, reduce ? 0 : 330);
    }
    $$("[data-lightbox]").forEach(function (a) {
      a.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openLb(a.getAttribute("data-lightbox")); });
    });
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.closest("[data-lb-close]")) closeLb(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLb(); });
  }

  /* ---------- message board ----------
     Inside the claude.ai viewer, messages are stored with the `db` capability:
     each visitor writes only inbox/<their id>; only the owner can read the inbox.
     Anywhere else (a downloaded copy, another host) the form points to email. */
  var form = $("#msg-form");
  if (form) {
    var status = $(".msg-status", form), btn = $("button[type=submit]", form);
    var L = function (en, zh) { return doc.getAttribute("data-lang") === "zh" ? zh : en; };
    // both languages go in, so the note follows the language switch
    var say = function (en, zh, ok) {
      status.innerHTML = "";
      [["en", en], ["zh", zh]].forEach(function (x) { var s = document.createElement("span"); s.className = x[0]; s.textContent = x[1]; status.appendChild(s); });
      status.classList.toggle("ok", !!ok);
    };
    var store = { db: null, user: null, id: null, ready: false, readOnly: false };
    var fallbackMsg = ["Messages can't be saved in this copy of the site. Please email me instead (address on the right).", "这个版本的网站无法保存留言，请改用右侧的邮箱联系我。"];

    function renderInbox(snap) {
      var box = $("#inbox"), list = $(".inbox-list", box);
      box.hidden = false; list.innerHTML = "";
      if (snap.empty) {
        var li = document.createElement("li"); li.className = "muted";
        li.innerHTML = '<span class="en">No messages yet.</span><span class="zh">还没有留言。</span>'; list.appendChild(li); return;
      }
      snap.docs.forEach(function (d) {
        var v = d.data() || {}, items = Array.isArray(v.items) ? v.items : [];
        var li = document.createElement("li");
        var who = document.createElement("div"); who.className = "who";
        var b = document.createElement("b"); b.textContent = String(v.name || L("Anonymous", "匿名"));
        var c = document.createElement("span"); c.className = "mono muted"; c.textContent = String(v.contact || "");
        who.appendChild(b); who.appendChild(c); li.appendChild(who);
        items.slice().reverse().forEach(function (it) {
          var p = document.createElement("p");
          var when = it && it.at ? new Date(it.at).toLocaleString() + "  " : "";
          p.textContent = when + String((it && it.text) || "");
          li.appendChild(p);
        });
        list.appendChild(li);
      });
    }

    (async function connect() {
      if (!window.claude || typeof window.claude.use !== "function") return;
      try {
        var res = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
        store.db = res[0]; store.user = res[1];
        if (!store.db || !store.user) return;
        store.id = await store.user.id();
        store.ready = true;
        var owner = await store.user.isOwner();
        if (owner) {
          store.db.collection("inbox").orderBy("updatedAt", "desc").limit(200).onSnapshot(renderInbox, function () {});
        }
      } catch (e) { store.ready = false; }
    })();

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = form.name.value.trim(), contact = form.contact.value.trim(), text = form.text.value.trim();
      if (!name || !text) { say("Please add your name and a message.", "请填写名字和留言内容。"); return; }
      if (!store.ready || !store.id || store.readOnly) { say(fallbackMsg[0], fallbackMsg[1]); return; }
      btn.disabled = true; say("Sending…", "发送中…");
      try {
        var ref = store.db.doc("inbox/" + store.id);
        var snap = await ref.get();
        var prev = snap.exists && Array.isArray((snap.data() || {}).items) ? snap.data().items.slice() : [];
        prev.push({ text: text.slice(0, 2000), at: Date.now() });
        await ref.set({ name: name.slice(0, 80), contact: contact.slice(0, 120), items: prev.slice(-30), updatedAt: Date.now() });
        form.text.value = "";
        say("Sent. Thank you, I'll get back to you soon.", "已发送，谢谢！我会尽快回复你。", true);
      } catch (err) {
        if (err && err.code === "invalid_argument") {
          store.readOnly = true;
          say("Your access level can't leave messages here. Please email me instead.", "你当前的访问权限无法在这里留言，请改用邮箱联系我。");
        } else if (err && err.code === "resource_exhausted") {
          say("Too many messages in a short time. Please try again in a minute.", "发送太频繁了，请稍后再试。");
        } else {
          say("The message didn't send. Please try again, or email me.", "留言没有发送成功，请重试或改用邮箱。");
        }
      } finally { btn.disabled = false; }
    });
  }
})();
