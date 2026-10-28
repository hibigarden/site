import { drawDoodles } from "./doodles.js";

drawDoodles();

// Pieces below the fold settle onto the page as they scroll in, like scraps landing in the film, and pen
// doodles and margin notes draw themselves in (on screen too). With reduced motion everything is simply there.
if (matchMedia("(prefers-reduced-motion: no-preference)").matches) {
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
  for (const piece of document.querySelectorAll(".settle, .doodle, .note")) {
    if (piece.matches(".settle") && piece.getBoundingClientRect().top <= innerHeight) continue;
    piece.classList.add("will-land");
    observer.observe(piece);
  }
}
