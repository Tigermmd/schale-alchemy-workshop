import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("broken student, gift, node, and reaction frames reveal their fallback", () => {
  assert.match(
    styles,
    /\.student-avatar\.image-frame\.is-broken \.image-fallback[^}]*display:\s*grid/s,
    "student avatars need a visible fallback after both image sources fail",
  );
  assert.match(
    styles,
    /\.node-image\.image-frame\.is-broken \.image-fallback[^}]*display:\s*grid/s,
    "node icons need a visible fallback after both image sources fail",
  );
  assert.match(
    styles,
    /\.gift-image\.image-frame\.is-broken \.image-fallback[^}]*display:\s*grid/s,
    "gift icons need a visible fallback after both image sources fail",
  );
  assert.match(
    styles,
    /\.reaction-face\.image-frame\.is-broken \.image-fallback[^}]*display:\s*grid/s,
    "reaction icons need a visible fallback after both image sources fail",
  );
});
