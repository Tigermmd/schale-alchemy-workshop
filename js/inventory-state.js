import { summarizeUnlimitedAssaultRewards } from "./resource-model.js?v=dashboard-20260817-inventory-v52";
import { normalizePlannerState } from "./planner-state.js?v=dashboard-20260817-inventory-v52";

const STOCK_RESOURCE_IDS = ["manufacturing_stone", "synthesis_stone_gold"];
// In SchaleDB's gift catalog SR is the gold-gift tier; SSR is purple.
const GOLD_RARITY = "SR";

function emptyPackageMappedResources() {
  return {
    inventory: {},
    giftBoxes: {},
    stockResources: {},
    equivalentGiftPools: {},
  };
}

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function integerOr(value, fallback = 0) {
  return Math.floor(numberOr(value, fallback));
}

function copyMap(value) {
  return Object.fromEntries(Object.entries(value && typeof value === "object" ? value : {}).map(([key, item]) => [String(key), numberOr(item)]));
}

function addToMap(target, source, multiplier = 1) {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[String(key)] = numberOr(target[String(key)]) + numberOr(value) * multiplier;
  }
  return target;
}

function subtractFromMap(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    target[String(key)] = Math.max(0, numberOr(target[String(key)]) - numberOr(value));
  }
  return target;
}

function emptyIncoming() {
  return {
    stockResources: Object.fromEntries(STOCK_RESOURCE_IDS.map((id) => [id, 0])),
    giftBoxes: {},
    equivalentGiftPools: {},
    relationshipExp: {},
  };
}

export function createInventoryState(input = {}) {
  const normalized = normalizePlannerState(input);
  return {
    ...normalized,
    stockResources: {
      ...Object.fromEntries(STOCK_RESOURCE_IDS.map((id) => [id, 0])),
      ...copyMap(normalized.stockResources),
    },
    incomingResources: {
      ...emptyIncoming(),
      ...(normalized.incomingResources ?? {}),
      stockResources: {
        ...emptyIncoming().stockResources,
        ...copyMap(normalized.incomingResources?.stockResources),
      },
      giftBoxes: copyMap(normalized.incomingResources?.giftBoxes),
      equivalentGiftPools: copyMap(normalized.incomingResources?.equivalentGiftPools),
      relationshipExp: copyMap(normalized.incomingResources?.relationshipExp),
    },
    equivalentGiftPools: {
      "random-gold": 0,
      ...copyMap(normalized.equivalentGiftPools),
    },
    giftReservations: Object.fromEntries(Object.entries(normalized.giftReservations ?? {}).map(([key, value]) => [String(key), integerOr(value)])),
    resourcePostingHistory: Array.isArray(normalized.resourcePostingHistory) ? normalized.resourcePostingHistory : [],
  };
}

function periodMultiplier(resource, periodDays) {
  const days = numberOr(periodDays, 30);
  if (resource?.cadence === "daily") return days;
  if (resource?.cadence === "weekly") return days / 7;
  if (resource?.cadence === "monthly") return days / 30;
  return 0;
}

function emptyMappedResources() {
  return {
    stockResources: {},
    giftBoxes: {},
    equivalentGiftPools: {},
    relationshipExp: {},
  };
}

export function mapPeriodicResource(resource, { periodDays = 30, rewardSnapshot } = {}) {
  if (!resource || resource.amount === null || resource.amount === undefined || resource.amount === "") return null;
  const multiplier = periodMultiplier(resource, periodDays);
  const mapped = emptyMappedResources();
  const amount = numberOr(resource.amount) * multiplier;

  if (resource.input_kind === "floor") {
    const summary = summarizeUnlimitedAssaultRewards(rewardSnapshot, resource.amount);
    if (!summary) return null;
    mapped.giftBoxes["100008"] = summary.goldSelectableGifts * multiplier;
    mapped.giftBoxes["100009"] = summary.purpleRandomGifts * multiplier;
    return mapped;
  }

  if (resource.unit === "manufacturing_stone") mapped.stockResources.manufacturing_stone = amount;
  if (resource.unit === "synthesis_stone_gold") mapped.stockResources.synthesis_stone_gold = amount;
  if (resource.unit === "gift_box" && resource.gift_box_breakdown) {
    for (const item of resource.gift_box_breakdown) mapped.giftBoxes[String(item.gift_box_id)] = numberOr(item.amount) * multiplier;
  } else if (resource.unit === "gift_box" && resource.gift_box_id) {
    mapped.giftBoxes[String(resource.gift_box_id)] = amount;
  }
  if (resource.unit === "gift_equivalent") {
    const poolId = resource.equivalent_box_id === "100000" ? "random-gold" : String(resource.equivalent_box_id ?? resource.id);
    mapped.equivalentGiftPools[poolId] = amount;
  }
  if (resource.unit === "relationship_exp") mapped.relationshipExp[String(resource.id)] = amount * numberOr(resource.expected_per_count);
  return mapped;
}

function adjustIncoming(state, mapped, sign) {
  const next = createInventoryState(state);
  const action = sign > 0 ? addToMap : subtractFromMap;
  action(next.incomingResources.stockResources, mapped.stockResources, sign > 0 ? 1 : 1);
  action(next.incomingResources.giftBoxes, mapped.giftBoxes, sign > 0 ? 1 : 1);
  action(next.incomingResources.equivalentGiftPools, mapped.equivalentGiftPools, sign > 0 ? 1 : 1);
  action(next.incomingResources.relationshipExp, mapped.relationshipExp, sign > 0 ? 1 : 1);
  return next;
}

export function postPeriodicResource(state, resourceId, options = {}) {
  const next = createInventoryState(state);
  const resource = next.resources.find((item) => item.id === String(resourceId));
  const periodDays = numberOr(options.periodDays, next.periodDays || 30);
  const mapped = mapPeriodicResource(resource, { periodDays, rewardSnapshot: options.rewardSnapshot });
  if (!mapped) return next;
  const key = `${String(resourceId)}:${periodDays}`;
  if (next.resourcePostingHistory.some((item) => item.active !== false && item.postingKey === key)) return next;
  const previousCount = next.resourcePostingHistory.filter((item) => item.postingKey?.startsWith(`${key}:`)).length;
  const id = String(options.postingId ?? `${key}:${previousCount + 1}`);
  const historyEntry = {
    id,
    postingKey: key,
    resourceId: String(resourceId),
    amount: numberOr(resource.amount),
    periodDays,
    mapped,
    postedAt: options.timestamp ?? new Date().toISOString(),
    active: true,
  };
  const withIncoming = adjustIncoming(next, mapped, 1);
  return { ...withIncoming, resourcePostingHistory: [...withIncoming.resourcePostingHistory, historyEntry] };
}

export function undoPeriodicResource(state, postingId) {
  const next = createInventoryState(state);
  const index = next.resourcePostingHistory.findIndex((item) => item.id === String(postingId) && item.active !== false);
  if (index < 0) return next;
  const entry = next.resourcePostingHistory[index];
  const withIncoming = adjustIncoming(next, entry.mapped, -1);
  const history = [...withIncoming.resourcePostingHistory];
  history[index] = { ...history[index], active: false, undoneAt: new Date().toISOString() };
  return { ...withIncoming, resourcePostingHistory: history };
}

export function setStockResourceCount(state, resourceId, count) {
  const next = createInventoryState(state);
  return { ...next, stockResources: { ...next.stockResources, [String(resourceId)]: numberOr(count) } };
}

export function setEquivalentGiftPoolCount(state, poolId, count) {
  const next = createInventoryState(state);
  return { ...next, equivalentGiftPools: { ...next.equivalentGiftPools, [String(poolId)]: numberOr(count) } };
}

/**
 * Convert one catalog package into concrete inventory buckets. Text-only
 * contents are intentionally ignored. Random boxes remain boxes/pools and
 * are never flattened into a specific gift.
 */
export function mapPaidPackageContentsToInventory(packageItem, quantity = 1) {
  const mapped = emptyPackageMappedResources();
  const multiplier = integerOr(quantity);
  for (const content of packageItem?.contents ?? []) {
    if (content?.kind === "text") continue;
    const amount = numberOr(content?.quantity) * multiplier;
    if (!amount) continue;
    const itemId = String(content?.item_id ?? "");
    if (itemId === "3") mapped.stockResources.manufacturing_stone = numberOr(mapped.stockResources.manufacturing_stone) + amount;
    else if (itemId === "82") mapped.stockResources.synthesis_stone_gold = numberOr(mapped.stockResources.synthesis_stone_gold) + amount;
    else if (itemId === "100000") mapped.equivalentGiftPools["random-gold"] = numberOr(mapped.equivalentGiftPools["random-gold"]) + amount;
    else if (["100008", "100009"].includes(itemId)) mapped.giftBoxes[itemId] = numberOr(mapped.giftBoxes[itemId]) + amount;
    else if (itemId) mapped.inventory[itemId] = integerOr(mapped.inventory[itemId]) + Math.floor(amount);
  }
  return mapped;
}

function adjustPackageMappedResources(state, mapped, sign) {
  const next = createInventoryState(state);
  const update = (target, source) => {
    for (const [key, value] of Object.entries(source ?? {})) {
      const result = numberOr(target[key]) + sign * numberOr(value);
      target[key] = Math.max(0, result);
    }
  };
  update(next.inventory, mapped.inventory);
  update(next.giftBoxes, mapped.giftBoxes);
  update(next.stockResources, mapped.stockResources);
  update(next.equivalentGiftPools, mapped.equivalentGiftPools);
  return next;
}

/**
 * Reconcile package metadata without touching inventory.
 *
 * Package contents are account data, not planner data. In particular, an
 * Arona.icu export already contains the contents of packages the player has
 * bought. Automatically posting package contents here would therefore count
 * those contents a second time. Keep this function name for state/API
 * compatibility, but only update the planner's purchased/in-inventory flags.
 */
export function syncPurchasedPackagesToInventory(state, packages = []) {
  const next = createInventoryState(state);
  const packagePlans = { ...next.packagePlans };
  for (const item of packages ?? []) {
    const id = String(item?.id ?? "");
    if (!id) continue;
    const planId = String(item?.plan_id ?? id);
    const plan = packagePlans[planId] ?? packagePlans[id] ?? {};
    const purchased = Math.min(integerOr(plan.purchased), integerOr(item.purchase_limit, integerOr(plan.purchased)) || integerOr(plan.purchased));
    // v10 no longer creates package postings. Any legacy postings are
    // removed by migrateLegacyAutoPostedPackageContents before this runs.
    // Do not write a new posting and do not mutate concrete holdings.
    // Preserve the account-snapshot marker. Changing the planner's purchased
    // count must not silently claim that a new package's contents are already
    // present in the imported inventory.
    const inInventory = purchased;
    packagePlans[planId] = { ...plan, purchased, inInventory };
  }
  return { ...next, packageInventoryPostings: {}, packagePlans };
}

/** Rehydrate automatic package contents after replacing concrete inventory with
 * an external snapshot (for example an Arona.icu export). The posting counts
 * are preserved, so the following sync remains idempotent. */
export function restorePostedPackageContents(state, postings = {}, packages = []) {
  let next = createInventoryState(state);
  for (const item of packages ?? []) {
    const quantity = integerOr(postings?.[item?.id]);
    if (quantity > 0) next = adjustPackageMappedResources(next, mapPaidPackageContentsToInventory(item, quantity), 1);
  }
  return { ...next, packageInventoryPostings: { ...postings } };
}

export function removePostedPackageContents(state, postings = {}, packages = []) {
  let next = createInventoryState(state);
  for (const item of packages ?? []) {
    const quantity = integerOr(postings?.[item?.id]);
    if (quantity > 0) next = adjustPackageMappedResources(next, mapPaidPackageContentsToInventory(item, quantity), -1);
  }
  return next;
}

/**
 * Migrate the pre-v3 inventory shape where purchased package contents were
 * already present in the imported current inventory, while the new state
 * also retained package postings.  Remove only the recorded automatic
 * posting once, then clear the marker so the migration is idempotent.
 * Purchased facts and their inInventory counters are intentionally preserved.
 */
export function migrateLegacyAutoPostedPackageContents(state, packages = []) {
  const normalized = createInventoryState(state);
  const postings = normalized.packageInventoryPostings ?? {};
  const migrated = removePostedPackageContents(normalized, postings, packages);
  return {
    ...migrated,
    packageInventoryPostings: {},
    packagePlans: Object.fromEntries(Object.entries(migrated.packagePlans ?? {}).map(([id, plan]) => [
      id,
      plan && typeof plan === "object"
        ? { ...plan, inInventory: integerOr(plan.inInventory, 0) }
        : plan,
    ])),
  };
}

export function setUserStockResourceDefaults(state, counts = {}) {
  const next = createInventoryState(state);
  return {
    ...next,
    stockResources: {
      ...next.stockResources,
      ...Object.fromEntries(Object.entries(counts).map(([id, value]) => [String(id), numberOr(value)])),
    },
  };
}

export function calculateInventorySummary(state) {
  const next = createInventoryState(state);
  const giftIds = new Set([...Object.keys(next.inventory), ...Object.keys(next.giftReservations)]);
  const gifts = Object.fromEntries([...giftIds].map((giftId) => {
    const current = integerOr(next.inventory[giftId]);
    const reserved = integerOr(next.giftReservations[giftId]);
    return [giftId, { current, incoming: 0, reserved, remaining: Math.max(0, current - reserved) }];
  }));
  const stocks = Object.fromEntries(STOCK_RESOURCE_IDS.map((id) => {
    const current = numberOr(next.stockResources[id]);
    const incoming = numberOr(next.incomingResources.stockResources[id]);
    return [id, { current, incoming, reserved: 0, remaining: current + incoming }];
  }));
  const giftBoxes = Object.fromEntries([...new Set([...Object.keys(next.giftBoxes), ...Object.keys(next.incomingResources.giftBoxes)])].map((id) => {
    const current = numberOr(next.giftBoxes[id]);
    const incoming = numberOr(next.incomingResources.giftBoxes[id]);
    return [id, { current, incoming, reserved: 0, remaining: current + incoming }];
  }));
  const equivalentGiftPools = Object.fromEntries([...new Set([...Object.keys(next.equivalentGiftPools), ...Object.keys(next.incomingResources.equivalentGiftPools)])].map((id) => {
    const current = numberOr(next.equivalentGiftPools[id]);
    const incoming = numberOr(next.incomingResources.equivalentGiftPools[id]);
    return [id, { current, incoming, reserved: 0, remaining: current + incoming }];
  }));
  return { gifts, stocks, giftBoxes, equivalentGiftPools, relationshipExp: copyMap(next.incomingResources.relationshipExp) };
}

export function reserveGiftAllocation(state, assignments = []) {
  const next = createInventoryState(state);
  const reservations = {};
  for (const assignment of assignments) {
    const giftId = String(assignment?.giftId ?? "");
    const quantity = integerOr(assignment?.quantity);
    if (!giftId || quantity <= 0) continue;
    reservations[giftId] = integerOr(reservations[giftId]) + quantity;
  }
  const invalid = Object.entries(reservations).some(([giftId, quantity]) => quantity > integerOr(next.inventory[giftId]));
  return invalid ? next : { ...next, giftReservations: reservations };
}

export function getAvailableGiftInventory(state) {
  const next = createInventoryState(state);
  const giftIds = new Set([...Object.keys(next.inventory), ...Object.keys(next.giftReservations)]);
  return Object.fromEntries([...giftIds].map((giftId) => [
    giftId,
    Math.max(0, integerOr(next.inventory[giftId]) - integerOr(next.giftReservations[giftId])),
  ]));
}

export function releaseGiftReservations(state) {
  return { ...createInventoryState(state), giftReservations: {} };
}

export function confirmGiftReservations(state) {
  const next = createInventoryState(state);
  const inventory = { ...next.inventory };
  for (const [giftId, quantity] of Object.entries(next.giftReservations)) {
    inventory[giftId] = Math.max(0, integerOr(inventory[giftId]) - integerOr(quantity));
  }
  return { ...next, inventory, giftReservations: {} };
}

export function synthesizeGoldGift(state, firstGiftId, secondGiftId, giftById) {
  const next = createInventoryState(state);
  const first = String(firstGiftId);
  const second = String(secondGiftId);
  const synthesisStones = numberOr(next.stockResources.synthesis_stone_gold);
  const catalog = giftById instanceof Map ? giftById : null;
  if (catalog && (!isGoldGift(catalog.get(first)) || !isGoldGift(catalog.get(second)))) {
    return { ok: false, reason: "gold_gifts_only", state: next };
  }
  const firstRequired = first === second ? 2 : 1;
  if (synthesisStones < 1 || integerOr(next.inventory[first]) < firstRequired || integerOr(next.inventory[second]) < 1) {
    return { ok: false, reason: "insufficient_materials", state: next };
  }
  const inventory = { ...next.inventory };
  inventory[first] -= 1;
  inventory[second] -= 1;
  return {
    ok: true,
    state: {
      ...next,
      inventory,
      stockResources: { ...next.stockResources, synthesis_stone_gold: synthesisStones - 1 },
      giftBoxes: { ...next.giftBoxes, "100008": numberOr(next.giftBoxes["100008"]) + 1 },
    },
  };
}

export function isGoldGift(gift) {
  return gift?.rarity === GOLD_RARITY;
}
