# Events Reset Stage 2 Queries Handoff

## Assignment

Complete Stage 2 of the events tables blank-slate refactor: rebuild the query
surface for the three dock-event tables.

This stage should make the query-facing table shape clear without pulling
mutation, sync, reload, or projection architecture back in.

## Required Reading

- `docs/engineering/2026-05-05-events-tables-blank-slate-refactor-prd.md`
- `docs/engineering/2026-05-05-events-tables-engineering-memo.md`
- `docs/engineering/2026-05-05-events-reset-stage-1-inventory-handoff.md`
- `.cursor/rules/code-style.mdc`

Pay special attention to the Stage 1 inventory rows for schemas, public list
queries, `readScheduledDockEventsForVesselSailingDay`, and
`loadPredictedRowsGroupedForTrips`.

## Stage Scope

Implement:

- `convex/functions/events/eventsScheduled/schemas.ts`
- `convex/functions/events/eventsScheduled/queries.ts`
- `convex/functions/events/eventsScheduled/index.ts`
- `convex/functions/events/eventsActual/schemas.ts`
- `convex/functions/events/eventsActual/queries.ts`
- `convex/functions/events/eventsActual/index.ts`
- `convex/functions/events/eventsPredicted/schemas.ts`
- `convex/functions/events/eventsPredicted/queries.ts`
- `convex/functions/events/eventsPredicted/index.ts`
- `convex/functions/events/index.ts`
- Focused query behavior tests under each table's `tests/` folder.

Allowed only if needed for this stage:

- A tiny shared dock-event primitive validator if duplicating it would be less
  clear. If you add one, keep it under `convex/functions/events/common/` and
  justify it in your final notes as a true common event primitive.
- A tiny flat domain helper for `predictedDockCompositeKey` if needed to keep
  `loadPredictedRowsGroupedForTrips` aligned with the current trip-join caller.
  Prefer `convex/domain/events/predicted.ts`. Do not recreate nested
  `domain/events/predicted/*` folders.
- A minimal edit to `convex/functions/index.ts` if needed to preserve the grouped
  `events` API path while removing redundant top-level table aliases.

Do not implement:

- `mutations.ts` files.
- `sync/` actions or mutations.
- Reload schemas or reload helpers.
- Actual reload/reconcile domain helpers.
- Predicted projection builders.
- Scheduled segment resolver domain helpers.
- Compatibility barrels for planner or nested domain modules.
- Placeholder files whose only purpose is to make future stages easier.

If `bun run convex:typecheck` remains blocked by missing later-stage APIs, report
the exact missing surfaces instead of creating stubs.

## Required Query Surface

### `eventsScheduled`

Implement:

```ts
listScheduledDockEventsForVesselSailingDay: query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsScheduledSchema),
})
```

Implement and export:

```ts
readScheduledDockEventsForVesselSailingDay(
  ctx,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexScheduledDockEvent[]>
```

`readScheduledDockEventsForVesselSailingDay` is required by the current
`vesselTripScheduleQueries.ts` production caller.

Behavior:

- Query `eventsScheduled` with `by_vessel_and_sailing_day`.
- Strip Convex metadata before returning validator-shaped rows.
- Return deterministic chronological ordering.
- Preserve arrival-before-departure ordering for equal boundary times.
- Keep sort helpers local unless a current production caller requires export.

### `eventsActual`

Implement:

```ts
listActualDockEventsForVesselSailingDay: query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsActualSchema),
})
```

Behavior:

- Query `eventsActual` with `by_vessel_and_sailing_day`.
- Strip Convex metadata before returning validator-shaped rows.
- Sort by `ScheduledDeparture`, then `EventKey`.
- Do not export `readActualDockEventsForVesselSailingDay` unless it genuinely
  reduces implementation/test duplication. It is reference-only, not a required
  production API.

### `eventsPredicted`

Implement:

```ts
listPredictedDockEventsForVesselSailingDay: query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsPredictedSchema),
})
```

Implement and export:

```ts
loadPredictedRowsGroupedForTrips(
  ctx,
  trips: { VesselAbbrev: string; SailingDay?: string }[]
): Promise<Map<string, Map<string, ConvexPredictedDockEvent>>>
```

Behavior:

- Query `eventsPredicted` with `by_vessel_and_sailing_day`.
- Strip Convex metadata before returning validator-shaped rows.
- Sort list query rows by `ScheduledDeparture`, then `Key`.
- For grouped trip loading, build unique vessel/sailing-day scopes, load each
  scope once, and group by the composite predicted row identity:
  `Key|PredictionType|PredictionSource`.
- Do not export `readPredictedDockEventsForVesselSailingDay` unless it genuinely
  reduces implementation/test duplication. It is reference-only, not a required
  production API.

## Schema Surface

Confirm fields from `events-current-reference`, but do not port files wholesale.

Expected `eventsScheduled` fields:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `UpdatedAt`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `NextTerminalAbbrev`
- `EventType`
- optional `EventScheduledTime`
- optional `IsLastArrivalOfSailingDay`

Expected `eventsActual` fields:

- `EventKey`
- `TripKey`
- `EventType`
- `VesselAbbrev`
- `SailingDay`
- `UpdatedAt`
- `ScheduledDeparture`
- `TerminalAbbrev`
- optional `EventOccurred`
- optional `EventActualTime`

Expected `eventsPredicted` fields:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `UpdatedAt`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `EventPredictedTime`
- `PredictionType`
- `PredictionSource`
- optional `Actual`
- optional `DeltaTotal`

Also keep these predicted write types and validators because current
orchestrator imports them, even though mutation behavior is later-stage:

- `ConvexPredictedDockWriteRow`
- `ConvexPredictedDockWriteBatch`
- `predictedDockWriteBatchSchema`
- `ConvexPredictionSource`

Do not implement DTO converter `types.ts` files unless you decide to preserve
the `src/types/index.ts` public re-export surface. If you do preserve them, keep
them tiny and note the choice. If you do not preserve them, do not edit app code
unless necessary for a focused verification gate.

## Reference Files

Inspect behavior and field shapes with `git show`, but do not port wholesale:

- `events-current-reference:convex/functions/events/eventsScheduled/schemas.ts`
- `events-current-reference:convex/functions/events/eventsScheduled/queries.ts`
- `events-current-reference:convex/functions/events/eventsScheduled/tests/listScheduledDockEventsForVesselSailingDay.test.ts`
- `events-current-reference:convex/functions/events/eventsActual/schemas.ts`
- `events-current-reference:convex/functions/events/eventsActual/queries.ts`
- `events-current-reference:convex/functions/events/eventsActual/tests/listActualDockEventsForVesselSailingDay.test.ts`
- `events-current-reference:convex/functions/events/eventsPredicted/schemas.ts`
- `events-current-reference:convex/functions/events/eventsPredicted/queries.ts`
- `events-current-reference:convex/functions/events/eventsPredicted/tests/listPredictedDockEventsForVesselSailingDay.test.ts`
- `events-old-reference` table files for simpler shape comparison only.

## Test Guidance

Port or rewrite only query behavior tests:

- Scoped index reads use the vessel and sailing-day args.
- Returned rows strip `_id` and `_creationTime`.
- Returned rows are deterministically sorted.
- Scheduled equal-time rows sort arrival before departure.
- Predicted grouped loader skips trips without `SailingDay`, loads each
  vessel/day scope once, and groups by composite prediction key.

Do not preserve tests that only assert internal helper exports.

## Verification Gate

Run:

- Focused query tests you add or update.
- `bun run convex:typecheck` if the stage restores enough API surface for it to
  be meaningful.

If typecheck fails because mutation, sync, or domain helper stages are still
missing, report those blockers exactly. Do not create stubs for later stages.

Before finishing, report:

- Files changed.
- Reference files inspected.
- Tests run and results.
- Whether `bun run convex:typecheck` was meaningful and what blocked it, if
  anything.
- Any intentional exceptions to the PRD or style guide.
