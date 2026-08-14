const NORMAL_GIFT_IDS = Array.from({ length: 35 }, (_, index) => 5000 + index);
const CRAFTABLE_PURPLE_GIFT_IDS = Array.from({ length: 13 }, (_, index) => 5100 + index);
const SPECIAL_GIFT_IDS = [5996, 5997, 5998, 5999];

// Mika (Swimsuit) reuses Mika's preference table in SchaleDB.  Keep this
// explicit future-student snapshot so the unreleased costume can be planned
// before it appears in the released-student directory.
const GIFT_EXP = Object.freeze({
  5005: 40,
  5006: 60,
  5007: 40,
  5008: 40,
  5012: 40,
  5013: 40,
  5026: 40,
  5102: 180,
  5104: 240,
  5996: 240,
  5997: 240,
  5998: 60,
  5999: 60,
});

function defaultGiftExp(giftId) {
  return giftId >= 5100 ? 120 : 20;
}

function reactionGrade(exp) {
  return { 20: 1, 40: 2, 60: 3, 80: 4, 120: 2, 180: 3, 240: 4 }[exp] ?? 1;
}

function reactionLabel(exp) {
  return { 20: "Small", 40: "Medium", 60: "Large", 80: "Huge", 120: "Medium", 180: "Large", 240: "Huge" }[exp] ?? "Small";
}

const ALL_GIFT_IDS = [...NORMAL_GIFT_IDS, ...CRAFTABLE_PURPLE_GIFT_IDS, ...SPECIAL_GIFT_IDS];

function giftValue(giftId) {
  return GIFT_EXP[giftId] ?? defaultGiftExp(giftId);
}

function giftValueEntry(giftId) {
  const relationshipExp = giftValue(giftId);
  return {
    gift_id: giftId,
    reaction_grade: reactionGrade(relationshipExp),
    reaction_label_en: reactionLabel(relationshipExp),
    reaction_label_zh_cn: { Small: "小", Medium: "中", Large: "大", Huge: "特大" }[reactionLabel(relationshipExp)],
    reaction_label_zh: { Small: "小", Medium: "中", Large: "大", Huge: "特大" }[reactionLabel(relationshipExp)],
    relationship_exp: relationshipExp,
    matched_tags: [],
    is_student_preference: Object.hasOwn(GIFT_EXP, giftId),
    is_universal: giftId >= 5100 && !Object.hasOwn(GIFT_EXP, giftId),
    is_premium: giftId >= 5100,
  };
}

const giftValues = ALL_GIFT_IDS.map(giftValueEntry);
const preferredGifts = giftValues.filter((gift) => gift.is_student_preference);

// SchaleDB CN lists this future costume as ID 10122. It is deliberately kept
// out of the released student directory, but remains selectable in planning.
export const FUTURE_STUDENTS = Object.freeze([
  {
    student_id: 10122,
    name_en: "Mika (Swimsuit)",
    name_zh_cn: "未花（泳装）",
    name_zh: "未花（泳装）",
    name_ja: "ミカ（水着）",
    path_name: "mika_swimsuit",
    preference_source_student_id: 10059,
    default_order: 231,
    is_released: [true, true, false],
    future_only: true,
    future_note_zh_cn: "国服未实装；本规划只计算礼物，不计入日程与咖啡厅摸头。",
    favor_item_tags: ["Bb", "ar", "CX", "Cx"],
    favor_item_unique_tags: ["HK", "Hk"],
    gift_values: Object.freeze(giftValues),
    preferred_gifts: Object.freeze(preferredGifts),
    most_favorite_gifts: [5104],
    universal_gifts: CRAFTABLE_PURPLE_GIFT_IDS.filter((giftId) => ![5102, 5104].includes(giftId)),
    no_matching_gift_in_source: false,
  },
]);
