import assert from "node:assert/strict";
import { filterPlannerStudents, plannerStudentLabel, renderPlannerStudentOptions, renderPlannerWorkspace, renderWorkbenchTabs } from "./planner-view.js";
import { text } from "./i18n.js";
import { createEmptyPlannerState } from "./planner-state.js";

const students = [
  { student_id: 10122, name_zh_cn: "未花（泳装）", name_en: "Mika (Swimsuit)", name_ja: "ミカ（水着）" },
  { student_id: 10063, name_zh_cn: "小雪", name_en: "Koyuki", name_ja: "コユキ" },
];

assert.deepEqual(filterPlannerStudents(students, "mika", {}), [students[0]]);
assert.deepEqual(filterPlannerStudents(students, "コユキ", {}), [students[1]]);
assert.deepEqual(filterPlannerStudents(students, "10063", {}), [students[1]]);
assert.equal(plannerStudentLabel(students[0], "zh_cn", {}), "未花（泳装）");
const workbenchTabs = renderWorkbenchTabs({ locale: "zh_cn", active: "agent" });
assert.match(workbenchTabs, /aria-label="工作区导航"/);
assert.equal((workbenchTabs.match(/class="workbench-tab-icon"/g) ?? []).length, 6, "Every workspace tab should have one unified vector icon");
assert.equal((workbenchTabs.match(/<img /g) ?? []).length, 0, "Navigation must not use cropped content artwork as icons");
assert.match(workbenchTabs, /data-workbench="packages"[\s\S]*礼包性价比/);

const options = renderPlannerStudentOptions({ students, query: "mika", locale: "zh_cn", localization: {} });
assert.match(options, /data-planner-student-option="10122"/);
assert.match(options, /未花（泳装）/);
assert.doesNotMatch(options, /10063/);
const manyStudents = Array.from({ length: 30 }, (_, index) => ({ student_id: 11000 + index, name_zh_cn: `测试学生${index}`, name_en: `Test Student ${index}`, name_ja: `テスト${index}` }));
const allMatchingOptions = renderPlannerStudentOptions({ students: manyStudents, query: "test", locale: "zh_cn", localization: {} });
assert.equal((allMatchingOptions.match(/data-planner-student-option=/g) ?? []).length, 30, "Planner search must keep the full matching student set");
assert.notEqual(text("zh_cn", "planningCurrentGap"), "planningCurrentGap");
assert.notEqual(text("zh_cn", "planningNonMainNote"), "planningNonMainNote");

const emptyPlannerHtml = renderPlannerWorkspace({
  data: {
    snapshots: { thresholds: [] },
    studentById: new Map(),
    plannerStudents: [],
    students: [],
    gifts: [],
    giftById: new Map(),
    releaseTimeline: [],
  },
  state: {
    students: [],
    mainTargetStudentId: null,
    forecastDays: 60,
    inventory: {},
    giftReservations: {},
    giftBoxes: {},
    stockResources: {},
    incomingResources: {},
    equivalentGiftPools: {},
  },
  locale: "zh_cn",
  localization: {},
});
assert.match(emptyPlannerHtml, /class="planner-empty-copy"/, "Empty planner state should separate copy from its action");
assert.match(emptyPlannerHtml, /data-planner-open-form/, "Empty planner state should keep one clear add-goal action");

const iconPlannerStudent = { student_id: 10122, name_zh_cn: "未花（泳装）", name_en: "Mika (Swimsuit)", name_ja: "ミカ（水着）" };
const iconPlannerState = createEmptyPlannerState();
iconPlannerState.students = [{ id: "plan-10122", studentId: 10122, currentLevel: 1, currentProgress: 0, targetLevel: 50 }];
iconPlannerState.mainTargetStudentId = 10122;
const iconPlannerHtml = renderPlannerWorkspace({
  data: {
    snapshots: { thresholds: [] },
    studentById: new Map([["10122", iconPlannerStudent]]),
    plannerStudents: [iconPlannerStudent],
    students: [iconPlannerStudent],
    gifts: [],
    giftById: new Map(),
    giftBoxes: [],
    craftingById: new Map(),
    releaseTimeline: [],
  },
  state: iconPlannerState,
  locale: "zh_cn",
  localization: {},
});
assert.match(iconPlannerHtml, /class="planner-student-photo icon-frame"/, "Planner student portraits must use the shared icon frame");

console.log("planner view tests passed");
