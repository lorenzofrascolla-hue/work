// Guided tour over the dashboard replica. Spotlights one element at a time and
// waits for the reader to try things. No network, no storage.
(function () {
  "use strict";
  var shade, hl, pop, steps = [], i = -1, poll = null, onDone = null;
  function el(sel) { return document.querySelector(sel); }
  function build() {
    shade = document.createElement("div"); shade.className = "tour-shade"; shade.setAttribute("aria-hidden", "true");
    hl = document.createElement("div"); hl.className = "tour-hl"; shade.appendChild(hl);
    pop = document.createElement("div"); pop.className = "tour-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-modal", "false"); pop.setAttribute("aria-labelledby", "tour-h");
    document.body.appendChild(shade); document.body.appendChild(pop);
  }
  function place(target) {
    var r = target ? target.getBoundingClientRect() : null;
    if (r && !r.width && !r.height) r = null; // the target is on a hidden screen (a task switched tabs): no spotlight
    if (r) {
      var pad = 6;
      hl.style.top = (r.top - pad) + "px"; hl.style.left = (r.left - pad) + "px";
      hl.style.width = (r.width + pad * 2) + "px"; hl.style.height = (r.height + pad * 2) + "px"; hl.style.display = "block";
    } else { hl.style.display = "none"; }
    var w = pop.offsetWidth, h = pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    if (vw <= 640) { pop.style.left = ""; pop.style.top = ""; return; }
    // No visible target on a wide screen: keep the popover where it was, or centre it near the top if it has nowhere yet.
    if (!r) { if (!pop.style.left) { pop.style.left = Math.round((vw - w) / 2) + "px"; pop.style.top = "80px"; } return; }
    var left, top;
    if (r.right + 16 + w <= vw - 12) { left = r.right + 16; top = r.top; }
    else if (r.left - 16 - w >= 12) { left = r.left - 16 - w; top = r.top; }
    else if (r.bottom + 14 + h <= vh - 12) { left = Math.min(Math.max(12, r.left), vw - w - 12); top = r.bottom + 14; }
    else if (r.top - 14 - h >= 12) { left = Math.min(Math.max(12, r.left), vw - w - 12); top = r.top - 14 - h; }
    else { left = Math.max(12, Math.min(r.right, vw) - w - 12); top = Math.max(12, vh - h - 12); }
    if (top + h > vh - 12) top = Math.max(12, vh - h - 12);
    pop.style.left = left + "px"; pop.style.top = top + "px";
  }
  function render() {
    var s = steps[i], target = s.target ? el(s.target) : null;
    document.querySelectorAll(".tour-target").forEach(function (t) { t.classList.remove("tour-target"); });
    if (s.before) s.before();
    if (target) { target.classList.add("tour-target"); var tr = target.getBoundingClientRect(); var wide = tr.width > window.innerWidth * 0.55 || tr.height > window.innerHeight * 0.45; target.scrollIntoView({ block: wide ? "start" : "center", behavior: "auto" }); }
    pop.innerHTML = "";
    var stepP = document.createElement("p"); stepP.className = "step"; stepP.textContent = "Step " + (i + 1) + " of " + steps.length; pop.appendChild(stepP);
    var h = document.createElement("h2"); h.id = "tour-h"; h.textContent = s.title; pop.appendChild(h);
    s.body.forEach(function (t) { var p = document.createElement("p"); p.textContent = t; pop.appendChild(p); });
    var task = null;
    if (s.task) { task = document.createElement("p"); task.className = "task"; task.textContent = "Try it: " + s.task; pop.appendChild(task); }
    var btns = document.createElement("div"); btns.className = "btns";
    var back = document.createElement("button"); back.type = "button"; back.textContent = "Back"; back.disabled = i === 0;
    var next = document.createElement("button"); next.type = "button"; next.className = "next"; next.textContent = i === steps.length - 1 ? "Finish" : "Next";
    var skip = document.createElement("button"); skip.type = "button"; skip.className = "skip"; skip.textContent = "End tour";
    back.addEventListener("click", function () { go(i - 1); });
    next.addEventListener("click", function () { if (i === steps.length - 1) stop(); else go(i + 1); });
    skip.addEventListener("click", stop);
    btns.appendChild(back); btns.appendChild(next); btns.appendChild(skip); pop.appendChild(btns);
    if (poll) { clearInterval(poll); poll = null; }
    if (s.done) {
      var check = function () {
        if (s.done()) { task.classList.add("done"); task.textContent = "Done. " + ((typeof s.doneText === "function" ? s.doneText() : s.doneText) || "Press Next to continue."); clearInterval(poll); poll = null; place(target); }
      };
      if (s.done()) check(); else poll = setInterval(check, 400);
    }
    setTimeout(function () { place(target); h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }, 60);
    setTimeout(function () { place(target); }, 450);
  }
  function go(n) { i = Math.max(0, Math.min(steps.length - 1, n)); render(); }
  function stop() {
    document.documentElement.classList.remove("tour-on");
    document.querySelectorAll(".tour-target").forEach(function (t) { t.classList.remove("tour-target"); });
    if (poll) { clearInterval(poll); poll = null; }
    i = -1; if (onDone) onDone();
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
  document.addEventListener("keydown", function (e) { if (i < 0) return; if (e.key === "Escape") stop(); var a = document.activeElement, inPop = !a || a === document.body || !!a.closest(".tour-pop"); if (e.key === "ArrowRight" && inPop) go(i + 1); if (e.key === "ArrowLeft" && inPop) go(i - 1); });
  window.Tour = { start: start, stop: stop, active: function () { return i >= 0; } };
})();
