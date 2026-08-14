const PROBABILITY_EPSILON = 1e-9;

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function giftValue(giftValues, giftId) {
  if (giftValues instanceof Map) return numeric(giftValues.get(String(giftId)) ?? giftValues.get(Number(giftId)));
  return numeric(giftValues?.[String(giftId)] ?? giftValues?.[Number(giftId)]);
}

function missingResult(status, missingGiftIds = []) {
  return { status, expectedExp: null, missingGiftIds };
}

function outcomeValue(outcome, giftValues) {
  const value = giftValue(giftValues, outcome.gift_id);
  if (value === null || value < 0) return { value: null, missingGiftIds: [String(outcome.gift_id)] };
  const quantity = numeric(outcome.quantity ?? 1);
  if (quantity === null || quantity < 0) return { value: null, missingGiftIds: [] };
  return { value: value * quantity, missingGiftIds: [] };
}

function calculateRandomBox(box, giftValues) {
  if (!Array.isArray(box.outcomes) || box.outcomes.length === 0) return missingResult("missing_probability");
  const outcomes = box.outcomes.map((outcome) => ({
    ...outcome,
    probability: numeric(outcome.probability),
  }));
  if (outcomes.some((outcome) => outcome.probability === null || outcome.probability < 0)) {
    return missingResult("invalid_probability");
  }
  const totalProbability = outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
  if (Math.abs(totalProbability - 1) > PROBABILITY_EPSILON) return missingResult("invalid_probability_total");
  const missingGiftIds = [];
  let expectedExp = 0;
  for (const outcome of outcomes) {
    const result = outcomeValue(outcome, giftValues);
    missingGiftIds.push(...result.missingGiftIds);
    if (result.value !== null) expectedExp += outcome.probability * result.value;
  }
  if (missingGiftIds.length) return missingResult("missing_gift_values", [...new Set(missingGiftIds)]);
  return { status: "ready", expectedExp, missingGiftIds: [] };
}

function calculateChoiceBox(box, giftValues, options) {
  const selectableGiftIds = Array.isArray(box.selectable_gift_ids)
    ? box.selectable_gift_ids.map((giftId) => String(giftId))
    : [];
  if (!selectableGiftIds.length) return missingResult("missing_selection_pool");
  const selectedGiftId = options?.selectedGiftId === undefined ? null : String(options.selectedGiftId);
  const candidateIds = selectedGiftId ? [selectedGiftId] : options?.policy === "best_for_student" ? selectableGiftIds : [];
  if (!candidateIds.length || (selectedGiftId && !selectableGiftIds.includes(selectedGiftId))) {
    return missingResult("missing_selection_policy");
  }
  const values = candidateIds.map((giftId) => ({ giftId, value: giftValue(giftValues, giftId) }));
  const missingGiftIds = values.filter((item) => item.value === null || item.value < 0).map((item) => item.giftId);
  if (missingGiftIds.length) return missingResult("missing_gift_values", [...new Set(missingGiftIds)]);
  const expectedExp = Math.max(...values.map((item) => item.value));
  const selectedGiftIds = values.filter((item) => item.value === expectedExp).map((item) => item.giftId);
  return {
    status: "ready",
    expectedExp,
    missingGiftIds: [],
    selectedGiftId: selectedGiftIds[0],
    selectedGiftIds,
    selectableGiftIds,
    selectableGiftCount: selectableGiftIds.length,
  };
}

export function calculateGiftBoxExpectedExp(box, giftValues, options = {}) {
  if (!box || typeof box !== "object") return missingResult("missing_box_definition");
  if (box.type === "choice") return calculateChoiceBox(box, giftValues, options);
  if (box.type === "random") return calculateRandomBox(box, giftValues);
  return missingResult("missing_box_type");
}

export function calculateGiftBoxesExpectedExp(entries, giftValues, options = {}) {
  if (!Array.isArray(entries) || entries.length === 0) return missingResult("missing_box_definition");
  let expectedExp = 0;
  for (const entry of entries) {
    const result = calculateGiftBoxExpectedExp(entry?.box, giftValues, { ...options, ...entry?.options });
    if (result.status !== "ready") return { ...result, boxId: entry?.box?.id ?? null };
    const quantity = numeric(entry?.quantity ?? 1);
    if (quantity === null || quantity < 0) return missingResult("invalid_box_quantity");
    expectedExp += result.expectedExp * quantity;
  }
  return { status: "ready", expectedExp, missingGiftIds: [] };
}
