import { calculateRequiredRelationshipExp, planGiftAllocation } from "./planner-state.js?v=dashboard-20260814-rebuild-v43";
import { getAvailableGiftInventory } from "./inventory-state.js?v=dashboard-20260814-rebuild-v43";
import { calculatePlanningSummary } from "./planning-summary.js?v=dashboard-20260814-rebuild-v43";
import { localizedName, text as t } from "./i18n.js?v=dashboard-20260814-rebuild-v43";
import { formatExp, formatInteger } from "./render.js?v=dashboard-20260814-rebuild-v43";
import { getEligibleRelationshipSources } from "./release-state.js?v=dashboard-20260814-rebuild-v43";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function assetLocal(data, key, fallback) {
  return data?.assetManifest?.entries?.[key]?.local ?? fallback;
}

function giftImage(gift, manifest, locale, localization) {
  const name = localizedName(gift, "gift", locale, localization);
  const source = manifest?.entries?.[`gift:${gift.id}`];
  return `<span class="planner-gift-image"><img src="${escapeHtml(source?.local ?? `./assets/gifts/${gift.id}.webp`)}" data-fallback="${escapeHtml(source?.remote ?? "")}" alt="${escapeHtml(name)}" loading="lazy"><span aria-hidden="true">${escapeHtml(name.slice(0, 1))}</span></span>`;
}

function studentImage(student, manifest, locale, localization, className = "planner-student-photo") {
  if (!student) return `<span class="${className} is-fallback" aria-hidden="true">?</span>`;
  const name = localizedName(student, "student", locale, localization);
  const source = manifest?.entries?.[`student:${student.student_id}`]
    ?? manifest?.entries?.[`student-collection:${student.student_id}`];
  const fallbackLocal = student.future_only === true
    ? `./assets/students/collection/${student.student_id}.webp`
    : `./assets/students/${student.student_id}.webp`;
  const fallbackRemote = student.future_only === true
    ? `https://schaledb.com/images/student/collection/${student.student_id}.webp`
    : `https://schaledb.com/images/student/icon/${student.student_id}.webp`;
  return `<span class="${className}"><img src="${escapeHtml(source?.local ?? fallbackLocal)}" data-fallback="${escapeHtml(source?.remote ?? fallbackRemote)}" alt="${escapeHtml(name)}" loading="lazy"><span aria-hidden="true">${escapeHtml(name.slice(0, 1))}</span></span>`;
}

export function plannerStudentLabel(student, locale, localization) {
  return localizedName(student, "student", locale, localization);
}

function plannerStudentSearchText(student, localization) {
  return [
    student?.student_id,
    student?.name_zh_cn,
    student?.name_zh,
    student?.name_en,
    student?.name_ja,
    ...["zh_cn", "en", "ja"].map((locale) => localizedName(student, "student", locale, localization)),
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

export function filterPlannerStudents(students, query, localization) {
  const normalizedQuery = String(query ?? "").trim().toLocaleLowerCase();
  if (!normalizedQuery) return [...(students ?? [])];
  return (students ?? []).filter((student) => plannerStudentSearchText(student, localization).includes(normalizedQuery));
}

export function renderPlannerStudentOptions({ students, query, locale, localization }) {
  const matches = filterPlannerStudents(students, query, localization);
  if (!matches.length) return `<span class="planner-student-no-match" role="status">${escapeHtml(t(locale, "plannerStudentNoMatches"))}</span>`;
  return matches.map((student, index) => {
    const label = plannerStudentLabel(student, locale, localization);
    return `<button type="button" id="planner-student-option-${student.student_id}-${index}" class="planner-student-option" role="option" aria-selected="false" data-planner-student-option="${student.student_id}" data-planner-student-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
  }).join("");
}

export function getGiftOnlyPlanningStudents({ data = {}, state = {} } = {}) {
  const students = data?.plannerStudents ?? data?.students ?? [];
  const plans = Array.isArray(state?.students) ? state.students : [];
  return plans.map((plan) => {
    const student = data?.studentById?.get(String(plan.studentId))
      ?? students.find((item) => Number(item.student_id) === Number(plan.studentId));
    const release = getEligibleRelationshipSources(plan.studentId, state?.cnProgress, data?.releaseTimeline ?? []);
    return { plan, student, release };
  }).filter(({ release }) => release.giftOnly);
}

function studentPicker(data, state, locale, localization, editingPlan = null) {
  const firstPlan = editingPlan ?? state.students?.[0];
  const firstStudent = firstPlan ? data.studentById.get(String(firstPlan.studentId)) : null;
  const displayValue = firstStudent ? plannerStudentLabel(firstStudent, locale, localization) : "";
  const options = renderPlannerStudentOptions({ students: data.plannerStudents ?? data.students, query: "", locale, localization });
  return `<label class="planner-student-picker"><span>${t(locale, "plannerStudent")}</span><div class="planner-student-combobox"><input name="studentSearch" data-planner-student-search type="search" value="${escapeHtml(displayValue)}" placeholder="${escapeHtml(t(locale, "plannerStudentSearchPlaceholder"))}" autocomplete="off" required role="combobox" aria-controls="planner-student-options" aria-expanded="false" aria-autocomplete="list" aria-activedescendant="" aria-describedby="planner-student-search-hint"><input name="studentId" type="hidden" value="${escapeHtml(firstStudent?.student_id ?? "")}"><div id="planner-student-options" class="planner-student-options" data-planner-student-options role="listbox" hidden>${options}</div></div><small id="planner-student-search-hint">${t(locale, "plannerStudentSearchHint")}</small></label>`;
}

export function prepareAllocation(data, state, thresholds) {
  const plannedStudents = state.students.map((plan) => {
    const student = data.studentById.get(String(plan.studentId));
    const requiredExp = calculateRequiredRelationshipExp(
      plan.currentLevel,
      plan.currentProgress,
      plan.targetLevel,
      thresholds,
    );
    return { ...plan, name: student?.name_en ?? student?.name_zh_cn ?? "Unknown student", requiredExp };
  });
  const giftValuesByStudent = new Map();
  for (const plan of state.students) {
    const student = data.studentById.get(String(plan.studentId));
    giftValuesByStudent.set(plan.id, Object.fromEntries((student?.gift_values ?? []).map((value) => [String(value.gift_id), value.relationship_exp])));
  }
  return {
    students: plannedStudents,
    allocation: planGiftAllocation({
      students: plannedStudents,
      inventory: getAvailableGiftInventory(state),
      giftById: data.giftById,
      giftValuesByStudent,
    }),
  };
}

export function renderWorkbenchTabs({ locale, active }) {
  const tabs = [
    ["planner", t(locale, "workbenchPlanner"), "⌂"],
    ["inventory", t(locale, "workbenchInventory"), "▣"],
    ["resources", t(locale, "workbenchResources"), "◒"],
    ["packages", t(locale, "workbenchPackages"), "◇"],
    ["relationship", t(locale, "workbenchRelationship"), "◈"],
    ["agent", t(locale, "workbenchAgent"), "✦"],
  ];
  return `<nav class="workbench-tabs" aria-label="${escapeHtml(t(locale, "workbenchPlanner"))}">${tabs.map(([id, label, icon]) => `<button type="button" class="workbench-tab ${id === active ? "is-active" : ""}" data-workbench="${id}" data-nav-icon="${escapeHtml(icon)}" aria-current="${id === active ? "page" : "false"}">${escapeHtml(label)}</button>`).join("")}</nav>`;
}

export function renderPlannerWorkspace({ data, state, locale, localization }) {
  const thresholds = data.snapshots.thresholds;
  const editingPlan = state.students?.[0] ?? null;
  const mainPlan = state.students?.find((plan) => String(plan.studentId) === String(state.mainTargetStudentId)) ?? state.students?.[0] ?? null;
  const mainStudent = mainPlan ? data.studentById.get(String(mainPlan.studentId)) : null;
  const { allocation } = prepareAllocation(data, state, thresholds);
  const summary = calculatePlanningSummary({ state, targets: state.students, mainTargetId: state.mainTargetStudentId, forecastDays: state.forecastDays, data });
  const summaryByStudent = new Map(summary.students.map((item) => [String(item.studentId), item]));
  const orderedPlans = [...state.students].sort((left, right) => Number(left.studentId) === Number(state.mainTargetStudentId) ? -1 : Number(right.studentId) === Number(state.mainTargetStudentId) ? 1 : 0);
  const visualAssets = {
    title: assetLocal(data, "ui:arona-title-new", "./assets/ui/arona-title-new.webp"),
    options: assetLocal(data, "ui:kivo-options", "./assets/ui/kivo-options.webp"),
    empty: assetLocal(data, "ui:kivo-empty", "./assets/ui/kivo-empty.webp"),
    favicon: assetLocal(data, "ui:arona-favicon", "./assets/ui/arona.jpg"),
    stageOne: assetLocal(data, "ui:stage-mission-1-normal", "./assets/ui/stages/mission_1_0.webp"),
    stageOneAlt: assetLocal(data, "ui:stage-mission-1-alternate", "./assets/ui/stages/mission_1_1.webp"),
    stageFour: assetLocal(data, "ui:stage-mission-4-normal", "./assets/ui/stages/mission_4_0.webp"),
    stageFourAlt: assetLocal(data, "ui:stage-mission-4-alternate", "./assets/ui/stages/mission_4_1.webp"),
    targetPortrait: mainStudent
      ? assetLocal(data, `student-portrait:${mainStudent.student_id}`, `./assets/students/portrait/${mainStudent.student_id}.webp`)
      : null,
  };
  const plannerForm = `<details class="planner-edit-details" ${state.students.length ? "" : "open"}><summary>${escapeHtml(t(locale, state.students.length ? "planningEdit" : "planningAddFirst"))}</summary><form class="planner-student-form" id="planner-student-form">
      ${studentPicker(data, state, locale, localization, state.students?.[0] ?? null)}
      <label><span>${t(locale, "currentLevel")}</span><input name="currentLevel" type="number" min="1" max="100" step="1" value="${editingPlan?.currentLevel ?? 1}" required></label>
      <label><span>${t(locale, "currentProgress")}</span><input name="currentProgress" type="number" min="0" step="1" value="${editingPlan?.currentProgress ?? 0}" required></label>
      <label><span>${t(locale, "targetLevel")}</span><input name="targetLevel" type="number" min="1" max="100" step="1" value="${editingPlan?.targetLevel ?? 50}" required></label>
      <button class="primary-button" type="submit">${t(locale, "addStudent")}</button>
    </form></details>`;
  return `<section class="planner-workspace panel" aria-labelledby="planner-title">
    <div class="planner-hero">
      <div class="planner-hero-copy"><h1 id="planner-title">${t(locale, "plannerTitle")}</h1><p>${escapeHtml(t(locale, "plannerCaption"))}</p>${mainStudent ? `<div class="planner-hero-target">${studentImage(mainStudent, data.assetManifest, locale, localization)}<span><strong>${escapeHtml(localizedName(mainStudent, "student", locale, localization))}</strong><small>${escapeHtml(t(locale, "currentLevel"))} ${formatInteger(mainPlan.currentLevel, locale)} → ${escapeHtml(t(locale, "targetLevel"))} ${formatInteger(mainPlan.targetLevel, locale)}</small></span></div>` : `<div class="planner-hero-empty">${escapeHtml(t(locale, "noPlannedStudents"))}</div>`}</div>
      <div class="planner-hero-art" aria-hidden="true"><div class="planner-hero-stage-strip"><img src="${escapeHtml(visualAssets.stageOne)}" alt="" loading="lazy"><img src="${escapeHtml(visualAssets.stageOneAlt)}" alt="" loading="lazy"><img src="${escapeHtml(visualAssets.stageFour)}" alt="" loading="lazy"><img src="${escapeHtml(visualAssets.stageFourAlt)}" alt="" loading="lazy"></div>${visualAssets.targetPortrait ? `<img class="planner-hero-target-portrait" src="${escapeHtml(visualAssets.targetPortrait)}" alt="" loading="lazy">` : ""}<div class="planner-hero-art-stack"><img class="planner-hero-art-options" src="${escapeHtml(visualAssets.options)}" alt="" loading="lazy"><img class="planner-hero-art-empty" src="${escapeHtml(visualAssets.empty)}" alt="" loading="lazy"></div><span class="planner-hero-stamp"><img src="${escapeHtml(visualAssets.favicon)}" alt=""></span><img class="planner-hero-art-title" src="${escapeHtml(visualAssets.title)}" alt="" loading="lazy"></div>
      <label class="planner-forecast-days"><span>${escapeHtml(t(locale, "planningForecastDays"))}</span><input type="number" min="1" max="366" step="1" value="${summary.forecastDays}" data-planner-forecast-days aria-label="${escapeHtml(t(locale, "planningForecastDays"))}"></label>
    </div>
    <div class="planner-subsection"><div class="section-heading compact"><h2>${t(locale, "plannedStudents")}</h2></div>${state.students.length ? `<div class="planner-result-list">${orderedPlans.map((plan) => {
      const student = data.studentById.get(String(plan.studentId));
      const result = summaryByStudent.get(String(plan.studentId));
      const sourceNote = result?.releaseStatus === "released" ? "" : t(locale, "planningGiftOnlyShort");
      const daily = result?.freeExpPerDay ?? 0;
      const days = result?.estimatedDays === null ? t(locale, "planningDaysUnknown") : `${formatInteger(result?.estimatedDays ?? 0, locale)} ${t(locale, "planningDaysUnit")}`;
      const requiredExp = result?.requiredExp ?? 0;
      return `<article class="planner-result-card ${result?.isMainTarget ? "is-main" : ""}"><div class="planner-result-head"><div class="planner-result-identity">${studentImage(student, data.assetManifest, locale, localization)}<div><strong>${escapeHtml(localizedName(student, "student", locale, localization))}</strong><small>${t(locale, "currentLevel")} ${formatInteger(plan.currentLevel, locale)} → ${t(locale, "targetLevel")} ${formatInteger(plan.targetLevel, locale)}</small>${sourceNote ? `<small class="planner-result-warning">${escapeHtml(sourceNote)}</small>` : ""}</div></div><div class="planner-result-actions">${result?.isMainTarget ? `<span class="planner-main-badge">${escapeHtml(t(locale, "planningMainTarget"))}</span>` : `<button type="button" class="text-button" data-set-main-target="${escapeHtml(plan.studentId)}">${escapeHtml(t(locale, "planningSetMain"))}</button>`}</div></div><div class="planner-result-kpis"><div class="planner-result-gap"><span>${escapeHtml(t(locale, "planningGap"))}</span><strong>${formatExp(result?.gapWithinPeriod ?? 0, locale)}</strong><small>${escapeHtml(t(locale, "planningGapHint", summary.forecastDays))}</small></div><div><span>${escapeHtml(t(locale, "planningEstimatedDays"))}</span><strong>${escapeHtml(days)}</strong><small>${escapeHtml(t(locale, "planningDailyRate", formatExp(daily, locale)))}</small></div><div><span>${escapeHtml(t(locale, "planningCurrentExp"))}</span><strong>${formatExp(result?.currentExp ?? 0, locale)}</strong><small>${escapeHtml(t(locale, "planningFreeExp", formatExp(result?.freeExp ?? 0, locale)))}</small></div></div>${result?.isMainTarget && allocation.assignments.length ? `<button type="button" class="primary-button planner-quick-reserve" data-reserve-allocation>${escapeHtml(t(locale, "reserveAllocation"))}</button>` : ""}<details class="planner-result-details"><summary>${escapeHtml(t(locale, "planningDetails"))}</summary><div class="planner-detail-grid"><span>${escapeHtml(t(locale, "requiredExp"))}<b>${formatExp(requiredExp, locale)}</b></span><span>${escapeHtml(t(locale, "planningTotalExp"))}<b>${formatExp(result?.totalExpectedExp ?? 0, locale)}</b></span><span>${escapeHtml(t(locale, "planningMainResource"))}<b>${result?.isMainTarget ? escapeHtml(t(locale, "planningSharedResourcesIncluded")) : escapeHtml(t(locale, "planningGiftsOnlyUntilMain"))}</b></span></div></details><button type="button" class="text-button planner-remove-button" data-remove-plan="${escapeHtml(plan.id)}">${escapeHtml(t(locale, "remove"))}</button></article>`;
    }).join("")}</div>` : `<div class="planner-empty" role="status"><strong>${escapeHtml(t(locale, "noPlannedStudents"))}</strong><span>${escapeHtml(t(locale, "addStudent"))}</span></div>`}</div>
    ${allocation.assignments.length ? `<details class="planner-section planner-allocation-details"><summary>${escapeHtml(t(locale, "planningAllocationDetails"))}</summary><div class="planner-allocation-list">${allocation.students.map((student) => `<article class="planner-allocation-row"><div><strong>${escapeHtml(student.name)}</strong><small>${t(locale, "allocated")} ${formatExp(student.effectiveExp, locale)} · ${t(locale, "unmetExp")} ${formatExp(student.unmetExp, locale)}</small></div><div class="planner-assignment-tags">${student.assignments.map((assignment) => { const gift = data.giftById.get(String(assignment.giftId)); return `<span class="planner-assignment-tag">${giftImage(gift, data.assetManifest, locale, localization)} ${escapeHtml(localizedName(gift, "gift", locale, localization))} ×${assignment.quantity}</span>`; }).join("")}</div></article>`).join("")}</div><div class="planner-allocation-actions"><button type="button" class="primary-button" data-reserve-allocation>${t(locale, "reserveAllocation")}</button></div></details>` : ""}
    ${plannerForm}
  </section>`;
}

export function wirePlannerImageFallbacks(container) {
  container.querySelectorAll("img[data-fallback]").forEach((image) => image.addEventListener("error", () => {
    if (image.dataset.remoteTried !== "true" && image.dataset.fallback) {
      image.dataset.remoteTried = "true";
      image.src = image.dataset.fallback;
      return;
    }
    image.hidden = true;
    image.closest(".planner-gift-image, .planner-student-photo")?.classList.add("is-broken");
  }));
}
