import { calculateGiftBoxExpectedExp } from "./gift-box-state.js?v=dashboard-20260817-inventory-v52";
import { getAvailableGiftInventory } from "./inventory-state.js?v=dashboard-20260817-inventory-v52";
import { calculateGiftOnlyForecast, calculatePaidGiftPackageExp, partitionGiftPackagesForTimeline } from "./gift-only-planner.js?v=dashboard-20260817-inventory-v52";
import { calculateRequiredRelationshipExp, planGiftAllocation } from "./planner-state.js?v=dashboard-20260817-inventory-v52";
import { getEligibleRelationshipSources } from "./release-state.js?v=dashboard-20260817-inventory-v52";

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function integerOr(value, fallback = 0) {
  return Math.floor(numberOr(value, fallback));
}

function mapEntries(value) {
  return Object.fromEntries(Object.entries(value && typeof value === "object" ? value : {}).map(([key, item]) => [String(key), numberOr(item)]));
}

function valueFor(collection, id) {
  if (collection instanceof Map) return collection.get(String(id)) ?? collection.get(Number(id));
  if (Array.isArray(collection)) return collection.find((item) => String(item?.id) === String(id));
  return collection?.[String(id)] ?? collection?.[Number(id)];
}

function studentValues(student) {
  return Object.fromEntries((student?.gift_values ?? []).map((item) => [String(item.gift_id), numberOr(item.relationship_exp)]));
}

function boxExp(giftBoxes, id, student) {
  const box = valueFor(giftBoxes, id);
  if (!box || !student) return 0;
  const result = calculateGiftBoxExpectedExp(box, studentValues(student), { policy: "best_for_student" });
  return result.status === "ready" ? numberOr(result.expectedExp) : 0;
}

function periodDaysOf(value, fallback = 60) {
  return Math.min(366, Math.max(1, integerOr(value, fallback)));
}

function targetStudent(data, plan) {
  return valueFor(data?.studentById, plan?.studentId)
    ?? (data?.plannerStudents ?? data?.students ?? []).find((student) => Number(student.student_id) === Number(plan?.studentId));
}

function buildAllocation({ plans, data, state }) {
  const students = plans.map((plan) => {
    const student = targetStudent(data, plan);
    return {
      ...plan,
      id: plan.id,
      name: student?.name_en ?? student?.name_zh_cn ?? String(plan.studentId),
      requiredExp: calculateRequiredRelationshipExp(plan.currentLevel, plan.currentProgress, plan.targetLevel, data?.snapshots?.thresholds ?? data?.thresholds),
    };
  });
  const giftValuesByStudent = new Map(students.map((plan) => {
    const student = targetStudent(data, plan);
    return [String(plan.id), studentValues(student)];
  }));
  return planGiftAllocation({
    students,
    inventory: getAvailableGiftInventory(state),
    giftById: data?.giftById,
    giftValuesByStudent,
  });
}

function activePosting(state, resourceId, periodDays) {
  return (state?.resourcePostingHistory ?? []).some((item) => item?.active !== false && item.postingKey === `${resourceId}:${periodDays}`);
}

function currentPeriodIncoming(state, periodDays) {
  const result = {
    giftBoxes: {},
    equivalentGiftPools: {},
    stockResources: {},
    relationshipExp: {},
  };
  for (const item of state?.resourcePostingHistory ?? []) {
    if (item?.active === false || Number(item.periodDays) !== Number(periodDays)) continue;
    for (const bucket of Object.keys(result)) {
      for (const [id, value] of Object.entries(item.mapped?.[bucket] ?? {})) {
        result[bucket][String(id)] = numberOr(result[bucket][String(id)]) + numberOr(value);
      }
    }
  }
  return result;
}

function dailyRelationshipExp(state, studentId, periodDays, data) {
  const release = getEligibleRelationshipSources(studentId, state?.cnProgress, data?.releaseTimeline ?? []);
  if (release.giftOnly) return { scheduleExp: 0, cafeExp: 0, totalExp: 0 };
  const incoming = state?.incomingResources?.relationshipExp ?? {};
  const result = { scheduleExp: 0, cafeExp: 0, totalExp: 0 };
  for (const resource of state?.resources ?? []) {
    if (resource?.cadence !== "daily" || resource?.unit !== "relationship_exp") continue;
    const allowed = resource.id === "daily-schedule-exp" ? release.includeSchedule : resource.id === "daily-cafe-exp" ? release.includeCafe : false;
    if (!allowed) continue;
    const value = activePosting(state, resource.id, periodDays)
      ? numberOr(incoming[resource.id])
      : numberOr(resource.amount) * periodDays * numberOr(resource.expected_per_count);
    if (resource.id === "daily-schedule-exp") result.scheduleExp += value;
    if (resource.id === "daily-cafe-exp") result.cafeExp += value;
  }
  result.totalExp = result.scheduleExp + result.cafeExp;
  return result;
}

function mergeIncomingForecast(state, forecast, periodDays) {
  const next = { ...forecast };
  const incoming = currentPeriodIncoming(state, periodDays);
  const incomingBoxes = mapEntries(incoming.giftBoxes);
  const incomingPools = mapEntries(incoming.equivalentGiftPools);
  const incomingStocks = mapEntries(incoming.stockResources);
  next.choiceBoxes = numberOr(next.choiceBoxes) + numberOr(incomingBoxes["100008"]);
  next.randomGoldBoxes = numberOr(next.randomGoldBoxes) + numberOr(incomingBoxes["100000"]) + numberOr(incomingPools["random-gold"]);
  next.randomPurpleBoxes = numberOr(next.randomPurpleBoxes) + numberOr(incomingBoxes["100009"]);
  next.manufacturingStones = numberOr(next.manufacturingStones) + numberOr(incomingStocks.manufacturing_stone);
  next.synthesisStones = numberOr(next.synthesisStones) + numberOr(incomingStocks.synthesis_stone_gold);
  return next;
}

function currentContribution({ state, student, allocationResult, isMain, giftBoxes, crafting }) {
  const concreteExp = numberOr(allocationResult?.effectiveExp);
  if (!isMain || !student) return { concreteExp, boxExp: 0, randomPoolExp: 0, manufacturingExp: 0, synthesisExp: 0, totalExp: concreteExp };
  const currentBoxes = mapEntries(state?.giftBoxes);
  const currentPools = mapEntries(state?.equivalentGiftPools);
  const choiceBoxExp = boxExp(giftBoxes, "100008", student);
  const randomGoldBoxExp = boxExp(giftBoxes, "100000", student);
  const randomPurpleBoxExp = boxExp(giftBoxes, "100009", student);
  const randomPoolExp = (numberOr(currentBoxes["100000"]) + numberOr(currentPools["random-gold"])) * randomGoldBoxExp
    + numberOr(currentBoxes["100009"]) * randomPurpleBoxExp;
  const stock = mapEntries(state?.stockResources);
  const manufacturingExp = numberOr(stock.manufacturing_stone) * numberOr(crafting?.relationship_exp_per_manufacturing_stone);
  const synthesisPerStone = Math.max(0, choiceBoxExp - 40);
  const synthesisExp = numberOr(stock.synthesis_stone_gold) * synthesisPerStone;
  const boxExpectedExp = numberOr(currentBoxes["100008"]) * choiceBoxExp;
  return {
    concreteExp,
    boxExp: boxExpectedExp,
    randomPoolExp,
    manufacturingExp,
    synthesisExp,
    totalExp: concreteExp + boxExpectedExp + randomPoolExp + manufacturingExp + synthesisExp,
    choiceBoxExp,
    randomGoldBoxExp,
    randomPurpleBoxExp,
  };
}

function freeContribution({ state, student, studentId, isMain, periodDays, data, giftBoxes, crafting }) {
  if (!isMain || !student) return { totalExp: 0, sourceBreakdown: {}, daily: { scheduleExp: 0, cafeExp: 0, totalExp: 0 } };
  const rawForecast = calculateGiftOnlyForecast(state, { periodDays, rewardSnapshot: data?.snapshots?.unlimitedAssaultRewards ?? data?.unlimitedAssaultRewards });
  const forecast = mergeIncomingForecast(state, rawForecast, periodDays);
  const choiceExp = boxExp(giftBoxes, "100008", student);
  const randomGoldExp = boxExp(giftBoxes, "100000", student);
  const randomPurpleExp = boxExp(giftBoxes, "100009", student);
  const daily = dailyRelationshipExp(state, studentId, periodDays, data);
  const manufacturingExp = numberOr(forecast.manufacturingStones) * numberOr(crafting?.relationship_exp_per_manufacturing_stone);
  const synthesisExp = numberOr(forecast.synthesisStones) * Math.max(0, choiceExp - 40);
  const choiceBoxExp = numberOr(forecast.choiceBoxes) * choiceExp;
  const randomGoldBoxExp = numberOr(forecast.randomGoldBoxes) * randomGoldExp;
  const randomPurpleBoxExp = numberOr(forecast.randomPurpleBoxes) * randomPurpleExp;
  return {
    totalExp: choiceBoxExp + randomGoldBoxExp + randomPurpleBoxExp + manufacturingExp + synthesisExp + daily.totalExp,
    sourceBreakdown: {
      choiceBoxExp,
      randomGoldBoxExp,
      randomPurpleBoxExp,
      manufacturingExp,
      synthesisExp,
      daily,
    },
    daily,
    forecast,
  };
}

export function calculatePlanningSummary({ state = {}, targets, mainTargetId, forecastDays = 60, data = {} } = {}) {
  const plans = Array.isArray(targets) ? targets : (state.students ?? []);
  const days = periodDaysOf(forecastDays);
  const mainId = integerOr(mainTargetId ?? state.mainTargetStudentId, 0) || plans[0]?.studentId || null;
  const allocation = buildAllocation({ plans, data, state });
  const giftBoxes = data?.giftBoxes ?? data?.snapshots?.giftBoxes?.boxes ?? [];
  const students = allocation.students.map((allocated) => {
    const student = targetStudent(data, allocated);
    const release = getEligibleRelationshipSources(allocated.studentId, state.cnProgress, data.releaseTimeline ?? []);
    const requiredExp = numberOr(allocated.requiredExp);
    const isMain = Number(allocated.studentId) === Number(mainId);
    const crafting = valueFor(data?.craftingById, allocated.studentId);
    const current = currentContribution({ state, student, allocationResult: allocated, isMain, giftBoxes, crafting });
    const free = freeContribution({ state, student, studentId: allocated.studentId, isMain, periodDays: days, data, giftBoxes, crafting });
    const totalExpectedExp = current.totalExp + free.totalExp;
    const gapWithinPeriod = Math.max(0, requiredExp - totalExpectedExp);
    const freeExpPerDay = free.totalExp / days;
    const immediateGap = Math.max(0, requiredExp - current.totalExp);
    const estimatedDays = immediateGap <= 0 ? 0 : freeExpPerDay > 0 ? Math.ceil(immediateGap / freeExpPerDay) : null;
    return {
      studentId: allocated.studentId,
      planId: allocated.id,
      requiredExp,
      currentExp: current.totalExp,
      freeExp: free.totalExp,
      totalExpectedExp,
      immediateGap,
      gapWithinPeriod,
      freeExpPerDay,
      estimatedDays,
      releaseStatus: release.status,
      isMainTarget: isMain,
      sourceBreakdown: { current, free: free.sourceBreakdown },
    };
  });
  return { forecastDays: days, mainTargetId: mainId, students, allocation };
}

export function calculatePackageEfficiency({ student, packageCatalog, packages, packagePlans = {}, giftBoxes, manufacturingData, periodDays = 60 } = {}) {
  const catalog = packages ?? packageCatalog?.packages ?? packageCatalog ?? [];
  const eligible = partitionGiftPackagesForTimeline(catalog, student);
  const rows = [...eligible.current, ...eligible.mikaLaunch];
  const crafting = manufacturingData ?? {};
  const allRows = calculatePaidGiftPackageExp({
    student,
    giftBoxes: giftBoxes instanceof Map ? giftBoxes : new Map((giftBoxes ?? []).map((box) => [String(box.id), box])),
    packages: rows,
    packagePlans: {},
    periodDays,
    manufacturingExpectedPerStone: numberOr(crafting.relationship_exp_per_manufacturing_stone),
    synthesisNetExpPerStone: null,
  });
  return allRows.map((row) => {
    const item = rows.find((candidate) => String(candidate.id) === String(row.id));
    const plan = packagePlans?.[row.planId] ?? packagePlans?.[row.catalogId] ?? {};
    const purchaseLimit = numberOr(row.maxPurchases);
    const purchased = Math.min(purchaseLimit, integerOr(plan.purchased));
    const planned = Math.min(Math.max(0, purchaseLimit - purchased), integerOr(plan.planned));
    const availablePurchases = Math.max(0, purchaseLimit - purchased - planned);
    const price = numberOr(item?.price_cny);
    return {
      packageId: row.catalogId ?? row.id,
      rowId: row.id,
      timelineId: row.timelineId,
      name: item?.name_zh_cn ?? item?.name_en ?? row.id,
      price,
      purchaseLimit,
      purchasedCount: purchased,
      plannedCount: planned,
      availablePurchases,
      expectedExp: numberOr(row.expectedExpPerPackage),
      expPerYuan: price > 0 ? numberOr(row.expectedExpPerPackage) / price : null,
      goldGiftExp: numberOr(row.goldGiftExpPerPackage),
      purpleGiftExp: numberOr(row.purpleGiftExpPerPackage),
      bouquetExp: numberOr(row.bouquetExpPerPackage),
      choiceBoxExp: numberOr(row.choiceBoxExpPerPackage),
      randomBoxExp: numberOr(row.randomBoxExpPerPackage),
      manufacturingExp: numberOr(row.manufacturingExpPerPackage),
      synthesisExp: numberOr(row.synthesisExpPerPackage),
      source: item?.source ?? null,
      asOf: item?.asOf ?? packageCatalog?.asOf ?? null,
      contents: item?.contents ?? [],
    };
  }).sort((left, right) => numberOr(right.expPerYuan, -1) - numberOr(left.expPerYuan, -1) || String(left.packageId).localeCompare(String(right.packageId)));
}
