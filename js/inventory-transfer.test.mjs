import assert from "node:assert/strict";
import {
  applyInventoryImport,
  createInventoryExportPayload,
  parseInventoryImport,
  serializeInventoryExport,
} from "./inventory-transfer.js";
import { createInventoryState } from "./inventory-state.js";

const source = createInventoryState({
  students: [{ studentId: 10063, currentLevel: 1, targetLevel: 2 }],
  packages: [{ id: "package-draft", name: "keep me" }],
  periodDays: 30,
  inventory: { "5000": 3 },
  giftBoxes: { "100008": 2 },
  stockResources: { manufacturing_stone: 4.5, synthesis_stone_gold: 1 },
  incomingResources: {
    stockResources: { manufacturing_stone: 72.86 },
    giftBoxes: { "100008": 3 },
    equivalentGiftPools: { "random-gold": 80 },
    relationshipExp: { "daily-schedule-exp": 656.25 },
  },
  equivalentGiftPools: { "random-gold": 6 },
  giftReservations: { "5000": 1 },
  resources: [{ id: "weekly-manufacturing-stones", amount: 17, value_source: "user" }],
});

const payload = createInventoryExportPayload(source, { exportedAt: "2026-08-11T00:00:00.000Z" });
assert.equal(payload.format, "schale-relationship-inventory");
assert.equal(payload.schemaVersion, 1);
assert.equal(payload.exportedAt, "2026-08-11T00:00:00.000Z");
assert.equal(payload.inventory["5000"], 3);
assert.equal(payload.incomingResources.equivalentGiftPools["random-gold"], 80);
assert.equal(payload.students, undefined);
assert.equal(payload.packages, undefined);

const roundTrip = parseInventoryImport(serializeInventoryExport(source, { exportedAt: payload.exportedAt }), {
  giftIds: new Set(["5000"]),
  giftBoxIds: new Set(["100008"]),
});
assert.equal(roundTrip.ok, true);
assert.equal(roundTrip.state.inventory["5000"], 3);
assert.equal(roundTrip.state.giftBoxes["100008"], 2);
assert.equal(roundTrip.state.stockResources.manufacturing_stone, 4.5);
assert.equal(roundTrip.state.giftReservations["5000"], 1);
assert.deepEqual(roundTrip.warnings, []);

const current = createInventoryState({
  students: [{ studentId: 10063, currentLevel: 1, targetLevel: 2 }],
  packages: [{ id: "package-draft", name: "keep me" }],
  inventory: { "5100": 8 },
});
const applied = applyInventoryImport(current, roundTrip.state);
assert.deepEqual(applied.students, current.students);
assert.deepEqual(applied.packages, current.packages);
assert.equal(applied.inventory["5000"], 3);
assert.equal(applied.inventory["5100"], undefined);

const preservedArona = applyInventoryImport(current, roundTrip.state, { preserveStockResources: true, preservePackageInventoryPostings: true });
assert.equal(preservedArona.stockResources.manufacturing_stone, 50);
assert.equal(preservedArona.stockResources.synthesis_stone_gold, 100);

const unknown = parseInventoryImport(JSON.stringify({
  format: "schale-relationship-inventory",
  schemaVersion: 1,
  inventory: { "999999": 2 },
}), { giftIds: new Set(["5000"]), giftBoxIds: new Set(["100008"]) });
assert.equal(unknown.ok, true);
assert.equal(unknown.warnings.length, 1);

const arona = parseInventoryImport(JSON.stringify({
  version: "1.0",
  exportTime: "2026-08-11T14:19:50.674Z",
  inventory: {
    item_100008: 1475,
    item_5000: 25,
    item_5998: 2,
  },
  materialCalculator: [],
  farmingStudents: [],
  studentConfig: [],
}), {
  giftIds: new Set(["5000", "5998"]),
  giftBoxIds: new Set(["100008"]),
});
assert.equal(arona.ok, true);
assert.equal(arona.source, "arona.icu");
assert.equal(arona.state.inventory["5000"], 25);
assert.equal(arona.state.inventory["5998"], 2);
assert.equal(arona.state.giftBoxes["100008"], 1475);
assert.deepEqual(arona.warnings, []);

assert.equal(parseInventoryImport("not json").ok, false);
assert.equal(parseInventoryImport(JSON.stringify({ format: "wrong", schemaVersion: 1 })).ok, false);
assert.equal(parseInventoryImport(JSON.stringify({ format: "schale-relationship-inventory", schemaVersion: 99 })).ok, false);
assert.equal(parseInventoryImport(JSON.stringify({ format: "schale-relationship-inventory", schemaVersion: 1, inventory: { "5000": -1 } })).ok, false);

console.log("inventory transfer tests passed");
