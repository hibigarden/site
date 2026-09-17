const menu = document.querySelector(".menu-toggle");
const links = document.querySelector(".nav-links");

function closeMenu() {
  menu.setAttribute("aria-expanded", "false");
  links.dataset.open = "false";
}

menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  links.dataset.open = String(open);
});
links.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
    closeMenu();
    menu.focus();
  }
});
