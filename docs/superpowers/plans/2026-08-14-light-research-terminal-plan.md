# Implementation Plan: 轻量研究终端整站重构

## Foundation

### Task 1: Public shell and navigation

Acceptance:

- Default route opens the planning workspace.
- Desktop uses a compact rail; narrow screens expose all six workspaces without horizontal clipping.
- Header contains only brand, snapshot status, locale switcher and the current workspace title.

Verification: load all six `?view=` routes at 1440, 768 and 390px; assert no body overflow and no console errors.

Files: `index.html`, `styles.css`, `js/app.js`, `js/i18n.js`.

### Task 2: Shared view model and display primitives

Acceptance:

- Existing pure calculations remain the source of truth.
- Rendering receives prepared summaries and does not read localStorage directly.
- Quantity, integer and expectation formatting are separated.

Verification: run all existing JS tests and add view-model tests for empty and future-student states.

Files: `js/workbench-view-model.js`, `js/render.js`, `js/i18n.js`, tests.

## Core vertical slices

### Task 3: Planning result-first workspace

Acceptance:

- Target selector, target level and forecast period are visible before details.
- Gap and estimated days are the dominant result.
- Reserve action is adjacent to the summary; gift allocation/source details are collapsible.
- Unreleased/unknown students do not receive schedule/cafe forecast.

Verification: test Mika gift-only, multi-target main-target ownership, zero free-resource estimate and reservation flow in browser.

Files: `js/planner-view.js`, `js/planning-summary.js`, `styles.css`, tests.

### Task 4: Archive workspace

Acceptance:

- Student directory can collapse on narrow screens and selection scrolls to the profile.
- Profile uses local collection portrait, reaction-face gift rows and stage summaries.
- Node probability, candidate gifts and non-gift outcomes are progressive details.

Verification: search/select on 390px; check image natural widths and three reaction rows.

Files: `js/render.js`, `styles.css`, tests.

### Task 5: Inventory and periodic-resource workspaces

Acceptance:

- Current inventory is the primary edit surface.
- Boxes, periodic resources, equivalent pools and reservations show summary counts while collapsed.
- Empty 0/52 gift inventory gives a clear show-all action.
- Import/export, synthesis, posting/undo and reservation semantics remain unchanged.

Verification: edit, refresh, import/export, synthesize, post/undo and confirm/release reservation in browser plus existing tests.

Files: `js/inventory-view.js`, `js/resource-view.js`, `styles.css`, tests.

### Task 6: Package efficiency and Agent workspaces

Acceptance:

- Package page prioritizes top three exp/元 and keeps package data out of planning.
- Agent settings are behind a disclosure; unconfigured send is disabled; proposal changes require local confirmation.

Verification: switch target, open full package list, inspect Agent empty/configured/proposal states, check API key is not persisted.

Files: `js/package-view.js`, `js/agent-view.js`, `agent.css`, `styles.css`, tests.

## Final checkpoint

- `for test in js/*.test.mjs; do node "$test"; done`
- `python3 -m unittest -q`
- `python3 -m py_compile generate_dashboard_assets.py harness_server.py test_harness_server.py`
- Real browser screenshots/DOM/console at 1440, 768 and 390px for all six routes.
- Code review across correctness, architecture, security, readability and performance.
