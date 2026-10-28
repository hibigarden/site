// The landing page's addon showcase. The build renders it from the snapshot so
// it works without JavaScript; the browser then refreshes the community part.
import { addonDay, addonPageLink, sortAddons } from "./addon-directory.js";

const LIMIT = 6;
export const SHOWCASE_SORTS = [
  ["released", "recently released"],
  ["updated", "recently updated"],
];
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/** The newest dated addons for one order; undated addons never appear. */
export const showcased = (addons, order) =>
  sortAddons(addons.filter((addon) => addonDay(addon[order])), order).slice(0, LIMIT);

export function renderCards(addons, order) {
  return showcased(addons, order)
    .map((addon) => {
      const kind = `${addon.origin === "community" ? "community " : ""}${addon.kind === "theme" ? "theme" : "extension"}`;
      const authors = addon.authors.map((author) => author.displayName).join(", ");
      return `<li><a class="addon-card" href="${escape(addonPageLink(addon.id))}"><span class="addon-card-hold" aria-hidden="true"></span><span class="addon-card-heading"><span>${escape(addon.name)}</span></span><span class="addon-card-kind">${kind}</span><span class="addon-description">${escape(addon.description)}</span><span class="addon-card-footer"><span>${escape(authors)}</span><span>${order} ${addonDay(addon[order])}</span></span></a></li>`;
    })
    .join("");
}

/** The sort switch and both lists. Without dated addons, only the catalog link remains. */
export function renderShowcase(addons) {
  if (!SHOWCASE_SORTS.some(([order]) => showcased(addons, order).length)) return "";
  const radios = SHOWCASE_SORTS.map(
    ([order, label], index) =>
      `<label><input type="radio" name="showcase-sort" value="${order}"${index ? "" : " checked"} />${label}</label>`,
  ).join("");
  const lists = SHOWCASE_SORTS.map(
    ([order, label]) =>
      `<ol class="addon-grid showcase-grid" data-sort="${order}" aria-label="${label} addons">${renderCards(addons, order)}</ol>`,
  ).join("");
  return `<fieldset class="showcase-sort" aria-label="sort addons">${radios}</fieldset>${lists}`;
}

/** Built-ins that can still reach the lists, whatever the community adds. */
export const showcaseCandidates = (builtins) =>
  [...new Map(SHOWCASE_SORTS.flatMap(([order]) => showcased(builtins, order)).map((addon) => [addon.id, addon])).values()].map(
    ({ id, name, description, kind, authors, origin, released, updated }) => ({
      id, name, description, kind, origin, released, updated,
      authors: authors.map(({ displayName }) => ({ displayName })),
    }),
  );

const data = typeof document === "object" && document.getElementById("addon-showcase-data");
if (data) {
  const builtins = JSON.parse(data.textContent);
  const section = data.closest("section");
  // Ask for fresh community data only when the showcase comes near the screen.
  const observer = new IntersectionObserver(async ([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    try {
      const response = await fetch("/addons/community.json");
      if (!response.ok) return;
      const { addons } = await response.json();
      for (const list of section.querySelectorAll(".showcase-grid"))
        if (!list.contains(document.activeElement))
          list.innerHTML = renderCards([...builtins, ...addons], list.dataset.sort);
    } catch {
      /* The built snapshot stays in place. */
    }
  }, { rootMargin: "600px 0px" });
  observer.observe(section);
}
