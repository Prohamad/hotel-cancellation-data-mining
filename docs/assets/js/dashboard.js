// BI dashboard: every number is a SQL query on the real data warehouse (sql.js).
let db;
const F = {};                                     // active filters: column -> value
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const BLUE = "#3b82f6", CYAN = "#22d3ee", GREEN = "#10b981", ORANGE = "#f97316", RED = "#ef4444";

// one flat view of the star schema, built once in memory
const FLAT = `
CREATE TEMP TABLE flat AS
SELECT d.year, d.month, d.month_name, d.season, h.hotel_name, c.market_segment, cu.customer_type, cu.country,
       p.deposit_type, f.lead_time, f.total_nights, f.adr, f.booked_revenue, f.realized_revenue, f.is_canceled,
       f.total_of_special_requests
FROM Fact_Booking f
JOIN Dim_Date d      ON f.date_key = d.date_key
JOIN Dim_Hotel h     ON f.hotel_key = h.hotel_key
JOIN Dim_Channel c   ON f.channel_key = c.channel_key
JOIN Dim_Customer cu ON f.customer_key = cu.customer_key
JOIN Dim_Policy p    ON f.policy_key = p.policy_key;`;

function where(skip) {
  const keys = Object.keys(F).filter(k => k !== skip && F[k] !== "");
  return { sql: keys.length ? "WHERE " + keys.map(k => `${k} = ?`).join(" AND ") : "", params: keys.map(k => F[k]) };
}
const Q = (sql, skip) => { const w = where(skip); return DW.rows(db, sql.replace("{W}", w.sql), w.params); };
const pct = v => v == null ? "–" : (v * 100).toFixed(1) + "%";

function fillFilters() {
  const orders = { month_name: "ORDER BY month", season: "ORDER BY CASE season WHEN 'Winter' THEN 1 WHEN 'Spring' THEN 2 WHEN 'Summer' THEN 3 ELSE 4 END" };
  document.querySelectorAll(".filters select").forEach(s => {
    const col = s.dataset.f;
    const vals = DW.run(db, `SELECT ${col} FROM flat GROUP BY ${col} ${orders[col] || `ORDER BY ${col}`}`).rows.map(r => r[0]);
    s.innerHTML = `<option value="">All</option>` + vals.map(v => `<option>${v}</option>`).join("");
    s.onchange = () => setFilter(col, s.value);
  });
  document.getElementById("reset").onclick = () => { Object.keys(F).forEach(k => delete F[k]); update(); };
}

function setFilter(col, val) {
  if (F[col] === val || val === "") delete F[col]; else F[col] = val;
  update();
}

function syncControls() {
  document.querySelectorAll(".filters select").forEach(s => { s.value = F[s.dataset.f] ?? ""; s.classList.toggle("set", !!F[s.dataset.f]); });
  document.getElementById("chips").innerHTML = Object.entries(F).map(([k, v]) =>
    `<button data-k="${k}">${k.replace(/_/g, " ")}: ${v}</button>`).join("");
  document.querySelectorAll("#chips button").forEach(b => b.onclick = () => setFilter(b.dataset.k, ""));
}

function kpis() {
  const [k] = Q(`SELECT COUNT(*) n, AVG(is_canceled) rate, SUM(booked_revenue) booked, SUM(booked_revenue - realized_revenue) lost,
                        AVG(adr) adr, AVG(lead_time) lead, AVG(total_nights) nights, SUM(is_canceled) canc FROM flat {W}`);
  const set = (id, v) => { const el = document.getElementById(id); el.textContent = v; el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); };
  set("k-n", DW.fmt(k.n)); document.getElementById("k-n2").textContent = `${(k.n / 86637 * 100).toFixed(1)}% of all`;
  set("k-rate", k.rate == null ? "–" : (k.rate * 100).toFixed(1)); document.getElementById("k-rate").insertAdjacentHTML("beforeend", "<sup>%</sup>"); document.getElementById("k-rate2").textContent = `${DW.fmt(k.canc)} canceled`;
  set("k-booked", DW.eur(k.booked));
  set("k-lost", DW.eur(k.lost)); document.getElementById("k-lost2").textContent = k.booked ? `${(k.lost / k.booked * 100).toFixed(1)}% of booked` : "";
  set("k-adr", k.adr == null ? "–" : "€" + k.adr.toFixed(1));
  set("k-lead", k.lead == null ? "–" : k.lead.toFixed(0) + " days");
  document.getElementById("k-nights").textContent = k.nights == null ? "" : `avg stay ${k.nights.toFixed(1)} nights`;
}

const GRID = "rgba(148,163,184,.14)";
const L = extra => {
  const l = PLOT.layout(Object.assign({ margin: { l: 50, r: 14, t: 10, b: 40 } }, extra));
  l.font = { family: "Inter, sans-serif", size: 11, color: "#94a3b8" };
  l.hoverlabel = { bgcolor: "#ffffff", bordercolor: "#ffffff", font: { color: "#0b1220", family: "Inter" } };
  ["xaxis", "yaxis", "yaxis2"].forEach(a => { if (l[a]) { l[a].gridcolor = l[a].showgrid === false ? undefined : GRID; l[a].linecolor = GRID; l[a].zeroline = false; } });
  if (l.legend) l.legend.font = { color: "#cbd5e1" };
  return l;
};
const draw = (id, traces, layout) => Plotly.react(id, traces, L(layout), PLOT.config);

function trend() {
  const r = Q(`SELECT year, month, COUNT(*) n, SUM(is_canceled) c, AVG(is_canceled) rate FROM flat {W} GROUP BY year, month ORDER BY year, month`);
  const x = r.map(d => `${d.year}-${String(d.month).padStart(2, "0")}`);
  draw("c-trend", [{ type: "scatter", mode: "lines+markers", x, y: r.map(d => d.rate * 100), fill: "tozeroy",
    fillcolor: "rgba(34,211,238,.10)", line: { color: CYAN, width: 2.5, shape: "spline" }, marker: { size: 5, color: CYAN },
    customdata: r.map(d => DW.fmt(d.c) + " of " + DW.fmt(d.n)), hovertemplate: "%{x}<br>%{y:.1f}% canceled<br>%{customdata}<extra></extra>" }],
    { xaxis: { type: "category", tickangle: -45, nticks: 14 }, yaxis: { ticksuffix: "%", rangemode: "tozero" } });
}

function matrix() {
  const r = Q(`SELECT year, month, COUNT(*) n, SUM(is_canceled) c FROM flat {W} GROUP BY year, month ORDER BY year, month`);
  const max = Math.max(1, ...r.map(d => d.n));
  const unit = [10, 25, 50, 100, 200, 250, 400].find(u => max / u <= 22) || 400;
  document.getElementById("m-scale").textContent = `1 dot ≈ ${unit} bookings`;
  const box = document.getElementById("c-matrix");
  box.style.gridTemplateColumns = `repeat(${r.length}, 1fr)`;
  box.innerHTML = r.map((d, k) => {
    const tot = Math.max(1, Math.round(d.n / unit)), cc = Math.round(d.c / unit);
    const lbl = `${MONTHS[d.month - 1].slice(0, 3)} ${d.year} · ${DW.fmt(d.n)} · ${(d.c / d.n * 100).toFixed(0)}% canceled`;
    return `<div class="mcol"><span class="tip">${lbl}</span>${Array.from({ length: tot }, (_, j) =>
      `<i class="${j < cc ? "c" : ""}" style="animation-delay:${(k * 0.02 + j * 0.015).toFixed(3)}s"></i>`).join("")}</div>`;
  }).join("");
}

function hotel() {
  const r = Q(`SELECT hotel_name h, COUNT(*) n, AVG(is_canceled) rate FROM flat {W} GROUP BY hotel_name ORDER BY hotel_name`, "hotel_name");
  draw("c-hotel", [{ type: "pie", hole: .62, labels: r.map(d => d.h), values: r.map(d => d.n), sort: false,
    marker: { colors: r.map(d => !F.hotel_name || F.hotel_name === d.h ? (d.h === "City Hotel" ? BLUE : GREEN) : "#334155"), line: { color: "#0b1220", width: 3 } },
    text: r.map(d => pct(d.rate) + " canceled"), textinfo: "label+percent", hovertemplate: "%{label}<br>%{value:,} bookings<br>%{text}<extra></extra>" }],
    { margin: { l: 10, r: 10, t: 10, b: 10 }, annotations: [{ text: `<b>${DW.fmt(r.reduce((a, d) => a + d.n, 0))}</b><br>bookings`, showarrow: false, font: { size: 13, color: "#fff" } }] });
  bind("c-hotel", p => setFilter("hotel_name", p.label));
}

function segment() {
  const r = Q(`SELECT market_segment s, SUM(booked_revenue - realized_revenue) lost, AVG(is_canceled) rate FROM flat {W}
               GROUP BY market_segment HAVING COUNT(*) >= 50 ORDER BY lost`, "market_segment");
  draw("c-seg", [{ type: "bar", orientation: "h", y: r.map(d => d.s), x: r.map(d => d.lost), text: r.map(d => DW.eur(d.lost)), textposition: "auto",
    marker: { color: r.map(d => !F.market_segment || F.market_segment === d.s ? ORANGE : "rgba(249,115,22,.25)") }, textfont: { color: "#fff" },
    customdata: r.map(d => pct(d.rate)), hovertemplate: "%{y}<br>Lost: €%{x:,.0f}<br>%{customdata} canceled<extra></extra>" }],
    { margin: { l: 100, r: 14, t: 6, b: 30 }, xaxis: { gridcolor: "#232327", tickprefix: "€" }, yaxis: { type: "category" } });
  bind("c-seg", p => setFilter("market_segment", p.y));
}

function lead() {
  const r = Q(`SELECT CASE WHEN lead_time <= 7 THEN '0–7' WHEN lead_time <= 30 THEN '8–30' WHEN lead_time <= 90 THEN '31–90'
                WHEN lead_time <= 180 THEN '91–180' WHEN lead_time <= 365 THEN '181–365' ELSE '>365' END b,
                MIN(lead_time) o, COUNT(*) n, AVG(is_canceled) rate FROM flat {W} GROUP BY b ORDER BY o`);
  draw("c-lead", [{ type: "bar", x: r.map(d => d.b), y: r.map(d => d.rate * 100), text: r.map(d => pct(d.rate)), textposition: "outside",
    marker: { color: r.map(d => d.rate), colorscale: [[0, "#0e7490"], [.5, CYAN], [1, ORANGE]], cmin: 0, cmax: .5 }, textfont: { color: "#2a2a30" },
    customdata: r.map(d => DW.fmt(d.n)), hovertemplate: "%{x} days<br>%{y:.1f}% canceled<br>%{customdata} bookings<extra></extra>" }],
    { yaxis: { ticksuffix: "%", gridcolor: "#232327", range: [0, Math.max(10, ...r.map(d => d.rate * 100)) * 1.2] }, xaxis: { type: "category", title: "days" } });
}

function adr() {
  const r = Q(`SELECT hotel_name h, month m, AVG(adr) a FROM flat {W} GROUP BY hotel_name, month ORDER BY month`);
  const hotels = [...new Set(r.map(d => d.h))];
  draw("c-adr", hotels.map(h => ({ type: "scatter", mode: "lines+markers", name: h, x: r.filter(d => d.h === h).map(d => MONTHS[d.m - 1].slice(0, 3)),
    y: r.filter(d => d.h === h).map(d => d.a), line: { color: h === "City Hotel" ? BLUE : GREEN, width: 2.5, shape: "spline" },
    hovertemplate: `${h}<br>%{x}: €%{y:.1f}<extra></extra>` })),
    { showlegend: true, legend: { orientation: "h", y: 1.12 }, margin: { l: 50, r: 14, t: 24, b: 36 }, yaxis: { tickprefix: "€", gridcolor: "#232327" },
      xaxis: { type: "category", categoryorder: "array", categoryarray: MONTHS.map(m => m.slice(0, 3)) } });
}

function requests() {
  const r = Q(`SELECT MIN(total_of_special_requests, 3) k, COUNT(*) n, AVG(is_canceled) rate FROM flat {W} GROUP BY k ORDER BY k`);
  draw("c-req", [{ type: "bar", x: r.map(d => d.k === 3 ? "3+" : String(d.k)), y: r.map(d => d.rate * 100), text: r.map(d => pct(d.rate)), textposition: "outside",
    marker: { color: [ORANGE, CYAN, CYAN, GREEN] }, textfont: { color: "#2a2a30" }, customdata: r.map(d => DW.fmt(d.n)),
    hovertemplate: "%{x} requests<br>%{y:.1f}% canceled<br>%{customdata} bookings<extra></extra>" }],
    { yaxis: { ticksuffix: "%", gridcolor: "#232327", range: [0, Math.max(10, ...r.map(d => d.rate * 100)) * 1.2] }, xaxis: { type: "category", title: "special requests" } });
}

function heat() {
  const r = Q(`SELECT customer_type c, deposit_type d, AVG(is_canceled) rate, COUNT(*) n FROM flat {W} GROUP BY c, d`);
  const cs = [...new Set(r.map(d => d.c))].sort(), ds = [...new Set(r.map(d => d.d))].sort();
  const z = ds.map(d => cs.map(c => { const v = r.find(x => x.c === c && x.d === d); return v && v.n >= 20 ? v.rate * 100 : null; }));
  const n = ds.map(d => cs.map(c => { const v = r.find(x => x.c === c && x.d === d); return v ? DW.fmt(v.n) : "0"; }));
  draw("c-heat", [{ type: "heatmap", x: cs, y: ds, z, customdata: n, zmin: 0, zmax: 100, xgap: 3, ygap: 3,
    colorscale: [[0, "#0f2a3d"], [.3, "#0e7490"], [.6, "#22d3ee"], [1, "#f97316"]], colorbar: { ticksuffix: "%", thickness: 8, len: .9, tickfont: { color: "#94a3b8" }, outlinewidth: 0 },
    text: z.map(row => row.map(v => v == null ? "" : v.toFixed(0) + "%")), texttemplate: "%{text}",
    hovertemplate: "%{x} · %{y}<br>%{z:.1f}% canceled<br>%{customdata} bookings<extra></extra>" }],
    { margin: { l: 90, r: 10, t: 6, b: 46 }, xaxis: { type: "category", tickangle: 0, tickfont: { size: 10 } }, yaxis: { type: "category" } });
}

function country() {
  const r = Q(`SELECT country c, COUNT(*) n, AVG(is_canceled) rate FROM flat {W} GROUP BY country ORDER BY n DESC LIMIT 10`).reverse();
  draw("c-country", [
    { type: "bar", orientation: "h", y: r.map(d => d.c), x: r.map(d => d.n), marker: { color: BLUE }, name: "bookings", textfont: { color: "#2a2a30" },
      text: r.map(d => pct(d.rate)), textposition: "outside", cliponaxis: false, hovertemplate: "%{y}<br>%{x:,} bookings<br>%{text} canceled<extra></extra>" }],
    { margin: { l: 60, r: 50, t: 6, b: 30 }, yaxis: { type: "category" }, xaxis: { gridcolor: "#232327" } });
}

function bind(id, fn) {
  const el = document.getElementById(id);
  if (el._bound) return; el._bound = true;
  el.on("plotly_click", e => e.points && e.points[0] && fn(e.points[0]));
}

function update() {
  syncControls();
  kpis(); matrix(); trend(); hotel(); segment(); lead(); adr(); requests(); heat(); country();
}

document.addEventListener("DOMContentLoaded", async () => {
  db = await DW.open();
  db.run(FLAT);
  const st = document.getElementById("status");
  st.classList.add("ok"); st.lastChild.textContent = "Live · " + DW.fmt(DW.run(db, "SELECT COUNT(*) FROM flat").rows[0][0]) + " bookings";
  fillFilters(); update();
});
