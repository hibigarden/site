const root = document.documentElement;
const toggle = document.querySelector(".theme-toggle");
const system = matchMedia("(prefers-color-scheme: dark)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let selectedTheme = root.dataset.theme;
let transition;
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

function changeTheme(theme) {
  selectedTheme = theme;
  transition?.skipTransition();
  if (reducedMotion.matches || !document.startViewTransition) {
    apply(theme);
    return;
  }
  // Read the latest choice if another click arrives before the snapshot is ready.
  transition = document.startViewTransition(() => apply(selectedTheme));
  // Cancelling an in-flight fade rejects ready, but still applies the theme.
  transition.ready.catch(() => {});
  transition.finished.catch(() => apply(selectedTheme));
}

apply(root.dataset.theme);
toggle.hidden = false;
toggle.addEventListener("click", () => {
  const theme = selectedTheme === "dark" ? "light" : "dark";
  chosen = true;
  changeTheme(theme);
  try {
    localStorage.setItem("hibi-site-theme", theme);
  } catch {
    // Keep the selected theme even when it cannot be saved.
  }
});
system.addEventListener("change", (event) => {
  if (!chosen) changeTheme(event.matches ? "dark" : "light");
});
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) transition?.skipTransition();
});

// Warm the other garden after page load so its first theme switch can crossfade.
if (root.dataset.page === "home") {
  window.addEventListener("load", () => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    image.src =
      root.dataset.theme === "dark"
        ? "/hero-garden.webp"
        : "/hero-garden-dark.webp";
  });
}
