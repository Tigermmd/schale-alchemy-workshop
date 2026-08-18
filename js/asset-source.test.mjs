import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");
const generator = read("generate_dashboard_assets.py");
const manifest = JSON.parse(read("assets/manifest.json"));

test("cached UI assets do not retain website-specific Kivo, Arona, or Yostar sources", () => {
  assert.doesNotMatch(generator, /kivo\.wiki|arona\.icu|webcnstatic\.yostar\.net/);
  const entries = Object.entries(manifest.entries);
  assert.equal(entries.filter(([, entry]) => /kivo\.wiki|arona\.icu|webcnstatic\.yostar\.net/.test(entry.remote ?? "")).length, 0);
  assert.equal(entries.filter(([key]) => /^(ui:kivo|ui:arona)/.test(key)).length, 0);
});
