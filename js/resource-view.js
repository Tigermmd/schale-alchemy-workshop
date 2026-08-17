import { localizedName, text as t } from "./i18n.js?v=dashboard-20260817-gift-clean-v59";
import { formatExp, formatInteger, formatSmartQuantity } from "./render.js?v=dashboard-20260817-gift-clean-v59";
import { calculateGiftBoxExpectedExp, calculateGiftBoxesExpectedExp } from "./gift-box-state.js?v=dashboard-20260817-gift-clean-v59";
import { calculateResourceForecast } from "./resource-model.js?v=dashboard-20260817-gift-clean-v59";
import { calculateRelationshipSourceForecast } from "./release-state.js?v=dashboard-20260817-gift-clean-v59";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localizedEvidenceField(lead, field, locale) {
  const suffix = locale === "en" ? "en" : locale === "ja" ? "ja" : "zh_cn";
  return lead?.[`${field}_${suffix}`] ?? lead?.[`${field}_zh_cn`] ?? "";
}

function publicEvidenceText(value, locale) {
  return String(value ?? "")
    .replaceAll("100000", t(locale, "inventoryBoxName", "100000"))
    .replaceAll("100008", t(locale, "inventoryBoxName", "100008"))
    .replaceAll("100009", t(locale, "inventoryBoxName", "100009"));
}

function renderResourceEvidence({ lead, source, sourceById, locale, candidateUnit }) {
  if (!["lead", "user_confirmed"].includes(lead?.status)) {
    return '<div class="resource-evidence is-empty"><strong>' + escapeHtml(t(locale, "resourceEvidenceMissing")) + '</strong></div>';
  }
  const candidateText = publicEvidenceText(localizedEvidenceField(lead, "candidate_text", locale), locale);
  const candidateValue = lead.candidate_value !== null && lead.candidate_value !== undefined && Number.isFinite(Number(lead.candidate_value))
    ? `${formatSmartQuantity(lead.candidate_value, locale)} ${candidateUnit || ""}`.trim()
    : candidateText;
  const officialScope = publicEvidenceText(localizedEvidenceField(lead, "official_scope", locale), locale);
  const officialSources = (lead.official_source_ids ?? []).map((id) => sourceById?.get(id)).filter(Boolean);
  const evidenceLabel = lead.status === "user_confirmed" ? t(locale, "resourceEvidenceConfirmed") : t(locale, "resourceEvidenceLead");
  const sourceLink = source?.url
    ? '<a href="' + escapeHtml(source.url) + '" target="_blank" rel="noreferrer">' + escapeHtml(t(locale, "resourceEvidenceSource")) + ' ↗</a>'
    : '';
  return '<div class="resource-evidence ' + (lead.status === "user_confirmed" ? "is-confirmed" : "is-lead") + '"><strong>' +
    escapeHtml(evidenceLabel) +
    '</strong><span>' +
    escapeHtml(candidateValue || t(locale, "resourceEvidenceMissing")) +
    '</span>' + (candidateText && candidateValue !== candidateText ? '<small>' + escapeHtml(candidateText) + '</small>' : '') +
    (officialScope ? '<small class="resource-evidence-official"><b>' + escapeHtml(t(locale, "resourceEvidenceOfficial")) + '</b> ' + escapeHtml(officialScope) + (officialSources.length ? ' ' + officialSources.map((officialSource) => '<a href="' + escapeHtml(officialSource.url) + '" target="_blank" rel="noreferrer">' + escapeHtml(t(locale, "resourceEvidenceOfficialSource")) + ' ↗</a>').join(" ") : '') + '</small>' : '') +
    sourceLink + '</div>';
}

function resourceSourceLabel(resource, lead, locale) {
  if (resource.input_kind === "floor") return t(locale, "resourceSourceFloor");
  if (resource.input_kind === "daily_count") return t(locale, "resourceSourceDailyCount", resource.id, resource.expected_per_count);
  if (resource.value_source === "user") return t(locale, "resourceSourcePlayerOverride");
  if (resource.value_source === "default" && lead?.status === "user_confirmed") return t(locale, "resourceSourceConfirmedDefault");
  return t(locale, "resourceSourceManual");
}

function periodMultiplier(resource, periodDays) {
  if (resource.cadence === "daily") return periodDays;
  if (resource.cadence === "weekly") return periodDays / 7;
  if (resource.cadence === "monthly") return periodDays / 30;
  return 0;
}

function renderResourceInput(resource, state, locale, lead) {
  const isConfigured = resource.amount !== null;
  if (resource.input_kind === "floor") {
    const resourceLabel = t(locale, "resourceName", resource.id);
    const floorLabel = `${resourceLabel} · ${t(locale, "resourceFloorSelect")}`;
    const customFloorLabel = `${resourceLabel} · ${t(locale, "resourceCustomFloor")}`;
    const options = resource.floor_options ?? [];
    const selectedFloor = Number(resource.amount);
    const isStandardFloor = Number.isInteger(selectedFloor) && options.includes(selectedFloor);
    const selectValue = isStandardFloor ? String(selectedFloor) : resource.amount === null ? "" : "custom";
    return `<div class="resource-input resource-floor-input">
      <label>
        <span class="sr-only">${escapeHtml(floorLabel)}</span>
        <select data-resource-floor="${escapeHtml(resource.id)}" aria-label="${escapeHtml(floorLabel)}">
          <option value="">${escapeHtml(t(locale, "resourceFloorSelect"))}</option>
          ${options.map((floor) => `<option value="${floor}" ${selectValue === String(floor) ? "selected" : ""}>${escapeHtml(t(locale, "resourceFloorSummary", floor))}</option>`).join("")}
          <option value="custom" ${selectValue === "custom" ? "selected" : ""}>${escapeHtml(t(locale, "resourceCustomFloor"))}</option>
        </select>
      </label>
      ${selectValue === "custom" ? `<label class="resource-custom-floor"><span class="sr-only">${escapeHtml(customFloorLabel)}</span><input type="number" min="1" max="${resource.max_floor ?? 124}" step="1" data-resource-amount="${escapeHtml(resource.id)}" value="${isConfigured ? resource.amount : ""}" placeholder="1–${resource.max_floor ?? 124}" inputmode="numeric" aria-label="${escapeHtml(customFloorLabel)}"></label>` : ""}
    </div>`;
  }
  const inputLabel = resource.input_kind
    ? t(locale, "resourceInputLabel", resource.input_kind, resource.id)
    : `${t(locale, "resourceName", resource.id)} · ${t(locale, "resourceValue")}`;
  const inputTitle = resource.value_source === "user"
    ? t(locale, "resourceSourcePlayerOverride")
    : lead?.status === "user_confirmed"
      ? t(locale, "resourceInputConfirmed")
      : t(locale, "resourceValue");
  const integerInput = Boolean(resource.input_kind) || resource.unit !== "relationship_exp";
  return `<label class="resource-input"><span class="sr-only">${escapeHtml(inputLabel)}</span><input type="number" min="0" step="${integerInput ? "1" : "0.01"}" inputmode="${integerInput ? "numeric" : "decimal"}" data-resource-amount="${escapeHtml(resource.id)}" value="${isConfigured ? resource.amount : ""}" placeholder="${escapeHtml(resource.input_kind ? t(locale, "resourceInputPlaceholder", resource.input_kind) : "—")}" aria-label="${escapeHtml(inputLabel)}" title="${escapeHtml(inputTitle)}"></label>`;
}

function renderUnlimitedRewardSummary(summary, locale) {
  if (!summary) return `<strong>${escapeHtml(t(locale, "resourceWaitingInput"))}</strong>`;
  const rewards = [
    t(locale, "resourceGoldSelectableGifts", formatInteger(summary.goldSelectableGifts, locale)),
    t(locale, "resourcePurpleRandomGifts", formatInteger(summary.purpleRandomGifts, locale)),
  ];
  return `<div class="resource-reward-summary"><strong>${escapeHtml(t(locale, "resourceFloorSummary", summary.floor))}</strong>${rewards.map((reward) => `<span>${escapeHtml(reward)}</span>`).join("")}</div>`;
}

function renderResourceForecast(resource, forecast, locale) {
  if (!forecast) return `<strong>${escapeHtml(t(locale, "resourceWaitingInput"))}</strong>`;
  if (forecast.kind === "unlimited_assault") return `${renderUnlimitedRewardSummary(forecast.summary, locale)}<small>${escapeHtml(t(locale, "resourceForecastLabel", resource.input_kind))}</small>`;
  const value = forecast.kind === "relationship_exp" ? formatExp(forecast.value, locale) : formatSmartQuantity(forecast.value, locale);
  return `<strong>${escapeHtml(value)}</strong><small>${escapeHtml(t(locale, "resourceForecastLabel", resource.input_kind))}</small>`;
}

function resourceMeta(resource, locale) {
  return t(locale, "resourceCadence", resource.cadence);
}

function resourceIcon(resource, data) {
  const assetKey = {
    "weekly-manufacturing-stones": "item:3",
    "monthly-synthesis-stones": "item:82",
    "monthly-total-assault-gift-boxes": "item:100008",
    "monthly-grand-assault-gift-boxes": "item:100009",
    "monthly-unlimited-assault-gift-boxes": "item:100000",
    "daily-schedule-exp": "ui:schedule-favor",
    "daily-cafe-exp": "ui:kivo-favor",
  }[resource.id];
  const source = assetKey ? data?.assetManifest?.entries?.[assetKey] : null;
  return source ? `<img src="${escapeHtml(source.local)}" data-fallback="${escapeHtml(source.remote ?? "")}" alt="" loading="lazy">` : (resource.cadence === "daily" ? "D" : resource.cadence === "weekly" ? "W" : "M");
}

function renderResourceRow({ resource, state, data, locale, evidenceById, sourceById }) {
  const isConfigured = resource.amount !== null;
  const forecast = calculateResourceForecast(resource, resource.amount, state.periodDays, data.unlimitedAssaultRewards);
  const lead = evidenceById.get(resource.id);
  const source = lead?.source_id ? sourceById.get(lead.source_id) : null;
  const candidateUnit = locale === "en" ? lead?.candidate_unit_en : locale === "ja" ? lead?.candidate_unit_ja : lead?.candidate_unit_zh_cn;
  return `<article class="resource-row ${isConfigured ? "is-configured" : "is-missing"}">
    <div class="resource-icon" aria-hidden="true">${resourceIcon(resource, data)}</div>
    <div class="resource-copy"><strong><span class="resource-name">${escapeHtml(t(locale, "resourceName", resource.id))}</span><em class="resource-status ${isConfigured ? "is-configured" : "is-missing"}">${escapeHtml(t(locale, isConfigured ? "resourceConfigured" : "resourceMissing"))}</em></strong><small>${escapeHtml(resourceMeta(resource, locale))}</small></div>
    ${renderResourceInput(resource, state, locale, lead)}
    <div class="resource-forecast ${resource.input_kind === "floor" ? "is-reward-forecast" : ""}">${renderResourceForecast(resource, forecast, locale)}</div>
    <details class="resource-row-details"><summary aria-label="${escapeHtml(`${t(locale, "resourceName", resource.id)} · ${t(locale, "resourceEvidenceDetails")}`)}">${escapeHtml(t(locale, "resourceName", resource.id))} · ${escapeHtml(t(locale, "resourceEvidenceDetails"))}</summary><p class="resource-source">${t(locale, "resourceSource")}：${escapeHtml(resourceSourceLabel(resource, lead, locale))}</p>${resource.input_kind ? "" : renderResourceEvidence({ lead, source, sourceById, locale, candidateUnit })}</details>
  </article>`;
}

function renderManufacturingProjection({ data, state, locale, localization }) {
  const stoneResource = state.resources.find((resource) => resource.id === "weekly-manufacturing-stones");
  const projectedStones = stoneResource?.amount === null || stoneResource?.amount === undefined
    ? null
    : stoneResource.amount * periodMultiplier(stoneResource, state.periodDays);
  const plans = Array.isArray(state.students) ? state.students : [];
  const cards = plans.length
    ? plans.map((plan) => {
      const student = data.studentById?.get(String(plan.studentId));
      const crafting = data.craftingById?.get(String(plan.studentId));
      const perStone = Number(crafting?.relationship_exp_per_manufacturing_stone);
      const hasPerStone = Number.isFinite(perStone) && perStone >= 0;
      const expected = projectedStones !== null && hasPerStone ? projectedStones * perStone : null;
      const stages = ["1", "2", "3"].map((stage) => Number(crafting?.stage_expected_relationship_exp?.[stage])).filter((value) => Number.isFinite(value));
      const studentName = student ? localizedName(student, "student", locale, localization) : t(locale, "unknown");
      return `<article class="manufacturing-resource-card">
        <div class="manufacturing-resource-head"><strong>${escapeHtml(studentName)}</strong><span>${escapeHtml(t(locale, "manufacturingExpected"))}：${expected === null ? escapeHtml(t(locale, "unknown")) : formatExp(expected, locale)}</span></div>
        <div class="manufacturing-resource-meta"><span>${escapeHtml(t(locale, "manufacturingStonesPeriod"))}：${projectedStones === null ? escapeHtml(t(locale, "unknown")) : formatSmartQuantity(projectedStones, locale)}</span><span>${escapeHtml(t(locale, "manufacturingPerStone"))}：${hasPerStone ? formatExp(perStone, locale) : escapeHtml(t(locale, "unknown"))}</span></div>
        <small>${stages.length === 3 ? `${escapeHtml(t(locale, "manufacturingStages"))}：${stages.map((value) => formatExp(value, locale)).join(" / ")}` : escapeHtml(t(locale, "manufacturingDataMissing"))}</small>
      </article>`;
    }).join("")
    : `<p class="gift-box-muted" role="status">${escapeHtml(t(locale, "manufacturingNoStudents"))}</p>`;

  return `<section class="manufacturing-resource-workspace" aria-labelledby="manufacturing-resource-title">
    <div class="section-heading compact"><h2 id="manufacturing-resource-title">${escapeHtml(t(locale, "manufacturingProjectionTitle"))}</h2></div>
    <div class="manufacturing-resource-list">${cards}</div>
  </section>`;
}

function renderRelationshipSourceProjection({ data, state, locale, localization }) {
  const plans = Array.isArray(state.students) ? state.students : [];
  if (!plans.length) return "";
  const rows = plans.map((plan) => {
    const student = data.studentById?.get(String(plan.studentId));
    const forecast = calculateRelationshipSourceForecast({
      state,
      studentId: plan.studentId,
      cnProgress: state.cnProgress,
      timeline: data.releaseTimeline ?? [],
      periodDays: state.forecastDays,
    });
    const label = student ? localizedName(student, "student", locale, localization) : t(locale, "unknown");
    const value = forecast.giftOnly
      ? t(locale, "relationshipSourcesGiftOnly")
      : t(locale, "relationshipSourcesIncluded", formatExp(forecast.totalExp, locale));
    return `<article class="relationship-source-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></article>`;
  }).join("");
  return `<section class="relationship-source-workspace" aria-labelledby="relationship-source-title"><div class="section-heading compact"><h2 id="relationship-source-title">${escapeHtml(t(locale, "relationshipSourcesTitle"))}</h2></div><div class="relationship-source-list">${rows}</div></section>`;
}

function giftBoxName(box, locale) {
  if (locale === "en") return box?.name_en ?? box?.name_zh_cn ?? "";
  if (locale === "ja") return box?.name_ja ?? box?.name_en ?? box?.name_zh_cn ?? "";
  return box?.name_zh_cn ?? box?.name_en ?? "";
}

function giftBoxPoolLabel(box, locale) {
  if (locale === "en") return box?.pool_label_en ?? box?.pool_label_zh_cn ?? "";
  if (locale === "ja") return box?.pool_label_ja ?? box?.pool_label_en ?? box?.pool_label_zh_cn ?? "";
  return box?.pool_label_zh_cn ?? box?.pool_label_en ?? "";
}

function renderGiftBoxWorkspace({ data, state, locale, localization }) {
  const boxes = Array.isArray(data?.giftBoxes) ? data.giftBoxes : [];
  const plans = Array.isArray(state.students) ? state.students : [];
  const entries = boxes
    .map((box) => ({
      box,
      quantity: Number(state.giftBoxes?.[String(box.id)] ?? 0),
      options: { policy: "best_for_student" },
    }))
    .filter((entry) => Number.isFinite(entry.quantity) && entry.quantity > 0);

  const studentCards = plans.length
    ? plans.map((plan) => {
      const student = data.studentById?.get(String(plan.studentId));
      const giftValues = Object.fromEntries((student?.gift_values ?? []).map((gift) => [String(gift.gift_id), gift.relationship_exp]));
      const total = entries.length
        ? calculateGiftBoxesExpectedExp(entries, giftValues)
        : { status: "no_box_quantity", expectedExp: null };
      const perBox = boxes.map((box) => {
        const quantity = Number(state.giftBoxes?.[String(box.id)] ?? 0);
        if (!(quantity > 0)) return null;
        return { box, quantity, result: calculateGiftBoxExpectedExp(box, giftValues, { policy: "best_for_student" }) };
      }).filter(Boolean);
      const studentName = student ? localizedName(student, "student", locale, localization) : t(locale, "unknown");
      return `<article class="gift-box-student-card">
        <div class="gift-box-student-head"><strong>${escapeHtml(studentName)}</strong><span>${escapeHtml(t(locale, "giftBoxExpectedTotal"))}：${total.status === "ready" ? formatExp(total.expectedExp, locale) : "—"}</span></div>
        <div class="gift-box-results">${perBox.length ? perBox.map(({ box, quantity, result }) => `<div class="gift-box-result"><span>${escapeHtml(giftBoxName(box, locale))} ×${formatSmartQuantity(quantity, locale)}</span><span>${result.status === "ready" ? `${escapeHtml(t(locale, "giftBoxPerBox"))} ${formatExp(result.expectedExp, locale)} · ${formatExp(result.expectedExp * quantity, locale)}` : escapeHtml(t(locale, "giftBoxStatus", result.status))}</span></div>`).join("") : `<p class="gift-box-muted">${escapeHtml(t(locale, "giftBoxNoQuantity"))}</p>`}</div>
      </article>`;
    }).join("")
    : `<p class="gift-box-muted" role="status">${escapeHtml(t(locale, "giftBoxNoStudents"))}</p>`;

  return `<section class="gift-box-workspace" aria-labelledby="gift-box-title">
    <div class="section-heading compact"><h2 id="gift-box-title">${escapeHtml(t(locale, "giftBoxTitle"))}</h2></div>
    <div class="gift-box-inventory">${boxes.length ? boxes.map((box) => `<label class="gift-box-input"><span>${escapeHtml(giftBoxName(box, locale))}<small>${escapeHtml(t(locale, "giftBoxStatus", box.status))}${giftBoxPoolLabel(box, locale) ? ` · ${escapeHtml(giftBoxPoolLabel(box, locale))}` : ""}</small></span><input type="number" min="0" step="1" inputmode="numeric" data-gift-box-count="${escapeHtml(box.id)}" value="${Number(state.giftBoxes?.[String(box.id)] ?? 0) || ""}" placeholder="0" aria-label="${escapeHtml(`${t(locale, "giftBoxInput")} ${giftBoxName(box, locale)}`)}"></label>`).join("") : `<p class="gift-box-muted">${escapeHtml(t(locale, "giftBoxNoDefinitions"))}</p>`}</div>
    <p class="gift-box-note">${escapeHtml(t(locale, "giftBoxUnknownNote"))}</p>
    <div class="gift-box-student-list">${studentCards}</div>
  </section>`;
}

export function renderResourcesWorkspace({ data = {}, state, locale, localization, evidence }) {
  const resourcesCaption = t(locale, "resourcesCaption");
  const evidenceById = new Map((evidence?.rows ?? []).map((row) => [row.resource_id, row]));
  const sourceById = new Map((evidence?.sources ?? []).map((source) => [source.id, source]));
  const configured = state.resources.filter((resource) => resource.amount !== null);
  const missing = state.resources.filter((resource) => resource.amount === null);
  const projected = state.resources.reduce((sum, resource) => {
    const forecast = calculateResourceForecast(resource, resource.amount, state.periodDays, data.unlimitedAssaultRewards);
    if (forecast?.kind !== "relationship_exp") return sum;
    return sum + forecast.value;
  }, 0);
  return `<section class="resource-workspace panel" aria-labelledby="resource-title">
    <div class="section-heading"><div class="resource-heading-copy"><h2 id="resource-title">${t(locale, "resourcesTitle")}</h2>${resourcesCaption ? `<p class="section-caption">${escapeHtml(resourcesCaption)}</p>` : ""}</div></div>
    <div class="resource-toolbar"><label><span>${t(locale, "periodDays")}</span><input type="number" min="1" max="366" step="1" data-period-days value="${state.periodDays}"></label><a class="template-link" href="../relationship_data/cn_planner_data_to_fill.md" target="_blank" rel="noreferrer">${t(locale, "fillDataTemplate")}</a></div>
    <div class="resource-kpi-grid"><article><span>${t(locale, "resourceConfigured")}</span><strong>${configured.length}/${state.resources.length}</strong></article><article><span>${t(locale, "effectiveExp")}</span><strong>${formatExp(projected, locale)}</strong></article><article><span>${t(locale, "resourceMissing")}</span><strong>${state.resources.length - configured.length}</strong></article></div>
    ${missing.length ? `<section class="resource-missing-panel" aria-labelledby="resource-missing-title"><div class="resource-missing-heading"><div><span class="resource-missing-kicker">${escapeHtml(t(locale, "resourceMissing"))}</span><h2 id="resource-missing-title">${escapeHtml(t(locale, "resourceMissingTitle"))}</h2></div><span>${missing.length}</span></div><div class="resource-list">${missing.map((resource) => renderResourceRow({ resource, state, data, locale, evidenceById, sourceById })).join("")}</div></section>` : ""}
    ${configured.length ? `<details class="resource-details"><summary>${escapeHtml(t(locale, "resourceInputDetails"))} · ${configured.length}</summary><div class="resource-list">${configured.map((resource) => renderResourceRow({ resource, state, data, locale, evidenceById, sourceById })).join("")}</div></details>` : ""}
    <details class="resource-details"><summary>${escapeHtml(t(locale, "resourceProjectionDetails"))}</summary>${renderManufacturingProjection({ data, state, locale, localization })}${renderRelationshipSourceProjection({ data, state, locale, localization })}${renderGiftBoxWorkspace({ data, state, locale, localization })}</details>
  </section>`;
}
