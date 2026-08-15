import assert from "node:assert/strict";
import { firstTargetStudent, mappedPreview, renderInventoryWorkspace, renderPeriodicResources } from "./inventory-view.js";

const boxPreview = mappedPreview({
  stockResources: {},
  giftBoxes: { "100008": 3, "100009": 1.5 },
  equivalentGiftPools: { "random-gold": 80 },
  relationshipExp: {},
}, "zh");
assert.match(boxPreview, /\+3 金色礼物自选盒/);
assert.match(boxPreview, /\+1\.50 紫色礼物随机盒/);
assert.match(boxPreview, /\+80 金色随机礼物池（等效）/);
assert.doesNotMatch(boxPreview, /100008|100009/);

const targetData = {
  studentById: new Map([["1", { student_id: 1 }], ["2", { student_id: 2 }]]),
};
assert.equal(firstTargetStudent(targetData, { mainTargetStudentId: 2, students: [{ studentId: 1 }, { studentId: 2 }] }).student_id, 2);

const periodicHtml = renderPeriodicResources({
  data: { unlimitedAssaultRewards: null },
  state: {
    periodDays: 30,
    resources: [{
      id: "weekly-manufacturing-stones",
      cadence: "weekly",
      unit: "manufacturing_stone",
      amount: 17,
    }, {
      id: "monthly-total-assault-gift-boxes",
      cadence: "monthly",
      unit: "gift_box",
      gift_box_id: "100008",
      amount: 3,
    }],
    resourcePostingHistory: [],
  },
  locale: "zh",
});
assert.match(periodicHtml, /本期预计入库/);
assert.match(periodicHtml, /\+72\.86 制造启动石/);
assert.match(periodicHtml, /\+3 金色礼物自选盒/);
assert.doesNotMatch(periodicHtml, /输入数值/);
assert.doesNotMatch(periodicHtml, /礼物盒 100008/);

const reservationHtml = renderInventoryWorkspace({
  data: {
    gifts: [{ id: 5000, name_zh_cn: "测试礼物", name_en: "Test Gift", rarity: "SSR", base_exp: 60 }],
    giftById: new Map([["5000", { id: 5000, name_zh_cn: "测试礼物", name_en: "Test Gift", rarity: "SSR", base_exp: 60 }]]),
    giftBoxes: [],
  },
  state: {
    periodDays: 30,
    students: [],
    giftBoxes: {},
    resources: [],
    inventory: { "5000": 2 },
    giftReservations: { "5000": 1 },
    stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 0, gold_manufacturing_stone: 0 },
    incomingResources: { stockResources: {}, giftBoxes: {}, equivalentGiftPools: {}, relationshipExp: {} },
    equivalentGiftPools: {},
    resourcePostingHistory: [],
  },
  locale: "zh_cn",
  filters: { query: "", rarity: "all", exp: "all", onlyOwned: true },
  evidence: { rows: [], sources: [] },
});
assert.match(reservationHtml, /测试礼物 ×1/);
assert.doesNotMatch(reservationHtml, /礼物 5000/);

const emptyInventoryHtml = renderInventoryWorkspace({
  data: {
    gifts: [{ id: 5000, name_zh_cn: "测试礼物", name_en: "Test Gift", rarity: "SSR", base_exp: 60 }],
    giftById: new Map([["5000", { id: 5000, name_zh_cn: "测试礼物", name_en: "Test Gift", rarity: "SSR", base_exp: 60 }]]),
    giftBoxes: [],
  },
  state: {
    periodDays: 30,
    students: [],
    giftBoxes: {},
    resources: [],
    inventory: {},
    giftReservations: {},
    stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 0, gold_manufacturing_stone: 0 },
    incomingResources: { stockResources: {}, giftBoxes: {}, equivalentGiftPools: {}, relationshipExp: {} },
    equivalentGiftPools: {},
    resourcePostingHistory: [],
  },
  locale: "zh_cn",
  filters: { query: "", rarity: "all", exp: "all", onlyOwned: true },
  evidence: { rows: [], sources: [] },
});
const emptyHero = emptyInventoryHtml.match(/<div class="inventory-hero-gifts">([\s\S]*?)<\/div>/)?.[1] ?? "";
assert.doesNotMatch(emptyHero, /gifts\/5000\.webp/, "An empty inventory must not look like it owns a specific gift");
assert.match(emptyInventoryHtml, /data-inventory-filter="onlyOwned"(?![^>]*checked)/, "An empty inventory must expose all gifts by default");
assert.match(emptyInventoryHtml, /金色礼物自选盒/);
assert.match(emptyInventoryHtml, /紫色礼物随机盒/);
assert.match(emptyInventoryHtml, /金色随机礼物池（等效）/);
assert.match(emptyInventoryHtml, /inventory-transfer-primary/);

const expandedEmptyInventoryHtml = renderInventoryWorkspace({
  data: {
    gifts: [{ id: 5000, name_zh_cn: "测试礼物", name_en: "Test Gift", rarity: "SSR", base_exp: 60 }],
    giftById: new Map([["5000", { id: 5000, name_zh_cn: "测试礼物", name_en: "Test Gift", rarity: "SSR", base_exp: 60 }]]),
    giftBoxes: [],
  },
  state: {
    periodDays: 30,
    students: [],
    giftBoxes: {},
    resources: [],
    inventory: {},
    giftReservations: {},
    stockResources: { manufacturing_stone: 0, synthesis_stone_gold: 0, gold_manufacturing_stone: 0 },
    incomingResources: { stockResources: {}, giftBoxes: {}, equivalentGiftPools: {}, relationshipExp: {} },
    equivalentGiftPools: {},
    resourcePostingHistory: [],
  },
  locale: "zh_cn",
  filters: { query: "", rarity: "all", exp: "all", onlyOwned: false },
});
assert.doesNotMatch(expandedEmptyInventoryHtml, /礼物数据已经加载/);
assert.doesNotMatch(expandedEmptyInventoryHtml, /data-inventory-show-all/);

console.log("inventory view tests passed");
