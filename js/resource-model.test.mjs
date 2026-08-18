import assert from "node:assert/strict";
import fs from "node:fs";
import { calculateResourceForecast, summarizeUnlimitedAssaultRewards } from "./resource-model.js";

const snapshot = JSON.parse(fs.readFileSync(new URL("../relationship_data/unlimited_assault_rewards_cn.json", import.meta.url), "utf8"));

assert.deepEqual(summarizeUnlimitedAssaultRewards(snapshot, 24), {
  floor: 24,
  goldSelectableGifts: 2,
  purpleRandomGifts: 0,
  synthesisStones: 0,
});
assert.deepEqual(summarizeUnlimitedAssaultRewards(snapshot, 99), {
  floor: 99,
  goldSelectableGifts: 6,
  purpleRandomGifts: 3,
  synthesisStones: 20,
});
assert.deepEqual(summarizeUnlimitedAssaultRewards(snapshot, 124), {
  floor: 124,
  goldSelectableGifts: 14,
  purpleRandomGifts: 7,
  synthesisStones: 20,
});
assert.equal(summarizeUnlimitedAssaultRewards(snapshot, null), null);
assert.equal(summarizeUnlimitedAssaultRewards({ scope: { season_floor_range: [1, 1] }, floor_rewards: [[1, [["金色制造石", "20"]]]] }, 1).synthesisStones, 0, "unused gold manufacturing stones must not become synthesis stones");
assert.equal(calculateResourceForecast({ input_kind: "daily_count", cadence: "daily", expected_per_count: 31.25 }, 1, 30).value, 937.5);
assert.equal(calculateResourceForecast({ input_kind: "daily_count", cadence: "daily", expected_per_count: 15 }, 8, 30).value, 3600);
assert.deepEqual(calculateResourceForecast({ input_kind: "floor", cadence: "monthly" }, 99, 30, snapshot).summary, {
  floor: 99,
  goldSelectableGifts: 6,
  purpleRandomGifts: 3,
  synthesisStones: 20,
});
assert.equal(calculateResourceForecast({ input_kind: "floor", cadence: "monthly" }, 55, 30, snapshot).summary.synthesisStones, 5, "floor 55 adds five synthesis stones");
assert.equal(calculateResourceForecast({ input_kind: "floor", cadence: "monthly" }, 57, 30, snapshot).summary.synthesisStones, 10, "floor 57 adds ten synthesis stones in total");
assert.equal(calculateResourceForecast({ input_kind: "floor", cadence: "monthly" }, 60, 30, snapshot).summary.synthesisStones, 20, "floor 60 adds all twenty synthesis stones");
assert.deepEqual(calculateResourceForecast({ input_kind: "floor", cadence: "monthly" }, 99, 60, snapshot).summary, {
  floor: 99,
  goldSelectableGifts: 12,
  purpleRandomGifts: 6,
  synthesisStones: 40,
}, "a 60-day preview must use the same two-month multiplier as planning");

console.log("resource model tests passed");
