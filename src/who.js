// "built around writing": the tabs for who hibi is for are radio buttons, so they switch without javascript. here
// a #for-… link opens its tab, the address follows the open tab, and a tab's window starts loading as the reader
// reaches for it (only the open tab's window loads with the page).
const who = document.querySelector(".who");
if (who) {
  const radios = [...who.querySelectorAll('input[name="who"]')];
  // the #for-… ids sit on the tabs themselves, so the browser already scrolls to them
  const open = () => {
    const radio = radios.find((r) => location.hash === `#${r.id}`);
    if (radio) radio.checked = true;
  };
  open();
  addEventListener("hashchange", open);
  who.addEventListener("change", (event) => history.replaceState(null, "", `#${event.target.id}`));
  const warm = (radio) => {
    const theme = document.documentElement.dataset.theme === "dark" ? "night" : "day";
    for (const img of who.querySelectorAll(`.window[data-who="${radio.value}"] .theme-${theme} img`)) img.loading = "eager";
  };
  for (const radio of radios) {
    radio.closest("label").addEventListener("pointerenter", () => warm(radio));
    radio.addEventListener("focus", () => warm(radio));
  }
}
