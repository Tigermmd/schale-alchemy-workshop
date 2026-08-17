import assert from "node:assert/strict";
import { boostedGiftGroups, boostedGiftValues, filterStudents, getCraftingMechanismSummary, giftValuesForFilter, readSelectedStudentId } from "./dashboard-state.js";
import { localizedName, normalizeLocale, readStoredLocale, text, writeStoredLocale } from "./i18n.js";
import { renderResourcesWorkspace } from "./resource-view.js";
import { formatExp, formatPercent, formatQuantity, formatSmartQuantity, probabilityOfNodeAppearing } from "./render.js";
import { createEmptyPlannerState, setGiftBoxCount, setResourceAmount } from "./planner-state.js";
import fs from "node:fs";

const students = [
  { student_id: 10000, name_zh_cn: "爱露", name_en: "Aru" },
  { student_id: 10001, name_zh_cn: "艾米", name_en: "Eimi" },
];

assert.deepEqual(filterStudents(students, "aru").map((student) => student.student_id), [10000]);
assert.equal(readSelectedStudentId("?student=10001", students), "10001");
assert.equal(readSelectedStudentId("?student=99999", students), "10000");

const giftFilterStudent = {
  preferred_gifts: [{ gift_id: 1, relationship_exp: 60 }],
  gift_values: [
    { gift_id: 1, relationship_exp: 60 },
    { gift_id: 2, relationship_exp: 240 },
    { gift_id: 3, relationship_exp: 20 },
  ],
};
assert.deepEqual(giftValuesForFilter(giftFilterStudent, "preferred").map((gift) => gift.gift_id), [1]);
assert.deepEqual(giftValuesForFilter(giftFilterStudent, "exp-240").map((gift) => gift.gift_id), [2]);
assert.deepEqual(giftValuesForFilter(giftFilterStudent, "all").map((gift) => gift.gift_id), [1, 2, 3]);

const boostedGiftStudent = {
  gift_values: [
    { gift_id: 1, relationship_exp: 20, reaction_grade: 1 },
    { gift_id: 2, relationship_exp: 120, reaction_grade: 2 },
    { gift_id: 3, relationship_exp: 40, reaction_grade: 2 },
    { gift_id: 4, relationship_exp: 240, reaction_grade: 4 },
    { gift_id: 5, relationship_exp: 60, reaction_grade: 3 },
    { gift_id: 6, relationship_exp: 80, reaction_grade: 3 },
    { gift_id: 7, relationship_exp: 180, reaction_grade: 4 },
  ],
};
assert.deepEqual(boostedGiftValues(boostedGiftStudent).map((gift) => gift.relationship_exp), [240, 180, 80, 60, 40]);
assert.ok(boostedGiftValues(boostedGiftStudent).every((gift) => ![20, 120].includes(gift.relationship_exp)));
assert.deepEqual(boostedGiftGroups(boostedGiftStudent).map((group) => group.reaction_grade), [4, 3, 2]);
assert.deepEqual(boostedGiftGroups(boostedGiftStudent).map((group) => group.gifts.map((gift) => gift.gift_id)), [[4, 7], [6, 5], [3]]);

const localization = { students: { "10063": "コユキ" }, gifts: { "5112": "天体望遠鏡" }, nodes: { "10": "花弁" } };
const localizedStudent = { student_id: 10063, name_en: "Koyuki", name_zh_cn: "小雪" };
assert.deepEqual(filterStudents([localizedStudent], "コユキ", localization).map((student) => student.student_id), [10063]);
assert.equal(normalizeLocale("ja"), "ja");
assert.equal(normalizeLocale("ko"), "zh_cn");
assert.equal(localizedName(localizedStudent, "student", "ja", localization), "コユキ");
assert.equal(localizedName(localizedStudent, "student", "en", localization), "Koyuki");
assert.equal(text("ja", "stage", 2), "ステージ 2");
assert.equal(text("en", "documentTitle"), "Schale Manufacturing");
assert.equal(text("ja", "documentTitle"), "Schale 製造ツール");
const fakeStorage = new Map();
const storageAdapter = { getItem: (key) => fakeStorage.get(key) ?? null, setItem: (key, value) => fakeStorage.set(key, value) };
assert.equal(writeStoredLocale(storageAdapter, "ja"), "ja");
assert.equal(readStoredLocale(storageAdapter), "ja");

const craftingSnapshot = {
  scope: { node_option_count: 5 },
  crafting_probability: {
    stage_totals: { "1": { node_count: 22 }, "2": { node_count: 55 }, "3": { node_count: 21 } },
    node_distributions: { "1": [{ id: 10, name_zh_cn: "花", probability: 0.5 }], "2": [], "3": [] },
    gift_capable_node_names_by_stage: { "1": [{ id: 10, name_zh_cn: "花" }], "2": [], "3": [] },
  },
};
const craftingStudent = {
  stage_node_count: { "1": 22, "2": 55, "3": 21 },
  stage_node_expectations: {
    "1": [{ node_id: 3, name_zh_cn: "光芒", expected_relationship_exp: 18.1234, no_positive_relationship_probability: 0.42 }],
    "2": [],
    "3": [],
  },
  stage_expected_relationship_exp: { "1": 14, "2": 13, "3": 49 },
  stage_expected_gift_quantity: { "1": 0.6, "2": 0.5, "3": 1.1 },
  stage_no_positive_relationship_probability: { "1": 0.2, "2": 0.24, "3": 0.01 },
};
const mechanism = getCraftingMechanismSummary(craftingSnapshot, craftingStudent);
assert.equal(mechanism.optionCount, 5);
assert.equal(mechanism.stages[1].nodeCount, 55);
assert.equal(mechanism.stages[0].giftCapableNodes[0].name_zh_cn, "花");
assert.equal(mechanism.stages[0].nodeExpectations[0].expected_relationship_exp, 18.1234);
assert.equal(mechanism.stages[0].nodeExpectations[0].no_positive_relationship_probability, 0.42);
assert.equal(formatExp(82.280927), "82.28");
assert.equal(formatQuantity(0.635173), "0.64");
assert.equal(formatQuantity(70), "70");
assert.equal(formatSmartQuantity(70), "70");
assert.equal(formatSmartQuantity(72.857142), "72.86");
assert.equal(formatPercent(0.225559), "22.56%");
assert.ok(Math.abs(probabilityOfNodeAppearing(0.1, 5) - 0.40951) < 1e-12);
assert.equal(probabilityOfNodeAppearing(0, 5), 0);
assert.equal(probabilityOfNodeAppearing(1, 5), 1);

const resourceHtml = renderResourcesWorkspace({
  state: createEmptyPlannerState(),
  locale: "zh_cn",
  evidence: {
    sources: [{ id: "lead", url: "https://example.com" }],
      rows: [
        { resource_id: "weekly-manufacturing-stones", status: "lead", candidate_value: 17, candidate_unit_zh_cn: "拱心石/周", source_id: "lead" },
      { resource_id: "monthly-total-assault-gift-boxes", status: "lead", candidate_value: null, candidate_text_zh_cn: "每次活动最多 2 个金色礼物自选", candidate_note_zh_cn: "每月活动次数仍待确认", official_scope_zh_cn: "官方未公开礼物逐档数量", source_id: "lead" },
    ],
  },
});
assert.match(resourceHtml, /未确认 · 不计入/);
assert.match(resourceHtml, /17 拱心石\/周/);
assert.match(resourceHtml, /每次活动最多 2 个金色礼物自选/);
assert.doesNotMatch(resourceHtml, /每月活动次数仍待确认/);
assert.match(resourceHtml, /官方/);
assert.match(resourceHtml, /<strong>0\.00<\/strong>/);

const defaultResourceHtml = renderResourcesWorkspace({
  state: createEmptyPlannerState(),
  locale: "zh_cn",
  evidence: {
    sources: [{ id: "lead", url: "https://example.com" }],
    rows: [{
      resource_id: "weekly-manufacturing-stones",
      status: "user_confirmed",
      candidate_value: 17,
      candidate_unit_zh_cn: "拱心石/周",
      candidate_text_zh_cn: "每日任务和每周任务",
      source_id: "lead",
    }],
  },
});
assert.match(defaultResourceHtml, /预填值/);
assert.match(defaultResourceHtml, /每日任务和每周任务/);
assert.match(defaultResourceHtml, /已确认/);

const eventShopResourceHtml = renderResourcesWorkspace({
  state: createEmptyPlannerState(),
  locale: "zh_cn",
  evidence: {
    sources: [{ id: "lead", url: "https://example.com" }],
    rows: [
      { resource_id: "monthly-event-shop-gold-gift-boxes", status: "lead", candidate_value: 80, candidate_unit_zh_cn: "个等效随机金色礼物/月", candidate_text_zh_cn: "实际为4种金礼物各10个，种类不固定；按100000随机池等效计算", source_id: "lead" },
      { resource_id: "monthly-event-shop-purple-gift-boxes", status: "lead", candidate_value: 4, candidate_unit_zh_cn: "个随机紫色礼物盒/月", source_id: "lead" },
    ],
  },
});
assert.match(eventShopResourceHtml, /活动商店金礼物/);
assert.match(eventShopResourceHtml, /活动商店紫礼物/);
assert.match(eventShopResourceHtml, /80 个等效随机金色礼物\/月/);
assert.match(eventShopResourceHtml, /实际为4种金礼物各10个/);
assert.match(eventShopResourceHtml, /4 个随机紫色礼物盒\/月/);

const unlimitedRewards = JSON.parse(fs.readFileSync(new URL("../../relationship_data/unlimited_assault_rewards_cn.json", import.meta.url), "utf8"));
const configuredResourceState = setResourceAmount(createEmptyPlannerState(), "monthly-unlimited-assault-gift-boxes", 99);
const configuredResourceHtml = renderResourcesWorkspace({
  data: { unlimitedAssaultRewards: unlimitedRewards, giftBoxes: [] },
  state: configuredResourceState,
  locale: "zh_cn",
  evidence: { sources: [], rows: [] },
});
assert.match(configuredResourceHtml, /选择通关层数/);
assert.match(configuredResourceHtml, /通关至 99 层/);
assert.match(configuredResourceHtml, /金色礼物自选 ×6/);
assert.match(configuredResourceHtml, /紫色礼物随机 ×3/);
assert.doesNotMatch(configuredResourceHtml, /每月制约解除决战礼物盒[\s\S]{0,500}未知/);

const touchCountState = setResourceAmount(setResourceAmount(createEmptyPlannerState(), "daily-schedule-exp", 7), "daily-cafe-exp", 8);
const touchCountHtml = renderResourcesWorkspace({
  data: { giftBoxes: [] },
  state: { ...touchCountState, periodDays: 30 },
  locale: "zh_cn",
  evidence: { sources: [], rows: [] },
});
assert.match(touchCountHtml, /每天次数/);
assert.match(touchCountHtml, /6,562\.50/);
assert.match(touchCountHtml, /3,600\.00/);
assert.doesNotMatch(touchCountHtml, /每日任务 \/ 日程好感[\s\S]{0,500}待补国服数据/);

const giftBoxHtml = renderResourcesWorkspace({
  data: {
    students: [],
    studentById: new Map(),
    giftBoxes: [{
      id: "100000",
      name_zh_cn: "礼物盒",
      name_en: "Gift Box",
      type: "random",
      status: "missing_probability",
      outcomes: [],
    }],
  },
  state: createEmptyPlannerState(),
  locale: "zh_cn",
  evidence: { sources: [], rows: [] },
});
assert.match(giftBoxHtml, /礼物盒好感期望/);
assert.match(giftBoxHtml, /国服概率待确认/);
const withGiftBox = setGiftBoxCount(createEmptyPlannerState(), "100000", 2);
assert.equal(withGiftBox.giftBoxes["100000"], 2);

const readyGiftBoxHtml = renderResourcesWorkspace({
  data: {
    students: [],
    studentById: new Map([["10063", { student_id: 10063, name_zh_cn: "小雪", gift_values: [{ gift_id: 5000, relationship_exp: 20 }] }]]),
    giftBoxes: [{
      id: "ready-box",
      name_zh_cn: "测试礼物盒",
      name_en: "Test Gift Box",
      type: "random",
      status: "ready",
      outcomes: [{ gift_id: 5000, probability: 1, quantity: 1 }],
    }],
  },
  state: {
    ...withGiftBox,
    students: [{ id: "plan-1", studentId: 10063 }],
    giftBoxes: { "ready-box": 2 },
  },
  locale: "zh_cn",
  evidence: { sources: [], rows: [] },
});
assert.match(readyGiftBoxHtml, /小雪/);
assert.match(readyGiftBoxHtml, /总期望好感：40\.00/);

const userConfirmedGiftBoxHtml = renderResourcesWorkspace({
  data: {
    students: [],
    studentById: new Map([['10063', { student_id: 10063, name_zh_cn: '小雪', gift_values: [{ gift_id: 5100, relationship_exp: 240 }] }]]),
    giftBoxes: [{
      id: '100009',
      name_zh_cn: '高级礼物盒',
      name_en: 'Advanced Gift Box',
      type: 'random',
      status: 'user_confirmed',
      pool_label_zh_cn: '全部可制造的金色礼物',
      outcomes: [{ gift_id: 5100, probability: 1, quantity: 1 }],
    }],
  },
  state: {
    ...withGiftBox,
    students: [{ id: 'plan-1', studentId: 10063 }],
    giftBoxes: { '100009': 1 },
  },
  locale: 'zh_cn',
  evidence: { sources: [], rows: [] },
});
assert.match(userConfirmedGiftBoxHtml, /按确认值等概率计算/);
assert.match(userConfirmedGiftBoxHtml, /总期望好感：240\.00/);

const manufacturingState = createEmptyPlannerState();
manufacturingState.periodDays = 7;
manufacturingState.students = [{ id: "plan-1", studentId: 10063 }];
manufacturingState.resources = manufacturingState.resources.map((resource) => resource.id === "weekly-manufacturing-stones"
  ? { ...resource, amount: 1 }
  : resource);
const manufacturingHtml = renderResourcesWorkspace({
  data: {
    studentById: new Map([["10063", { student_id: 10063, name_zh_cn: "小雪" }]]),
    craftingById: new Map([["10063", {
      relationship_exp_per_manufacturing_stone: 77.765157,
      stage_expected_relationship_exp: { "1": 12.34, "2": 23.45, "3": 41.98 },
    }]]),
    giftBoxes: [],
  },
  state: manufacturingState,
  locale: "zh_cn",
  evidence: { sources: [], rows: [] },
});
assert.match(manufacturingHtml, /制造石收益/);
assert.match(manufacturingHtml, /小雪/);
assert.match(manufacturingHtml, /77\.77/);
assert.match(manufacturingHtml, /12\.34 \/ 23\.45 \/ 41\.98/);
console.log("dashboard state tests passed");
