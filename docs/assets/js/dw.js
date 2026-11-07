// Loads the real data warehouse (SQLite file) into the browser with sql.js.
// Used by the warehouse explorer and the dashboard.
const DW = (() => {
  let dbPromise;
  const root = window.SITE_ROOT || "";

  function open() {
    if (!dbPromise) {
      dbPromise = (async () => {
        const SQL = await initSqlJs({ locateFile: f => root + "assets/vendor/sqljs/" + f });
        const buf = await (await fetch(root + "assets/data/hotel_dw.sqlite")).arrayBuffer();
        return new SQL.Database(new Uint8Array(buf));
      })();
    }
    return dbPromise;
  }

  // run one statement; returns { columns, rows } with rows as arrays
  function run(db, sql, params) {
    const out = db.exec(sql, params || []);
    const last = out[out.length - 1];
    return last ? { columns: last.columns, rows: last.values } : { columns: [], rows: [] };
  }

  // same, but rows as objects
  function rows(db, sql, params) {
    const r = run(db, sql, params);
    return r.rows.map(v => Object.fromEntries(r.columns.map((c, i) => [c, v[i]])));
  }

  const fmt = (v, d = 0) => v == null ? "–" : (+v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const eur = v => v == null ? "–" : Math.abs(v) >= 1e6 ? "€" + (v / 1e6).toFixed(2) + "M" : "€" + fmt(v);

  return { open, run, rows, fmt, eur };
})();
