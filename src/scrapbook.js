// Pieces below the fold settle onto the page as they scroll in, like scraps landing in the film.
// Anything already on screen, or every piece when motion is reduced, is simply there.
if (matchMedia("(prefers-reduced-motion: no-preference)").matches) {
  const pieces = [...document.querySelectorAll(".settle")].filter(
    (piece) => piece.getBoundingClientRect().top > innerHeight,
  );
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-landed");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -6% 0px" },
  );
  for (const piece of pieces) {
    piece.classList.add("will-settle");
    observer.observe(piece);
  }
}
