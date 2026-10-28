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

/** The six newest for one order; undated addons fill the rest in catalog order. */
export const showcased = (addons, order) => sortAddons(addons, order).slice(0, LIMIT);

function renderCards(addons, order) {
  return showcased(addons, order)
    .map((addon) => {
      const kind = `${addon.origin === "community" ? "community " : ""}${addon.kind === "theme" ? "theme" : "extension"}`;
      const authors = addon.authors.map((author) => author.displayName).join(", ");
      const day = addonDay(addon[order]);
      return `<li><a class="addon-card" href="${escape(addonPageLink(addon.id))}"><span class="addon-card-hold" aria-hidden="true"></span><span class="addon-card-heading"><span>${escape(addon.name)}</span></span><span class="addon-card-kind">${kind}</span><span class="addon-description">${escape(addon.description)}</span><span class="addon-card-footer"><span>${escape(authors)}</span>${day ? `<span>${order} ${day}</span>` : ""}</span></a></li>`;
    })
    .join("");
}

/**
 * The sort switch and one list per order, or a single list in catalog order
 * (no switch) when nothing is dated. Never empty while there are addons.
 */
export function renderShowcase(addons, checked = SHOWCASE_SORTS[0][0]) {
  if (!SHOWCASE_SORTS.some(([order]) => addons.some((addon) => addonDay(addon[order]))))
    return `<ol class="addon-grid showcase-grid" aria-label="addons">${renderCards(addons)}</ol>`;
  const radios = SHOWCASE_SORTS.map(
    ([order, label]) =>
      `<label><input type="radio" name="showcase-sort" value="${order}"${order === checked ? " checked" : ""} />${label}</label>`,
  ).join("");
  const lists = SHOWCASE_SORTS.map(
    ([order, label]) =>
      `<ol class="addon-grid showcase-grid" data-sort="${order}" aria-label="${label} addons">${renderCards(addons, order)}</ol>`,
  ).join("");
  return `<fieldset class="showcase-sort" aria-label="sort addons">${radios}</fieldset>${lists}`;
}

/** Built-ins that can still reach the lists, whatever the community adds, in catalog order. */
export function showcaseCandidates(builtins) {
  const ids = new Set(SHOWCASE_SORTS.flatMap(([order]) => showcased(builtins, order).map((addon) => addon.id)));
  return builtins
    .filter((addon) => ids.has(addon.id))
    .map(({ id, name, description, kind, authors, origin, released, updated }) => ({
      id, name, description, kind, origin, released, updated,
      authors: authors.map(({ displayName }) => ({ displayName })),
    }));
}

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
      const body = section.querySelector(".showcase-body");
      if (!body.contains(document.activeElement))
        body.innerHTML = renderShowcase([...builtins, ...addons], body.querySelector(":checked")?.value);
    } catch {
      /* The built snapshot stays in place. */
    }
  }, { rootMargin: "600px 0px" });
  observer.observe(section);
}
