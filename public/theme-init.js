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
  if (document.documentElement.dataset.page === "home") {
    const image = document.createElement("link");
    image.rel = "preload";
    image.as = "image";
    image.href =
      theme === "dark" ? "/hero-garden-dark.webp" : "/hero-garden.webp";
    document.head.append(image);
  }
})();
