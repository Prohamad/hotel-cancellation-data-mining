// Behaviour for the rendered notebook pages.
document.addEventListener("DOMContentLoaded", () => {
  // LaTeX formulas in the Markdown cells
  if (window.renderMathInElement) {
    renderMathInElement(document.querySelector(".nb"), {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
      throwOnError: false,
    });
  }

  // show / hide all code (remembered per visitor)
  const btn = document.getElementById("toggle-code");
  const set = hide => {
    document.body.classList.toggle("hide-code", hide);
    btn.textContent = hide ? "Show code" : "Hide code";
    btn.setAttribute("aria-pressed", String(!hide));
  };
  let hidden = false;
  try { hidden = localStorage.getItem("nb-hide-code") === "1"; } catch (e) {}
  set(hidden);
  btn.addEventListener("click", () => {
    hidden = !hidden; set(hidden);
    try { localStorage.setItem("nb-hide-code", hidden ? "1" : "0"); } catch (e) {}
  });

  // long outputs get a "show all" button
  document.querySelectorAll(".nb .out").forEach(out => {
    if (out.scrollHeight <= out.clientHeight + 4) return;
    out.classList.add("long");
    const more = document.createElement("button");
    more.className = "more"; more.textContent = "Show full output";
    more.onclick = () => { const open = out.classList.toggle("open"); more.textContent = open ? "Collapse output" : "Show full output"; };
    out.after(more);
  });
});
