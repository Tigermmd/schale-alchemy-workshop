import assert from "node:assert/strict";
import fs from "node:fs";
import {
  calculateGiftBoxExpectedExp,
  calculateGiftBoxesExpectedExp,
} from "./gift-box-state.js";

const giftValues = new Map([
  ["5000", 20],
  ["5001", 240],
  ["5002", 120],
]);

const randomBox = {
  id: "100000",
  type: "random",
  outcomes: [
    { gift_id: 5000, probability: 0.25, quantity: 1 },
    { gift_id: 5001, probability: 0.75, quantity: 1 },
  ],
};

assert.deepEqual(calculateGiftBoxExpectedExp(randomBox, giftValues), {
  status: "ready",
  expectedExp: 185,
  missingGiftIds: [],
});

assert.equal(
  calculateGiftBoxesExpectedExp([{ box: randomBox, quantity: 2 }], giftValues).expectedExp,
  370,
);

const choiceBox = {
  id: "100008",
  type: "choice",
  selectable_gift_ids: [5000, 5001, 5002],
};
assert.deepEqual(calculateGiftBoxExpectedExp(choiceBox, giftValues, { policy: "best_for_student" }), {
  status: "ready",
  expectedExp: 240,
  missingGiftIds: [],
  selectedGiftId: "5001",
  selectedGiftIds: ["5001"],
  selectableGiftIds: ["5000", "5001", "5002"],
  selectableGiftCount: 3,
});

assert.equal(calculateGiftBoxExpectedExp(choiceBox, giftValues).status, "missing_selection_policy");
assert.equal(calculateGiftBoxExpectedExp({ ...randomBox, outcomes: [] }, giftValues).status, "missing_probability");
assert.equal(
  calculateGiftBoxExpectedExp({ ...randomBox, outcomes: [{ gift_id: 5000, probability: 0.9, quantity: 1 }] }, giftValues).status,
  "invalid_probability_total",
);
assert.deepEqual(calculateGiftBoxExpectedExp({ ...randomBox, outcomes: [{ gift_id: 5099, probability: 1, quantity: 1 }] }, giftValues), {
  status: "missing_gift_values",
  expectedExp: null,
  missingGiftIds: ["5099"],
});

const snapshot = JSON.parse(fs.readFileSync(new URL("../../relationship_data/gift_boxes_cn.json", import.meta.url), "utf8"));
const snapshotBoxes = Object.fromEntries(snapshot.boxes.map((box) => [box.id, box]));
const goldIds = Array.from({ length: 35 }, (_, index) => 5000 + index);
const purpleIds = Array.from({ length: 13 }, (_, index) => 5100 + index);
assert.equal(snapshot.scope.calculation_policy, "user_confirmed_equal_probability");
assert.deepEqual(snapshotBoxes["100000"].outcomes.map((outcome) => outcome.gift_id), goldIds);
assert.deepEqual(snapshotBoxes["100008"].selectable_gift_ids, goldIds);
assert.deepEqual(snapshotBoxes["100009"].outcomes.map((outcome) => outcome.gift_id), purpleIds);
assert.equal(snapshotBoxes["100008"].selectable_gift_ids.includes(5106), false);
assert.equal(new Set(snapshotBoxes["100009"].outcomes.map((outcome) => outcome.probability)).size, 1);
assert.ok(Math.abs(snapshotBoxes["100009"].outcomes.reduce((sum, outcome) => sum + outcome.probability, 0) - 1) < 1e-12);

console.log("gift box state tests passed");
