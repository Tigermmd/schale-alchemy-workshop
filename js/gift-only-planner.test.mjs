import assert from "node:assert/strict";
import fs from "node:fs";
import { FUTURE_STUDENTS } from "./future-students.js";
import { calculateGiftOnlyForecast, calculateGiftOnlyProjection, calculatePaidGiftPackageExp, filterGiftPackagesForStudent, partitionGiftPackagesForTimeline, recommendGiftPackagePurchases } from "./gift-only-planner.js";
import { calculateGiftBoxExpectedExp } from "./gift-box-state.js";

const gifts = JSON.parse(fs.readFileSync(new URL("../relationship_data/gifts.json", import.meta.url), "utf8")).gifts;
const thresholds = JSON.parse(fs.readFileSync(new URL("../relationship_data/relationship_thresholds.json", import.meta.url), "utf8"));
const boxes = JSON.parse(fs.readFileSync(new URL("../relationship_data/gift_boxes_cn.json", import.meta.url), "utf8")).boxes;
const paidPackagesCatalog = JSON.parse(fs.readFileSync(new URL("../relationship_data/paid_packages_cn.json", import.meta.url), "utf8")).packages;
const giftById = new Map(gifts.map((gift) => [String(gift.id), gift]));
const boxById = new Map(boxes.map((box) => [String(box.id), box]));
const student = FUTURE_STUDENTS.find((item) => item.student_id === 10122);
const craftingSnapshot = JSON.parse(fs.readFileSync(new URL("../relationship_data/crafting_expected_relationship.json", import.meta.url), "utf8"));
const baseMikaCrafting = craftingSnapshot.students.find((item) => item.student_id === 10059);

const towerForecast = calculateGiftOnlyForecast({
  resources: [{
    id: "tower",
    cadence: "monthly",
    amount: 99,
    unit: "gift_box",
    input_kind: "floor",
  }],
  resourcePostingHistory: [],
}, { periodDays: 60, rewardSnapshot: JSON.parse(fs.readFileSync(new URL("../relationship_data/unlimited_assault_rewards_cn.json", import.meta.url), "utf8")) });
assert.deepEqual(towerForecast, {
  choiceBoxes: 12,
  randomGoldBoxes: 0,
  randomPurpleBoxes: 6,
  manufacturingStones: 0,
  synthesisStones: 0,
});

const twoMonthForecast = calculateGiftOnlyForecast({
  resources: [
    { id: "monthly-total", cadence: "monthly", amount: 3, unit: "gift_box", gift_box_id: "100008" },
    { id: "monthly-grand-gold", cadence: "monthly", amount: 4.5, unit: "gift_box", gift_box_id: "100008" },
    { id: "monthly-grand-purple", cadence: "monthly", amount: 1.5, unit: "gift_box", gift_box_id: "100009" },
    { id: "monthly-event-gold", cadence: "monthly", amount: 80, unit: "gift_equivalent", equivalent_box_id: "100000" },
    { id: "monthly-event-purple", cadence: "monthly", amount: 4, unit: "gift_box", gift_box_id: "100009" },
  ],
  resourcePostingHistory: [],
});
assert.deepEqual(twoMonthForecast, {
  choiceBoxes: 15,
  randomGoldBoxes: 160,
  randomPurpleBoxes: 11,
  manufacturingStones: 0,
  synthesisStones: 0,
});

const specialPackage = {
  id: "special",
  price_cny: 98,
  purchase_limit: 3,
  contents: [
    { kind: "student_favorite_gift", item_id: 5104, gift_color: "purple", quantity: 6 },
    { kind: "student_favorite_gift", item_id: 5008, gift_color: "gold", quantity: 10 },
    { kind: "item", item_id: 5997, quantity: 2 },
  ],
};
const manufacturePackage = {
  id: "manufacture",
  price_cny: 156,
  purchase_limit: 2,
  contents: [{ kind: "item", item_id: 3, quantity: 20 }, { kind: "item", item_id: 82, quantity: 25 }],
};
const paidPackageExp = calculatePaidGiftPackageExp({
  student,
  giftBoxes: boxById,
  packages: [specialPackage, manufacturePackage],
  packagePlans: {
    special: { purchased: 1, inInventory: 0, planned: 0 },
    manufacture: { purchased: 1, inInventory: 0, planned: 0 },
  },
  manufacturingExpectedPerStone: 81.879452,
});
assert.equal(paidPackageExp.find((item) => item.id === "special").expectedExp, 1400);
assert.equal(paidPackageExp.find((item) => item.id === "special").goldGiftExpPerPackage, 200);
assert.equal(paidPackageExp.find((item) => item.id === "special").purpleGiftExpPerPackage, 720);
assert.equal(paidPackageExp.find((item) => item.id === "special").bouquetExpPerPackage, 480);
assert.equal(paidPackageExp.find((item) => item.id === "manufacture").expectedExp, 2137.58904);

const genericPackage = { id: "generic", contents: [{ kind: "item", item_id: 100008, quantity: 1 }] };
const unrelatedPackage = {
  id: "unrelated",
  gift_binding: { type: "student_specific_favorites" },
  contents: [
    { kind: "student_favorite_gift", item_id: 5112, gift_color: "purple", quantity: 6 },
    { kind: "student_favorite_gift", item_id: 5018, gift_color: "gold", quantity: 10 },
  ],
};
const mikaPackage = {
  id: "mika",
  gift_binding: { type: "student_specific_favorites", target_student_ids: [10122] },
  contents: [
    { kind: "student_favorite_gift", item_id: 5104, gift_color: "purple", quantity: 6 },
    { kind: "student_favorite_gift", item_id: 5008, gift_color: "gold", quantity: 10 },
  ],
};
assert.deepEqual(filterGiftPackagesForStudent([genericPackage, unrelatedPackage, mikaPackage], student).map((item) => item.id), ["generic", "mika"]);
const currentStudentPackage = {
  id: "current-student-package",
  current_banner_for_planning: true,
  gift_binding: { type: "student_specific_favorites", target_student_ids: [10063] },
  contents: [],
};
assert.deepEqual(filterGiftPackagesForStudent([genericPackage, currentStudentPackage], student).map((item) => item.id), ["generic", "current-student-package"]);
const timeline = partitionGiftPackagesForTimeline([
  { ...genericPackage, id: "current-generic" },
  { ...mikaPackage, id: "mika-launch", availability_phase: "mika_launch" },
  { ...unrelatedPackage, id: "current-unrelated", current_banner_for_planning: true },
], student);
assert.deepEqual(timeline.current.map((item) => item.id), ["current-generic", "current-unrelated"]);
assert.deepEqual(timeline.mikaLaunch.map((item) => item.id), ["mika-launch"]);

const activeCatalogForMika = paidPackagesCatalog.filter((item) => item.status === "active" || ["cn-monthly-manufacturing-98", "cn-monthly-gifts-78"].includes(item.id));
const catalogTimeline = partitionGiftPackagesForTimeline(activeCatalogForMika, student);
assert.ok(catalogTimeline.current.some((item) => item.id === "cn-third-anniversary-gifts-98"));
assert.ok(catalogTimeline.current.some((item) => item.id === "cn-third-anniversary-manufacturing-156"));
assert.ok(catalogTimeline.current.some((item) => item.id === "cn-monthly-manufacturing-98"));
assert.ok(catalogTimeline.current.some((item) => item.id === "cn-monthly-gifts-78"));
assert.ok(catalogTimeline.current.some((item) => item.id === "cn-third-anniversary-special-ii-98"));
assert.ok(catalogTimeline.mikaLaunch.some((item) => item.id === "cn-third-anniversary-special-i-98"));
assert.ok(catalogTimeline.mikaLaunch.some((item) => item.id === "cn-third-anniversary-gifts-98@mika-launch"));
assert.ok(catalogTimeline.mikaLaunch.some((item) => item.id === "cn-third-anniversary-manufacturing-156@mika-launch"));
assert.equal(catalogTimeline.mikaLaunch.some((item) => item.id === "cn-third-anniversary-special-ii-98@mika-launch"), false);

const phaseProjection = calculateGiftOnlyProjection({
  student,
  thresholds,
  currentLevel: 1,
  currentProgress: 0,
  targetLevel: 1,
  state: { inventory: {}, giftBoxes: {}, equivalentGiftPools: {}, incomingResources: { giftBoxes: {}, equivalentGiftPools: {} }, giftReservations: {} },
  giftBoxes: boxById,
  packages: [{ ...specialPackage, launch_reoffer: true }],
  launchPackages: [{ ...specialPackage, id: "mika-launch-special", availability_phase: "mika_launch", launch_student_ids: [10122] }],
  packagePlans: {
    special: { purchased: 1, inInventory: 0, planned: 0 },
    "mika-launch-special": { purchased: 0, planned: 1 },
  },
});
assert.equal(phaseProjection.paidPackages.current.expectedExp, 1400);
assert.equal(phaseProjection.paidPackages.mikaLaunch.expectedExp, 1400);
assert.equal(phaseProjection.paidPackages.expectedExp, 2800);
const recommendation = recommendGiftPackagePurchases([
  { id: "value", purchased: 1, maxPurchases: 3, expectedExpPerPackage: 1500, price: 98 },
  { id: "middle", purchased: 1, maxPurchases: 2, expectedExpPerPackage: 1000, price: 100 },
  { id: "cheap", purchased: 0, maxPurchases: 2, expectedExpPerPackage: 500, price: 40 },
], 2800);
assert.deepEqual(recommendation.items.map((item) => [item.id, item.quantity]), [["value", 2]]);
assert.equal(recommendation.expectedExp, 3000);
assert.equal(recommendation.remainingGap, 0);
const incompleteRecommendation = recommendGiftPackagePurchases([
  { id: "small", purchased: 0, planned: 0, maxPurchases: 1, expectedExpPerPackage: 40, price: 10 },
], 100);
assert.equal(incompleteRecommendation.canCover, false);
assert.equal(incompleteRecommendation.usedAllAvailable, true);
assert.equal(incompleteRecommendation.remainingGap, 60);

assert.ok(student, "Mika (Swimsuit) should be available as a future planner target");
assert.equal(baseMikaCrafting.relationship_exp_per_manufacturing_stone, 83.638734);
assert.equal(student.gift_values.find((item) => item.gift_id === 5104).relationship_exp, 240);
assert.equal(student.gift_values.find((item) => item.gift_id === 5106).relationship_exp, 120);
assert.equal(student.gift_values.find((item) => item.gift_id === 5102).relationship_exp, 180);
assert.equal(student.gift_values.find((item) => item.gift_id === 5005).relationship_exp, 40);
assert.equal(student.gift_values.find((item) => item.gift_id === 5006).relationship_exp, 60);
assert.equal(student.gift_values.find((item) => item.gift_id === 5034).relationship_exp, 20);
assert.equal(student.gift_values.find((item) => item.gift_id === 5000).relationship_exp, 20);

const studentGiftValues = Object.fromEntries(student.gift_values.map((item) => [String(item.gift_id), item.relationship_exp]));
const choiceBox = boxById.get("100008");
const randomGoldBox = boxById.get("100000");
const randomPurpleBox = boxById.get("100009");
assert.deepEqual(choiceBox.selectable_gift_ids, Array.from({ length: 35 }, (_, index) => 5000 + index));
assert.equal(choiceBox.selectable_gift_ids.includes(5106), false);
assert.equal(randomGoldBox.outcomes.some((outcome) => outcome.gift_id === 5106), false);
assert.equal(randomPurpleBox.outcomes.some((outcome) => outcome.gift_id === 5106), true);
const choiceBoxResult = calculateGiftBoxExpectedExp(choiceBox, studentGiftValues, { policy: "best_for_student" });
assert.equal(choiceBoxResult.expectedExp, 60);
assert.deepEqual(choiceBoxResult.selectedGiftIds, ["5006"]);
assert.equal(choiceBoxResult.selectableGiftCount, 35);
assert.ok(Math.abs(calculateGiftBoxExpectedExp(randomPurpleBox, studentGiftValues).expectedExp - 133.84615384615384) < 1e-9);

const projection = calculateGiftOnlyProjection({
  student,
  thresholds,
  currentLevel: 1,
  currentProgress: 0,
  targetLevel: 100,
  gifts,
  giftById,
  giftBoxes: boxById,
  state: {
    inventory: { "5106": 1, "5006": 1, "5100": 1 },
    giftBoxes: { "100008": 1 },
    equivalentGiftPools: {},
    incomingResources: { giftBoxes: {}, equivalentGiftPools: {} },
    giftReservations: {},
  },
  forecast: {
    choiceBoxes: 2,
    randomGoldBoxes: 1,
    randomPurpleBoxes: 1,
  },
  paidPackages: { expectedExp: 0 },
  manufacturingExpectedPerStone: 83.638734,
});

assert.equal(projection.requiredExp, 240225);
assert.equal(projection.current.concreteExp, 300);
assert.equal(projection.current.choiceBoxes, 1);
assert.equal(projection.current.choiceBoxExp, 60);
assert.deepEqual(projection.current.choiceBoxSelection.selectedGiftIds, ["5006"]);
assert.equal(projection.current.choiceBoxSelection.selectableGiftCount, 35);
assert.equal(projection.current.totalExpectedExp, 360);
assert.equal(projection.current.minimumChoiceBoxesNeeded, 3999);
assert.equal(projection.twoMonthFree.choiceBoxes, 2);
assert.equal(projection.twoMonthFree.randomGoldBoxes, 1);
assert.equal(projection.twoMonthFree.randomPurpleBoxes, 1);
assert.ok(Math.abs(projection.twoMonthFree.randomGoldExpectedExp - 24.571428571428573) < 1e-9);
assert.ok(Math.abs(projection.twoMonthFree.randomPurpleExpectedExp - 133.84615384615384) < 1e-9);
assert.equal(projection.twoMonthFree.minimumChoiceBoxesNeededWithoutCurrentChoiceBoxes, 3995);
assert.equal(projection.twoMonthFree.additionalChoiceBoxesNeeded, 3994);
assert.ok(Math.abs(projection.twoMonthWithPaid.gap - 239586.58241758242) < 1e-9);

console.log("gift-only planner tests passed");
