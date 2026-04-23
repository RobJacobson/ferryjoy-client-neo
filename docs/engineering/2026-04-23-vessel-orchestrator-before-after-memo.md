# Vessel Orchestrator Before/After Engineering Memo

**Date:** 2026-04-23  
**Audience:** Engineers working in `convex/functions/vesselOrchestrator`, `convex/domain/vesselOrchestration`, `convex/functions/vesselTrips`, `convex/functions/vesselLocationsUpdates`, `convex/functions/events`, and adjacent modules.  
**Baseline compared:**

- **Before:** pre-refactor recovery branch at commit `ead67c9` (`pre-vessel-orchestration-refactor`)
- **After:** current `cleanup-trip-fields` branch at commit `477711d`

## 1. Executive Summary

This refactor improved **architectural separation** more than it improved
**runtime simplicity**.

The new system is better at naming and isolating concerns:

- `updateVesselLocations` is now a real concern instead of an incidental side
  branch.
- `updateVesselTrips` now has a genuinely pure compute surface.
- `updateVesselPredictions` is no longer hidden inside trip construction.
- `updateVesselTimeline` now projects from persisted trip facts plus ML
  handoffs instead of being implicitly coupled to the trip write path.

However, those architectural wins came with real costs:

- the top-level orchestrator is materially more complex than before
- there are more handoff DTOs, more glue modules, and more stage transitions
- the hot path now performs more unconditional database reads per tick
- the current schedule snapshot strategy is too coarse for a 5-second cadence
  cost model

My overall assessment is:

- **Correctness and boundary clarity:** improved
- **Per-concern readability inside the domain:** mixed, but generally improved
- **Whole-system comprehensibility:** worse
- **Hot-path read/write efficiency:** likely worse in production, especially at
  5-second cadence

The strongest positive change is the separation of predictions and timeline
projection from trip construction.

The strongest negative change is the introduction of **always-on, coarse-grained
hot-path reads**:

- full `vesselLocationsUpdates` table read each tick
- full daily `vesselOrchestratorScheduleSnapshots` row read each tick
- a second `vesselLocationsUpdates` table read inside persistence

In other words, the new system trades away some of the earlier system’s
cheap-and-targeted reads for a more regular but more expensive baseline cost.

That trade is unfavorable for your actual workload:

- orchestrator cadence is 5 seconds in the intended steady state
- most vessel locations change often, but most **trip state** does not
- predictions and timeline updates should only matter for a small subset of
  pings
- schedule continuity questions arise only for a minority of vessel updates

The most important design conclusion is:

> The best next step is probably not a full rollback. The better path is a
> hybrid: keep the cleaner domain separation, but shrink the hot-path reads and
> move back toward narrower, more conditional schedule and dedupe data access.

## 2. Comparison At A Glance

| Concern | Before | After | My assessment |
| --- | --- | --- | --- |
| Top-level orchestration | One fetch, one preloaded read model, parallel location/trip branches, trip path still owned most side effects | Explicit staged pipeline plus one persistence mutation | Better boundaries, more glue, more hot-path ceremony |
| `updateVesselLocations` | Write all converted locations every tick | Normalize first, dedupe against `vesselLocationsUpdates`, write only changed rows | Better write efficiency, but more reads and more complexity |
| `updateVesselTrips` | Lifecycle, schedule enrichment, ML attachment, persistence, and timeline intents closely intertwined | Pure trip compute first, persistence moved to a separate functions-layer step | Best domain cleanup, but total end-to-end path is more complex |
| `updateVesselPredictions` | Mostly embedded inside `buildTrip` | Clean separate stage after trip computation | Biggest architectural improvement |
| `updateVesselTimeline` | Built directly from lifecycle branch messages and applied immediately after trip writes | Built from persisted trip facts plus prediction handoffs | Probably more correct, but also much heavier |
| Hot-path schedule reads | Narrow, targeted, conditional lookups from `eventsScheduled` | One full same-day snapshot read every tick | New approach is worse for your current cost model |
| Summary tables | None | `vesselLocationsUpdates`, `vesselOrchestratorScheduleSnapshots` | Mixed value; both need reconsideration |

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

- location rows always write, even if they are unchanged
- trip processing only receives passenger-terminal-eligible rows
- trip path branches into:
  - completed-trip transitions
  - current-trip updates

### 3.2 Happy Path Control Flow: After

Primary entrypoint:

- `convex/functions/vesselOrchestrator/actions.ts`
  - `updateVesselOrchestrator`
    - `runOrchestratorPing`
      - `loadOrchestratorSnapshot`
        - reads `vesselsIdentity`
        - reads `terminalsIdentity`
        - reads `activeVesselTrips`
      - `loadVesselLocationUpdates`
        - `fetchRawWsfVesselLocations`
        - `computeVesselLocationRows`
        - `getAllVesselUpdateTimeStampsInternal`
        - annotate each row with `locationChanged`
      - `runTripStage`
        - `getScheduleSnapshotForPing`
        - `computeTripBatchForPing`
          - `computeVesselTripsBatch`
            - `computeVesselTripUpdate` per vessel
              - `detectTripEvents`
              - `buildTripRowsForPing`
                - `resolveTripFieldsForTripRow`
                  - WSF fields path
                  - existing next-scheduled-trip path
                  - schedule rollover path
                  - fallback path
        - `buildVesselTripPersistencePlan`
      - `runPredictionStage`
        - `buildPredictionStageInputs`
        - `loadPredictionContext`
        - `runVesselPredictionPing`
      - `buildOrchestratorPersistenceBundle`
      - `persistOrchestratorPing`
        - `bulkUpsertLocationsAndUpdatesInDb`
        - `persistVesselTripWriteSet`
        - `batchUpsertProposalsInDb`
        - `runUpdateVesselTimelineFromAssembly`
        - `upsertActualDockRows`
        - `projectPredictedDockWriteBatchesInDb`

Normal expected branches:

- unchanged locations are still normalized, but only changed ones persist
- unchanged vessels can skip most trip compute via `shouldProcessLocation`
- prediction stage continues only for vessels whose trip row changed or rolled
  over
- timeline projection merges:
  - completed-boundary facts
  - current-branch messages
  - ML handoffs from prediction stage

### 3.3 High-Level Function Comparison

| Before function | Role | After function | Role |
| --- | --- | --- | --- |
| `updateVesselOrchestrator` | Fetch once, fan out branches, coordinate errors | `updateVesselOrchestrator` / `runOrchestratorPing` | Fetch once, run four explicit stages, persist once |
| `loadOrchestratorTickReadModelOrThrow` | Load vessel, terminal, trip snapshot | `loadOrchestratorSnapshot` | Same basic purpose, but with identity tables renamed and narrowed |
| `updateVesselLocations` | Bulk upsert live locations | `loadVesselLocationUpdates` + `persistOrchestratorPing` | Split into compute-then-persist |
| `processVesselTrips` | Trip lifecycle, schedule enrichment, ML, persistence, timeline intents | `runTripStage` | Trip compute only; persistence and timeline now separate |
| `applyTickEventWrites` | Persist timeline overlays | `persistOrchestratorPing` + `runUpdateVesselTimelineFromAssembly` | Projection now runs after trip persistence and ML merge |

### 3.4 Data Flow And Side Effects

| Dimension | Before | After |
| --- | --- | --- |
| External input | WSF vessel locations | WSF vessel locations |
| Baseline DB read per tick | vessels + terminals + active trips | vesselsIdentity + terminalsIdentity + active trips + all `vesselLocationsUpdates` + one daily schedule snapshot |
| Conditional DB reads | targeted schedule queries during trip building | mostly replaced by unconditional daily snapshot read |
| Main side effects | `vesselLocations`, `activeVesselTrips`, `completedVesselTrips`, `eventsActual`, `eventsPredicted` | `vesselLocations`, `vesselLocationsUpdates`, `activeVesselTrips`, `completedVesselTrips`, `vesselTripPredictions`, `eventsActual`, `eventsPredicted` |
| Control shape | parallel branches | sequential stage pipeline plus one persistence mutation |
| Output style | direct side effects plus branch success flags | compute bundle handed into one orchestrator persistence step |

### 3.5 Commentary

The top-level flow is more intentional now, but also much less lightweight.

Before, the orchestrator was easy to describe in one sentence:

> fetch once, store locations, run trips, apply timeline writes.

After, the orchestrator is easier to explain in terms of architecture, but
harder to explain in terms of operational behavior:

> fetch once, normalize locations, annotate change state, compute trip bundle,
> derive persistence plan, preload ML model context, compute prediction rows and
> predicted computations, build persistence DTO, run a persistence mutation that
> also computes timeline projection from persisted trip facts and ML handoffs.

That is a real increase in conceptual overhead.

The good news is that the new flow makes correctness boundaries far more
explicit. The bad news is that the hot-path runtime now pays for this structure
even when most vessels did nothing interesting.

My judgment:

- **architecturally:** better
- **operationally:** heavier
- **debuggability for one stage in isolation:** better
- **debuggability for one full ping end-to-end:** worse

## 4. `updateVesselLocations` Pipeline

### 4.1 Happy Path Control Flow: Before

Primary flow:

- `convex/functions/vesselOrchestrator/actions.ts`
  - raw WSF rows are converted inline using `toConvexVesselLocation`
  - `updateVesselLocations`
    - `api.functions.vesselLocation.mutations.bulkUpsert`
      - replace or insert one current location row per vessel

This path had no real sub-pipeline. It was just:

1. convert raw WSF rows
2. write the whole batch

Expected non-error branches:

- all converted rows are written
- trip-eligibility does not affect location persistence

### 4.2 Happy Path Control Flow: After

Primary flow:

- `convex/functions/vesselOrchestrator/actions.ts`
  - `loadVesselLocationUpdates`
    - `fetchRawWsfVesselLocations`
    - `computeVesselLocationRows`
      - `mapWsfVesselLocations`
      - `assertUsableVesselLocationBatch`
    - `getAllVesselUpdateTimeStampsInternal`
      - read all `vesselLocationsUpdates`
    - compare new `TimeStamp` vs prior timestamp per vessel
    - return `VesselLocationUpdates[]`
  - `persistOrchestratorPing`
    - `bulkUpsertLocationsAndUpdatesInDb`
      - re-read all `vesselLocationsUpdates`
      - update or insert `vesselLocations`
      - update or insert `vesselLocationsUpdates`

Expected non-error branches:

- unchanged vessel location rows are normalized but filtered out before
  persistence
- changed rows are persisted to both `vesselLocations` and
  `vesselLocationsUpdates`
- cache-miss behavior exists for missing signature rows

### 4.3 High-Level Function Comparison

| Before function | Role | After function | Role |
| --- | --- | --- | --- |
| `toConvexVesselLocation` | Convert one raw WSF row | `computeVesselLocationRows` | Convert and validate the whole normalized batch |
| `updateVesselLocations` | Write all current locations | `loadVesselLocationUpdates` | Compute normalized rows plus change flags |
| `bulkUpsert` | Replace live location rows | `bulkUpsertLocationsAndUpdatesInDb` | Persist changed rows and maintain the signature table |

### 4.4 Data Flow And Side Effects

| Dimension | Before | After |
| --- | --- | --- |
| Inputs | raw WSF vessel rows, vessel and terminal tables | same, plus prior `vesselLocationsUpdates` signatures |
| DB reads | none specific to location dedupe | read all `vesselLocationsUpdates` in the action, then read them again in the mutation |
| DB writes | write all location rows every tick | write only changed location rows plus signature rows |
| Output from compute stage | converted `ConvexVesselLocation[]` | `VesselLocationUpdates[]` with `locationChanged` metadata |
| Side effects | `vesselLocations` only | `vesselLocations` and `vesselLocationsUpdates` |

### 4.5 Commentary

This is one of the few places where the new system clearly improved one thing
while clearly making another thing worse.

It improved:

- write volume to `vesselLocations`
- downstream churn caused by unchanged timestamps
- explicitness of the dedupe policy

It worsened:

- baseline read volume
- code path length
- table count and schema count
- mental complexity of a formerly simple responsibility

The main tradeoff is:

> Before, you over-wrote locations every tick. After, you under-write locations
> intelligently, but you pay an extra read model and extra coordination logic to
> do it.

I do think the **idea** behind deduping location writes is good. The problem is
the current implementation is more elaborate than it needs to be.

The most suspicious part is that the code now reads the summary table twice:

- once in the action to decide what changed
- once again in persistence to find and maintain row ids

That means the summary table reduced writes, but did not fully achieve the
“cheap dedupe” goal.

My judgment:

- **behavioral goal:** good
- **implementation:** overbuilt

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
        - `resolveEffectiveLocation`
        - `baseTripFromLocation`
        - `appendFinalSchedule`
        - `appendArriveDockPredictions`
        - `appendLeaveDockPredictions`
        - `actualizePredictionsOnLeaveDock`
      - compare for storage equality
      - compare for overlay equality
      - `upsertVesselTripsBatch`
      - optional leave-dock follow-up
    - `timelineEventAssembler`
      - build `tickEventWrites`

Expected non-error branches:

- completed boundary vs current update
- first-seen vessel vs continuing trip
- schedule-enriched vs schedule-unavailable
- at-dock prediction vs at-sea prediction
- persist + refresh vs refresh-only vs no-op

### 5.2 Happy Path Control Flow: After

Primary entrypoint:

- `convex/domain/vesselOrchestration/updateVesselTrips/computeVesselTripsBatch.ts`
  - `computeVesselTripsBatch`
    - `createScheduledSegmentTablesFromSnapshot`
    - optional `shouldProcessLocation` filtering
    - `computeVesselTripUpdate` per vessel
      - `detectTripEvents`
      - `buildTripRowsForPing`
        - if completed:
          - `tripRowsWhenCompleting`
          - build completed trip
          - build replacement active trip
        - else:
          - `tripRowsWhenContinuing`
      - `resolveTripFieldsForTripRow`
        - branch 1: authoritative WSF trip fields
        - branch 2: `NextScheduleKey` continuity from existing trip
        - branch 3: schedule rollover from prior departure
        - branch 4: fallback reuse
      - `attachNextScheduledTripFields`
      - compute:
        - `tripStorageChanged`
        - `tripLifecycleChanged`
    - merge changed active rows with unchanged carried rows
  - later in functions layer:
    - `buildVesselTripPersistencePlan`
    - `persistVesselTripWriteSet`
      - complete and start replacement rows
      - upsert active rows
      - leave-dock follow-up

Expected non-error branches:

- completed-trip transition vs continuing trip
- WSF-supplied schedule identity vs inferred schedule identity vs fallback
- active-trip replacement vs no replacement
- storage change vs lifecycle change vs no material change

### 5.3 High-Level Function Comparison

| Before function | Role | After function | Role |
| --- | --- | --- | --- |
| `processVesselTripsWithDeps` | End-to-end trip lifecycle orchestration plus persistence and timeline intents | `computeVesselTripsBatch` | Pure batch trip computation only |
| `buildTrip` | Base trip shaping, schedule enrichment, ML attachment, actualization | `computeVesselTripUpdate` + `buildTripRowsForPing` | Lifecycle detection and row shaping, but no ML |
| `processCompletedTrips` | Persist completed boundary and create replacement trip | `persistVesselTripWriteSet` | Functions-layer applier for completed and active rows |
| `processCurrentTrips` | Build current trip, persist, produce timeline messages | `computeVesselTripUpdate` + persistence plan | Compute and persistence now decoupled |
| `appendFinalSchedule` / `resolveEffectiveLocation` | On-demand schedule lookups during trip building | `resolveTripFieldsForTripRow` + snapshot tables | In-memory schedule attachment from preloaded snapshot |

### 5.4 Data Flow And Side Effects

| Dimension | Before | After |
| --- | --- | --- |
| Inputs | `ctx`, locations, tick time, active trips, optional fallback flag | locations, active trips, schedule snapshot, sailing day |
| Schedule source | targeted `eventsScheduled` queries when needed | one in-memory lookup structure created from full daily snapshot |
| ML involvement | embedded in `buildTrip` | removed from trip compute stage |
| Compute output | persisted effects plus timeline write intents | `updates` + storage-shaped `rows` |
| DB writes in trip stage | yes | no |
| DB writes later | not applicable, already done | completed/upsert writes in `persistVesselTripWriteSet` |

### 5.5 Commentary

This is the hardest section to judge, because there are really two different
questions:

1. Is the **trip domain logic** cleaner now?
2. Is the **end-to-end trip pipeline** simpler now?

My answers are:

- **trip domain logic:** mostly yes
- **end-to-end trip pipeline:** no

The new trip compute stage is conceptually better. It has a real contract:

> given location rows, existing active trips, and schedule evidence, return the
> authoritative active and completed trip rows for this ping.

That is a much cleaner boundary than the old one.

The schedule-field resolution order is also more understandable than the older
blend of schedule adapters and trip builder heuristics:

1. trust WSF if present
2. otherwise reuse explicit next-leg continuity
3. otherwise attempt rollover inference
4. otherwise use safe fallback

That is good design.

Where the system got heavier is everything around that boundary:

- new DTOs
- more stage outputs
- persistence plan objects
- trip lifecycle message handoffs
- later ML merge expectations

So the refactor improved the **center** of trip computation and worsened the
**edges** around it.

If I were preserving only one major part of this refactor, it would be the new
trip compute boundary.

## 6. `updateVesselPredictions` Pipeline

### 6.1 Happy Path Control Flow: Before

There was no true standalone prediction pipeline.

Instead, prediction behavior was mostly embedded into trip construction:

- `buildTrip`
  - if at dock and prediction prerequisites are satisfied:
    - `appendArriveDockPredictions`
  - if at sea and prediction prerequisites are satisfied:
    - `appendLeaveDockPredictions`
  - if the vessel just left dock:
    - `actualizePredictionsOnLeaveDock`

Normal expected branches:

- at-dock trip
- at-sea trip
- leave-dock actualization tick
- fallback-window retry tick

### 6.2 Happy Path Control Flow: After

Primary flow:

- `convex/functions/vesselOrchestrator/actions.ts`
  - `runPredictionStage`
    - `buildPredictionStageInputs`
      - keep only vessels with actual trip updates
    - `loadPredictionContext`
      - group requested model types by terminal pair
      - load production model parameters once per pair
    - `runVesselPredictionPing`
      - for completed handoffs:
        - `buildPredictedCompletedHandoff`
        - `applyVesselPredictions`
      - for current active trips:
        - `buildPredictedCurrentTrip`
        - `applyVesselPredictions`
      - `vesselTripPredictionProposalsFromMlTrip`
    - `buildPredictionUpdatesByVessel`
  - later in persistence:
    - `batchUpsertProposalsInDb`

Normal expected branches:

- completed-handoff replacement trip vs current trip
- at-dock phase vs at-sea phase
- no-applicable-model phase
- unchanged prediction proposal vs changed prediction proposal

### 6.3 High-Level Function Comparison

| Before function | Role | After function | Role |
| --- | --- | --- | --- |
| `buildTrip` | Implicitly owned prediction routing | `runPredictionStage` | Orchestrator-owned prediction stage |
| `appendArriveDockPredictions` / `appendLeaveDockPredictions` | Phase-specific ML enrichment | `applyVesselPredictions` | Same ML routing, but now on a clean pre-ML trip input |
| in-memory trip proposal | Trip and ML result were the same object | `runVesselPredictionPing` | Produces prediction rows plus timeline ML handoffs |

### 6.4 Data Flow And Side Effects

| Dimension | Before | After |
| --- | --- | --- |
| Input | current trip being built, `ctx`, fallback flag | active trips, completed handoffs, preloaded model context |
| DB reads | model loads during trip building | one preloading query for required model pairs |
| DB writes | indirect through trip/timeline pipeline | direct write of `vesselTripPredictions` proposals in persistence mutation |
| Output | ML-enriched trip row used immediately by trip and timeline logic | prediction rows plus `PredictedTripComputation[]` for timeline merge |
| Trigger | any trip build that hit ML conditions | only changed trips and completed handoffs continue into the stage |

### 6.5 Commentary

This is the cleanest win in the whole refactor.

The old design made prediction feel like “something the trip builder happens to
do while it is already busy doing ten other things.” The new design makes
prediction an actual pipeline stage with its own inputs and outputs.

That has several advantages:

- trip computation can stay storage-shaped
- ML logic is easier to test in isolation
- model preloading can be shared across the changed subset
- timeline projection can consume explicit ML handoff objects instead of
  relying on implicit trip-builder behavior

The cost is mostly in glue types and orchestration code, not in domain
confusion.

So on this concern, I think the new design is plainly better.

If you simplify the overall system later, I would not re-embed predictions into
trip construction. I would keep the separation and simplify around it.

## 7. `updateVesselTimeline` Pipeline

### 7.1 Happy Path Control Flow: Before

Primary flow:

- completed-trip path returns boundary facts
- current-trip path returns actual-message and predicted-message DTOs
- `domain/vesselTrips/projection/timelineEventAssembler.ts`
  - `buildTickEventWritesFromCompletedFacts`
  - `buildTickEventWritesFromCurrentMessages`
  - clear old predicted overlays when schedule identity changed
  - project new predicted overlays from final proposed trip
- `convex/functions/vesselOrchestrator/applyTickEventWrites.ts`
  - `projectActualBoundaryPatches`
  - `projectPredictedBoundaryEffects`

Expected non-error branches:

- completed boundary vs current branch
- actual patches vs predicted effects
- projection-only refresh vs lifecycle persistence refresh
- clear-existing-predictions vs keep-existing-predictions

### 7.2 Happy Path Control Flow: After

Primary flow:

- `persistVesselTripWriteSet`
  - returns successful completed facts and current-branch messages
- `runPredictionStage`
  - returns `PredictedTripComputation[]`
- `updateTimeline/orchestratorTimelineProjection.ts`
  - `mergePredictedComputationsIntoTimelineProjectionAssembly`
    - merge ML-enriched replacement rows onto completed facts
    - merge ML-enriched current rows onto current messages
  - `buildTimelinePingProjectionInput`
    - `buildPingEventWritesFromCompletedFacts`
    - `buildPingEventWritesFromCurrentMessages`
  - `runUpdateVesselTimelineFromAssembly`
    - return `actualEvents`
    - return `predictedEvents`
- `persistOrchestratorPing`
  - `upsertActualDockRows`
  - `projectPredictedDockWriteBatchesInDb`

Expected non-error branches:

- completed boundary vs current branch
- current message with ML vs current message without ML
- prediction clear batch vs prediction write batch
- successful-upsert-gated messages vs skipped messages

### 7.3 High-Level Function Comparison

| Before function | Role | After function | Role |
| --- | --- | --- | --- |
| `timelineEventAssembler` | Assemble timeline effects directly from trip lifecycle outputs | `runUpdateVesselTimelineFromAssembly` | Assemble from persisted trip facts plus prediction handoffs |
| `applyTickEventWrites` | Persist actual/predicted timeline writes | `persistOrchestratorPing` | Persistence owns timeline writes together with other hot-path writes |
| current/final proposed trip | Implicitly carried both lifecycle and ML state | projection assembly + `PredictedTripComputation` | Explicit lifecycle and ML merge boundary |

### 7.4 Data Flow And Side Effects

| Dimension | Before | After |
| --- | --- | --- |
| Input | lifecycle facts/messages from trip pipeline | persisted trip facts/messages plus prediction handoffs |
| DB reads | none specific at projection time | none specific at projection time |
| DB writes | `eventsActual`, `eventsPredicted` | same |
| Output from compute step | `TickEventWrites` | `actualEvents` and `predictedEvents` |
| Gating | based on successful trip upserts | same, but now also depends on ML merge completeness |

### 7.5 Commentary

This is the other major conceptual improvement, but it is also the other major
source of extra machinery.

The new timeline path is better because it enforces a stronger rule:

> timeline projection should reflect persisted trip facts and same-ping ML
> overlay, not an implicit halfway state from the trip builder.

That is a solid design principle.

The cost is that timeline now depends on:

- trip persistence outputs
- prediction-stage outputs
- explicit merge logic
- more handshake DTOs

So the new path is better if your main goal is correctness and consistency
between trip storage and timeline overlays.

It is worse if your main goal is keeping the orchestration path small and easy
to follow.

My judgment:

- **correctness model:** better
- **operational complexity:** significantly worse

## 8. Complexity Assessment

### 8.1 High-Level Assessment

I agree with the intuition that the new system has become more complex. The
important question is whether that complexity is productive or wasteful.

My answer is:

- some of it is productive
- too much of it is in glue and coordination instead of core business logic

### 8.2 Where Complexity Increased

The largest increases are in:

1. **top-level orchestration**
2. **handoff DTO count**
3. **persistence coordination**
4. **timeline assembly**

The new flow introduces many more named things:

- `VesselLocationUpdates`
- `VesselTripUpdate`
- `CompletedTripBoundaryFact`
- `PredictedTripComputation`
- `CurrentTripActualEventMessage`
- `CurrentTripPredictedEventMessage`
- `VesselTripPersistencePlan`
- `OrchestratorPingPersistence`
- projection assembly types

Those names are individually reasonable. The problem is the system now needs
many of them to describe what used to be one tighter trip-processing loop.

### 8.3 Where Complexity Decreased

Complexity decreased in a few meaningful places:

- `updateVesselPredictions` is cleaner than before
- the pure `updateVesselTrips` contract is cleaner than before
- schedule field precedence is more explicit than before
- timeline projection has a more disciplined correctness boundary

### 8.4 Rough Code-Size Comparison

These numbers are not the whole story, but they match the qualitative picture.

Approximate relevant LOC totals inspected during this review:

| Surface | Before | After |
| --- | --- | --- |
| Top-level orchestrator surface | `actions.ts` + `applyTickEventWrites.ts` ≈ 334 LOC | `actions.ts` + `mutations.ts` + `persistVesselTripWriteSet.ts` ≈ 1,023 LOC |
| Old trip core cluster inspected | `processVesselTrips`, `processCurrentTrips`, `processCompletedTrips`, `buildTrip` ≈ 923 LOC | `computeVesselTripsBatch`, `computeVesselTripUpdate`, `tripBuilders`, `lifecycle`, `persistVesselTripWriteSet` ≈ 1,196 LOC |
| Prediction/timeline cluster inspected | `appendPredictions`, `tickPredictionPolicy`, old `timelineEventAssembler`, `applyTickEventWrites` ≈ 424 LOC | current prediction/timeline cluster inspected ≈ 1,127 LOC |

The best way to summarize this is:

> The system did not merely redistribute code. It accumulated more runtime
> orchestration structure.

### 8.5 Final Complexity Judgment

I would not call the new design simply “wrong.” But I would call it
**over-architected for the hot-path cost model you actually have**.

The refactor solved some real design problems, but it introduced a level of
abstraction and read-model machinery that does not match the operational reality
that only a small subset of vessels materially change trip state on each tick.

## 9. Data Usage, Read/Write Frequency, And Cost Implications

## 9.1 Why Cadence Matters

At a 5-second cadence:

- 12 ticks per minute
- 720 ticks per hour
- 17,280 ticks per day

At that frequency, even one unnecessary medium-sized read becomes expensive.

The main architectural mistake in the current code is not that it reads “too
many tables.” It is that it performs **large unconditional reads every tick**
for data that only matters on a minority of ticks.

## 9.2 Per-Tick Database Access: Before vs After

| Path | Before | After |
| --- | --- | --- |
| baseline identity/trip snapshot | one combined query reading 3 tables | one combined query reading 3 tables |
| location dedupe reads | none | read all `vesselLocationsUpdates` every tick |
| schedule reads | targeted `eventsScheduled` lookups only when needed by docked/schedule transitions | one full same-day `vesselOrchestratorScheduleSnapshots` row every tick |
| location persistence reads | not needed for unconditional bulk upsert | re-read all `vesselLocationsUpdates` in persistence |
| trip writes | conditional writes per lifecycle outcome | still conditional, but via persistence plan |
| prediction writes | implicit through trip/timeline path | explicit `vesselTripPredictions` upserts |
| timeline writes | conditional on trip pipeline output | conditional on persisted trip facts and prediction handoffs |

## 9.3 What The Old System Paid For

The old system paid for:

- writing the current vessel locations every tick
- conditional targeted schedule queries for the subset of vessels that actually
  needed schedule help

That meant:

- higher location write volume
- lower unconditional read volume
- schedule cost scaled more with interesting trip activity than with tick count

For your workload, that scaling characteristic is actually good.

## 9.4 What The New System Pays For

The new system now pays a baseline cost on almost every tick:

1. read all vessel/terminal/trip identity data
2. read all vessel-location update signatures
3. read the full current-day orchestrator schedule snapshot
4. re-read all vessel-location update signatures when persisting changed rows

Only after that does it reach the more selective stages.

That means the new code improved **downstream work selection**, but worsened the
**baseline tax**.

## 9.5 Schedule Snapshot Cost

This is the biggest issue.

The current schedule snapshot row is compact compared with raw
`eventsScheduled`, but it is still shaped like:

- all direct segment lookups by `ScheduleKey`
- all ordered same-day departures by vessel

That means every tick loads a row containing the full day’s useful schedule
continuity context, even when:

- only a few vessels are active in a schedule-sensitive state
- most vessels are merely reporting routine location updates
- the trip pipeline is only going to process a small changed subset

This is the wrong granularity for a 5-second hot path.

It may still be cheaper than the prior “read grouped raw `eventsScheduled` rows
every tick” implementation, but it is not cheap enough to justify reading it
unconditionally.

## 9.6 Old Atomic/Targeted Reads vs New Snapshot Read

The old schedule path used targeted queries such as:

- `getScheduledDepartureSegmentBySegmentKey`
- `getNextDepartureSegmentAfterDeparture`

These were worse in the theoretical worst case, because many vessels could
trigger many small queries.

But your actual workload is not the theoretical worst case.

Your actual workload is:

- many pings
- few material trip changes
- fewer still that need schedule continuity help

Under that workload, the old targeted model is probably **cheaper on average**
than loading the whole same-day schedule snapshot every tick.

That does not mean the old trip architecture should return. It means the old
**data-access granularity** was closer to the truth of the workload.

## 9.7 `vesselLocationsUpdates`: Necessary Or Helpful?

Short answer:

- **helpful idea**
- **questionable implementation**

What it does well:

- avoids overwriting `vesselLocations` for unchanged timestamps
- gives the orchestrator a cheap logical dedupe key per vessel
- helps stop downstream work for unchanged locations

What is problematic:

- it is read in full every tick
- it is read again in full inside persistence
- it stores both timestamp and `VesselLocationId`, which mixes dedupe metadata
  with storage wiring
- it adds another table, schema, tests, and mutation complexity to a hot path

My view is that the table is **not obviously unnecessary**, but its current form
is more complex than necessary.

A simpler alternative would likely be better:

- either store the last timestamp directly on the canonical vessel-location row
- or keep a very small key/value-style dedupe table with only
  `VesselAbbrev -> TimeStamp`
- or preload the existing location ids together with the main snapshot so you do
  not read the signature table twice

So I would not defend the current table design as-is.

## 9.8 `orchestratorScheduleSnapshot`: Necessary Or Helpful?

Short answer:

- **the concept is reasonable**
- **the current row granularity is not**

What it does well:

- removes ad hoc schedule query logic from the trip compute loop
- makes trip-field inference deterministic and testable
- centralizes schedule continuity data into one in-memory structure

What is problematic:

- the whole daily snapshot is loaded every tick
- the size of that payload scales with the day’s full schedule, not with the
  number of schedule-sensitive vessel updates on that tick
- it optimizes code shape more than runtime cost

So I think this table is only partially successful.

The best version of this idea would not be “one full day row per ping.” It
would be something like:

- per-vessel same-day schedule slices
- per-segment direct lookup rows
- per-terminal/per-vessel continuity rows
- or lazy targeted snapshot loading only for changed vessels that need it

In other words, the summary table concept is okay, but the current snapshot is
still too broad.

## 10. Recommendations: A Best-Of-Both-Worlds Middle Path

## 10.1 Keep The Good Parts

I would keep these parts of the current design:

1. the explicit `updateVesselTrips` compute boundary
2. the separate `updateVesselPredictions` stage
3. timeline projection from persisted trip facts plus ML handoffs
4. the single orchestrator-owned persistence mutation

Those are the strongest architectural improvements.

## 10.2 Simplify The Hot Path

I would change these parts:

1. **stop reading the full daily schedule snapshot every tick**
   - replace it with narrower targeted reads or smaller keyed slices
2. **stop reading `vesselLocationsUpdates` twice**
   - either preload enough state once or simplify the table
3. **treat updateVesselLocations and updateVesselTrips as the only true hot path**
   - everything else should be contingent on actual trip changes
4. **bundle more baseline state in one read model**
   - if you keep dedupe metadata, include it in the main orchestrator snapshot

## 10.3 Suggested Shape

The most promising middle-ground design looks like this:

1. one orchestrator snapshot query
   - vesselsIdentity
   - terminalsIdentity
   - activeTrips
   - minimal location timestamps or location ids
2. one WSF fetch
3. one location normalization pass
4. one trip compute pass for changed vessels only
5. lazy schedule reads only for vessels whose trip field resolution actually
   needs schedule help
6. prediction stage only for changed/rolled-over trips
7. timeline stage only for trips that persisted or need overlay refresh
8. one persistence mutation

That preserves most of the clean architecture while moving back toward a leaner
read/write model.

## 10.4 Concrete Changes I Would Prioritize

### Priority 1: Replace full daily schedule snapshot reads

Best candidate options:

- resurrect targeted schedule queries but only behind the new trip-field
  resolver
- split the schedule snapshot into smaller keyed tables
- load per-vessel continuity slices only for vessels entering the trip stage

This is the highest-value change.

### Priority 2: Simplify location dedupe

Possible options:

- collapse `vesselLocationsUpdates` into a minimal timestamp table
- preload location ids in `getOrchestratorModelData`
- stop storing `VesselLocationId` if it is only there to make the second read
  possible

### Priority 3: Tighten Stage 2 gating even more

The current code already moves in this direction, but the design principle
should become stricter:

> predictions and timeline should run only when trip rows materially changed or
> a completed/replacement handoff occurred

That is the right operational model for the system.

### Priority 4: Reduce handoff surface area

The current DTO count is too high. I would look for opportunities to collapse:

- trip persistence plan
- current-branch messages
- predicted trip computations
- projection assembly

into fewer, more durable shapes.

## 11. Final Conclusion

The refactor was not a mistake, but it overshot.

It solved real design problems:

- overly implicit prediction logic
- tightly coupled trip and timeline behavior
- blurry domain boundaries

But it also created a system whose runtime shape no longer matches the real
economics of the hot path.

The key insight is:

> your expensive path is not “all orchestrator logic equally.” The real hot path
> is location ingest and trip compute. Prediction and timeline are secondary and
> should remain downstream of actual trip change.

That means the right target is not the current “always preload broad context”
approach. It is:

- lean baseline reads
- selective schedule access
- selective downstream stages
- one persistence boundary

So my recommendation is a **hybrid rollback**:

- keep the improved separation of concerns
- roll back the broad hot-path read model decisions
- simplify or redesign the summary tables
- make schedule access narrow again

That should give you the best of both worlds:

- most of the new code’s clarity
- much closer to the old code’s atomic and cost-efficient runtime behavior
