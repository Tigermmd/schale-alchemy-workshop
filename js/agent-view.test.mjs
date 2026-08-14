import assert from "node:assert/strict";
import { renderAgentWorkspace } from "./agent-view.js";

const html = renderAgentWorkspace({
  locale: "zh_cn",
  state: { messages: [], proposal: null, configured: false, baseUrl: "", model: "", notice: "", busy: false },
  data: { localization: {} },
  context: { students: [], plannerState: { inventory: {} }, calculatedResults: { giftPlanning: { projections: [] } }, disclosure: {} },
});

assert.match(html, /agent-visual-anchors/);
assert.match(html, /momotalk\.png/);
assert.match(html, /arona-avatar-1\.png/);
assert.doesNotMatch(html, /<details class="agent-settings-details" open>/, "Agent connection settings should stay collapsed until requested");

console.log("agent view tests passed");
