import assert from "node:assert/strict";
import { renderResourcesWorkspace } from "./resource-view.js";

const html = renderResourcesWorkspace({
  data: {
    giftBoxes: [],
    unlimitedAssaultRewards: null,
    assetManifest: { entries: {
      "ui:kivo-home-button": { local: "./assets/ui/kivo-home-button.webp" },
      "ui:kivo-favor": { local: "./assets/ui/kivo-favor.webp" },
      "ui:kivo-options": { local: "./assets/ui/kivo-options.webp" },
      "ui:schaledb-gdd-logo": { local: "./assets/ui/schaledb-gdd-logo.png" },
    } },
  },
  state: {
    periodDays: 30,
    forecastDays: 30,
    students: [],
    giftBoxes: {},
    resources: [{ id: "weekly-manufacturing-stones", cadence: "weekly", unit: "manufacturing_stone", amount: 17 }, {
      id: "monthly-synthesis-stones",
      cadence: "monthly",
      unit: "synthesis_stone_gold",
      amount: 70,
    }, {
      id: "monthly-total-assault-gift-boxes",
      cadence: "monthly",
      unit: "gift_box",
      gift_box_id: "100008",
      amount: 3,
    }, {
      id: "daily-schedule-exp",
      cadence: "daily",
      unit: "relationship_exp",
      input_kind: "daily_count",
      amount: null,
      expected_per_count: 31.25,
    }, {
      id: "daily-cafe-exp",
      cadence: "daily",
      unit: "relationship_exp",
      input_kind: "daily_count",
      amount: null,
      expected_per_count: 15,
    }],
  },
  locale: "zh",
  evidence: {
    rows: [{
      resource_id: "monthly-total-assault-gift-boxes",
      status: "user_confirmed",
      candidate_value: 3,
      candidate_unit_zh_cn: "个/月",
      candidate_text_zh_cn: "每月约 3 个金色礼物自选盒（100008）。",
      candidate_note_zh_cn: "随机盒 100000 与紫色随机盒 100009 不应在普通界面展示。",
      official_source_ids: [],
    }],
    sources: [],
  },
});

assert.match(html, /免费资源/);
assert.match(html, /制造启动石/);
assert.match(html, /aria-label="制造启动石 · 数量"/);
assert.doesNotMatch(html, /每周制造启动石/);
assert.match(html, />70</);
assert.doesNotMatch(html, /70\.00/);
assert.match(html, />3</);
assert.doesNotMatch(html, /3\.00/);
assert.match(html, /待填写/);
assert.match(html, /日程：每天次数/);
assert.match(html, /咖啡厅：每天次数/);
assert.doesNotMatch(html, /随机盒 100000 与紫色随机盒 100009/);
assert.doesNotMatch(html, /resource-art-strip/);
assert.doesNotMatch(html, /schaledb-gdd-logo\.png|kivo-logo/);
assert.match(html, /resource-toolbar/);
assert.doesNotMatch(html, /100000|100008|100009/);

const customFloorHtml = renderResourcesWorkspace({
  data: { giftBoxes: [], unlimitedAssaultRewards: null },
  state: {
    periodDays: 30,
    forecastDays: 30,
    students: [],
    giftBoxes: {},
    resources: [{
      id: "monthly-unlimited-assault-gift-boxes",
      cadence: "monthly",
      unit: "gift_box",
      input_kind: "floor",
      amount: 107,
      floor_mode: "custom",
      floor_options: [24, 49, 74, 99, 106, 124],
      max_floor: 124,
    }],
  },
  locale: "zh",
  evidence: { sources: [], rows: [] },
});
assert.match(customFloorHtml, /<option value="custom" selected>/, "custom floor mode must keep the custom option selected after rerender");
assert.match(customFloorHtml, /data-resource-amount="monthly-unlimited-assault-gift-boxes" value="107"/, "custom floor input must remain visible with the entered value");

console.log("resource view tests passed");
