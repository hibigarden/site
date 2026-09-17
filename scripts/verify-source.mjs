import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const local = fileURLToPath(new URL("../vendor/hibi/src/", import.meta.url));
const original =
  process.argv[2] ??
  fileURLToPath(new URL("../../hibi 2/src/", import.meta.url));
let count = 0;

async function verify(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await verify(file);
    else {
      const path = relative(local, file);
      assert.ok(
        (await readFile(file)).equals(await readFile(join(original, path))),
        `hibi source changed: ${path}`,
      );
      count++;
    }
  }
}

await verify(local);
console.log(`${count} hibi source files match the original byte for byte.`);
