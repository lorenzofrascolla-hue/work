// Walkthrough and chart hover for the demo page. No network requests. No storage.
(function () {
  "use strict";
  var root = document.documentElement;
  var steps = Array.prototype.slice.call(document.querySelectorAll(".step"));
  if (!steps.length) return;
  root.classList.add("js");

  var back = document.getElementById("step-back");
  var next = document.getElementById("step-next");
  var count = document.getElementById("step-count");
  var showAll = document.getElementById("show-all");
  var jump = Array.prototype.slice.call(document.querySelectorAll(".step-list button"));
  var current = 0;

  function show(i, focus) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (s, n) { s.hidden = n !== current; });
    jump.forEach(function (b, n) {
      if (n === current) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    back.disabled = current === 0;
    next.disabled = current === steps.length - 1;
    count.textContent = "Step " + (current + 1) + " of " + steps.length;
    if (focus) {
      var h = steps[current].querySelector("h2");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
      steps[current].scrollIntoView({ block: "start" });
    }
  }

  back.addEventListener("click", function () { show(current - 1, true); });
  next.addEventListener("click", function () { show(current + 1, true); });
  jump.forEach(function (b, n) { b.addEventListener("click", function () { show(n, true); }); });

  showAll.addEventListener("click", function () {
    var on = root.classList.toggle("all");
    steps.forEach(function (s, n) { s.hidden = on ? false : n !== current; });
    showAll.textContent = on ? "Show one step at a time" : "Show all five steps on one page";
    showAll.setAttribute("aria-pressed", on ? "true" : "false");
  });

  var m = /^#step-(\d)$/.exec(window.location.hash);
  show(m ? parseInt(m[1], 10) - 1 : 0, false);

  // Chart hover: a vertical guide and a small readout.
  var box = document.getElementById("chart-box");
  var dataEl = document.getElementById("chart-data");
  if (!box || !dataEl) return;
  var svg = box.querySelector("svg");
  var tip = document.getElementById("chart-tip");
  var guide = document.getElementById("chart-guide");
  var d;
  try { d = JSON.parse(dataEl.textContent); } catch (e) { return; }

  function place(evt) {
    var r = svg.getBoundingClientRect();
    var x = ((evt.clientX - r.left) / r.width) * d.w;
    var best = 0, gap = Infinity;
    for (var i = 0; i < d.pts.length; i++) {
      var g = Math.abs(d.pts[i][0] - x);
      if (g < gap) { gap = g; best = i; }
    }
    var p = d.pts[best];
    guide.setAttribute("x1", p[0]); guide.setAttribute("x2", p[0]);
    guide.style.display = "block";
    tip.textContent = "";
    var lines = [p[1], "Paper portfolio: " + p[2], "S&P 500: " + p[3]];
    lines.forEach(function (t, n) {
      var el = document.createElement(n === 0 ? "strong" : "span");
      el.textContent = t; el.style.display = "block"; tip.appendChild(el);
    });
    tip.style.display = "block";
    var px = (p[0] / d.w) * r.width;
    var left = px + 12;
    if (left + tip.offsetWidth > r.width) left = px - tip.offsetWidth - 12;
    tip.style.left = Math.max(0, left) + "px";
    tip.style.top = "8px";
  }
  function hide() { tip.style.display = "none"; guide.style.display = "none"; }

  svg.addEventListener("pointermove", place);
  svg.addEventListener("pointerdown", place);
  svg.addEventListener("pointerleave", hide);
})();
