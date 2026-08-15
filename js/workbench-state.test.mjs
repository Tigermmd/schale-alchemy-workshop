import assert from "node:assert/strict";
import { getWorkbenchChromeState, updateInventoryFilter } from "./workbench-state.js?v=dashboard-20260814-rebuild-v47";

assert.deepEqual(getWorkbenchChromeState("planner"), {
  titleKey: "workbenchPlanner",
  showStudentDirectory: false,
});
assert.deepEqual(getWorkbenchChromeState("relationship"), {
  titleKey: "workbenchRelationship",
  showStudentDirectory: true,
});
assert.deepEqual(getWorkbenchChromeState("unknown"), {
  titleKey: "workbenchPlanner",
  showStudentDirectory: false,
});

assert.deepEqual(
  updateInventoryFilter({ query: "", rarity: "all", exp: "all", onlyOwned: true }, "query", "金"),
  { query: "金", rarity: "all", exp: "all", onlyOwned: true },
);
assert.deepEqual(
  updateInventoryFilter({ query: "金", rarity: "all", exp: "all", onlyOwned: true }, "onlyOwned", false),
  { query: "金", rarity: "all", exp: "all", onlyOwned: false },
);

console.log("workbench state tests passed");
