import { onMotion, still, tick } from "./clock.js";

// "built around writing": the tabs for who hibi is for are radio buttons, so they switch without javascript. here
// a #for-… link opens its tab, the address follows the open tab, and a tab's window starts loading as the reader
// reaches for it (only the open tab's window loads with the page). A switch closes the open window (it fades out,
// shrinking a touch) and opens the new one, on the site's 12 fps clock; stilled, they simply swap. While the reader
// watches, the tabs also take turns by themselves (the owner's): every 3 s the next one opens, a bar filling along the
// open tab's lower edge, until the reader takes over (a click, a key, a #for-… link). The menu bar's clock shows the
// reader's time, ticking while it is on screen.
const who = document.querySelector(".who");
if (who) {
  const radios = [...who.querySelectorAll('input[name="who"]')];
  const windows = Object.fromEntries([...who.querySelectorAll(".window")].map((w) => [w.dataset.who, w]));
  const theme = () => (document.documentElement.dataset.theme === "dark" ? "night" : "day");
  const STEPS = 4; // held frames each way: a third of a second
  let shown = windows[radios.find((r) => r.checked)?.value];
  let stop = null;

  const set = (el, u) => {
    el.style.opacity = u.toFixed(3);
    el.style.transform = `scale(${(0.98 + 0.02 * u).toFixed(4)})`;
  };
  const clear = (el) => {
    el.style.opacity = el.style.transform = "";
    el.classList.remove("is-leaving");
  };
  const halt = () => {
    stop?.();
    stop = null;
    for (const w of Object.values(windows)) clear(w);
  };
  /** `frame(k)` on each of the next STEPS held frames, then `done` */
  const steps = (frame, done) => {
    let k = 0;
    stop = tick(() => {
      frame(++k);
      if (k < STEPS) return true;
      stop = null;
      done?.();
      return false;
    });
  };
  /** fades the window in once its capture is there (or after half a second) */
  const open = (el) => {
    set(el, 0);
    const img = el.querySelector(`.theme-${theme()} img`);
    let waited = 0;
    stop = tick(() => {
      if (!(img?.complete && img.naturalWidth) && waited++ < 6) return true;
      stop = null;
      steps((k) => set(el, k / STEPS), () => clear(el));
      return false;
    });
  };
  const show = (next) => {
    const prev = shown;
    halt();
    shown = next;
    if (still() || !prev || prev === next) return;
    prev.classList.add("is-leaving");
    set(next, 0);
    steps(
      (k) => set(prev, 1 - k / STEPS),
      () => {
        clear(prev);
        open(next);
      },
    );
  };

  // taking turns: CYCLE held frames a tab (3 s), paused while the pointer or focus is on the tabs or the window, the
  // section is off screen, or the page is hidden (the clock then stops); ended for good when the reader takes over.
  // It never moves focus and is never announced.
  const CYCLE = 36;
  const tabs = who.querySelector(".who-tabs");
  const panel = who.querySelector(".window-panel");
  let auto = true;
  let held = 0;
  let turns = null;
  const pause = { hover: new Set(), focus: false, away: true };
  const bar = (p) => {
    for (const radio of radios) radio.closest("label").style.removeProperty("--p");
    if (p !== null) radios.find((r) => r.checked)?.closest("label").style.setProperty("--p", p.toFixed(3));
  };
  const next = () => radios[(radios.findIndex((r) => r.checked) + 1) % radios.length];
  const turn = () => {
    const run = auto && !still() && !pause.away && !pause.focus && !pause.hover.size;
    if (run) {
      turns ??= tick(() => {
        if (++held === 1) warm(next());
        if (held < CYCLE) return bar(held / CYCLE), true;
        held = 0;
        const radio = next();
        radio.checked = true;
        show(windows[radio.value]);
        bar(0);
        return true;
      });
    } else {
      turns?.();
      turns = null;
    }
    if (!auto || still()) bar(null);
  };
  const takeOver = () => {
    auto = false;
    turn();
  };
  for (const el of [tabs, panel]) {
    el.addEventListener("pointerenter", () => (pause.hover.add(el), turn()));
    el.addEventListener("pointerleave", () => (pause.hover.delete(el), turn()));
  }
  who.addEventListener("focusin", () => ((pause.focus = true), turn()));
  who.addEventListener("focusout", (event) => ((pause.focus = who.contains(event.relatedTarget)), turn()));
  who.addEventListener("keydown", takeOver);
  tabs.addEventListener("click", takeOver);
  new IntersectionObserver(([entry]) => ((pause.away = !entry.isIntersecting), turn()), { threshold: 0.4 }).observe(panel);

  // the #for-… ids sit on the tabs themselves, so the browser already scrolls to them
  const fromHash = () => {
    const radio = radios.find((r) => location.hash === `#${r.id}`);
    if (!radio) return;
    takeOver();
    if (!radio.checked) {
      radio.checked = true;
      show(windows[radio.value]);
    }
  };
  fromHash();
  addEventListener("hashchange", fromHash);
  who.addEventListener("change", (event) => {
    if (event.target.name !== "who") return;
    takeOver();
    history.replaceState(null, "", `#${event.target.id}`);
    show(windows[event.target.value]);
  });
  function warm(radio) {
    for (const img of who.querySelectorAll(`.window[data-who="${radio.value}"] .theme-${theme()} img`)) img.loading = "eager";
  }
  for (const radio of radios) {
    radio.closest("label").addEventListener("pointerenter", () => warm(radio));
    radio.addEventListener("focus", () => warm(radio));
  }

  // the first window opens as the panel scrolls in
  if (shown && !still() && panel.getBoundingClientRect().top > innerHeight) {
    set(shown, 0);
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        seen.disconnect();
        if (still()) clear(shown);
        else open(shown);
      },
      { threshold: 0.3 },
    );
    seen.observe(panel);
  }

  // the menu bar's clock, in the reader's own way of writing it (Thu Oct 29  7:10 AM in english)
  const clock = who.querySelector("[data-clock]");
  const day = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  let minute = -1;
  const now = () => {
    const d = new Date();
    if (d.getMinutes() === minute) return;
    minute = d.getMinutes();
    clock.textContent = `${day.format(d).replace(/,/g, "")}  ${time.format(d)}`;
  };
  now();
  let visible = false;
  let ticking = null;
  const keep = () => {
    if (visible && !still()) ticking ??= tick(() => (now(), true));
    else {
      ticking?.();
      ticking = null;
    }
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    keep();
  }).observe(clock);
  onMotion((isStill) => {
    if (isStill) halt();
    keep();
    turn();
  });
}
