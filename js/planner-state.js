export const PLANNER_STORAGE_KEY = "schale-relationship-planner-v1";
export const PLANNER_STATE_VERSION = 7;

export const RESOURCE_DEFINITIONS = Object.freeze([
  { id: "weekly-manufacturing-stones", cadence: "weekly", category: "free", unit: "manufacturing_stone", default_amount: 17 },
  { id: "monthly-synthesis-stones", cadence: "monthly", category: "free", unit: "synthesis_stone_gold", default_amount: 70 },
  { id: "monthly-total-assault-gift-boxes", cadence: "monthly", category: "free", unit: "gift_box", default_amount: 3, gift_box_id: "100008" },
  { id: "monthly-grand-assault-gold-gift-boxes", cadence: "monthly", category: "free", unit: "gift_box", default_amount: 4.5, gift_box_id: "100008" },
  { id: "monthly-grand-assault-purple-gift-boxes", cadence: "monthly", category: "free", unit: "gift_box", default_amount: 1.5, gift_box_id: "100009" },
  { id: "monthly-event-shop-gold-gift-boxes", cadence: "monthly", category: "free", unit: "gift_equivalent", default_amount: 80, equivalent_box_id: "100000" },
  { id: "monthly-event-shop-purple-gift-boxes", cadence: "monthly", category: "free", unit: "gift_box", default_amount: 4, gift_box_id: "100009" },
  { id: "monthly-unlimited-assault-gift-boxes", cadence: "monthly", category: "free", unit: "gift_box", input_kind: "floor", floor_options: [24, 49, 74, 99, 106, 124], max_floor: 124 },
  { id: "daily-schedule-exp", cadence: "daily", category: "free", unit: "relationship_exp", input_kind: "daily_count", expected_per_count: 31.25 },
  { id: "daily-cafe-exp", cadence: "daily", category: "free", unit: "relationship_exp", input_kind: "daily_count", expected_per_count: 15 },
]);

const DEFAULT_RESOURCE_ROWS = RESOURCE_DEFINITIONS.map((definition) => ({
  ...definition,
  amount: definition.default_amount ?? null,
  value_source: definition.default_amount === undefined ? null : "default",
  enabled: true,
}));

function integerOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function normalizeNumberMap(value, fallback = {}, integer = false) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(
    Object.entries({ ...fallback, ...source }).map(([key, item]) => [
      String(key),
      integer ? integerOr(item, 0) : numberOr(item, 0),
    ]),
  );
}

function normalizeSynthesisReservations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((pair) => Array.isArray(pair) && pair.length === 2 && pair.every((giftId) => String(giftId).trim()))
    .map((pair) => pair.map((giftId) => String(giftId)));
}

function migrateLegacyGrandAssaultResources(resourcesById) {
  const legacy = resourcesById.get("monthly-grand-assault-gift-boxes");
  if (!legacy) return new Map();
  const legacyAmount = legacy.amount === null || legacy.amount === undefined ? null : numberOr(legacy.amount, 0);
  const valueSource = legacy.value_source === "default" ? "default" : "user";
  return new Map([
    ["monthly-grand-assault-gold-gift-boxes", {
      amount: legacyAmount === null ? null : legacyAmount * 0.75,
      value_source: valueSource,
      enabled: legacy.enabled !== false,
    }],
    ["monthly-grand-assault-purple-gift-boxes", {
      amount: legacyAmount === null ? null : legacyAmount * 0.25,
      value_source: valueSource,
      enabled: legacy.enabled !== false,
    }],
  ]);
}

function emptyMappedResources() {
  return { stockResources: {}, giftBoxes: {}, equivalentGiftPools: {}, relationshipExp: {} };
}

function splitLegacyGrandAssaultPosting(item) {
  const mapped = item?.mapped ?? emptyMappedResources();
  const total = numberOr(item?.amount, 0);
  const periodMultiplier = Number(item?.periodDays) > 0 ? Number(item.periodDays) / 30 : 1;
  const gold = numberOr(mapped.giftBoxes?.["100008"], total * 0.75 * periodMultiplier);
  const purple = numberOr(mapped.giftBoxes?.["100009"], total * 0.25 * periodMultiplier);
  const makeEntry = (resourceId, amount, giftBoxId, suffix) => ({
    ...item,
    id: `${String(item.id)}:${suffix}`,
    postingKey: `${resourceId}:${item.periodDays}`,
    resourceId,
    amount: total * (giftBoxId === "100008" ? 0.75 : 0.25),
    mapped: {
      ...emptyMappedResources(),
      giftBoxes: { [giftBoxId]: amount },
    },
  });
  return [
    makeEntry("monthly-grand-assault-gold-gift-boxes", gold, "100008", "gold"),
    makeEntry("monthly-grand-assault-purple-gift-boxes", purple, "100009", "purple"),
  ];
}

function migrateLegacyGrandAssaultPostingHistory(history) {
  const activePostingKeys = new Set((history ?? [])
    .filter((item) => item?.active !== false)
    .map((item) => String(item.postingKey ?? "")));
  return (history ?? []).flatMap((item) => {
    if (item?.resourceId !== "monthly-grand-assault-gift-boxes") return [item];
    return splitLegacyGrandAssaultPosting(item).map((migrated) => activePostingKeys.has(String(migrated.postingKey))
      ? { ...migrated, active: false, migratedDuplicate: true, needsIncomingReconciliation: true }
      : migrated);
  });
}

function reconcileGrandAssaultIncomingResources(incomingResources, history) {
  const duplicateTotals = { "100008": 0, "100009": 0 };
  for (const item of history ?? []) {
    if (item?.needsIncomingReconciliation !== true) continue;
    for (const [giftBoxId, amount] of Object.entries(item.mapped?.giftBoxes ?? {})) {
      if (Object.prototype.hasOwnProperty.call(duplicateTotals, String(giftBoxId))) duplicateTotals[String(giftBoxId)] += numberOr(amount, 0);
    }
  }
  if (!Object.values(duplicateTotals).some((amount) => amount > 0)) return incomingResources;
  return {
    ...incomingResources,
    giftBoxes: {
      ...incomingResources.giftBoxes,
      ...Object.fromEntries(Object.entries(duplicateTotals).map(([id, amount]) => [
        id,
        Math.max(0, numberOr(incomingResources.giftBoxes[id]) - amount),
      ])),
    },
  };
}

function normalizeStockResources(value, fallback = { manufacturing_stone: 0, synthesis_stone_gold: 0 }) {
  const normalized = normalizeNumberMap(value, fallback);
  return {
    manufacturing_stone: normalized.manufacturing_stone,
    synthesis_stone_gold: normalized.synthesis_stone_gold,
  };
}

function normalizeIncomingResources(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    stockResources: normalizeStockResources(source.stockResources),
    giftBoxes: normalizeNumberMap(source.giftBoxes),
    equivalentGiftPools: normalizeNumberMap(source.equivalentGiftPools),
    relationshipExp: normalizeNumberMap(source.relationshipExp),
  };
}

function normalizePackageInventoryPostings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([id, posting]) => [
    String(id),
    integerOr(posting && typeof posting === "object" ? posting.quantity : posting, 0),
  ]));
}

function normalizeResourceAmount(resource, value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (resource.input_kind === "floor") {
    const min = Number(resource.min_floor ?? 1);
    const max = Number(resource.max_floor ?? Number.MAX_SAFE_INTEGER);
    return Math.min(max, Math.max(min, integerOr(value, fallback)));
  }
  return resource.input_kind === "daily_count" ? integerOr(value, fallback) : numberOr(value, fallback);
}

function normalizeStudentPlan(plan = {}) {
  const currentLevel = Math.min(100, Math.max(1, integerOr(plan.currentLevel, 1)));
  const targetLevel = Math.min(100, Math.max(currentLevel, integerOr(plan.targetLevel, currentLevel)));
  return {
    id: String(plan.id || `student-${plan.studentId || "unknown"}`),
    studentId: integerOr(plan.studentId, 0),
    currentLevel,
    currentProgress: numberOr(plan.currentProgress, 0),
    targetLevel,
  };
}

export function parseStudentIdInput(value) {
  const match = String(value ?? "").trim().match(/(?:#|\b)(\d{4,6})\s*$/);
  return match ? integerOr(match[1], 0) : 0;
}

export function createEmptyPlannerState() {
  return {
    version: PLANNER_STATE_VERSION,
    server: "cn",
    cnProgress: null,
    // The planner horizon and the inventory/resource preview horizon are
    // separate controls. Resource rows are monthly/weekly facts; their
    // preview may be changed without changing the planning question.
    resourceForecastDays: 30,
    periodDays: 60,
    forecastDays: 60,
    mainTargetStudentId: null,
    students: [],
    studentDrafts: {},
    inventory: {},
    giftBoxes: {},
    stockResources: {
      manufacturing_stone: 0,
      synthesis_stone_gold: 0,
    },
    incomingResources: {
      stockResources: {
        manufacturing_stone: 0,
        synthesis_stone_gold: 0,
      },
      giftBoxes: {},
      equivalentGiftPools: {},
      relationshipExp: {},
    },
    equivalentGiftPools: { "random-gold": 0 },
    giftReservations: {},
    synthesisReservations: [],
    resourcePostingHistory: [],
    resources: DEFAULT_RESOURCE_ROWS.map((resource) => ({ ...resource })),
    packages: [],
    packagePlans: {},
    packageInventoryPostings: {},
  };
}

export function normalizePlannerState(input) {
  const base = createEmptyPlannerState();
  const source = input && typeof input === "object" ? input : {};
  const resourcesById = new Map((Array.isArray(source.resources) ? source.resources : []).map((item) => [item.id, item]));
  const migratedLegacyGrandAssault = migrateLegacyGrandAssaultResources(resourcesById);
  const resources = base.resources.map((resource) => {
    const saved = resourcesById.get(resource.id) ?? migratedLegacyGrandAssault.get(resource.id);
    const restoreDefaultTower = resource.id === "monthly-unlimited-assault-gift-boxes"
      && Number(source.version ?? 0) < PLANNER_STATE_VERSION
      && (saved?.amount === null || saved?.amount === undefined);
    const savedHasUserValue = saved?.value_source === "user";
    const legacyDefaultSynthesis = resource.id === "monthly-synthesis-stones"
      && !savedHasUserValue
      && [50, 70].includes(Number(saved?.amount));
    const legacyDefaultTower = resource.id === "monthly-unlimited-assault-gift-boxes"
      && !savedHasUserValue
      && Number(saved?.amount) === 99;
    const savedAmount = legacyDefaultSynthesis || legacyDefaultTower
      ? resource.amount
      : savedHasUserValue
      ? (saved.amount === null || saved.amount === undefined ? null : normalizeResourceAmount(resource, saved.amount, 0))
      : saved?.amount === null || saved?.amount === undefined
        ? resource.amount
        : normalizeResourceAmount(resource, saved.amount, 0);
    return {
      ...resource,
      amount: restoreDefaultTower ? resource.amount : savedAmount,
      floor_mode: resource.input_kind === "floor"
        ? (saved?.floor_mode === "custom" || (saved?.floor_mode === undefined && savedAmount !== null && !resource.floor_options?.includes(savedAmount))) ? "custom" : null
        : undefined,
      value_source: restoreDefaultTower ? resource.value_source : savedHasUserValue ? "user" : saved?.value_source === "default" ? "default" : saved ? "user" : resource.value_source,
      enabled: saved?.enabled !== false,
    };
  });
  const inventory = Object.fromEntries(
    Object.entries(source.inventory && typeof source.inventory === "object" ? source.inventory : {})
      .map(([giftId, count]) => [String(giftId), integerOr(count, 0)]),
  );
  const giftBoxes = Object.fromEntries(
    Object.entries(source.giftBoxes && typeof source.giftBoxes === "object" ? source.giftBoxes : {})
      .map(([boxId, count]) => [String(boxId), integerOr(count, 0)]),
  );
  const sourceStock = source.stockResources && typeof source.stockResources === "object"
    ? source.stockResources
    : null;
  const stockResources = normalizeStockResources(sourceStock, base.stockResources);
  const equivalentGiftPools = normalizeNumberMap(source.equivalentGiftPools, base.equivalentGiftPools);
  const giftReservations = normalizeNumberMap(source.giftReservations, {}, true);
  const packageInventoryPostings = normalizePackageInventoryPostings(source.packageInventoryPostings);
  const resourcePostingHistory = Array.isArray(source.resourcePostingHistory)
    ? source.resourcePostingHistory
      .filter((item) => item && typeof item === "object" && item.id && item.resourceId)
      .map((item) => ({
        ...item,
        id: String(item.id),
        resourceId: String(item.resourceId),
        periodDays: numberOr(item.periodDays, 30),
        amount: numberOr(item.amount, 0),
        active: item.active !== false,
      }))
    : [];
  const migratedResourcePostingHistory = migrateLegacyGrandAssaultPostingHistory(resourcePostingHistory);
  const incomingResources = reconcileGrandAssaultIncomingResources(
    normalizeIncomingResources(source.incomingResources),
    migratedResourcePostingHistory,
  );
  // The duplicate marker is only a migration-time accounting signal. Keep
  // the inactive migrated rows for history, but remove the marker before
  // persisting the normalized state so a second normalize cannot subtract the
  // same legacy amount again.
  const stableResourcePostingHistory = migratedResourcePostingHistory.map((item) => {
    if (item?.migratedDuplicate !== true && item?.needsIncomingReconciliation !== true) return item;
    const { migratedDuplicate, needsIncomingReconciliation, ...stableItem } = item;
    return stableItem;
  });
  const students = Array.isArray(source.students)
    ? source.students.map(normalizeStudentPlan).filter((student) => student.studentId > 0)
    : [];
  const requestedForecastDays = source.forecastDays ?? source.periodDays ?? base.forecastDays;
  const normalizedForecastDays = Math.min(366, Math.max(0, integerOr(requestedForecastDays, base.forecastDays)));
  const requestedResourceForecastDays = source.resourceForecastDays
    ?? (source.version === undefined && source.periodDays !== undefined ? source.periodDays : 30);
  const normalizedResourceForecastDays = Math.min(366, Math.max(0, integerOr(requestedResourceForecastDays, 30)));
  const studentDrafts = Object.fromEntries(
    Object.entries(source.studentDrafts && typeof source.studentDrafts === "object" ? source.studentDrafts : {})
      .map(([studentId, plan]) => [String(studentId), normalizeStudentPlan({ ...plan, studentId })])
      .filter(([, plan]) => plan.studentId > 0),
  );
  return {
    ...base,
    // `periodDays` is retained as the legacy/export name for the resource
    // preview horizon. New code must use the explicit field below.
    periodDays: normalizedResourceForecastDays,
    resourceForecastDays: normalizedResourceForecastDays,
    forecastDays: normalizedForecastDays,
    mainTargetStudentId: integerOr(source.mainTargetStudentId, 0)
      || students[0]?.studentId
      || null,
    cnProgress: source.cnProgress && typeof source.cnProgress === "object"
      ? {
        version: integerOr(source.cnProgress.version, 1),
        server: "cn",
        cutoffStudentId: integerOr(source.cnProgress.cutoffStudentId, 0) || null,
        cutoffRank: integerOr(source.cnProgress.cutoffRank, 0) || null,
        asOf: String(source.cnProgress.asOf || ""),
        source: String(source.cnProgress.source || "user_selected_cn_cutoff"),
      }
      : null,
    students,
    studentDrafts,
    inventory,
    giftBoxes,
    stockResources,
    incomingResources,
    equivalentGiftPools,
    giftReservations,
    synthesisReservations: normalizeSynthesisReservations(source.synthesisReservations),
    packageInventoryPostings,
    resourcePostingHistory: stableResourcePostingHistory,
    resources,
    packages: Array.isArray(source.packages) ? source.packages : [],
    packagePlans: {
      ...base.packagePlans,
      ...(source.packagePlans && typeof source.packagePlans === "object" ? source.packagePlans : {}),
    },
  };
}

export function addStudentPlan(state, plan) {
  const normalizedState = normalizePlannerState(state);
  const studentId = integerOr(plan?.studentId, 0);
  const draft = studentId ? normalizedState.studentDrafts[String(studentId)] : null;
  const nextPlan = normalizeStudentPlan({
    ...draft,
    ...plan,
    studentId,
    currentLevel: plan?.currentLevel ?? draft?.currentLevel,
    currentProgress: plan?.currentProgress ?? draft?.currentProgress,
    targetLevel: plan?.targetLevel ?? draft?.targetLevel,
  });
  if (!nextPlan.studentId) return normalizedState;
  const existingIndex = normalizedState.students.findIndex((student) => student.studentId === nextPlan.studentId);
  const students = [...normalizedState.students];
  const mergedPlan = existingIndex >= 0 ? { ...students[existingIndex], ...nextPlan } : nextPlan;
  if (existingIndex >= 0) students[existingIndex] = mergedPlan;
  else students.push(nextPlan);
  return {
    ...normalizedState,
    students,
    studentDrafts: { ...normalizedState.studentDrafts, [String(nextPlan.studentId)]: mergedPlan },
    mainTargetStudentId: normalizedState.mainTargetStudentId ?? nextPlan.studentId,
  };
}

export function removeStudentPlan(state, planId) {
  const normalizedState = normalizePlannerState(state);
  const removed = normalizedState.students.find((student) => student.id === String(planId));
  const students = normalizedState.students.filter((student) => student.id !== String(planId));
  return {
    ...normalizedState,
    students,
    studentDrafts: removed?.studentId
      ? { ...normalizedState.studentDrafts, [String(removed.studentId)]: removed }
      : normalizedState.studentDrafts,
    mainTargetStudentId: removed?.studentId === normalizedState.mainTargetStudentId
      ? (students[0]?.studentId ?? null)
      : normalizedState.mainTargetStudentId,
  };
}

export function setMainTargetStudent(state, studentId) {
  const normalizedState = normalizePlannerState(state);
  const id = integerOr(studentId, 0) || null;
  if (id !== null && !normalizedState.students.some((student) => student.studentId === id)) return normalizedState;
  return { ...normalizedState, mainTargetStudentId: id };
}

export function setInventoryCount(state, giftId, count) {
  const normalizedState = normalizePlannerState(state);
  return {
    ...normalizedState,
    inventory: {
      ...normalizedState.inventory,
      [String(giftId)]: integerOr(count, 0),
    },
  };
}

export function setGiftBoxCount(state, boxId, count) {
  const normalizedState = normalizePlannerState(state);
  return {
    ...normalizedState,
    giftBoxes: {
      ...normalizedState.giftBoxes,
      [String(boxId)]: integerOr(count, 0),
    },
  };
}

export function setResourceAmount(state, resourceId, amount, options = {}) {
  const normalizedState = normalizePlannerState(state);
  return {
    ...normalizedState,
    resources: normalizedState.resources.map((resource) => resource.id === resourceId
      ? (() => {
        const isFloor = resource.input_kind === "floor";
        const isCustomMarker = isFloor && amount === "custom";
        const hasExplicitFloorMode = Object.prototype.hasOwnProperty.call(options, "floorMode");
        const floorMode = isFloor
          ? isCustomMarker
            ? "custom"
            : hasExplicitFloorMode
              ? options.floorMode === "custom" ? "custom" : null
              : resource.floor_mode ?? null
          : undefined;
        return {
          ...resource,
          amount: isCustomMarker
            ? resource.amount === null || resource.amount === undefined ? null : resource.amount
            : amount === null || amount === "" ? null : normalizeResourceAmount(resource, amount, 0),
          ...(isFloor ? { floor_mode: floorMode } : {}),
          value_source: "user",
        };
      })()
      : resource),
  };
}

export function setPackagePlan(state, packageId, field, value) {
  const normalizedState = normalizePlannerState(state);
  const current = normalizedState.packagePlans[String(packageId)] ?? { purchased: 0, planned: 0 };
  return {
    ...normalizedState,
    packagePlans: {
      ...normalizedState.packagePlans,
      [String(packageId)]: {
        ...current,
        [field]: integerOr(value, 0),
      },
    },
  };
}

export function readPlannerState(storage) {
  try {
    const raw = storage?.getItem(PLANNER_STORAGE_KEY);
    return normalizePlannerState(raw ? JSON.parse(raw) : null);
  } catch {
    return createEmptyPlannerState();
  }
}

export function writePlannerState(storage, state) {
  const normalized = normalizePlannerState(state);
  try {
    storage?.setItem(PLANNER_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Private browsing or blocked storage should not prevent the planner from working.
  }
  return normalized;
}

export function calculateRequiredRelationshipExp(currentLevel, currentProgress, targetLevel, thresholds) {
  const levels = Array.isArray(thresholds) ? thresholds : thresholds?.levels ?? [];
  const byLevel = new Map(levels.map((level) => [Number(level.level), Number(level.cumulative_exp_to_reach_level) || 0]));
  const current = Math.max(1, integerOr(currentLevel, 1));
  const target = Math.max(current, integerOr(targetLevel, current));
  const currentTotal = (byLevel.get(current) ?? 0) + numberOr(currentProgress, 0);
  const targetTotal = byLevel.get(target) ?? currentTotal;
  return Math.max(0, targetTotal - currentTotal);
}

function chooseBetterAction(current, candidate) {
  if (!current) return candidate;
  if (candidate.effectiveExp !== current.effectiveExp) return candidate.effectiveExp > current.effectiveExp ? candidate : current;
  if (candidate.relationshipExp !== current.relationshipExp) return candidate.relationshipExp > current.relationshipExp ? candidate : current;
  if (candidate.remainingExp !== current.remainingExp) return candidate.remainingExp < current.remainingExp ? candidate : current;
  return String(candidate.giftId).localeCompare(String(current.giftId)) < 0 ? candidate : current;
}

function cloneAssignmentMap(assignments) {
  return new Map([...assignments.entries()].map(([key, assignment]) => [key, { ...assignment }]));
}

function assignmentKey(studentId, giftId) {
  return `${String(studentId)}:${String(giftId)}`;
}

function addAssignmentUnit(assignments, studentId, giftId, giftValuesByStudent) {
  const relationshipExp = numberOr(giftValuesByStudent.get(String(studentId))?.[String(giftId)], 0);
  if (relationshipExp <= 0) return false;
  const key = assignmentKey(studentId, giftId);
  const previous = assignments.get(key) ?? {
    studentId: String(studentId),
    giftId: String(giftId),
    quantity: 0,
    relationshipExp,
    effectiveExp: 0,
  };
  previous.quantity += 1;
  previous.relationshipExp = relationshipExp;
  assignments.set(key, previous);
  return true;
}

function removeAssignmentUnit(assignments, studentId, giftId) {
  const key = assignmentKey(studentId, giftId);
  const previous = assignments.get(key);
  if (!previous) return false;
  if (previous.quantity <= 1) assignments.delete(key);
  else assignments.set(key, { ...previous, quantity: previous.quantity - 1 });
  return true;
}

function assignmentScore(assignments, students, giftValuesByStudent) {
  const totals = new Map(students.map((student) => [String(student.id), 0]));
  for (const assignment of assignments.values()) {
    const relationshipExp = numberOr(giftValuesByStudent.get(String(assignment.studentId))?.[String(assignment.giftId)], 0);
    totals.set(String(assignment.studentId), (totals.get(String(assignment.studentId)) ?? 0) + relationshipExp * assignment.quantity);
  }
  return students.reduce((sum, student) => sum + Math.min(numberOr(student.requiredExp, 0), totals.get(String(student.id)) ?? 0), 0);
}

function assignmentUnits(assignments) {
  // Exchange optimisation only needs one representative unit per assignment
  // type. Expanding a quantity of 250 gifts into 250 objects made the planner
  // freeze for multi-student inventories; the exchange itself still removes
  // exactly one unit and can be repeated by the bounded improvement loop.
  return [...assignments.values()].map((assignment) => ({
    studentId: String(assignment.studentId),
    giftId: String(assignment.giftId),
  }));
}

/**
 * Greedy allocation is a good first pass, but one gift can be valuable to a
 * second student while another gift is the better fit for the first. Apply
 * improving one-for-one exchanges until stable so that this common conflict
 * does not produce an avoidable global deficit.
 */
function improveAllocation(assignments, remainingInventory, students, giftValuesByStudent) {
  let currentScore = assignmentScore(assignments, students, giftValuesByStudent);
  for (let iteration = 0; iteration < 100; iteration += 1) {
    let best = null;
    for (const [newGiftId, count] of Object.entries(remainingInventory)) {
      if (count <= 0) continue;
      for (const targetStudent of students) {
        const newValue = numberOr(giftValuesByStudent.get(String(targetStudent.id))?.[String(newGiftId)], 0);
        if (newValue <= 0) continue;
        const direct = cloneAssignmentMap(assignments);
        if (addAssignmentUnit(direct, targetStudent.id, newGiftId, giftValuesByStudent)) {
          const score = assignmentScore(direct, students, giftValuesByStudent);
          if (score > currentScore && (!best || score > best.score)) best = { score, assignments: direct, newGiftId };
        }
        for (const existing of assignmentUnits(assignments)) {
          for (const destinationStudent of students) {
            if (String(destinationStudent.id) === String(existing.studentId)) continue;
            if (numberOr(giftValuesByStudent.get(String(destinationStudent.id))?.[String(existing.giftId)], 0) <= 0) continue;
            const exchanged = cloneAssignmentMap(assignments);
            if (!removeAssignmentUnit(exchanged, existing.studentId, existing.giftId)) continue;
            if (!addAssignmentUnit(exchanged, targetStudent.id, newGiftId, giftValuesByStudent)) continue;
            if (!addAssignmentUnit(exchanged, destinationStudent.id, existing.giftId, giftValuesByStudent)) continue;
            const score = assignmentScore(exchanged, students, giftValuesByStudent);
            if (score > currentScore && (!best || score > best.score)) best = { score, assignments: exchanged, newGiftId };
          }
        }
      }
    }
    if (!best) break;
    assignments.clear();
    for (const [key, value] of best.assignments) assignments.set(key, value);
    remainingInventory[best.newGiftId] -= 1;
    currentScore = best.score;
  }
}

export function planGiftAllocation({ students = [], inventory = {}, giftById, giftValuesByStudent = new Map(), priorityStudentIds = [] }) {
  const remaining = new Map(students.map((student) => [String(student.id), Math.max(0, numberOr(student.requiredExp, 0))]));
  const remainingInventory = Object.fromEntries(Object.entries(inventory).map(([giftId, count]) => [String(giftId), integerOr(count, 0)]));
  const assignmentMap = new Map();
  const priorityStudents = priorityStudentIds
    .map((studentId) => students.find((student) => String(student.id) === String(studentId)))
    .filter(Boolean);
  let totalPotentialExp = 0;
  let totalEffectiveExp = 0;

  while (true) {
    let bestAction = null;
    const candidateStudents = priorityStudents.length
      ? (() => {
        const active = priorityStudents.find((student) => {
          const studentId = String(student.id);
          if ((remaining.get(studentId) ?? 0) <= 0) return false;
          return Object.entries(remainingInventory).some(([giftId, count]) => (
            count > 0 && giftById?.has?.(String(giftId)) && numberOr(giftValuesByStudent.get(studentId)?.[String(giftId)], 0) > 0
          ));
        });
        return active ? [active] : [];
      })()
      : students;
    for (const [giftId, count] of Object.entries(remainingInventory)) {
      if (count <= 0 || !giftById?.has?.(String(giftId))) continue;
      for (const student of candidateStudents) {
        const studentId = String(student.id);
        const remainingExp = remaining.get(studentId) ?? 0;
        if (remainingExp <= 0) continue;
        const relationshipExp = numberOr(giftValuesByStudent.get(studentId)?.[String(giftId)], 0);
        if (relationshipExp <= 0) continue;
        bestAction = chooseBetterAction(bestAction, {
          giftId: String(giftId),
          studentId,
          relationshipExp,
          effectiveExp: Math.min(relationshipExp, remainingExp),
          remainingExp,
        });
      }
    }
    if (!bestAction) break;

    // Gift counts can be large (an imported inventory may contain hundreds of
    // copies). The value of one gift is constant for a given student/gift
    // pair, so consume a whole safe batch instead of rescanning the complete
    // inventory once per copy. Stop at the student's remaining requirement so
    // the result preserves the same capped-exp semantics as the unit loop.
    const availableCount = Math.max(0, integerOr(remainingInventory[bestAction.giftId], 0));
    const remainingExp = Math.max(0, numberOr(remaining.get(bestAction.studentId), 0));
    const batchQuantity = Math.min(
      availableCount,
      Math.max(1, Math.ceil(remainingExp / bestAction.relationshipExp)),
    );
    remainingInventory[bestAction.giftId] -= batchQuantity;
    const nextRemaining = Math.max(0, remainingExp - batchQuantity * bestAction.relationshipExp);
    remaining.set(bestAction.studentId, nextRemaining);
    totalPotentialExp += bestAction.relationshipExp * batchQuantity;
    totalEffectiveExp += Math.min(remainingExp, bestAction.relationshipExp * batchQuantity);
    const key = `${bestAction.studentId}:${bestAction.giftId}`;
    const previous = assignmentMap.get(key) ?? {
      studentId: bestAction.studentId,
      giftId: bestAction.giftId,
      quantity: 0,
      relationshipExp: bestAction.relationshipExp,
      effectiveExp: 0,
    };
    previous.quantity += batchQuantity;
    previous.effectiveExp += Math.min(remainingExp, bestAction.relationshipExp * batchQuantity);
    assignmentMap.set(key, previous);
  }

  if (!priorityStudents.length) improveAllocation(assignmentMap, remainingInventory, students, giftValuesByStudent);

  const assignments = [...assignmentMap.values()];
  const studentResults = students.map((student) => {
    const studentId = String(student.id);
    const allocated = assignments.filter((assignment) => assignment.studentId === studentId);
    const potentialExp = allocated.reduce((sum, assignment) => sum + assignment.relationshipExp * assignment.quantity, 0);
    const requiredExp = Math.max(0, numberOr(student.requiredExp, 0));
    const effectiveExp = Math.min(requiredExp, potentialExp);
    return {
      ...student,
      effectiveExp,
      potentialExp,
      overflowExp: Math.max(0, potentialExp - effectiveExp),
      unmetExp: Math.max(0, requiredExp - effectiveExp),
      assignments: allocated,
    };
  });

  totalPotentialExp = assignments.reduce((sum, assignment) => sum + assignment.relationshipExp * assignment.quantity, 0);
  totalEffectiveExp = studentResults.reduce((sum, student) => sum + student.effectiveExp, 0);
  return {
    assignments,
    students: studentResults,
    remainingInventory,
    totalPotentialExp,
    totalEffectiveExp,
    totalOverflowExp: Math.max(0, totalPotentialExp - totalEffectiveExp),
    totalUnmetExp: studentResults.reduce((sum, student) => sum + student.unmetExp, 0),
  };
}
