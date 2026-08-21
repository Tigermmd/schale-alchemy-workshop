import { localeTag, text as t } from "./i18n.js?v=dashboard-20260819-schale-alchemy-workshop-agent-chat-v111&ui=v113";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function number(value, locale, fallback = "—") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 0 }).format(numeric);
}

function thresholdsFrom(data) {
  return data?.snapshots?.thresholds ?? data?.thresholds ?? {};
}

function levelRows(thresholds) {
  return Array.isArray(thresholds?.levels)
    ? [...thresholds.levels].filter((row) => Number.isFinite(Number(row?.level))).sort((a, b) => Number(a.level) - Number(b.level))
    : [];
}

function levelLabel(level, locale) {
  return t(locale, "knowledgeLevelValue", level);
}

function renderKeyLevelCards(rows, thresholds, locale) {
  const cap = Number(thresholds?.relationship_level_cap) || 100;
  const candidates = [1, 25, 50, 75, cap];
  const selected = candidates.map((level) => rows.find((row) => Number(row.level) === level)).filter(Boolean);
  if (!selected.length) return `<p class="knowledge-empty">${escapeHtml(t(locale, "knowledgeNoData"))}</p>`;
  return selected.map((row) => `<article class="knowledge-level-card ${Number(row.level) === cap ? "is-cap" : ""}">
    <span>${escapeHtml(levelLabel(row.level, locale))}</span>
    <strong>${escapeHtml(number(row.cumulative_exp_to_reach_level, locale))}</strong>
    <small>${escapeHtml(t(locale, "knowledgeCumulative"))}</small>
  </article>`).join("");
}

function renderLevelTable(rows, thresholds, locale) {
  const cap = Number(thresholds?.relationship_level_cap) || 100;
  const body = rows.map((row) => `<tr>
    <th scope="row">${escapeHtml(number(row.level, locale))}</th>
    <td>${Number(row.level) >= cap || row.can_advance_in_simulator === false ? "—" : escapeHtml(number(row.next_level_exp, locale))}</td>
    <td>${escapeHtml(number(row.cumulative_exp_to_reach_level, locale))}</td>
  </tr>`).join("");
  return `<details class="knowledge-level-details">
    <summary>${escapeHtml(t(locale, "knowledgeFullTable"))}<span>${escapeHtml(t(locale, "knowledgeFullTableHint", rows.length, cap))}</span></summary>
    <div class="knowledge-table-wrap"><table class="knowledge-level-table"><thead><tr><th scope="col">${escapeHtml(t(locale, "knowledgeLevel"))}</th><th scope="col">${escapeHtml(t(locale, "knowledgeNextLevel"))}</th><th scope="col">${escapeHtml(t(locale, "knowledgeCumulative"))}</th></tr></thead><tbody>${body}</tbody></table></div>
  </details>`;
}

function renderGiftTable(values, title, tone, locale) {
  const tiers = [
    ["small", values?.["小"]],
    ["medium", values?.["中"]],
    ["large", values?.["大"]],
    ["huge", values?.["特大"]],
  ];
  return `<section class="knowledge-gift-card ${tone}"><h3>${escapeHtml(title)}</h3><div class="knowledge-gift-values">${tiers.map(([tier, value]) => `<div><span>${escapeHtml(t(locale, `knowledgeTier${tier[0].toUpperCase()}${tier.slice(1)}`))}</span><strong>${value == null ? "—" : escapeHtml(number(value, locale))}</strong></div>`).join("")}</div><small>${escapeHtml(t(locale, "knowledgeExpUnit"))}</small></section>`;
}

function renderSources(thresholds, locale) {
  const other = thresholds?.other_exp ?? {};
  const cafe = other.cafe_touch;
  const scheduleMin = other.schedule_min;
  const scheduleMax = other.schedule_max;
  const multiplier = other.schedule_bonus_multiplier;
  return `<section class="knowledge-panel knowledge-sources"><div class="knowledge-section-heading"><span>${escapeHtml(t(locale, "knowledgeSourcesEyebrow"))}</span><h2>${escapeHtml(t(locale, "knowledgeSourcesTitle"))}</h2></div><div class="knowledge-source-list">
    <article class="knowledge-source-row"><span class="knowledge-source-mark">☕</span><div><strong>${escapeHtml(t(locale, "knowledgeCafe"))}</strong><small>${escapeHtml(t(locale, "knowledgeCafeValue", number(cafe, locale)))}</small></div></article>
    <article class="knowledge-source-row"><span class="knowledge-source-mark">▣</span><div><strong>${escapeHtml(t(locale, "knowledgeSchedule"))}</strong><small>${escapeHtml(t(locale, "knowledgeScheduleValue", number(scheduleMin, locale), number(scheduleMax, locale), number(multiplier, locale)))}</small></div></article>
  </div><div class="knowledge-rule-list"><p><span class="knowledge-rule-dot is-blue"></span>${escapeHtml(t(locale, "knowledgeReleasedRule"))}</p><p><span class="knowledge-rule-dot is-rose"></span>${escapeHtml(t(locale, "knowledgeUnreleasedRule"))}</p></div></section>`;
}

export function renderKnowledgeWorkspace({ data = {}, locale = "zh_cn" } = {}) {
  const thresholds = thresholdsFrom(data);
  const rows = levelRows(thresholds);
  const cap = Number(thresholds.relationship_level_cap) || 100;
  const capRow = rows.find((row) => Number(row.level) === cap) ?? rows.at(-1);
  const previousRow = rows.find((row) => Number(row.level) === cap - 1);
  const finalStep = previousRow && capRow
    ? Number(capRow.cumulative_exp_to_reach_level) - Number(previousRow.cumulative_exp_to_reach_level)
    : capRow?.next_level_exp;
  const normal = thresholds.gift_exp?.normal ?? {};
  const premium = thresholds.gift_exp?.premium ?? {};
  return `<section class="knowledge-workspace">
    <header class="knowledge-hero"><div><span class="knowledge-eyebrow">${escapeHtml(t(locale, "knowledgeEyebrow"))}</span><h2>${escapeHtml(t(locale, "knowledgeTitle"))}</h2><p>${escapeHtml(t(locale, "knowledgeCaption"))}</p></div><div class="knowledge-cap"><span>${escapeHtml(t(locale, "knowledgeCapLabel", cap))}</span><strong>${escapeHtml(number(capRow?.cumulative_exp_to_reach_level, locale))}</strong><small>${escapeHtml(t(locale, "knowledgeCapHint", number(finalStep, locale)))}</small></div></header>
    <section class="knowledge-panel knowledge-levels"><div class="knowledge-section-heading"><span>${escapeHtml(t(locale, "knowledgeLevelsEyebrow"))}</span><h2>${escapeHtml(t(locale, "knowledgeLevelsTitle"))}</h2></div><div class="knowledge-level-grid">${renderKeyLevelCards(rows, thresholds, locale)}</div>${renderLevelTable(rows, thresholds, locale)}</section>
    <section class="knowledge-panel knowledge-gifts"><div class="knowledge-section-heading"><span>${escapeHtml(t(locale, "knowledgeGiftsEyebrow"))}</span><h2>${escapeHtml(t(locale, "knowledgeGiftsTitle"))}</h2></div><div class="knowledge-gift-grid">${renderGiftTable(normal, t(locale, "knowledgeNormalGift"), "is-normal", locale)}${renderGiftTable(premium, t(locale, "knowledgeGoldGift"), "is-gold", locale)}</div></section>
    ${renderSources(thresholds, locale)}
    <details class="knowledge-notes"><summary>${escapeHtml(t(locale, "knowledgeNotes"))}</summary><div><p>${escapeHtml(t(locale, "knowledgeNoteLevelCap", cap))}</p><p>${escapeHtml(t(locale, "knowledgeNoteSource"))}</p></div></details>
  </section>`;
}
