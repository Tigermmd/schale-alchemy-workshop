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
  };
  for (const reward of snapshot?.floor_rewards ?? []) {
    const rewardFloor = Number(reward?.[0]);
    if (!Number.isFinite(rewardFloor) || rewardFloor > selectedFloor) continue;
    for (const [name, quantity] of reward?.[1] ?? []) {
      const amount = asNumber(quantity);
      if (name === "金色礼物自选") summary.goldSelectableGifts += amount;
      if (name === "紫色礼物随机") summary.purpleRandomGifts += amount;
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

export function calculateResourceForecast(resource, amount, periodDays, rewardSnapshot) {
  if (amount === null || amount === undefined || amount === "") return null;
  if (resource.input_kind === "floor") {
    return { kind: "unlimited_assault", summary: summarizeUnlimitedAssaultRewards(rewardSnapshot, amount) };
  }
  if (resource.input_kind === "daily_count") {
    return {
      kind: "relationship_exp",
      value: Number(amount) * Number(resource.expected_per_count || 0) * Number(periodDays || 0),
    };
  }
  return {
    kind: "quantity",
    value: Number(amount) * periodMultiplier(resource, Number(periodDays || 0)),
  };
}
