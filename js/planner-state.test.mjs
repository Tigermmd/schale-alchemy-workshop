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
assert.equal(empty.version, 4);
assert.equal(empty.students.length, 0);
assert.ok(empty.resources.some((resource) => resource.id === "weekly-manufacturing-stones"));
assert.equal(empty.resources.find((resource) => resource.id === "weekly-manufacturing-stones").value_source, "default");
assert.ok(empty.resources.some((resource) => resource.id === "monthly-event-shop-gold-gift-boxes"));
assert.ok(empty.resources.some((resource) => resource.id === "monthly-event-shop-purple-gift-boxes"));
assert.equal(empty.resources.find((resource) => resource.id === "weekly-manufacturing-stones").amount, 17);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-synthesis-stones").amount, 70);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-total-assault-gift-boxes").amount, 3);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-grand-assault-gift-boxes").amount, 6);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-event-shop-gold-gift-boxes").amount, 80);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-event-shop-purple-gift-boxes").amount, 4);
assert.equal(empty.resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes").amount, 99);
assert.deepEqual(empty.resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes").floor_options, [24, 49, 74, 99, 106, 124]);
assert.equal(empty.resources.find((resource) => resource.id === "daily-schedule-exp").expected_per_count, 31.25);
assert.equal(empty.resources.find((resource) => resource.id === "daily-cafe-exp").expected_per_count, 15);
assert.deepEqual(empty.packagePlans["cn-third-anniversary-gifts-98"], { purchased: 1, inInventory: 0, planned: 0 });
assert.deepEqual(empty.packagePlans["cn-third-anniversary-manufacturing-156"], { purchased: 1, inInventory: 0, planned: 0 });
assert.equal(empty.stockResources.manufacturing_stone, 50);
assert.equal(empty.stockResources.synthesis_stone_gold, 100);

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

const normalized = normalizePlannerState({ version: 999, inventory: { "5001": 2 }, students: [{ studentId: 10001 }] });
assert.equal(normalized.version, 4);
assert.equal(normalized.inventory["5001"], 2);
assert.equal(normalized.students[0].currentLevel, 1);
assert.equal(normalized.students[0].targetLevel, 1);
assert.equal(normalized.resources.find((resource) => resource.id === "monthly-unlimited-assault-gift-boxes").amount, 99);

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

console.log("planner state tests passed");
