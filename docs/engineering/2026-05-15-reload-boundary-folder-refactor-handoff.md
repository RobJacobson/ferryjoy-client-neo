# Reload Boundary Folder Refactor Handoff

## Goal

Reorganize the dock-event reload domain so the shared boundary/backbone code no
longer lives under `schedule/`. The current implementation now builds a shared
boundary model that feeds both scheduled-row projection and actual-row synthesis.
Keeping that code in `schedule/` makes actual-row code appear to depend on a
sibling concern, when both scheduled and actual rows should depend on a common
reload boundary stage.

The refactor should be organizational and naming-focused. Do not change row
semantics unless a test exposes a bug.

## Current State

The outer persistence path is still correct:

- `convex/functions/events/reload/mutations.ts` reseeds one full sailing day.
- It builds a reload context, projects scheduled rows, then builds actual rows
  from the same boundary events.

The recently simplified schedule assembly currently lives here:

- `convex/domain/events/reload/schedule/buildReloadScheduleContext.ts`
- `convex/domain/events/reload/schedule/buildReloadBoundaryEvents.ts`
- `convex/domain/events/reload/schedule/mapHistoryActualsToEventKeys.ts`
- `convex/domain/events/reload/schedule/resolveDirectSeedSegments.ts`
- `convex/domain/events/reload/schedule/buildScheduledRows.ts`

Only `buildScheduledRows.ts` is truly scheduled-table projection. The rest is
shared reload boundary construction and should move out of `schedule/`.

There is also an unrelated pre-existing working-tree change in
`convex/tsconfig.json` changing `ES2022` to `ES2023`. Leave it alone.

## Target Structure

Create a new boundary-focused folder:

```text
convex/domain/events/reload/
  boundaries/
    buildReloadBoundaryContext.ts
    buildReloadBoundaryEvents.ts
    mapHistoryActualsToEventKeys.ts
    resolveDirectSeedSegments.ts
    index.ts
  schedule/
    buildScheduledRows.ts
    index.ts
  actual/
    ...
  shared/
    collectionHelpers.ts
    index.ts
  schemas.ts
  types.ts
  index.ts
```

Use `boundaries/`, not `shared/`, because this is core reload domain logic, not
a generic utility. The existing `shared/` folder should remain for tiny generic
helpers only.

## Specific Implementation

1. Move shared boundary files from `schedule/` to `boundaries/`:
   - `buildReloadScheduleContext.ts` becomes `buildReloadBoundaryContext.ts`.
   - `buildReloadBoundaryEvents.ts` moves unchanged except import paths and
     module wording.
   - `mapHistoryActualsToEventKeys.ts` moves unchanged except import paths and
     module wording if needed.
   - `resolveDirectSeedSegments.ts` moves unchanged except import paths and
     module wording if needed.

2. Rename the context type and function:
   - `ReloadScheduleContext` becomes `ReloadBoundaryContext`.
   - `buildReloadScheduleContext` becomes `buildReloadBoundaryContext`.
   - Return shape stays exactly `{ seedSegments, boundaryEvents }`.

3. Update exports:
   - `convex/domain/events/reload/boundaries/index.ts` exports
     `buildReloadBoundaryContext`.
   - `convex/domain/events/reload/schedule/index.ts` exports only
     `buildScheduledRows`.
   - `convex/domain/events/reload/index.ts` exports:
     - `buildActualRows` from `./actual`
     - `buildReloadBoundaryContext` from `./boundaries`
     - `buildScheduledRows` from `./schedule`

4. Update callers:
   - In `convex/functions/events/reload/mutations.ts`, rename local variables
     from `scheduleContext` to `boundaryContext`.
   - In reload tests, import and call `buildReloadBoundaryContext`.
   - Do not keep compatibility aliases unless needed by a real caller. The
     project is internal enough that this should be a clean rename.

5. Keep scheduled projection isolated:
   - `schedule/buildScheduledRows.ts` should stay in `schedule/`.
   - It should continue to copy `NextTerminalAbbrev` from boundary events and
     compute `IsLastArrivalOfSailingDay` per vessel/day.

6. Preserve current behavior:
   - Boundary construction remains grouped by vessel/day internally.
   - The minimum same-terminal five-minute turnaround policy remains in boundary
     construction.
   - History actual overlay remains in boundary construction.
   - Actual-row location fallback semantics remain unchanged.

## Comment Policy

Follow `.cursor/rules/comments-style.mdc` for every touched TypeScript file:

- Every function needs TSDoc with `@param` and `@returns`.
- Exported functions need a substantive middle paragraph.
- Module comments should describe the new boundary-stage role accurately.
- No Markdown markup in source comments.
- Comments should explain why, especially for the minimum same-terminal
  turnaround policy.

Suggested module wording for the new boundary context file:

```text
Builds the shared reload boundary context for scheduled and actual projections.

WSF schedule rows are resolved into direct physical seed segments, then grouped
into vessel-day boundary events with history actuals overlaid. Scheduled and
actual reload stages consume this boundary context so they agree on segment
identity, turnaround policy, and history hydration.
```

## Tests and Verification

Run these after the move:

```bash
bun test convex/domain/events/tests/reload.test.ts convex/domain/events/tests/scheduled.test.ts convex/functions/events/eventsScheduled/tests/listScheduledDockEventsForVesselSailingDay.test.ts
bun run type-check
bun run check
```

Expected behavior to preserve:

- Multi-vessel reload marks one final arrival per vessel/day.
- `buildScheduledRows` copies `NextTerminalAbbrev` directly from boundary
  records.
- Same-terminal identical arrival/departure times apply the five-minute
  turnaround adjustment to the arrival boundary only.
- Actual rows from history, trip fields, and location fallback remain unchanged.

## Acceptance Criteria

- No reload files outside `schedule/buildScheduledRows.ts` with shared boundary
  responsibility remain under `schedule/`.
- Public reload exports describe the real dependency direction:
  boundary context first, scheduled and actual projections second.
- All focused tests, TypeScript, and Biome checks pass.
- No unrelated changes are made to `convex/tsconfig.json` or other dirty files.
