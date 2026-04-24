# Vessel Orchestrator Latest Before/After Engineering Memo

**Date:** 2026-04-24  
**Audience:** Engineers working in `convex/functions/vesselOrchestrator`, `convex/domain/vesselOrchestration`, `convex/functions/vesselTrips`, `convex/functions/vesselLocation`, `convex/functions/events`, and adjacent modules.  
**Baseline compared:**

- **Before:** pre-refactor recovery branch at commit `ead67c9d` (`pre-vessel-orchestration-refactor`)
- **After:** latest `main` branch at commit `da278340`
- **Context:** this memo updates the 2026-04-23 before/after memo after the follow-up refactor that removed several hot-path regressions from the first refactored version.

## 1. Executive Summary

The latest refactor is materially better than the intermediate refactor reviewed
on 2026-04-23.

The earlier memo's two biggest operational objections have been addressed:

- the orchestrator no longer maintains or rereads a separate
  `vesselLocationsUpdates` table
- the production hot path no longer loads a full same-day
  `vesselOrchestratorScheduleSnapshots` row every tick

The current design keeps the best architectural changes from the refactor:

- trip computation is still a pure domain concern
- prediction remains a standalone stage
- timeline projection still runs from persisted trip facts plus same-ping ML
  handoffs
- schedule-field resolution remains explicit and testable

But it now does so with a much healthier hot-path shape:

- one baseline read-model query
- one WSF fetch
- location dedupe against already-loaded `vesselLocations`
- early return when no locations changed
- targeted, memoized schedule reads only when trip-field inference needs them
- one final persistence mutation only when there are changed locations

My overall assessment is:

- **Correctness and boundary clarity:** still improved
- **Code flow:** improved from the intermediate refactor; still heavier than the
  pre-refactor system
- **Read/write efficiency:** substantially improved from the intermediate
  refactor and probably better balanced than the original
- **Simplicity:** improved in the action and data-access strategy, but still
  burdened by too many handoff DTOs and some stale snapshot-era compatibility
  names

The strongest positive change is that the refactor now preserves the clean
domain boundaries without imposing large unconditional reads every 5 seconds.

The strongest remaining concern is that timeline/prediction handoff machinery is
still broad. The code has fewer expensive runtime branches than before, but it
still has many conceptual branches for engineers to keep in their heads.

The most important design conclusion is:

> The latest branch is no longer obviously over-architected for the hot path.
> The next improvements should be incremental: simplify handoff types, remove
> snapshot-era compatibility surfaces, and keep schedule access targeted and
> lazy.

## 2. Comparison At A Glance

| Concern | Before | Latest | My assessment |
| --- | --- | --- | --- |
| Top-level orchestration | Fetch, convert, fan out location/trip branches, apply timeline writes | Load one snapshot, fetch/normalize/dedupe locations, early-return on no changes, compute trip/prediction stages, persist once | Latest is more sequential but much easier to reason about than the intermediate staged version |
| `updateVesselLocations` | Upsert all converted locations every tick | Compare against loaded `vesselLocations`; write only changed rows by id | Better write efficiency without the old duplicate summary-table read |
| `updateVesselTrips` | Lifecycle, schedule enrichment, ML, persistence, and timeline intents intertwined | Per-vessel pure compute with targeted schedule access; persistence separated | Stronger domain boundary, still more files/types than before |
| `updateVesselPredictions` | Embedded inside trip building | Separate stage gated by changed trip facts | Clear win; keep this separation |
| `updateVesselTimeline` | Built from trip lifecycle messages and applied after trip writes | Built after trip persistence from persisted facts plus ML computations | More correct, still the densest handoff area |
| Hot-path schedule reads | Targeted schedule queries when needed | Targeted, memoized `eventsScheduled` queries when needed | Recovers the old workload-friendly granularity while preserving cleaner trip logic |
| Summary tables | None | No location-update summary table; no production schedule snapshot table | Latest removed the two most questionable summary tables |

## 3. Top-Level `VesselOrchestrator` Pipeline

### 3.1 Happy Path Control Flow: Before

Primary entrypoint:

- `convex/functions/vesselOrchestrator/actions.ts`
  - `updateVesselOrchestrator`
    - `loadOrchestratorTickReadModelOrThrow`
      - reads `vessels`
      - reads `terminals`
      - reads `activeVesselTrips`
      - bootstraps identity tables if empty
    - `fetchWsfVesselLocations`
    - `toConvexVesselLocation` for each raw WSF row
    - derive `tripEligibleLocations`
      - passenger-terminal rows continue into trip processing
      - non-passenger rows are still stored as locations
    - run two branches in parallel via `Promise.allSettled`
      - branch 1: `updateVesselLocations`
        - bulk upsert current `vesselLocations`
      - branch 2: `processVesselTrips`
        - detect lifecycle transitions
        - build and persist trip updates
        - assemble `tickEventWrites`
        - return to orchestrator
      - then `applyTickEventWrites`
        - write `eventsActual`
        - write `eventsPredicted`

Normal expected branches:

- location rows are offered for write every tick
- trip processing only receives passenger-terminal-eligible rows
- trip path branches into completed-trip transitions and current-trip updates
- branch-level failures are isolated in the action return object

### 3.2 Happy Path Control Flow: Latest

Primary entrypoint:

- `convex/functions/vesselOrchestrator/actions.ts`
  - `updateVesselOrchestrator`
    - `runOrchestratorPing`
      - `loadOrchestratorSnapshot`
        - `getOrchestratorModelData`
        - reads `vesselsIdentity`
        - reads `terminalsIdentity`
        - reads `activeVesselTrips`
        - reads `vesselLocations`
      - `loadVesselLocationUpdates`
        - `fetchRawWsfVesselLocations`
        - `computeVesselLocationRows`
        - compare each row's `TimeStamp` with the loaded stored location
      - if no locations changed:
        - return before trip, prediction, schedule, or persistence work
      - build changed location writes with existing document ids
      - `createScheduleContinuityAccess`
        - memoized targeted schedule readers
      - `computeTripStageForLocations`
        - loop only changed locations
        - `computeVesselTripUpdate`
        - targeted schedule reads only as needed by trip-field inference
        - build prediction-stage inputs from changed durable trip facts
      - `runPredictionStage`
        - preload production models only for requested terminal pairs
        - compute prediction rows and ML timeline handoffs
      - `persistOrchestratorPing`
        - upsert changed locations without rereading the location table
        - persist completed/current trip write set
        - upsert prediction rows when present
        - assemble and write actual/predicted timeline rows when present

Normal expected branches:

- unchanged location batch returns early
- changed locations always persist to `vesselLocations`
- trip compute only runs for changed locations
- schedule reads happen lazily inside trip-field resolution
- prediction stage only runs for changed durable trip facts
- persistence mutation only runs when at least one location changed

### 3.3 High-Level Function Comparison

| Before function | Role | Latest function | Role |
| --- | --- | --- | --- |
| `updateVesselOrchestrator` | Fetch once, fan out branches, coordinate errors | `updateVesselOrchestrator` / `runOrchestratorPing` | Sequential hot path with explicit early return and single persistence mutation |
| `loadOrchestratorTickReadModelOrThrow` | Load vessel, terminal, trip snapshot and bootstrap empty identity tables | `loadOrchestratorSnapshot` | Load identity, active trips, and stored locations in one query; no bootstrap refresh in this path |
| `updateVesselLocations` | Write all current locations through bulk upsert | `loadVesselLocationUpdates` + `bulkUpsertChangedLocationsInDb` | Compute change state in action, write changed rows by known id |
| `processVesselTrips` | Trip lifecycle, schedule enrichment, ML, persistence, timeline intents | `computeTripStageForLocations` + `persistVesselTripWriteSet` | Pure trip compute in action, trip-table writes in persistence mutation |
| `applyTickEventWrites` | Persist actual/predicted timeline writes | `runUpdateVesselTimelineFromAssembly` inside `persistOrchestratorPing` | Timeline projection after trip persistence and ML merge |

### 3.4 Data Flow And Side Effects

| Dimension | Before | Latest |
| --- | --- | --- |
| External input | WSF vessel locations | WSF vessel locations |
| Baseline DB read per tick | vessels + terminals + active trips | vesselsIdentity + terminalsIdentity + active trips + current vesselLocations |
| Location dedupe source | none before calling mutation; mutation rereads `vesselLocations` | loaded `vesselLocations` from baseline snapshot |
| Conditional DB reads | targeted schedule queries during trip building | targeted memoized `eventsScheduled` queries during trip-field inference |
| Main side effects | `vesselLocations`, `activeVesselTrips`, `completedVesselTrips`, `eventsActual`, `eventsPredicted` | same plus `vesselTripPredictions` |
| Control shape | parallel location/trip branches | sequential pipeline with early returns and one final mutation |
| Output style | branch success object | internal action returns `null`; failures throw after logging |

### 3.5 Commentary

This is a much better top-level shape than the intermediate refactor.

The action is now compact enough to read as a real hot-path program:

> load snapshot, fetch locations, dedupe, return if nothing changed, compute
> trips, compute predictions, persist.

That is a meaningful improvement over the previous staged pipeline that loaded
separate location-update and schedule-snapshot read models on every tick.

The main tradeoff versus the original branch is that the latest path gives up
branch-level partial success. In the original, location writes and trip writes
ran in parallel and could fail independently. In the latest code, a failure
throws the full action.

That trade is probably acceptable for an internal orchestrator because the
latest path also avoids inconsistent same-ping outcomes where locations succeed
but trips/timeline fail silently into a partial result object. Still, it is worth
being explicit about the behavior change.

My judgment:

- **architecturally:** better than before and much better than the intermediate
  refactor
- **operationally:** now appropriately lean
- **debuggability for a full ping:** better than the intermediate refactor
- **error isolation:** less forgiving than the original

## 4. `updateVesselLocations` Pipeline

### 4.1 Happy Path Control Flow: Before

Primary flow:

- raw WSF rows are converted inline using `toConvexVesselLocation`
- `updateVesselLocations`
  - `api.functions.vesselLocation.mutations.bulkUpsert`
  - mutation reads all `vesselLocations`
  - mutation replaces/inserts rows whose timestamps differ

Expected non-error branches:

- all converted rows are sent to the mutation
- mutation skips rows whose `TimeStamp` has not changed
- trip eligibility does not affect location persistence

### 4.2 Happy Path Control Flow: Latest

Primary flow:

- `getOrchestratorModelData`
  - reads current `vesselLocations` as part of the baseline snapshot
- `loadVesselLocationUpdates`
  - fetch raw WSF rows
  - normalize through `computeVesselLocationRows`
  - map stored rows by `VesselAbbrev`
  - annotate each row with:
    - `existingLocationId`
    - `locationChanged`
- `runOrchestratorPing`
  - filters to changed rows
  - returns immediately if there are none
- `persistOrchestratorPing`
  - `bulkUpsertChangedLocationsInDb`
  - replaces by known `_id` or inserts new row
  - does not reread `vesselLocations`

Expected non-error branches:

- unchanged rows are normalized but do not write
- changed rows write once
- new vessel rows insert once
- no changed rows skip trip, prediction, and persistence work entirely

### 4.3 High-Level Function Comparison

| Before function | Role | Latest function | Role |
| --- | --- | --- | --- |
| `toConvexVesselLocation` | Convert one raw WSF row | `computeVesselLocationRows` | Convert and validate the whole normalized batch |
| `updateVesselLocations` | Send all locations to a mutation | `loadVesselLocationUpdates` | Compute changed/new state from already-loaded stored rows |
| `bulkUpsert` | Reread table and compare timestamps in mutation | `bulkUpsertChangedLocationsInDb` | Apply precomputed changed rows directly |

### 4.4 Data Flow And Side Effects

| Dimension | Before | Latest |
| --- | --- | --- |
| Inputs | raw WSF vessel rows, vessel and terminal tables | same, plus current `vesselLocations` in baseline snapshot |
| DB reads | mutation reads all `vesselLocations` | action baseline query reads all `vesselLocations` |
| DB writes | changed/new location rows only | changed/new location rows only |
| Output from compute stage | converted `ConvexVesselLocation[]` | `VesselLocationUpdates[]` with change metadata and optional existing id |
| Side effects | `vesselLocations` | `vesselLocations` |

### 4.5 Commentary

This is one of the clearest improvements over both earlier versions.

The original code did eventually skip unchanged location writes, but only after
sending the whole location batch into a mutation that reread the table.

The intermediate refactor tried to fix this by adding a summary table, but that
introduced extra schema, extra row maintenance, and duplicate reads.

The latest code takes the simpler route:

> use the canonical `vesselLocations` table itself as the dedupe read model.

That is the right simplification. It avoids writes without adding a second table
whose only job is to summarize the first table.

Remaining opportunities:

- consider querying `vesselLocations` by known active vessel keys if the table
  grows beyond the current live-fleet size
- keep `bulkUpsert` for public/backward compatibility if needed, but avoid using
  it from the orchestrator hot path
- preserve the no-reread invariant in future changes; this is one of the best
  improvements in the latest branch

## 5. `updateVesselTrips` Pipeline

### 5.1 Happy Path Control Flow: Before

Primary entrypoint:

- `convex/functions/vesselTrips/updates/processTick/processVesselTrips.ts`
  - `processVesselTripsWithDeps`
    - build `TripTransition` per location
      - `detectTripEvents`
    - split into:
      - completed transitions
      - current transitions
    - `processCompletedTrips`
      - `buildCompletedTrip`
      - `buildTrip` for replacement trip
      - `completeAndStartNewTrip`
    - `processCurrentTrips`
      - `buildTrip`
        - resolve schedule fields
        - append predictions
        - actualize predictions
      - compare for storage equality
      - upsert active trips
    - assemble timeline writes

Expected non-error branches:

- completed boundary vs current update
- first-seen vessel vs continuing trip
- schedule-enriched vs schedule-unavailable
- at-dock prediction vs at-sea prediction
- persist + refresh vs refresh-only vs no-op

### 5.2 Happy Path Control Flow: Latest

Primary entrypoint:

- `computeTripStageForLocations`
  - build `activeTripsByVessel`
  - loop only changed location rows
  - `computeVesselTripUpdate`
    - `detectTripEvents`
    - `buildTripRowsForPing`
      - completion path:
        - finalize completed trip
        - seed replacement active trip
      - continuation path:
        - build/continue active trip
      - `resolveTripFieldsForTripRow`
        - WSF authoritative fields
        - existing `NextScheduleKey` continuity
        - rollover from scheduled departures
        - fallback fields
      - attach next scheduled trip fields
    - compute:
      - `tripStorageChanged`
      - `tripLifecycleChanged`
  - build active/completed rows
  - build attempted completed facts for prediction gating
- later in persistence:
  - `persistVesselTripWriteSet`
    - complete/start replacement trips
    - batch upsert changed active trips
    - apply leave-dock follow-up intents
    - return persisted facts/messages for timeline projection

Expected non-error branches:

- completed-trip transition vs continuing trip
- WSF-supplied schedule identity vs inferred schedule identity vs fallback
- active-trip replacement vs no replacement
- storage change vs lifecycle change vs no material change
- schedule reads only when WSF fields are missing or next-leg attachment needs
  schedule evidence

### 5.3 High-Level Function Comparison

| Before function | Role | Latest function | Role |
| --- | --- | --- | --- |
| `processVesselTripsWithDeps` | End-to-end lifecycle orchestration plus persistence and timeline intents | `computeVesselTripUpdate` loop in `actions.ts` | Per-vessel pure computation, orchestrator-visible loop |
| `buildTrip` | Base trip shaping, schedule enrichment, ML attachment, actualization | `buildTripRowsForPing` + `resolveTripFieldsForTripRow` | Lifecycle row shaping and schedule-field inference without ML |
| `processCompletedTrips` | Persist completed boundary and replacement active trip | `persistVesselTripWriteSet` | Functions-layer applier for completed/current rows |
| `processCurrentTrips` | Build current trip, persist, produce timeline messages | `computeVesselTripUpdate` + `buildVesselTripPersistencePlan` | Compute and persistence are separated |
| schedule adapters | Targeted queries mixed into trip builder | `ScheduleContinuityAccess` | Narrow interface with targeted production implementation and in-memory test implementation |

### 5.4 Data Flow And Side Effects

| Dimension | Before | Latest |
| --- | --- | --- |
| Inputs | `ctx`, locations, tick time, active trips, fallback flag | changed locations, active trips, schedule access |
| Schedule source | targeted schedule queries when needed | targeted memoized `eventsScheduled` queries when needed |
| ML involvement | embedded in `buildTrip` | removed from trip compute stage |
| Compute output | side effects plus timeline write intents | per-vessel trip updates and storage-shaped rows |
| DB writes in trip compute | yes | no |
| DB writes later | not applicable | completed/upsert writes in `persistVesselTripWriteSet` |

### 5.5 Commentary

The trip domain remains the core success of the refactor.

The latest branch keeps the useful boundary:

> given one vessel location, an optional active trip, and schedule access, return
> candidate trip rows plus change flags.

That is much easier to test and reason about than the old `processVesselTrips`
cluster.

The most important improvement since the intermediate refactor is the return to
targeted schedule access. `ScheduleContinuityAccess` is a good compromise:

- the domain code does not know whether schedule evidence is coming from Convex
  queries or in-memory tests
- production only asks for the schedule rows that inference actually needs
- repeated asks within one ping are memoized

This preserves code clarity without forcing full-day schedule reads every tick.

Remaining opportunities:

- `computeVesselTripsBatch` and snapshot-backed helpers still exist for tests or
  compatibility; consider retiring them if production no longer uses that shape
- trip-field inference logging is useful, but `resolveTripFieldsForTripRow.ts`
  is doing resolution, diagnostics, message formatting, and next-leg attachment;
  split only if it reduces real reading burden
- keep the orchestrator-visible per-vessel loop; it is simpler than hiding the
  whole ping behind another batch adapter

## 6. `updateVesselPredictions` Pipeline

### 6.1 Happy Path Control Flow: Before

There was no true standalone prediction pipeline.

Instead, prediction behavior was mostly embedded into trip construction:

- `buildTrip`
  - if at dock and prediction prerequisites are satisfied:
    - append arrive-dock predictions
  - if at sea and prediction prerequisites are satisfied:
    - append leave-dock predictions
  - if the vessel just left dock:
    - actualize predictions

Normal expected branches:

- at-dock trip
- at-sea trip
- leave-dock actualization tick
- fallback-window retry tick

### 6.2 Happy Path Control Flow: Latest

Primary flow:

- `buildPredictionStageInputs`
  - keep only trip updates where durable trip facts changed
  - include completed handoffs only for changed vessels
- `runPredictionStage`
  - return immediately if no active trips or completed handoffs need prediction
  - `loadPredictionContext`
    - group requested model types by terminal pair
    - load production model parameters once per pair
  - `runVesselPredictionPing`
    - build prediction rows
    - build `PredictedTripComputation[]` handoffs for timeline projection
- later in persistence:
  - `batchUpsertProposalsInDb` only when prediction rows exist

Normal expected branches:

- completed-handoff replacement trip vs current trip
- at-dock phase vs at-sea phase
- no-applicable-model phase
- unchanged prediction proposal vs changed prediction proposal

### 6.3 High-Level Function Comparison

| Before function | Role | Latest function | Role |
| --- | --- | --- | --- |
| `buildTrip` | Implicitly owned prediction routing | `runPredictionStage` | Orchestrator-owned prediction stage |
| prediction append helpers | Phase-specific ML enrichment inside trip lifecycle | `runVesselPredictionPing` / `applyVesselPredictions` | Same ML routing on clean pre-ML trip inputs |
| in-memory trip proposal | Trip and ML result were the same object | `PredictedTripComputation` | Explicit ML handoff for timeline merge |

### 6.4 Data Flow And Side Effects

| Dimension | Before | Latest |
| --- | --- | --- |
| Input | current trip being built, `ctx`, fallback flag | changed active trips and completed handoffs |
| DB reads | model loads during trip building | one model-parameter query for requested terminal pairs |
| DB writes | indirect through trip/timeline path | direct `vesselTripPredictions` upserts in persistence mutation |
| Output | ML-enriched trip row used immediately by trip and timeline logic | prediction rows plus ML timeline handoffs |
| Trigger | any trip build that hit ML conditions | only durable trip changes and completed handoffs |

### 6.5 Commentary

This remains a clear win.

The latest branch also improved the stage ownership by moving the prediction
gate helpers into `predictionStage.ts` and keeping the action focused on flow.

The main thing to watch is that `PredictedTripComputation` should not grow into
a second trip state object. It is healthy as a narrow timeline/prediction
handoff. If future code starts treating it as another canonical trip shape,
complexity will creep back in.

Recommended direction:

- keep predictions out of trip construction
- keep model loading grouped by terminal pair
- keep prediction writes compare-and-upsert rather than rewriting proposal rows
  blindly

## 7. `updateVesselTimeline` Pipeline

### 7.1 Happy Path Control Flow: Before

Primary flow:

- completed-trip path returns boundary facts
- current-trip path returns actual-message and predicted-message DTOs
- timeline assembler builds `tickEventWrites`
- `applyTickEventWrites`
  - writes actual dock rows
  - writes predicted dock rows

Expected non-error branches:

- completed boundary vs current branch
- actual patches vs predicted effects
- projection-only refresh vs lifecycle persistence refresh
- clear-existing-predictions vs keep-existing-predictions

### 7.2 Happy Path Control Flow: Latest

Primary flow:

- `persistVesselTripWriteSet`
  - returns successful completed facts and current-branch messages
  - gates current messages on successful active-trip upserts
- `runPredictionStage`
  - returns `PredictedTripComputation[]`
- `runUpdateVesselTimelineFromAssembly`
  - merges predicted computations into completed/current projection assembly
  - `buildTimelinePingProjectionInput`
    - `buildPingEventWritesFromCompletedFacts`
    - `buildPingEventWritesFromCurrentMessages`
  - returns:
    - `actualEvents`
    - `predictedEvents`
- `persistOrchestratorPing`
  - `upsertActualDockRows` when actual rows exist
  - `projectPredictedDockWriteBatchesInDb` when predicted batches exist

Expected non-error branches:

- completed boundary vs current branch
- current message with ML vs current message without ML
- prediction clear batch vs prediction write batch
- successful-upsert-gated messages vs skipped messages

### 7.3 High-Level Function Comparison

| Before function | Role | Latest function | Role |
| --- | --- | --- | --- |
| `timelineEventAssembler` | Assemble effects from trip lifecycle outputs | `runUpdateVesselTimelineFromAssembly` | Assemble from persisted facts plus ML handoffs |
| `applyTickEventWrites` | Persist actual/predicted timeline writes | `persistOrchestratorPing` | Persistence owns timeline writes after trip persistence |
| final proposed trip | Implicitly carried lifecycle and ML state | projection assembly + `PredictedTripComputation` | Explicit lifecycle and ML merge boundary |

### 7.4 Data Flow And Side Effects

| Dimension | Before | Latest |
| --- | --- | --- |
| Input | lifecycle facts/messages from trip pipeline | trip persistence facts/messages plus prediction handoffs |
| DB reads | none specific at projection time | none specific at projection time |
| DB writes | `eventsActual`, `eventsPredicted` | same |
| Output from compute step | `TickEventWrites` | `actualEvents` and `predictedEvents` |
| Gating | based on trip pipeline output | based on successful trip persistence plus ML merge |

### 7.5 Commentary

The correctness model is still better than before:

> timeline projection reflects trip facts that actually persisted, plus same-ping
> ML overlay when available.

That is a good rule.

This is also the place where the code still feels the heaviest. The names are
reasonable one by one, but the combined set is large:

- `CompletedTripBoundaryFact`
- `CurrentTripActualEventMessage`
- `CurrentTripPredictedEventMessage`
- `CurrentTripLifecycleBranchResult`
- `PredictedTripComputation`
- `TimelineProjectionAssembly`
- `TimelineTripComputation`

Some of these are compatibility or alternate-entrypoint shapes. That is where I
would look next for simplification.

Recommended direction:

- keep the persisted-facts-before-timeline rule
- collapse compatibility-only projection types when tests no longer need them
- avoid adding another timeline adapter layer; the code already has enough
  translation shapes

## 8. Complexity Assessment

### 8.1 High-Level Assessment

The latest branch is still larger than the pre-refactor codebase, but it is no
longer large in the same problematic way as the intermediate refactor.

The intermediate version added runtime structure that the hot path had to pay
for every tick.

The latest version keeps more of the structure in:

- pure domain code
- tests
- narrow runtime helper modules
- one persistence mutation

That is a better placement of complexity.

### 8.2 Where Complexity Increased

Complexity is still higher than the original in:

1. timeline and prediction handoff types
2. trip persistence planning
3. schedule-field inference diagnostics
4. test/compatibility helpers that still use snapshot-era names
5. the number of files an engineer must traverse for one full ping

The top-level action is no longer the main concern. It is now short enough to
serve as the map.

### 8.3 Where Complexity Decreased

Compared with the intermediate refactor, complexity decreased in important
ways:

- no `vesselLocationsUpdates` table
- no production `vesselOrchestratorScheduleSnapshots` table
- no `materializeScheduleSnapshot.ts`
- no broad `pipelineTypes.ts`
- no second read of location dedupe metadata inside persistence
- no full-day schedule snapshot read per tick
- prediction-stage helper ownership is tighter
- persistence bundle assembly is flatter

Compared with the original branch, complexity decreased in:

- prediction ownership
- trip compute testability
- schedule-field precedence
- timeline consistency after trip persistence

### 8.4 Rough Code-Size Comparison

These numbers are approximate and are only meant to support the qualitative
assessment.

| Surface | Before | Latest |
| --- | --- | --- |
| Top-level orchestrator action | `actions.ts` ≈ 287 LOC plus `applyTickEventWrites.ts` | `actions.ts` ≈ 209 LOC plus helper modules |
| Orchestrator runtime helper cluster | small inline helpers plus `applyTickEventWrites` | `locationUpdates.ts`, `mutations.ts`, `persistVesselTripWriteSet.ts`, `predictionStage.ts`, `scheduleContinuityAccess.ts` ≈ 815 LOC |
| Trip compute cluster | old `processTick` and `tripLifecycle` modules | `computeVesselTripUpdate`, `tripBuilders`, `lifecycle`, `tripFields` ≈ 1,084 LOC |
| Timeline/prediction projection cluster | embedded prediction plus old assembler | standalone prediction and timeline projection modules; clearer but larger |

The code is bigger, but the extra code now buys more real separation than the
intermediate version did.

### 8.5 Final Complexity Judgment

The latest code is not "simple" in absolute terms. Ferry trip lifecycle,
schedule inference, ML overlays, and timeline projection are inherently tangled
business concerns.

But the latest version is much closer to the right kind of complexity:

- domain complexity in domain modules
- DB access complexity in functions modules
- orchestration complexity visible in one action
- hot-path reads kept narrow and conditional

The next simplification work should be subtractive, not architectural:

- delete stale compatibility paths
- merge redundant DTOs
- remove snapshot-era docs/names that no longer describe production
- resist adding adapters around already-narrow interfaces

## 9. Data Usage, Read/Write Frequency, And Cost Implications

### 9.1 Why Cadence Matters

At a 5-second cadence:

- 12 ticks per minute
- 720 ticks per hour
- 17,280 ticks per day

The previous memo argued that large unconditional reads were the wrong tradeoff
for that cadence.

The latest branch mostly accepts that conclusion.

### 9.2 Per-Tick Database Access: Before vs Latest

| Path | Before | Latest |
| --- | --- | --- |
| baseline identity/trip snapshot | one combined query reading 3 tables | one combined query reading 4 tables: identity, terminals, active trips, current locations |
| location dedupe reads | mutation reads all `vesselLocations` | baseline snapshot reads all `vesselLocations`; mutation does not reread |
| schedule reads | targeted `eventsScheduled` lookups only when needed | targeted memoized `eventsScheduled` lookups only when needed |
| location writes | changed/new rows after mutation-side compare | changed/new rows after action-side compare |
| trip writes | conditional writes per lifecycle outcome | conditional writes via persistence plan |
| prediction writes | implicit/embedded | explicit `vesselTripPredictions` upserts when prediction rows exist |
| timeline writes | conditional on trip pipeline output | conditional on persisted trip facts and prediction handoffs |

### 9.3 What The Old System Paid For

The old system paid for:

- sending all converted locations into the location mutation each tick
- rereading locations inside that mutation
- targeted schedule reads when schedule enrichment was needed
- ML work embedded in trip construction

That made the top-level path short, but mixed concerns heavily.

### 9.4 What The Intermediate Refactor Paid For

The intermediate refactor paid for:

- location summary table reads
- location summary table maintenance
- full daily schedule snapshot reads
- more DTO handoffs
- one final persistence mutation

That improved boundaries but imposed too much baseline cost.

### 9.5 What The Latest System Pays For

The latest system pays for:

1. one baseline query that includes current location rows
2. one WSF fetch
3. in-memory location timestamp comparison
4. changed-location trip computation only
5. lazy, memoized schedule queries only when trip-field inference needs them
6. prediction model query only when changed trip facts need prediction
7. one persistence mutation only when changed locations exist

This is a much better shape for the actual workload.

### 9.6 Schedule Reads

The latest schedule access is the most important cost correction.

Production now uses `createScheduleContinuityAccess`, which exposes two narrow
methods:

- `getScheduledSegmentByKey`
- `getScheduledDeparturesForVesselAndSailingDay`

Both are memoized for the ping. The first can load one segment by key, then load
that vessel/day's departures to attach next-leg continuity. The second loads
one vessel/day's scheduled rows for rollover inference.

This is a good compromise:

- trip code stays independent of Convex query details
- schedule cost scales with schedule-sensitive changed vessels
- repeated continuity lookups within one ping are cached

The old full-day snapshot idea should remain out of the production hot path
unless production evidence shows targeted reads are worse.

### 9.7 Location Reads And Writes

The latest location strategy is also improved.

Reading all current `vesselLocations` every tick is acceptable if the table is
bounded to the live fleet. It is far cheaper and simpler than maintaining a
second dedupe table.

The important invariant is:

> the action may read current locations once, but persistence should not reread
> them to discover ids or timestamps.

The current `existingLocationId` handoff preserves that invariant.

If `vesselLocations` ever becomes larger than one current row per live vessel,
then this should be revisited. In that case, the next step should be targeted
reads by active vessel abbrev, not a new summary table.

### 9.8 Prediction And Timeline Writes

Prediction and timeline writes are still appropriately conditional.

The main cost risk is not obvious DB overuse. It is accidental broadening of the
prediction inputs. `buildPredictionStageInputs` is therefore important code:

- it gates on `tripStorageChanged || tripLifecycleChanged`
- it filters completed handoffs to changed vessels
- it avoids model queries when there is nothing to predict

That policy should stay narrow.

## 10. Further Improvement Opportunities

### 10.1 Code Flow

The top-level action is now a useful map. Preserve that.

Recommended improvements:

1. Remove or quarantine snapshot-era production language.
   - `architecture.md`, some READMEs, and test helpers still mention schedule
     snapshots as if they are central.
   - The production path now uses targeted schedule access.
   - Stale docs will mislead future refactors back toward the wrong shape.

2. Retire `computeVesselTripsBatch` if it is now only compatibility/test glue.
   - The orchestrator uses the clearer visible loop over changed locations.
   - Keeping a second batch abstraction invites future divergence.

3. Keep `ScheduleContinuityAccess` as the only schedule abstraction.
   - It is narrow enough.
   - Adding another adapter above it would be ceremony without much payoff.

4. Consolidate timeline handoff vocabulary.
   - The model is sound, but there are too many similarly shaped objects.
   - Prefer one persisted-trip outcome shape and one prediction overlay shape.

### 10.2 Reducing DB Queries And Writes

Recommended improvements:

1. Keep schedule access lazy and memoized.
   - Do not reintroduce full-day schedule snapshots on the ping path without
     production measurements.

2. Preserve the no-reread location persistence path.
   - `bulkUpsertChangedLocationsInDb` should continue to trust the ids from the
     baseline snapshot.

3. Consider targeted location snapshot reads only if needed.
   - Current all-location read is probably fine for a live-fleet-sized table.
   - If it grows, load rows for active WSF vessel abbrevs instead of adding a
     separate summary table.

4. Measure schedule query cardinality per ping.
   - Add lightweight counters around `getScheduledSegmentByKey` and
     `getScheduledDeparturesForVesselAndSailingDay`.
   - This would validate that targeted access behaves as expected at 5-second
     cadence.

5. Avoid unconditional prediction model loading.
   - The current request builder is narrow. Keep it that way.

### 10.3 Keeping The Code Simple

Recommended improvements:

1. Avoid new adapters unless there is a second real implementation.
   - `ScheduleContinuityAccess` already has production and in-memory
     implementations.
   - `persistenceBundle.ts` is acceptable because it centralizes a generated
     mutation payload.
   - Another layer around either would likely be noise.

2. Prefer deleting stale compatibility helpers over wrapping them.
   - Snapshot-backed helpers are useful for tests today, but they should not
     remain indefinitely if they describe a removed production strategy.

3. Keep the orchestrator loop visible.
   - The current action shows changed-location processing clearly.
   - Hiding that loop inside another batch function would make the flow harder
     to audit.

4. Split files only along ownership, not size alone.
   - `resolveTripFieldsForTripRow.ts` is long, but its responsibilities are
     tightly related.
   - If it is split, split diagnostics/log formatting from resolution rather
     than inventing a new resolver hierarchy.

5. Keep "changed durable trip facts" as the prediction/timeline gate.
   - This is the right conceptual hinge for reducing work.

## 11. Final Recommendation

Do not roll back the current design.

The latest branch keeps the real architectural wins from the refactor while
removing the most expensive hot-path regressions from the intermediate version.

The next work should be cleanup, not another large redesign:

- remove snapshot-era production docs and compatibility surfaces
- simplify timeline/prediction handoff types
- keep location dedupe on `vesselLocations`
- keep schedule continuity targeted and lazy
- add measurement around schedule query counts before changing the data-access
  strategy again

In short:

> The latest refactor has moved from "clearer but too expensive" to "clearer and
> plausibly efficient." The remaining opportunity is to make it smaller without
> making it cleverer.
