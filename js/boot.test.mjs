import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const boot = fs.readFileSync(path.join(root, "js", "boot.js"), "utf8");

assert.match(indexHtml, /<script[^>]+src="\.\/js\/boot\.js\?v=/, "index should load the protocol-aware boot script");
assert.doesNotMatch(indexHtml, /<script[^>]+type="module"[^>]+src="\.\/js\/app\.js/, "index should not start modules directly from file://");
assert.match(boot, /location\.protocol\s*===\s*["']file:["']/, "boot should detect file:// entry points");
assert.match(boot, /请通过本地 HTTP 服务打开页面/, "file:// entry points should explain the correct launch method");
assert.match(boot, /import\(\s*["'`]\.\/app\.js\?v=/, "HTTP entry points should dynamically load the dashboard app");

console.log("protocol boot tests passed");
