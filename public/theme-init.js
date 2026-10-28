(() => {
  let theme;
  try {
    theme = localStorage.getItem("hibi-site-theme");
  } catch {
    // Follow the system when browser storage is unavailable.
  }
  if (theme !== "light" && theme !== "dark") {
    theme = matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  document.documentElement.dataset.theme = theme;
})();
