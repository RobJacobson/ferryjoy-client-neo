# Events Reset Predicted Projection Helpers Handoff

## Assignment

Restore the small predicted event projection domain surface that live
vessel-orchestrator event assembly still requires before the final audit.

This is not Stage 7 cleanup. Stage 7 is effectively a no-op audit checkpoint.
This handoff exists because `buildPredictedDockWriteBatch` and
`buildPredictedDockClearBatch` are live imports from
`convex/domain/vesselOrchestration/updateEvents/eventWriteAssembler.ts` and
currently block meaningful typecheck signal.

Keep the change narrowly focused on converting one prediction-enriched vessel
trip into sparse `eventsPredicted` write batches. Do not recreate the old
nested predicted-domain helper tree or planner/reconciliation modules.

## Required Reading

- `docs/engineering/2026-05-05-events-tables-blank-slate-refactor-prd.md`
- `docs/engineering/2026-05-05-events-tables-engineering-memo.md`
- `docs/engineering/2026-05-05-events-reset-stage-4-predicted-mutations-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-6-sync-handoff.md`
- `.cursor/rules/code-style.mdc`

Pay special attention to the engineering memo row for
`buildPredictedDockWriteBatch` and `buildPredictedDockClearBatch`, plus the
Stage 4/6 exclusions that intentionally deferred this surface until a live
caller needed it.

## Stage Scope

Implement:

- `convex/domain/events/predicted.ts`
- Focused tests under `convex/domain/events/tests/`

Allowed only if needed for typing or import cleanup:

- `convex/domain/vesselOrchestration/updateEvents/eventWriteAssembler.ts`

Do not implement:

- Nested `convex/domain/events/predicted/*` folders.
- Planner modules or reconciliation helpers.
- Any changes to `convex/functions/events/eventsPredicted/mutations.ts`.
- Any changes to `convex/functions/events/eventsPredicted/queries.ts`.
- Public/internal Convex wrappers such as old
  `projectPredictedDockWriteBatches`.
- DTO converter files such as `convex/functions/events/eventsPredicted/types.ts`.
- Compatibility barrels or generated-path placeholder files.
- Static reload behavior for `eventsPredicted`.
- Stage 8 audit documentation.

If a broader typecheck blocker appears after these helpers are implemented,
report the exact blocker. Do not add future-stage stubs.

## Required Function Surface

Extend the existing flat module:

```ts
// convex/domain/events/predicted.ts
buildPredictedDockWriteBatch(
  trip: ConvexVesselTripWithML
): ConvexPredictedDockWriteBatch | null

buildPredictedDockClearBatch(
  trip: ConvexVesselTrip | ConvexVesselTripWithML
): ConvexPredictedDockWriteBatch | null
```

Keep the existing export:

```ts
predictedDockCompositeKey(row): string
```

The exact clear-batch parameter type can be narrower than
`ConvexVesselTrip | ConvexVesselTripWithML` if that keeps the helper simpler,
but it must accept the live callers in `eventWriteAssembler.ts` without casts.

## Live Callers

`eventWriteAssembler.ts` uses these helpers to build
`PingEventWrites.predictedDockWriteBatches`.

Those batches flow into:

- `convex/domain/vesselOrchestration/updateEvents/projectEventsFromHandoff.ts`
- `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`
- `convex/functions/events/eventsPredicted/mutations.ts`

This makes the helper surface production-relevant, not a reference-only
compatibility alias.

## Required Behavior

`buildPredictedDockWriteBatch`:

- Return `null` when `SailingDay` is missing.
- Derive target boundary keys with `buildTripPredictionBoundaryKeys`.
- Return `null` when no target boundary keys can be derived.
- Return a batch with:
  - `VesselAbbrev` from the trip.
  - `SailingDay` from the trip.
  - `TargetKeys` containing distinct current departure, current arrival, and
    next departure boundary keys when available.
  - `Rows` containing sparse predicted write rows without `UpdatedAt`.
- Use `ScheduleKey` for the current leg when present; otherwise fall back to
  `TripKey`.
- Emit current departure ML row when `AtDockDepartCurr` exists and the trip has
  a current segment, `ScheduledDeparture`, and departure terminal.
- Emit a current arrival WSF ETA row when `Eta` exists and the trip has a current
  segment, `ScheduledDeparture`, and arrival terminal.
- Emit the best current arrival ML row on the current arrival boundary:
  prefer `AtSeaArriveNext`; otherwise use `AtDockArriveNext`.
- Emit the best next departure ML row when `NextScheduleKey`,
  `NextScheduledDeparture`, and `ArrivingTerminalAbbrev` exist:
  prefer `AtSeaDepartNext`; otherwise use `AtDockDepartNext`.
- Copy optional `Actual` and `DeltaTotal` from ML prediction payloads when
  present.
- Deduplicate rows by `predictedDockCompositeKey`; if duplicates appear, keep a
  deterministic result and cover it in tests.
- It is valid to return a non-null batch with an empty `Rows` array when the
  trip still owns target keys but has no active prediction payloads. This allows
  the mutation layer to clear stale rows for that scope.

`buildPredictedDockClearBatch`:

- Return `null` when `SailingDay` is missing.
- Derive the same target boundary keys as the write batch.
- Return `null` when no target boundary keys can be derived.
- Return a batch with the trip `VesselAbbrev`, trip `SailingDay`, populated
  `TargetKeys`, and an empty `Rows` array.

## Reference Files

Inspect behavior with `git show`, but do not port the nested structure:

- `events-current-reference:convex/domain/events/predicted/buildPredictedDockEventEffects.ts`
- `events-current-reference:convex/domain/events/predicted/tests/buildPredictedDockEventEffects.test.ts`
- `events-current-reference:convex/domain/events/predicted/predictedDockCompositeKey.ts`
- `events-current-reference:convex/functions/events/eventsPredicted/mutations.ts`
- `events-current-reference:convex/domain/vesselOrchestration/updateEvents/eventWriteAssembler.ts`

Useful current files:

- `convex/domain/events/predicted.ts`
- `convex/shared/keys.ts`
- `convex/functions/events/eventsPredicted/schemas.ts`
- `convex/functions/vesselTrips/schemas.ts`
- `convex/domain/vesselOrchestration/updateEvents/eventWriteAssembler.ts`

## Test Guidance

Add focused domain tests for the new helpers. Suggested file:

- `convex/domain/events/tests/predicted.test.ts`

Cover:

- Write batch carries the full target key scope even when only one row is
  emitted.
- Write batch emits WSF ETA and best ML arrival row on the current arrival
  boundary.
- Write batch emits current departure and next departure ML rows with correct
  prediction types, sources, boundary keys, terminals, and optional actual/delta
  fields.
- Write batch can return an empty row set while retaining target keys.
- Write batch returns `null` when `SailingDay` is missing.
- Write batch returns `null` when no current or next boundary key can be
  derived.
- Clear batch returns the same target key scope with empty rows.
- Clear batch returns `null` when it cannot scope the trip.
- Deduplication behavior is deterministic if duplicate composite rows can be
  produced.

Tests should import `convex/domain/events/predicted.ts` directly. Do not widen
barrels only for tests.

## Verification Gate

Run:

- Focused predicted-domain tests.
- Existing predicted mutation tests if the helper change could affect sparse
  batch shape.
- `bun run convex:typecheck`.
- `bun run type-check`.

If `bun run convex:typecheck` or `bun run type-check` fails, report the exact
missing module/symbol or type error. Do not add compatibility placeholders just
to make generated paths pass.

Before finishing, report:

- Files changed.
- Reference files inspected.
- Tests run and results.
- Whether `bun run convex:typecheck` and `bun run type-check` passed or the
  exact blockers.
- Any intentional exceptions to the PRD or style guide.
