import assert from "node:assert/strict";
import { catalogPackageDraft, renderPackagesWorkspace } from "./package-view.js";

const catalogPackage = {
  id: "cn-monthly-gifts-78",
  name_zh_cn: "每月礼物礼包",
  name_en: "Monthly Gift Package",
  name_ja: "毎月贈り物パック",
  price_cny: 78,
  purchase_limit: 1,
  status: "permanent",
  contents: [
    { name_zh_cn: "礼物盒", name_en: "Gift Box", quantity: 10 },
  ],
  source: "https://example.com/official",
};

const draft = catalogPackageDraft(catalogPackage, "zh_cn");
assert.deepEqual(draft, {
  name: "每月礼物礼包",
  price: 78,
  limit: 1,
  contents: "礼物盒 ×10",
});

const html = renderPackagesWorkspace({
  state: {
    students: [{ id: "student-1", studentId: 1, currentLevel: 1, currentProgress: 0, targetLevel: 2 }],
    mainTargetStudentId: 1,
    packagePlans: {},
    forecastDays: 60,
  },
  locale: "zh_cn",
  data: { packageCatalog: { scope: { as_of: "2026-08-10" }, packages: [catalogPackage] }, studentById: new Map([["1", { student_id: 1, name_zh_cn: "甲", name_en: "A", gift_values: [] }]]), giftBoxes: [], assetManifest: { entries: { "ui:arona-title-new": { local: "./assets/ui/arona-title-new.webp" }, "ui:kivo-options": { local: "./assets/ui/kivo-options.webp" } } } },
});
assert.match(html, /礼包性价比/);
assert.match(html, /好感 \/ 元/);
assert.match(html, /¥78/);
assert.doesNotMatch(html, /甲 · #1/);
assert.match(html, /data-package-target-student/);
assert.match(html, /package-visual-anchors/);
assert.match(html, /arona-title-new\.webp/);

const noTargetHtml = renderPackagesWorkspace({
  state: { students: [], mainTargetStudentId: null, packagePlans: {}, forecastDays: 60 },
  locale: "zh_cn",
  data: { packageCatalog: { scope: { as_of: "2026-08-10" }, packages: [catalogPackage] }, studentById: new Map([["1", { student_id: 1, name_zh_cn: "甲", name_en: "A", gift_values: [] }]]), giftBoxes: [] },
});
assert.match(noTargetHtml, /请先在礼物规划中加入学生目标/);
assert.match(noTargetHtml, /data-go-planner/);
assert.doesNotMatch(noTargetHtml, /¥78\.00/);

const japaneseHtml = renderPackagesWorkspace({
  state: { students: [{ id: "student-1", studentId: 1, currentLevel: 1, currentProgress: 0, targetLevel: 2 }], mainTargetStudentId: 1 },
  locale: "ja",
  data: { packageCatalog: {
    scope: { as_of: "2026-08-10" },
    packages: [{
      ...catalogPackage,
      contents: [{
        kind: "student_favorite_gift",
        name_zh_cn: "指定学生的最喜欢金礼物",
        name_en: "Target student's favorite gold gift",
        name_ja: "指定生徒の最も好きな金色の贈り物",
        quantity: 10,
      }],
    }],
  }, studentById: new Map([["1", { student_id: 1, name_ja: "甲", gift_values: [] }]]), giftBoxes: [] },
});
assert.match(japaneseHtml, /指定生徒の最も好きな金色の贈り物/);
assert.match(japaneseHtml, /毎月贈り物パック/);
assert.doesNotMatch(japaneseHtml, /每月礼物礼包/);

const expiredHtml = renderPackagesWorkspace({
  state: { packages: [], packagePlans: {}, forecastDays: 60 },
  locale: "zh_cn",
  data: { packageCatalog: { scope: { as_of: "2026-08-10" }, packages: [{ ...catalogPackage, status: "expired" }] }, studentById: new Map([["1", { student_id: 1, name_zh_cn: "甲", gift_values: [] }]]), giftBoxes: [] },
});
assert.doesNotMatch(expiredHtml, /每月礼物礼包/);

const templateHtml = renderPackagesWorkspace({
  state: { packages: [], packagePlans: {}, forecastDays: 60 },
  locale: "zh_cn",
  data: { packageCatalog: {
    scope: { as_of: "2026-08-10" },
    packages: [{
      ...catalogPackage,
      id: "cn-limited-fes-student-favorite-98-template",
      name_zh_cn: "限定/FES学生专属礼物礼包（模板）",
      status: "template",
      gift_binding: {
        type: "student_specific_favorites",
        repeat_rule: "one_per_limited_or_fes_student",
        note_zh_cn: "每次上线限定/FES学生时各预留一份",
      },
      source: null,
    }],
  }, studentById: new Map([["1", { student_id: 1, name_zh_cn: "甲", gift_values: [] }]]), giftBoxes: [] },
});
assert.doesNotMatch(templateHtml, /规划模板/);
assert.doesNotMatch(templateHtml, /每次上线限定\/FES学生时各预留一份/);
console.log("package view tests passed");
