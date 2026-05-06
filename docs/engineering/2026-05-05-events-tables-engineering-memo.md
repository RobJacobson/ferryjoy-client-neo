# Events Tables Engineering Memo

## Summary

The three dock-event tables are the lowest-level event persistence surfaces in the system:

- `eventsScheduled`: planned dock boundary rows derived from official schedule data.
- `eventsActual`: observed dock boundary rows derived from physical evidence and trip context.
- `eventsPredicted`: predicted dock boundary rows derived from ETA and ML prediction data.

These tables are intentionally close to storage. They should not become an orchestration layer, a generic event framework, or a domain architecture showcase.

## Purpose Of Each Table

### `eventsScheduled`

Stores the planned dock boundaries for a vessel and sailing day. These rows form the schedule backbone that UI timelines, trip resolution, and reload logic can read.

Expected write pattern:

- Full-day replacement for a sailing day.
- Rows absent from a fresh schedule slice are deleted.
- Rows present and changed are replaced.
- Rows unchanged are left alone.

Expected read pattern:

- List by `VesselAbbrev` and `SailingDay`.
- Return stable chronological ordering.

### `eventsActual`

Stores observed dock boundaries. In realtime, these are emitted through the `VesselOrchestrator` path after upstream DTO/domain processing. In static reload, history and current location evidence may also create or refresh actual rows.

Expected write pattern:

- Sparse upsert by physical `EventKey`.
- Incoming duplicates collapse by `EventKey`.
- Rows are inserted, replaced, or skipped.
- Reload should not blindly delete physical-only observations that should survive the schedule refresh.

Expected read pattern:

- List by `VesselAbbrev` and `SailingDay`.
- Return stable chronological ordering.

### `eventsPredicted`

Stores ETA and ML predictions for dock boundaries. These are maintained by realtime prediction/event projection, not by the static schedule reload.

Expected write pattern:

- Sparse batch reconciliation by vessel and sailing day.
- Reconcile only targeted dock boundary keys.
- Delete stale rows for targeted keys.
- Insert, replace, or skip incoming prediction rows.
- Patch depart-next ML rows when an actual departure boundary confirms them.

Expected read pattern:

- List by `VesselAbbrev` and `SailingDay`.
- Provide grouped prediction rows for trip joins if still required by current callers.

## Current Problem

The event-table code has grown far beyond the intended level of abstraction. On the current reference branch, the scoped implementation under `convex/functions/events` and `convex/domain/events` is about 9,528 lines across 90 files.

The Apr 25 scoped reference was about 982 lines across 22 files. A broader fair baseline that includes related old timeline-row helpers was about 3,594 lines. The current implementation is still much larger.

The growth came from:

- Moving table-local mutation decisions into domain/planner modules.
- Splitting small readable functions into many single-purpose files.
- Adding compatibility re-export layers.
- Creating nested `domain/events` directories for purity concerns.
- Mirroring function schemas and types in domain code.
- Adding tests around internal decomposition rather than only behavior.

Some added code is valuable, especially behavior tests, public list queries, and real reload/prediction behavior. The problem is not that code was added; the problem is that the architecture no longer matches the low-level table role.

## Architectural Boundary

### `functions/events`

Owns Convex-facing table modules:

- Schemas and validators.
- Public queries.
- Internal mutation helpers.
- Static reload actions and internal mutations under `sync`.
- Table-local reconciliation logic.

Table-local reconciliation means insert/update/delete decisions for one event table. That logic usually belongs beside the mutation, not in `domain`.

### `domain/events`

Optional. Should contain only event business logic that is easier to understand outside a Convex function or is reused by multiple callers.

Appropriate domain code:

- Build dock boundary facts from schedule segments.
- Build prediction event facts from trip/ML DTOs.
- Infer actual event facts from physical location evidence.
- Resolve schedule seams or boundary ordering when reused outside one query.

Inappropriate domain code:

- Convex table persistence plans.
- Compatibility type barrels.
- Schema mirrors.
- Generic event abstractions.
- Deep nested helper folders.

### Shared Logic With VesselOrchestrator

Realtime data reaches event tables through `VesselOrchestrator`. In that path, fetched data is processed by `VesselOrchestrator` domain functions, passed through `VesselOrchestrator` function code, and then persisted into event tables.

Static reload should not reinvent a realtime transformation if the same DTO-level ferry logic already exists. If a transformation is truly useful to both realtime and static reload, move it to a neutral shared domain location. Do not make event-table modules depend on `functions/vesselOrchestrator`.

This refactor must not rewrite VesselOrchestrator internals.

## Minimum Required Function Signatures

Implementing agents must confirm all callers before editing. The following signatures are the expected minimum current surface.

### `convex/functions/events/eventsScheduled/queries.ts`

```ts
listScheduledDockEventsForVesselSailingDay: query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsScheduledSchema),
})
```

Optional internal reader if callers require it:

```ts
readScheduledDockEventsForVesselSailingDay(
  ctx,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexScheduledDockEvent[]>
```

### `convex/functions/events/eventsScheduled/mutations.ts`

```ts
upsertScheduledRowsForSailingDay(
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ConvexScheduledDockEvent[]
): Promise<void>
```

Required behavior:

- Load existing rows by sailing day.
- Delete stale keys.
- Insert missing keys.
- Replace changed keys.
- Skip unchanged keys.

### `convex/functions/events/eventsActual/queries.ts`

```ts
listActualDockEventsForVesselSailingDay: query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsActualSchema),
})
```

Optional internal reader if callers require it:

```ts
readActualDockEventsForVesselSailingDay(
  ctx,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexActualDockEvent[]>
```

### `convex/functions/events/eventsActual/mutations.ts`

```ts
upsertActualDockRows(
  ctx: MutationCtx,
  rows: ConvexActualDockEvent[]
): Promise<void>
```

Required behavior:

- Deduplicate rows by `EventKey`.
- Insert new rows.
- Replace changed rows.
- Skip unchanged rows.

Reload-specific actual behavior may live in `sync` or a small actual helper, but must remain explicit and tested.

### `convex/functions/events/eventsPredicted/queries.ts`

```ts
listPredictedDockEventsForVesselSailingDay: query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(eventsPredictedSchema),
})
```

Optional internal readers if callers require them:

```ts
readPredictedDockEventsForVesselSailingDay(
  ctx,
  args: { vesselAbbrev: string; sailingDay: string }
): Promise<ConvexPredictedDockEvent[]>
```

```ts
loadPredictedRowsGroupedForTrips(
  ctx,
  trips: { VesselAbbrev: string; SailingDay?: string }[]
): Promise<Map<string, Map<string, ConvexPredictedDockEvent>>>
```

### `convex/functions/events/eventsPredicted/mutations.ts`

```ts
upsertPredictedDockBatches(
  ctx: MutationCtx,
  batches: ReadonlyArray<{
    VesselAbbrev: string;
    SailingDay: string;
    TargetKeys: string[];
    Rows: ConvexPredictedDockWriteRow[];
  }>
): Promise<void>
```

```ts
patchDepartNextMlRowsForDepBoundary(
  ctx: MutationCtx,
  depKey: string,
  actualMs: number
): Promise<boolean>
```

Required behavior:

- Merge batches by vessel and sailing day.
- Reconcile only `TargetKeys`.
- Delete stale targeted predictions.
- Insert new prediction rows.
- Replace changed prediction rows.
- Skip unchanged prediction rows.
- Patch depart-next ML rows with actual time and delta.

### `convex/functions/events/sync/actions.ts`

```ts
reloadDockEventsForCurrentSailingDay: action({ args: {} })
```

```ts
reloadDockEventsForSailingDay: action({
  args: { targetDate: v.string() }
})
```

```ts
reloadDockEventsWindow: internalAction({
  args: { daysToSync: v.optional(v.number()) }
})
```

```ts
reloadDockEventsAtSailingDayBoundary: internalAction({
  args: { daysToSync: v.optional(v.number()) }
})
```

Required behavior:

- Manual current-day reload.
- Manual explicit-day reload.
- Internal multi-day reload window.
- Internal Pacific 3am boundary-gated reload.

### `convex/functions/events/sync/mutations.ts`

```ts
replaceDockEventsForSailingDay: internalMutation({
  args: { ReloadDockData: reloadDockDataSchema },
  returns: v.object({
    ScheduledCount: v.number(),
    ActualCount: v.number(),
  }),
})
```

```ts
replaceScheduledDockEventsForSailingDay: internalMutation({
  args: { ReloadDockScheduleData: reloadDockScheduleDataSchema },
  returns: v.object({
    ScheduledCount: v.number(),
  }),
})
```

```ts
reloadActualDockEventsForSailingDay: internalMutation({
  args: { ReloadDockData: reloadDockDataSchema },
  returns: v.object({
    ActualCount: v.number(),
  }),
})
```

Required behavior:

- Scheduled reload can run independently.
- Actual reload can run independently.
- Combined reload writes scheduled and actual rows.
- Static reload does not rebuild `eventsPredicted`.

## Confirmed Stage 1 API Inventory

Inventory confirmed against the current broken branch, `events-current-reference`,
and `events-old-reference`. `events-current-reference` is behavior/API truth;
`events-old-reference` is useful mainly as a flatter implementation baseline.

| Export | Kind | Required? | Production callers | App callers | Tests | Reference branch notes | Implementation notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `eventsScheduledSchema`, `ConvexScheduledDockEvent`, `DockEventType`, `dockEventTypeSchema` from `convex/functions/events/eventsScheduled/schemas.ts` | Schema/type | Must implement | `convex/schema.ts`; `convex/functions/vesselOrchestrator/queries/vesselTripScheduleQueries.ts`; vessel-orchestrator and vessel-trip domain types | Timeline context and render-pipeline type imports | Current branch timeline, vessel-trip, and schedule tests import the type | Current reference schema fields: `Key`, `VesselAbbrev`, `SailingDay`, `UpdatedAt`, `ScheduledDeparture`, `TerminalAbbrev`, `NextTerminalAbbrev`, `EventType`, optional `EventScheduledTime`, optional `IsLastArrivalOfSailingDay` | Schema/type surface is required even though it is not a runtime function. Keep dock event type shared without making another table depend on scheduled. |
| `ScheduledDockEvent`, `toScheduledDockEvent` from `convex/functions/events/eventsScheduled/types.ts` | App DTO converter/type | Must implement | None | `src/types/index.ts` re-exports both | App type tests compile through this surface | Present on current reference, absent from old reference | Required by current app imports unless app imports are refactored outside this stage. |
| `listScheduledDockEventsForVesselSailingDay` | Public query | Must implement | Convex generated API path `api.functions.events.eventsScheduled.queries.listScheduledDockEventsForVesselSailingDay` | `src/data/contexts/convex/ConvexVesselTimelineEventsContext.tsx` subscription | Current reference list query test; current timeline context/render tests depend on row shape | Current reference validates `{ vesselAbbrev, sailingDay }`, returns `v.array(eventsScheduledSchema)`, strips Convex metadata, sorts via scheduled event ordering | Use `by_vessel_and_sailing_day`. Preserve stable timeline ordering, including arrival before departure at equal times. |
| `readScheduledDockEventsForVesselSailingDay` | Internal reader helper | Must implement | `convex/functions/vesselOrchestrator/queries/vesselTripScheduleQueries.ts` imports it for schedule-key lookup and rollover pools | None | Current reference list query test imports the reader | Current reference returns `Promise<ConvexScheduledDockEvent[]>` for `{ vesselAbbrev, sailingDay }` and shares public-query ordering | This is required by a current production caller. It can live in `queries.ts`; no separate query action is needed. |
| `upsertScheduledRowsForSailingDay` | Internal mutation helper | Must implement | Current reference sync replacement calls it; expected reload surface requires it | None | Current reference `planScheduledRowsForSailingDay.test.ts` covers delete/insert/replace/skip behavior | Current and old references both load by `by_sailing_day` and reconcile the complete day slice | Keep the behavior, not the planner file. Direct table-local logic is acceptable. |
| `inferScheduledSegmentFromDepartureEvent`, `findNextDepartureEvent`, `ConvexInferredScheduledSegment` scheduled-domain surface | Domain helper/type | Must implement | `vesselTripScheduleQueries.ts`; `updateVesselTrip/schedule/resolveScheduleFromScheduledTripsDb.ts`; vessel-trip domain types | None | Current vessel-trip tests import `ConvexInferredScheduledSegment`; current reference resolver tests cover next-departure behavior | Current reference lives in nested `domain/events/scheduled/scheduledSegmentResolvers.ts`; old reference has a flatter `domain/events/scheduled.ts` baseline | This is one of the current callers not covered by the expected minimum function list. The helper/type behavior is required, but the nested path is not. Later implementation should prefer a flat `domain/events/scheduled.ts` shape and migrate imports if allowed by the stage scope, or flag the mismatch for owner approval. |
| `eventsActualSchema`, `ConvexActualDockEvent` from `convex/functions/events/eventsActual/schemas.ts` | Schema/type | Must implement | `convex/schema.ts`; `orchestratorPersistMutations.ts`; event projection wire types | Timeline context and render-pipeline type imports | Current branch orchestrator, timeline, and update-events tests import it | Current reference schema fields: `EventKey`, `TripKey`, `EventType`, `VesselAbbrev`, `SailingDay`, `UpdatedAt`, `ScheduledDeparture`, `TerminalAbbrev`, optional `EventOccurred`, optional `EventActualTime` | Required for table definition, validator args, and app typing. |
| `ActualDockEvent`, `toActualDockEvent` from `convex/functions/events/eventsActual/types.ts` | App DTO converter/type | Must implement | None | `src/types/index.ts` re-exports both | App type tests compile through this surface | Present on current reference, absent from old reference | Required by current app imports unless app imports are refactored outside this stage. |
| `listActualDockEventsForVesselSailingDay` | Public query | Must implement | Convex generated API path `api.functions.events.eventsActual.queries.listActualDockEventsForVesselSailingDay` | `ConvexVesselTimelineEventsContext.tsx` subscription | Current reference list query test; current timeline tests depend on row shape | Current reference validates `{ vesselAbbrev, sailingDay }`, returns `v.array(eventsActualSchema)`, strips metadata, sorts by `ScheduledDeparture` then `EventKey` | Use `by_vessel_and_sailing_day`. |
| `readActualDockEventsForVesselSailingDay` | Internal reader helper | Reference only | No current production caller found | None | Current reference list query test imports it | Current reference shares list-query behavior | Tests do not force an exported helper. Implement only if it reduces query duplication or a later caller appears. |
| `upsertActualDockRows` | Internal mutation helper | Must implement | `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`; current reference reload mutation | None | Current `persistVesselUpdates.test.ts`; current reference actual mutation/planner tests | Current and old references dedupe by `EventKey`, insert missing, replace changed, skip unchanged | Do not preserve old `projectActualDockWrites` internal mutation unless a current caller reappears. |
| `ConvexActualDockWritePersistable`, `buildActualDockEventFromWrite` actual-domain surface | Domain helper/type | Must implement | `convex/domain/vesselOrchestration/updateEvents/actualDockWritesFromTrip.ts`; `eventWriteAssembler.ts` | None | Current `actualDockWritesFromTrip.test.ts`; current reference event-row builder tests | Current reference derives `EventKey`, `SailingDay`, and `ScheduledDeparture` when sparse writes omit them | Required by current orchestrator-domain callers and not covered by the expected minimum function list. Keep only the sparse-write normalization needed by callers, preferably in flat `domain/events/actual.ts` if import migration is in scope. |
| Actual reload domain helpers, including `hydrateActualTransitionsFromReloadInputs` and `buildActualDockRowsForSailingDayReload` | Domain/reload behavior | Reference only | Current reference sync replacement imports them; current broken branch has no live caller because sync was deleted | None | Current reference actual hydrate/reload/reconcile tests | Current reference has deep nested actual reload/reconcile modules; old reference keeps actual logic flatter | Preserve tested reload behavior, especially physical-only reconstruction, but do not preserve nested module architecture by default. |
| `eventsPredictedSchema`, `ConvexPredictedDockEvent`, `ConvexPredictedDockWriteRow`, `ConvexPredictedDockWriteBatch`, `predictedDockWriteBatchSchema`, `ConvexPredictionSource` | Schema/type | Must implement | `convex/schema.ts`; `orchestratorPersistMutations.ts`; event projection wire types; vessel-trip prediction join types | Timeline context and render-pipeline type imports | Current branch orchestrator, vessel-trip, and timeline tests import these shapes | Current reference schema stores one row per boundary key, prediction type, and source, with optional `Actual` and `DeltaTotal` | Required for table definition, validator args, app typing, and prediction joins. |
| `PredictedDockEvent`, `toPredictedDockEvent` from `convex/functions/events/eventsPredicted/types.ts` | App DTO converter/type | Must implement | None | `src/types/index.ts` re-exports both | App type tests compile through this surface | Present on current reference, absent from old reference | Required by current app imports unless app imports are refactored outside this stage. |
| `listPredictedDockEventsForVesselSailingDay` | Public query | Must implement | Convex generated API path `api.functions.events.eventsPredicted.queries.listPredictedDockEventsForVesselSailingDay` | `ConvexVesselTimelineEventsContext.tsx` subscription | Current reference list query test; current timeline tests depend on row shape | Current reference validates `{ vesselAbbrev, sailingDay }`, returns `v.array(eventsPredictedSchema)`, strips metadata, sorts by `ScheduledDeparture` then `Key` | Use `by_vessel_and_sailing_day`. |
| `readPredictedDockEventsForVesselSailingDay` | Internal reader helper | Reference only | No current production caller found outside the reference helper stack | None | Current reference list query test imports it | Current reference shares list-query behavior and feeds grouped trip loader | Tests do not force an exported helper. Implement if useful for `loadPredictedRowsGroupedForTrips`. |
| `loadPredictedRowsGroupedForTrips` | Internal query helper | Must implement | `convex/functions/vesselTrips/queries.ts` imports it for active/completed trip API enrichment | None | Current `mergeTripsWithPredictions.test.ts`; current reference predicted query tests | Current and old references build unique vessel/sailing-day scopes, load rows once per scope, and key rows by `predictedDockCompositeKey` | Required by current production caller. Return `Map<string, Map<string, ConvexPredictedDockEvent>>`. |
| `upsertPredictedDockBatches` | Internal mutation helper | Must implement | `orchestratorPersistMutations.ts` imports it | None | Current `persistVesselUpdates.test.ts`; current reference predicted mutation tests | Current reference merges batches by vessel/sailing-day, reconciles only `TargetKeys`, deletes stale targeted composites, inserts/replaces changed rows, skips unchanged rows | Preserve tested depart-next behavior during target-key clearing. |
| `patchDepartNextMlRowsForDepBoundary` | Internal mutation helper | Must implement | `orchestratorPersistMutations.ts` imports it for `updateLeaveDockEventPatch` | None | Current `persistVesselUpdates.test.ts`; current reference patch tests | Current and old references query `by_key_type_and_source` for `AtDockDepartNext` and `AtSeaDepartNext` ML rows, skip already actualized rows, patch `Actual` and rounded-minute `DeltaTotal` | Return `Promise<boolean>`. |
| `predictedDockCompositeKey` predicted-domain surface | Domain identity helper | Must implement | `convex/functions/vesselTrips/read/mergeTripsWithPredictions.ts`; current reference predicted query/mutation helpers | None | Current `mergeTripsWithPredictions.test.ts`; current reference predicted tests | Current reference key is `${Key}|${PredictionType}|${PredictionSource}`; old reference had similar identity helper under the table folder | Required by current caller and not covered by the expected minimum function list. The path is not required; prefer flat `domain/events/predicted.ts` or a table-local helper unless caller migration is disallowed. |
| `buildPredictedDockWriteBatch`, `buildPredictedDockClearBatch` predicted-domain surface | Domain projection helper | Must implement | `convex/domain/vesselOrchestration/updateEvents/eventWriteAssembler.ts` | None | Current reference predicted projection tests | Current reference maps trip ML/ETA fields to sparse batch rows and clear scopes | Required by current orchestrator-domain caller. Keep helper surface small; avoid bringing the reconciliation planner across, and avoid recreating nested `domain/events/predicted/*` structure without owner approval. |
| `reloadDockEventsForCurrentSailingDay` | Public action | Must implement | Expected operator/manual API; current reference action helper | None found | Current reference action/sync tests | Derives `getSailingDay(new Date())`, delegates to single-day reload | Keep public action path under `functions/events/sync/actions.ts` and re-export through `sync/index.ts`. |
| `reloadDockEventsForSailingDay` | Public action | Must implement | Expected operator/manual API; current reference action helper | None found | Current reference action/sync tests | Args `{ targetDate: string }`; delegates to single-day reload | No current app caller found, but PRD marks this required. |
| `reloadDockEventsWindow` | Internal action | Must implement | Current reference internal API and expected recovery workflow | None | Current reference window tests | Args `{ daysToSync?: number }`; default was two days; reloads consecutive sailing days from today and aggregates counts | Keep the behavior, not necessarily the separate helper export. |
| `reloadDockEventsAtSailingDayBoundary` | Internal action | Must implement | `convex/crons.ts` uses `internal.functions.events.sync.index.reloadDockEventsAtSailingDayBoundary` twice for DST/standard cron candidates | None | Current reference boundary test and generated internal reference test | Skips outside Pacific 3 AM with `{ skipped: true, reason: "outside_pacific_3am_window", ... }`; otherwise runs window reload | This is the only sync action with a live current-branch caller. Preserve the `sync.index` re-export. |
| `replaceDockEventsForSailingDay` | Internal mutation | Must implement | Current reference legacy combined mutation; expected compatibility surface | None | Current reference replace sync tests and generated internal reference test | Args `{ ReloadDockData }`; returns `{ ScheduledCount, ActualCount }`; current reference composes split scheduled and actual helpers | Keep as compatibility/internal surface even if actions prefer split mutations. |
| `replaceScheduledDockEventsForSailingDay` | Internal mutation | Must implement | Current reference single-day reload action calls it | None | Current reference single-day reload and generated internal reference tests | Args `{ ReloadDockScheduleData }`; returns `{ ScheduledCount }` | Static reload can refresh scheduled rows independently. |
| `reloadActualDockEventsForSailingDay` | Internal mutation | Must implement | Current reference single-day reload action calls it | None | Current reference single-day reload and generated internal reference tests | Args `{ ReloadDockData }`; returns `{ ActualCount }` | Static reload should not rebuild `eventsPredicted`; actual refresh upserts physical observations. |
| `convex/functions/events/index.ts`, table `index.ts` files, and `convex/functions/events/sync/index.ts` | Barrel/generated API path | Must implement | `convex/functions/index.ts`; `convex/crons.ts` depends on `sync.index`; generated API path evidence | App Convex `api.functions.events.*` paths rely on directory layout | Current reference generated internal-reference test covers several paths | Current reference uses grouped barrels; old reference had fewer generated modules | Keep enough barrels for current imports and generated API paths. Do not recreate compatibility barrels for deleted planner/domain internals. |

Current branch callers not resolved by the expected minimum function list:

- Table schema/type imports from `convex/schema.ts`, app timeline code,
  `src/types/index.ts`, `VesselOrchestrator`, and `vesselTrips` require
  `schemas.ts` and `types.ts` surfaces for all three tables.
- `convex/domain/vesselOrchestration/updateEvents` requires actual and
  predicted event projection helpers. Current imports point at nested
  `domain/events` paths, but the PRD target shape prefers flat
  `domain/events/actual.ts` and `domain/events/predicted.ts`.
- `convex/domain/vesselOrchestration/updateVesselTrip` and
  `convex/functions/vesselOrchestrator/queries/vesselTripScheduleQueries.ts`
  require scheduled-domain segment resolver helpers and the
  `ConvexInferredScheduledSegment` type. Current imports point at nested
  `domain/events` paths, which should be migrated or explicitly approved before
  implementation recreates that structure.
- `convex/functions/vesselTrips/read/mergeTripsWithPredictions.ts` requires
  `predictedDockCompositeKey`; the helper behavior is required, but its current
  nested path is not.
- `convex/functions/index.ts` and `convex/crons.ts` require enough event and sync
  barrel exports for generated API path stability.

Ambiguous or owner-review behaviors:

- The generated API file on the current branch still references the deleted
  current-reference module tree, including planner/helper modules. Treat
  generated references as path evidence only when backed by a live caller or
  required behavior.
- Static actual reload behavior around physical-only reconstruction is backed by
  current-reference tests, but the exact module ownership is not prescribed.
  Preserve the behavior while choosing the smallest table-local or neutral
  domain shape.
- `readActualDockEventsForVesselSailingDay` and
  `readPredictedDockEventsForVesselSailingDay` are reference helpers, not live
  current-branch production imports. Export them only if the implementation or
  rewritten tests need the shared reader API.
- Old-reference internal mutations `projectActualDockWrites`,
  `projectPredictedDockWriteBatches`, and old scheduled query names are not
  current API requirements unless an owner asks for legacy compatibility.
- Several current branch domain imports point at nested `domain/events` paths.
  This is a structural mismatch with the PRD target. Later stages should either
  migrate those imports to flat domain files within an explicitly bounded scope
  or request owner approval before recreating nested folders.

## Test Classification For Rebuild

Behavioral tests to preserve or rewrite:

- Current branch caller tests outside deleted event folders:
  `convex/functions/vesselOrchestrator/tests/persistVesselUpdates.test.ts`,
  `convex/functions/vesselTrips/tests/read/mergeTripsWithPredictions.test.ts`,
  `convex/domain/vesselOrchestration/updateEvents/tests/actualDockWritesFromTrip.test.ts`,
  `convex/domain/vesselOrchestration/updateVesselTrip/tests/*`, and the
  timeline context/render-pipeline tests under `src/`. These validate current
  caller contracts and type shapes.
- Current-reference query behavior:
  `listScheduledDockEventsForVesselSailingDay.test.ts`,
  `listActualDockEventsForVesselSailingDay.test.ts`, and
  `listPredictedDockEventsForVesselSailingDay.test.ts`. Preserve index-scoped
  reads, metadata stripping, and deterministic ordering.
- Current-reference mutation behavior:
  scheduled full-day reconciliation, actual sparse `EventKey` upsert, predicted
  targeted reconciliation, depart-next ML actualization, and skip-unchanged
  semantics. Rewriting these as mutation-level tests is preferred over
  preserving planner-helper tests verbatim.
- Current-reference sync behavior:
  single-day reload delegates to split scheduled/actual mutations, window reload
  aggregates consecutive sailing days, boundary reload skips outside Pacific
  3 AM, and static reload does not rebuild `eventsPredicted`.
- Current-reference domain behavior with product meaning:
  scheduled segment inference and next-departure lookup, scheduled row
  construction including final-arrival marking and seam normalization,
  predicted batch construction from trip ML/ETA fields, actual sparse row
  normalization, actual hydration from history, and physical-only actual
  reconstruction during reload.

Structural tests to avoid preserving unless still needed:

- Tests whose main assertion is a helper module boundary, including
  `planActualRows.test.ts`, `planScheduledRowsForSailingDay.test.ts`, and
  tests that require nested actual reconciliation file paths. Preserve their
  behavioral assertions in table-level tests if the helper files disappear.
- Generated API wiring tests such as
  `eventsSyncInternalReferences.test.ts` are useful smoke tests only for live
  public/internal references. Do not expand them to protect deleted planner,
  reload-helper, or domain-module paths.
- Tests that import Convex action `_handler` fields are acceptable for behavior
  during rebuild, but should not force an otherwise unnecessary helper export.

Obsolete tests or references to ignore during rebuild:

- `events-old-reference` has no event-table test files to port. Use it for
  simpler implementation shape, not as a test source.
- Old-reference-only surfaces such as `projectActualDockWrites`,
  `projectPredictedDockWriteBatches`, `projectPredictedDockWriteBatchesInDb`,
  `actualizeDepartNextMlPredictions`, `loadScheduledDockEventsForVesselSailingDay`,
  and `getScheduledDepartureEventBySegmentKey` are obsolete unless a current
  caller or owner decision reintroduces them.
- Stale generated API references to deleted current-reference planner files,
  nested domain helpers, and reload helper files should not create placeholder
  implementation files.

## Implementation Guidance For Agents

Before implementing a stage, create a small checklist:

- Required function name.
- Required input and output.
- Existing callers.
- Required database indexes.
- Existing behavior tests to preserve.
- Whether domain code is needed.

Then implement the smallest direct function that satisfies the checklist.

Default placement:

- Queries stay in `functions/events/<table>/queries.ts`.
- Mutations stay in `functions/events/<table>/mutations.ts`.
- Table schemas stay in `functions/events/<table>/schemas.ts`.
- Sync actions and reload mutations stay in `functions/events/sync`.
- Domain code is optional and must be justified.

## Suggested Task Decomposition

1. Inventory required callers and generated API references.
2. Rebuild all three query modules.
3. Rebuild `eventsScheduled` mutations.
4. Rebuild `eventsPredicted` mutations.
5. Rebuild `eventsActual` mutations.
6. Rebuild `sync` actions and internal mutations.
7. Decide whether any `domain/events/{actual,predicted,scheduled}.ts` files are truly needed.
8. Port or rewrite behavior tests.
9. Delete obsolete files.
10. Run final audit.

## Final Audit Checklist

- Current LoC and file count.
- Final LoC and file count.
- Remaining `domain/events` files and justification.
- Remaining cross-table shared code and justification.
- Query tests passing.
- Mutation tests passing.
- Sync/reload tests passing.
- Typecheck passing.
- VesselOrchestrator callers compile without internal refactor.
