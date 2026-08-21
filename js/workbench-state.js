const WORKBENCH_TITLE_KEYS = {
  relationship: "workbenchRelationship",
  planner: "workbenchPlanner",
  inventory: "workbenchInventory",
  resources: "workbenchResources",
  packages: "workbenchPackages",
  knowledge: "workbenchKnowledge",
  agent: "workbenchAgent",
};

export function getWorkbenchChromeState(workbench) {
  return {
    titleKey: WORKBENCH_TITLE_KEYS[workbench] ?? WORKBENCH_TITLE_KEYS.planner,
    showStudentDirectory: workbench === "relationship",
  };
}

export function updateInventoryFilter(filters, key, value) {
  if (!Object.hasOwn(filters ?? {}, key)) return { ...(filters ?? {}) };
  return { ...(filters ?? {}), [key]: key === "onlyOwned" ? Boolean(value) : String(value ?? "") };
}
