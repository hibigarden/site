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
  // the header's toggles need javascript; marking it here, before the body is parsed, lets css draw them from the
  // first paint instead of moving the header when the modules reveal them
  document.documentElement.classList.add("js");
  // ?drafts shows sections still waiting on the owner (e.g. quotes not yet cleared with their authors)
  if (/[?&]drafts\b/.test(location.search)) document.documentElement.dataset.drafts = "";
  try {
    if (localStorage.getItem("hibi-site-motion") === "still") {
      document.documentElement.dataset.motion = "still";
    }
  } catch {
    // Motion stays on when storage is unavailable.
  }
})();
