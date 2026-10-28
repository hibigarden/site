// Pen doodles over the scrapbook, drawn by hand as svg paths. Markup asks for one with
// <span class="doodle" data-doodle="arrow" aria-hidden="true"></span>; the svg takes the pen colour
// (currentColor). Paths are pathLength 1 so css can draw them in stroke by stroke.
const DOODLES = {
  arrow: [
    "0 0 140 90",
    "M8 74C34 84 76 78 100 52C110 41 116 30 120 16",
    "M120 15C114 17 109 20 103 24",
    "M120 15C122 21 124 27 127 33",
  ],
  "arrow-down": [
    "0 0 90 140",
    "M20 6C50 10 70 30 56 50C44 66 22 56 30 42C38 28 60 40 58 66C56 90 46 108 44 128",
    "M44 129C40 122 35 117 30 112",
    "M44 129C48 121 53 116 58 111",
  ],
  circle: [
    "0 0 220 100",
    "M164 16C126 4 52 6 22 30C2 48 18 82 92 88C160 94 210 72 204 44C198 20 150 8 104 12",
  ],
  underline: ["0 0 220 24", "M4 14C30 8 52 18 80 12C108 6 130 18 158 12C180 8 200 14 216 10"],
  "underline-double": [
    "0 0 220 26",
    "M6 9C60 5 140 7 214 4",
    "M14 20C70 16 150 18 206 15",
  ],
  star: [
    "0 0 64 64",
    "M32 5L39 25L59 25L43 37L50 58L32 45L14 58L21 37L5 25L26 24L31 8",
  ],
  sparkle: [
    "0 0 44 44",
    "M22 3C23 15 28 20 41 22C28 24 23 29 22 41C21 29 16 24 3 22C16 20 21 15 22 3",
  ],
  heart: [
    "0 0 64 58",
    "M32 52C14 40 3 28 7 16C11 5 25 3 31 15C36 4 51 3 56 13C62 26 50 40 33 51",
  ],
  swirl: [
    "0 0 84 84",
    "M44 42C46 38 52 40 50 46C47 53 37 51 36 43C35 32 47 26 56 31C67 38 64 55 51 61C35 68 19 57 19 42C19 25 34 14 52 16C66 18 76 28 78 40",
  ],
  butterfly: [
    "0 0 96 76",
    "M48 22C47 34 47 46 48 60",
    "M47 30C36 12 14 6 8 16C3 26 18 36 46 38",
    "M46 40C30 42 18 52 22 62C26 70 40 62 47 46",
    "M49 30C60 12 82 6 88 16C93 26 78 36 50 38",
    "M50 40C66 42 78 52 74 62C70 70 56 62 49 46",
    "M47 23C44 15 41 10 37 7",
    "M49 23C52 15 55 10 59 7",
  ],
  lavender: [
    "0 0 40 130",
    "M22 128C20 100 21 70 20 46",
    "M21 98C14 90 10 82 9 72",
    "M21 84C27 78 30 72 31 64",
    "M18 46C12 44 12 38 18 37C22 38 22 43 18 46",
    "M23 40C29 38 29 32 23 31C19 32 19 37 23 40",
    "M18 33C12 31 12 25 18 24C22 25 22 30 18 33",
    "M23 27C29 25 29 19 23 18C19 19 19 24 23 27",
    "M19 20C14 18 14 13 19 12C23 13 23 18 19 20",
    "M22 14C26 12 26 7 22 5C19 7 19 12 22 14",
  ],
  check: ["0 0 50 40", "M4 22C10 26 14 32 18 36C26 22 36 10 47 4"],
  squiggle: [
    "0 0 160 30",
    "M4 18C14 4 24 4 22 16C20 28 34 28 40 14C46 2 58 4 56 16C54 28 68 28 74 14C80 2 92 4 90 16C88 28 102 28 108 14C114 2 126 4 124 16C122 28 136 28 142 14C146 6 152 6 156 10",
  ],
  asterisk: ["0 0 36 36", "M18 4C18 14 18 22 19 32", "M6 11C14 15 22 21 30 26", "M30 10C22 15 14 21 6 26"],
  trail: [
    "0 0 220 120",
    "M4 100C40 96 60 70 70 50C80 30 110 20 120 40C128 56 104 66 98 52C92 38 120 22 150 26C180 30 200 20 214 8",
  ],
};

export function drawDoodles(root = document) {
  for (const host of root.querySelectorAll(".doodle[data-doodle]:not(:has(svg))")) {
    const [box, ...paths] = DOODLES[host.dataset.doodle] ?? [];
    if (!box) continue;
    const [, , w, h] = box.split(" ");
    host.innerHTML = `<svg viewBox="${box}" width="${w}" height="${h}" focusable="false">${paths
      .map((d, i) => `<path d="${d}" pathLength="1" style="--i:${i}"/>`)
      .join("")}</svg>`;
  }
}
