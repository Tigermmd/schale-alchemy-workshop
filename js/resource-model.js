function asNumber(value) {
  const number = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(number) ? number : 0;
}

function normalizeFloor(floor, snapshot) {
  if (floor === null || floor === undefined || floor === "") return null;
  const number = Number(floor);
  if (!Number.isFinite(number)) return null;
  const range = snapshot?.scope?.season_floor_range;
  const min = Number(range?.[0]) || 1;
  const max = Number(range?.[1]) || 124;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

export function summarizeUnlimitedAssaultRewards(snapshot, floor) {
  const selectedFloor = normalizeFloor(floor, snapshot);
  if (selectedFloor === null) return null;

  const summary = {
    floor: selectedFloor,
    goldSelectableGifts: 0,
    purpleRandomGifts: 0,
    synthesisStones: 0,
  };
  for (const reward of snapshot?.floor_rewards ?? []) {
    const rewardFloor = Number(reward?.[0]);
    if (!Number.isFinite(rewardFloor) || rewardFloor > selectedFloor) continue;
    for (const [name, quantity] of reward?.[1] ?? []) {
      const amount = asNumber(quantity);
      if (name === "金色礼物自选") summary.goldSelectableGifts += amount;
      if (name === "紫色礼物随机") summary.purpleRandomGifts += amount;
      if (name === "金色合成石") summary.synthesisStones += amount;
    }
  }
  return summary;
}

function periodMultiplier(resource, periodDays) {
  if (resource.cadence === "daily") return periodDays;
  if (resource.cadence === "weekly") return periodDays / 7;
  if (resource.cadence === "monthly") return periodDays / 30;
  return 0;
}

const MONTHLY_SYNTHESIS_RESOURCE_ID = "monthly-synthesis-stones";
const UNLIMITED_ASSAULT_RESOURCE_ID = "monthly-unlimited-assault-gift-boxes";
const DEFAULT_MONTHLY_SYNTHESIS_TOTAL = 70;
const DEFAULT_SHOP_SYNTHESIS_STONES = 50;
const DEFAULT_TOWER_SYNTHESIS_STONES = 20;

function isConfiguredResource(resource) {
  return resource?.amount !== null && resource?.amount !== undefined && resource?.amount !== "";
}

/**
 * Split the prefilled monthly synthesis-stone figure into its real sources.
 *
 * The 70/month default is a combined baseline: 50 from the shop and 20 from
 * the unlimited-assault reward table. Once a tower floor is selected, the
 * 20-point tower component is replaced by that floor's actual reward. This
 * keeps the default convenient while preventing the tower row from adding the
 * same 20 stones for a second time.
 *
 * `isResourcePosted` is used by inventory posting and planning forecasts so
 * an already-posted source is excluded without excluding its sibling source.
 */
export function calculateSynthesisStoneSourceForecast(
  resources = [],
  periodDays = 30,
  rewardSnapshot,
  { isResourcePosted = () => false } = {},
) {
  const monthly = resources.find((resource) => resource?.id === MONTHLY_SYNTHESIS_RESOURCE_ID);
  const tower = resources.find((resource) => resource?.id === UNLIMITED_ASSAULT_RESOURCE_ID);
  const monthlyConfigured = isConfiguredResource(monthly);
  const towerConfigured = isConfiguredResource(tower);
  const monthlyPosted = monthlyConfigured && Boolean(isResourcePosted(monthly));
  const towerPosted = towerConfigured && Boolean(isResourcePosted(tower));
  const monthlyMultiplier = periodMultiplier(monthly ?? { cadence: "monthly" }, Number(periodDays || 0));
  const towerMultiplier = periodMultiplier(tower ?? { cadence: "monthly" }, Number(periodDays || 0));
  const monthlyAmount = monthlyConfigured ? asNumber(monthly.amount) * monthlyMultiplier : 0;
  const isPrefilledDefault = monthlyConfigured
    && monthly?.value_source !== "user"
    && [50, DEFAULT_MONTHLY_SYNTHESIS_TOTAL].includes(asNumber(monthly.amount));
  const shopBase = isPrefilledDefault ? DEFAULT_SHOP_SYNTHESIS_STONES : asNumber(monthly?.amount);
  const shop = monthlyConfigured ? shopBase * monthlyMultiplier : 0;
  const towerSummary = towerConfigured ? summarizeUnlimitedAssaultRewards(rewardSnapshot, tower.amount) : null;
  const towerAmount = towerSummary ? asNumber(towerSummary.synthesisStones) * towerMultiplier : 0;
  const assumedTower = !towerConfigured && isPrefilledDefault
    ? DEFAULT_TOWER_SYNTHESIS_STONES * monthlyMultiplier
    : 0;
  const monthlyContribution = monthlyConfigured && !monthlyPosted
    ? (towerConfigured ? shop : monthlyAmount)
    : 0;
  const towerContribution = towerConfigured && !towerPosted ? towerAmount : 0;
  return {
    total: monthlyContribution + towerContribution,
    shop,
    tower: towerAmount + assumedTower,
    monthlyContribution,
    towerContribution,
    towerConfigured,
  };
}

export function calculatePeriodicResourceAmount(resource, amount, resources = []) {
  const baseAmount = Number(amount);
  if (!Number.isFinite(baseAmount)) return null;
  return Math.max(0, baseAmount);
}

export function calculateResourceForecast(resource, amount, periodDays, rewardSnapshot, { resources = [] } = {}) {
  if (amount === null || amount === undefined || amount === "") return null;
  if (resource.id === MONTHLY_SYNTHESIS_RESOURCE_ID && resources.some((item) => item?.id === MONTHLY_SYNTHESIS_RESOURCE_ID)) {
    const synthesis = calculateSynthesisStoneSourceForecast(resources, periodDays, rewardSnapshot);
    return {
      kind: "quantity",
      value: synthesis.monthlyContribution,
      synthesis,
    };
  }
  if (resource.input_kind === "floor") {
    const summary = summarizeUnlimitedAssaultRewards(rewardSnapshot, amount);
    if (!summary) return { kind: "unlimited_assault", summary: null };
    const multiplier = periodMultiplier(resource, Number(periodDays || 0));
    return {
      kind: "unlimited_assault",
      summary: {
        ...summary,
        goldSelectableGifts: summary.goldSelectableGifts * multiplier,
        purpleRandomGifts: summary.purpleRandomGifts * multiplier,
        synthesisStones: summary.synthesisStones * multiplier,
      },
    };
  }
  if (resource.input_kind === "daily_count") {
    return {
      kind: "relationship_exp",
      value: Number(amount) * Number(resource.expected_per_count || 0) * Number(periodDays || 0),
    };
  }
  return {
    kind: "quantity",
    value: calculatePeriodicResourceAmount(resource, amount, resources) * periodMultiplier(resource, Number(periodDays || 0)),
  };
}
