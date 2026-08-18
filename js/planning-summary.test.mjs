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
assert.equal(summary.students[0].currentExp, 60 + 60 + 60 + 80);
assert.equal(summary.students[0].freeExp, 0);
assert.equal(summary.students[0].gapWithinPeriod, 0);
assert.equal(summary.students[0].immediateGap, 0);
assert.equal(summary.students[0].estimatedDays, 0);
assert.equal(summary.students[0].sourceBreakdown.current.randomPoolExp, 60);
assert.equal(summary.students[0].sourceBreakdown.current.synthesisExp, 0, "one gold gift cannot unlock a synthesis stone");

const immediateOnlySummary = calculatePlanningSummary({ state, data, forecastDays: 0 });
assert.equal(immediateOnlySummary.forecastDays, 0, "a zero-day planning window should be allowed for current-inventory-only calculations");
assert.equal(immediateOnlySummary.students[0].freeExp, 0, "a zero-day window must not add periodic resources");
assert.equal(immediateOnlySummary.students[0].estimatedDays, 0, "an already-covered goal remains zero days in a zero-day window");

const reservedSummary = calculatePlanningSummary({
  state: { ...state, inventory: { 5000: 1 }, giftReservations: { 5000: 1 }, giftBoxes: {}, equivalentGiftPools: {}, stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 0 } },
  data,
  forecastDays: 10,
});
assert.equal(reservedSummary.students[0].currentExp, 60, "a reservation locks a gift but does not remove it from the plan contribution");

const incomingOnlySummary = calculatePlanningSummary({
  state: { ...state, inventory: {}, giftBoxes: {}, equivalentGiftPools: {}, stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 0 }, incomingResources: { stockResources: {}, giftBoxes: { "100008": 1 }, equivalentGiftPools: {}, relationshipExp: {} }, resourcePostingHistory: [], resources: [] },
  data,
  forecastDays: 10,
});
assert.equal(incomingOnlySummary.students[0].sourceBreakdown.free.choiceBoxExp, 60, "legacy incoming resources without posting history must remain usable");

const oneTimeAndDailyState = {
  ...state,
  inventory: {},
  giftBoxes: {},
  equivalentGiftPools: {},
  stockResources: {},
  resources: [{ id: "daily-schedule-exp", cadence: "daily", unit: "relationship_exp", amount: 1, expected_per_count: 1 }],
  incomingResources: { stockResources: {}, giftBoxes: { "100008": 1 }, equivalentGiftPools: {}, relationshipExp: {} },
  resourcePostingHistory: [],
};
const longGoalData = {
  ...data,
  snapshots: { thresholds: [{ level: 1, cumulative_exp_to_reach_level: 0 }, { level: 2, cumulative_exp_to_reach_level: 1000 }] },
};
const sixtyDaySummary = calculatePlanningSummary({ state: oneTimeAndDailyState, data: longGoalData, forecastDays: 60 });
const ninetyDaySummary = calculatePlanningSummary({ state: oneTimeAndDailyState, data: longGoalData, forecastDays: 90 });
assert.equal(sixtyDaySummary.students[0].sourceBreakdown.free.incoming.totalExp, 60, "confirmed incoming resources must remain separately visible");
assert.equal(sixtyDaySummary.students[0].sourceBreakdown.free.recurring.totalExp, 60, "daily periodic resources must remain separately visible");
assert.equal(sixtyDaySummary.students[0].estimatedDays, 940, "estimated days must subtract one-time incoming EXP before applying the recurring daily rate");
assert.equal(ninetyDaySummary.students[0].estimatedDays, 940, "changing the forecast window must not dilute one-time resources into a lower daily rate");
const zeroDayLongGoalSummary = calculatePlanningSummary({ state: oneTimeAndDailyState, data: longGoalData, forecastDays: 0 });
assert.equal(zeroDayLongGoalSummary.students[0].freeExp, 0, "a zero-day window must not count future incoming resources");
assert.equal(zeroDayLongGoalSummary.students[0].freeExpPerDay, 1, "a zero-day window must preserve the recurring daily rate");
assert.equal(zeroDayLongGoalSummary.students[0].estimatedDays, 1000, "a zero-day window must still estimate completion from the daily free-resource rate");

const synthesisData = {
  ...data,
  students: [{ student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 20 }, { gift_id: 5002, relationship_exp: 60 }] }],
  studentById: new Map([["2", { student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 20 }, { gift_id: 5002, relationship_exp: 60 }] }]]),
  giftById: new Map([["5000", { id: 5000, rarity: "SR" }], ["5001", { id: 5001, rarity: "SR" }], ["5002", { id: 5002, rarity: "SR" }]]),
  giftBoxes: [{ id: "100008", type: "choice", selectable_gift_ids: [5002] }],
  snapshots: { thresholds: [{ level: 1, cumulative_exp_to_reach_level: 0 }, { level: 2, cumulative_exp_to_reach_level: 60 }] },
};
const synthesisState = {
  ...state,
  students: [{ id: "student-2", studentId: 2, currentLevel: 1, currentProgress: 0, targetLevel: 2 }],
  mainTargetStudentId: 2,
  inventory: { 5000: 1, 5001: 1 },
  giftBoxes: {},
  equivalentGiftPools: {},
  stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 1 },
};
const synthesisSummary = calculatePlanningSummary({ state: synthesisState, data: synthesisData, forecastDays: 10 });
assert.equal(synthesisSummary.students[0].sourceBreakdown.current.synthesisCount, 1);
assert.equal(synthesisSummary.students[0].sourceBreakdown.current.synthesisExp, 60);
assert.equal(synthesisSummary.students[0].currentExp, 60, "synthesis should compete with direct gift allocation instead of losing the pair");
const periodicSynthesisSummary = calculatePlanningSummary({
  state: {
    ...synthesisState,
    stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 0 },
    resources: [{ id: "monthly-synthesis-stones", cadence: "monthly", unit: "synthesis_stone_gold", amount: 1 }],
  },
  data: synthesisData,
  forecastDays: 30,
});
assert.equal(periodicSynthesisSummary.students[0].sourceBreakdown.free.synthesisCount, 1);
assert.equal(periodicSynthesisSummary.students[0].sourceBreakdown.free.synthesisExp, 60, "periodic synthesis stones should use concrete remaining gold gifts");
const twoStageSynthesisData = {
  ...synthesisData,
  students: [{ student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 20 }, { gift_id: 5002, relationship_exp: 60 }, { gift_id: 5003, relationship_exp: 20 }, { gift_id: 5004, relationship_exp: 20 }] }],
  studentById: new Map([["2", { student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 20 }, { gift_id: 5002, relationship_exp: 60 }, { gift_id: 5003, relationship_exp: 20 }, { gift_id: 5004, relationship_exp: 20 }] }]]),
  giftById: new Map(["5000", "5001", "5002", "5003", "5004"].map((id) => [id, { id: Number(id), rarity: "SR" }])),
  snapshots: { thresholds: [{ level: 1, cumulative_exp_to_reach_level: 0 }, { level: 2, cumulative_exp_to_reach_level: 120 }] },
};
const twoStageSynthesisSummary = calculatePlanningSummary({
  state: {
    ...synthesisState,
    inventory: { 5000: 1, 5001: 1, 5003: 1, 5004: 1 },
    resources: [{ id: "monthly-synthesis-stones", cadence: "monthly", unit: "synthesis_stone_gold", amount: 1 }],
  },
  data: twoStageSynthesisData,
  forecastDays: 30,
});
assert.equal(twoStageSynthesisSummary.students[0].sourceBreakdown.current.synthesisCount, 1);
assert.equal(twoStageSynthesisSummary.students[0].sourceBreakdown.free.synthesisCount, 1, "current and future synthesis stones must consume separate planned gift pairs");
assert.equal(twoStageSynthesisSummary.students[0].currentExp + twoStageSynthesisSummary.students[0].freeExp, 120, "current and future synthesis contributions must not double count the same pair");
const multiSynthesisGlobalData = {
  ...twoStageSynthesisData,
  students: [
    { student_id: 1, gift_values: [{ gift_id: 5000, relationship_exp: 40 }, { gift_id: 5001, relationship_exp: 60 }, { gift_id: 5002, relationship_exp: 20 }, { gift_id: 5003, relationship_exp: 0 }, { gift_id: 5004, relationship_exp: 0 }, { gift_id: 5005, relationship_exp: 0 }, { gift_id: 9000, relationship_exp: 60 }] },
    { student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 60 }, { gift_id: 5002, relationship_exp: 60 }, { gift_id: 5003, relationship_exp: 0 }, { gift_id: 5004, relationship_exp: 20 }, { gift_id: 5005, relationship_exp: 0 }] },
    { student_id: 3, gift_values: [{ gift_id: 5000, relationship_exp: 40 }, { gift_id: 5001, relationship_exp: 20 }, { gift_id: 5002, relationship_exp: 20 }, { gift_id: 5003, relationship_exp: 60 }, { gift_id: 5004, relationship_exp: 0 }, { gift_id: 5005, relationship_exp: 0 }] },
  ],
  studentById: new Map([
    ["1", { student_id: 1, gift_values: [{ gift_id: 5000, relationship_exp: 40 }, { gift_id: 5001, relationship_exp: 60 }, { gift_id: 5002, relationship_exp: 20 }, { gift_id: 5003, relationship_exp: 0 }, { gift_id: 5004, relationship_exp: 0 }, { gift_id: 5005, relationship_exp: 0 }, { gift_id: 9000, relationship_exp: 60 }] }],
    ["2", { student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 60 }, { gift_id: 5002, relationship_exp: 60 }, { gift_id: 5003, relationship_exp: 0 }, { gift_id: 5004, relationship_exp: 20 }, { gift_id: 5005, relationship_exp: 0 }] }],
    ["3", { student_id: 3, gift_values: [{ gift_id: 5000, relationship_exp: 40 }, { gift_id: 5001, relationship_exp: 20 }, { gift_id: 5002, relationship_exp: 20 }, { gift_id: 5003, relationship_exp: 60 }, { gift_id: 5004, relationship_exp: 0 }, { gift_id: 5005, relationship_exp: 0 }] }],
  ]),
  giftById: new Map(["5000", "5001", "5002", "5003", "5004", "5005"].map((id) => [id, { id: Number(id), rarity: "SR" }])),
  giftBoxes: [{ id: "100008", type: "choice", selectable_gift_ids: [9000] }],
  snapshots: { thresholds: [{ level: 1, cumulative_exp_to_reach_level: 0 }, { level: 2, cumulative_exp_to_reach_level: 200 }] },
};
const multiSynthesisGlobalSummary = calculatePlanningSummary({
  state: {
    ...synthesisState,
    students: [
      { id: "student-1", studentId: 1, currentLevel: 1, currentProgress: 80, targetLevel: 2 },
      { id: "student-2", studentId: 2, currentLevel: 1, currentProgress: 180, targetLevel: 2 },
      { id: "student-3", studentId: 3, currentLevel: 1, currentProgress: 60, targetLevel: 2 },
    ],
    mainTargetStudentId: 1,
    inventory: { 5000: 1, 5001: 1, 5002: 1, 5003: 1, 5004: 1, 5005: 1 },
    stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 2 },
  },
  data: multiSynthesisGlobalData,
  forecastDays: 10,
});
assert.equal(multiSynthesisGlobalSummary.students.reduce((sum, item) => sum + item.currentExp, 0), 200, "multiple synthesis stones must follow the main-target-first greedy allocation");
const multiStudentSynthesisData = {
  ...synthesisData,
  students: [
    { student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 20 }] },
    { student_id: 3, gift_values: [{ gift_id: 5000, relationship_exp: 60 }, { gift_id: 5001, relationship_exp: 60 }] },
  ],
  studentById: new Map([
    ["2", { student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 20 }] }],
    ["3", { student_id: 3, gift_values: [{ gift_id: 5000, relationship_exp: 60 }, { gift_id: 5001, relationship_exp: 60 }] }],
  ]),
  craftingById: new Map(),
  releaseTimeline: [{ studentId: 2, jpRank: 1 }, { studentId: 3, jpRank: 1 }],
  snapshots: { thresholds: [{ level: 1, cumulative_exp_to_reach_level: 0 }, { level: 2, cumulative_exp_to_reach_level: 60 }, { level: 3, cumulative_exp_to_reach_level: 120 }] },
};
const multiStudentSynthesisSummary = calculatePlanningSummary({
  state: {
    ...synthesisState,
    students: [
      { id: "student-2", studentId: 2, currentLevel: 1, currentProgress: 0, targetLevel: 2 },
      { id: "student-3", studentId: 3, currentLevel: 1, currentProgress: 0, targetLevel: 3 },
    ],
    mainTargetStudentId: 2,
  },
  data: multiStudentSynthesisData,
  forecastDays: 10,
});
assert.equal(multiStudentSynthesisSummary.students.reduce((sum, item) => sum + item.currentExp, 0), 40, "multi-student allocation must prioritize the configured main target");
const mixedMultiStudentData = {
  ...multiStudentSynthesisData,
  students: [
    { student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 20 }, { gift_id: 5002, relationship_exp: 20 }, { gift_id: 5003, relationship_exp: 20 }, { gift_id: 5004, relationship_exp: 60 }] },
    { student_id: 3, gift_values: [{ gift_id: 5000, relationship_exp: 60 }, { gift_id: 5001, relationship_exp: 60 }, { gift_id: 5002, relationship_exp: 0 }, { gift_id: 5003, relationship_exp: 0 }] },
  ],
  studentById: new Map([
    ["2", { student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 20 }, { gift_id: 5002, relationship_exp: 20 }, { gift_id: 5003, relationship_exp: 20 }, { gift_id: 5004, relationship_exp: 60 }] }],
    ["3", { student_id: 3, gift_values: [{ gift_id: 5000, relationship_exp: 60 }, { gift_id: 5001, relationship_exp: 60 }, { gift_id: 5002, relationship_exp: 0 }, { gift_id: 5003, relationship_exp: 0 }] }],
  ]),
  giftById: new Map([["5000", { id: 5000, rarity: "SR" }], ["5001", { id: 5001, rarity: "SR" }], ["5002", { id: 5002, rarity: "SR" }], ["5003", { id: 5003, rarity: "SR" }]]),
  giftBoxes: [{ id: "100008", type: "choice", selectable_gift_ids: [5004] }],
};
const mixedMultiStudentSynthesisSummary = calculatePlanningSummary({
  state: {
    ...synthesisState,
    students: [
      { id: "student-2", studentId: 2, currentLevel: 1, currentProgress: 0, targetLevel: 2 },
      { id: "student-3", studentId: 3, currentLevel: 1, currentProgress: 0, targetLevel: 3 },
    ],
    mainTargetStudentId: 2,
    inventory: { 5000: 1, 5001: 1, 5002: 1, 5003: 1 },
  },
  data: mixedMultiStudentData,
  forecastDays: 10,
});
assert.equal(mixedMultiStudentSynthesisSummary.students.reduce((sum, item) => sum + item.currentExp, 0), 60, "main-target-first greedy allocation should preserve the main target's gifts before synthesis");

const nonPrefixSynthesisData = {
  ...mixedMultiStudentData,
  students: [
    { student_id: 1, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 0 }, { gift_id: 5002, relationship_exp: 40 }, { gift_id: 5003, relationship_exp: 0 }, { gift_id: 5004, relationship_exp: 20 }, { gift_id: 5005, relationship_exp: 0 }, { gift_id: 9000, relationship_exp: 60 }] },
    { student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 60 }, { gift_id: 5001, relationship_exp: 0 }, { gift_id: 5002, relationship_exp: 60 }, { gift_id: 5003, relationship_exp: 0 }, { gift_id: 5004, relationship_exp: 0 }, { gift_id: 5005, relationship_exp: 60 }] },
    { student_id: 3, gift_values: [{ gift_id: 5000, relationship_exp: 0 }, { gift_id: 5001, relationship_exp: 60 }, { gift_id: 5002, relationship_exp: 20 }, { gift_id: 5003, relationship_exp: 0 }, { gift_id: 5004, relationship_exp: 60 }, { gift_id: 5005, relationship_exp: 20 }] },
  ],
  studentById: new Map([
    ["1", { student_id: 1, gift_values: [{ gift_id: 5000, relationship_exp: 20 }, { gift_id: 5001, relationship_exp: 0 }, { gift_id: 5002, relationship_exp: 40 }, { gift_id: 5003, relationship_exp: 0 }, { gift_id: 5004, relationship_exp: 20 }, { gift_id: 5005, relationship_exp: 0 }, { gift_id: 9000, relationship_exp: 60 }] }],
    ["2", { student_id: 2, gift_values: [{ gift_id: 5000, relationship_exp: 60 }, { gift_id: 5001, relationship_exp: 0 }, { gift_id: 5002, relationship_exp: 60 }, { gift_id: 5003, relationship_exp: 0 }, { gift_id: 5004, relationship_exp: 0 }, { gift_id: 5005, relationship_exp: 60 }] }],
    ["3", { student_id: 3, gift_values: [{ gift_id: 5000, relationship_exp: 0 }, { gift_id: 5001, relationship_exp: 60 }, { gift_id: 5002, relationship_exp: 20 }, { gift_id: 5003, relationship_exp: 0 }, { gift_id: 5004, relationship_exp: 60 }, { gift_id: 5005, relationship_exp: 20 }] }],
  ]),
  giftById: new Map(["5000", "5001", "5002", "5003", "5004", "5005"].map((id) => [id, { id: Number(id), rarity: "SR" }])),
  giftBoxes: [{ id: "100008", type: "choice", selectable_gift_ids: [9000] }],
  snapshots: { thresholds: [{ level: 1, cumulative_exp_to_reach_level: 0 }, { level: 2, cumulative_exp_to_reach_level: 200 }] },
};
const nonPrefixSynthesisSummary = calculatePlanningSummary({
  state: {
    ...synthesisState,
    students: [
      { id: "student-1", studentId: 1, currentLevel: 1, currentProgress: 60, targetLevel: 2 },
      { id: "student-2", studentId: 2, currentLevel: 1, currentProgress: 80, targetLevel: 2 },
      { id: "student-3", studentId: 3, currentLevel: 1, currentProgress: 40, targetLevel: 2 },
    ],
    mainTargetStudentId: 1,
    inventory: { 5000: 1, 5001: 1, 5002: 1, 5003: 1, 5004: 1, 5005: 1 },
  },
  data: nonPrefixSynthesisData,
  forecastDays: 10,
});
assert.equal(nonPrefixSynthesisSummary.students.reduce((sum, item) => sum + item.currentExp, 0), 240, "main-target-first synthesis must preserve the configured priority order");
assert.deepEqual(nonPrefixSynthesisSummary.students[0].sourceBreakdown.current.synthesisConsumedGiftIds, ["5000", "5003"], "synthesis should reserve the pair with the best global outcome");

const manyGoldGifts = Object.fromEntries(Array.from({ length: 35 }, (_, index) => [String(5000 + index), 1]));
const manyGoldStudent = {
  student_id: 4,
  gift_values: Array.from({ length: 35 }, (_, index) => ({
    gift_id: 5000 + index,
    relationship_exp: index < 5 ? 60 : index < 15 ? 40 : 20,
  })),
};
const manyGoldData = {
  ...data,
  students: [manyGoldStudent],
  studentById: new Map([["4", manyGoldStudent]]),
  giftById: new Map(Array.from({ length: 35 }, (_, index) => [String(5000 + index), { id: 5000 + index, rarity: "SR" }])),
  giftBoxes: [{ id: "100008", type: "choice", selectable_gift_ids: [5000] }],
  releaseTimeline: [{ studentId: 4, jpRank: 1 }],
  snapshots: { thresholds: [{ level: 1, cumulative_exp_to_reach_level: 0 }, { level: 2, cumulative_exp_to_reach_level: 99999 }] },
};
const manyGoldSummary = calculatePlanningSummary({
  state: {
    ...synthesisState,
    students: [{ id: "student-4", studentId: 4, currentLevel: 1, currentProgress: 0, targetLevel: 2 }],
    mainTargetStudentId: 4,
    inventory: manyGoldGifts,
    stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 17 },
  },
  data: manyGoldData,
  forecastDays: 10,
});
assert.equal(manyGoldSummary.students[0].sourceBreakdown.current.synthesisCount, 10, "single-student synthesis must compare every feasible count instead of silently stopping at a candidate-pair cap");
assert.equal(manyGoldSummary.students[0].currentExp, 1300, "single-student synthesis should consume all ten low-value pairs before sacrificing higher-value gifts");

const largeMultiStudentGiftIds = Array.from({ length: 18 }, (_, index) => String(7000 + index));
const largeMultiStudentGifts = new Map(largeMultiStudentGiftIds.map((id) => [id, { id: Number(id), rarity: "SR" }]));
const largeMultiStudentData = {
  ...data,
  students: [1, 2, 3].map((student_id) => ({
    student_id,
    gift_values: largeMultiStudentGiftIds.map((gift_id) => ({
      gift_id: Number(gift_id),
      relationship_exp: 20 + ((student_id + Number(gift_id)) % 3) * 20,
    })),
  })),
  studentById: new Map([1, 2, 3].map((student_id) => [String(student_id), {
    student_id,
    gift_values: largeMultiStudentGiftIds.map((gift_id) => ({
      gift_id: Number(gift_id),
      relationship_exp: 20 + ((student_id + Number(gift_id)) % 3) * 20,
    })),
  }])),
  giftById: largeMultiStudentGifts,
  giftBoxes: [{ id: "100008", type: "choice", selectable_gift_ids: [7000] }],
  releaseTimeline: [1, 2, 3].map((studentId, index) => ({ studentId, jpRank: index + 1 })),
  snapshots: { thresholds: [{ level: 1, cumulative_exp_to_reach_level: 0 }, { level: 100, cumulative_exp_to_reach_level: 999999999 }] },
};
const largeMultiStudentStart = performance.now();
const largeMultiStudentSummary = calculatePlanningSummary({
  state: {
    ...synthesisState,
    students: [1, 2, 3].map((studentId) => ({ id: `student-${studentId}`, studentId, currentLevel: 1, currentProgress: 0, targetLevel: 100 })),
    mainTargetStudentId: 1,
    inventory: Object.fromEntries(largeMultiStudentGiftIds.map((giftId) => [giftId, 18])),
    stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 8 },
  },
  data: largeMultiStudentData,
  forecastDays: 60,
});
assert.ok(performance.now() - largeMultiStudentStart < 1000, "large multi-student synthesis planning must return within one second");
assert.equal(largeMultiStudentSummary.allocation.searchTruncated, true, "large synthesis searches must disclose that the allocation is approximate");
assert.ok(Number.isFinite(largeMultiStudentSummary.students[0].currentExp));

const packageIndependentState = { ...state, packagePlans: { p: { purchased: 99, planned: 99 } } };
const packageIndependentSummary = calculatePlanningSummary({ state: packageIndependentState, data, forecastDays: 10 });
assert.deepEqual(packageIndependentSummary.students, summary.students);

const secondStudent = {
  student_id: 2,
  gift_values: [{ gift_id: 5000, relationship_exp: 60 }],
};
const multiStudentForecastData = {
  ...data,
  students: [student, secondStudent],
  studentById: new Map([['1', student], ['2', secondStudent]]),
  releaseTimeline: [{ studentId: 1, jpRank: 1 }, { studentId: 2, jpRank: 2 }],
  snapshots: { thresholds: [{ level: 1, cumulative_exp_to_reach_level: 0 }, { level: 2, cumulative_exp_to_reach_level: 1000 }] },
};
const multiStudentForecastState = {
  ...state,
  students: [
    { id: 'student-1', studentId: 1, currentLevel: 1, currentProgress: 0, targetLevel: 2 },
    { id: 'student-2', studentId: 2, currentLevel: 1, currentProgress: 0, targetLevel: 2 },
  ],
  mainTargetStudentId: 1,
  cnProgress: { cutoffRank: 2 },
  inventory: {},
  giftBoxes: {},
  equivalentGiftPools: {},
  stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 0 },
  resources: [
    { id: 'daily-schedule-exp', cadence: 'daily', unit: 'relationship_exp', amount: 1, expected_per_count: 31.25 },
    { id: 'daily-cafe-exp', cadence: 'daily', unit: 'relationship_exp', amount: 1, expected_per_count: 15 },
  ],
};
const multiStudentForecastSummary = calculatePlanningSummary({ state: multiStudentForecastState, data: multiStudentForecastData, forecastDays: 60 });
assert.equal(multiStudentForecastSummary.students[0].estimatedDays, 22, 'the main target should consume the first part of the shared daily resource stream');
assert.equal(multiStudentForecastSummary.students[1].estimatedDays, 44, 'the second target should continue after the main target instead of becoming unestimable');
assert.ok(Number.isFinite(multiStudentForecastSummary.students[1].freeExpPerDay));

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

const dailyPeriodState = {
  ...state,
  inventory: {},
  giftBoxes: {},
  equivalentGiftPools: {},
  stockResources: {},
  resources: [
    { id: "daily-schedule-exp", cadence: "daily", unit: "relationship_exp", amount: 1, expected_per_count: 31.25 },
    { id: "daily-cafe-exp", cadence: "daily", unit: "relationship_exp", amount: 1, expected_per_count: 15 },
  ],
  resourcePostingHistory: [
    { id: "schedule-30", postingKey: "daily-schedule-exp:30", resourceId: "daily-schedule-exp", periodDays: 30, mapped: { stockResources: {}, giftBoxes: {}, equivalentGiftPools: {}, relationshipExp: { "daily-schedule-exp": 937.5 } }, active: true },
    { id: "schedule-60", postingKey: "daily-schedule-exp:60", resourceId: "daily-schedule-exp", periodDays: 60, mapped: { stockResources: {}, giftBoxes: {}, equivalentGiftPools: {}, relationshipExp: { "daily-schedule-exp": 1875 } }, active: true },
  ],
};
const dailyPeriodSummary = calculatePlanningSummary({ state: dailyPeriodState, data, forecastDays: 60 });
assert.equal(dailyPeriodSummary.students[0].sourceBreakdown.free.daily.scheduleExp, 1875, "a 60-day post must not include the old 30-day post");
const duplicateDailyPeriodState = {
  ...dailyPeriodState,
  resourcePostingHistory: [
    ...dailyPeriodState.resourcePostingHistory,
    { ...dailyPeriodState.resourcePostingHistory[1], id: "schedule-60-duplicate" },
  ],
};
const duplicateDailyPeriodSummary = calculatePlanningSummary({ state: duplicateDailyPeriodState, data, forecastDays: 60 });
assert.equal(duplicateDailyPeriodSummary.students[0].sourceBreakdown.free.daily.scheduleExp, 1875, "duplicate active posting keys must not double-count a periodic resource");

const packageRows = calculatePackageEfficiency({
  student,
  giftBoxes,
  packageCatalog: { asOf: "2026-08-12", packages: [{ id: "p", price_cny: 10, purchase_limit: 1, status: "active", contents: [{ kind: "student_favorite_gift", gift_color: "gold", quantity: 1 }] }] },
  manufacturingData: { relationship_exp_per_manufacturing_stone: 80 },
});
assert.equal(packageRows[0].expectedExp, 60, "student_favorite_gift must use the selected student's actual gold-gift reaction");
assert.equal(packageRows[0].expPerYuan, 6);
assert.equal(packageRows[0].availablePurchases, 1);
assert.equal(packageRows[0].goldGiftExp, 60);
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
