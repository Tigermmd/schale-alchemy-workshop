import assert from "node:assert/strict";
import { filterPlannerStudents, plannerStudentLabel, renderPlannerStudentOptions } from "./planner-view.js";
import { text } from "./i18n.js";

const students = [
  { student_id: 10122, name_zh_cn: "未花（泳装）", name_en: "Mika (Swimsuit)", name_ja: "ミカ（水着）" },
  { student_id: 10063, name_zh_cn: "小雪", name_en: "Koyuki", name_ja: "コユキ" },
];

assert.deepEqual(filterPlannerStudents(students, "mika", {}), [students[0]]);
assert.deepEqual(filterPlannerStudents(students, "コユキ", {}), [students[1]]);
assert.deepEqual(filterPlannerStudents(students, "10063", {}), [students[1]]);
assert.equal(plannerStudentLabel(students[0], "zh_cn", {}), "未花（泳装）");

const options = renderPlannerStudentOptions({ students, query: "mika", locale: "zh_cn", localization: {} });
assert.match(options, /data-planner-student-option="10122"/);
assert.match(options, /未花（泳装）/);
assert.doesNotMatch(options, /10063/);
const manyStudents = Array.from({ length: 30 }, (_, index) => ({ student_id: 11000 + index, name_zh_cn: `测试学生${index}`, name_en: `Test Student ${index}`, name_ja: `テスト${index}` }));
const allMatchingOptions = renderPlannerStudentOptions({ students: manyStudents, query: "test", locale: "zh_cn", localization: {} });
assert.equal((allMatchingOptions.match(/data-planner-student-option=/g) ?? []).length, 30, "Planner search must keep the full matching student set");
assert.notEqual(text("zh_cn", "giftOnlyChoiceBoxLabel"), "giftOnlyChoiceBoxLabel");
assert.notEqual(text("en", "giftOnlyChoiceBoxExplanation", "60.00"), "giftOnlyChoiceBoxExplanation");
assert.notEqual(text("ja", "giftOnlyChoiceBoxPool", 35), "giftOnlyChoiceBoxPool");

console.log("planner view tests passed");
