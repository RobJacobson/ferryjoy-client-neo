# Events Old-Code-First Stage 13 Predicted Grouped Loader Handoff

## Stage Scope

Review `loadPredictedRowsGroupedForTrips` in
`convex/functions/events/eventsPredicted/queries.ts` against the old grouped
predicted-row loader, keeping only current additions required by live vessel
trip prediction enrichment.

This stage covers:

- `loadPredictedRowsGroupedForTrips`
- any directly required indexed read helper shared with that loader
- the grouped-loader portion of
  `convex/functions/events/eventsPredicted/tests/listPredictedDockEventsForVesselSailingDay.test.ts`

Stage 12 already approved the public
`listPredictedDockEventsForVesselSailingDay` query as a no-op. Do not remove
or materially reshape the public app query unless a grouped-loader change cannot
be made safely without it; report that blocker first.

Default editable files:

- `convex/functions/events/eventsPredicted/queries.ts`
- `convex/functions/events/eventsPredicted/tests/listPredictedDockEventsForVesselSailingDay.test.ts`
- this handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

Do not edit predicted schemas, predicted mutations, domain projection helpers,
vessel-trip read/merge code, generated files, or barrels unless the grouped
loader cannot be safely simplified without a tiny compatibility adjustment. If
that happens, stop and report the exact blocker before expanding scope.

## Required Reading

Read before implementation:

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- `docs/engineering/2026-05-08-events-old-code-first-stage-11-predicted-schemas-handoff.md`
- `docs/engineering/2026-05-08-events-old-code-first-stage-12-predicted-public-list-query-handoff.md`

Use `events-old-reference` as the implementation baseline. Do not use
`events-current-reference` unless the owner explicitly asks for archaeology.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/functions/events/eventsPredicted/queries.ts`
- current `convex/functions/events/eventsPredicted/queries.ts`
- current
  `convex/functions/events/eventsPredicted/tests/listPredictedDockEventsForVesselSailingDay.test.ts`
- current `convex/functions/vesselTrips/queries.ts`
- current `convex/functions/vesselTrips/read/mergeTripsWithPredictions.ts`

Old grouped-loader flow:

1. Accept `ctx` and trip-like rows with `VesselAbbrev` plus optional
   `SailingDay`.
2. Build a `Set` of vessel/sailing-day scope keys for trips that have
   `SailingDay`.
3. For each unique scope, parse the scope key back to `vesselAbbrev` and
   `sailingDay`.
4. Load same-scope predicted rows with the direct indexed vessel/day reader.
5. Group rows into a nested map keyed first by scope key, then by
   `predictedDockCompositeKey(row)`.
6. Return the nested map.

Old code returned stored `Doc<"eventsPredicted">` rows directly. It did not
strip Convex metadata or sort rows for grouped trip enrichment.

Raw LoC:

- old full `eventsPredicted/queries.ts`: 72
- old grouped-loader function slice: about 33 raw lines, including its TSDoc
- current full `eventsPredicted/queries.ts` before Stage 13: 134
- current grouped-loader function slice: about 50 raw lines, including its TSDoc
- current focused predicted query test before Stage 13: 276

## Current Grouped Loader Shape

Current code has:

- `loadPredictedRowsGroupedForTrips` exported from the predicted queries module
- one live production caller:
  `convex/functions/vesselTrips/queries.ts`
- downstream merge logic in
  `convex/functions/vesselTrips/read/mergeTripsWithPredictions.ts`
- scope de-duplication through `buildVesselSailingDayScopeKey`
- scope parsing through `parseVesselSailingDayScopeKey`
- composite grouping through `predictedDockCompositeKey`
- shared use of `readPredictedDockEventsForVesselSailingDay`, which strips
  Convex metadata and sorts rows for the public app list query

The current metadata stripping and sorting are not obviously required by
`mergeTripsWithPredictions`, which only reads prediction fields and performs map
lookups. However, separating raw grouped-loader reads from app-facing reads may
add more code than it removes. Do not add a second reader solely for purity or a
minor performance win unless it also makes the file materially smaller or
clearer.

## Current-Code Delta Table

| Delta beyond old grouped-loader flow | Default decision | Reason |
| --- | --- | --- |
| Exported grouped loader from current queries module | Keep | `convex/functions/vesselTrips/queries.ts` imports it directly for active/completed trip prediction enrichment. |
| `SailingDay === undefined` check instead of truthy check | Keep | It preserves valid string semantics without meaningful extra complexity. |
| Shared app-facing reader strips metadata and sorts | Investigate | Grouped trip merging does not need sorting or metadata stripping, but a separate raw reader may grow the file. Keep only if sharing remains the smallest readable shape. |
| `ConvexPredictedDockEvent` return type instead of `Doc<"eventsPredicted">` | Keep unless simplifying reader shape requires otherwise | Downstream merge code expects schema-shaped predicted rows; stored docs are structurally compatible, but type changes can ripple into vessel-trip code outside this stage. |
| Focused test file covers public query and grouped loader together | Reduce only if easy | Stage 12 intentionally deferred shared harness cleanup here. Trim obvious duplicated invocation/harness code only if behavior stays clear. |

## Hard Acceptance Bar

The current full query file is not more than 3x the full old file, and the
current grouped-loader flow still resembles old code. A valid Stage 13 result
must either:

1. reduce grouped-loader/test boilerplate without adding a parallel raw-reader
   path that is larger than what it replaces;
2. split app-facing and grouped-loader reads only if that materially improves
   size or clarity and keeps Stage 12 behavior intact; or
3. return a no-op/blocker report explaining why the old grouped-loader shape is
   already essentially preserved and why remaining coupling is not worth
   changing inside this stage.

Do not accept a tiny local LoC reduction if the file remains conceptually the
same. Do not add options, modes, or DTO wrappers around the grouped loader.

## Required Worker Report

The result must include:

1. Old grouped-loader LoC and old full-file LoC.
2. Current production LoC before edits.
3. Updated production LoC after edits.
4. Old/current/updated focused test LoC if tests are touched.
5. A complete old-flow trace from trips to nested prediction map.
6. A delta table explaining every meaningful difference from old code.
7. A clear recommendation: approve edits, no-op, or blocker.

If you decide no production change is appropriate, update this handoff with a
Worker Result section and update the stage log only if appropriate.

## Verification

If code or tests change, run:

```sh
bun test convex/functions/events/eventsPredicted/tests/listPredictedDockEventsForVesselSailingDay.test.ts
```

Run broader type checks only if public query signatures, grouped-loader return
types, or exports change:

```sh
bun run type-check
bun run convex:typecheck
```

If no code or test files change, verification may be a blocker-free review
report plus raw LoC confirmation.

## Recommendation

Start by proving whether grouped-trip enrichment needs metadata-free or sorted
rows. If it does not, compare the cost of a separate raw indexed reader against
the current shared reader. Prefer the smaller direct shape: if decoupling adds
more code than it removes, Stage 13 should be a no-op with that reasoning
recorded.

## Worker Result

The Stage 13 worker recommends approving a small production edit.

### Old-Flow Trace

Old `loadPredictedRowsGroupedForTrips` worked as follows:

1. Accept a Convex read context plus trip-like rows carrying `VesselAbbrev` and
   optional `SailingDay`.
2. Build a `Set` of vessel/sailing-day scope keys, skipping trips without
   `SailingDay`.
3. Parse each unique scope key back into `vesselAbbrev` and `sailingDay`.
4. Read same-scope predicted rows through the direct indexed
   `eventsPredicted.by_vessel_and_sailing_day` helper.
5. Build a nested `Map`: outer key is the vessel/day scope, inner key is
   `predictedDockCompositeKey(row)`.
6. Return stored `Doc<"eventsPredicted">` rows directly in the nested map.

### Live Current Callers

- `convex/functions/vesselTrips/queries.ts` imports
  `loadPredictedRowsGroupedForTrips` for active and completed trip enrichment.
- `convex/functions/vesselTrips/read/mergeTripsWithPredictions.ts` consumes the
  nested map, performs composite-key lookups, and only reads prediction fields
  (`EventPredictedTime`, `Actual`, `DeltaTotal`, plus key/type/source fields
  used by the composite key).
- The public app query remains
  `listPredictedDockEventsForVesselSailingDay`, used by
  `src/data/contexts/convex/ConvexVesselTimelineEventsContext.tsx`.

The grouped-trip merge does not require metadata stripping or deterministic
sorting. Those behaviors are app-facing requirements of the public list query.

### Change Made

`readPredictedDockEventsForVesselSailingDay` now returns stored
`Doc<"eventsPredicted">` rows directly, matching the old grouped-loader read
shape. The public `listPredictedDockEventsForVesselSailingDay` query now applies
`stripConvexMeta` and deterministic sorting locally before returning validator-
shaped rows.

This avoids adding a second raw reader or an options flag. It makes the one
indexed reader raw and keeps public response shaping at the public boundary.

### LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| Full `eventsPredicted/queries.ts` | 72 | 134 | 126 |
| Grouped-loader slice in `eventsPredicted/queries.ts` | 33 | about 50 | about 50 |
| Focused predicted query tests | 0 | 276 | 276 |

The grouped-loader slice line count stayed about the same because the edit was
to the shared indexed reader and public query boundary, not the grouping loop
itself. The full file dropped by deleting the separate public-list sort helper.

### Delta Table

| Current addition beyond old grouped-loader flow | Keep/delete | Reason |
| --- | --- | --- |
| Exported grouped loader from current queries module | Keep | `convex/functions/vesselTrips/queries.ts` imports it for live active and completed trip enrichment. |
| `SailingDay === undefined` check instead of old truthy check | Keep | Preserves valid string semantics without adding meaningful complexity. |
| Public query metadata stripping | Keep, but move to public query boundary | Required by the public return validator; grouped-trip enrichment does not need it. |
| Public query deterministic sort | Keep, but move to public query boundary | Required for stable app-facing list behavior; grouped-trip enrichment uses map lookups and does not need ordering. |
| Shared indexed reader | Keep as raw reader | It matches the old direct indexed read and avoids a second reader path. |
| `ConvexPredictedDockEvent` grouped-loader return type | Keep | Stored docs are structurally compatible, and changing the exported grouped-loader type would ripple outside Stage 13. |
| Focused combined test harness | Keep | Existing tests cover the public query and grouped loader clearly; trimming harness code would be unrelated to the production simplification. |

### Verification

Ran:

```sh
bun test convex/functions/events/eventsPredicted/tests/listPredictedDockEventsForVesselSailingDay.test.ts
```

Result: passed, 5 tests.

Broader type checks were not run because public query signatures, grouped-loader
return types, and exports did not change.

### Recommendation

Approve Stage 13. The update restores the old grouped-loader read behavior
while preserving Stage 12 public query behavior, reduces the full query file by
8 raw lines, and avoids adding any new mode, wrapper, or parallel reader.
