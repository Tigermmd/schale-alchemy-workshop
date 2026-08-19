import assert from "node:assert/strict";
import { safeExternalUrl } from "./url-safety.js";

assert.equal(safeExternalUrl("https://example.com/source"), "https://example.com/source");
assert.equal(safeExternalUrl("http://localhost:8765/source"), "http://localhost:8765/source");
assert.equal(safeExternalUrl("javascript:alert(1)"), "");
assert.equal(safeExternalUrl("data:text/html,<script>alert(1)</script>"), "");
assert.equal(safeExternalUrl("/local/source"), "");

console.log("URL safety tests passed");
