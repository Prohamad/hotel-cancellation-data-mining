// Data warehouse page: star schema, live ETL checks and the SQL explorer.
const TABLES = [
  { name: "Dim_Date", pos: [1, 1], role: "When the guest arrives" },
  { name: "Dim_Hotel", pos: [2, 1], role: "City or Resort hotel" },
  { name: "Dim_Customer", pos: [3, 1], role: "Who booked" },
  { name: "Fact_Booking", pos: [2, 2], role: "One row per booking", fact: true },
  { name: "Dim_Channel", pos: [1, 3], role: "How it was booked" },
  { name: "Dim_Room", pos: [2, 3], role: "Reserved and assigned room" },
  { name: "Dim_Policy", pos: [3, 3], role: "Deposit and meal plan" },
];
const MEASURES = ["lead_time", "total_nights", "adults", "children", "babies", "adr", "booked_revenue",
  "realized_revenue", "is_canceled", "booking_changes", "total_of_special_requests"];

// queries from notebook 04 (sections 7 and 8)
const QUERIES = [
  { g: "Analytical SQL" },
  { t: "Q1 · Overall totals", d: "Bookings, cancellations and lost revenue", chart: "none", sql:
`SELECT COUNT(*)                                        AS bookings,
       SUM(is_canceled)                                AS canceled,
       ROUND(AVG(is_canceled) * 100, 1)                AS cancel_rate_pct,
       ROUND(SUM(booked_revenue))                      AS booked_revenue,
       ROUND(SUM(realized_revenue))                    AS realized_revenue,
       ROUND(SUM(booked_revenue) - SUM(realized_revenue)) AS lost_revenue
FROM Fact_Booking` },
  { t: "Q2 · By hotel", d: "Performance of each hotel", sql:
`SELECT h.hotel_name,
       COUNT(*)                                             AS bookings,
       ROUND(AVG(f.is_canceled) * 100, 1)                   AS cancel_rate_pct,
       ROUND(SUM(f.booked_revenue))                         AS booked_revenue,
       ROUND(SUM(f.realized_revenue))                       AS realized_revenue,
       ROUND(SUM(f.booked_revenue) - SUM(f.realized_revenue)) AS lost_revenue
FROM Fact_Booking f
JOIN Dim_Hotel h ON f.hotel_key = h.hotel_key
GROUP BY h.hotel_name` },
  { t: "Q3 · Lost revenue by segment", d: "Where is revenue lost?", y: "lost_revenue", sql:
`SELECT c.market_segment,
       COUNT(*)                                          AS bookings,
       ROUND(AVG(f.is_canceled) * 100, 1)                AS cancel_rate_pct,
       ROUND(SUM(f.booked_revenue - f.realized_revenue)) AS lost_revenue,
       ROUND(100.0 * SUM(f.booked_revenue - f.realized_revenue)
             / (SELECT SUM(booked_revenue - realized_revenue) FROM Fact_Booking), 1) AS share_of_lost_pct
FROM Fact_Booking f
JOIN Dim_Channel c ON f.channel_key = c.channel_key
GROUP BY c.market_segment
ORDER BY lost_revenue DESC` },
  { g: "OLAP operations" },
  { t: "Roll-up", d: "From individual dates up to years", y: "bookings", sql:
`SELECT d.year,
       COUNT(*)                           AS bookings,
       ROUND(AVG(f.is_canceled) * 100, 1) AS cancel_rate_pct,
       ROUND(SUM(f.realized_revenue))     AS realized_revenue
FROM Fact_Booking f
JOIN Dim_Date d ON f.date_key = d.date_key
GROUP BY d.year
ORDER BY d.year` },
  { t: "Drill-down", d: "From year down to quarter", x: ["year", "quarter"], y: "realized_revenue", sql:
`SELECT d.year, d.quarter,
       COUNT(*)                       AS bookings,
       ROUND(SUM(f.realized_revenue)) AS realized_revenue
FROM Fact_Booking f
JOIN Dim_Date d ON f.date_key = d.date_key
GROUP BY d.year, d.quarter
ORDER BY d.year, d.quarter` },
  { t: "Slice", d: "Hotel = Resort Hotel, by season", y: "avg_adr", sql:
`SELECT d.season,
       COUNT(*)                           AS bookings,
       ROUND(AVG(f.is_canceled) * 100, 1) AS cancel_rate_pct,
       ROUND(AVG(f.adr), 2)               AS avg_adr,
       ROUND(SUM(f.realized_revenue))     AS realized_revenue
FROM Fact_Booking f
JOIN Dim_Date d  ON f.date_key = d.date_key
JOIN Dim_Hotel h ON f.hotel_key = h.hotel_key
WHERE h.hotel_name = 'Resort Hotel'
GROUP BY d.season
ORDER BY CASE d.season WHEN 'Winter' THEN 1 WHEN 'Spring' THEN 2 WHEN 'Summer' THEN 3 ELSE 4 END` },
  { t: "Dice", d: "City × Online TA × Summer", y: "cancel_rate_pct", sql:
`SELECT cu.customer_type,
       COUNT(*)                           AS bookings,
       ROUND(AVG(f.is_canceled) * 100, 1) AS cancel_rate_pct,
       ROUND(AVG(f.lead_time))            AS avg_lead_time
FROM Fact_Booking f
JOIN Dim_Date d      ON f.date_key = d.date_key
JOIN Dim_Hotel h     ON f.hotel_key = h.hotel_key
JOIN Dim_Channel c   ON f.channel_key = c.channel_key
JOIN Dim_Customer cu ON f.customer_key = cu.customer_key
WHERE h.hotel_name = 'City Hotel'
  AND c.market_segment = 'Online TA'
  AND d.season = 'Summer'
GROUP BY cu.customer_type
ORDER BY bookings DESC` },
  { t: "Pivot", d: "Cancel rate: segment × hotel", y: ["city_hotel", "resort_hotel"], sql:
`SELECT c.market_segment,
       ROUND(AVG(CASE WHEN h.hotel_name = 'City Hotel'   THEN f.is_canceled END) * 100, 1) AS city_hotel,
       ROUND(AVG(CASE WHEN h.hotel_name = 'Resort Hotel' THEN f.is_canceled END) * 100, 1) AS resort_hotel,
       COUNT(*) AS bookings
FROM Fact_Booking f
JOIN Dim_Hotel h   ON f.hotel_key = h.hotel_key
JOIN Dim_Channel c ON f.channel_key = c.channel_key
GROUP BY c.market_segment
HAVING COUNT(*) > 100
ORDER BY bookings DESC` },
  { t: "Ranking", d: "Top 10 countries by revenue", x: ["country"], y: "realized_revenue", sql:
`SELECT RANK() OVER (ORDER BY SUM(f.realized_revenue) DESC) AS revenue_rank,
       cu.country,
       COUNT(*)                           AS bookings,
       ROUND(SUM(f.realized_revenue))     AS realized_revenue,
       ROUND(AVG(f.is_canceled) * 100, 1) AS cancel_rate_pct
FROM Fact_Booking f
JOIN Dim_Customer cu ON f.customer_key = cu.customer_key
GROUP BY cu.country
ORDER BY realized_revenue DESC
LIMIT 10` },
];

let db, current = null;

function tableHTML(cols, rows, limit = 500) {
  const head = "<thead><tr>" + cols.map(c => `<th>${c}</th>`).join("") + "</tr></thead>";
  const plain = cols.map(c => /(_key|year|quarter|month|week_number|day_of_month|rank)$/.test(c));
  const body = rows.slice(0, limit).map(r => "<tr>" + r.map((v, i) =>
    `<td>${v == null ? "<span style='color:var(--muted)'>NULL</span>" : typeof v === "number" ? (plain[i] ? v : DW.fmt(v, Number.isInteger(v) ? 0 : 2)) : String(v).replace(/</g, "&lt;")}</td>`).join("") + "</tr>").join("");
  return head + "<tbody>" + body + "</tbody>";
}

// ---------- star schema ----------
function drawStar() {
  const star = document.getElementById("star");
  TABLES.forEach(t => {
    const cols = DW.run(db, `PRAGMA table_info(${t.name})`).rows.map(r => r[1]);
    const n = DW.run(db, `SELECT COUNT(*) FROM ${t.name}`).rows[0][0];
    t.cols = cols; t.n = n;
    const shown = t.fact ? cols.filter(c => c.endsWith("_key")) : cols.slice(0, 5);
    const li = shown.map((c, i) => `<li class="${i === 0 ? "pk" : c.endsWith("_key") ? "fk" : ""}">${i === 0 ? "🔑 " : c.endsWith("_key") ? "↗ " : ""}${c}</li>`).join("") +
      (t.fact ? `<li>+ ${cols.length - shown.length} measures</li>` : cols.length > 5 ? `<li>+ ${cols.length - 5} more</li>` : "");
    const el = document.createElement("button");
    el.className = "tbl" + (t.fact ? " fact" : "");
    el.style.gridColumn = t.pos[0]; el.style.gridRow = t.pos[1];
    el.dataset.name = t.name;
    el.innerHTML = `<span class="cnt">${DW.fmt(n)} rows</span><span class="k">${t.fact ? "Fact" : "Dimension"}</span><b>${t.name}</b><ul>${li}</ul>`;
    el.onclick = () => selectTable(t.name);
    star.appendChild(el);
  });
  lines(); selectTable("Fact_Booking");
  new ResizeObserver(lines).observe(star);
}

function lines() {
  const star = document.getElementById("star"), svg = document.getElementById("star-lines");
  const sr = star.getBoundingClientRect();
  const c = el => { const r = el.getBoundingClientRect(); return [r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2]; };
  const fact = star.querySelector(".tbl.fact"), [fx, fy] = c(fact);
  svg.innerHTML = `<defs><linearGradient id="sg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${sr.width}" y2="0">
    <stop offset="0" stop-color="#2563eb"/><stop offset=".55" stop-color="#06b6d4"/><stop offset="1" stop-color="#10b981"/></linearGradient></defs>` +
    [...star.querySelectorAll(".tbl:not(.fact)")].map(el => { const [x, y] = c(el);
      return `<line data-n="${el.dataset.name}" x1="${fx}" y1="${fy}" x2="${x}" y2="${y}"/>`; }).join("");
}

function selectTable(name) {
  const t = TABLES.find(x => x.name === name);
  document.querySelectorAll(".tbl").forEach(el => el.classList.toggle("on", el.dataset.name === name));
  document.querySelectorAll("#star-lines line").forEach(l => l.classList.toggle("on", l.dataset.n === name));
  document.getElementById("tp-type").textContent = (t.fact ? "Fact table · " : "Dimension · ") + t.role;
  document.getElementById("tp-name").textContent = name;
  document.getElementById("tp-count").textContent = DW.fmt(t.n) + " rows · " + t.cols.length + " columns";
  document.getElementById("tp-cols").innerHTML = t.cols.map((c, i) => {
    const cls = i === 0 ? "pk" : c.endsWith("_key") ? "fk" : MEASURES.includes(c) && t.fact ? "m" : "";
    const tag = cls === "pk" ? " · PK" : cls === "fk" ? " · FK" : cls === "m" ? " · measure" : "";
    return `<span class="${cls}">${c}${tag}</span>`; }).join("");
  const r = DW.run(db, `SELECT * FROM ${name} LIMIT 8`);
  document.getElementById("tp-rows").innerHTML = tableHTML(r.columns, r.rows);
}

// ---------- ETL checks ----------
function checks() {
  const [n, rev, orphans] = DW.run(db, `SELECT COUNT(*), SUM(booked_revenue),
     (SELECT COUNT(*) FROM Fact_Booking f LEFT JOIN Dim_Date d ON f.date_key = d.date_key WHERE d.date_key IS NULL)
     FROM Fact_Booking`).rows[0];
  const missing = DW.run(db, `SELECT COUNT(*) FROM Fact_Booking f
     LEFT JOIN Dim_Hotel h ON f.hotel_key = h.hotel_key LEFT JOIN Dim_Customer c ON f.customer_key = c.customer_key
     LEFT JOIN Dim_Channel ch ON f.channel_key = ch.channel_key LEFT JOIN Dim_Room r ON f.room_key = r.room_key
     LEFT JOIN Dim_Policy p ON f.policy_key = p.policy_key
     WHERE h.hotel_key IS NULL OR c.customer_key IS NULL OR ch.channel_key IS NULL OR r.room_key IS NULL OR p.policy_key IS NULL`).rows[0][0];
  const items = [
    [n === 86637, "Rows: source = fact", `${DW.fmt(86637)} = ${DW.fmt(n)}`],
    [Math.abs(rev - 34446255) < 1, "Booked revenue matches", `€${DW.fmt(rev)}`],
    [orphans + missing === 0, "No orphan keys", `${orphans + missing} keys without a dimension row`],
  ];
  document.getElementById("checks").innerHTML = items.map(([ok, t, s]) =>
    `<div class="check"><div class="ok ${ok ? "" : "bad"}">${ok ? "✓" : "✕"}</div><div><b>${t}</b><span>${s}</span></div></div>`).join("");
}

// ---------- SQL explorer ----------
function buildOps() {
  const ops = document.getElementById("ops");
  ops.innerHTML = QUERIES.map((q, i) => q.g ? `<div class="grp">${q.g}</div>` :
    `<button data-i="${i}"><b>${q.t}</b><small>${q.d}</small></button>`).join("");
  ops.querySelectorAll("button").forEach(b => b.onclick = () => load(+b.dataset.i));
}

function load(i) {
  current = QUERIES[i];
  document.querySelectorAll("#ops button").forEach(b => b.classList.toggle("on", +b.dataset.i === i));
  document.getElementById("q-title").textContent = current.t;
  document.getElementById("sql").value = current.sql;
  execute();
}

function execute() {
  const sql = document.getElementById("sql").value, meta = document.getElementById("res-meta");
  const t0 = performance.now();
  let r;
  try { r = DW.run(db, sql); }
  catch (e) {
    meta.className = "res-meta err"; meta.textContent = "Error: " + e.message;
    document.getElementById("res").innerHTML = ""; document.getElementById("res-chart-box").style.display = "none"; return;
  }
  const ms = (performance.now() - t0).toFixed(0);
  meta.className = "res-meta";
  meta.textContent = `${r.rows.length} row${r.rows.length === 1 ? "" : "s"} · ${ms} ms` + (r.rows.length > 500 ? " · first 500 shown" : "");
  document.getElementById("res").innerHTML = tableHTML(r.columns, r.rows);
  chart(r);
}

// draw a bar chart when the result has a label column and a numeric column
function chart(r) {
  const box = document.getElementById("res-chart-box");
  const isNum = c => r.rows.length && r.rows.every(row => typeof row[r.columns.indexOf(c)] === "number");
  const q = current && document.getElementById("sql").value === current.sql ? current : {};
  if (q.chart === "none" || r.rows.length < 2 || r.rows.length > 60) { box.style.display = "none"; return; }
  const xCols = q.x || [r.columns.find(c => !isNum(c)) || r.columns[0]];
  const ys = [].concat(q.y || r.columns.find(c => isNum(c) && !xCols.includes(c)) || []);
  if (!ys.length) { box.style.display = "none"; return; }
  box.style.display = "";
  const x = r.rows.map(row => xCols.map(c => row[r.columns.indexOf(c)]).join(" · Q").replace(/ · Q(\d)$/, " Q$1"));
  const colors = ["#2563eb", "#10b981", "#06b6d4"];
  const traces = ys.map((y, k) => ({ type: "bar", name: y, x, y: r.rows.map(row => row[r.columns.indexOf(y)]),
    marker: { color: colors[k % 3], line: { width: 0 } }, hovertemplate: `%{x}<br>${y}: %{y:,}<extra></extra>` }));
  Plotly.react("res-chart", traces, PLOT.layout({ barmode: "group", showlegend: ys.length > 1,
    legend: { orientation: "h", y: 1.12 }, yaxis: { title: ys.length === 1 ? ys[0] : "%", gridcolor: "#232327" },
    xaxis: { type: "category", tickangle: x.length > 6 ? -30 : 0 }, margin: { l: 70, r: 10, t: 26, b: 70 } }), PLOT.config);
}

document.addEventListener("DOMContentLoaded", async () => {
  buildOps();
  db = await DW.open();
  document.getElementById("m-status").textContent = "Database loaded ✓";
  document.getElementById("m-status").classList.add("keep");
  drawStar(); checks(); load(1);
  document.getElementById("run").onclick = execute;
  document.getElementById("reset").onclick = () => current && load(QUERIES.indexOf(current));
  document.getElementById("sql").addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); execute(); }
    if (e.key === "Tab") { e.preventDefault(); const t = e.target, s = t.selectionStart;
      t.value = t.value.slice(0, s) + "    " + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = s + 4; }
  });
});
