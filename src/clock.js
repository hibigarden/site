// One stop-motion clock for the whole site: everything time-based steps at 12 fps, like animation shot on
// twos. Subscribers get the held frame's time (ms, a multiple of 1000/12) and return false when they are
// done; the loop only runs while someone is subscribed. Motion is off when the reader prefers reduced
// motion or has stilled the garden (the header toggle sets <html data-motion="still">).
export const FRAME = 1000 / 12;

const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const watchers = new Set();
const subscribers = new Set();
let raf = 0;
let held = -1;

export const still = () =>
  reduced.matches || document.documentElement.dataset.motion === "still";

function loop(now) {
  raf = 0;
  const frame = Math.floor(now / FRAME);
  if (frame !== held) {
    held = frame;
    const time = frame * FRAME;
    for (const fn of [...subscribers]) if (fn(time) === false) subscribers.delete(fn);
  }
  if (subscribers.size && !document.hidden) raf = requestAnimationFrame(loop);
}

/** run `fn(time)` on every held frame until it returns false; returns an unsubscribe */
export function tick(fn) {
  subscribers.add(fn);
  if (!document.hidden) raf ||= requestAnimationFrame(loop);
  return () => subscribers.delete(fn);
}

/** call `fn(still())` now and whenever motion is turned on or off */
export function onMotion(fn) {
  watchers.add(fn);
  fn(still());
  return () => watchers.delete(fn);
}

function notify() {
  for (const fn of watchers) fn(still());
}
reduced.addEventListener("change", notify);
new MutationObserver(notify).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-motion"],
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && subscribers.size) raf ||= requestAnimationFrame(loop);
});
