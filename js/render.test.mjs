import assert from "node:assert/strict";
import { renderCraftingPath, renderNodeOptionRows } from "./render.js";

const stageModel = {
  id: "1",
  nodeExpectations: [1, 2, 3, 4, 5].map((nodeId, index) => ({
    node_id: nodeId,
    name_en: `Node ${nodeId}`,
    name_zh_cn: `节点 ${nodeId}`,
    probability: 0.2,
    expected_relationship_exp: 50 - index,
    no_positive_relationship_probability: 0.1,
  })),
};

const html = renderNodeOptionRows(stageModel, { entries: {} }, 5, "zh_cn", {}, new Map());

assert.equal(
  (html.match(/class="node-option-row"/g) ?? []).length,
  5,
  "每个阶段最多五个节点应全部渲染",
);
assert.doesNotMatch(html, /node-more-details/, "五个节点应直接展示，不应藏在更多节点折叠里");
assert.equal(
  (html.match(/class="icon-frame image-frame node-image/g) ?? []).length,
  5,
  "每个节点都应使用统一的图标容器",
);
assert.equal(
  (html.match(/期望好感/g) ?? []).length,
  5,
  "每个节点都应显示期望好感",
);

console.log("render view tests passed");

const stageMechanism = {
  optionCount: 5,
  stages: ["1", "2", "3"].map((id) => ({
    id,
    nodeCount: 5,
    nodeExpectations: stageModel.nodeExpectations,
    giftCapableNodes: [],
    expectedExp: 0,
    expectedGiftQuantity: 0,
    noPositiveProbability: 1,
    nodeDistribution: [],
  })),
};
const stageHtml = renderCraftingPath({}, stageMechanism, { entries: {} }, "zh_cn", {}, new Map());
assert.doesNotMatch(stageHtml, /stage-card-scene/, "阶段节点框不应再渲染场景图背景");
assert.equal((stageHtml.match(/class="stage-card-visual"/g) ?? []).length, 3, "三个阶段仍应保留节点展示区域");
