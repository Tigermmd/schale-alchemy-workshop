import assert from "node:assert/strict";
import {
  addStudentPlan,
  calculateRequiredRelationshipExp,
  createEmptyPlannerState,
  normalizePlannerState,
  parseStudentIdInput,
  planGiftAllocation,
  removeStudentPlan,
  setResourceAmount,
  setInventoryCount,
} from "./planner-state.js";

const thresholds = [
  { level: 1, cumulative_exp_to_reach_level: 0 },
  { level: 2, cumulative_exp_to_reach_level: 15 },
  { level: 3, cumulative_exp_to_reach_level: 45 },
  { level: 4, cumulative_exp_to_reach_level: 75 },
];

assert.equal(calculateRequiredRelationshipExp(2, 5, 4, thresholds), 55);
assert.equal(calculateRequiredRelationshipExp(4, 0, 4, thresholds), 0);
assert.equal(calculateRequiredRelationshipExp(2, 99, 3, thresholds), 0);
assert.equal(parseStudentIdInput("爱露 · Aru · #10000"), 10000);
assert.equal(parseStudentIdInput("Koyuki / 小雪 #10063"), 10063);
assert.equal(parseStudentIdInput("not a student"), 0);

const empty = createEmptyPlannerState();
assert.equal(empty.version, 6);
assert.equal(empty.students.length, 0);
assert.ok(empty.resources.some((resource) => resource.id === "weekly-manufacturing-stones"));
assert.equal(empty.resources.find((resource) => resource.id === "weekly-manufacturing-stones").value_source, "default");
assert.ok(empty.resources.some((resource) => resource.id === "monthly-event-shop-gold-gift-boxes"));
assert.ok(empty.resources.some((resource) => resource.id === "monthly-event-shop-purple-gift-boxes"));
assert.equal(empty.resources.find((resource) => resource.id === "weekly-manufacturing-stones").amount, 17);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-synthesis-stones").amount, 50);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-total-assault-gift-boxes").amount, 3);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-grand-assault-gold-gift-boxes").amount, 4.5);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-grand-assault-purple-gift-boxes").amount, 1.5);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-grand-assault-gift-boxes"), undefined);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-event-shop-gold-gift-boxes").amount, 80);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-event-shop-purple-gift-boxes").amount, 4);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes").amount, null, "tower floor must wait for the player's own input");
assert.deepEqual(empty.resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes").floor_options, [24, 49, 74, 99, 106, 124]);
assert.equal(empty.resources.find((resource) => resource.id === "daily-schedule-exp").expected_per_count, 31.25);
assert.equal(empty.resources.find((resource) => resource.id === "daily-cafe-exp").expected_per_count, 15);
assert.deepEqual(empty.packagePlans["cn-third-anniversary-gifts-98"], { purchased: 1, inInventory: 0, planned: 0 });
assert.deepEqual(empty.packagePlans["cn-third-anniversary-manufacturing-156"], { purchased: 1, inInventory: 0, planned: 0 });
assert.equal(empty.stockResources.manufacturing_stone, 0);
assert.equal(empty.stockResources.synthesis_stone_gold, 0);
assert.deepEqual(empty.synthesisReservations, []);

const emptyLegacyState = normalizePlannerState({ version: 4, inventory: {}, giftBoxes: {} });
assert.equal(emptyLegacyState.stockResources.manufacturing_stone, 0, "an empty legacy state must not gain manufacturing stones");
assert.equal(emptyLegacyState.stockResources.synthesis_stone_gold, 0, "an empty legacy state must not gain synthesis stones");

const legacyGrandAssaultPosting = normalizePlannerState({
  version: 4,
  resources: [{ id: "monthly-grand-assault-gift-boxes", amount: 6, value_source: "default" }],
  resourcePostingHistory: [{
    id: "legacy-grand:30:1",
    postingKey: "monthly-grand-assault-gift-boxes:30",
    resourceId: "monthly-grand-assault-gift-boxes",
    periodDays: 30,
    amount: 6,
    mapped: { stockResources: {}, giftBoxes: { "100008": 4.5, "100009": 1.5 }, equivalentGiftPools: {}, relationshipExp: {} },
    active: true,
  }],
});
assert.deepEqual(legacyGrandAssaultPosting.resourcePostingHistory.map((item) => [item.resourceId, item.postingKey]), [
  ["monthly-grand-assault-gold-gift-boxes", "monthly-grand-assault-gold-gift-boxes:30"],
  ["monthly-grand-assault-purple-gift-boxes", "monthly-grand-assault-purple-gift-boxes:30"],
], "legacy grand assault postings must migrate to the split gold/purple resource ids");
const legacyAndSplitPosting = normalizePlannerState({
  version: 5,
  incomingResources: { giftBoxes: { "100008": 18, "100009": 6 } },
  resourcePostingHistory: [
    {
      id: "legacy-grand:60:1",
      postingKey: "monthly-grand-assault-gift-boxes:60",
      resourceId: "monthly-grand-assault-gift-boxes",
      periodDays: 60,
      amount: 6,
      mapped: { stockResources: {}, giftBoxes: { "100008": 9, "100009": 3 }, equivalentGiftPools: {}, relationshipExp: {} },
      active: true,
    },
    {
      id: "split-gold:60:1",
      postingKey: "monthly-grand-assault-gold-gift-boxes:60",
      resourceId: "monthly-grand-assault-gold-gift-boxes",
      periodDays: 60,
      amount: 4.5,
      mapped: { stockResources: {}, giftBoxes: { "100008": 9 }, equivalentGiftPools: {}, relationshipExp: {} },
      active: true,
    },
    {
      id: "split-purple:60:1",
      postingKey: "monthly-grand-assault-purple-gift-boxes:60",
      resourceId: "monthly-grand-assault-purple-gift-boxes",
      periodDays: 60,
      amount: 1.5,
      mapped: { stockResources: {}, giftBoxes: { "100009": 3 }, equivalentGiftPools: {}, relationshipExp: {} },
      active: true,
    },
  ],
});
assert.equal(legacyAndSplitPosting.resourcePostingHistory.filter((item) => item.active !== false && item.postingKey === "monthly-grand-assault-gold-gift-boxes:60").length, 1, "legacy and split postings must not coexist as active duplicates");
assert.equal(legacyAndSplitPosting.incomingResources.giftBoxes["100008"], 9, "legacy and split incoming gold boxes must be reconciled");
assert.equal(legacyAndSplitPosting.incomingResources.giftBoxes["100009"], 3, "legacy and split incoming purple boxes must be reconciled");
const normalizedLegacyAndSplitTwice = normalizePlannerState(legacyAndSplitPosting);
assert.equal(normalizedLegacyAndSplitTwice.incomingResources.giftBoxes["100008"], 9, "legacy duplicate reconciliation must be idempotent for gold boxes");
assert.equal(normalizedLegacyAndSplitTwice.incomingResources.giftBoxes["100009"], 3, "legacy duplicate reconciliation must be idempotent for purple boxes");
assert.deepEqual(normalizedLegacyAndSplitTwice.resourcePostingHistory, legacyAndSplitPosting.resourcePostingHistory, "legacy duplicate migration must stabilize after the first normalize");
const persistedLegacyMarkerState = {
  ...legacyAndSplitPosting,
  resourcePostingHistory: legacyAndSplitPosting.resourcePostingHistory.map((item, index) => index < 2 ? { ...item, migratedDuplicate: true } : item),
};
const preservedPersistedLegacyMarker = normalizePlannerState(persistedLegacyMarkerState);
assert.equal(preservedPersistedLegacyMarker.incomingResources.giftBoxes["100008"], 9, "a previously reconciled legacy marker must not subtract incoming gold boxes again");
assert.equal(preservedPersistedLegacyMarker.incomingResources.giftBoxes["100009"], 3, "a previously reconciled legacy marker must not subtract incoming purple boxes again");
const normalizedTwice = normalizePlannerState(legacyGrandAssaultPosting);
assert.deepEqual(normalizedTwice.resourcePostingHistory, legacyGrandAssaultPosting.resourcePostingHistory, "posting migration must be idempotent");
const inconsistentPeriod = normalizePlannerState({ version: 6, periodDays: 30, forecastDays: 60 });
assert.equal(inconsistentPeriod.periodDays, 30);
assert.equal(inconsistentPeriod.forecastDays, 30, "state normalization must keep the planning period unified");
const zeroDayPeriod = normalizePlannerState({ version: 6, periodDays: 0, forecastDays: 0 });
assert.equal(zeroDayPeriod.periodDays, 0, "planner state should preserve an explicit zero-day window");
assert.equal(zeroDayPeriod.forecastDays, 0, "planner state should preserve an explicit zero-day window");

const migratedGrandAssault = normalizePlannerState({
  version: 4,
  resources: [{ id: "monthly-grand-assault-gift-boxes", amount: 6, value_source: "default" }],
});
assert.equal(migratedGrandAssault.resources.find((resource) => resource.id === "monthly-grand-assault-gold-gift-boxes").amount, 4.5);
assert.equal(migratedGrandAssault.resources.find((resource) => resource.id === "monthly-grand-assault-purple-gift-boxes").amount, 1.5);

const withStudent = addStudentPlan(empty, { studentId: 10063, currentLevel: 2, currentProgress: 5, targetLevel: 4 });
assert.equal(withStudent.students.length, 1);
assert.equal(withStudent.students[0].studentId, 10063);
assert.equal(withStudent.students[0].targetLevel, 4);
assert.equal(addStudentPlan(withStudent, { studentId: 10063, targetLevel: 5 }).students.length, 1);
const removedPlanState = removeStudentPlan(withStudent, withStudent.students[0].id);
assert.equal(removedPlanState.students.length, 0);
assert.equal(removedPlanState.studentDrafts["10063"].targetLevel, 4, "Removing a target must preserve its last form values for accidental re-add");
const readdedFromDraft = addStudentPlan(removedPlanState, { studentId: 10063 });
assert.equal(readdedFromDraft.students[0].currentLevel, 2, "Re-adding a target must restore its last current level");
assert.equal(readdedFromDraft.students[0].targetLevel, 4, "Re-adding a target must restore its last target level");

const withInventory = setInventoryCount(withStudent, "5000", 3);
assert.equal(withInventory.inventory["5000"], 3);
assert.equal(setInventoryCount(withInventory, "5000", -4).inventory["5000"], 0);
const overridden = setResourceAmount(empty, "weekly-manufacturing-stones", "12");
assert.equal(overridden.resources.find((resource) => resource.id === "weekly-manufacturing-stones").amount, 12);
assert.equal(overridden.resources.find((resource) => resource.id === "weekly-manufacturing-stones").value_source, "user");
const cleared = setResourceAmount(overridden, "weekly-manufacturing-stones", "");
assert.equal(cleared.resources.find((resource) => resource.id === "weekly-manufacturing-stones").amount, null);
assert.equal(normalizePlannerState(cleared).resources.find((resource) => resource.id === "weekly-manufacturing-stones").amount, null);
assert.equal(setResourceAmount(empty, "monthly-unlimited-assault-gift-boxes", 99).resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes").amount, 99);
assert.equal(setResourceAmount(empty, "daily-schedule-exp", 7).resources.find((resource) => resource.id === "daily-schedule-exp").amount, 7);
const customFloor = setResourceAmount(empty, "monthly-unlimited-assault-gift-boxes", "custom");
const customFloorResource = customFloor.resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes");
assert.equal(customFloorResource.amount, null, "choosing custom floor must wait for a user value");
assert.equal(customFloorResource.floor_mode, "custom", "choosing custom floor must persist custom mode");
const customFromPreset = setResourceAmount(
  setResourceAmount(empty, "monthly-unlimited-assault-gift-boxes", 99, { floorMode: null }),
  "monthly-unlimited-assault-gift-boxes",
  "custom",
);
assert.equal(customFromPreset.resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes").amount, 99, "switching a configured floor to custom must keep the current floor as the editable starting value");
const enteredCustomFloor = setResourceAmount(customFloor, "monthly-unlimited-assault-gift-boxes", 107);
const enteredCustomFloorResource = enteredCustomFloor.resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes");
assert.equal(enteredCustomFloorResource.amount, 107);
assert.equal(enteredCustomFloorResource.floor_mode, "custom", "typing a custom floor must keep the custom input visible");
assert.equal(normalizePlannerState(enteredCustomFloor).resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes").floor_mode, "custom", "custom mode must survive reload normalization");
const presetFloor = setResourceAmount(enteredCustomFloor, "monthly-unlimited-assault-gift-boxes", 99, { floorMode: null });
assert.equal(presetFloor.resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes").floor_mode, null, "choosing a preset floor must leave custom mode");

const normalized = normalizePlannerState({ version: 999, inventory: { "5001": 2 }, students: [{ studentId: 10001 }] });
assert.equal(normalized.version, 6);
assert.equal(normalized.inventory["5001"], 2);
assert.equal(normalized.students[0].currentLevel, 1);
assert.equal(normalized.students[0].targetLevel, 1);
assert.equal(normalized.resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes").amount, null, "an unconfigured tower floor must not enter planning automatically");

const allocation = planGiftAllocation({
  students: [
    { id: "aru", studentId: 10000, requiredExp: 60 },
    { id: "eimi", studentId: 10001, requiredExp: 40 },
  ],
  inventory: { "5000": 1, "5001": 1 },
  giftById: new Map([
    ["5000", { id: 5000 }],
    ["5001", { id: 5001 }],
  ]),
  giftValuesByStudent: new Map([
    ["aru", { "5000": 40, "5001": 20 }],
    ["eimi", { "5000": 20, "5001": 40 }],
  ]),
});
assert.equal(allocation.totalEffectiveExp, 80);
assert.equal(allocation.students.find((student) => student.id === "aru").effectiveExp, 40);
assert.equal(allocation.students.find((student) => student.id === "eimi").effectiveExp, 40);
assert.equal(allocation.remainingInventory["5000"], 0);
assert.equal(allocation.remainingInventory["5001"], 0);

const reassignedAllocation = planGiftAllocation({
  students: [
    { id: "a", requiredExp: 60 },
    { id: "b", requiredExp: 60 },
  ],
  inventory: { "5000": 1, "5001": 1 },
  giftById: new Map([
    ["5000", { id: 5000 }],
    ["5001", { id: 5001 }],
  ]),
  giftValuesByStudent: new Map([
    ["a", { "5000": 60, "5001": 60 }],
    ["b", { "5000": 40, "5001": 0 }],
  ]),
});
assert.equal(reassignedAllocation.totalEffectiveExp, 100, "allocation must reassign contested gifts globally instead of stopping at a greedy 60");
assert.deepEqual(reassignedAllocation.assignments.map((item) => [item.studentId, item.giftId, item.quantity]), [["a", "5001", 1], ["b", "5000", 1]]);

const largeGiftById = new Map(Array.from({ length: 52 }, (_, index) => [String(1000 + index), { id: 1000 + index, rarity: index < 26 ? "SSR" : "SR" }]));
const largeGiftValues = new Map(Array.from({ length: 3 }, (_, index) => [
  String(index),
  Object.fromEntries([...largeGiftById.keys()].map((giftId) => [giftId, 40])),
]));
const largeInventory = Object.fromEntries([...largeGiftById.keys()].map((giftId) => [giftId, 250]));
const largeAllocationStart = performance.now();
const largeAllocation = planGiftAllocation({
  students: ["0", "1", "2"].map((id) => ({ id, requiredExp: 100000 })),
  inventory: largeInventory,
  giftById: largeGiftById,
  giftValuesByStudent: largeGiftValues,
});
assert.ok(performance.now() - largeAllocationStart < 1000, "大库存多学生分配必须在一秒内完成，不能阻塞养成规划页面");
assert.ok(largeAllocation.assignments.length > 0);

console.log("planner state tests passed");
