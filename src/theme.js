const root = document.documentElement;
const toggle = document.querySelector(".theme-toggle");
const system = matchMedia("(prefers-color-scheme: dark)");
let chosen = false;
try {
  chosen = ["light", "dark"].includes(localStorage.getItem("hibi-site-theme"));
} catch {
  // Theme switching still works for this visit.
}

function apply(theme) {
  root.dataset.theme = theme;
  const label = `switch to ${theme === "dark" ? "light" : "dark"} mode`;
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
  document.querySelector('meta[name="theme-color"]').content =
    theme === "dark" ? "#181818" : "#ffffff";
}

apply(root.dataset.theme);
toggle.hidden = false;
toggle.addEventListener("click", () => {
  const theme = root.dataset.theme === "dark" ? "light" : "dark";
  chosen = true;
  apply(theme);
  try {
    localStorage.setItem("hibi-site-theme", theme);
  } catch {
    // Keep the selected theme even when it cannot be saved.
  }
});
system.addEventListener("change", (event) => {
  if (!chosen) apply(event.matches ? "dark" : "light");
});
