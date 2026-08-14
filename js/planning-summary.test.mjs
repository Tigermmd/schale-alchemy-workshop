import assert from "node:assert/strict";
import { calculatePackageEfficiency, calculatePlanningSummary } from "./planning-summary.js";

const giftBoxes = [
  { id: "100000", type: "random", outcomes: [{ gift_id: 5000, probability: 1, quantity: 1 }] },
  { id: "100008", type: "choice", selectable_gift_ids: [5000] },
  { id: "100009", type: "random", outcomes: [{ gift_id: 5100, probability: 1, quantity: 1 }] },
];
const student = { student_id: 1, gift_values: [{ gift_id: 5000, relationship_exp: 60 }, { gift_id: 5100, relationship_exp: 120 }] };
const data = {
  students: [student],
  studentById: new Map([["1", student]]),
  giftById: new Map([["5000", { id: 5000 }]]),
  giftBoxes,
  releaseTimeline: [{ studentId: 1, jpRank: 1 }],
  craftingById: new Map([["1", { relationship_exp_per_manufacturing_stone: 80 }]]),
  snapshots: { thresholds: [{ level: 1, cumulative_exp_to_reach_level: 0 }, { level: 2, cumulative_exp_to_reach_level: 100 }] },
};
const state = {
  students: [{ id: "student-1", studentId: 1, currentLevel: 1, currentProgress: 0, targetLevel: 2 }],
  mainTargetStudentId: 1,
  cnProgress: { cutoffRank: 1 },
  inventory: { 5000: 1 },
  giftReservations: {},
  giftBoxes: { 100008: 1 },
  equivalentGiftPools: { "random-gold": 1 },
  stockResources: { manufacturing_stone: 1, synthesis_stone_gold: 1 },
  incomingResources: { giftBoxes: {}, equivalentGiftPools: {}, stockResources: {}, relationshipExp: {} },
  resourcePostingHistory: [],
  resources: [],
};
const summary = calculatePlanningSummary({ state, data, forecastDays: 10 });
assert.equal(summary.students[0].requiredExp, 100);
assert.equal(summary.students[0].currentExp, 60 + 60 + 60 + 80 + 20);
assert.equal(summary.students[0].freeExp, 0);
assert.equal(summary.students[0].gapWithinPeriod, 0);
assert.equal(summary.students[0].estimatedDays, 0);
assert.equal(summary.students[0].sourceBreakdown.current.randomPoolExp, 60);

const packageIndependentState = { ...state, packagePlans: { p: { purchased: 99, planned: 99 } } };
const packageIndependentSummary = calculatePlanningSummary({ state: packageIndependentState, data, forecastDays: 10 });
assert.deepEqual(packageIndependentSummary.students, summary.students);

const periodState = {
  ...state,
  inventory: {},
  giftBoxes: {},
  equivalentGiftPools: {},
  stockResources: {},
  resources: [{ id: "weekly-manufacturing-stones", cadence: "weekly", unit: "manufacturing_stone", amount: 17 }],
  resourcePostingHistory: [{
    id: "old-period",
    postingKey: "weekly-manufacturing-stones:30",
    resourceId: "weekly-manufacturing-stones",
    periodDays: 30,
    mapped: { stockResources: { manufacturing_stone: 17 * 30 / 7 }, giftBoxes: {}, equivalentGiftPools: {}, relationshipExp: {} },
    active: true,
  }],
};
const periodSummary = calculatePlanningSummary({ state: periodState, data, forecastDays: 60 });
assert.equal(periodSummary.students[0].sourceBreakdown.free.manufacturingExp, 17 * 60 / 7 * 80);

const packageRows = calculatePackageEfficiency({
  student,
  giftBoxes,
  packageCatalog: { asOf: "2026-08-12", packages: [{ id: "p", price_cny: 10, purchase_limit: 1, status: "active", contents: [{ kind: "student_favorite_gift", gift_color: "gold", quantity: 1 }] }] },
  manufacturingData: { relationship_exp_per_manufacturing_stone: 80 },
});
assert.equal(packageRows[0].expectedExp, 20);
assert.equal(packageRows[0].expPerYuan, 2);
assert.equal(packageRows[0].availablePurchases, 1);
assert.equal(packageRows[0].goldGiftExp, 20);
assert.equal(packageRows[0].purpleGiftExp, 0);

const excludedRows = calculatePackageEfficiency({
  student,
  packageCatalog: { packages: [
    { id: "expired", price_cny: 1, purchase_limit: 1, status: "expired", contents: [{ kind: "student_favorite_gift", gift_color: "gold", quantity: 1 }] },
    { id: "template", price_cny: 1, purchase_limit: 1, status: "template", contents: [{ kind: "student_favorite_gift", gift_color: "gold", quantity: 1 }] },
  ] },
});
assert.deepEqual(excludedRows, []);
console.log("planning summary tests passed");
