import assert from "node:assert/strict";
import { renderAgentWorkspace } from "./agent-view.js";

const html = renderAgentWorkspace({
  locale: "zh_cn",
  state: { messages: [], proposal: null, configured: false, baseUrl: "", model: "", notice: "", busy: false },
  data: { localization: {} },
  context: { students: [{ studentId: 10000, names: { zh_cn: "爱露" } }], plannerState: { inventory: {}, students: [] }, calculatedResults: { giftPlanning: { projections: [] } }, disclosure: {} },
});

assert.doesNotMatch(html, /portrait\/10000\.webp/, "Agent must not show a student portrait without a planned target");
assert.doesNotMatch(html, /agent-connection-empty/, "Unconfigured Agent should stay inside the chat workspace");
assert.doesNotMatch(html, /agent-connection-visual|agent-visual-anchors/, "Agent connection state should not use decorative collage art");
assert.match(html, /class="agent-chat"/, "Unconfigured Agent should still show the chat area");
assert.match(html, /class="agent-chat-header"/, "Agent should present one compact chat identity header");
assert.match(html, /class="agent-composer(?:\s|\")/, "Agent should always show the chat composer");
assert.doesNotMatch(html, /class="agent-workspace panel"/, "Agent should not wrap the chat in another dashboard card");
assert.match(html, /agent-empty-unconfigured/, "Unconfigured Agent should explain how to connect inside the chat");
assert.match(html, /data-agent-open-settings/, "Unconfigured Agent should offer a direct settings action");
assert.doesNotMatch(html, /class="agent-quick"/, "Unconfigured Agent should not show unusable starter questions");
assert.doesNotMatch(html, /agent-plan-summary-empty/, "Empty planning status should not compete with the first chat view");
assert.doesNotMatch(html, /<details class="agent-settings-details" open>/, "Connection settings should remain a secondary collapsed surface");
assert.match(html, /name="baseUrl"[^>]*value="https:\/\/api\.deepseek\.com"/, "Agent should prefill the official DeepSeek API endpoint");
assert.match(html, /name="model"[^>]*value="deepseek-v4-flash"/, "Agent should prefill the requested Flash model");

const draftHtml = renderAgentWorkspace({
  locale: "zh_cn",
  state: { messages: [], proposal: null, configured: false, baseUrl: "", model: "", draftBaseUrl: "http://127.0.0.1:8768", draftModel: "local-test-model", notice: "", busy: false },
  data: { localization: {} },
  context: { students: [], plannerState: {}, calculatedResults: { giftPlanning: { projections: [] } }, disclosure: {} },
});
assert.match(draftHtml, /name="baseUrl"[^>]*value="http:\/\/127\.0\.0\.1:8768"/, "Agent should keep the non-sensitive Base URL draft after a rerender");
assert.match(draftHtml, /name="model"[^>]*value="local-test-model"/, "Agent should keep the non-sensitive Model draft after a rerender");

const configuredHtml = renderAgentWorkspace({
  locale: "zh_cn",
  state: { messages: [], proposal: null, configured: true, baseUrl: "https://api.example.com", model: "test-model", notice: "", busy: false },
  data: { localization: {} },
  context: { students: [{ studentId: 10000, names: { zh_cn: "爱露" } }], plannerState: { inventory: {}, students: [] }, calculatedResults: { giftPlanning: { projections: [] } }, disclosure: {} },
});
assert.doesNotMatch(configuredHtml, /agent-visual-anchors|momotalk\.png|arona-avatar-1\.png/);
assert.match(configuredHtml, /class="agent-chat"/);
assert.match(configuredHtml, /class="agent-quick"/, "Configured Agent should show starter questions only when usable");
assert.match(configuredHtml, /准备好了，可以开始对话/, "Configured Agent should use a ready-state message");
assert.doesNotMatch(configuredHtml, /连接后开始对话/, "Configured Agent should not claim it is waiting for connection");
assert.doesNotMatch(configuredHtml, /agent-plan-summary-empty/, "Configured Agent should not show an empty planning card");

const chatHtml = renderAgentWorkspace({
  locale: "zh_cn",
  state: {
    messages: [
      { role: "user", content: "帮我看看规划" },
      { role: "assistant", content: "老师，我来帮你整理一下。" },
    ], proposal: null, configured: true, baseUrl: "https://api.example.com", model: "test-model", notice: "", busy: false,
  },
  data: { localization: {} },
  context: { students: [], plannerState: { inventory: {}, students: [] }, calculatedResults: { giftPlanning: { projections: [] } }, disclosure: {} },
});
assert.match(chatHtml, /class="agent-chat-window"/, "Configured Agent should use a chat window container");
assert.match(chatHtml, /assets\/ui\/arona-title\.webp/, "Assistant messages should show the local Arona avatar");
assert.match(chatHtml, />Arona<\/span>/, "Assistant messages should be labeled Arona");

const proposalHtml = renderAgentWorkspace({
  locale: "zh_cn",
  state: {
    messages: [], proposal: {
      type: "planning_proposal",
      summary: "调整规划",
      changes: [
        { kind: "add_student_goal", studentId: 10000, targetLevel: 80 },
        { kind: "update_student_goal", studentId: 10000, targetLevel: 90 },
        { kind: "remove_student_goal", studentId: 10000 },
        { kind: "set_main_target", studentId: 10000 },
        { kind: "reorder_student_goals", studentIds: [10000] },
      ],
    }, configured: true, baseUrl: "https://api.example.com", model: "test-model", notice: "", busy: false,
  },
  data: { localization: {}, studentById: new Map([["10000", { name_zh_cn: "爱露" }]]) },
  context: { students: [{ studentId: 10000, names: { zh_cn: "爱露" } }], plannerState: { inventory: {}, students: [] }, calculatedResults: { giftPlanning: { projections: [] } }, disclosure: {} },
});
assert.match(proposalHtml, /添加 爱露/);
assert.match(proposalHtml, /移除 爱露/);
assert.match(proposalHtml, /设为主目标/);

const busyHtml = renderAgentWorkspace({
  locale: "zh_cn",
  state: { messages: [{ role: "user", content: "帮我规划" }], proposal: null, configured: true, baseUrl: "https://api.example.com", model: "test-model", notice: "", busy: true, activityKey: "agentActivityResources" },
  data: { localization: {} },
  context: { students: [], plannerState: { inventory: {}, students: [] }, calculatedResults: { giftPlanning: { projections: [] } }, disclosure: {} },
});
assert.match(busyHtml, /class="[^"]*agent-thinking-message[^"]*"[^>]*role="status"/, "Busy Agent should render a response placeholder immediately");
assert.match(busyHtml, /正在计算每日可获取的好感/, "Busy Agent should expose the current request phase");
assert.match(busyHtml, /agent-thinking-cursor/, "Busy Agent should show a lightweight animated cursor");

console.log("agent view tests passed");
