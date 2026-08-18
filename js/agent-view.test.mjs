import assert from "node:assert/strict";
import { renderAgentWorkspace } from "./agent-view.js";

const html = renderAgentWorkspace({
  locale: "zh_cn",
  state: { messages: [], proposal: null, configured: false, baseUrl: "", model: "", notice: "", busy: false },
  data: { localization: {} },
  context: { students: [{ studentId: 10000, names: { zh_cn: "爱露" } }], plannerState: { inventory: {}, students: [] }, calculatedResults: { giftPlanning: { projections: [] } }, disclosure: {} },
});

assert.doesNotMatch(html, /portrait\/10000\.webp/, "Agent must not show a student portrait without a planned target");
assert.match(html, /agent-connection-empty/, "Unconfigured Agent should have a focused connection entry state");
assert.doesNotMatch(html, /agent-connection-visual|agent-visual-anchors/, "Agent connection state should not use decorative collage art");
assert.doesNotMatch(html, /class="agent-chat"/, "Unconfigured Agent should not show a chat area before connection");
assert.doesNotMatch(html, /class="agent-quick"/, "Unconfigured Agent should not show quick questions before connection");
assert.match(html, /<details class="agent-settings-details" open>/, "First-time connection settings should be immediately available");
assert.match(html, /name="baseUrl"[^>]*value="https:\/\/api\.deepseek\.com"/, "Agent should prefill the official DeepSeek API endpoint");
assert.match(html, /name="model"[^>]*value="deepseek-v4-flash"/, "Agent should prefill the requested Flash model");

const configuredHtml = renderAgentWorkspace({
  locale: "zh_cn",
  state: { messages: [], proposal: null, configured: true, baseUrl: "https://api.example.com", model: "test-model", notice: "", busy: false },
  data: { localization: {} },
  context: { students: [{ studentId: 10000, names: { zh_cn: "爱露" } }], plannerState: { inventory: {}, students: [] }, calculatedResults: { giftPlanning: { projections: [] } }, disclosure: {} },
});
assert.doesNotMatch(configuredHtml, /agent-visual-anchors|momotalk\.png|arona-avatar-1\.png/);
assert.match(configuredHtml, /class="agent-chat"/);

console.log("agent view tests passed");
