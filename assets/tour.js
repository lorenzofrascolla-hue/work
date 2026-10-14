// Guided tour over the dashboard replica. Spotlights one element at a time and
// waits for the reader to try things. No network, no storage.
(function () {
  "use strict";
  var shade, hl, pop, steps = [], i = -1, poll = null, onDone = null, mini = false, moved = null;
  function el(sel) { return document.querySelector(sel); }
  function build() {
    shade = document.createElement("div"); shade.className = "tour-shade"; shade.setAttribute("aria-hidden", "true");
    hl = document.createElement("div"); hl.className = "tour-hl"; shade.appendChild(hl);
    pop = document.createElement("div"); pop.className = "tour-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-modal", "false"); pop.setAttribute("aria-labelledby", "tour-h");
    document.body.appendChild(shade); document.body.appendChild(pop);
  }
  function place(target) {
    var s = i >= 0 ? steps[i] : null;
    var bn = document.querySelector(".banner"), bnB = bn ? bn.getBoundingClientRect().bottom : 0;
    var r = target ? target.getBoundingClientRect() : null;
    if (r && !r.width && !r.height) r = null; // the target is on a hidden screen (a task switched tabs): no spotlight
    if (r && r.bottom < bnB + 40) r = null; // all but a sliver of the target has scrolled up under the sticky banner (a look-up scrolled the page): no spotlight, so the dimmer does not grey out what the reader just opened
    if (r) {
      var pad = 6;
      hl.style.top = (r.top - pad) + "px"; hl.style.left = (r.left - pad) + "px";
      hl.style.width = (r.width + pad * 2) + "px"; hl.style.height = (r.height + pad * 2) + "px"; hl.style.display = "block";
    } else { hl.style.display = "none"; }
    var w = pop.offsetWidth, h = pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    pop.classList.remove("docked");
    if (mini) { pop.style.left = ""; pop.style.top = ""; return; }
    // Wide screens: the guide docks in a column to the right of the dashboard (the dashboard narrows to make room), so it never sits on top of the data.
    if (vw >= 1024 && !moved) { pop.classList.add("docked"); pop.style.left = ""; pop.style.top = ""; return; }
    if (vw <= 640) { pop.style.left = ""; pop.style.top = ""; return; }
    // The reader dragged the box somewhere: keep it there for every later step (kept inside the window).
    if (moved) { pop.style.left = Math.max(8, Math.min(vw - w - 8, moved.left)) + "px"; pop.style.top = Math.max(8, Math.min(vh - h - 8, moved.top)) + "px"; return; }
    // No visible target on a wide screen: keep the popover where it was, or centre it near the top if it has nowhere yet.
    if (!r) { if (!pop.style.left) { pop.style.left = Math.round((vw - w) / 2) + "px"; pop.style.top = "80px"; } return; }
    var left, top;
    if (r.right + 16 + w <= vw - 12) { left = r.right + 16; top = r.top; }
    else if (r.left - 16 - w >= 12) { left = r.left - 16 - w; top = r.top; }
    else if (r.bottom + 14 + h <= vh - 12) { left = Math.min(Math.max(12, r.left), vw - w - 12); top = r.bottom + 14; }
    else if (r.top - 14 - h >= 12) { left = Math.min(Math.max(12, r.left), vw - w - 12); top = r.top - 14 - h; }
    else {
      // Last resort: a corner of a target that fills the screen. Bottom-right by default; a step can ask for bottom-left (corner: "left") when the right end of its target is the part to keep clear.
      left = s && s.corner === "left" ? Math.max(12, Math.min(r.left, vw - w - 12)) : Math.max(12, Math.min(r.right, vw) - w - 12);
      top = Math.max(12, vh - h - 12);
    }
    // A step can name an element the popover must not cover (clear: selector); when they would overlap, the popover moves below it.
    var c = s && s.clear ? el(s.clear) : null;
    if (c) { var cr = c.getBoundingClientRect(); if (cr.height && top < cr.bottom + 14 && top + h > cr.top) top = cr.bottom + 14; }
    // Clamped on both edges, below the sticky demo banner: a tall spotlighted card scrolled past the top must not carry the buttons off screen with it.
    var minTop = bn ? Math.max(12, bnB + 8) : 12;
    top = Math.max(minTop, Math.min(top, vh - h - 12));
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  // On a phone the popover is pinned at the bottom. A step can name the element its task is about (keep: selector); when that element
  // would sit under the popover and it fits between the banner and the popover, the page scrolls down just enough to show all of it.
  function keepClear(s) {
    if (window.innerWidth > 640 || !s.keep) return;
    var k = el(s.keep); if (!k) return;
    var kr = k.getBoundingClientRect(), pt = pop.getBoundingClientRect().top;
    var bn = document.querySelector(".banner"), bnB = bn ? bn.getBoundingClientRect().bottom : 0;
    var over = kr.bottom - (pt - 8);
    if (over > 0 && kr.top - over >= bnB + 8) window.scrollBy(0, over);
  }
  function render() {
    var s = steps[i];
    document.querySelectorAll(".tour-target").forEach(function (t) { t.classList.remove("tour-target"); });
    // before() runs first: it may create the step's target (step 4 reopens the company after a not-found look-up).
    if (s.before) s.before();
    var target = s.target ? el(s.target) : null;
    if (target) { target.classList.add("tour-target"); var tr = target.getBoundingClientRect(); var wide = window.innerWidth <= 640 || tr.width > window.innerWidth * 0.55 || tr.height > window.innerHeight * 0.45; target.scrollIntoView({ block: wide ? "start" : "center", behavior: "auto" }); }
    pop.innerHTML = "";
    var bar = document.createElement("div"); bar.className = "tour-bar";
    var stepP = document.createElement("p"); stepP.className = "step"; stepP.textContent = "Step " + (i + 1) + " of " + steps.length;
    var grip = document.createElement("span"); grip.className = "grip"; grip.setAttribute("aria-hidden", "true"); grip.title = "Drag to move"; grip.textContent = "\u2725 move";
    var mb = document.createElement("button"); mb.type = "button"; mb.className = "mini-btn"; mb.textContent = mini ? "Show" : "Minimize"; mb.setAttribute("aria-expanded", mini ? "false" : "true");
    mb.addEventListener("click", function () { mini = !mini; document.documentElement.classList.toggle("tour-min", mini); render(); });
    bar.appendChild(stepP); bar.appendChild(grip); bar.appendChild(mb); pop.appendChild(bar);
    bar.addEventListener("pointerdown", function (e) {
      if (mini || window.innerWidth <= 640 || e.target.closest("button")) return;
      var r0 = pop.getBoundingClientRect(), dx = e.clientX - r0.left, dy = e.clientY - r0.top;
      function mv(ev) { moved = { left: ev.clientX - dx, top: ev.clientY - dy }; place(null); }
      function up() { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); e.preventDefault();
    });
    var h = document.createElement("h2"); h.id = "tour-h"; h.textContent = s.title; pop.appendChild(h);
    // On a phone the explanation folds behind "Read more" so the box stays short and the data above it stays visible.
    var body = document.createElement("div"); body.className = "tbody";
    s.body.forEach(function (t) { var p = document.createElement("p"); p.textContent = t; body.appendChild(p); });
    pop.appendChild(body);
    if (window.innerWidth <= 640) {
      var more = document.createElement("button"); more.type = "button"; more.className = "more-btn"; more.textContent = "Read more"; more.setAttribute("aria-expanded", "false");
      body.hidden = true;
      more.addEventListener("click", function () { body.hidden = !body.hidden; more.textContent = body.hidden ? "Read more" : "Read less"; more.setAttribute("aria-expanded", body.hidden ? "false" : "true"); });
      pop.insertBefore(more, body);
    }
    var task = null;
    if (s.task) { task = document.createElement("p"); task.className = "task"; task.textContent = "Try it: " + s.task; pop.appendChild(task); }
    var btns = document.createElement("div"); btns.className = "btns";
    var back = document.createElement("button"); back.type = "button"; back.textContent = "Back"; back.disabled = i === 0;
    // "Go to it" moves keyboard focus straight to the control the task names, instead of a long Shift+Tab walk back through the page.
    var jump = null;
    if (s.task && s.focus && target) { jump = document.createElement("button"); jump.type = "button"; jump.className = "jump"; jump.textContent = "Go to it"; jump.addEventListener("click", function () { var f = el(s.focus); if (f) f.focus(); }); }
    var next = document.createElement("button"); next.type = "button"; next.className = "next"; next.textContent = i === steps.length - 1 ? "Finish" : "Next";
    var skip = document.createElement("button"); skip.type = "button"; skip.className = "skip"; skip.textContent = "End tour";
    back.addEventListener("click", function () { go(i - 1); });
    next.addEventListener("click", function () { if (i === steps.length - 1) stop(); else go(i + 1); });
    skip.addEventListener("click", stop);
    btns.appendChild(back); if (jump) btns.appendChild(jump); btns.appendChild(next); btns.appendChild(skip); pop.appendChild(btns);
    if (poll) { clearInterval(poll); poll = null; }
    if (s.done) {
      var check = function () {
        if (s.done()) { task.classList.add("done"); task.textContent = "Done. " + ((typeof s.doneText === "function" ? s.doneText() : s.doneText) || "Press Next to continue."); clearInterval(poll); poll = null; place(target); }
      };
      if (s.done()) check(); else poll = setInterval(check, 400);
    }
    setTimeout(function () { keepClear(s); place(target); h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }, 60);
    setTimeout(function () { place(target); }, 450);
  }
  function go(n) { i = Math.max(0, Math.min(steps.length - 1, n)); render(); }
  function stop() {
    document.documentElement.classList.remove("tour-on");
    document.querySelectorAll(".tour-target").forEach(function (t) { t.classList.remove("tour-target"); });
    if (poll) { clearInterval(poll); poll = null; }
    i = -1; mini = false; moved = null; document.documentElement.classList.remove("tour-min"); if (onDone) onDone();
  }
  function start(list, opts) {
    steps = list; onDone = opts && opts.onDone;
    if (!shade) build();
    document.documentElement.classList.add("tour-on");
    go(0);
  }
  window.addEventListener("resize", function () { if (i >= 0) place(steps[i].target ? el(steps[i].target) : null); });
  // On phones place() only moves the spotlight (the popover is pinned by CSS), so it runs on scroll at every width.
  window.addEventListener("scroll", function () { if (i >= 0) place(steps[i].target ? el(steps[i].target) : null); }, { passive: true });
  // Arrow keys step the tour only when focus is in the popover or on the page body, so the screen tabs keep their own arrow keys.
  // Escape closes the glossary when it is open (the page's own handler); it ends the tour only when no drawer is open, so one key press does not do both.
  document.addEventListener("keydown", function (e) { if (i < 0) return; if (e.key === "Escape" && !document.querySelector(".drawer.on")) stop(); var a = document.activeElement, inPop = !a || a === document.body || !!a.closest(".tour-pop"); if (e.key === "ArrowRight" && inPop) go(i + 1); if (e.key === "ArrowLeft" && inPop) go(i - 1); });
  window.Tour = { start: start, stop: stop, active: function () { return i >= 0; } };
})();
