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
  // each page's own background (the landing's tan paper, the plain pages' white)
  document.querySelector('meta[name="theme-color"]').content =
    getComputedStyle(root).getPropertyValue("--page").trim();
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

// "still the garden": one switch that stops every looping animation, remembered across visits.
const motionToggle = document.querySelector(".motion-toggle");
if (motionToggle) {
  const setStill = (still) => {
    if (still) root.dataset.motion = "still";
    else delete root.dataset.motion;
    motionToggle.setAttribute("aria-pressed", String(still));
  };
  setStill(root.dataset.motion === "still");
  motionToggle.hidden = false;
  motionToggle.addEventListener("click", () => {
    const still = root.dataset.motion !== "still";
    setStill(still);
    try {
      localStorage.setItem("hibi-site-motion", still ? "still" : "moving");
    } catch {
      // Keep the choice for this visit.
    }
  });
}
