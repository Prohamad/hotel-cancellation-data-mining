// Shared navigation, footer and small behaviours for every page.
const STAGES = [
  ["01", "data.html", "Data Understanding", "119,390 bookings · 32 attributes"],
  ["02", "preprocessing.html", "Preprocessing", "Duplicates, invalid rows, missing values"],
  ["03", "outliers.html", "Outlier Analysis", "IQR and Z-score"],
  ["04", "warehouse.html", "Data Warehouse", "Star schema · OLAP"],
  ["05", "eda.html", "Exploratory Analysis", "Patterns behind cancellation"],
  ["06", "classification.html", "Classification", "5 models · Random Forest best"],
  ["07", "clustering.html", "Clustering", "K-Means · Agglomerative"],
  ["08", "regression.html", "Numeric Prediction", "Room price (ADR)"],
];

const ROOT = window.SITE_ROOT || "";

function renderNav() {
  const here = location.pathname.includes("/nb/") ? "notebooks.html" : (location.pathname.split("/").pop() || "index.html");
  const inStage = STAGES.some(s => s[1] === here);
  const menu = STAGES.map(([n, href, t, s]) =>
    `<a href="${ROOT}${href}"><b>${n}</b><span>${t}<small>${s}</small></span></a>`).join("");
  const link = (href, t) => `<a href="${ROOT}${href}" class="${here === href ? "on" : ""}">${t}</a>`;
  document.getElementById("nav").innerHTML = `
    <nav class="nav"><div class="glassnav">
      <button class="burger" aria-label="Menu" onclick="this.parentNode.classList.toggle('open')"><span></span>Menu</button>
      <div class="links">
        ${link("index.html", "Home")}
        <div class="dd ${inStage ? "on" : ""}"><button onclick="this.parentNode.classList.toggle('open')">Pipeline</button><div class="menu">${menu}</div></div>
        ${link("warehouse.html#explorer", "SQL Explorer")}
        ${link("notebooks.html", "Notebooks")}
        ${link("findings.html", "Findings")}
        ${link("team.html", "Team")}
        <a href="${ROOT}dashboard.html" class="cta-nav ${here === "dashboard.html" ? "on" : ""}">Dashboard</a>
      </div>
    </div></nav>`;
}

function renderFooter() {
  const el = document.getElementById("footer");
  if (!el) return;
  el.innerHTML = `<footer><div class="wrap">
    <div><b>Hotel Booking Cancellation Prediction Using Data Mining</b><br>
      CIS 517 · Data Mining and Warehousing · Imam Abdulrahman Bin Faisal University</div>
    <div>Dataset: Antonio, de Almeida &amp; Nunes (2019), <i>Data in Brief</i> 22, 41–49 ·
      <a href="https://www.kaggle.com/datasets/jessemostipak/hotel-booking-demand" target="_blank" rel="noopener">Kaggle</a></div>
  </div></footer>`;
}

function initReveal() {
  // stagger siblings: each card in a group appears a little later than the previous one
  document.querySelectorAll(".rv").forEach(el => {
    const sibs = [...el.parentNode.children].filter(c => c.classList.contains("rv"));
    el.style.setProperty("--d", (sibs.indexOf(el) * 0.08) + "s");
  });
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll(".rv").forEach(el => io.observe(el));
}

function initToc() {
  const links = [...document.querySelectorAll(".toc a")];
  if (!links.length) return;
  const secs = links.map(a => document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1))));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
      links.forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
    }
  }), { rootMargin: "-30% 0px -60% 0px" });
  secs.forEach(s => s && io.observe(s));
}

// count-up for KPI numbers: <span data-count="27.7" data-dec="1" data-suffix="%">
function initCounters() {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
    const pre = el.dataset.prefix || "", suf = el.dataset.suffix || "", t0 = performance.now();
    const fmt = v => pre + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
    const step = t => { const k = Math.min(1, (t - t0) / 1100); el.textContent = fmt(end * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step); io.unobserve(el);
  }), { threshold: 0.5 });
  document.querySelectorAll("[data-count]").forEach(el => io.observe(el));
}

// common Plotly layout in the site style
const PLOT = {
  layout: (extra = {}) => Object.assign({
    font: { family: "Inter, sans-serif", size: 12, color: "#a1a1aa" },
    colorway: ["#2563eb", "#06b6d4", "#10b981", "#f97316"],
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 56, r: 18, t: 18, b: 46 },
    xaxis: { gridcolor: "#232327", zeroline: false }, yaxis: { gridcolor: "#232327", zeroline: false },
    transition: { duration: 500, easing: "cubic-in-out" },
    hoverlabel: { bgcolor: "#fafafa", bordercolor: "#fafafa", font: { color: "#0b0b0c", family: "Inter" } },
    showlegend: false,
  }, extra),
  config: { displayModeBar: false, responsive: true },
};

// soft light that follows the mouse inside cards
function initSpotlight() {
  document.querySelectorAll(".card, .kpi, .pager a").forEach(el => {
    el.classList.add("spot");
    el.addEventListener("mousemove", e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left) + "px");
      el.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });
  const hero = document.querySelector(".hero");
  if (hero && matchMedia("(pointer: fine)").matches) {
    const g = document.createElement("div"); g.className = "hero-glow"; hero.prepend(g);
    hero.addEventListener("mousemove", e => {
      const r = hero.getBoundingClientRect();
      g.style.setProperty("--hx", (e.clientX - r.left - 260) + "px");
      g.style.setProperty("--hy", (e.clientY - r.top - 260) + "px");
    });
  }
}

// fade between pages (browsers without View Transitions get a short JS fade)
function initTransitions() {
  if ("onpagereveal" in window) return;   // native cross-page View Transitions handle it
  document.addEventListener("click", e => {
    const a = e.target.closest("a");
    if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    e.preventDefault(); document.body.classList.add("leaving");
    setTimeout(() => (location.href = a.href), 190);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".page-hero").forEach(h => h.insertAdjacentHTML("afterbegin", '<div class="gridbg"></div>'));
  renderNav(); renderFooter(); initReveal(); initToc(); initCounters(); initSpotlight(); initTransitions();
});
