import assert from "node:assert/strict";
import { applyPlanningProposal, buildAgentContext, canReuseConfiguredProxy, extractConversationFacts, validatePlanningProposal } from "./agent-state.js";
import { buildReleaseTimeline, calculateRelationshipSourceForecast, getStudentReleaseStatus, normalizeCnProgress } from "./release-state.js";
import { createEmptyPlannerState } from "./planner-state.js";
import { getGiftOnlyPlanningStudents } from "./planner-view.js";
import { getCnGiftPackageCatalog, getEligibleGiftPackages } from "./package-catalog.js";

const students = [
  { student_id: 10001, name_zh_cn: "甲", name_en: "A", default_order: 0 },
  { student_id: 10002, name_zh_cn: "乙", name_en: "B", default_order: 1 },
  { student_id: 10122, name_zh_cn: "未花（泳装）", name_en: "Mika (Swimsuit)", default_order: 230, future_only: true },
];
const timeline = buildReleaseTimeline(students);
const progress = normalizeCnProgress({ cutoffStudentId: 10002 }, timeline, students);
assert.equal(progress.cutoffRank, 2);
assert.equal(getStudentReleaseStatus(10001, progress, timeline).status, "released");
assert.equal(getStudentReleaseStatus(10122, progress, timeline).status, "unreleased");
assert.equal(getStudentReleaseStatus(99999, progress, timeline).status, "unknown");

const data = {
  students,
  plannerStudents: students,
  studentById: new Map(students.map((student) => [String(student.student_id), student])),
  releaseTimeline: timeline,
  snapshots: { packages: { packages: [{ id: "p-1", price_cny: 10, purchase_limit: 1, status: "active", contents: [] }] } },
  gifts: [{ id: 5000, name_zh_cn: "礼物", base_exp: 20 }],
};
const catalog = getCnGiftPackageCatalog({ scope: { server: "cn", as_of: "2026-08-12" }, packages: [
  { id: "current", status: "active", contents: [] },
  { id: "launch", status: "active", availability_phase: "student_launch", gift_binding: { type: "student_specific_favorites", target_student_ids: [10122] }, contents: [] },
  { id: "template", status: "template", contents: [] },
] });
assert.equal(catalog.packages.find((item) => item.id === "launch").availability, "student_launch");
assert.deepEqual(getEligibleGiftPackages({ catalog, studentId: 10122 }).map((item) => item.id), ["current", "launch"]);
assert.deepEqual(getEligibleGiftPackages({ catalog, studentId: 10001, includeStudentLaunchPackages: false }).map((item) => item.id), ["current"]);
const state = { ...createEmptyPlannerState(), cnProgress: progress };
assert.equal(canReuseConfiguredProxy({ configured: true, configuredBaseUrl: "https://api.example.com", configuredModel: "deepseek-v4-flash", baseUrl: "https://api.example.com", model: "deepseek-v4-flash" }), true);
assert.equal(canReuseConfiguredProxy({ configured: true, configuredBaseUrl: "https://api.example.com", configuredModel: "deepseek-v4-flash", baseUrl: "https://other.example.com", model: "deepseek-v4-flash" }), false);
assert.equal(canReuseConfiguredProxy({ configured: true, configuredBaseUrl: "https://api.example.com", configuredModel: "deepseek-v4-flash", baseUrl: "https://api.example.com", model: "other-model" }), false);
const plannedState = { ...state, students: [
  { id: "student-10122", studentId: 10122, currentLevel: 1, currentProgress: 0, targetLevel: 100 },
  { id: "student-10001", studentId: 10001, currentLevel: 1, currentProgress: 0, targetLevel: 100 },
] };
assert.deepEqual(getGiftOnlyPlanningStudents({ data, state: plannedState }).map(({ student }) => student.student_id), [10122]);
const sourceForecast = calculateRelationshipSourceForecast({ state: { resources: [
  { id: "daily-schedule-exp", cadence: "daily", amount: 7, expected_per_count: 31.25 },
  { id: "daily-cafe-exp", cadence: "daily", amount: 8, expected_per_count: 15 },
] }, studentId: 10122, cnProgress: progress, timeline, periodDays: 60 });
assert.equal(sourceForecast.totalExp, 0);
assert.equal(calculateRelationshipSourceForecast({ state: { resources: [
  { id: "daily-schedule-exp", cadence: "daily", amount: 7, expected_per_count: 31.25 },
  { id: "daily-cafe-exp", cadence: "daily", amount: 8, expected_per_count: 15 },
] }, studentId: 10001, cnProgress: progress, timeline, periodDays: 60 }).totalExp, 20325);
const context = buildAgentContext(state, { gap: 123.456 }, data);
assert.equal(context.students.find((student) => student.studentId === 10122).release.giftOnly, true);
assert.equal(context.students.find((student) => student.studentId === 10122).release.includeCafe, false);
assert.equal(context.calculatedResults.gap, 123.456);
assert.ok(Array.isArray(context.dataQuality.missingUserInputs));
assert.equal(context.schemaVersion, 2);
assert.equal(context.disclosure.mode, "progressive");
assert.ok(Array.isArray(context.calculationTools));
assert.ok(context.calculationTools.some((tool) => tool.id === "calculate_student_plan"));
assert.ok(Array.isArray(context.calculatedResults.giftPlanning.packageEfficiency.students));

const conversationFacts = extractConversationFacts([
  { role: "user", content: "你就按照mika原皮，60级0经验算，计入每日摸头一次，日程一次" },
]);
assert.deepEqual(conversationFacts, {
  currentLevel: 60,
  currentProgress: 0,
  dailyCafeCount: 1,
  dailyScheduleCount: 1,
  forecastDays: null,
  targetLevel: null,
  studentHints: ["mika原皮"],
});

const releasedState = { ...createEmptyPlannerState(), cnProgress: progress, students: [
  { id: "student-10001", studentId: 10001, currentLevel: 1, currentProgress: 0, targetLevel: 100 },
] };

const giftOnlyContext = buildAgentContext(
  { ...state, students: [{ id: "student-10122", studentId: 10122, currentLevel: 1, currentProgress: 0, targetLevel: 100 }] },
  {},
  data,
  { message: "未来两个月只按礼物规划", conversation: [{ role: "user", content: "未来两个月只按礼物规划" }] },
);
assert.deepEqual(giftOnlyContext.dataQuality.relevantMissingUserInputs.map((item) => item.id), []);
assert.equal(giftOnlyContext.confirmedFacts.plannedStudents[0].release.status, "unreleased");
assert.equal(giftOnlyContext.confirmedFacts.plannedStudents[0].relationshipSources.included, false);
assert.ok(giftOnlyContext.calculatedResults.giftPlanning.projections[0].projection);

const releasedGiftOnlyContext = buildAgentContext(
  releasedState,
  {},
  data,
  { message: "只按当前礼物库存计算，不计入日程和咖啡厅", conversation: [] },
);
assert.deepEqual(releasedGiftOnlyContext.dataQuality.relevantMissingUserInputs.map((item) => item.id), []);

const releasedFullContext = buildAgentContext(
  releasedState,
  {},
  data,
  { message: "把日程和咖啡厅摸头也计入未来两个月", conversation: [] },
);
assert.deepEqual(releasedFullContext.dataQuality.relevantMissingUserInputs.map((item) => item.id), [
  "daily-schedule-count",
  "daily-cafe-count",
]);

const releasedContext = buildAgentContext(releasedState, {}, data);
assert.deepEqual(releasedContext.dataQuality.missingUserInputs.map((item) => item.id), [
  "daily-schedule-count",
  "daily-cafe-count",
]);

const directRequestContext = buildAgentContext(
  { ...createEmptyPlannerState(), cnProgress: progress },
  {},
  data,
  { message: "把甲从60级提升到100级，并计入日程和咖啡厅摸头", conversation: [] },
);
assert.deepEqual(directRequestContext.dataQuality.relevantMissingUserInputs.map((item) => item.id), [
  "daily-schedule-count",
  "daily-cafe-count",
]);
assert.equal(directRequestContext.confirmedFacts.plannedStudents.length, 1);
assert.equal(directRequestContext.confirmedFacts.plannedStudents[0].studentId, 10001);
assert.equal(directRequestContext.confirmedFacts.plannedStudents[0].plan.currentLevel, 60);
assert.equal(directRequestContext.confirmedFacts.plannedStudents[0].plan.targetLevel, 100);

const proposal = { type: "planning_proposal", summary: "目标", changes: [
  { kind: "set_student_target", studentId: 10122, targetLevel: 100 },
  { kind: "set_forecast_days", value: 60 },
  { kind: "set_package_plan", packageId: "p-1", planned: 2 },
] };
assert.equal(validatePlanningProposal(proposal, { state, data }).ok, true);
const applied = applyPlanningProposal(state, proposal, { data });
assert.equal(applied.ok, true);
assert.equal(applied.state.students[0].studentId, 10122);
assert.equal(applied.state.students[0].targetLevel, 100);
assert.equal(applied.state.packagePlans["p-1"].planned, 2);
assert.equal(applied.state.inventory["5000"], undefined);
assert.equal(validatePlanningProposal({ ...proposal, changes: [{ kind: "set_inventory", giftId: 5000, count: 999 }] }, { state, data }).ok, false);
assert.equal(validatePlanningProposal({ ...proposal, changes: [{ kind: "set_forecast_days", value: 60, inventory: {} }] }, { state, data }).ok, false);

console.log("agent state tests passed");
