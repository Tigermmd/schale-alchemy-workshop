import { FUTURE_STUDENTS } from "./future-students.js?v=dashboard-20260817-gift-clean-v54";
import { buildReleaseTimeline } from "./release-state.js?v=dashboard-20260817-gift-clean-v54";
import { getCnGiftPackageCatalog } from "./package-catalog.js?v=dashboard-20260817-gift-clean-v54";

const DATA_ROOT = "../relationship_data";

export const DATA_PATHS = Object.freeze({
  gifts: `${DATA_ROOT}/gifts.json?v=dashboard-20260817-gift-clean-v54`,
  preferences: `${DATA_ROOT}/student_gift_preferences.json?v=dashboard-20260817-gift-clean-v54`,
  crafting: `${DATA_ROOT}/crafting_expected_relationship.json?v=dashboard-20260817-gift-clean-v54`,
  thresholds: `${DATA_ROOT}/relationship_thresholds.json?v=dashboard-20260817-gift-clean-v54`,
  packages: `${DATA_ROOT}/paid_packages_cn.json?v=dashboard-20260817-gift-clean-v54`,
  giftBoxes: `${DATA_ROOT}/gift_boxes_cn.json?v=dashboard-20260817-gift-clean-v54`,
  unlimitedAssaultRewards: `${DATA_ROOT}/unlimited_assault_rewards_cn.json?v=dashboard-20260817-gift-clean-v54`,
  resourceEvidence: `${DATA_ROOT}/resource_evidence_cn.json?v=dashboard-20260817-gift-clean-v54`,
  localization: `${DATA_ROOT}/localization.json?v=dashboard-20260817-gift-clean-v54`,
  releaseTimeline: `${DATA_ROOT}/jp_release_timeline.json?v=dashboard-20260817-gift-clean-v54`,
});

async function fetchJson(path) {
  const response = await fetch(path, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }
  return response.json();
}

async function fetchOptionalJson(path) {
  try {
    const response = await fetch(path, { headers: { Accept: "application/json" } });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

export async function loadDashboardData() {
  const [giftSnapshot, preferenceSnapshot, craftingSnapshot, thresholdSnapshot, packageSnapshot, giftBoxSnapshot, unlimitedAssaultRewards, resourceEvidence, localization, releaseTimelineSnapshot, assetManifest] = await Promise.all([
    fetchJson(DATA_PATHS.gifts),
    fetchJson(DATA_PATHS.preferences),
    fetchJson(DATA_PATHS.crafting),
    fetchJson(DATA_PATHS.thresholds),
    fetchJson(DATA_PATHS.packages),
    fetchJson(DATA_PATHS.giftBoxes),
    fetchJson(DATA_PATHS.unlimitedAssaultRewards),
    fetchJson(DATA_PATHS.resourceEvidence),
    fetchJson(DATA_PATHS.localization),
    fetchJson(DATA_PATHS.releaseTimeline),
    fetchOptionalJson("./assets/manifest.json?v=dashboard-20260817-gift-clean-v54"),
  ]);

  const gifts = giftSnapshot.gifts;
  const students = preferenceSnapshot.students;
  const plannerStudents = [...students, ...FUTURE_STUDENTS.filter((future) => !students.some((student) => student.student_id === future.student_id))];
  const releaseTimeline = (releaseTimelineSnapshot?.students ?? []).map((entry) => ({
    ...entry,
    studentId: Number(entry.studentId),
    jpRank: Number(entry.jpRank),
    jpReleaseDate: entry.jpReleaseDate ?? null,
    sources: Array.isArray(entry.sources) ? entry.sources : [releaseTimelineSnapshot?.source ?? "SchaleDB JP student order snapshot"],
    asOf: entry.asOf ?? releaseTimelineSnapshot?.asOf ?? null,
  }));
  const plannerStudentById = new Map(plannerStudents.map((student) => [String(student.student_id), student]));
  const cutoffStudents = releaseTimeline.map((entry) => plannerStudentById.get(String(entry.studentId)) ?? {
    student_id: entry.studentId,
    name_zh_cn: entry.name_ja ?? "未知学生",
    name_en: entry.name_ja ?? "Unknown student",
    name_ja: entry.name_ja ?? "不明な生徒",
    timeline_only: true,
  });
  const craftingStudents = craftingSnapshot.students;
  const craftingById = new Map(
    craftingStudents.map((student) => [String(student.student_id), student]),
  );
  // SchaleDB stores costume variants such as Swimsuit Mika under the base
  // student's crafting row. Keep the future variant addressable by its own
  // student ID so the planner does not fall back to a generic estimate.
  for (const student of plannerStudents) {
    const sourceId = student.preference_source_student_id;
    if (sourceId && !craftingById.has(String(student.student_id)) && craftingById.has(String(sourceId))) {
      craftingById.set(String(student.student_id), craftingById.get(String(sourceId)));
    }
  }

  return {
    gifts,
    giftBoxes: giftBoxSnapshot.boxes,
    giftById: new Map(gifts.map((gift) => [String(gift.id), gift])),
    students,
    studentById: new Map(plannerStudents.map((student) => [String(student.student_id), student])),
    cutoffStudents,
    cutoffStudentById: new Map(cutoffStudents.map((student) => [String(student.student_id), student])),
    plannerStudents,
    releaseTimeline,
    packageCatalog: getCnGiftPackageCatalog(packageSnapshot),
    futureStudents: FUTURE_STUDENTS,
    craftingById,
    snapshots: {
      gift: giftSnapshot,
      preference: preferenceSnapshot,
      crafting: craftingSnapshot,
      thresholds: thresholdSnapshot,
      packages: packageSnapshot,
      giftBoxes: giftBoxSnapshot,
      unlimitedAssaultRewards,
      resourceEvidence,
      releaseTimeline: releaseTimelineSnapshot,
    },
    localization,
    assetManifest,
  };
}
