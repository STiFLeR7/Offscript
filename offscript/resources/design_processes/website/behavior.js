/* ════════════════════════════════════════════════════════════════
   Example Brand — Website behaviour library (house furniture)
   The design team's canonical interaction layer, embedded ONCE by the
   engine into every website deliverable (the JS twin of
   colors_and_type.css). Vanilla, self-contained, motion-safe, no CDN.
   Drives the markup hooks the design system composes:
     · reveal-on-scroll  — .reveal / [data-reveal] → .in / .is-visible
                            (opacity+rise; 1.5s safety net so static /
                            print renders never blank)
     · stat bars         — .sb-bar → .in (scaleX grow)
     · count-up          — .cr-count + data-target [data-decimals|prefix|suffix]
     · FAQ accordion     — .fq-list / [data-faq] · single-open · .fq-qa.open
     · how-it-works nav   — .hiw sticky aside centering + active-nav tracking
                            (.hiw-nav-item href ⇄ .hiw-panel id, or [data-go])
     · nav drawer toggle — [data-nav-toggle] ⇄ [data-nav-drawer]
   Authors emit the markup hooks; this script is auto-embedded — do NOT
   hand-write it in a fragment. Degrades no-JS-safe: without it the CSS
   resting state is fully visible, so a no-JS / print / static render is
   never blank.
   ════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  // idempotency guard — a second embed (or a stray author copy) is a no-op
  if (window.__crBehaviour) return;
  window.__crBehaviour = true;

  var root = document.documentElement;
  root.classList.add("has-js");
  root.classList.add("js"); // back-compat for [data-reveal] foundation hooks
  var reduce = false; try { reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  var IO = ("IntersectionObserver" in window);

  function mark(el) { el.classList.add("in"); el.classList.add("is-visible"); }

  /* ── 1) Unified reveal (per-element IO + 1.5s safety net) ───────────── */
  try {
    var targets = document.querySelectorAll(".reveal, [data-reveal], .sb-bar");
    function showAll() { targets.forEach(mark); }
    if (reduce || !IO) {
      showAll();
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { mark(e.target); io.unobserve(e.target); } });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
      targets.forEach(function (el) { io.observe(el); });
      setTimeout(showAll, 1500); // safety net: anything that never fires IO still shows
    }
  } catch (e) {}

  /* ── 2) Count-up — .cr-count + data-target [data-decimals|prefix|suffix] */
  function fmt(n, el) {
    var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var pre = el.getAttribute("data-prefix") || "", suf = el.getAttribute("data-suffix") || "", core;
    if (n >= 1e6) core = (n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, "") + "M";
    else if (n >= 1e3) core = Math.round(n / 1e3) + "K";
    else core = n.toFixed(dec);
    return pre + core + suf;
  }
  function runCount(el) {
    var target = parseFloat(el.getAttribute("data-target"));
    if (!isFinite(target)) return;
    if (reduce) { el.textContent = fmt(target, el); return; }
    var start = null, dur = 1500;
    function tick(ts) { if (!start) start = ts; var t = Math.min(1, (ts - start) / dur); var e = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * e, el); if (t < 1) requestAnimationFrame(tick); else el.textContent = fmt(target, el); }
    requestAnimationFrame(tick);
  }
  try {
    var counts = document.querySelectorAll(".cr-count");
    if (counts.length) {
      if (reduce || !IO) { counts.forEach(function (el) { el.textContent = fmt(parseFloat(el.getAttribute("data-target")), el); }); }
      else { var cio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); } }); }, { threshold: 0.6 }); counts.forEach(function (el) { cio.observe(el); }); }
    }
  } catch (e) {}

  /* ── 3) FAQ — single-open accordion (.fq-list) ──────────────────────── */
  try {
    document.querySelectorAll(".fq-list").forEach(function (list) {
      list.addEventListener("click", function (e) {
        var btn = e.target.closest(".fq-q"); if (!btn) return;
        var item = btn.parentElement, wasOpen = item.classList.contains("open");
        list.querySelectorAll(".fq-qa").forEach(function (el) {
          el.classList.remove("open");
          var q = el.querySelector(".fq-q"); if (q) q.setAttribute("aria-expanded", "false");
        });
        if (!wasOpen) { item.classList.add("open"); btn.setAttribute("aria-expanded", "true"); }
      });
    });
  } catch (e) {}

  /* ── 4) How-it-works — sticky aside centering + active-nav tracking ─── */
  try {
    document.querySelectorAll(".hiw").forEach(function (hiw) {
      var aside = hiw.querySelector(".hiw-aside");
      var panels = hiw.querySelectorAll(".hiw-panel");
      var navItems = hiw.querySelectorAll(".hiw-nav-item");
      var setHalf = function () { if (aside) aside.style.setProperty("--aside-half", (aside.offsetHeight / 2) + "px"); };
      setHalf();
      window.addEventListener("resize", setHalf);
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(setHalf); }
      if (IO && panels.length && navItems.length) {
        var navIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            var id = "#" + e.target.id;
            navItems.forEach(function (n) { n.classList.toggle("is-active", n.getAttribute("href") === id); });
          });
        }, { rootMargin: "-30% 0px -45% 0px" });
        panels.forEach(function (p) { navIO.observe(p); });
      }
      navItems.forEach(function (n) {
        n.addEventListener("click", function (ev) {
          ev.preventDefault();
          var t = hiw.querySelector(n.getAttribute("href"));
          if (t) t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        });
      });
    });
  } catch (e) {}

  /* ── 5) Nav drawer toggle ───────────────────────────────────────────── */
  try {
    var tg = document.querySelector("[data-nav-toggle]"), dr = document.querySelector("[data-nav-drawer]");
    if (tg && dr) {
      tg.addEventListener("click", function () {
        var open = !dr.hasAttribute("hidden");
        if (open) { dr.setAttribute("hidden", ""); tg.setAttribute("aria-expanded", "false"); }
        else { dr.removeAttribute("hidden"); tg.setAttribute("aria-expanded", "true"); }
      });
      dr.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { dr.setAttribute("hidden", ""); tg.setAttribute("aria-expanded", "false"); }); });
    }
  } catch (e) {}
})();
