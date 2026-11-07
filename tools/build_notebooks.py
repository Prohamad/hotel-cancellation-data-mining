"""Render the project notebooks (.ipynb) as styled pages of the website.

Run from the project folder:  python tools/build_notebooks.py
Reads  notebooks/*.ipynb  and writes  docs/nb/NN.html, docs/nb/img/*.png and docs/notebooks.html.
The notebooks are shown exactly as they were run (saved outputs); nothing is re-executed.
"""
import base64, html, json, re
from pathlib import Path

import markdown
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import PythonLexer

ROOT = Path(__file__).parent.parent
SRC, OUT = ROOT / "notebooks", ROOT / "docs" / "nb"
IMG = OUT / "img"
IMG.mkdir(parents=True, exist_ok=True)

# notebook number -> stage page and short description used on the index
STAGE = {
    "01": ("data.html", "Load the data, attribute types, missing values, duplicates and the class label."),
    "02": ("preprocessing.html", "Remove duplicates and invalid rows, handle missing values and engineer features."),
    "03": ("outliers.html", "IQR and Z-score on the numeric attributes; evaluate and handle the outliers."),
    "04": ("warehouse.html", "Star schema in SQLite: ETL, validation and OLAP queries."),
    "05": ("eda.html", "Distributions, cancellation by attribute, seasonality and correlations."),
    "06": ("classification.html", "Decision Tree, Naive Bayes, k-NN, Logistic Regression and Random Forest."),
    "07": ("clustering.html", "K-Means with the elbow method and silhouette; agglomerative clustering."),
    "08": ("regression.html", "Simple and multiple linear regression and decision tree regression for ADR."),
}

ANSI = re.compile(r"\x1b\[[0-9;]*m")
FMT = HtmlFormatter(nowrap=True)


def text(x):
    return "".join(x) if isinstance(x, list) else x


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"<[^>]+>", "", s).lower()).strip("-")


def fix_lists(src):
    # Markdown needs an empty line before a list; Jupyter does not
    out, prev = [], ""
    for line in src.split("\n"):
        is_item = re.match(r"\s*([-*+]|\d+[.)])\s+", line)
        prev_item = re.match(r"\s*([-*+]|\d+[.)])\s+", prev)
        if is_item and prev.strip() and not prev_item and not prev.startswith("    "):
            out.append("")
        out.append(line); prev = line
    return "\n".join(out)


def render_md(src, toc):
    src = fix_lists(src)
    # keep LaTeX away from the Markdown parser, then put it back for KaTeX
    maths = []
    def keep(m):
        maths.append(m.group(0)); return f"@@MATH{len(maths) - 1}@@"
    src = re.sub(r"\$\$.+?\$\$|\$[^$\n]+?\$", keep, src, flags=re.S)
    out = markdown.markdown(src, extensions=["tables", "fenced_code", "sane_lists"])
    for i, m in enumerate(maths):
        out = out.replace(f"@@MATH{i}@@", html.escape(m, quote=False))
    def head(m):
        lvl, body = m.group(1), m.group(2)
        sid = "s-" + (slug(body) or str(len(toc)))
        base, n = sid, 2
        while any(t[1] == sid for t in toc):
            sid = f"{base}-{n}"; n += 1
        toc.append((int(lvl), sid, re.sub(r"<[^>]+>", "", body)))
        return f'<h{lvl} id="{sid}">{body}</h{lvl}>'
    return re.sub(r"<h([1-4])>(.*?)</h\1>", head, out)


def clean_html(h):
    h = re.sub(r"<style.*?</style>", "", h, flags=re.S)
    h = h.replace('border="1" ', "")
    return f'<div class="o-html">{h}</div>'


def render_outputs(outs, nb_id, counter):
    parts = []
    for o in outs:
        t = o["output_type"]
        if t == "stream":
            if o.get("name") == "stderr":
                continue            # library warnings are not part of the analysis
            parts.append(f'<pre class="o-text">{html.escape(ANSI.sub("", text(o["text"])))}</pre>')
        elif t in ("execute_result", "display_data"):
            d = o.get("data", {})
            if "image/png" in d:
                counter[0] += 1
                name = f"{nb_id}_{counter[0]:02d}.png"
                (IMG / name).write_bytes(base64.b64decode(text(d["image/png"])))
                parts.append(f'<figure class="o-img"><img src="img/{name}" loading="lazy" alt="Figure {counter[0]} of notebook {nb_id}"></figure>')
            elif "text/html" in d:
                parts.append(clean_html(text(d["text/html"])))
            elif "text/plain" in d:
                parts.append(f'<pre class="o-text">{html.escape(text(d["text/plain"]))}</pre>')
        elif t == "error":
            parts.append(f'<pre class="o-text o-err">{html.escape(ANSI.sub("", chr(10).join(o.get("traceback", []))))}</pre>')
    return "".join(parts)


def page(nb_id, title, toc, body, prev, nxt, stats):
    toc_html = "".join(f'<a href="#{sid}" class="l{lvl}">{html.escape(t)}</a>' for lvl, sid, t in toc if lvl <= 3)
    stage_href = STAGE[nb_id][0]
    pager = (f'<a href="{prev[0]}.html"><small>← Previous notebook</small>{prev[0]} · {html.escape(prev[1])}</a>' if prev else "<span></span>") + \
            (f'<a class="next" href="{nxt[0]}.html"><small>Next notebook →</small>{nxt[0]} · {html.escape(nxt[1])}</a>' if nxt else "<span></span>")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Notebook {nb_id} · {html.escape(title)}</title>
<link rel="stylesheet" href="../assets/vendor/fonts/fonts.css">
<link rel="stylesheet" href="../assets/vendor/katex/katex.min.css">
<link rel="stylesheet" href="../assets/css/site.css?v=1794044526">
<link rel="stylesheet" href="../assets/css/notebook.css?v=1794044526">
</head>
<body class="nb-page">
<div id="nav"></div>
<header class="page-hero">
  <div class="wrap">
    <div class="crumbs"><a href="../index.html">Home</a> / <a href="../notebooks.html">Notebooks</a> / {nb_id}</div>
    <div class="eyebrow gt" style="margin-top:14px">Jupyter notebook {nb_id}</div>
    <h1>{html.escape(title)}</h1>
    <div class="meta">
      <span class="pill">{stats['md']} explanation cells</span><span class="pill">{stats['code']} code cells</span><span class="pill">{stats['img']} figures</span>
      <span class="nb-tools">
        <button class="nb-btn" id="toggle-code" aria-pressed="true">Hide code</button>
        <a class="nb-link" href="../{stage_href}">View the stage page →</a>
      </span>
    </div>
  </div>
</header>
<div class="wrap layout">
  <aside class="toc nb-toc"><b>Contents</b>{toc_html}</aside>
  <main class="content nb">
{body}
    <div class="pager">{pager}</div>
  </main>
</div>
<div id="footer"></div>
<script>window.SITE_ROOT = "../";</script>
<script src="../assets/js/site.js?v=1794044526"></script>
<script src="../assets/vendor/katex/katex.min.js"></script>
<script src="../assets/vendor/katex/contrib/auto-render.min.js"></script>
<script src="../assets/js/notebook.js?v=1794044526"></script>
</body>
</html>"""


def build():
    files = sorted(SRC.glob("[0-9][0-9]_*.ipynb"))
    meta = []
    for f in files:
        nb = json.loads(f.read_text(encoding="utf-8"))
        cells = [c for c in nb["cells"] if text(c["source"]).strip()]
        first = text(cells[0]["source"]) if cells else f.stem
        m = re.search(r"^#\s+(.+)$", first, re.M)
        title = re.sub(r"^\d+[a-z]?\s*[·.\-–—]\s*", "", m.group(1)).strip() if m else f.stem
        meta.append((f.stem[:2], title, f, cells))

    index_cards = []
    for k, (nb_id, title, f, cells) in enumerate(meta):
        toc, body, counter, n_code = [], [], [0], 0
        for c in cells:
            src = text(c["source"])
            if c["cell_type"] == "markdown":
                body.append(f'<div class="cell md">{render_md(src, toc)}</div>')
            elif c["cell_type"] == "code":
                n_code += 1
                ex = c.get("execution_count") or " "
                code = highlight(src, PythonLexer(), FMT)
                outs = render_outputs(c.get("outputs", []), nb_id, counter)
                body.append(f'<div class="cell code"><div class="in"><span class="prompt">In [{ex}]</span>'
                            f'<pre class="src">{code}</pre></div>'
                            + (f'<div class="out">{outs}</div>' if outs else "") + "</div>")
        stats = {"md": sum(c["cell_type"] == "markdown" for c in cells), "code": n_code, "img": counter[0]}
        prev = meta[k - 1][:2] if k > 0 else None
        nxt = meta[k + 1][:2] if k + 1 < len(meta) else None
        (OUT / f"{nb_id}.html").write_text(page(nb_id, title, toc, "\n".join(body), prev, nxt, stats), encoding="utf-8")
        index_cards.append((nb_id, title, {**stats, "file": f.name}))
        print(f"{nb_id}  {title:45s} cells={len(cells):3d} code={n_code:3d} figures={counter[0]}")

    # pygments colours for the code blocks
    css = HtmlFormatter(style="github-dark").get_style_defs(".src")
    (ROOT / "docs" / "assets" / "css" / "pygments.css").write_text(css, encoding="utf-8")
    json.dump([{"id": i, "title": t, "desc": STAGE[i][1], "stage": STAGE[i][0], **s} for i, t, s in index_cards],
              open(ROOT / "docs" / "assets" / "data" / "notebooks.json", "w"), indent=1)


if __name__ == "__main__":
    build()
