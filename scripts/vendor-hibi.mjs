// Copies the hibi source the demo imports, and everything that source imports, into vendor/hibi/src.
// usage: node scripts/vendor-hibi.mjs <hibi checkout> [ref=origin/main]
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const site = fileURLToPath(new URL("../", import.meta.url));
const vendor = join(site, "vendor/hibi/src");
const [checkout, ref = "origin/main"] = process.argv.slice(2);
if (!checkout) throw new Error("usage: node scripts/vendor-hibi.mjs <hibi checkout> [ref]");

const commit = execFileSync("git", ["-C", checkout, "rev-parse", ref], { encoding: "utf8" }).trim();
const snapshot = mkdtempSync(join(tmpdir(), "hibi-src-"));
execFileSync("tar", ["-x", "-C", snapshot], {
  input: execFileSync("git", ["-C", checkout, "archive", commit, "src"], { maxBuffer: 1 << 30 }),
});
const source = join(snapshot, "src");

// The demo plays only the holy panda keyboard; the licences travel with the sounds.
const subsets = [["addons/keybeats/sounds/", (path) => path.startsWith("addons/keybeats/sounds/holypanda/")]];
const always = ["addons/keybeats/LICENSE.keybeats.md", "addons/keybeats/LICENSE.kbsim.md"];

const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", "/index.ts", "/index.tsx", "/index.js"];
const patterns = [
  /\bimport\s+([^'"`;]*?)\s*\bfrom\s*['"]([^'"]+)['"]/g,
  /\bexport\s+([^'"`;]*?)\s*\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*()['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*()['"]([^'"]+)['"]\s*[,)]/g,
  /new\s+URL\(\s*()['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g,
];
const typeOnly = (clause) =>
  /^type\s/.test(clause) ||
  (/^\{[^}]*\}$/.test(clause) &&
    clause
      .slice(1, -1)
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .every((name) => name.startsWith("type ")));

function resolveFile(from, specifier) {
  const base = resolve(dirname(from), specifier.replace(/\?.*$/, ""));
  for (const extension of extensions) {
    const path = base + extension;
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

const files = new Set();
const unresolved = [];
function walk(file) {
  if (files.has(file)) return;
  files.add(file);
  const text = readFileSync(file, "utf8");
  const specifiers = [];
  if (file.endsWith(".css")) {
    for (const [, path] of text.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)) specifiers.push(path);
    for (const [, path] of text.matchAll(/url\(\s*['"]?(\.[^'")]+)['"]?\s*\)/g)) specifiers.push(path);
  } else if (/\.[cm]?[jt]sx?$/.test(file)) {
    for (const pattern of patterns)
      for (const [, clause, path] of text.matchAll(pattern)) if (!typeOnly(clause.trim())) specifiers.push(path);
    for (const [, glob] of text.matchAll(/import\.meta\.glob(?:<[^>]*>)?\(\s*['"]([^'"]+)['"]/g)) {
      if (glob.includes("node_modules")) continue;
      for (const match of globSync(glob, { cwd: dirname(file) })) {
        const path = resolve(dirname(file), match);
        const local = relative(source, path);
        const subset = subsets.find(([prefix]) => local.startsWith(prefix));
        if (!subset || subset[1](local)) walk(path);
      }
    }
  }
  for (const specifier of specifiers) {
    if (!specifier.startsWith(".") || specifier.includes("node_modules")) continue;
    const target = resolveFile(file, specifier);
    if (target?.startsWith(source)) walk(target);
    else unresolved.push(`${relative(source, file)}: ${specifier}`);
  }
}

const entries = new Set();
for (const name of readdirSync(join(site, "src")).filter((name) => /^demo.*\.jsx?$/.test(name)))
  for (const [, path] of readFileSync(join(site, "src", name), "utf8").matchAll(
    /['"]\.\.\/vendor\/hibi\/src\/([^'"?]+)/g,
  ))
    entries.add(path);
for (const entry of [...entries, ...always]) {
  const file = resolveFile(join(source, "index"), `./${entry}`);
  if (!file) throw new Error(`hibi ${commit} has no ${entry}`);
  walk(file);
}

rmSync(vendor, { recursive: true, force: true });
for (const file of files) {
  const target = join(vendor, relative(source, file));
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
}
rmSync(snapshot, { recursive: true, force: true });
for (const line of unresolved) console.warn(`unresolved import ${line}`);
console.log(`copied ${files.size} files from hibi ${commit}`);
