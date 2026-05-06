# Events Tables Blank-Slate Refactor PRD

## Purpose

Rebuild the implementation of the three dock-event tables with minimum code, clear table ownership, and no inherited architecture from the current overgrown refactor.

The target scope is limited to:

- `convex/functions/events`
- `convex/domain/events`

`VesselOrchestrator` is an upstream caller and reference point, not part of this refactor.

## Background

The event-table code began as a relocation of three table modules into a common events folder. Several incremental cleanup attempts then expanded the code into a large nested `functions/events` and `domain/events` tree. The current scoped implementation is roughly 9,528 lines across 90 files, compared with roughly 982 lines across 22 files at the Apr 25 reference point.

Some of that growth added useful behavior and tests, but much of it came from preemptive domain purity, planner files, compatibility exports, and nested helper directories. This refactor intentionally resets the implementation model.

## Goals

- Preserve required behavior for `eventsActual`, `eventsPredicted`, and `eventsScheduled`.
- Keep the three event tables reasonably siloed from each other.
- Implement the minimum code needed for each required action, query, and mutation.
- Prefer direct, readable functions over abstraction layers.
- Keep realtime event persistence compatible with `VesselOrchestrator` outputs.
- Keep static reload/refresh behavior without duplicating logic unnecessarily.
- Retain or rewrite tests that verify behavior, not internal decomposition.

## Non-Goals

- Refactor `convex/functions/vesselOrchestrator`.
- Refactor `convex/domain/vesselOrchestration`.
- Preserve the current file structure.
- Preserve domain abstractions, planner modules, or compatibility barrels unless rejustified.
- Create a generic events framework.
- Add new public behavior beyond the existing required surface.

## Reference Branches

- `events-old-reference`: old simpler working reference at `9be83cade0c5a98373d339e453c43ceb62b69ab7`.
- `events-current-reference`: current overgrown implementation at `d3f237fd3a926367f568559acf9b4332e8fd197e`.
- `events-blank-slate-reset`: blank-slate planning and implementation branch.

Reference branches are for behavior and tests. They are not templates to port wholesale.

## Required Style Guide

All implementation work must follow `.cursor/rules/code-style.mdc`.

That style guide is part of this PRD, not optional background. In particular,
agents should observe the repo's TypeScript conventions, module layout,
function TSDoc requirements, explicit export style, test placement guidance,
and preference for `const` arrow functions over function declarations.

If this PRD appears to conflict with the style guide, prefer the stricter rule
that produces less code and a clearer table-local implementation. Record any
intentional exception in the implementation notes.

## Core Principles

### Table Siloing Is The Default

`eventsActual`, `eventsPredicted`, and `eventsScheduled` are low-level persistence modules. Each table owns its schema, query surface, mutation behavior, and table-specific helpers.

Shared code is allowed only when it expresses a truly common event primitive or prevents demonstrated duplication across at least two tables.

### Start With Single Functions

Each requirement should start as one direct function in the owning module. Extract only after the function is correct and extraction clearly reduces complexity.

Do not create helper files before there is proven pressure from readability, reuse, or testability.

### Domain Code Must Pay Rent

Domain code may exist only for ferry/business rules or DTO-level transformations that are useful outside a single table persistence function.

Domain code should not exist merely because a function is pure.

Acceptable domain responsibilities:

- Build scheduled dock boundaries from schedule segments.
- Build predicted dock rows from trip and ML prediction DTOs.
- Infer actual dock events from vessel locations and schedule/trip context.
- Resolve scheduled segment order or seam normalization when reused by multiple callers.

Non-acceptable domain responsibilities:

- Plan table inserts, replaces, and deletes for simple mutation loops.
- Re-export compatibility types.
- Mirror Convex schemas in `domain`.
- Hide table-local equality checks in cross-cutting modules.
- Introduce nested folder hierarchies for purity.

### Reuse Shared Vessel Logic Outside Event Tables When Needed

If static reload and realtime `VesselOrchestrator` flows need the same DTO-level ferry logic, move that logic to a neutral shared domain location. Do not make `functions/events` depend on `functions/vesselOrchestrator`, and do not make `domain/events` a dumping ground for orchestration concerns.

Any such shared extraction must be explicitly justified in the implementation notes.

## Target Shape

Start from this flat shape:

```text
convex/functions/events/
  eventsActual/
    index.ts
    schemas.ts
    queries.ts
    mutations.ts
    tests/...
  eventsPredicted/
    index.ts
    schemas.ts
    queries.ts
    mutations.ts
    tests/...
  eventsScheduled/
    index.ts
    schemas.ts
    queries.ts
    mutations.ts
    tests/...
  sync/
    actions.ts
    mutations.ts
    tests/...

convex/domain/events/
  actual.ts
  predicted.ts
  scheduled.ts
```

`convex/domain/events` is optional. If a table reads more clearly with all logic in its function module, keep it there.

## Required Surface Area

The implementing agents must confirm the exact current callers before changing code. The expected minimum surface is:

### `eventsScheduled`

Query requirements:

- `listScheduledDockEventsForVesselSailingDay(args: { vesselAbbrev: string; sailingDay: string })`
- Internal reader if needed by callers: `readScheduledDockEventsForVesselSailingDay(ctx, args)`

Mutation requirements:

- `upsertScheduledRowsForSailingDay(ctx, SailingDay, nextRows)`
- Full-day replacement semantics for one sailing day.
- Delete scheduled rows for the day that are absent from `nextRows`.
- Insert missing rows.
- Replace changed rows.
- Skip unchanged rows.

Action requirements:

- None table-local. Static reload actions live under `sync`.

Optional domain:

- Build scheduled dock rows from adapter schedule segments if doing so is clearer outside sync.
- Scheduled boundary sorting or segment inference only if used by multiple callers.

### `eventsActual`

Query requirements:

- `listActualDockEventsForVesselSailingDay(args: { vesselAbbrev: string; sailingDay: string })`
- Internal reader if needed by callers: `readActualDockEventsForVesselSailingDay(ctx, args)`

Mutation requirements:

- `upsertActualDockRows(ctx, rows)`
- Sparse upsert semantics keyed by physical `EventKey`.
- Deduplicate incoming rows by `EventKey`, keeping the last row.
- Insert missing rows.
- Replace changed rows.
- Skip unchanged rows.
- Reload path must preserve physical-only observations when appropriate.

Action requirements:

- None table-local. Static reload actions live under `sync`.

Optional domain:

- Actual dock row construction or inference from trip/location DTOs when shared by realtime and reload flows.
- Avoid nested actual-reconciliation directories unless approved by PRD amendment.

### `eventsPredicted`

Query requirements:

- `listPredictedDockEventsForVesselSailingDay(args: { vesselAbbrev: string; sailingDay: string })`
- Internal reader if needed by callers: `readPredictedDockEventsForVesselSailingDay(ctx, args)`
- Grouped prediction loader for trip joins if still required by current callers.

Mutation requirements:

- `upsertPredictedDockBatches(ctx, batches)`
- Merge batches by vessel and sailing day.
- Reconcile only targeted keys.
- Delete stale rows for targeted keys.
- Insert missing prediction rows.
- Replace changed rows.
- Skip unchanged rows.
- Preserve any necessary depart-next ML rows according to current behavior.
- `patchDepartNextMlRowsForDepBoundary(ctx, depKey, actualMs)`

Action requirements:

- None table-local.

Optional domain:

- Build predicted rows from trip and ML DTOs if shared with `VesselOrchestrator`.
- Composite key helper may be local unless multiple callers require it.

### `sync`

Action requirements:

- `reloadDockEventsForCurrentSailingDay`
- `reloadDockEventsForSailingDay(args: { targetDate: string })`
- `reloadDockEventsWindow(args: { daysToSync?: number })`
- `reloadDockEventsAtSailingDayBoundary(args: { daysToSync?: number })`

Mutation requirements:

- `replaceDockEventsForSailingDay`
- `replaceScheduledDockEventsForSailingDay`
- `reloadActualDockEventsForSailingDay`

Behavior requirements:

- Fetch or receive schedule data for a sailing day.
- Fetch or receive actual/history data for the same sailing day.
- Replace scheduled rows for the day.
- Reload/upsert actual rows for the day without destroying physical observations that should survive.
- Do not rebuild `eventsPredicted` in static reload unless a product requirement explicitly says so.

## Implementation Stages

### Stage 1: Required API Inventory

No code rewrites.

- List every current import of `convex/functions/events` and `convex/domain/events`.
- List every generated Convex API reference for event actions, queries, and mutations.
- For each required export, record caller, input shape, output shape, and behavior.
- Classify current tests as behavioral, structural, or obsolete.

Deliverable: update the engineering memo with the confirmed API table.

### Stage 2: Queries

Implement query modules first because they are low-risk and clarify table shape.

- Implement one direct query per table.
- Keep sort comparators local unless shared behavior is proven.
- Strip Convex metadata at the query boundary when returning validator-shaped rows.
- Port only behavior tests for query outputs.

### Stage 3: `eventsScheduled` Mutations

- Implement full-day replacement in `eventsScheduled/mutations.ts`.
- Start as a single function.
- Add a local equality helper only if it improves readability.
- Port behavior tests for delete/insert/replace/skip semantics.

### Stage 4: `eventsPredicted` Mutations

- Implement batch merge and targeted reconciliation in `eventsPredicted/mutations.ts`.
- Keep table-specific composite key logic local unless required by multiple external callers.
- Preserve depart-next actualization behavior.
- Port behavior tests for batch merge, stale deletion, actualization patching, and unchanged-row skips.

### Stage 5: `eventsActual` Mutations

- Implement sparse upsert in `eventsActual/mutations.ts`.
- Implement reload actual behavior only after scheduled and predicted table surfaces are stable.
- Keep physical-only preservation behavior explicit and tested.
- Add domain code only for true event inference or shared DTO logic.

### Stage 6: Sync Actions And Internal Mutations

- Rebuild `sync/actions.ts` and `sync/mutations.ts` around the stable table mutation surfaces.
- Keep action orchestration readable top-to-bottom.
- Do not split action helpers into many files unless a function becomes genuinely hard to read.

### Stage 7: Delete Obsolete Structure

- Remove compatibility barrels.
- Remove nested domain folders.
- Remove planner files that duplicate simple mutation loops.
- Remove schema/type mirrors in `domain`.
- Remove tests that only assert internal helper decomposition.

### Stage 8: Final Audit

Record:

- File count before/after.
- LoC before/after.
- Max directory depth before/after.
- Remaining shared code and its justification.
- Tests run and results.
- Known behavior changes, if any.

## Agent Task Contract

Every implementation agent must begin with:

1. The exact requirement being implemented.
2. The owning table/function type.
3. The minimum required function signatures.
4. Existing callers.
5. Reference files inspected.
6. A statement of whether domain code is needed.

Agents must not:

- Port files wholesale from either reference branch.
- Add compatibility barrels.
- Add nested `domain/events/*/*` directories.
- Add planner modules for simple row reconciliation.
- Refactor VesselOrchestrator.
- Widen scope without updating this PRD.

## Acceptance Criteria

- The event-table implementation is smaller and flatter than the current state.
- Each table can be understood mostly from its own folder.
- Cross-table shared code is minimal and explicitly justified.
- Required Convex actions, queries, and mutations still exist.
- Realtime persistence from `VesselOrchestrator` still compiles and works.
- Static reload still updates scheduled and actual event tables correctly.
- Tests cover behavior at table and sync boundaries.
