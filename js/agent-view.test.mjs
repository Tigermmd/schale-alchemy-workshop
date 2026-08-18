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
