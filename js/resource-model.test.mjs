import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateResourceForecast, summarizeUnlimitedAssaultRewards } from "./resource-model.js";

const snapshot = JSON.parse(fs.readFileSync(new URL("../relationship_data/unlimited_assault_rewards_cn.json", import.meta.url), "utf8"));

assert.deepEqual(summarizeUnlimitedAssaultRewards(snapshot, 24), {
  floor: 24,
  goldSelectableGifts: 2,
  purpleRandomGifts: 0,
});
assert.deepEqual(summarizeUnlimitedAssaultRewards(snapshot, 99), {
  floor: 99,
  goldSelectableGifts: 6,
  purpleRandomGifts: 3,
});
assert.deepEqual(summarizeUnlimitedAssaultRewards(snapshot, 124), {
  floor: 124,
  goldSelectableGifts: 14,
  purpleRandomGifts: 7,
});
assert.equal(summarizeUnlimitedAssaultRewards(snapshot, null), null);
assert.equal(calculateResourceForecast({ input_kind: "daily_count", cadence: "daily", expected_per_count: 31.25 }, 1, 30).value, 937.5);
assert.equal(calculateResourceForecast({ input_kind: "daily_count", cadence: "daily", expected_per_count: 15 }, 8, 30).value, 3600);
assert.deepEqual(calculateResourceForecast({ input_kind: "floor", cadence: "monthly" }, 99, 30, snapshot).summary, {
  floor: 99,
  goldSelectableGifts: 6,
  purpleRandomGifts: 3,
});

console.log("resource model tests passed");
