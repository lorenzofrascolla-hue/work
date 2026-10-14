// Interactive panels for the research page. Every number comes from the version 39
// valuation model (research/files/SPG-Valuation-Model-v39.xlsx). No network, no storage.
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x); var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  function N(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }
  // Model inputs, sheet 07_Black_Scholes.
  var S = 55.062, K = 37.908, r = 0.044;
  function call(sig, T) { var d1 = (Math.log(S / K) + (r + sig * sig / 2) * T) / (sig * Math.sqrt(T)), d2 = d1 - sig * Math.sqrt(T); return { c: S * N(d1) - K * Math.exp(-r * T) * N(d2), d1: d1, d2: d2, intrinsic: S - K * Math.exp(-r * T) }; }

  var sig = $("#opt-sigma"), T = $("#opt-t");
  if (sig && T) {
    var out = function () {
      var s = Number(sig.value) / 100, t = Number(T.value), v = call(s, t);
      $("#opt-sigma-v").textContent = sig.value + "%";
      $("#opt-t-v").textContent = t + (t === 1 ? " year" : " years");
      $("#opt-c").textContent = "$" + v.c.toFixed(1) + "M";
      $("#opt-book").textContent = "$" + (v.c * 16).toFixed(0) + "M";
      $("#opt-time").textContent = "$" + (v.c - v.intrinsic).toFixed(1) + "M";
      var pct = Math.max(0, Math.min(100, v.intrinsic / v.c * 100));
      $("#opt-bar-i").style.width = pct + "%";
      $("#opt-share").textContent = pct.toFixed(0) + "% of the value is intrinsic";
      $("#opt-note").hidden = !(Number(sig.value) === 35 && t === 1);
    };
    sig.addEventListener("input", out); T.addEventListener("input", out); out();
  }

  // Sheet 09_Arrhenius: aging index (Northern Virginia = 1) and thermal life.
  var SITES = [["Phoenix", 3.122, 27.8], ["Miami-Dade", 2.722, 31.9], ["Dallas-Fort Worth", 1.958, 44.3], ["Northern Virginia", 1.0, 86.7], ["Stockholm", 0.506, 171.2], ["Helsinki", 0.451, 192.0], ["Reykjavik", 0.321, 270.4], ["Lulea", 0.312, 277.7]];
  var box = $("#aging-bars");
  if (box) {
    var mode = "index";
    var draw = function () {
      box.innerHTML = "";
      var max = mode === "index" ? 3.2 : 280;
      SITES.forEach(function (s) {
        var v = mode === "index" ? s[1] : s[2];
        var row = document.createElement("div"); row.className = "rbar" + (s[0] === "Miami-Dade" || s[0] === "Helsinki" ? " hi" : "");
        row.innerHTML = '<span class="rl"></span><span class="rt"><i></i></span><span class="rv mono"></span>';
        row.querySelector(".rl").textContent = s[0];
        row.querySelector("i").style.width = (v / max * 100) + "%";
        row.querySelector(".rv").textContent = mode === "index" ? v.toFixed(2) + "x" : v.toFixed(0) + " yrs";
        box.appendChild(row);
      });
    };
    document.querySelectorAll("[data-aging]").forEach(function (b) {
      b.addEventListener("click", function () { mode = b.getAttribute("data-aging"); document.querySelectorAll("[data-aging]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); draw(); $("#aging-cap").textContent = mode === "index" ? "Insulation aging rate relative to Northern Virginia, integrated over monthly climate normals. Miami ages 2.7x faster than Northern Virginia and 6.0x faster than Helsinki." : "Thermal life alone, in years at each site. No fleet lasts this long, so the paper uses expected life with other failure causes counted: 18.6 years in Miami, 29.6 in Northern Virginia, 36.5 in Helsinki, 38.7 in Lulea."; });
    });
    draw();
  }

  // The argument, step by step.
  var tabs = document.querySelectorAll(".arg-tabs button");
  tabs.forEach(function (b, i) {
    b.addEventListener("click", function () {
      tabs.forEach(function (x, j) { x.setAttribute("aria-selected", i === j ? "true" : "false"); x.tabIndex = i === j ? 0 : -1; });
      document.querySelectorAll(".arg-panel").forEach(function (p, j) { p.hidden = i !== j; });
    });
    b.addEventListener("keydown", function (e) { var n = tabs.length; if (e.key === "ArrowRight") { tabs[(i + 1) % n].click(); tabs[(i + 1) % n].focus(); } if (e.key === "ArrowLeft") { tabs[(i - 1 + n) % n].click(); tabs[(i - 1 + n) % n].focus(); } });
  });
})();
