import assert from "node:assert/strict";
import {
  calculateInventorySummary,
  confirmGiftReservations,
  createInventoryState,
  mapPaidPackageContentsToInventory,
  migrateLegacyAutoPostedPackageContents,
  postPeriodicResource,
  releaseGiftReservations,
  removePostedPackageContents,
  restorePostedPackageContents,
  reserveGiftAllocation,
  setEquivalentGiftPoolCount,
  setStockResourceCount,
  synthesizeGoldGift,
  syncPurchasedPackagesToInventory,
  undoPeriodicResource,
} from "./inventory-state.js";
import { createEmptyPlannerState, setInventoryCount } from "./planner-state.js";

const empty = createInventoryState();
assert.deepEqual(empty.stockResources, {
  manufacturing_stone: 50,
  synthesis_stone_gold: 100,
  gold_manufacturing_stone: 0,
});
assert.deepEqual(empty.incomingResources.stockResources, {
  manufacturing_stone: 0,
  synthesis_stone_gold: 0,
  gold_manufacturing_stone: 0,
});
assert.deepEqual(empty.giftReservations, {});
assert.deepEqual(empty.resourcePostingHistory, []);

const legacy = createInventoryState({ inventory: { "5100": 2 }, giftBoxes: { "100008": 1 } });
assert.equal(legacy.inventory["5100"], 2);
assert.equal(legacy.giftBoxes["100008"], 1);
assert.ok(legacy.equivalentGiftPools["random-gold"] === 0);

let state = setStockResourceCount(empty, "synthesis_stone_gold", 1);
state = setStockResourceCount(state, "manufacturing_stone", 2);
state = setEquivalentGiftPoolCount(state, "random-gold", 4);
state = setInventoryCount(state, "5000", 3);
state = setInventoryCount(state, "5001", 1);

const posted = postPeriodicResource(state, "weekly-manufacturing-stones", { periodDays: 30, timestamp: "2026-08-10T00:00:00Z" });
assert.equal(posted.incomingResources.stockResources.manufacturing_stone, 17 * 30 / 7);
assert.equal(posted.resourcePostingHistory.length, 1);
assert.equal(postPeriodicResource(posted, "weekly-manufacturing-stones", { periodDays: 30, timestamp: "2026-08-11T00:00:00Z" }).resourcePostingHistory.length, 1);

const postedGiftBoxes = postPeriodicResource(posted, "monthly-total-assault-gift-boxes", { periodDays: 30 });
assert.equal(postedGiftBoxes.incomingResources.giftBoxes["100008"], 3);
assert.equal(postedGiftBoxes.resourcePostingHistory.length, 2);
const undone = undoPeriodicResource(postedGiftBoxes, postedGiftBoxes.resourcePostingHistory[0].id);
assert.equal(undone.incomingResources.stockResources.manufacturing_stone, 0);
assert.equal(undone.resourcePostingHistory.find((item) => item.resourceId === "weekly-manufacturing-stones").active, false);

const summaryBefore = calculateInventorySummary(postedGiftBoxes);
assert.deepEqual(summaryBefore.gifts["5000"], { current: 3, incoming: 0, reserved: 0, remaining: 3 });
assert.deepEqual(summaryBefore.stocks.synthesis_stone_gold, { current: 1, incoming: 0, reserved: 0, remaining: 1 });
assert.deepEqual(summaryBefore.equivalentGiftPools["random-gold"], { current: 4, incoming: 0, reserved: 0, remaining: 4 });

const reserved = reserveGiftAllocation(postedGiftBoxes, [
  { giftId: "5000", quantity: 2 },
  { giftId: "5001", quantity: 1 },
]);
assert.deepEqual(calculateInventorySummary(reserved).gifts["5000"], { current: 3, incoming: 0, reserved: 2, remaining: 1 });
assert.deepEqual(calculateInventorySummary(reserved).gifts["5001"], { current: 1, incoming: 0, reserved: 1, remaining: 0 });
const released = releaseGiftReservations(reserved);
assert.deepEqual(released.giftReservations, {});
const confirmed = confirmGiftReservations(reserved);
assert.equal(confirmed.inventory["5000"], 1);
assert.equal(confirmed.inventory["5001"], 0);
assert.deepEqual(confirmed.giftReservations, {});

const synthesized = synthesizeGoldGift(
  setStockResourceCount(setInventoryCount(setInventoryCount(empty, "5000", 1), "5001", 1), "synthesis_stone_gold", 1),
  "5000",
  "5001",
);
assert.equal(synthesized.ok, true);
assert.equal(synthesized.state.inventory["5000"], 0);
assert.equal(synthesized.state.inventory["5001"], 0);
assert.equal(synthesized.state.stockResources.synthesis_stone_gold, 0);
assert.equal(synthesized.state.giftBoxes["100008"], 1);

const insufficient = synthesizeGoldGift(empty, "5100", "5101");
assert.equal(insufficient.ok, false);
assert.equal(insufficient.reason, "insufficient_materials");

const sameGiftNeedsTwo = synthesizeGoldGift(
  setStockResourceCount(setInventoryCount(empty, "5000", 1), "synthesis_stone_gold", 1),
  "5000",
  "5000",
);
assert.equal(sameGiftNeedsTwo.ok, false);
assert.equal(sameGiftNeedsTwo.reason, "insufficient_materials");

const purpleCannotSynthesize = synthesizeGoldGift(
  setStockResourceCount(setInventoryCount(setInventoryCount(empty, "5100", 1), "5001", 1), "synthesis_stone_gold", 1),
  "5100",
  "5001",
  new Map([
    ["5000", { id: 5000, rarity: "SR" }],
    ["5001", { id: 5001, rarity: "SR" }],
    ["5100", { id: 5100, rarity: "SSR" }],
  ]),
);
assert.equal(purpleCannotSynthesize.ok, false);
assert.equal(purpleCannotSynthesize.reason, "gold_gifts_only");

const giftPackage = {
  id: "gifts",
  purchase_limit: 3,
  contents: [
    { kind: "item", item_id: 100008, quantity: 5 },
    { kind: "item", item_id: 5997, quantity: 5 },
  ],
};
const manufacturingPackage = {
  id: "manufacturing",
  purchase_limit: 2,
  contents: [
    { kind: "item", item_id: 3, quantity: 20 },
    { kind: "item", item_id: 82, quantity: 25 },
  ],
};

const legacyDoublePosted = createInventoryState({
  inventory: { "5997": 37, "100008": 1480 },
  giftBoxes: { "100008": 1480 },
  stockResources: { manufacturing_stone: 70, synthesis_stone_gold: 125 },
  packagePlans: {
    gifts: { purchased: 1, inInventory: 1 },
    manufacturing: { purchased: 1, inInventory: 1 },
  },
  packageInventoryPostings: { gifts: 1, manufacturing: 1 },
});
const migrated = migrateLegacyAutoPostedPackageContents(legacyDoublePosted, [giftPackage, manufacturingPackage]);
assert.equal(migrated.inventory["5997"], 32);
assert.equal(migrated.giftBoxes["100008"], 1475);
assert.equal(migrated.stockResources.manufacturing_stone, 50);
assert.equal(migrated.stockResources.synthesis_stone_gold, 100);
assert.deepEqual(migrated.packageInventoryPostings, {});
assert.equal(migrated.packagePlans.gifts.inInventory, 1);
assert.equal(migrated.packagePlans.manufacturing.inInventory, 1);
assert.equal(migrateLegacyAutoPostedPackageContents(migrated, [giftPackage, manufacturingPackage]).inventory["5997"], 32);
assert.deepEqual(mapPaidPackageContentsToInventory(giftPackage, 1), {
  inventory: { "5997": 5 },
  giftBoxes: { "100008": 5 },
  stockResources: {},
  equivalentGiftPools: {},
});
let packageState = createInventoryState({
  packagePlans: {
    gifts: { purchased: 1 },
    manufacturing: { purchased: 1 },
  },
});
packageState = syncPurchasedPackagesToInventory(packageState, [giftPackage, manufacturingPackage]);
assert.equal(packageState.giftBoxes["100008"], undefined);
assert.equal(packageState.inventory["5997"], undefined);
assert.equal(packageState.stockResources.manufacturing_stone, 50);
assert.equal(packageState.stockResources.synthesis_stone_gold, 100);
assert.equal(packageState.packagePlans.gifts.inInventory, 1);
assert.equal(packageState.packagePlans.manufacturing.inInventory, 1);
const packageStateAgain = syncPurchasedPackagesToInventory(packageState, [giftPackage, manufacturingPackage]);
assert.equal(packageStateAgain.giftBoxes["100008"], undefined);
assert.equal(packageStateAgain.inventory["5997"], undefined);
assert.equal(packageStateAgain.stockResources.manufacturing_stone, 50);
assert.equal(packageStateAgain.stockResources.synthesis_stone_gold, 100);
packageState = syncPurchasedPackagesToInventory({ ...packageState, packagePlans: { ...packageState.packagePlans, gifts: { purchased: 2, inInventory: 1 } } }, [giftPackage, manufacturingPackage]);
assert.equal(packageState.giftBoxes["100008"], undefined);
assert.equal(packageState.inventory["5997"], undefined);

console.log("inventory state tests passed");
