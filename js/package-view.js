import { calculatePackageEfficiency } from "./planning-summary.js?v=dashboard-20260814-rebuild-v43";
import { localizedName, text as t } from "./i18n.js?v=dashboard-20260814-rebuild-v43";
import { formatExp, formatInteger, formatQuantity } from "./render.js?v=dashboard-20260814-rebuild-v43";

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

function packageName(item, locale) {
  if (locale === "en") return item?.name_en ?? item?.name_zh_cn ?? "";
  if (locale === "ja") return item?.name_ja ?? item?.name_en ?? item?.name_zh_cn ?? "";
  return item?.name_zh_cn ?? item?.name_en ?? "";
}

function contentName(item, locale) {
  if (locale === "en") return item?.name_en ?? item?.name_zh_cn ?? "";
  if (locale === "ja") return item?.name_ja ?? item?.name_en ?? item?.name_zh_cn ?? "";
  return item?.name_zh_cn ?? item?.name_en ?? "";
}

function packageNote(item, locale) {
  const suffix = locale === "en" ? "en" : locale === "ja" ? "ja" : "zh_cn";
  return item?.gift_binding?.[`note_${suffix}`] ?? item?.gift_binding?.note_zh_cn ?? item?.note ?? "";
}

export function catalogPackageDraft(item, locale) {
  return {
    name: packageName(item, locale),
    price: Number(item?.price_cny || 0),
    limit: Number(item?.purchase_limit || 0),
    contents: (item?.contents ?? []).map((content) => `${contentName(content, locale)} ×${content.quantity}`).join("；"),
  };
}

function selectedStudentLabel(student, locale, localization) {
  if (!student) return t(locale, "packageNoTarget");
  return localizedName(student, "student", locale, localization);
}

function targetStudentOptions({ students = [], selectedId, locale, localization }) {
  return students.map((plan) => {
    const student = plan?.student ?? plan;
    if (!student?.student_id) return "";
    const label = selectedStudentLabel(student, locale, localization);
    return `<option value="${escapeHtml(student.student_id)}" ${String(student.student_id) === String(selectedId) ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function phaseLabel(row, locale) {
  return row.timelineId === "mika-launch" ? t(locale, "packageLaunchPhase") : t(locale, "packageCurrentPhase");
}

function contentIcon(content, data) {
  const gift = data?.giftById?.get(String(content?.item_id));
  if (gift) {
    const source = data?.assetManifest?.entries?.[`gift:${gift.id}`];
    return `<img src="${escapeHtml(source?.local ?? `./assets/gifts/${gift.id}.webp`)}" data-fallback="${escapeHtml(source?.remote ?? "")}" alt="" loading="lazy">`;
  }
  if (content?.kind === "student_favorite_gift") {
    const source = data?.assetManifest?.entries?.["ui:kivo-favor"];
    return source ? `<img src="${escapeHtml(source.local)}" alt="" loading="lazy">` : `<span class="package-content-glyph" aria-hidden="true">♡</span>`;
  }
  return `<span class="package-content-glyph" aria-hidden="true">▧</span>`;
}

function contentsHtml(item, locale, data) {
  const contents = item?.contents ?? [];
  if (!contents.length) return `<span class="package-content-muted">${escapeHtml(t(locale, "packageContentsUnknown"))}</span>`;
  return contents.map((content) => `<span class="package-content-item">${contentIcon(content, data)}<span>${escapeHtml(contentName(content, locale))} ×${escapeHtml(formatQuantity(content.quantity, locale))}</span></span>`).join("");
}

function breakdownHtml(row, locale) {
  const values = [
    ["packageGoldExp", row.goldGiftExp],
    ["packagePurpleExp", row.purpleGiftExp],
    ["packageBouquetExp", row.bouquetExp],
    ["packageChoiceBoxExp", row.choiceBoxExp],
    ["packageRandomBoxExp", row.randomBoxExp],
    ["packageManufacturingExp", row.manufacturingExp],
    ["packageSynthesisExp", row.synthesisExp],
  ].filter(([, value]) => Number(value) > 0);
  return values.length
    ? values.map(([key, value]) => `<span>${escapeHtml(t(locale, key))} ${formatExp(value, locale)}</span>`).join("")
    : `<span>${escapeHtml(t(locale, "packageNoGiftExp"))}</span>`;
}

function packageRow({ row, item, locale, rank = null, data }) {
  const available = Number(row.availablePurchases ?? 0);
  const limit = Number(row.purchaseLimit ?? 0);
  const purchased = Number(row.purchasedCount ?? 0);
  const efficiency = row.expPerYuan === null ? t(locale, "unknown") : formatExp(row.expPerYuan, locale);
  return `<article class="package-efficiency-row">
    <div class="package-efficiency-head">
      ${rank ? `<span class="package-rank" aria-label="#${rank}">#${rank}</span>` : ""}
      <div><strong>${escapeHtml(packageName(item, locale) || row.name)}</strong><small>${escapeHtml(phaseLabel(row, locale))} · ${escapeHtml(t(locale, "packageCategoryName", item?.category ?? "gifts"))}</small></div>
      <span class="package-efficiency-rate"><b>${escapeHtml(efficiency)}</b><small>${escapeHtml(t(locale, "packageExpPerYuan"))}</small></span>
    </div>
    <div class="package-efficiency-kpis">
      <div><span>${escapeHtml(t(locale, "packagePrice"))}</span><b>¥${formatInteger(row.price || 0, locale)}</b></div>
      <div><span>${escapeHtml(t(locale, "packageExpectedExp"))}</span><b>${formatExp(row.expectedExp, locale)}</b></div>
      <div><span>${escapeHtml(t(locale, "packageAvailable"))}</span><b>${formatQuantity(available, locale)} / ${formatQuantity(limit, locale)}</b></div>
      <div><span>${escapeHtml(t(locale, "packagePurchased"))}</span><b>${formatQuantity(purchased, locale)}</b></div>
    </div>
    <details class="package-details"><summary>${escapeHtml(t(locale, "packageDetails"))}</summary><div class="package-contents">${contentsHtml(item, locale, data)}</div><div class="package-efficiency-breakdown">${breakdownHtml(row, locale)}</div>
    ${packageNote(item, locale) ? `<p class="package-catalog-note">${escapeHtml(packageNote(item, locale))}</p>` : ""}
    <div class="package-catalog-actions">${item?.source ? `<a href="${escapeHtml(item.source)}" target="_blank" rel="noreferrer">${escapeHtml(t(locale, "packageSource"))} ↗</a>` : ""}<span class="package-snapshot-date">${escapeHtml(t(locale, "packageAsOf", row.asOf ?? "—"))}</span></div></details>
  </article>`;
}

export function renderPackagesWorkspace({ data = {}, state = {}, locale, localization, selectedStudentId = null }) {
  const catalog = data.packageCatalog ?? data.snapshots?.packages ?? {};
  const plannedStudents = (state.students ?? []).map((plan) => ({ plan, student: data.studentById?.get(String(plan.studentId)) })).filter(({ student }) => student);
  const targetId = selectedStudentId ?? state.mainTargetStudentId;
  const target = plannedStudents.find(({ student }) => String(student.student_id) === String(targetId)) ?? plannedStudents[0];
  const targetStudent = target?.student ?? null;
  const rows = targetStudent
    ? calculatePackageEfficiency({
      student: targetStudent,
      packageCatalog: catalog,
      packagePlans: state.packagePlans,
      giftBoxes: data.giftBoxes ?? data.snapshots?.giftBoxes?.boxes ?? [],
      manufacturingData: data.craftingById?.get(String(targetStudent.student_id)),
      periodDays: state.forecastDays,
    })
    : [];
  const catalogItems = new Map((catalog.packages ?? []).map((item) => [String(item.id), item]));
  const rankedRows = [...rows].sort((left, right) => (right.expPerYuan ?? -1) - (left.expPerYuan ?? -1));
  const topRows = rankedRows.slice(0, 3);
  const remainingRows = rankedRows.slice(3);
  const visualAssets = {
    arona: assetLocal(data, "ui:arona-title-new", "./assets/ui/arona-title-new.webp"),
    options: assetLocal(data, "ui:kivo-options", "./assets/ui/kivo-options.webp"),
    kivo: assetLocal(data, "ui:kivo-logo", "./assets/ui/kivo-logo.svg"),
    aronaIcon: assetLocal(data, "ui:arona-favicon", "./assets/ui/arona.jpg"),
    target: targetStudent
      ? assetLocal(data, `student-collection:${targetStudent.student_id}`, `./assets/students/collection/${targetStudent.student_id}.webp`)
      : null,
    stage: assetLocal(data, "ui:stage-mission-6-normal", "./assets/ui/stages/mission_6_0.webp"),
    stageAlt: assetLocal(data, "ui:stage-mission-6-alternate", "./assets/ui/stages/mission_6_1.webp"),
  };
  return `<section class="package-workspace panel" aria-labelledby="package-title">
    <div class="section-heading package-page-heading"><div><h1 id="package-title">${escapeHtml(t(locale, "packagesTitle"))}</h1><label class="package-target-picker"><span>${escapeHtml(t(locale, "packageTarget"))}</span><select data-package-target-student ${plannedStudents.length ? "" : "disabled"} aria-label="${escapeHtml(t(locale, "packageTarget"))}">${plannedStudents.length ? targetStudentOptions({ students: plannedStudents, selectedId: targetStudent?.student_id, locale, localization }) : `<option>${escapeHtml(t(locale, "packageNoTarget"))}</option>`}</select></label></div></div>
    <div class="package-visual-anchors" aria-hidden="true"><div class="package-visual-stage"><img src="${escapeHtml(visualAssets.stage)}" alt="" loading="lazy"><img src="${escapeHtml(visualAssets.stageAlt)}" alt="" loading="lazy"></div><div class="package-visual-ribbon"><img src="${escapeHtml(visualAssets.options)}" alt="" loading="lazy"></div><div class="package-visual-characters">${visualAssets.target ? `<img class="package-visual-target" src="${escapeHtml(visualAssets.target)}" alt="" loading="lazy">` : ""}<img class="package-visual-arona" src="${escapeHtml(visualAssets.arona)}" alt="" loading="lazy"><img class="package-visual-kivo" src="${escapeHtml(visualAssets.kivo)}" alt="" loading="lazy"><img class="package-visual-arona-icon" src="${escapeHtml(visualAssets.aronaIcon)}" alt="" loading="lazy"></div></div>
    ${!targetStudent ? `<div class="planner-empty" role="status"><strong>${escapeHtml(t(locale, "packageNoTarget"))}</strong><button type="button" class="primary-button" data-go-planner>${escapeHtml(t(locale, "packageGoPlanner"))}</button></div>` : topRows.length ? `<section class="package-efficiency-section package-top-section" aria-labelledby="package-top-title"><div class="package-section-heading"><h2 id="package-top-title">${escapeHtml(t(locale, "packageTopTitle"))}</h2></div><div class="package-efficiency-list">${topRows.map((row, index) => packageRow({ row, item: catalogItems.get(String(row.packageId)), locale, rank: index + 1, data })).join("")}</div></section>` : ""}
    ${targetStudent && remainingRows.length ? `<details class="package-all-details"><summary>${escapeHtml(t(locale, "packageAllTitle"))} · ${remainingRows.length}</summary><div class="package-efficiency-list">${remainingRows.map((row, index) => packageRow({ row, item: catalogItems.get(String(row.packageId)), locale, rank: index + 4, data })).join("")}</div></details>` : ""}
    ${targetStudent && !rows.length ? `<div class="planner-empty" role="status">${escapeHtml(t(locale, "packageNoRows"))}</div>` : ""}
  </section>`;
}
