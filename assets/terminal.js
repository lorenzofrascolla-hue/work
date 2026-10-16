// The dashboard replica. Renders every surface from two saved data files.
// Nothing here talks to a server: no API calls, no storage, no live system.
(function () {
  "use strict";
  var R, PX, SPY, cur = null, viewed = [], state = { explainAll: false, hovered: false };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var h = function (tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") e.className = attrs[k]; else if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k]; else if (k.indexOf("on") === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (k) { if (k == null) return; e.appendChild(typeof k === "string" ? document.createTextNode(k) : k); });
    return e;
  };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function dshort(iso) { var p = iso.split("-"); return parseInt(p[2], 10) + " " + MON[parseInt(p[1], 10) - 1] + " " + p[0]; }
  function usd(x, d) { x = Number(x); var s = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); return (x < 0 ? "−$" : "$") + s; }
  // A value that rounds to zero carries no sign, so a tiny loss never prints as "−0.0%".
  function pct(x, d, sign) { if (x == null || isNaN(x)) return "n/a"; var v = Number(x); var s = Math.abs(v).toFixed(d == null ? 1 : d); var zero = Number(s) === 0; return (v < 0 && !zero ? "−" : (sign && v > 0 && !zero ? "+" : "")) + s + "%"; }
  function cls(x) { return x > 0.0005 ? "up" : x < -0.0005 ? "down" : "flat"; }
  function num(x, d) { return x == null || isNaN(x) ? "n/a" : Number(x).toLocaleString("en-US", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function mcap(m) { if (m == null) return "n/a"; if (m >= 1e6) return "$" + (m / 1e6).toFixed(1) + "T"; if (m >= 1000) return "$" + (m >= 10000 ? Math.round(m / 1000).toLocaleString("en-US") : (m / 1000).toFixed(1)) + "B"; return "$" + m.toFixed(0) + "M"; }
  var NODATA = String.fromCharCode(8212); // the saved research run stores this dash for "no rating"; it is compared against, never rendered
  var DASH_RE = new RegExp("\\s*" + NODATA + "\\s*", "g"); // three saved thesis lines carry the same dash as a separator; it is rendered as a colon
  function plain(s) { return (s || "").replace(DASH_RE, ": "); }
  var narrow = function () { return window.innerWidth <= 640; };
  var SMOOTH = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  function focusCard(c) { var hh = $("h3", c); if (hh) { hh.setAttribute("tabindex", "-1"); hh.focus({ preventScroll: true }); } }
  function co(t) { t = (t || "").toUpperCase().trim(); for (var i = 0; i < R.companies.length; i++) if (R.companies[i].ticker === t) return R.companies[i]; return null; }
  function series(t) { var s = PX.series[t]; return s ? s : null; }

  // ---------- small SVG line chart ----------
  function lineChart(o) {
    var W = o.w || 480, H = o.h || 200, ML = o.ml || 40, MR = o.mr || 14, MT = 12, MB = 26, FS = o.fs || 10, MFS = o.mfs || 9, PFS = o.pfs || 11;
    var all = []; o.series.forEach(function (s) { all = all.concat(s.values.filter(function (v) { return v != null; })); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (o.ylo != null) lo = Math.min(lo, o.ylo); if (o.yhi != null) hi = Math.max(hi, o.yhi);
    var step = o.step || niceStep(hi - lo); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step; if (hi === lo) hi = lo + step;
    var n = o.dates.length; var X = function (i) { return ML + i / Math.max(1, n - 1) * (W - ML - MR); }; var Y = function (v) { return MT + (hi - v) / (hi - lo) * (H - MT - MB); };
    var g = "";
    for (var v = lo; v <= hi + 1e-9; v += step) { g += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="' + (o.base != null && Math.abs(v - o.base) < 1e-9 ? "#5f6c82" : "#1f2d40") + '"/><text x="' + (ML - 6) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end" font-size="' + FS + '" fill="#8e9bb0">' + (o.yfmt ? o.yfmt(v) : v) + "</text>"; }
    var ticks = o.ticks || autoTicks(o.dates);
    // keep only as many month labels as the canvas width can hold without overlap (matters on the phone-sized canvases)
    ticks = thinTicks(ticks, o.dates, Math.max(3, Math.floor((W - ML - MR) / (FS * 2.6))));
    ticks.forEach(function (t) { var i = o.dates.indexOf(t.date); if (i < 0) return; g += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="' + FS + '" fill="#8e9bb0">' + t.label + "</text>"; });
    (o.markers || []).forEach(function (m, k) { var i = nearest(o.dates, m.date); if (i < 0) return; var x = X(i); g += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (MT + 10) + '" y2="' + (H - MB) + '" stroke="#c9a7ff" stroke-width="1.6" stroke-dasharray="2 4" opacity="0.9"/><circle cx="' + x.toFixed(1) + '" cy="' + (MT + 2) + '" r="9" fill="#c9a7ff"/><text x="' + x.toFixed(1) + '" y="' + (MT + 6.5) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#06080f">' + (k + 1) + '</text>' + (o.markerLabels === false ? "" : '<text x="' + (x + 13).toFixed(1) + '" y="' + (MT + 6.5) + '" font-size="' + (MFS + 2) + '" font-weight="600" fill="#e2d1ff">' + m.short + "</text>"); });
    o.series.forEach(function (s) {
      var d = ""; s.values.forEach(function (v, i) { if (v == null) return; d += (d ? " L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); });
      g += '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.width || 1.8) + '"' + (s.dash ? ' stroke-dasharray="5 4"' : "") + ' stroke-linejoin="round"/>';
      var li = s.values.length - 1; while (li >= 0 && s.values[li] == null) li--;
      if (s.label !== false && li >= 0) g += '<circle cx="' + X(li).toFixed(1) + '" cy="' + Y(s.values[li]).toFixed(1) + '" r="3.5" fill="' + s.color + '"/>';
    });
    if (o.peak) { var pi = o.dates.indexOf(o.peak.date); if (pi >= 0) { var pv = o.peak.value; g += '<circle cx="' + X(pi).toFixed(1) + '" cy="' + Y(pv).toFixed(1) + '" r="5" fill="none" stroke="#ffb84d" stroke-width="2"/><text x="' + (X(pi) - 9).toFixed(1) + '" y="' + (Y(pv) + 20).toFixed(1) + '" text-anchor="end" font-size="' + PFS + '" font-weight="700" fill="#ffb84d">' + o.peak.label + "</text>"; } }
    g += '<line class="guide" x1="0" x2="0" y1="' + MT + '" y2="' + (H - MB) + '" stroke="#eef2f8" stroke-width="1" style="display:none"/>';
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + (o.aria || "chart") + '" style="touch-action:pan-y">' + g + "</svg>";
    return { svg: svg, X: X, W: W };
  }
  function niceStep(r) { var raw = r / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function nearest(dates, d) { if (dates.indexOf(d) >= 0) return dates.indexOf(d); for (var i = 0; i < dates.length; i++) if (dates[i] > d) return i; return -1; }
  // One tick per month; the first tick and every January carry the year, so a chart longer than a year still says which year is which.
  function autoTicks(dates) { var out = [], last = ""; dates.forEach(function (d) { var m = d.slice(0, 7); if (m !== last) { out.push({ date: d, label: MON[parseInt(d.slice(5, 7), 10) - 1] + (d.slice(5, 7) === "01" || !out.length ? " " + d.slice(2, 4) : "") }); last = m; } }); return out; }
  // Keeps at most `max` labels, one slot apart: the year-bearing ones first (they are wider, so they claim more room), then the rest wherever a slot is free.
  function thinTicks(ticks, dates, max) {
    var gap = dates.length / max, kept = [], idx = function (t) { return dates.indexOf(t.date); }, yr = function (t) { return /\d/.test(t.label); };
    ticks.filter(yr).concat(ticks.filter(function (t) { return !yr(t); })).forEach(function (t) { var i = idx(t); if (kept.every(function (k) { return Math.abs(idx(k) - i) >= gap * (yr(t) || yr(k) ? 1.3 : 1); })) kept.push(t); });
    return kept.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function spark(t, w, hh) {
    var s = series(t); if (!s) return "";
    var c = s.close, lo = Math.min.apply(null, c), hi = Math.max.apply(null, c), n = c.length, W = w || 120, H = hh || 32;
    var d = ""; c.forEach(function (v, i) { d += (i ? " L" : "M") + (i / (n - 1) * W).toFixed(1) + " " + (H - 2 - (v - lo) / (hi - lo || 1) * (H - 4)).toFixed(1); });
    return '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-hidden="true" style="width:' + W + 'px;height:' + H + 'px;display:inline-block;vertical-align:middle"><path d="' + d + '" fill="none" stroke="' + (c[n - 1] >= c[0] ? "#5fa98c" : "#e06464") + '" stroke-width="1.5"/></svg>';
  }
  function chg(t, k) { var c = co(t); return c && c.tech ? c.tech[k] : null; }

  // ---------- card scaffolding ----------
  var INFO = {}; // id -> explanation text, filled by cards()
  function card(id, title, info, badge, body, extra) {
    var c = h("div", { class: "card" + (extra && extra.wide ? " wide" : extra && extra.two ? " two" : ""), id: "card-" + id });
    // The heading holds only the title, so a screen reader's headings list does not read the ? button and the badge as part of the name.
    var head = h("div", { class: "head" });
    head.appendChild(h("h3", null, [h("span", { text: title })]));
    if (info) { INFO[id] = info; var b = h("button", { class: "info", type: "button", "aria-expanded": "false", "aria-controls": "explain-" + id, "aria-label": "What is " + title + "?", text: "?" }); b.addEventListener("click", function () { var ex = $(".explain", c); var on = ex.hidden; ex.hidden = !on; b.setAttribute("aria-expanded", on ? "true" : "false"); }); head.appendChild(b); }
    if (badge) head.appendChild(h("span", { class: "badge " + badge.cls, text: badge.text }));
    c.appendChild(head);
    if (info) c.appendChild(h("div", { class: "explain", id: "explain-" + id, hidden: "", text: info }));
    (Array.isArray(body) ? body : [body]).forEach(function (k) { if (k) c.appendChild(typeof k === "string" ? h("div", { html: k }) : k); });
    return c;
  }
  var SNAP = { cls: "snap", text: "Snapshot" }, DEMO = { cls: "demo", text: "Demo" }, LIVEONLY = { cls: "off", text: "Live data only" }, OFF = { cls: "off", text: "Off in demo" };
  // The panels that need live feeds are listed in one collapsed card per screen (name and one-line description each), not as a wall of placeholder boxes.
  function notHereGroup(id, title, summary, items) {
    var ul = h("ul", { class: "panels" });
    items.forEach(function (x) { ul.appendChild(h("li", null, [h("strong", { text: x[1] }), ": " + x[2]])); });
    return card(id, title, "Every panel listed here exists on the real dashboard, where it runs on live market, news, macro or filing feeds. None of them is computed in this snapshot, so the list says what the dashboard has; it is not evidence of how well each panel works.", LIVEONLY, h("details", null, [h("summary", { text: summary }), ul]), { wide: true });
  }
  function scanDateNote() { return R.scan.date === R.snapshot ? "" : " The saved file dates this scan " + dshort(R.scan.date) + "; prices and the account are as of " + dshort(R.snapshot) + "."; }
  // The same three tiles on the Floor and the Trade Desk. The scan is dated the morning after the snapshot, and the tile says so itself.
  function scanKpis(colour) { return kpis([{ l: "Scanned", v: String(R.scan.scanned), s: dshort(R.scan.date) + (R.scan.date === R.snapshot ? "" : " (the morning after the snapshot)") + " · research list plus large companies" }, { l: "Cleared all 13", v: String(R.scan.clearsAll), cls: colour && R.scan.clearsAll ? "up" : "" }, { l: "Near misses", v: String(R.scan.nearMisses), s: "by the system's own count; its rule for what counts as a near miss is not in the saved files" }]); }
  function kpis(list) { var k = h("div", { class: "kpis" }); list.forEach(function (x) { var d = h("div", { class: "kpi" }); d.appendChild(h("div", { class: "l", text: x.l })); d.appendChild(h("div", { class: "v " + (x.cls || ""), text: x.v })); if (x.s) d.appendChild(h("div", { class: "s", text: x.s })); k.appendChild(d); }); return k; }
  function table(head, rows, opts) {
    var t = h("table"), tr = h("tr"); head.forEach(function (c) { tr.appendChild(h("th", { scope: "col", class: c.num ? "num" : "", text: c.t })); }); t.appendChild(h("thead", null, [tr]));
    var tb = h("tbody"); rows.forEach(function (r) { var row = h("tr"); r.forEach(function (c, i) { var cell = h(i === 0 && opts && opts.rowhead ? "th" : "td", { class: (head[i].num ? "num " : "") + (c && c.cls ? c.cls : "") }); if (i === 0 && opts && opts.rowhead) cell.setAttribute("scope", "row"); if (c && c.html != null) cell.innerHTML = c.html; else cell.textContent = c && c.t != null ? c.t : (c == null ? "" : c); row.appendChild(cell); }); tb.appendChild(row); }); t.appendChild(tb);
    var wrap = h("div", { class: "tscroll" }, [t]); if (opts && opts.caption) wrap.insertBefore(h("div", { class: "note", text: opts.caption }), t); return wrap;
  }

  // ---------- surfaces ----------
  var SURF = [
    { id: "floor", label: "Floor", lead: "The market tape: prices, the market regime, the thesis list and the morning scan in one view." },
    { id: "research", label: "Research", lead: "Single-name research. Type a ticker, or pick one from the list, and the dashboard pulls its fundamentals, forensic checks, valuation and the 13-gate entry test." },
    { id: "portfolio", label: "Portfolio & Risk", lead: "The paper account and its risk: holdings, the equity curve against the S&P 500, and the risk tools." },
    { id: "quant", label: "Quant Lab", lead: "The bench: the backtest, the entry gauntlet across the whole list, the factor model and the screens." },
    { id: "trade", label: "Trade Desk", lead: "Where simulated orders are planned and checked. Order entry is switched off in this demo." },
  ];
  function floorCards(g) {
    var cs = R.companies;
    // tape
    var rows = cs.slice().sort(function (a, b) { return b.tech.ret1d - a.tech.ret1d; }).map(function (c) { return [{ html: '<button type="button" class="link tk" data-open="' + c.ticker + '">' + c.ticker + "</button> <span class=\"dim\">" + c.name + "</span>" }, { t: usd(c.tech.price, 2) }, { t: pct(c.tech.ret1d * 100, 1, true), cls: cls(c.tech.ret1d) }, { t: pct(c.tech.ret1m * 100, 1, true), cls: cls(c.tech.ret1m) }, { t: pct(c.tech.ret3m * 100, 1, true), cls: cls(c.tech.ret3m) }, { t: pct(c.tech.fromHigh * 100, 1, true), cls: cls(c.tech.fromHigh) }, { html: c.held ? '<span class="pill ok">held</span>' : "" }]; });
    g.appendChild(h("div", { class: "sec", text: "Market tape" }));
    g.appendChild(card("tape", "Market tape · research list", "Every company on the research list with its last price and recent moves, from official daily closes. On the live dashboard this streams during market hours; here it is frozen at 12 October 2026. Click a ticker to open it in Research.", SNAP,
      table([{ t: "Company" }, { t: "Last", num: 1 }, { t: "1 day", num: 1 }, { t: "1 month", num: 1 }, { t: "3 months", num: 1 }, { t: "vs 52-wk high", num: 1 }, { t: "Held" }], rows, { rowhead: true }), { wide: true }));
    g.appendChild(h("div", { class: "sec", text: "Regime and signals" }));
    var rg = R.regime;
    // The saved files do not define what the breaker counts as risk; the run's log shows it bought the index fund while the breaker was tripped, so the note states that record rather than a definition.
    g.appendChild(card("regime", "Market regime detection", "The system reads trend and volatility from daily prices and labels the environment. It also carries a circuit breaker: when the account falls too far behind the index, the breaker trips and the automated run stops adding risk until the rules re-arm it. What counts as risk for that rule is not defined in the saved files; the run's log shows that, with the breaker tripped, it still bought $565,203 of the index fund on 4 September 2026 (reason recorded: \"completion sleeve\"). The Performance chart marks that buy.", SNAP, [
      kpis([{ l: "Trend", v: rg.trend, cls: rg.trend === "Bull" ? "up" : "down" }, { l: "Volatility", v: rg.volHigh ? "High" : "Normal" }, { l: "Circuit breaker", v: rg.breaker.active ? "Tripped" : "Armed", cls: rg.breaker.active ? "down" : "up", s: rg.breaker.active ? "since " + dshort(rg.breaker.setAt) + " (" + (({ "alpha-drop": "fell too far behind the index" })[rg.breaker.trigger] || rg.breaker.trigger.replace("-", " ")) + ")" : "" }, { l: "Risk rung", v: (rg.rung * 100).toFixed(0) + "%", s: "of full active exposure" }]),
      h("p", { class: "note", text: rg.newsShock.active ? "News-shock gate active since " + dshort(rg.newsShock.setAt) + " (level " + rg.newsShock.severity + " on the system's scale, about " + rg.newsShock.topics.map(function (t) { return ({ ai: "AI" })[t] || t; }).join(", ") + " headlines" + (rg.newsShock.setAt === R.snapshot ? "" : "; the saved file dates this " + dshort(rg.newsShock.setAt) + ", while prices and the account are as of " + dshort(R.snapshot)) + "): adding risk is capped while market-moving headlines are fresh." : "No news-shock gate active." })]));
    var sp = series("SPY"), n = sp.close.length, last = sp.close[n - 1];
    g.appendChild(card("spx", "S&P 500 · index fund (SPY)", "The benchmark the paper account is judged against. SPY is a fund that tracks the S&P 500, an index of 500 large US companies.", SNAP, [
      kpis([{ l: "Last close", v: usd(last, 2), s: dshort(sp.dates[n - 1]) }, { l: "1 month", v: pct((last / sp.close[n - 22] - 1) * 100, 1, true), cls: cls(last / sp.close[n - 22] - 1) }, { l: "3 months", v: pct((last / sp.close[n - 64] - 1) * 100, 1, true), cls: cls(last / sp.close[n - 64] - 1) }, { l: "Since " + dshort(sp.dates[0]), v: pct((last / sp.close[0] - 1) * 100, 1, true), cls: cls(last / sp.close[0] - 1) }]),
      h("div", { html: spark("SPY", 260, 44) })]));
    g.appendChild(card("scan", "Daily scan", "Every morning the system runs the 13-gate entry test across the research list plus a set of large companies and reports which names clear every gate." + scanDateNote(), SNAP, scanKpis(true)));
    g.appendChild(h("div", { class: "sec", text: "Thesis" }));
    var bySec = {}; cs.forEach(function (c) { (bySec[c.sector] = bySec[c.sector] || []).push(c); });
    var tl = h("div"); Object.keys(bySec).forEach(function (s) { var p = h("p"); p.appendChild(h("strong", { text: s + " (" + bySec[s].length + "): " })); bySec[s].forEach(function (c, i) { var b = h("button", { type: "button", class: "tk", "data-open": c.ticker, text: c.ticker }); p.appendChild(b); p.appendChild(document.createTextNode(" " + c.theme + (i < bySec[s].length - 1 ? " · " : ""))); }); tl.appendChild(p); });
    g.appendChild(card("spg", "Silicon-Power Gap (SPG) thesis · the research list", "SPG is the Silicon-Power Gap, my research paper. These are 25 US-listed companies chosen around its thesis: the makers of transformers, switchgear and grid equipment, the power producers, the data-center landlords and the chip and server suppliers. Each carries a one-line thesis you can read in Research.", SNAP, tl, { two: true }));
    g.appendChild(h("div", { class: "sec", text: "Live-data panels (not computed in this snapshot)" }));
    var fl = [["macro", "Macro terminal", "Inflation, the Fed funds rate and Treasury yields from the Federal Reserve's FRED feed, with the yield-curve slope."], ["vix", "VIX and volatility risk premium", "Implied volatility (the VIX) against realised volatility, to read whether the market is paying up for protection."], ["pca", "Yield-curve PCA and rate shock", "Breaks the Treasury curve into level, slope and curvature and tests the book against a rate shock."], ["roro", "Cross-asset risk-on / risk-off", "A composite of equities, credit, the dollar and gold that reads the market's appetite for risk."], ["surprise", "Macro surprise nowcast", "Compares growth and inflation data against expectations to read where the economy is surprising."], ["short", "Short interest and squeeze radar", "Short interest, days-to-cover and float for each name, to flag crowded shorts."], ["kronos", "Kronos forecasts", "A statistical model that puts odds on each name closing higher over the next month. The panel is not drawn here; its saved odds are in the snapshot and feed gate 6."], ["news", "News sentiment feed", "Headlines for the research list scored for tone."], ["attention", "Abnormal news-attention detector", "Flags a name when its daily article count jumps far above its own average."], ["catalysts", "Catalyst radar · SEC 8-K", "Material-event filings (8-K) pulled from SEC EDGAR for every name on the list."], ["insider", "Insider flow", "Form 4 filings: what executives and directors bought or sold."], ["peers", "Competitors", "Each name's closest listed competitors and how they compare."], ["brief", "Daily brief", "A short morning note on movers, macro and the book, written by a language model from the day's data and labelled as such."]];
    g.appendChild(notHereGroup("liveonly-floor", "Live-data panels · not computed here", fl.length + " panels need live market, news or macro feeds and are not computed in this snapshot: show the list", fl));
  }

  function researchCards(g) {
    var box = h("div", { class: "search" });
    box.appendChild(h("label", { for: "tick", text: "Look up a company (25 on the list)" }));
    var inp = h("input", { id: "tick", type: "text", placeholder: "e.g. GEV, then press Enter", autocomplete: "off", spellcheck: "false", "aria-describedby": "tick-help" });
    var btn = h("button", { class: "tbtn", type: "button", text: "Look up" });
    box.appendChild(inp); box.appendChild(btn);
    var sug = h("ul", { class: "sugg", "aria-label": "Companies in this snapshot" });
    R.companies.forEach(function (c) { sug.appendChild(h("li", null, [h("button", { type: "button", "data-open": c.ticker, text: c.ticker })])); });
    box.appendChild(sug);
    box.appendChild(h("p", { id: "tick-help", class: "note", text: "This snapshot carries the 25 companies on the research list." }));
    g.appendChild(box);
    var holder = h("div", { id: "research-holder", class: "grid" }); g.appendChild(holder);
    function go() { openCompany(inp.value); }
    btn.addEventListener("click", go); inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
    g.appendChild(h("div", { class: "sec", text: "Filing-based panels (need live SEC data)" }));
    var g2 = h("div", { class: "grid" }); g.appendChild(g2);
    var rl = [["earnings", "Earnings call", "Pulls the latest earnings-call transcript and summarises tone and guidance."], ["tenk", "10-K brief", "Reads the annual report (10-K) from SEC EDGAR and summarises the business, risks and accounting notes."], ["broker", "Broker notes", "Sell-side price targets and rating changes for the name."], ["revision", "Earnings revision", "How analysts' earnings estimates have moved over the last three months."], ["pead", "PEAD / SUE", "Post-earnings-announcement drift: whether a surprise in the last report is still being priced in."], ["gap", "Earnings gap", "The price gap on earnings day and how it has filled since."], ["accruals", "Accruals quality", "How much of reported profit is cash versus accounting accruals, from the cash-flow statement."], ["revdcf", "Reverse DCF", "Works backwards from today's price to the growth the market is assuming."], ["divergence", "Divergence", "Where price and fundamentals are moving in opposite directions."], ["drift", "10-K drift", "Compares the wording of consecutive annual reports to flag what the company changed its mind about."], ["thirteenf", "13F flow", "Which large funds added or cut the name in their quarterly holdings filings."]];
    g2.appendChild(notHereGroup("liveonly-research", "Filing-based panels · need live SEC data", rl.length + " panels need live SEC filing data and are not computed in this snapshot: show the list", rl));
  }
  function openCompany(t, quiet) {
    var c = co(t); var holder = $("#research-holder"); if (!holder) return;
    showTab("research");
    holder.innerHTML = "";
    var tk = (t || "").toUpperCase().trim();
    // A look-up with a ticker in it counts whether or not it is found, so the tour's step 3 can react to a not-found look-up too.
    if (!quiet && tk) state.lookups = (state.lookups || 0) + 1;
    if (!c) {
      var nf = card("notfound", tk ? tk + " is not in this snapshot" : "Type a ticker", "", DEMO, h("p", { class: "empty", text: (tk ? tk + " is not one of the 25 companies saved in this demo. " : "") + "On the live dashboard any US-listed ticker works: the system fetches the company's filings and prices when you ask. Pick a name above to see what a full look-up returns." }), { wide: true });
      holder.appendChild(nf); if (!quiet) { nf.scrollIntoView({ block: "start", behavior: SMOOTH }); focusCard(nf); }
      return;
    }
    cur = c; if (viewed.indexOf(c.ticker) < 0) viewed.push(c.ticker);
    var f = c.fundamentals, te = c.tech, s = series(c.ticker);
    var head = card("company", c.name + " (" + c.ticker + ")", "The company card. Price and trend come from official daily closes; fundamentals, the forensic scores and the price-target read come from the system's own saved research run on the company's SEC filings.", c.held ? { cls: "snap", text: "Held in the paper account" } : SNAP, [
      h("p", { class: "muted", text: c.sector + " · " + c.theme }),
      kpis([{ l: "Last close", v: usd(te.price, 2), s: dshort(s.dates[s.dates.length - 1]) }, { l: "1 day", v: pct(te.ret1d * 100, 1, true), cls: cls(te.ret1d) }, { l: "1 month", v: pct(te.ret1m * 100, 1, true), cls: cls(te.ret1m) }, { l: "3 months", v: pct(te.ret3m * 100, 1, true), cls: cls(te.ret3m) }, { l: "Since " + dshort(s.dates[0]), v: pct(te.ret1y * 100, 1, true), cls: cls(te.ret1y) }, { l: "vs 52-wk high", v: pct(te.fromHigh * 100, 1, true), cls: cls(te.fromHigh) }]),
      h("p", null, [h("strong", { text: "Thesis: " }), plain(c.thesis)])], { wide: true });
    holder.appendChild(head);
    // price chart with averages (a smaller canvas on phones so the axis labels stay readable)
    var cl = s.close, sma = function (k) { return cl.map(function (_, i) { if (i < k - 1) return null; var sum = 0; for (var j = i - k + 1; j <= i; j++) sum += cl[j]; return sum / k; }); };
    var pnw = narrow();
    var ch = lineChart({ w: pnw ? 300 : 480, h: pnw ? 170 : 180, ml: pnw ? 30 : 40, mr: pnw ? 10 : 14, fs: pnw ? 12 : 10, dates: s.dates, series: [{ values: sma(200), color: "#d9a441", width: 1.2, dash: true, label: false }, { values: sma(50), color: "#729fe2", width: 1.2, label: false }, { values: cl, color: "#eef2f8", width: 1.6 }], yfmt: function (v) { return v >= 1000 ? (v / 1000).toFixed(1) + "k" : v; }, aria: c.name + " daily closing price since " + dshort(s.dates[0]) + " with 50-day and 200-day averages" });
    holder.appendChild(card("price", "Price and trend", "Daily closes since " + dshort(s.dates[0]) + " with the 50-day and 200-day moving averages. Three of the 13 gates read this chart: price above both averages, and the short average above the long one.", SNAP, [h("div", { class: "lg", html: '<span><i style="border-top-color:#eef2f8"></i>Close</span><span><i style="border-top-color:#729fe2"></i>50-day average</span><span><i style="border-top-color:#d9a441;border-top-style:dashed"></i>200-day average (dashed)</span>' }), h("div", { html: ch.svg })], { two: true }));
    // fundamentals
    var med = R.sectorMedians[c.sector] || {};
    function vs(x, m, inv) { if (x == null || m == null) return ""; var better = inv ? x < m : x > m; return '<span class="dim"> · sector median ' + num(m, 1) + "</span>"; }
    holder.appendChild(card("fund", "Fundamentals", "Core ratios from the company's filings, next to the sector median as recorded by the system's research run. P/E is price divided by earnings per share; ROE is return on equity; D/E is debt to equity.", SNAP, [
      kpis([{ l: "P/E", v: num(f.pe, 1) }, { l: "Net margin", v: pct(f.netMargin, 1) }, { l: "ROE", v: pct(f.roe, 1) }, { l: "Debt / equity", v: num(f.de, 2) }, { l: "Market cap", v: mcap(f.marketCap) }, { l: "Quality grade", v: f.grade || "n/a", s: f.qualityNet != null ? "score " + f.qualityNet : "" }]),
      h("p", { class: "note", html: "Sector medians (" + c.sector + "): P/E " + num(med.pe, 1) + " · net margin " + num(med.netMargin, 1) + "% · ROE " + num(med.roe, 1) + "% · D/E " + num(med.de, 2) })]));
    // forensics
    holder.appendChild(card("forensic", "Forensics · accounting checks", "Two standard screens computed from the filings. Altman Z (1968) estimates distress risk from five balance-sheet and income ratios; below 1.81 is the distress zone. Beneish M (1999) looks for the fingerprints of manipulated earnings; above −1.78 is a warning.", SNAP, [
      kpis([{ l: "Altman Z", v: num(f.altmanZ, 2), s: f.altmanZone ? f.altmanZone + " zone" : "", cls: f.altmanZ == null ? "" : f.altmanZ >= 2.99 ? "up" : f.altmanZ >= 1.81 ? "" : "down" }, { l: "Beneish M", v: num(f.beneishM, 2), s: f.beneishM == null ? "" : f.manipulator ? "screen warning (a formula check, not an accusation)" : "no warning", cls: f.beneishM == null ? "" : f.manipulator ? "down" : "up" }, { l: "Forensic grade", v: f.fraudGrade || "n/a" }])]));
    // valuation + signal
    var rt = (f.rating || "").toLowerCase(), rcls = rt.indexOf("buy") >= 0 ? "buy" : rt.indexOf("sell") >= 0 || rt.indexOf("reduce") >= 0 ? "sell" : "hold";
    holder.appendChild(card("valuation", "Valuation and signal", "The system's price-target read (an estimate of fair value from cash flows and multiples) with the implied upside, and the forecasting model's odds that the price is higher in about a month. The system rating is the dashboard's own five-step label (Strong Buy, Buy, Hold, Reduce, Sell) from its saved research run; it is not a recommendation to anyone.", SNAP, [
      kpis([{ l: "Price target", v: f.target ? usd(f.target, 2) : "n/a" }, { l: "Upside", v: pct(f.upsidePct, 1, true), cls: f.upsidePct == null ? "" : cls(f.upsidePct) }, { l: "Model rating (not advice)", v: f.rating && f.rating !== NODATA ? f.rating : "none" }, { l: "Forecast odds up", v: f.bullish_prob == null ? "n/a" : pct(f.bullish_prob * 100, 0) }]),
      f.rating && f.rating !== NODATA ? h("p", null, [h("span", { class: "pill " + rcls, text: f.rating })]) : null]));
    // factors
    var fx = c.factors; var fr = null; R.multifactor.ranked.forEach(function (r) { if (r.ticker === c.ticker) fr = r; });
    holder.appendChild(card("factors", "Multi-factor rank", "Where the name sits in the four-factor model (momentum, value, volatility, trend): each factor is a z-score against the list, blended into one composite. Rank 1 is the strongest.", SNAP, fx.rank ? [
      kpis([{ l: "Composite rank", v: "#" + fx.rank + " of " + R.multifactor.ranked.length, s: "composite " + num(fx.composite, 2) + " · run of " + dshort(R.multifactor.asOf) },{ l: "Momentum", v: num(fr && fr.factors.momentum, 2), s: "z-score" }, { l: "Value", v: num(fr && fr.factors.value, 2), s: "z-score" }, { l: "Volatility", v: num(fr && fr.factors.volatility, 2), s: "z-score" }, { l: "Trend", v: num(fr && fr.factors.trend, 2), s: "z-score" }])] : h("p", { class: "empty", text: "Not in the factor run of " + dshort(R.multifactor.asOf) + "." })));
    // gauntlet
    holder.appendChild(gauntletCard(c));
    if (!quiet) { head.scrollIntoView({ block: "start", behavior: SMOOTH }); focusCard(head); }
  }
  function gauntletCard(c) {
    var wrap = h("div");
    var hd = h("div", { class: "gatehead" });
    hd.appendChild(h("span", { class: "pill " + (c.gatesPassed === 13 ? "ok" : "na"), text: c.gatesPassed + " of 13 gates passed" }));
    var all = h("button", { class: "tbtn ghost", type: "button", id: "explain-all", text: state.explainAll ? "Hide all explanations" : "Explain all 13" });
    hd.appendChild(all); wrap.appendChild(hd);
    var list = h("ul", { class: "gates", id: "gauntlet-list" }); var lastG = "";
    c.gates.forEach(function (g, i) {
      var def = R.gates[i];
      // Gates 8 to 10 are judged as if the buy had already happened, which is why "38% now" can fail a 40% cap; say so under the group label.
      if (def.group !== lastG) { list.appendChild(h("li", { class: "g" }, [def.group, def.group === "Portfolio fit" ? h("span", { class: "gsub", text: "Judged as if the buy had already happened" }) : null])); lastG = def.group; }
      var li = h("li", { class: g.pending ? "na" : g.pass ? "ok" : "no" });
      li.appendChild(h("span", { class: "m", text: g.pending ? "No data" : g.pass ? "Pass" : "Fail" }));
      var lab = h("span", { class: "lab" }, [(i + 1) + ". " + def.label, " ", h("button", { class: "info", type: "button", "aria-expanded": "false", "aria-controls": "gate-x-" + (i + 1), "aria-label": "Explain gate " + (i + 1), text: "?" })]);
      li.appendChild(lab);
      // The site does not show negative cash; when the cash figure is negative the gate reads "no cash free".
      li.appendChild(h("span", { class: "d", text: g.key === "cash" && /^-/.test(g.detail || "") ? "no cash free" : g.detail }));
      var x = h("div", { class: "x", id: "gate-x-" + (i + 1), text: def.explain }); x.hidden = !state.explainAll; li.appendChild(x);
      $(".info", lab).addEventListener("click", function (e) { x.hidden = !x.hidden; e.currentTarget.setAttribute("aria-expanded", x.hidden ? "false" : "true"); });
      list.appendChild(li);
    });
    wrap.appendChild(list);
    all.addEventListener("click", function () { state.explainAll = !state.explainAll; all.textContent = state.explainAll ? "Hide all explanations" : "Explain all 13"; list.querySelectorAll(".x").forEach(function (x) { x.hidden = !state.explainAll; }); list.querySelectorAll(".info").forEach(function (b) { b.setAttribute("aria-expanded", state.explainAll ? "true" : "false"); }); });
    wrap.appendChild(h("p", { class: "note", text: "A company is a buy candidate only when all 13 pass. A gate with missing data counts as failed. Gates 9 and 10 are judged as if the buy had already happened. Trend, momentum and volatility gates here are computed from official daily closes; the others come from the system's saved research run." }));
    return card("gauntlet", "Entry gauntlet · the 13 risk gates", "The 13 yes-or-no rules a company must pass before the system will flag it as a buy candidate. They are deliberately strict: on most days nothing passes all 13, and that is the system working.", SNAP, wrap, { two: true });
  }

  function portfolioCards(g) {
    var A = R.account, E = R.equity, n = E.dates.length;
    var idx = E.value.map(function (v) { return v / E.value[0] * 100; }), six = E.spx.map(function (v) { return v / E.spx[0] * 100; });
    var pi = 0; idx.forEach(function (v, i) { if (v > idx[pi]) pi = i; });
    var leadBest = 0; idx.forEach(function (v, i) { if (v - six[i] > idx[leadBest] - six[leadBest]) leadBest = i; });
    var ew0 = E.dates.indexOf("2026-08-31");
    var pos = A.positions.map(function (p) { var c = co(p.ticker); return { t: p.ticker, name: p.name, sector: p.sector, v: p.value, w: p.value / A.positionsValue * 100, d1: c ? c.tech.ret1d : null }; });
    var best = pos.slice().sort(function (a, b) { return b.d1 - a.d1; })[0], worst = pos.slice().sort(function (a, b) { return a.d1 - b.d1; })[0];
    g.appendChild(h("div", { class: "sec", text: "The book" }));
    g.appendChild(card("account", "Account", "The practice account at the broker. Account value is what everything in it would be worth at the latest closing prices. The account has no free cash, which is why gate 9 (cash free for a new buy) fails for every name in Research. Every dollar is simulated.", { cls: "demo", text: "Paper" }, [
      // Two decimals on the two percentages, so a reader who subtracts them lands on the "points" gap (summary.json: 1.16, 4.33, 3.17).
      kpis([{ l: "Account value", v: usd(A.equity), s: dshort(R.snapshot) }, { l: "Holdings", v: String(A.holdings) }, { l: "Since the equal-weight switch (31 Aug)", v: pct((E.value[n - 1] / E.value[ew0] - 1) * 100, 2, true), cls: "up", s: "S&P 500 " + pct((E.spx[n - 1] / E.spx[ew0] - 1) * 100, 2, true) + ", ahead by " + ((E.value[n - 1] / E.value[ew0] - E.spx[n - 1] / E.spx[ew0]) * 100).toFixed(1) + " points. Since the 3 Jul reset: see Performance below." }]),
      h("p", { class: "note", text: "Best today: " + best.t + " " + pct(best.d1 * 100, 1, true) + " · Weakest today: " + worst.t + " " + pct(worst.d1 * 100, 1, true) })]));
    var hrows = pos.map(function (p) { return [{ html: '<button type="button" class="tk" data-open="' + p.t + '">' + p.t + '</button> <span class="dim">' + p.name + "</span>" }, { t: p.sector }, { t: p.w.toFixed(1) + "%" }, { t: pct(p.d1 * 100, 1, true), cls: cls(p.d1) }]; });
    g.appendChild(card("holdings", "Holdings · " + pos.length, "Every position in the paper account at the snapshot, largest first, with its share of the holdings and its move on the last trading day.", SNAP, table([{ t: "Company" }, { t: "Sector" }, { t: "Weight", num: 1 }, { t: "1 day", num: 1 }], hrows, { rowhead: true }), { two: true }));
    // allocation
    var bySec = {}; pos.forEach(function (p) { bySec[p.sector] = (bySec[p.sector] || 0) + p.w; });
    var al = h("div"); Object.keys(bySec).sort(function (a, b) { return bySec[b] - bySec[a]; }).forEach(function (s) { al.appendChild(h("div", { style: "display:flex;justify-content:space-between;font-size:.8rem;margin-top:.35rem" }, [h("span", { text: s }), h("span", { class: "mono", text: bySec[s].toFixed(1) + "%" })])); al.appendChild(h("div", { class: "bar", html: '<i style="width:' + Math.min(100, bySec[s]) + '%"></i>' })); });
    g.appendChild(card("alloc", "Allocation · by industry", "How the holdings split across industries. The system refuses a buy that would push any one sector past 40%.", SNAP, [al, h("p", { class: "note", text: "All " + pos.length + " holdings are on the research list (thesis exposure 100% of positions)." })]));
    // performance
    g.appendChild(h("div", { class: "sec", text: "Performance" }));
    var MARK = [
      { date: "2026-07-16", short: "Rebuilt", label: "16 Jul, rebuilt: I rewrote the automated system from scratch. Its job became beating the S&P 500, so part of the money tracked an S&P 500 fund and the rest went into bets on companies from my research list." },
      { date: "2026-07-27", short: "Turnover caps", label: "27 Jul, turnover caps: it was buying and selling far too often, and every simulated trade has a cost. I capped how much it could turn over each day and added a ceiling on the portfolio's total size.", row: 1 },
      { date: "2026-08-31", short: "Equal weight", label: "31 Aug, equal weight: my test showed that ranking companies and picking favourites added nothing, so the system now holds every eligible company on the list in equal amounts. The same day a safety rule (the circuit breaker) stopped it adding risk, because it had fallen too far behind the index." },
      { date: "2026-09-11", short: "SPY out", label: "11 Sep, index fund out: the system had been parking spare cash in an S&P 500 fund, and on 4 Sep it bought $565,203 of it, more than half the account. I removed the fund so the portfolio holds only research-list companies.", row: 1 },
      { date: "2026-09-23", short: "Vetoes", label: "23 to 24 Sep, quality vetoes: the accounting-quality checks flagged five holdings (ANET, FIX, HUBB, POWL, VRT) and the system sold them. Three (ANET, FIX, VRT) were bought back the next day as new equal-weight positions.", row: 2 }];
    // On a phone the chart is drawn on a smaller canvas so the labels stay readable; the marker labels move to the list below it.
    var ew = E.dates.indexOf("2026-08-31");
    var nw = narrow();
    var ch = lineChart({ w: nw ? 320 : 900, h: nw ? 220 : 300, ml: nw ? 32 : 44, mr: nw ? 10 : 20, fs: nw ? 12 : 10, pfs: nw ? 12 : 11, markerLabels: !nw, dates: E.dates, series: [{ values: six, color: "#d9a441", dash: true, width: 1.6 }, { values: idx, color: "#729fe2", width: 2 }], base: 100, step: 2, markers: MARK, peak: { date: E.dates[pi], value: idx[pi], label: "Highest point" }, aria: "Paper account and S&P 500 since 3 July 2026, both starting at 100" });
    var cb = h("div", { class: "chartbox", html: ch.svg }); var tip = h("div", { class: "tip", role: "status" }); cb.appendChild(tip);
    var svg = $("svg", cb), guide = $(".guide", cb);
    function hover(e) { var r = svg.getBoundingClientRect(); var x = (e.clientX - r.left) / r.width * ch.W; var bi = 0, gap = 1e9; for (var i = 0; i < n; i++) { var gg = Math.abs(ch.X(i) - x); if (gg < gap) { gap = gg; bi = i; } } guide.setAttribute("x1", ch.X(bi)); guide.setAttribute("x2", ch.X(bi)); guide.style.display = "block"; tip.innerHTML = "<strong>" + dshort(E.dates[bi]) + "</strong><br>Paper account " + idx[bi].toFixed(1) + " (" + usd(E.value[bi]) + ")<br>S&amp;P 500 " + six[bi].toFixed(1); tip.style.display = "block"; var px = ch.X(bi) / ch.W * r.width; tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth, px + 10)) + "px"; tip.style.top = "6px"; state.hovered = true; }
    svg.addEventListener("pointermove", hover); svg.addEventListener("pointerdown", hover); svg.addEventListener("pointerleave", function (e) { if (e.pointerType === "touch") return; tip.style.display = "none"; guide.style.display = "none"; });
    // Long notes are split over two short lines (and the list is capped in width) so no text runs under the tour popover when it sits in the corner.
    var ml = h("ul", { class: "note marks", style: "list-style:none;padding:0;margin:.4rem 0 0" }); ml.appendChild(h("li", { class: "mk-h", text: "What the numbered lines on the chart mean" })); MARK.forEach(function (m, k) { ml.appendChild(h("li", { class: "mk", html: '<span class="mk-n">' + (k + 1) + "</span>" }, [m.label])); if (m.more) ml.appendChild(h("li", { class: "cont", text: m.more })); });
    // The earlier account is in summary.json and equity-history.csv (first_account); it is stated here so the reset is not read as a fresh start after a quiet month.
    ml.appendChild(h("li", { text: "• Before the reset: an earlier $100,000 practice account ran from 2 June to 2 July 2026 and ended down 8.4% while the S&P 500 fell 1.7%." }));
    ml.appendChild(h("li", { class: "cont", text: "It is in equity-history.csv and summary.json and is not on this chart." }));
    g.appendChild(card("perf", "Performance vs S&P 500", "The paper account's value and the S&P 500 over the same days, both set to 100 on 3 July 2026, the day the account was reset to a simulated $1,000,000. The S&P 500 line uses official closes, not the system's own numbers. Dashed vertical lines mark the main changes to the system.", SNAP, [
      h("div", { class: "lg", html: '<span><i></i>Paper account (as recorded by the system)</span><span><i class="spx"></i>S&amp;P 500 (official closes)</span><span><i class="mark"></i>System change</span>' }),
      cb,
      // Latest first, and both tiles in the neutral colour: the one day the account was ahead is shown, not coloured as the good news. Two decimals so the percentages subtract to the "points" gap.
      perfBox(E, ew, pi, n),
      ml], { wide: true }));
    // risk analytics (computed from current holdings and one year of closes)
    var risk = riskStats(pos);
    g.appendChild(h("div", { class: "sec", text: "Risk tools" }));
    g.appendChild(card("risk", "Risk analytics", "Standard risk measures for the current holdings, computed here from the last 60 trading days of official closes. Volatility is how much the book swings in a year. VaR 95 is the loss a bad day, roughly one day in twenty, could bring. CVaR is the average loss on the days beyond that. Beta is how much the book moves for a 1% move in the S&P 500.", SNAP, [
      kpis([{ l: "Annualised volatility (60-day)", v: pct(risk.vol * 100, 1) }, { l: "1-day VaR 95 (60-day)", v: pct(risk.var95 * 100, 2), s: usd(risk.var95 * A.equity) + " on the account value" }, { l: "CVaR 95 (60-day)", v: pct(risk.cvar95 * 100, 2) }, { l: "Beta vs S&P 500 (60-day)", v: num(risk.beta, 2) }, { l: "Effective holdings", v: num(risk.effBets, 1), s: "of " + pos.length + ", by position size only (1 / sum of squared weights)" }, { l: "Avg pairwise correlation", v: num(risk.avgCorr, 2) }]),
      h("p", { class: "note", text: "Computed on the current basket's weights held fixed over the window, so it describes today's book, not the account's realised history." })]));
    // drawdown
    var dd = 0, pk = E.value[0], ddDate = E.dates[0]; E.value.forEach(function (v, i) { if (v > pk) pk = v; var d = v / pk - 1; if (d < dd) { dd = d; ddDate = E.dates[i]; } });
    g.appendChild(card("cdar", "Drawdown", "A drawdown is the fall from the account's highest value to a later low. The largest one so far is shown, with the day it bottomed.", SNAP, kpis([{ l: "Largest drawdown", v: pct(dd * 100, 1), cls: "down", s: "bottomed " + dshort(ddDate) }, { l: "From the high", v: pct((E.value[n - 1] / Math.max.apply(null, E.value) - 1) * 100, 1), cls: "down", s: "latest close vs highest close" }])));
    // correlation
    var crows = risk.pairs.slice(0, 6).map(function (p) { return [{ t: p.a + " / " + p.b }, { t: num(p.c, 2) }]; });
    g.appendChild(card("network", "Correlation network", "How closely the holdings move together over the last 60 trading days. Pairs near 1.0 behave like one bet; a book full of them is less diversified than its holding count suggests.", SNAP, table([{ t: "Most correlated pairs" }, { t: "Correlation", num: 1 }], crows)));
    // beta hedge + active share
    g.appendChild(card("betahedge", "Beta hedge", "How much of the index fund you would have to sell short to cancel the book's market exposure, given its beta.", SNAP, kpis([{ l: "Market exposure", v: usd(risk.beta * A.equity), s: "account value × beta of " + num(risk.beta, 2) + "; a measure, not money at risk" }, { l: "SPY to sell short", v: num(risk.beta * A.equity / SPY.close[SPY.close.length - 1], 0) + " shares", s: "reference figure; the account holds no such position" }])));
    g.appendChild(card("activeshare", "Active share", "How different the book is from simply holding every name on the research list in equal amounts. 0% would be identical; 100% would share nothing.", SNAP, kpis([{ l: "Active share vs equal weight", v: pct(risk.activeShare * 100, 0) }])));
    // stress
    var st = [[-5], [-10], [-20]].map(function (s) { return [{ t: "S&P 500 " + s[0] + "%" }, { t: pct(risk.beta * s[0], 1), cls: "down" }, { t: usd(risk.beta * s[0] / 100 * A.positionsValue), cls: "down" }]; });
    g.appendChild(card("stress", "Stress test", "A rough what-if: if the S&P 500 fell by the amount shown, the book's beta says roughly how far it would fall. Real sell-offs are rarely that tidy.", SNAP, table([{ t: "Scenario" }, { t: "Book", num: 1 }, { t: "On positions", num: 1 }], st)));
    g.appendChild(h("div", { class: "sec", text: "Live-data panels (not computed in this snapshot)" }));
    var pl = [["attribution", "Attribution (Brinson-Fachler)", "Splits the gap against the index into what came from sector choices and what came from stock picks."], ["factors2", "Factor exposures", "A regression of the book's returns on the standard style factors (market, size, value, profitability, investment, momentum)."], ["garch", "GARCH volatility", "A volatility model that lets recent swings weigh more, to forecast tomorrow's risk."], ["macroshock", "Macro shock", "How the book would react to a jump in rates, oil or the dollar."], ["crowding", "Factor crowding", "Whether the factors the book leans on are crowded with other investors."], ["liq", "Liquidity sizing", "Caps each position by how many days of normal trading it would take to exit."], ["tax", "Tax harvesting", "Finds losing positions whose sale could offset gains (not relevant to a paper account, but the tool exists)."], ["kelly", "Kelly sizing", "A formula for how big a bet should be given its odds and payoff."], ["mc", "Risk sim · Monte Carlo", "Simulates thousands of possible years for the book to show the range of outcomes."], ["factsheet", "Fact sheet and pitch deck", "One-command PDF summarising the paper account and the research list, with a pitch deck made as a practice exercise, generated from the live numbers."]];
    g.appendChild(notHereGroup("liveonly-portfolio", "Live-data panels · not computed here", pl.length + " panels need live feeds and are not computed in this snapshot: show the list", pl));
  }

  // Performance vs the S&P 500 for a chosen period: account return, index return, and the difference (alpha).
  function perfBox(E, ew, pi, n) {
    var P = [
      { k: "ew", label: "Since equal-weight switch (31 Aug)", a: ew, b: n - 1 },
      { k: "reset", label: "Since account reset (3 Jul)", a: 0, b: n - 1 },
      { k: "peak", label: "3 Jul to highest point (" + dshort(E.dates[pi]).replace(/ \d{4}$/, "") + ")", a: 0, b: pi }
    ];
    var wrap = h("div", { class: "perfbox" }), seg = h("div", { class: "seg", role: "group", "aria-label": "Period" }), tiles = h("div");
    function show(p) {
      seg.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-k") === p.k ? "true" : "false"); });
      var acc = (E.value[p.b] / E.value[p.a] - 1) * 100, idx = (E.spx[p.b] / E.spx[p.a] - 1) * 100, d = acc - idx;
      tiles.innerHTML = "";
      tiles.appendChild(kpis([
        { l: "Paper account", v: pct(acc, 2, true), cls: cls(acc / 100) },
        { l: "S&P 500", v: pct(idx, 2, true), cls: cls(idx / 100) },
        { l: "Difference (alpha)", v: (d >= 0 ? "+" : "\u2212") + Math.abs(d).toFixed(2) + " pts", cls: d >= 0 ? "up" : "down", s: d >= 0 ? "ahead of the index" : "behind the index" }
      ]));
      tiles.appendChild(h("p", { class: "note", text: dshort(E.dates[p.a]) + " to " + dshort(E.dates[p.b]) + ". Alpha here is simply the account's return minus the S&P 500's return over the same days." }));
      if (p.k === "ew") {
        var full = ((E.value[n - 1] / E.value[0]) - (E.spx[n - 1] / E.spx[0])) * 100;
        if (full < 0) tiles.appendChild(h("p", { class: "note", text: "Over the whole period since the 3 Jul reset, the account is still " + Math.abs(full).toFixed(2) + " pts behind the index; press “Since account reset” to see it." }));
      }
    }
    P.forEach(function (p) { var bt = h("button", { type: "button", "data-k": p.k, text: p.label }); bt.addEventListener("click", function () { show(p); }); seg.appendChild(bt); });
    wrap.appendChild(seg); wrap.appendChild(tiles); show(P[0]);
    return wrap;
  }
  function riskStats(pos) {
    var W = 60, tk = pos.map(function (p) { return p.t; }), w = pos.map(function (p) { return p.w / 100; }), tw = w.reduce(function (a, b) { return a + b; }, 0); w = w.map(function (x) { return x / tw; });
    var rets = tk.map(function (t) { var c = series(t).close; var r = []; for (var i = c.length - W; i < c.length; i++) r.push(c[i] / c[i - 1] - 1); return r; });
    var sc = SPY.close, sr = []; for (var i = sc.length - W; i < sc.length; i++) sr.push(sc[i] / sc[i - 1] - 1);
    var pr = []; for (var d = 0; d < W; d++) { var s = 0; for (var k = 0; k < tk.length; k++) s += w[k] * rets[k][d]; pr.push(s); }
    var mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
    var sd = function (a) { var m = mean(a); return Math.sqrt(mean(a.map(function (x) { return (x - m) * (x - m); }))); };
    var cov = function (a, b) { var ma = mean(a), mb = mean(b); var s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb); return s / a.length; };
    var sorted = pr.slice().sort(function (a, b) { return a - b; }), q = Math.floor(W * 0.05), var95 = -sorted[q], cvar = -mean(sorted.slice(0, q + 1));
    var pairs = []; var sumc = 0, cnt = 0;
    for (var a = 0; a < tk.length; a++) for (var b = a + 1; b < tk.length; b++) { var c = cov(rets[a], rets[b]) / (sd(rets[a]) * sd(rets[b]) || 1); pairs.push({ a: tk[a], b: tk[b], c: c }); sumc += c; cnt++; }
    pairs.sort(function (x, y) { return y.c - x.c; });
    var hhi = w.reduce(function (s, x) { return s + x * x; }, 0);
    var eq = 1 / R.companies.length, as = 0; R.companies.forEach(function (c) { var wi = 0; for (var k = 0; k < tk.length; k++) if (tk[k] === c.ticker) wi = w[k]; as += Math.abs(wi - eq); });
    return { vol: sd(pr) * Math.sqrt(252), var95: var95, cvar95: cvar, beta: cov(pr, sr) / (sd(sr) * sd(sr)), effBets: 1 / hhi, avgCorr: sumc / cnt, pairs: pairs, activeShare: as / 2 };
  }

  function quantCards(g) {
    var B = R.backtest;
    g.appendChild(h("div", { class: "sec", text: "Backtest" }));
    var bi = B.equity.map(function (v) { return v / B.equity[0] * 100; }), si = B.spy.map(function (v) { return v / B.spy[0] * 100; });
    var bnw = narrow();
    var ch = lineChart({ w: bnw ? 300 : 480, h: bnw ? 190 : 200, ml: bnw ? 30 : 40, mr: bnw ? 10 : 14, fs: bnw ? 12 : 10, dates: B.dates, series: [{ values: si, color: "#d9a441", dash: true, width: 1.4 }, { values: bi, color: "#729fe2", width: 1.8 }], base: 100, aria: "Backtest of the equal-weight strategy against the S&P 500, " + dshort(B.start_date) + " to " + dshort(B.end_date) });
    var costTxt = B.cost_bps == null ? ". The saved run did not record a cost per simulated order" : ", charging " + B.cost_bps + " basis points per simulated order";
    var lastPlotted = B.dates[B.dates.length - 1];
    g.appendChild(card("backtest", "Backtest lab", "A backtest replays a strategy over past prices to see how it would have done. This one holds 13 of the 25 names on today's research list in equal amounts, rebalanced monthly, from " + dshort(B.start_date) + " to " + dshort(B.end_date) + costTxt + ". It is a simulation on history, not the paper account's record, and past prices promise nothing about the future. The 13 were chosen with today's knowledge and run over the past, so the test has hindsight built in and flatters the strategy.", { cls: "demo", text: "Simulation" }, [
      h("div", { class: "lg", html: '<span><i></i>Strategy</span><span><i class="spx"></i>S&amp;P 500</span>' }), h("div", { html: ch.svg }),
      kpis([{ l: "CAGR", v: pct(B.cagr, 1), s: "compound annual growth" }, { l: "Sharpe", v: num(B.sharpe, 2) }, { l: "Max drawdown", v: pct(B.max_drawdown, 1), cls: "down" }, { l: "Win rate", v: pct(B.win_rate, 1), s: "basis not recorded in the saved run" }, { l: "Beta vs S&P", v: num(B.beta_vs_spy, 2) }, B.annual_turnover == null ? { l: "Turnover / yr", v: "n/a", s: "not recorded in the saved run" } : { l: "Turnover / yr", v: num(B.annual_turnover, 1) + "×" }]),
      h("p", { text: "A replay over past prices, not the paper account's record. The 13 names are 13 of the 25 on today's list, run over the past, so the test has hindsight built in and flatters the strategy. The account's own result is on Portfolio & Risk." }),
      h("p", { class: "note", text: dshort(B.start_date) + " to " + dshort(B.end_date) + " · Strategy: " + B.strategy_name + " · universe: " + B.universe.join(", ") + " · start cash " + usd(B.start_cash) + " → " + usd(B.final_equity) + " (S&P 500: " + usd(B.spy_final) + ")" + (lastPlotted === B.end_date ? "" : " · chart plotted at weekly points to " + dshort(lastPlotted) + "; the statistics run to " + dshort(B.end_date)) }),
      h("p", { class: "note", text: "The S&P 500 line here is the saved run's own record, not the official closes used on the Portfolio & Risk chart. The risk-free rate behind the Sharpe ratio was not recorded in the saved run." })], { two: true }));
    // gauntlet summary
    var counts = R.gates.map(function (_, i) { return R.companies.filter(function (c) { return c.gates[i].pass; }).length; });
    var gl = h("div"); R.gates.forEach(function (gd, i) { gl.appendChild(h("div", { style: "display:flex;justify-content:space-between;font-size:.78rem;margin-top:.35rem;gap:.5rem" }, [h("span", { text: (i + 1) + ". " + gd.label }), h("span", { class: "mono", text: counts[i] + "/" + R.companies.length })])); gl.appendChild(h("div", { class: "bar", html: '<i style="width:' + (counts[i] / R.companies.length * 100) + '%"></i>' })); });
    var top = R.companies.slice().sort(function (a, b) { return b.gatesPassed - a.gatesPassed; }).slice(0, 5);
    // When the cash gate passes nobody, the zero is mechanical, not selectivity; the note says so rather than letting the bars imply strictness.
    var cashIdx = -1; R.companies[0].gates.forEach(function (g, i) { if (g.key === "cash") cashIdx = i; });
    var cashNote = cashIdx >= 0 && counts[cashIdx] === 0 ? " At this snapshot gate " + (cashIdx + 1) + " fails for every name because the account has no free cash, so nothing could pass all 13 regardless of its other gates." : "";
    g.appendChild(card("gauntlet-all", "Entry gauntlet · across the list", "How many of the 25 companies pass each of the 13 gates at the snapshot. The bottom line is the point: on 12 October 2026 none passed all 13.", SNAP, [gl, h("p", { class: "note", text: "Closest: " + top.map(function (c) { return c.ticker + " " + c.gatesPassed + "/13"; }).join(" · ") + ". Open any name in Research to see gate by gate." + cashNote })], { two: true }));
    // multifactor
    var M = R.multifactor, mrows = M.ranked.map(function (r) { return [{ html: '<button type="button" class="tk" data-open="' + r.ticker + '">' + r.ticker + "</button>" }, { t: "#" + r.rank }, { t: num(r.composite, 2) }, { t: num(r.factors.momentum, 2) }, { t: num(r.factors.value, 2) }, { t: num(r.factors.volatility, 2) }, { t: num(r.factors.trend, 2) }]; });
    var valueEmpty = M.ranked.every(function (r) { return !r.factors.value; });
    g.appendChild(card("multifactor", "Multi-factor strategy", "Each name is scored on four factors (momentum " + Math.round(M.weights.momentum * 100) + "%, value " + Math.round(M.weights.value * 100) + "%, volatility " + Math.round(M.weights.volatility * 100) + "%, trend " + Math.round(M.weights.trend * 100) + "%) as z-scores against the list and blended into one composite. " + M.rebalance, SNAP, [table([{ t: "Name" }, { t: "Rank", num: 1 }, { t: "Composite", num: 1 }, { t: "Momentum", num: 1 }, { t: "Value", num: 1 }, { t: "Volatility", num: 1 }, { t: "Trend", num: 1 }], mrows, { rowhead: true, caption: "Factor run of " + dshort(M.asOf) }),
      valueEmpty ? h("p", { class: "note", text: "The value factor had no data in this run, so every name scores 0 on it and the composite is effectively momentum, volatility and trend." }) : null], { two: true }));
    // screener
    var sc = R.companies.filter(function (c) { return c.fundamentals.score != null; }).sort(function (a, b) { return b.fundamentals.score - a.fundamentals.score; });
    var srows = sc.map(function (c) { var f = c.fundamentals; return [{ html: '<button type="button" class="tk" data-open="' + c.ticker + '">' + c.ticker + "</button>" }, { t: f.grade || "n/a" }, { t: f.rating && f.rating !== NODATA ? f.rating : "none" }, { t: pct(f.upsidePct, 0, true), cls: f.upsidePct == null ? "" : cls(f.upsidePct) }, { t: num(f.altmanZ, 1) }, { t: num(f.beneishM, 2) }, { t: num(f.score, 0) }]; });
    g.appendChild(card("screener", "Universe screener · ranked best to worst", "A composite of quality grade, price-target upside, forensic checks and signal across the research list, from the system's saved research run.", SNAP, table([{ t: "Name" }, { t: "Grade" }, { t: "System rating" }, { t: "Upside", num: 1 }, { t: "Altman Z", num: 1 }, { t: "Beneish M", num: 1 }, { t: "Score", num: 1 }], srows, { rowhead: true }), { two: true }));
    // sector rotation (computed)
    var secs = {}; R.companies.forEach(function (c) { (secs[c.sector] = secs[c.sector] || []).push(c); });
    var rr = Object.keys(secs).map(function (s) { var a = secs[s]; var m1 = a.reduce(function (x, c) { return x + c.tech.ret1m; }, 0) / a.length, m3 = a.reduce(function (x, c) { return x + c.tech.ret3m; }, 0) / a.length; return [{ t: s + " (" + a.length + ")" }, { t: pct(m1 * 100, 1, true), cls: cls(m1) }, { t: pct(m3 * 100, 1, true), cls: cls(m3) }]; });
    g.appendChild(card("rotation", "Sector rotation", "Average move of the list's names by sector over one and three months, to see which part of the thesis the market is rewarding.", SNAP, table([{ t: "Sector" }, { t: "1 month", num: 1 }, { t: "3 months", num: 1 }], rr)));
    g.appendChild(h("div", { class: "sec", text: "Other tools on the bench (not computed in this snapshot)" }));
    var ql = [["setups", "Trade setups", "Builds an entry, stop and target plan for the top-ranked names from their recent range."], ["hmm", "Regime (hidden Markov model)", "A statistical model that sorts market days into regimes (calm, trending, stressed) and gives the odds of each."], ["hrp", "HRP allocation", "Hierarchical risk parity: weights the book by clustering correlated names, with no matrix inversion."], ["bl", "Black-Litterman", "Blends market-implied returns with the system's own views into target weights."], ["gen", "Strategy generation", "A language model drafts candidate strategies with exact rules, labelled as drafts."], ["opt", "Strategy optimisation", "Tunes a strategy's settings for better risk-adjusted return and shows before and after."], ["rr", "Risk / reward", "Breaks a strategy's rules into risk per trade and reward-to-risk."], ["macrostrat", "Macro strategy", "Turns the macro snapshot into factor tilts."], ["alpha", "Alpha / edge detection", "Hunts for under-exploited patterns and explains why they persist."], ["pairs", "Pairs / cointegration", "Finds pairs of names whose prices move together and watches for the spread to stretch."], ["qarp", "QARP screen", "Quality at a reasonable price: a double sort on quality and value."], ["ic", "Signal decay (IC lab)", "Measures how fast each signal's predictive power fades."], ["deflated", "Deflated Sharpe", "Corrects a backtest's Sharpe ratio for how many variations were tried."], ["ensemble", "Ensemble forecast", "Combines several forecasting models into one vote."]];
    g.appendChild(notHereGroup("liveonly-quant", "Other tools on the bench · not computed here", ql.length + " more tools on the bench are not computed in this snapshot: show the list", ql));
  }

  function tradeCards(g) {
    var D = R.desk;
    g.appendChild(h("div", { class: "sec", text: "Orders" }));
    var form = h("div", null, [h("div", { style: "display:flex;gap:.5rem;flex-wrap:wrap;margin:.3rem 0 .6rem" }, [h("input", { type: "text", disabled: "", placeholder: "Ticker", "aria-label": "Ticker (disabled in the demo)", style: "flex:1 1 7rem;background:#0b111a;color:#7f8ca3;border:1px solid #52698a;border-radius:8px;padding:.5rem .7rem;font:inherit;min-height:2.5rem" }), h("input", { type: "text", disabled: "", placeholder: "$ amount", "aria-label": "Amount (disabled in the demo)", style: "flex:1 1 7rem;background:#0b111a;color:#7f8ca3;border:1px solid #52698a;border-radius:8px;padding:.5rem .7rem;font:inherit;min-height:2.5rem" }), h("button", { class: "tbtn", type: "button", disabled: "", text: "Buy (paper)" }), h("button", { class: "tbtn ghost", type: "button", disabled: "", text: "Sell (paper)" })]), h("p", { class: "empty", text: "Order entry is switched off in this demo. On the live dashboard a buy here sends a simulated order to the practice account and logs it; it never touches real money." })]);
    g.appendChild(card("ticket", "Order ticket", "Where a simulated order is entered by hand. The amount defaults to 10% of the account value; a position can grow past 10% afterwards as prices move.", OFF, form, { two: true }));
    g.appendChild(card("scan2", "Daily scan", "The 10:00 morning sweep: the 13-gate test over the research list plus a set of large companies, reporting what cleared every gate." + scanDateNote(), SNAP, scanKpis(false)));
    g.appendChild(h("div", { class: "sec", text: "The automated run" }));
    var lr = D.lastRun;
    var brows = D.blockedLatest.map(function (b) { return [{ t: dshort(b.date) }, { t: b.company + " (" + b.ticker + ")" }, { t: usd(b.usd) }, { t: usd(b.room) }]; });
    g.appendChild(card("runlog", "Run log · exposure limit", "Every weekday morning an automated run plans simulated orders for the practice account. Before any order is sent, a last safety check, the exposure limit, caps the total size of the portfolio. When there is no room, the order is cancelled and logged. This log is as recorded by the system.", SNAP, [
      kpis([{ l: "Last run", v: dshort(lr.date) }, { l: "Planned buys", v: String(lr.planned) }, { l: "Cancelled by the limit", v: String(lr.cancelled), cls: "down" }, { l: "Sent", v: String(lr.submitted) }]),
      table([{ t: "Date" }, { t: "Planned buy" }, { t: "Amount", num: 1 }, { t: "Room left", num: 1 }], brows, { caption: "Latest " + D.blockedLatest.length + " of " + D.blockedTotal + " cancelled simulated buys, " + dshort(D.blockedFrom) + " to " + dshort(D.blockedTo) }),
      h("p", { class: "note", text: "On " + D.stoppedDays + " days at least one attempt stopped itself before planning anything (the run can fire more than once a day; on " + D.stoppedBrokerDays + " of those days it could not confirm the practice account with the broker). In all, the run has planned " + D.autoTotal + " simulated orders; the latest are in the Planned simulated orders panel. Full logs are in the snapshot files below the dashboard." })], { two: true }));
    var arows = D.autoLatest.map(function (a) { return [{ t: dshort(a.date) }, { t: a.side.toUpperCase() + " " + a.ticker }, { t: usd(a.usd) }, { t: a.reason }]; });
    g.appendChild(card("orders", "Planned simulated orders", "The orders the automated run planned, from its daily notes. \"Basket\" marks the equal-weight approach switched on at the end of August; \"veto\" marks a sale the run made after a quality check turned against the name, recorded as \"veto flip\". Which checks count is not in the saved files.", SNAP, table([{ t: "Date" }, { t: "Order" }, { t: "Amount", num: 1 }, { t: "Reason as recorded" }], arows, { caption: "Latest " + D.autoLatest.length + " of " + D.autoTotal + ". Buys cancelled by the exposure limit are logged separately (" + D.blockedTotal + ", in the Run log card)." }), { two: true }));
    g.appendChild(h("div", { class: "sec", text: "Not computed in this snapshot" }));
    var dl = [["exec", "Execution (Almgren-Chriss)", "Plans how to split a large order over the day to limit market impact."], ["liqguard", "Liquidity guard", "Blocks an order that would be too large for the name's normal trading volume."], ["advisor", "Advisor", "Suggests trims and adds to bring the book back toward its target weights."], ["watch", "Watchlist", "Names being tracked for entry with their live signal badges."]];
    g.appendChild(notHereGroup("liveonly-trade", "Other Trade Desk panels · not computed here", dl.length + " panels are not computed in this snapshot: show the list", dl));
  }

  // ---------- shell ----------
  function showTab(id) {
    SURF.forEach(function (s) { var on = s.id === id; $("#tab-" + s.id).setAttribute("aria-selected", on ? "true" : "false"); $("#surface-" + s.id).classList.toggle("on", on); $("#tab-" + s.id).tabIndex = on ? 0 : -1; });
    state.tab = id;
    markScroll();
  }
  // On a phone a table wider than its card scrolls sideways; say so above it, once, so the reader knows before scrolling past 25 rows.
  function markScroll() {
    if (!narrow()) return; var sec = $("#surface-" + state.tab); if (!sec) return;
    // A few pixels of padding overflow (the correlation table) are not worth a swipe note; only a table that really hides columns gets one.
    sec.querySelectorAll(".tscroll").forEach(function (w) { if (w.getAttribute("data-swipe") || w.scrollWidth <= w.clientWidth + 16) return; w.setAttribute("data-swipe", "1"); w.insertAdjacentElement("beforebegin", h("p", { class: "note", text: "Swipe sideways for more columns." })); });
  }
  function build() {
    var term = $("#term");
    var tabs = $("#tabs");
    SURF.forEach(function (s) {
      var b = h("button", { type: "button", role: "tab", id: "tab-" + s.id, "aria-selected": "false", "aria-controls": "surface-" + s.id, text: s.label });
      b.addEventListener("click", function () { showTab(s.id); }); tabs.appendChild(b);
      var sec = h("section", { class: "surface", id: "surface-" + s.id, role: "tabpanel", "aria-labelledby": "tab-" + s.id });
      sec.appendChild(h("p", { class: "lead", text: s.lead }));
      var grid = h("div", { class: "grid", id: "grid-" + s.id });
      if (s.id === "floor") {
        var strip = h("div", { class: "strip" }); strip.appendChild(h("span", { class: "lbl", text: "Jump to a name → opens it in Research" }));
        // The strip repeats the tape's tickers, so its buttons stay clickable but leave the Tab order (the tape's row headers are the keyboard route).
        R.companies.forEach(function (c) { var b2 = h("button", { type: "button", "data-open": c.ticker, tabindex: "-1" }, [h("span", { class: "ini", "aria-hidden": "true", text: c.ticker.slice(0, 3) }), c.ticker, h("span", { class: "chg " + cls(c.tech.ret1d), text: pct(c.tech.ret1d * 100, 1, true) })]); strip.appendChild(b2); });
        sec.appendChild(strip);
      }
      sec.appendChild(grid); term.appendChild(sec);
    });
    tabs.addEventListener("keydown", function (e) { var ids = SURF.map(function (s) { return s.id; }), i = ids.indexOf(state.tab); if (e.key === "ArrowRight") { showTab(ids[(i + 1) % ids.length]); $("#tab-" + state.tab).focus(); } if (e.key === "ArrowLeft") { showTab(ids[(i - 1 + ids.length) % ids.length]); $("#tab-" + state.tab).focus(); } });
    floorCards($("#grid-floor")); researchCards($("#surface-research")); portfolioCards($("#grid-portfolio")); quantCards($("#grid-quant")); tradeCards($("#grid-trade"));
    $("#grid-research").remove();
    term.addEventListener("click", function (e) { var b = e.target.closest("[data-open]"); if (b) { openCompany(b.getAttribute("data-open")); } });
    showTab("floor"); openCompany("GEV", true); showTab("floor");
    // Chips per surface, built after the first company is open so Research lists its company panels too.
    // The company panels are re-created on every look-up, so a chip finds its card by id when clicked, not by a saved element.
    SURF.forEach(function (s) { var sec = $("#surface-" + s.id), chips = h("div", { class: "chips", role: "group", "aria-label": "Panels on " + s.label }); sec.querySelectorAll(".card").forEach(function (c) { var id = c.id, t = id === "card-company" ? "Company card" : $("h3 span", c).textContent.split(" · ")[0]; var b = h("button", { type: "button", text: t }); b.addEventListener("click", function () { var tgt = $("#" + id); if (tgt) { tgt.scrollIntoView({ block: "start", behavior: SMOOTH }); focusCard(tgt); } }); chips.appendChild(b); }); sec.insertBefore(chips, sec.firstChild); });
    document.documentElement.classList.add("term-ready");
  }

  // ---------- tour ----------
  function tourSteps() {
    return [
      // clear: the popover sits below the screen tabs, so the five screens the intro promises stay visible on the first step.
      { target: "#termbar", clear: "#tabs", title: "Welcome to the demo", body: ["This is a working copy of the research dashboard I built, running on saved data from 12 October 2026. Every panel you see exists on the real dashboard; the numbers are frozen, and nothing here is connected to the live system.", "It paper-trades: the account is simulated and every order is practice. No real money anywhere.", "Ten short steps. If this box covers something, press Minimize or drag it by its top line. End tour (or Escape) leaves at any time."], task: null },
      { target: "#card-tape", title: "The Floor: the market tape", body: ["The research list is 25 companies that supply power, grid equipment, data centers and chips to the AI buildout. The tape shows each one's last price and recent moves."], task: "tap or click any ticker in the tape. It opens the company in Research.", focus: "#card-tape .tk", done: function () { return state.tab === "research" && (state.lookups || 0) > state.base; }, doneText: function () { return cur.name + " (" + cur.ticker + ") is open in Research. Press Next."; }, before: function () { showTab("floor"); state.base = state.lookups || 0; } },
      { target: "#surface-research .search", title: "Research: one company", body: ["Everything the dashboard knows about the name on one screen: price and trend, the core ratios next to the sector median, two forensic accounting checks, a valuation read, and the factor rank."], task: "type a ticker from the list (for example ETN) into the box at the top and press Enter.", focus: "#tick", done: function () { return (state.lookups || 0) > state.base; }, doneText: function () { return $("#card-gauntlet") ? cur.name + " (" + cur.ticker + ") is open. Press Next." : "That ticker is not in the snapshot; pick one from the list, or press Next."; }, before: function () { showTab("research"); state.base = state.lookups || 0; } },
      // If the last look-up found nothing, the gate card is gone; reopen the current company so this step has its target.
      { target: "#card-gauntlet", title: "The 13 risk gates", body: ["Before the system will call a company a buy candidate, it has to pass all 13 of these yes-or-no rules. Most days nothing does. Each gate has a plain-English explanation."], task: "press \"Explain all 13\" to read what each gate means.", focus: "#explain-all", done: function () { return state.explainAll; }, doneText: "Now every gate explains itself. Press Next.", before: function () { showTab("research"); if (!$("#card-gauntlet")) openCompany(cur ? cur.ticker : "GEV", true); } },
      { target: "#card-holdings", title: "Portfolio & Risk: the book", body: ["The practice account held 14 companies at the snapshot, all from the research list. The account value and the positions are shown as the system recorded them."], task: null, before: function () { showTab("portfolio"); } },
      // corner: the popover takes the card's bottom-left (over the change list) so the chart's right end, the peak and the drop, stays uncovered. keep: on a phone the page scrolls so the chart sits above the pinned popover.
      { target: "#card-perf", corner: "left", keep: "#card-perf .chartbox", title: "The equity curve", body: ["The account's value against the S&P 500 since the reset on 3 July 2026, both starting at 100. The dashed vertical lines mark the main changes I made to the system; the ringed point is the highest the account reached."], task: "drag a finger (or move your mouse) across the chart to read any day. The tiles under the chart give the highest and latest points without it.", done: function () { return state.hovered; }, doneText: "That readout works for every day on the chart. Press Next.", before: function () { showTab("portfolio"); } },
      { target: "#card-risk", title: "Risk in plain words", body: ["VaR 95 is the loss a bad day could bring, the kind of day that comes about once in twenty. Beta says how hard the book moves when the market moves. Effective holdings says how many separate positions the book amounts to once position size is counted: a few large positions count for less than 14 equal ones."], task: null, before: function () { showTab("portfolio"); } },
      { target: "#card-backtest", title: "Quant Lab: the bench", body: ["The backtest replays a strategy over past prices. It is a simulation, not the paper account's record, and it is labelled that way. Next to it: the gauntlet across the whole list, the factor model and the screens."], task: null, before: function () { showTab("quant"); } },
      { target: "#card-runlog", title: "Trade Desk: the safety net", body: ["Every morning an automated run plans simulated orders. A final exposure limit cancels any buy there is no room for, and the dashboard logs it. Order entry is switched off in this demo."], task: null, before: function () { showTab("trade"); } },
      { target: "#btn-glossary", title: "Explore on your own", body: ["Every panel has a ? button that explains it. The glossary opens from the button above the dashboard, and the saved data files are listed below it.", "Thanks for looking."], task: null, before: function () { showTab("floor"); } },
    ];
  }

  // ---------- boot ----------
  function boot() {
    Promise.all([fetch("../data/replica.json").then(function (r) { return r.json(); }), fetch("../data/prices.json").then(function (r) { return r.json(); })]).then(function (res) {
      R = res[0]; PX = res[1]; SPY = PX.series.SPY;
      build();
      var sb = $("#btn-tour"); if (sb) sb.addEventListener("click", function () { window.Tour.start(tourSteps(), { onDone: function () { sb.focus(); } }); });
      var gb = $("#btn-glossary"), dr = $("#glossary"); if (gb && dr) { var open = function (on) { dr.classList.toggle("on", on); gb.setAttribute("aria-expanded", on ? "true" : "false"); document.querySelectorAll("body > .skip, .banner, .site-header, main, .site-footer, .tour-pop, .tour-shade").forEach(function (e) { e.inert = on; }); document.body.style.overflow = on ? "hidden" : ""; if (on) $(".close", dr).focus(); else gb.focus(); }; gb.addEventListener("click", function () { open(true); }); $(".close", dr).addEventListener("click", function () { open(false); }); $(".shade", dr).addEventListener("click", function () { open(false); }); document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dr.classList.contains("on")) open(false); }); }
      if (/^#tour$/.test(location.hash) && sb) sb.click();
    }).catch(function (err) {
      var t = $("#term"); if (t) t.insertAdjacentHTML("beforeend", '<p class="empty" style="margin:1rem">The saved data files could not be loaded, so the dashboard cannot draw itself here. The files are listed below this box and can be downloaded directly.</p>');
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
