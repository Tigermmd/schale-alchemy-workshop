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
  evidence: { rows: [], sources: [] },
});

assert.match(html, /免费资源账本/);
assert.match(html, /制造启动石/);
assert.match(html, /aria-label="制造启动石 · 数量"/);
assert.doesNotMatch(html, /每周制造启动石/);
assert.match(html, />70</);
assert.doesNotMatch(html, /70\.00/);
assert.match(html, />3</);
assert.doesNotMatch(html, /3\.00/);
assert.match(html, /待填写/);
assert.match(html, /日程：每天摸头次数/);
assert.match(html, /咖啡厅：每天摸头次数/);
assert.match(html, /resource-art-strip/);
assert.match(html, /kivo-favor\.webp/);
assert.match(html, /schaledb-gdd-logo\.png/);

console.log("resource view tests passed");
