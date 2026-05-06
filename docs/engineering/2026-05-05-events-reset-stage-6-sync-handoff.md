# Events Reset Stage 6 Sync Handoff

## Assignment

Complete Stage 6 of the events tables blank-slate refactor: rebuild dock-event
sync actions and internal reload mutations around the stable table mutation
surfaces from Stages 3 through 5.

This stage should restore static scheduled/actual reload behavior without
recreating the old sync helper tree. Keep orchestration readable top-to-bottom,
keep reload persistence split by table, and do not rebuild or mutate
`eventsPredicted` during static reload.

## Required Reading

- `docs/engineering/2026-05-05-events-tables-blank-slate-refactor-prd.md`
- `docs/engineering/2026-05-05-events-tables-engineering-memo.md`
- `docs/engineering/2026-05-05-events-reset-stage-2-queries-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-3-scheduled-mutations-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-4-predicted-mutations-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-5-actual-mutations-handoff.md`
- `.cursor/rules/code-style.mdc`

Pay special attention to the PRD Stage 6 section, the engineering memo rows for
`reloadDockEventsForCurrentSailingDay`, `reloadDockEventsForSailingDay`,
`reloadDockEventsWindow`, `reloadDockEventsAtSailingDayBoundary`,
`replaceScheduledDockEventsForSailingDay`, and
`reloadActualDockEventsForSailingDay`.

## Stage Scope

Implement:

- `convex/functions/events/sync/actions.ts`
- `convex/functions/events/sync/mutations.ts`
- `convex/functions/events/sync/index.ts`
- `convex/functions/events/sync/reloadDockDataSchemas.ts`
- Focused sync behavior tests under `convex/functions/events/sync/tests/`

Allowed if it keeps sync readable and avoids a large helper tree:

- `convex/functions/events/sync/types.ts`
- `convex/functions/events/sync/reloadDockEventsForSailingDay.ts`
- `convex/functions/events/sync/reloadDockEventsWindow.ts`
- `convex/functions/events/sync/buildConvexReloadDockDataFromFetchedSlices.ts`
- `convex/functions/events/sync/fetchHistoryRecordsForDate.ts`
- `convex/functions/events/sync/loadTripIndexesForSailingDay.ts`

Allowed only as needed for sync behavior or live current callers:

- Extend the existing flat `convex/domain/events/actual.ts`.
- Add flat `convex/domain/events/scheduled.ts`.
- Import-path-only updates from nested scheduled paths to the flat scheduled
  module.
- Focused tests for the flat scheduled/actual helpers.

Allowed only if needed for grouped API path wiring:

- `convex/functions/events/index.ts`

Do not implement:

- Nested `convex/domain/events/actual/*`, `scheduled/*`, or `predicted/*`
  folders.
- Planner modules for row reconciliation.
- Compatibility barrels for deleted helper trees.
- Static reload behavior for `eventsPredicted`.
- Predicted projection helpers such as `buildPredictedDockWriteBatch` or
  `buildPredictedDockClearBatch`.
- Top-level `eventsActual` / `eventsPredicted` / `eventsScheduled` aliases in
  `convex/functions/index.ts` unless a live production caller requires them.
- Placeholder files whose only purpose is satisfying stale generated API paths.

If `bun run type-check` remains blocked by predicted projection helpers, report
that exactly. Do not implement predicted projection in this stage unless the
owner explicitly expands scope.

## Required Action Surface

Implement and export from `actions.ts`:

```ts
reloadDockEventsForCurrentSailingDay: action({ args: {} })
```

Behavior:

- Derive the current sailing day with `getSailingDay(new Date())`.
- Delegate to the single-day reload helper.
- Return `{ ScheduledCount, ActualCount }`.

Implement and export:

```ts
reloadDockEventsForSailingDay: action({
  args: { targetDate: v.string() }
})
```

Behavior:

- Reload the explicit `targetDate`.
- Return `{ ScheduledCount, ActualCount }`.

Implement and export:

```ts
reloadDockEventsWindow: internalAction({
  args: { daysToSync: v.optional(v.number()) }
})
```

Behavior:

- Default to two sailing days when `daysToSync` is omitted.
- Start from `getSailingDay(new Date())`.
- Reload consecutive sailing days.
- Aggregate `totalScheduled`, `totalActual`, and `daysProcessed`.

Implement and export:

```ts
reloadDockEventsAtSailingDayBoundary: internalAction({
  args: { daysToSync: v.optional(v.number()) }
})
```

Behavior:

- Use `getPacificTimeComponents(new Date())`.
- If the Pacific hour is not `3`, skip work and return:

```ts
{
  skipped: true,
  reason: "outside_pacific_3am_window",
  totalScheduled: 0,
  totalActual: 0,
  daysProcessed: [],
}
```

- If the Pacific hour is `3`, run the window reload and return the aggregate
  result with `skipped: false`.
- Preserve the `internal.functions.events.sync.index.reloadDockEventsAtSailingDayBoundary`
  path required by `convex/crons.ts`.

## Required Internal Mutation Surface

Implement and export from `mutations.ts`:

```ts
replaceScheduledDockEventsForSailingDay: internalMutation({
  args: { ReloadDockScheduleData: reloadDockScheduleDataSchema },
  returns: v.object({ ScheduledCount: v.number() }),
})
```

Behavior:

- Build scheduled dock rows from `ReloadDockScheduleData.ScheduleSegments`.
- Use the current `upsertScheduledRowsForSailingDay` table helper.
- Return the produced row count.

Implement and export:

```ts
reloadActualDockEventsForSailingDay: internalMutation({
  args: { ReloadDockData: reloadDockDataSchema },
  returns: v.object({ ActualCount: v.number() }),
})
```

Behavior:

- Build actual dock rows from schedule segments, history records, trip context,
  and live vessel locations.
- Use the current `upsertActualDockRows` table helper.
- Preserve physical-only observations in the produced actual row set.
- Do not replace scheduled rows.
- Do not touch `eventsPredicted`.
- Return the produced actual count.

Implement only if useful for compatibility with reference tests or operator
smoke coverage:

```ts
replaceDockEventsForSailingDay: internalMutation({
  args: { ReloadDockData: reloadDockDataSchema },
  returns: v.object({
    ScheduledCount: v.number(),
    ActualCount: v.number(),
  }),
})
```

If implemented, compose the split scheduled and actual helpers. Do not make it a
separate reconciliation path.

## Reload Payload Schemas

Implement numeric Convex reload validators under
`convex/functions/events/sync/reloadDockDataSchemas.ts`.

Expected schedule segment fields:

- `VesselName`
- `DepartingTerminalID`
- `ArrivingTerminalID`
- `DepartingTerminalName`
- `ArrivingTerminalName`
- `DepartingTime`
- optional `ArrivingTime`
- `SailingNotes`
- `Annotations`
- `RouteID`
- `RouteAbbrev`
- `SailingDay`

Expected history record fields:

- `VesselId`
- optional `Vessel`
- optional `Departing`
- optional `Arriving`
- optional `ScheduledDepart`
- optional `ActualDepart`
- optional `EstArrival`

Keep action-side adapter data conversion in a small sync helper if useful. Use
structured Date conversion helpers from `shared/convertDates` instead of ad hoc
string manipulation.

## Flat Domain Helpers

The sync mutation may need event-domain logic to build rows. Add only the
smallest flat helpers needed.

Prefer:

- `convex/domain/events/scheduled.ts` for scheduled boundary construction,
  scheduled row construction, and current scheduled segment resolver imports.
- Extending `convex/domain/events/actual.ts` for actual reload hydration and row
  construction.

Do not recreate nested `domain/events/scheduled/*` or `domain/events/actual/*`.
If current live imports point at nested scheduled paths, migrate them to the flat
scheduled module within this bounded stage.

Scheduled helper behavior to preserve if implemented:

- Build `dep-dock` and `arv-dock` boundary records from direct schedule
  segments.
- Resolve vessel and terminal identities using existing adapter identity helpers.
- Use shared key helpers for segment and boundary keys.
- Sort boundary records deterministically.
- Preserve arrival-before-departure seam ordering.
- Build persisted scheduled rows with `NextTerminalAbbrev` and
  `IsLastArrivalOfSailingDay`.
- Keep `inferScheduledSegmentFromDepartureEvent`,
  `findNextDepartureEvent`, and `ConvexInferredScheduledSegment` available for
  live vessel-trip callers, but from the flat scheduled module.

Actual reload behavior to preserve if implemented:

- Hydrate schedule-derived boundary records with history actuals.
- Build schedule-backed actual rows using trip indexes.
- Include physical-only actual rows for trips without `ScheduleKey` when they
  have `TripKey` plus `LeftDockActual` or `TripEnd`.
- Merge live-location actual patches where the reference behavior already does.
- Upsert actual rows by `EventKey`; do not delete omitted physical observations
  during static reload.

If any reload-domain behavior becomes too large to implement cleanly in this
stage, stop and report the exact behavior and caller instead of adding a deep
helper hierarchy.

## Reference Files

Inspect behavior with `git show`, but do not port files wholesale:

- `events-current-reference:convex/functions/events/sync/actions.ts`
- `events-current-reference:convex/functions/events/sync/mutations.ts`
- `events-current-reference:convex/functions/events/sync/index.ts`
- `events-current-reference:convex/functions/events/sync/reloadDockDataSchemas.ts`
- `events-current-reference:convex/functions/events/sync/reloadDockEventsForSailingDay.ts`
- `events-current-reference:convex/functions/events/sync/reloadDockEventsWindow.ts`
- `events-current-reference:convex/functions/events/sync/replaceDockEventsForSailingDay.ts`
- `events-current-reference:convex/functions/events/sync/buildConvexReloadDockDataFromFetchedSlices.ts`
- `events-current-reference:convex/functions/events/sync/fetchHistoryRecordsForDate.ts`
- `events-current-reference:convex/functions/events/sync/loadTripIndexesForSailingDay.ts`
- `events-current-reference:convex/functions/events/sync/tests/runReloadDockEventsForSailingDay.test.ts`
- `events-current-reference:convex/functions/events/sync/tests/runReloadDockEventsWindow.test.ts`
- `events-current-reference:convex/functions/events/sync/tests/reloadDockEventsAtSailingDayBoundary.test.ts`
- `events-current-reference:convex/functions/events/sync/tests/replaceDockEventsForSailingDay.test.ts`
- `events-current-reference:convex/domain/events/scheduled/*.ts`
- `events-current-reference:convex/domain/events/scheduled/tests/*.test.ts`
- `events-current-reference:convex/domain/events/actual/reloadDockEventsForSailingDay.ts`
- `events-current-reference:convex/domain/events/actual/hydrateActualTransitionsFromReloadInputs.ts`
- `events-current-reference:convex/domain/events/actual/tests/*.test.ts`
- `events-old-reference:convex/domain/events/scheduled.ts`
- `events-old-reference:convex/domain/events/actual.ts`

The current reference is behavior truth. The old reference is useful only as a
flatter shape baseline. Neither should force nested folders or compatibility
exports.

## Test Guidance

Add focused behavior tests. Prefer direct handler tests for Convex actions and
mutations when that keeps setup small.

Cover actions:

- Single-day reload calls the split scheduled and actual internal mutations with
  Convex-shaped payloads.
- Window reload defaults to two days and aggregates counts.
- Explicit `daysToSync` controls the window length.
- Boundary action skips outside Pacific hour 3 with structured skip metadata.
- Boundary action runs the window reload during Pacific hour 3.

Cover internal mutations:

- Scheduled reload calls `upsertScheduledRowsForSailingDay` with rows built from
  the schedule payload and returns `ScheduledCount`.
- Actual reload calls `upsertActualDockRows`, returns `ActualCount`, and does
  not call predicted table helpers.
- Combined `replaceDockEventsForSailingDay`, if implemented, composes the split
  helpers and does not add a separate reconciliation path.

Cover flat domain helpers only to the extent needed to protect product behavior:

- Scheduled row construction, `NextTerminalAbbrev`, last-arrival marking, and
  seam/ordering behavior.
- Scheduled segment resolver behavior for current callers.
- Actual reload physical-only row construction and preservation semantics.

Do not preserve tests that only assert nested module boundaries or planner file
shape.

## Verification Gate

Run:

- Focused sync tests you add or update.
- Focused scheduled/actual domain tests if you add or extend flat domain
  helpers.
- Existing table mutation tests from Stages 3 and 5 if sync calls those helpers
  directly.
- `bun run convex:typecheck` if the restored sync and scheduled-domain surfaces
  make it meaningful.
- `bun run type-check` for signal, but report known predicted projection
  blockers instead of implementing them in this stage.

Before finishing, report:

- Files changed.
- Reference files inspected.
- Tests run and results.
- Whether `bun run convex:typecheck` and `bun run type-check` were meaningful
  and what blocked them, if anything.
- Any intentional exceptions to the PRD or style guide.
