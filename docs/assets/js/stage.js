// Helpers shared by the stage pages.
const STAGE = {
  C: { blue: "#2563eb", cyan: "#06b6d4", green: "#10b981", orange: "#f97316" },
  fmt: v => (+v).toLocaleString("en-US"),
  _data: null,
  load() { return this._data || (this._data = fetch("assets/data/stages.json").then(r => r.json())); },
  table(cols, rows, o = {}) {
    const num = o.num || [];
    return "<thead><tr>" + cols.map(c => `<th>${c}</th>`).join("") + "</tr></thead><tbody>" +
      rows.map(r => "<tr>" + r.map((v, i) => `<td class="${num.includes(i) ? "num" : ""}">${typeof v === "number" ? STAGE.fmt(v) : v}</td>`).join("") + "</tr>").join("") + "</tbody>";
  },
  tabs(id, fn) {
    const box = document.getElementById(id);
    box.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      box.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); fn(b.dataset.k);
    }));
  },
};
