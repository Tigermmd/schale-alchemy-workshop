import { formatExp, formatInteger } from "./render.js?v=dashboard-20260817-inventory-v52";
import { localizedName, text as t } from "./i18n.js?v=dashboard-20260817-inventory-v52";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatJson(value) {
  try { return JSON.stringify(value, null, 2); } catch { return ""; }
}

function changeLabel(change, data, locale, localization) {
  if (change.kind === "set_student_target") {
    const student = data?.cutoffStudentById?.get(String(change.studentId)) ?? data?.studentById?.get(String(change.studentId));
    return t(locale, "agentChangeStudentTarget", localizedName(student, "student", locale, localization), change.targetLevel);
  }
  if (change.kind === "set_forecast_days") return t(locale, "agentChangeForecastDays", change.value);
  if (change.kind === "set_cn_cutoff_student") {
    const student = data?.cutoffStudentById?.get(String(change.studentId)) ?? data?.studentById?.get(String(change.studentId));
    return t(locale, "agentChangeCnCutoff", localizedName(student, "student", locale, localization));
  }
  return String(change.kind ?? "");
}

function renderPlanSummary({ context, locale, localization }) {
  const projections = context?.calculatedResults?.giftPlanning?.projections ?? [];
  if (!projections.length) {
    return `<section class="agent-plan-summary agent-plan-summary-empty"><div><span class="agent-plan-kicker">${escapeHtml(t(locale, "agentPlanSummaryTitle"))}</span><strong>${escapeHtml(t(locale, "agentPlanSummaryEmpty"))}</strong></div></section>`;
  }
  const studentById = new Map((context?.students ?? []).map((student) => [String(student.studentId), student]));
  return `<section class="agent-plan-summary" aria-labelledby="agent-plan-summary-title"><div class="agent-plan-summary-heading"><span class="agent-plan-kicker">${escapeHtml(t(locale, "agentPlanSummaryTitle"))}</span><h2 id="agent-plan-summary-title">${escapeHtml(t(locale, "agentPlanSummaryCount", projections.length))}</h2></div><div class="agent-plan-summary-list">${projections.map((item) => {
    const student = studentById.get(String(item.studentId));
    const name = student ? localizedName({ name_zh_cn: student.names?.zh_cn, name_en: student.names?.en, name_ja: student.names?.ja }, "student", locale, localization) : String(item.studentId);
    const projection = item.projection ?? {};
    const days = projection.estimatedDays === null || projection.estimatedDays === undefined ? t(locale, "planningDaysUnknown") : `${formatInteger(projection.estimatedDays, locale)} ${t(locale, "planningDaysUnit")}`;
    return `<article class="agent-plan-summary-row"><strong>${escapeHtml(name)}</strong><span><small>${escapeHtml(t(locale, "agentPlanGap"))}</small><b>${formatExp(projection.gapWithinPeriod ?? item.combined?.gap ?? 0, locale)}</b></span><span><small>${escapeHtml(t(locale, "agentPlanDays"))}</small><b>${escapeHtml(days)}</b></span><span><small>${escapeHtml(t(locale, "agentPlanStock"))}</small><b>${formatExp(projection.currentExp ?? item.combined?.giftExp ?? 0, locale)}</b></span></article>`;
  }).join("")}</div></section>`;
}

export function renderAgentWorkspace({ locale, state, data, context }) {
  const messages = Array.isArray(state.messages) ? state.messages : [];
  const proposal = state.proposal;
  const contextStudents = context?.students ?? [];
  const contextSummary = t(locale, "agentContextSummary", contextStudents.length, Object.keys(context?.plannerState?.inventory ?? {}).length);
  const notice = state.notice ? `<div class="agent-notice" role="status">${escapeHtml(state.notice)}</div>` : "";
  const conversation = messages.length
    ? messages.map((message) => `<article class="agent-message agent-message-${message.role === "user" ? "user" : "assistant"}"><span>${escapeHtml(message.role === "user" ? t(locale, "agentYou") : t(locale, "agentAssistant"))}</span><p>${escapeHtml(message.content)}</p>${Array.isArray(message.questions) && message.questions.length ? `<div class="agent-questions"><strong>${escapeHtml(t(locale, "agentQuestionsTitle"))}</strong><ol>${message.questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ol></div>` : ""}</article>`).join("")
    : `<div class="agent-empty" role="status">${escapeHtml(t(locale, "agentEmpty"))}</div>`;
  const proposalHtml = proposal
    ? `<section class="agent-proposal" aria-labelledby="agent-proposal-title"><div class="section-heading compact"><div><h2 id="agent-proposal-title">${escapeHtml(proposal.summary || t(locale, "agentProposal"))}</h2></div><span class="section-caption">${escapeHtml(t(locale, "agentProposalHint"))}</span></div><div class="agent-change-list">${(proposal.changes ?? []).map((change, index) => `<article class="agent-change-row"><label><input type="checkbox" data-agent-change-index="${index}" checked><span>${escapeHtml(changeLabel(change, data, locale, data.localization))}</span></label><button type="button" class="secondary-button" data-agent-apply-one="${index}">${escapeHtml(t(locale, "agentApplyOne"))}</button><details class="agent-change-details"><summary>${escapeHtml(t(locale, "agentChangeDetails"))}</summary><code>${escapeHtml(formatJson(change))}</code></details></article>`).join("")}</div>${Array.isArray(proposal.assumptions) && proposal.assumptions.length ? `<p class="agent-assumptions"><strong>${escapeHtml(t(locale, "agentAssumptions"))}</strong> ${escapeHtml(proposal.assumptions.join("；"))}</p>` : ""}${Array.isArray(proposal.warnings) && proposal.warnings.length ? `<p class="agent-warnings"><strong>${escapeHtml(t(locale, "agentWarnings"))}</strong> ${escapeHtml(proposal.warnings.join("；"))}</p>` : ""}<div class="agent-proposal-actions"><button type="button" class="primary-button" data-agent-apply-selected>${escapeHtml(t(locale, "agentApplySelected"))}</button><button type="button" class="secondary-button" data-agent-apply-all>${escapeHtml(t(locale, "agentApplyAll"))}</button><button type="button" class="text-button" data-agent-reject>${escapeHtml(t(locale, "agentReject"))}</button></div></section>`
    : "";
  const apiKeyHint = state.configured ? t(locale, "agentApiKeyConfigured") : t(locale, "agentApiKeySecurity");
  const disclosure = context?.disclosure ?? {};
  const calculatedProjectionCount = context?.calculatedResults?.giftPlanning?.projections?.length ?? 0;
  const disclosureSummary = `${escapeHtml(t(locale, "agentDisclosureConfirmed"))} · ${escapeHtml(t(locale, "agentDisclosureCalculated", calculatedProjectionCount))}`;
  const settingsForm = `<form class="agent-settings-form" id="agent-settings-form"><label><span>${escapeHtml(t(locale, "agentBaseUrl"))}</span><input name="baseUrl" type="url" value="${escapeHtml(state.baseUrl)}" placeholder="https://api.example.com" autocomplete="url" required></label><label><span>${escapeHtml(t(locale, "agentModel"))}</span><input name="model" value="${escapeHtml(state.model)}" placeholder="model-name" autocomplete="off" required></label><label><span>${escapeHtml(t(locale, "agentApiKey"))}</span><input class="agent-api-key-input" name="apiKey" type="password" value="" placeholder="${escapeHtml(state.configured ? t(locale, "agentApiKeyReusePlaceholder") : t(locale, "agentApiKeyPlaceholder"))}" autocomplete="new-password" autocapitalize="off" spellcheck="false" inputmode="text" ${state.configured ? "" : "required"}></label><button type="button" class="secondary-button" data-agent-test>${escapeHtml(t(locale, "agentTest"))}</button><small>${escapeHtml(apiKeyHint)}</small></form>`;
  const quickQuestions = !messages.length ? `<div class="agent-quick"><strong>${escapeHtml(t(locale, "agentQuickTitle"))}</strong><div>${[1, 2, 3].map((id) => `<button type="button" class="agent-quick-button" data-agent-question="${escapeHtml(t(locale, `agentQuickQuestion${id}`))}">${escapeHtml(t(locale, `agentQuickQuestion${id}`))}</button>`).join("")}</div></div>` : "";
  const settings = `<details class="agent-settings-details"${state.configured ? "" : " open"}><summary>${escapeHtml(t(locale, state.configured ? "agentSettingsDetails" : "agentSetupCta"))}</summary>${settingsForm}</details>`;
  const chat = `<div class="agent-chat" aria-live="polite">${conversation}</div><form class="agent-chat-form" id="agent-chat-form"><label><span>${escapeHtml(t(locale, "agentMessage"))}</span><textarea name="message" rows="3" maxlength="20000" placeholder="${escapeHtml(t(locale, "agentMessagePlaceholder"))}" required></textarea></label><div class="agent-chat-actions"><button type="submit" class="primary-button" ${state.busy || !state.configured ? "disabled" : ""}>${escapeHtml(state.busy ? t(locale, "agentThinking") : state.configured ? t(locale, "agentSend") : t(locale, "agentConfigureFirst"))}</button></div></form>${quickQuestions}`;
  if (!state.configured) {
    const planSummary = calculatedProjectionCount ? renderPlanSummary({ context, locale, localization: data.localization }) : "";
    return `<section class="agent-workspace panel" aria-labelledby="agent-title"><div class="section-heading"><div><span class="workspace-kicker">${escapeHtml(t(locale, "workbenchAgent"))}</span><h2 id="agent-title">${escapeHtml(t(locale, "agentTitle"))}</h2></div></div>${planSummary}<div class="agent-connection-empty" role="status"><div class="agent-connection-copy"><span class="agent-connection-mark" aria-hidden="true">✦</span><div><strong>${escapeHtml(t(locale, "agentSetupTitle"))}</strong><p>${escapeHtml(t(locale, "agentSetupPrompt"))}</p></div></div></div>${settings}${notice}</section>`;
  }
  return `<section class="agent-workspace panel" aria-labelledby="agent-title"><div class="section-heading"><div><span class="workspace-kicker">${escapeHtml(t(locale, "workbenchAgent"))}</span><h2 id="agent-title">${escapeHtml(t(locale, "agentTitle"))}</h2></div></div>${renderPlanSummary({ context, locale, localization: data.localization })}${settings}${chat}${proposalHtml}${notice}<details class="agent-context-details"><summary>${escapeHtml(t(locale, "agentContextTitle"))} · ${escapeHtml(contextSummary)}</summary><p class="agent-disclosure-summary">${disclosureSummary}</p></details></section>`;
}
