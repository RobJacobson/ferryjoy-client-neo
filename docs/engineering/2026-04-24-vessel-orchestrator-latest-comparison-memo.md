# Vessel Orchestrator Latest Before/After Engineering Memo

**Current code (authoritative):** The shipped orchestrator entrypoint is [`convex/functions/vesselOrchestrator/action/actions.ts`](../../convex/functions/vesselOrchestrator/action/actions.ts) (`updateVesselOrchestrator`). Per changed vessel it runs domain **`updateVesselTrip`** → **`loadPredictionContext`** ([`action/predictionContextLoader.ts`](../../convex/functions/vesselOrchestrator/action/predictionContextLoader.ts)) → **`updateVesselPredictions`** → **`updateTimeline`**, then persists trip rows, prediction proposals, and timeline dock rows together via **`persistPerVesselOrchestratorWrites`** ([`mutation/mutations.ts`](../../convex/functions/vesselOrchestrator/mutation/mutations.ts)). Timeline input is **`VesselTripUpdate`** (**`timelineHandoffFromTripUpdate`** inside **`updateTimeline`**). Schedule continuity is **`action/pipeline/scheduleContinuity.ts`**. See [`../../convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) and [`../../convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md). The sections below are a **dated** before/after record; filenames and mutation names in the narrative may not match today’s tree.
**Historical note:** treat the section details below as snapshot analysis from the date above, not as a living runtime contract.

**Date:** 2026-04-25 (revised; first published 2026-04-24; updated 2026-04-25 PM)  
**Audience:** Engineers working in `convex/functions/vesselOrchestrator`, `convex/domain/vesselOrchestration`, `convex/functions/vesselTrips`, `convex/functions/vesselLocation`, `convex/functions/events`, and adjacent modules.  
**Baseline compared:**

- **Before:** pre-refactor recovery branch at commit `ead67c9d` (`pre-vessel-orchestration-refactor`)
- **After:** `main` at commit `aa07acc8` (as of this revision)
- **Context:** this memo updates the 2026-04-23 before/after memo after the follow-up refactor that removed several hot-path regressions from the first refactored version.
- **2026-04-25 PM update:** hot-path writes now use a **hybrid split**.
  `getOrchestratorModelData` still loads only `vesselsIdentity`,
  `terminalsIdentity`, and `activeVesselTrips` (not `vesselLocations`). The
  action normalizes the full WSF batch, calls internal mutation
  **`bulkUpsertVesselLocations`** with locations-only payload, and the mutation
  returns only changed rows after timestamp dedupe; trip compute and prediction
  stage then run from that changed subset. Persistence is now split into
  **`persistTripAndPredictionWrites`** (trip + prediction apply) and
  **`persistTimelineEventWrites`** (timeline row apply after action-side
  timeline assembly). `performBulkUpsertVesselLocations` remains the dedupe
  helper used by `bulkUpsertVesselLocations` and now isolates per-vessel
  failures via try/catch logging.

## 1. Executive Summary

The latest refactor is materially better than the intermediate refactor reviewed on 2026-04-23.

The earlier memo's two biggest operational objections have been addressed:

- the orchestrator no longer maintains or rereads a separate `vesselLocationsUpdates` table
- the production hot path no longer loads a full same-day `vesselOrchestratorScheduleSnapshots` row every tick

The current design keeps the best architectural changes from the refactor:

- trip computation is still a pure domain concern
- prediction remains a standalone stage
- timeline projection still runs from persisted trip facts plus same-ping ML handoffs
- schedule-field resolution remains explicit and testable

But it now does so with a much healthier hot-path shape:

- one baseline read-model query (identities + active trips only; no `vesselLocations` in that query)
- one WSF fetch
- normalization of the feed using identity tables (`updateVesselLocations` / `mapWsfVesselLocations`)
- trip compute over mutation-returned **changed** location rows each ping
- targeted, memoized schedule reads only when trip-field inference needs them
- three mutations per ping: one locations-only `bulkUpsertVesselLocations`, one `persistTripAndPredictionWrites`, then one `persistTimelineEventWrites`

My overall assessment is:

- **Correctness and boundary clarity:** still improved
- **Code flow:** improved from the intermediate refactor; still heavier than the pre-refactor system
- **Read/write efficiency:** substantially improved from the intermediate refactor; location **document** reads for `vesselLocations` are concentrated in the dedicated location mutation (same class as pre-refactor `bulkUpsert`), while the baseline query no longer pulls the full location table
- **Simplicity:** improved in the action and data-access strategy, but still burdened by too many handoff DTOs and some stale snapshot-era compatibility names

The strongest positive change is that the refactor now preserves the clean domain boundaries without imposing large unconditional reads every 5 seconds.

The strongest remaining concern is that timeline/prediction handoff machinery is still broad. The code has fewer expensive runtime branches than before, but it still has many conceptual branches for engineers to keep in their heads.

The most important design conclusion is:

> The latest branch is no longer obviously over-architected for the hot path. The next improvements should be incremental: simplify handoff types, remove snapshot-era compatibility surfaces, and keep schedule access targeted and lazy.

## 2. Comparison At A Glance


| Concern                   | Before                                                                            | Latest                                                                                                                        | My assessment                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Top-level orchestration   | Fetch, convert, fan out location/trip branches, apply timeline writes             | Load identities + trips, fetch/normalize feed, locations-only mutation, then compute trip/prediction and persist timeline bundle | Latest is sequential, with improved payload isolation and clear stage ownership |
| `updateVesselLocations`   | Upsert all converted locations every tick                                         | Full feed sent to internal `bulkUpsertVesselLocations`; **`performBulkUpsertVesselLocations`** (`collect()` + compare by `VesselAbbrev` / `TimeStamp`) inside location mutation | Aligns with classic mutation-side dedupe while avoiding bundled cross-stage payloads   |
| `updateVesselTrip`       | Lifecycle, schedule enrichment, ML, persistence, and timeline intents intertwined | Per-vessel pure compute with targeted schedule access; persistence separated                                                  | Stronger domain boundary, still more files/types than before                                   |
| `updateVesselPredictions` | Embedded inside trip building                                                     | Separate stage gated by changed trip facts                                                                                    | Clear win; keep this separation                                                                |
| `updateVesselTimeline`    | Built from trip lifecycle messages and applied after trip writes                  | Built after trip persistence from persisted facts plus ML computations                                                        | More correct, still the densest handoff area                                                   |
| Hot-path schedule reads   | Targeted schedule queries when needed                                             | Targeted, memoized `eventsScheduled` queries when needed                                                                      | Recovers the old workload-friendly granularity while preserving cleaner trip logic             |
| Summary tables            | None                                                                              | No location-update summary table; no production schedule snapshot table                                                       | Latest removed the two most questionable summary tables                                        |


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
      - `updateVesselLocations` stage
        - `fetchRawWsfVesselLocations`
        - `updateVesselLocations` (uses identity tables for WSF → `ConvexVesselLocation`)
      - `createScheduleContinuityAccess`
        - memoized targeted schedule readers
      - `computeTripStageForLocations`
        - loop **all** normalized locations this tick
        - `updateVesselTrip`
        - targeted schedule reads only as needed by trip-field inference
        - build prediction-stage inputs from durable trip fact changes (gated downstream)
      - `runPredictionStage`
        - preload production models only for requested terminal pairs
        - compute prediction rows and ML timeline handoffs
      - `bulkUpsertVesselLocations`
        - calls **`performBulkUpsertVesselLocations`**: `collect()` `vesselLocations`, match by **`VesselAbbrev`**, skip unchanged `TimeStamp`, replace/insert
        - returns only inserted/replaced location rows to the action
      - `persistTripAndPredictionWrites`
        - persist completed/current trip write set
        - upsert prediction rows when present
      - `updateTimeline` (in action memory)
        - build actual/predicted timeline rows from persisted handoff + ML overlays
      - `persistTimelineEventWrites`
        - apply final actual/predicted timeline rows when present

Normal expected branches:

- every ping runs locations upsert first, then trip + prediction orchestration in the action from changed location rows, then action-side timeline assembly and dedicated timeline-row persistence
- location **writes** in `bulkUpsertVesselLocations` still skip rows whose `TimeStamp` did not change
- schedule reads happen lazily inside trip-field resolution
- prediction stage only materializes rows when gated inputs warrant it

### 3.3 High-Level Function Comparison


| Before function                        | Role                                                                     | Latest function                                                        | Role                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `updateVesselOrchestrator`             | Fetch once, fan out branches, coordinate errors                          | `updateVesselOrchestrator` / `runOrchestratorPing`                     | Sequential hot path; one locations-only mutation, one trip/prediction mutation, and one timeline-row mutation per ping |
| `loadOrchestratorTickReadModelOrThrow` | Load vessel, terminal, trip snapshot and bootstrap empty identity tables | `loadOrchestratorSnapshot`                                             | Load identities + active trips in one query (**no** `vesselLocations`); no bootstrap refresh in this path |
| `updateVesselLocations`                | Write all current locations through bulk upsert                          | `updateVesselLocations` stage + internal **`bulkUpsertVesselLocations`** (uses **`performBulkUpsertVesselLocations`**) | Fetch + normalize + augment in action stage; dedupe + write in dedicated location mutation (`collect()` by `VesselAbbrev`)  |
| `processVesselTrips`                   | Trip lifecycle, schedule enrichment, ML, persistence, timeline intents   | `computeTripStageForLocations` + `persistVesselTripWriteSet`           | Pure trip compute in action, trip-table writes in persistence mutation                            |
| `applyTickEventWrites`                 | Persist actual/predicted timeline writes                                 | `updateTimeline` + `persistTimelineEventWrites`   | Action assembles timeline rows after trip persistence and ML merge; mutation applies final rows    |


### 3.4 Data Flow And Side Effects


| Dimension                 | Before                                                                                            | Latest                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| External input            | WSF vessel locations                                                                              | WSF vessel locations                                                         |
| Baseline DB read per tick | vessels + terminals + active trips                                                                | vesselsIdentity + terminalsIdentity + active trips (**no** `vesselLocations` in baseline query) |
| Location dedupe source    | none before calling mutation; mutation rereads `vesselLocations`                                  | location mutation **`collect()`** on `vesselLocations` inside **`performBulkUpsertVesselLocations`** |
| Conditional DB reads      | targeted schedule queries during trip building                                                    | targeted memoized `eventsScheduled` queries during trip-field inference      |
| Main side effects         | `vesselLocations`, `activeVesselTrips`, `completedVesselTrips`, `eventsActual`, `eventsPredicted` | same plus `vesselTripPredictions`                                            |
| Control shape             | parallel location/trip branches                                                                   | sequential pipeline; `bulkUpsertVesselLocations`, `persistTripAndPredictionWrites`, then `persistTimelineEventWrites` |
| Output style              | branch success object                                                                             | internal action returns `null`; failures throw after logging                 |


### 3.5 Commentary

This is a much better top-level shape than the intermediate refactor.

The action is now compact enough to read as a real hot-path program:

> load identities + trips, fetch WSF, normalize, persist locations in a dedicated mutation, compute trips for the full batch, compute predictions, persist trips/timeline.

That is a meaningful improvement over the previous staged pipeline that loaded separate location-update and schedule-snapshot read models on every tick.

Failure behavior is more nuanced than the first draft of this memo implied. The latest path still throws for fatal ping-level failures, but it now preserves partial progress in two important ways:

- per-vessel trip compute failures are isolated and logged, and the ping continues for other vessels
- completed-trip writes and leave-dock follow-up intents are applied with `Promise.allSettled`, so one vessel write failure does not abort the entire write set

My judgment:

- **architecturally:** better than before and much better than the intermediate refactor
- **operationally:** now appropriately lean
- **debuggability for a full ping:** better than the intermediate refactor
- **error isolation:** mixed but practical (fatal ping failures still fail fast, per-vessel failures are isolated)

## 4. `updateVesselLocations` Pipeline

### 4.1 Happy Path Control Flow: Before

Primary flow:

- raw WSF rows are converted inline using `toConvexVesselLocation`
- `updateVesselLocations`
  - `internal.functions.vesselLocation.mutations.bulkUpsertVesselLocations`
  - mutation reads all `vesselLocations`
  - mutation replaces/inserts rows whose timestamps differ

Expected non-error branches:

- all converted rows are sent to the mutation
- mutation skips rows whose `TimeStamp` has not changed
- trip eligibility does not affect location persistence

### 4.2 Happy Path Control Flow: Latest

Primary flow:

- `getOrchestratorModelData`
  - reads `vesselsIdentity`, `terminalsIdentity`, `activeVesselTrips` only
- `updateVesselLocations` stage
  - fetch raw WSF rows
  - normalize through `updateVesselLocations` (identity tables for resolution)
  - yields `ConvexVesselLocation[]` for the full normalized batch
- `runOrchestratorPing`
  - `bulkUpsertVesselLocations` with full normalized locations batch
  - `computeTripStageForLocations` over mutation-returned **changed** rows
  - `runPredictionStage`
  - `persistTripAndPredictionWrites` for trip + prediction persistence
  - action-side `updateTimeline`
  - `persistTimelineEventWrites` for final timeline row persistence
- `bulkUpsertVesselLocations`
  - **`performBulkUpsertVesselLocations`**: `collect()` `vesselLocations`, index by **`VesselAbbrev`**, skip same `TimeStamp`, `replace` / `insert`
  - returns changed rows (`inserted` + `replaced`) to the action
  - per-vessel upsert failures are logged and do not abort remaining vessel writes

Expected non-error branches:

- mutation skips DB writes for vessels whose feed `TimeStamp` matches stored row
- new vessel abbrev inserts a new row
- trip compute runs only for mutation-returned changed vessels each ping

### 4.3 High-Level Function Comparison


| Before function          | Role                                            | Latest function                  | Role                                                      |
| ------------------------ | ----------------------------------------------- | -------------------------------- | --------------------------------------------------------- |
| `toConvexVesselLocation` | Convert one raw WSF row                         | `updateVesselLocations`      | Convert and validate the whole normalized batch           |
| `updateVesselLocations`  | Send all locations to a mutation                | `updateVesselLocations` stage + `bulkUpsertVesselLocations` | Fetch + normalize + augment in action stage; location mutation owns DB read/compare |
| `bulkUpsert`             | Reread table and compare timestamps in mutation | **`performBulkUpsertVesselLocations`** (internal **`bulkUpsertVesselLocations`** mutation) | Same semantics: **`VesselAbbrev`** key + `TimeStamp` skip inside shared helper |


### 4.4 Data Flow And Side Effects


| Dimension                 | Before                                          | Latest                                                                  |
| ------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| Inputs                    | raw WSF vessel rows, vessel and terminal tables | raw WSF + identity tables from baseline query (no stored location preload) |
| DB reads                  | mutation reads all `vesselLocations`            | dedicated location mutation reads all `vesselLocations`                     |
| DB writes                 | changed/new location rows only                  | changed/new location rows only                                          |
| Output from compute stage | converted `ConvexVesselLocation[]`              | `ConvexVesselLocation[]` normalized rows                                 |
| Side effects              | `vesselLocations`                               | `vesselLocations`                                                       |


### 4.5 Commentary

The **2026-04-25 PM** update keeps live-location dedupe in mutation code while splitting payload ownership: the action calls `bulkUpsertVesselLocations` separately before trip/prediction/timeline persistence.

Tradeoffs versus the intermediate “snapshot dedupe in the action” approach:

- **Gain:** baseline query no longer pulls the entire `vesselLocations` table; location read/write policy is localized to **`performBulkUpsertVesselLocations`** in the dedicated `bulkUpsertVesselLocations` mutation (**`VesselAbbrev`** indexing).
- **Gain:** trip stage now consumes only mutation-returned changed rows, so unchanged vessels avoid downstream trip/prediction/timeline compute for that ping.

Remaining opportunities:

- optional narrow index table later if `vesselLocations` **read** volume becomes costly (see discussion elsewhere); not required for correctness today
- keep **`performBulkUpsertVesselLocations`** as the dedupe helper behind internal **`bulkUpsertVesselLocations`**

## 5. `updateVesselTrip` Pipeline

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
  - loop all normalized location rows for this ping
  - `updateVesselTrip`
    - `detectTripEvents`
    - `buildUpdatedVesselRows`
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
- schedule reads only when WSF fields are missing or next-leg attachment needs schedule evidence

### 5.3 High-Level Function Comparison


| Before function              | Role                                                                     | Latest function                                              | Role                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `processVesselTripsWithDeps` | End-to-end lifecycle orchestration plus persistence and timeline intents | `updateVesselTrip` loop in `actions.ts`               | Per-vessel pure computation, orchestrator-visible loop                                     |
| `buildTrip`                  | Base trip shaping, schedule enrichment, ML attachment, actualization     | `buildUpdatedVesselRows` + `resolveTripFieldsForTripRow`       | Lifecycle row shaping and schedule-field inference without ML                              |
| `processCompletedTrips`      | Persist completed boundary and replacement active trip                   | `persistVesselTripWriteSet`                                  | Functions-layer applier for completed/current rows                                         |
| `processCurrentTrips`        | Build current trip, persist, produce timeline messages                   | `updateVesselTrip` + `buildVesselTripPersistencePlan` | Compute and persistence are separated                                                      |
| schedule adapters            | Targeted queries mixed into trip builder                                 | `ScheduleContinuityAccess`                                   | Narrow interface with targeted production implementation and in-memory test implementation |


### 5.4 Data Flow And Side Effects


| Dimension                 | Before                                                   | Latest                                                  |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Inputs                    | `ctx`, locations, tick time, active trips, fallback flag | normalized locations (full batch), active trips, schedule access |
| Schedule source           | targeted schedule queries when needed                    | targeted memoized `eventsScheduled` queries when needed |
| ML involvement            | embedded in `buildTrip`                                  | removed from trip compute stage                         |
| Compute output            | side effects plus timeline write intents                 | per-vessel trip updates and storage-shaped rows         |
| DB writes in trip compute | yes                                                      | no                                                      |
| DB writes later           | not applicable                                           | completed/upsert writes in `persistVesselTripWriteSet`  |


### 5.5 Commentary

The trip domain remains the core success of the refactor.

The latest branch keeps the useful boundary:

> given one vessel location, an optional active trip, and schedule access, return candidate trip rows plus change flags.

That is much easier to test and reason about than the old `processVesselTrips` cluster.

The most important improvement since the intermediate refactor is the return to targeted schedule access. `ScheduleContinuityAccess` is a good compromise:

- the domain code does not know whether schedule evidence is coming from Convex queries or in-memory tests
- production only asks for the schedule rows that inference actually needs
- repeated asks within one ping are memoized

This preserves code clarity without forcing full-day schedule reads every tick.

Remaining opportunities:

- production uses `updateVesselTrip` in a per-vessel loop over mutation-returned changed locations; in-memory schedule fixtures under `shared/scheduleSnapshot/` are for tests only (not a production DB snapshot table)
- trip-field inference logging is useful, but `resolveTripFieldsForTripRow.ts` is doing resolution, diagnostics, message formatting, and next-leg attachment; split only if it reduces real reading burden
- keep the orchestrator-visible per-vessel loop; it is simpler than hiding the whole ping behind another batch adapter

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
  - `updateVesselPredictions`
    - build prediction rows
    - build `MlTimelineOverlay[]` handoffs for timeline projection
- later in persistence:
  - `batchUpsertProposalsInDb` only when prediction rows exist

Normal expected branches:

- completed-handoff replacement trip vs current trip
- at-dock phase vs at-sea phase
- no-applicable-model phase
- unchanged prediction proposal vs changed prediction proposal

### 6.3 High-Level Function Comparison


| Before function           | Role                                               | Latest function                                      | Role                                        |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| `buildTrip`               | Implicitly owned prediction routing                | `runPredictionStage`                                 | Orchestrator-owned prediction stage         |
| prediction append helpers | Phase-specific ML enrichment inside trip lifecycle | `updateVesselPredictions` / `applyVesselPredictions` | Same ML routing on clean pre-ML trip inputs |
| in-memory trip proposal   | Trip and ML result were the same object            | `MlTimelineOverlay`                                  | Explicit ML handoff for timeline merge      |


### 6.4 Data Flow And Side Effects


| Dimension | Before                                                           | Latest                                                         |
| --------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| Input     | current trip being built, `ctx`, fallback flag                   | changed active trips and completed handoffs                    |
| DB reads  | model loads during trip building                                 | one model-parameter query for requested terminal pairs         |
| DB writes | indirect through trip/timeline path                              | direct `vesselTripPredictions` upserts in persistence mutation |
| Output    | ML-enriched trip row used immediately by trip and timeline logic | prediction rows plus ML timeline handoffs                      |
| Trigger   | any trip build that hit ML conditions                            | only durable trip changes and completed handoffs               |


### 6.5 Commentary

This remains a clear win.

The latest branch also improved the stage ownership by moving the prediction gate helpers into `predictionStage.ts` and keeping the action focused on flow.

The main thing to watch is that `MlTimelineOverlay` should not grow into a second trip state object. It is healthy as a narrow timeline/prediction handoff. If future code starts treating it as another canonical trip shape, complexity will creep back in.

Recommended direction:

- keep predictions out of trip construction
- keep model loading grouped by terminal pair
- keep prediction writes compare-and-upsert rather than rewriting proposal rows blindly

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
  - returns `MlTimelineOverlay[]`
- `updateTimeline`
  - merges `mlTimelineOverlays` into `tripHandoffForTimeline` via `mergeMlOverlayIntoTripHandoffForTimeline`
  - `buildDockWritesFromTripHandoff`
    - `buildPingEventWritesFromCompletedFacts`
    - `buildPingEventWritesFromCurrentMessages`
  - returns:
    - `actualEvents`
    - `predictedEvents`
- `persistTimelineEventWrites`
  - `upsertActualDockRows` when actual rows exist
  - `projectPredictedDockWriteBatchesInDb` when predicted batches exist

Expected non-error branches:

- completed boundary vs current branch
- current message with ML vs current message without ML
- prediction clear batch vs prediction write batch
- successful-upsert-gated messages vs skipped messages

### 7.3 High-Level Function Comparison


| Before function          | Role                                         | Latest function                                | Role                                                    |
| ------------------------ | -------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------- |
| `timelineEventAssembler` | Assemble effects from trip lifecycle outputs | `updateTimeline`          | Assemble from persisted facts plus ML handoffs          |
| `applyTickEventWrites`   | Persist actual/predicted timeline writes     | `persistTimelineEventWrites`                   | Action computes timeline rows; persistence mutation writes final rows |
| final proposed trip      | Implicitly carried lifecycle and ML state    | `tripHandoffForTimeline` + `MlTimelineOverlay` | Explicit lifecycle and ML merge boundary                |


### 7.4 Data Flow And Side Effects


| Dimension                | Before                                      | Latest                                                   |
| ------------------------ | ------------------------------------------- | -------------------------------------------------------- |
| Input                    | lifecycle facts/messages from trip pipeline | trip persistence facts/messages plus prediction handoffs |
| DB reads                 | none specific at projection time            | none specific at projection time                         |
| DB writes                | `eventsActual`, `eventsPredicted`           | same                                                     |
| Output from compute step | `TickEventWrites`                           | `actualEvents` and `predictedEvents`                     |
| Gating                   | based on trip pipeline output               | based on successful trip persistence plus ML merge       |


### 7.5 Commentary

The correctness model is still better than before:

> timeline projection reflects trip facts that actually persisted, plus same-ping ML overlay when available.

That is a good rule.

This is also the place where the code still feels the heaviest. The names are reasonable one by one, but the combined set is large:

- `CompletedArrivalHandoff`
- `ActualDockWriteIntent`
- `PredictedDockWriteIntent`
- `ActiveTripWriteOutcome`
- `MlTimelineOverlay`
- `TripHandoffForTimeline`
- `TripPersistOutcome`

Some names above are intentionally narrow roles (dock intents vs trip-table outcome). Prefer deleting unused shapes over adding parallel aliases.

Recommended direction:

- keep the persisted-facts-before-timeline rule
- collapse compatibility-only projection types when tests no longer need them
- avoid adding another timeline adapter layer; the code already has enough translation shapes

## 8. Complexity Assessment

### 8.1 High-Level Assessment

The latest branch is still larger than the pre-refactor codebase, but it is no longer large in the same problematic way as the intermediate refactor.

The intermediate version added runtime structure that the hot path had to pay for every tick.

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

The top-level action is no longer the main concern. It is now short enough to serve as the map.

### 8.3 Where Complexity Decreased

Compared with the intermediate refactor, complexity decreased in important ways:

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

These numbers are approximate and are only meant to support the qualitative assessment.


| Surface                                | Before                                                | Latest                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Top-level orchestrator action          | `actions.ts` ≈ 287 LOC plus `applyTickEventWrites.ts` | `actions.ts` ≈ 209 LOC plus helper modules                                                                                          |
| Orchestrator runtime helper cluster    | small inline helpers plus `applyTickEventWrites`      | `locationUpdates.ts`, `mutations.ts`, `persistVesselTripWriteSet.ts`, `predictionStage.ts`, `scheduleContinuityAccess.ts` ≈ 815 LOC |
| Trip compute cluster                   | old `processTick` and `tripLifecycle` modules         | `updateVesselTrip`, `tripBuilders`, `lifecycle`, `tripFields` ≈ 1,084 LOC                                                    |
| Timeline/prediction projection cluster | embedded prediction plus old assembler                | standalone prediction and timeline projection modules; clearer but larger                                                           |


The code is bigger, but the extra code now buys more real separation than the intermediate version did.

### 8.5 Final Complexity Judgment

The latest code is not "simple" in absolute terms. Ferry trip lifecycle, schedule inference, ML overlays, and timeline projection are inherently tangled business concerns.

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

The previous memo argued that large unconditional reads were the wrong tradeoff for that cadence.

The latest branch mostly accepts that conclusion.

### 9.2 Per-Tick Database Access: Before vs Latest


| Path                            | Before                                              | Latest                                                                                    |
| ------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| baseline identity/trip snapshot | one combined query reading 3 tables                 | one combined query reading **3** tables: `vesselsIdentity`, `terminalsIdentity`, `activeVesselTrips` (no `vesselLocations` in baseline) |
| location dedupe reads           | mutation reads all `vesselLocations`                | `bulkUpsertVesselLocations` runs **`performBulkUpsertVesselLocations`** (`collect()` on `vesselLocations`) each ping |
| schedule reads                  | targeted `eventsScheduled` lookups only when needed | targeted memoized `eventsScheduled` lookups only when needed                              |
| location writes                 | changed/new rows after mutation-side compare        | changed/new rows after mutation-side compare (`VesselAbbrev` + `TimeStamp`)                |
| trip writes                     | conditional writes per lifecycle outcome            | conditional writes via persistence plan                                                   |
| prediction writes               | implicit/embedded                                   | explicit `vesselTripPredictions` upserts when prediction rows exist                       |
| timeline writes                 | conditional on trip pipeline output                 | conditional on persisted trip facts and prediction handoffs                               |


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

1. one baseline query for identities + active trips (**no** `vesselLocations` preload)
2. one WSF fetch
3. trip computation for mutation-returned **changed** location rows each ping
4. lazy, memoized schedule queries only when trip-field inference needs them
5. prediction model query only when gated trip facts need prediction
6. one locations-only **`bulkUpsertVesselLocations`** mutation per ping
7. one **`persistTripAndPredictionWrites`** mutation per ping (trips + predictions)
8. one **`persistTimelineEventWrites`** mutation per ping (final timeline rows)

This trades some **trip-stage CPU** (full batch every tick) for simpler **data access** (location table read/write localized to the mutation).

### 9.6 Schedule Reads

The latest schedule access is the most important cost correction.

Production now uses `createScheduleContinuityAccess`, which exposes two narrow methods:

- `getScheduledSegmentByKey`
- `getScheduledDeparturesForVesselAndSailingDay`

Both are memoized for the ping. The first can load one segment by key, then load that vessel/day's departures to attach next-leg continuity. The second loads one vessel/day's scheduled rows for rollover inference.

This is a good compromise:

- trip code stays independent of Convex query details
- schedule cost scales with schedule-sensitive vessels in the normalized batch (typically the live fleet each tick)
- repeated continuity lookups within one ping are cached

The old full-day snapshot idea should remain out of the production hot path unless production evidence shows targeted reads are worse.

### 9.7 Location Reads And Writes

**Current (2026-04-25 PM):** location dedupe follows the **classic mutation pattern** in a standalone write call: `bulkUpsertVesselLocations` invokes **`performBulkUpsertVesselLocations`**, which does a full **`collect()`** on `vesselLocations`, matches incoming feed rows by **`VesselAbbrev`**, and skips writes when **`TimeStamp`** is unchanged. The action does **not** preload stored rows.

Reading the full `vesselLocations` table inside that mutation each tick is acceptable while the table stays **one row per live vessel**. If read volume becomes a problem, prefer **measured** optimizations (for example a narrow index table maintained in lockstep) over ad hoc partial reads without a clear invariant.

The earlier “baseline snapshot + `existingLocationId` handoff” path has been **removed** in favor of this simpler split.

### 9.8 Prediction And Timeline Writes

Prediction and timeline writes are still appropriately conditional.

The main cost risk is not obvious DB overuse. It is accidental broadening of the prediction inputs. `buildPredictionStageInputs` is therefore important code:

- it gates on `tripStorageChanged || tripLifecycleChanged`
- it filters completed handoffs to changed vessels
- it avoids model queries when there is nothing to predict

That policy should stay narrow.

## 10. Further Improvement Opportunities

### 10.1 Code Flow

Recommended improvements:

1. Rename top-level trip-stage and persistence types for plain-language readability.
  - `tripRows` in the orchestrator action currently represents the full computed trip stage (not just raw rows).
  - Adopt intent-revealing names such as `tripStageResult`, `tripPersistencePlan`, and `timelineHandoff`.
  - Do this in one pass with type aliases first, then symbol renames, to minimize churn.
2. Reduce translation layers between trip persistence and timeline projection.
  - Consolidate overlapping shapes (`TripPersistOutcome`, `ActiveTripWriteOutcome`, current branch message DTOs) into one canonical persist result contract.
  - Keep only one ML overlay contract (`MlTimelineOverlay`) and remove parallel aliases.
3. Split `resolveTripFieldsForTripRow` into two files by ownership, not by arbitrary size.
  - Keep deterministic field resolution in one module.
  - Move diagnostics/log formatting helpers into a separate module so core logic reads linearly.
4. Remove snapshot-era wording from living docs and module comments.
  - Update docs that still imply production schedule snapshots as a central runtime strategy.
  - Mark snapshot helpers as test-only where they remain useful.

### 10.2 Reducing DB Queries And Writes

Recommended improvements:

1. Add per-ping instrumentation for schedule access cardinality and cache hit rate.
  - Record counts for `getScheduledSegmentByKey` and `getScheduledDeparturesForVesselAndSailingDay`.
  - Add one aggregate metric per ping so regressions are visible without log spam.
2. Add per-ping instrumentation for location dedupe effectiveness.
  - In `performBulkUpsertVesselLocations`, count `unchanged`, `replaced`, and `inserted` rows, plus per-vessel failure count from try/catch isolation logs.
  - Use this to decide whether any future index table optimization is worth the added write complexity.
3. Convert `performBulkUpsertVesselLocations` to bounded parallel writes.
  - Preserve deterministic dedupe (`VesselAbbrev`, `TimeStamp`) but batch `replace`/`insert` calls in small chunks.
  - Goal: reduce mutation wall-clock time at peak fleet size without increasing query count.
4. Keep prediction model fetches gated by changed durable trip facts and enforce this with tests.
  - Add a regression test asserting no model query call when both active trips and completed handoffs are empty.

### 10.3 Keeping The Code Simple

Recommended improvements:

1. Standardize on one naming pattern for stage functions.
  - Use verb-first names with explicit scope (`load*`, `compute*`, `build*`, `persist*`) and avoid mixed nouns like `tripRows` for stage objects.
  - Apply this first in `actions.ts`, `predictionStage.ts`, and `persistVesselTripWriteSet.ts`.
2. Delete compatibility-only types and exports that are no longer referenced by production call paths.
  - Keep test fixtures, but move compatibility helpers behind test-local imports when possible.
  - Shrink public module surfaces to reduce accidental coupling.
3. Add a short orchestrator “single-ping contract” doc near code.
  - Include exact stage inputs/outputs and invariants (for example: timeline projection uses persisted trip outcomes plus ML overlays).
  - Keep it versioned with code to prevent drift from engineering memos.

## 11. Final Recommendation

Prioritize a focused cleanup iteration over another architectural rewrite.

The highest-value next steps are:

- simplify trip/timeline handoff contracts and names so one ping is easy to follow end-to-end
- add lightweight per-ping metrics for schedule lookups and location dedupe outcomes
- remove stale snapshot-era production language and compatibility surfaces that no longer reflect runtime behavior
- reduce persistence mutation wall-clock time with safe bounded write batching

In short:

> The current design is directionally sound; the next gains come from shrinking conceptual overhead and tightening measured hot-path efficiency.

## 12. Remaining Backlog

Only pending work is listed here.

### 12.1 Documentation wording cleanup

1. Keep production docs explicit about targeted `eventsScheduled` access and avoid wording that suggests a production full-day schedule snapshot path.
  - **Scope:** align orchestrator/timeline docs and module comments where wording is ambiguous.
  - **Why:** prevents future refactors from reintroducing retired hot-path assumptions.
  - **Effort / Risk:** **S / Low**.

### 12.2 Optional performance follow-ups (measure first)

1. Reduce mutation wall-clock with bounded parallel location writes.
  - **Scope:** keep one `collect()`, preserve dedupe invariants, apply chunked `replace`/`insert` writes with bounded concurrency.
  - **Why:** improves hot-path latency under larger fleet snapshots.
  - **Effort / Risk:** **M / Medium**.
2. Evaluate structural optimization for location read cost (if needed).
  - **Scope:** design a narrow auxiliary index/table only if instrumentation shows sustained location-read pressure.
  - **Why:** reduces per-ping `vesselLocations` read burden without duplicating dedupe policy in action code.
  - **Effort / Risk:** **L / High**.

