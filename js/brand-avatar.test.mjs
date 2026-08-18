import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BRAND_STUDENT_ID,
  normalizeBrandStudentId,
  readBrandStudentId,
  writeBrandStudentId,
} from "./dashboard-state.js";
import { renderBrandStudentOptions } from "./render.js";

const students = [
  { student_id: 10059, name_zh_cn: "未花", name_en: "Mika" },
  { student_id: 10122, name_zh_cn: "未花（泳装）", name_en: "Mika (Swimsuit)", future_only: true },
  { student_id: 10123, name_zh_cn: "圣娅", name_en: "Seia", future_only: true },
];

test("brand avatar defaults to original Mika and accepts any complete-catalog student", () => {
  assert.equal(DEFAULT_BRAND_STUDENT_ID, "10059");
  assert.equal(normalizeBrandStudentId("10123", students), "10123");
  assert.equal(normalizeBrandStudentId(10122, students), "10122");
});

test("brand avatar storage rejects invalid values and preserves valid values", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(readBrandStudentId(storage, students), DEFAULT_BRAND_STUDENT_ID);
  assert.equal(writeBrandStudentId(storage, "10122", students), "10122");
  assert.equal(readBrandStudentId(storage, students), "10122");
  values.set("schale-brand-student-id", "not-a-student");
  assert.equal(readBrandStudentId(storage, students), DEFAULT_BRAND_STUDENT_ID);
});

test("brand picker renders the complete catalog without exposing internal ids", () => {
  const html = renderBrandStudentOptions({
    students,
    selectedId: "10122",
    locale: "zh_cn",
    localization: {},
  });
  assert.equal((html.match(/data-brand-student-id=/g) ?? []).length, students.length);
  assert.match(html, /未花（泳装）/);
  assert.match(html, /圣娅/);
  assert.match(html, /data-brand-student-id="10122"[^>]*aria-pressed="true"/);
  assert.doesNotMatch(html, />#?10122</);
});
