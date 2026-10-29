import { onMotion, still, tick } from "./clock.js";

// "built around writing": the tabs for who hibi is for are radio buttons, so they switch without javascript. here
// a #for-… link opens its tab, the address follows the open tab, and a tab's window and garden start loading as the
// reader reaches for them (only the open tab's load with the page). A switch closes the open window (it fades out,
// shrinking a touch) while the new tab's garden comes in under it, then opens the new window. While the reader
// watches, the tabs also take turns by themselves (the owner's): a bar fills along the open tab's lower edge for 3 s
// and the next tab opens, until the reader takes over (a click, a key, a #for-… link). These run at the display's own
// frame rate (the owner's), as css transitions and one css animation (landing.css); stilled, the tabs simply swap and
// keep still. The menu bar's clock shows the reader's time, ticking on the site's clock while it is on screen.
const who = document.querySelector(".who");
if (who) {
  const radios = [...who.querySelectorAll('input[name="who"]')];
  const byWho = (selector) => Object.fromEntries([...who.querySelectorAll(selector)].map((el) => [el.dataset.who, el]));
  const windows = byWho(".window");
  const scenes = byWho(".scene");
  const tabs = who.querySelector(".who-tabs");
  const panel = who.querySelector(".window-panel");
  const theme = () => (document.documentElement.dataset.theme === "dark" ? "night" : "day");
  const FADE = 340; // ms, the fades' length in landing.css
  const STATES = ["is-leaving", "is-closed", "is-entering", "is-new"];
  let shown = radios.find((r) => r.checked)?.value;
  let run = 0; // the switch in progress; an older one stops at its next step

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  /** resolves once the element's picture in this theme can be drawn (or after half a second) */
  const ready = (el) => {
    const img = el.querySelector(`.theme-${theme()} img`);
    return Promise.race([img?.decode().catch(() => {}), wait(500)]);
  };
  const halt = () => {
    run++;
    for (const el of [...Object.values(windows), ...Object.values(scenes)]) el.classList.remove(...STATES);
  };
  /** fades the window in once its capture can be drawn */
  const open = async (el, id = run) => {
    el.classList.add("is-closed");
    await ready(el);
    if (id !== run) return;
    void el.offsetWidth; // the closed state is drawn first, so the change transitions
    el.classList.remove("is-closed");
  };
  const show = async (next) => {
    const prev = shown;
    halt();
    shown = next;
    if (still() || !prev || prev === next) return;
    const id = run;
    const [oldWindow, newWindow, oldScene, newScene] = [windows[prev], windows[next], scenes[prev], scenes[next]];
    oldWindow.classList.add("is-leaving");
    oldScene.classList.add("is-leaving");
    newWindow.classList.add("is-closed");
    newScene.classList.add("is-new", "is-entering");
    // the old window closes as the new garden comes in under it; then the new window opens
    await ready(newScene);
    if (id !== run) return;
    void newScene.offsetWidth;
    oldWindow.classList.add("is-closed");
    newScene.classList.remove("is-entering");
    await wait(FADE);
    if (id !== run) return;
    oldWindow.classList.remove("is-leaving", "is-closed");
    oldScene.classList.remove("is-leaving");
    newScene.classList.remove("is-new");
    open(newWindow, id);
  };

  // taking turns (landing.css draws and times the bar): it holds while the pointer or focus is on the tabs or the
  // window (css), the section is off screen or the page hidden (here), and ends for good when the reader takes over.
  // It never moves focus and is never announced.
  let auto = true;
  let away = true;
  const next = () => radios[(radios.findIndex((r) => r.checked) + 1) % radios.length];
  const turn = () => {
    who.classList.toggle("is-auto", auto && !still());
    who.classList.toggle("is-paused", away || document.hidden);
  };
  const takeOver = () => {
    auto = false;
    turn();
  };
  // the next tab loads as its turn begins on screen, so a switch never shows a blank window or garden
  tabs.addEventListener("animationstart", (event) => event.animationName === "tab-turn" && !away && warm(next()));
  tabs.addEventListener("animationend", (event) => {
    if (event.animationName !== "tab-turn" || !who.classList.contains("is-auto")) return;
    const radio = next();
    radio.checked = true;
    show(radio.value);
  });
  who.addEventListener("keydown", takeOver);
  tabs.addEventListener("click", takeOver);
  document.addEventListener("visibilitychange", turn);
  new IntersectionObserver(
    ([entry]) => {
      away = !entry.isIntersecting;
      if (!away && auto) warm(next());
      turn();
    },
    { threshold: 0.4 },
  ).observe(panel);

  // the #for-… ids sit on the tabs themselves, so the browser already scrolls to them
  const fromHash = () => {
    const radio = radios.find((r) => location.hash === `#${r.id}`);
    if (!radio) return;
    takeOver();
    if (!radio.checked) {
      radio.checked = true;
      show(radio.value);
    }
  };
  fromHash();
  addEventListener("hashchange", fromHash);
  who.addEventListener("change", (event) => {
    if (event.target.name !== "who") return;
    takeOver();
    history.replaceState(null, "", `#${event.target.id}`);
    show(event.target.value);
  });
  function warm(radio) {
    for (const img of who.querySelectorAll(`[data-who="${radio.value}"] .theme-${theme()} img`)) img.loading = "eager";
  }
  for (const radio of radios) {
    radio.closest("label").addEventListener("pointerenter", () => warm(radio));
    radio.addEventListener("focus", () => warm(radio));
  }

  // the first window opens as the panel scrolls in
  if (shown && !still() && panel.getBoundingClientRect().top > innerHeight) {
    windows[shown].classList.add("is-closed");
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        seen.disconnect();
        if (still()) windows[shown].classList.remove("is-closed");
        else open(windows[shown]);
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
