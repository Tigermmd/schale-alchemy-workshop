import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

const indexHtml = read("index.html");
const appJs = read("js/app.js");
const plannerView = read("js/planner-view.js");
const packageView = read("js/package-view.js");
const studentRender = read("js/render.js");
const agentView = read("js/agent-view.js");
const resourceView = read("js/resource-view.js");
const inventoryView = read("js/inventory-view.js");
const agentCss = read("agent.css");
const agentState = read("js/agent-state.js");
const releaseState = read("js/release-state.js");
const i18n = read("js/i18n.js");

assert.doesNotMatch(indexHtml, /id="option-count"/, "隐藏的制造节点计数不应继续留在页面壳层");
assert.doesNotMatch(indexHtml, /id="brand-eyebrow"/, "品牌眉题不应与主标题重复");
assert.match(indexHtml, /class="brand-glyph"[^>]*><img src="\.\/assets\/students\/10059\.webp"/, "侧栏品牌图标应使用原皮未花头像");
assert.match(indexHtml, /class="header-mark"[^>]*><img src="\.\/assets\/students\/10059\.webp"/, "顶部品牌图标应使用原皮未花头像");
assert.doesNotMatch(indexHtml, /class="brand-glyph"[^>]*><span>S<\/span>/, "侧栏不应继续使用 S 字母图标");
assert.doesNotMatch(indexHtml, /placeholder="搜索中文名 \/ English \/ ID"/, "学生搜索框不应把内部 ID 作为用户入口文案");
assert.doesNotMatch(appJs, /elements\.optionCount/, "应用层不应继续写入已移除的隐藏节点计数");
assert.doesNotMatch(plannerView, /function renderInventory\(/, "规划器不应保留未调用的旧库存渲染接口");
assert.doesNotMatch(plannerView, /function renderAllocation\(/, "规划器不应保留未调用的旧分配渲染接口");
assert.doesNotMatch(plannerView, /function renderStudentRows\(/, "规划器不应保留未调用的旧学生列表渲染接口");
assert.doesNotMatch(studentRender, /class="profile-english"/, "学生 ID 不应在个人信息中重复展示");
assert.doesNotMatch(studentRender, /<small>#\$\{escapeHtml\(student\.student_id\)\}<\/small>/, "学生列表不应把内部 ID 当作可见信息");
assert.doesNotMatch(studentRender, /selectedStudent\"\)\} · #\$\{student\.student_id\}/, "学生个人卡片不应把内部 ID 当作可见信息");
assert.doesNotMatch(plannerView, /<small>#\$\{plan\.studentId\}/, "规划结果不应把内部学生 ID 当作可见信息");
assert.doesNotMatch(packageView, /localizedName\(student, \"student\", locale, localization\)\} · #\$\{student\.student_id\}/, "礼包目标选择不应把内部学生 ID 当作可见信息");
assert.doesNotMatch(resourceView, /`#\$\{plan\.studentId\}`/, "资源投影不应把内部学生 ID 作为可见兜底文本");
assert.doesNotMatch(studentRender, /<p>#\$\{escapeHtml\(gift\.id\)<\/p>/, "礼物图鉴不应把内部礼物 ID 当作可见信息");
assert.doesNotMatch(i18n, /inventorySearchPlaceholder: "名称或 ID"|inventorySearchPlaceholder: "Name or ID"|inventorySearchPlaceholder: "名前またはID"/, "库存搜索入口不应把内部 ID 作为主要文案");
assert.doesNotMatch(studentRender, /class="profile-note"/, "个人信息首屏不应放计算口径长说明");
assert.doesNotMatch(agentView, /class="agent-step-title"/, "Agent 设置不应重复渲染第 1 步标题");
assert.doesNotMatch(agentView, /agent-setup-steps|agent-settings-step|agentSetupStep/, "Agent 不应保留三步引导和旧设置容器");
assert.doesNotMatch(agentCss, /agent-setup-steps|agent-settings-step/, "Agent CSS 不应保留已删除的三步引导样式");
assert.doesNotMatch(resourceView, /<details class="resource-details" open>/, "资源输入默认应折叠，首屏先显示汇总");
assert.match(inventoryView, /function quantityColumns\(value, locale/, "库存摘要必须直接使用已经计算好的资源汇总");
assert.doesNotMatch(inventoryView, /function quantityColumns\(summary, locale\)[\s\S]*summaryValue\(summary\)/, "库存摘要不能因错误的二次取值全部显示为 0");
for (const [name, source] of [["规划", plannerView], ["库存", inventoryView], ["周期资源", resourceView], ["礼包", packageView], ["Agent", agentView]]) {
  assert.doesNotMatch(source, /<h1\b/, `${name}工作区不应重复渲染页面级 H1`);
}
assert.match(plannerView, /data-planner-open-form[^>]*aria-controls="planner-student-form"/, "空规划 CTA 必须声明它控制的表单");
assert.match(plannerView, /data-planner-open-form[^>]*aria-expanded="false"/, "空规划 CTA 初始必须声明表单收起");
assert.match(resourceView, /resource-row-details[\s\S]{0,500}resourceName/, "周期资源详情折叠项必须包含资源名称");
assert.doesNotMatch(agentState, /function buildStudentProjection\(/, "Agent 不应保留未接入的旧学生投影函数");
assert.doesNotMatch(releaseState, /function applyReleaseChange\(/, "上线状态模块不应保留与提案应用重复的旧修改接口");
assert.doesNotMatch(i18n, /export function secondaryName\(/, "图鉴不应保留未使用的重复名称接口");
assert.doesNotMatch(agentView, /formatJson\(\{ disclosure, confirmedFacts:/, "Agent 页面不应直接展示内部上下文 JSON");
assert.match(plannerView, /planningAddGoal/, "规划表单空状态应使用短 CTA，不重复整句空状态文案");
assert.match(plannerView, /planner-empty-form/, "空规划状态只保留主 CTA，表单折叠入口不得占用首屏");
assert.doesNotMatch(plannerView, /<p>\$\{escapeHtml\(t\(locale, "planningAddFirst"\)\)<\/p>/, "规划空状态不应把同一条 CTA 同时渲染为说明段落");
assert.doesNotMatch(resourceView, /resourceMeta\(resource, locale\).*resourceCopyUnit/, "周期资源行不应在元信息中重复输入字段说明");
assert.doesNotMatch(i18n, /制造与好感研究台|免费资源账本|只看当前库存与免费资源|先补这几项|查看来源与核验状态/, "首屏不应出现研究报告式长文案");
assert.doesNotMatch(i18n, /AVAILABLE NODES|EXP RANKING|5択ノード方式/, "不应出现未本地化或内部标签");
assert.match(i18n, /plannerCaption: ""/, "规划页首屏不应强制显示解释性副标题");
assert.match(i18n, /resourcesCaption: ""/, "周期资源页首屏不应强制显示解释性副标题");
assert.match(i18n, /inventoryHint: ""/, "库存页首屏不应强制显示解释性副标题");

console.log("ui simplification tests passed");
