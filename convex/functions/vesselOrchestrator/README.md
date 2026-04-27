# VesselOrchestrator - Real-Time Ferry Coordination

The `VesselOrchestrator` is the top-level coordination layer for real-time vessel processing. It fetches vessel locations from WSF once, normalizes that payload into backend-owned location rows, persists locations in a dedicated mutation, then runs trip/prediction/timeline orchestration for the same ping.

The orchestrator follows the backend layering rule:

```text
convex/functions -> convex/adapters -> convex/domain -> convex/functions/persistence
```

In this module, `action/actions.ts` is the Convex-facing shell (`updateVesselOrchestrator`): it loads the read model, runs one WSF fetch, normalizes locations, writes locations through standalone internal mutation **`bulkUpsertVesselLocations`** (which returns only changed rows after timestamp dedupe), then runs a **sequential per-vessel sparse pipeline** for each changed location. For each changed vessel, it computes **`updateVesselTrip`**, builds final trip write rows, runs **`runPredictionStage`**, computes timeline rows with **`updateTimeline`** in action memory, and persists trip/prediction/timeline rows together through **`persistPerVesselOrchestratorWrites`**. Prediction model blobs are preloaded per-vessel in `action/pipeline/prediction.ts` via **`getProductionModelParametersForPing`**. Raw vessel locations are fetched through `convex/adapters/fetch/fetchWsfVesselLocations.ts`, then normalized by `domain/vesselOrchestration/updateVesselLocations` into `ConvexVesselLocation` before Convex mutations run.

### O1 pipeline structure (named steps)

Phase **O1** ([handoff](../../../docs/handoffs/vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md)) named these sequential steps in **`action/actions.ts`**:

1. **Locations** — computed in `action/actions.ts` from the WSF batch, then written through internal mutation **`bulkUpsertVesselLocations`** (reads `vesselLocations`, matches by `VesselAbbrev`, skips unchanged `TimeStamp`, returns changed rows).
2. **`updateVesselTrip`** — the per-vessel loop calls `updateVesselTrip` for each changed location this tick, then function-layer `persistVesselTripWrites` applies active/completed rows after per-vessel failure isolation.
3. **`runPredictionStage`** — `updateVesselPredictions` (`updateVesselPredictions` domain module) computes prediction rows and ML timeline overlays for that vessel.
4. **`updateTimeline`** — action computes final `actualEvents` / `predictedEvents` rows from trip writes + ML overlays.
5. **`persistPerVesselOrchestratorWrites`** — applies per-vessel trip writes, prediction rows, and timeline rows in one mutation call.

The handler in `action/actions.ts` chains these steps; each step either calls domain helpers and/or `ctx.runMutation` with the payloads produced for that phase.

### O5 — Timeline consumer contract (cleanup)

Primary path: **`updateTimeline`** consumes **`RunUpdateVesselTimelineFromAssemblyInput`** (`tripHandoffForTimeline` + **`mlTimelineOverlays`**) in `action/actions.ts` after trip/prediction persistence returns its handoff. `updateTimeline` applies ML overlays in memory onto the shared **`PersistedTripTimelineHandoff`** shape; timeline does not assemble from `vesselTripPredictions` DB reads. Older O5 handoff: [handoff](../../../docs/handoffs/vessel-orchestrator-o5-timeline-and-cleanup-handoff-2026-04-18.md).

## System Overview

The orchestrator runs periodically (currently every 5 seconds via `convex/crons.ts`). **`updateVesselOrchestrator`** runs **sequentially**: after one shared WSF batch and trip-stage compute, it persists **locations first** in a dedicated mutation, then applies trip lifecycle/prediction writes, assembles timeline rows in action memory, and finally applies timeline rows in a dedicated mutation. This keeps the expensive external fetch centralized while the domain trip pipeline (`updateVesselTrip` within the orchestrator’s per-vessel loop) and timeline assembly stay explicit.

### Operational concerns (Phase 1)

Naming matches [`architecture.md`](../../domain/vesselOrchestration/architecture.md):

- **Live `vesselLocations`** — standalone `bulkUpsertVesselLocations` mutation (`locations` arg: full normalized fleet; `collect()` + compare by `VesselAbbrev` / `TimeStamp`; per-vessel write failures logged without aborting remaining rows) returning only inserted/replaced rows to the action.
- **updateVesselTrip** — the per-vessel loop calls `updateVesselTrip`, then function-layer `persistVesselTripWrites` applies the translated trip writes.
- **runPredictionStage** — `updateVesselPredictions` from **`domain/vesselOrchestration/updateVesselPredictions`** computes prediction proposals + ML overlays per changed vessel.
- **updateTimeline** — `updateTimeline` from **`domain/vesselOrchestration/updateTimeline`** runs in `action/actions.ts` from trip-write handoff + ML overlays, and the resulting timeline rows are applied in the same per-vessel mutation as trip/prediction writes.

```text
WSF VesselLocations API
  -> adapters/fetch/fetchRawWsfVesselLocations
  -> functions/vesselOrchestrator/action/actions.ts (persist locations -> trips -> predictions -> timeline)
  -> vesselLocations / vesselTrips / vesselTripPredictions / eventsActual / eventsPredicted
```

## Why The Timeline Event Tables Exist

`VesselTimeline` used to depend on a more convoluted frontend data pipeline that merged scheduled trips, active trips, completed trips, and current vessel location state in the browser.

The normalized `vesselTimeline` event tables exist to simplify that contract.

Its purpose is:

- provide the normalized persistence layer for timeline structure and overlays
- separate timeline rendering needs from the heavier trip lifecycle tables
- keep reconciliation and source-priority logic on the backend
- support a small backbone query instead of exposing raw event tables directly or rebuilding structure from live vessel samples on the client

The timeline event tables are not intended to replace `activeVesselTrips` or `completedVesselTrips`. Those tables still support trip lifecycle logic and other features. `eventsScheduled`, `eventsActual`, and `eventsPredicted` are a purpose-built read model for `VesselTimeline`.

## Architecture Components

### 1. Orchestrator Action (`action/actions.ts`)

Main entrypoint:

- `updateVesselOrchestrator`

Responsibilities:

- fetch vessel locations from WSF
- do that external fetch through `convex/adapters/fetch/fetchWsfVesselLocations.ts`
- load backend vessel rows, terminal rows, and **storage-native** `activeVesselTrips` in **one** internal query per ping (`getOrchestratorModelData` in `query/queries.ts` — no `vesselLocations` and no `eventsPredicted` join; public `getActiveTrips` still enriches for API subscribers); fail fast when identity tables are empty (seed / hourly identity crons)
- **fetch:** `fetchRawWsfVesselLocations` throws when WSF returns no rows
- normalize raw WSF payloads through `mapWsfVesselLocations` + `assertUsableVesselLocationBatch`, which skip individual bad feed rows (`console.warn` per skip) and throw when every row fails conversion
- convert raw WSF payloads into `ConvexVesselLocation`, including resolved vessel identity, canonical optional `Key`, and terminal-or-marine-location fields derived from the backend `terminalsIdentity` table
- after normalizing the WSF batch: write locations through `bulkUpsertVesselLocations` and use only the returned changed rows for trip compute, create cached targeted `eventsScheduled` access for the ping through `action/pipeline/scheduleContinuity.ts`, and for each changed vessel run `updateVesselTrip` → `runPredictionStage` → `updateTimeline` → `persistPerVesselOrchestratorWrites`.

Domain pipeline (same ping semantics as before):

- passenger-terminal allow-list and trip-eligible location filtering
- lifecycle mutations always precede timeline projection for the ping
- pass the same ping’s active-trip list into the per-vessel trip loop so the trip branch does not run a separate `getActiveTrips` query

Transformation pipeline:

```text
WSF VesselLocation
  -> adapters/fetch/fetchRawWsfVesselLocations()
  -> domain/vesselOrchestration/updateVesselLocations
  -> ConvexVesselLocation[]
```

Notes:

- the backend `terminalsIdentity` table remains the canonical lookup for passenger terminals
- it also contains a small number of known non-passenger marine locations used by the WSF vessel feed, such as `EAH` and `VIG`
- unknown future marine-location abbreviations are preserved for vessel-location tracking instead of failing ingestion
- only passenger-terminal locations are forwarded into trip processing
- passenger-terminal trip eligibility is intentionally simple set membership on departing and optional arriving terminal abbreviations

On failure, `updateVesselOrchestrator` logs and **rethrows** (the handler returns `void`).

### 2. Vessel Location Storage (`vesselLocation/`)

Purpose:

- store one current vessel-location record per vessel
- keep the optional canonical trip `Key` alongside live vessel state when it is safely derivable from the feed

Normalized feed locations are written via standalone **`bulkUpsertVesselLocations`** (reads `vesselLocations`, matches by **`VesselAbbrev`**, skips when `TimeStamp` is unchanged, then replace/insert), and that mutation returns only inserted/replaced rows for downstream trip compute.

This table can therefore contain both:

- canonical passenger-terminal locations
- non-passenger marine locations reported by WSF, when needed to keep live vessel state visible

### 3. Trip Lifecycle (`vesselTrips/actions.ts`)

Purpose:

- maintain `activeVesselTrips` and `completedVesselTrips` for lifecycle state
- produce the per-ping persistence write set (`tripWrites`) and prediction gate inputs consumed by downstream phases

Trip lifecycle is now intentionally narrower than predictions and timeline. The trip phase owns lifecycle transitions and the resulting write intents (`completedTripWrite`, `activeTripUpsert`, dock intents); predictions run afterward from changed-trip facts every ping, and timeline assembles its own writes from persisted trip outcomes plus prediction outputs.

The active-trip lifecycle now follows the vessel's physical state more directly:

- `at-dock`
- `at-sea`

Trip-row `AtDock` now uses the stabilized location-phase signal
`AtDockObserved` (not raw WSF `AtDock`) so lifecycle and prediction phase
routing share the same observed contract.

When a vessel arrives at dock, the previous trip completes immediately and the next trip starts immediately. If the live feed lags on next-trip fields such as `ScheduledDeparture` or `ArrivingTerminalAbbrev`, the trip pipeline infers the next trip deterministically from the scheduled-trip backbone instead of holding the vessel in a separate waiting state.

Those provisional trip fields are observable, but not warnings by default. The trip pipeline logs only meaningful transitions: when schedule evidence starts or updates provisional trip fields, when partial WSF values conflict with the inferred result, and when authoritative WSF trip fields replace prior values. It intentionally does not log every benign reuse of unchanged provisional trip fields.

Trip processing remains intentionally stricter than vessel-location storage: only rows that resolve to passenger terminals participate in trip derivation.

At the orchestrator boundary, trip-stage failures are logged per vessel without aborting the rest of the fleet ping (`computeTripStageForLocation` in the per-vessel loop).

### 4. Timeline Projection (`vesselTimeline/`)

Purpose:

- maintain the normalized boundary-event persistence layer used to build the public `VesselTimeline` backbone

This remains intentionally smaller than the trip lifecycle pipeline. It stores only the boundary fields needed to derive a day timeline:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `EventType`
- `EventScheduledTime?`
- `EventPredictedTime?`
- `EventActualTime?`

Those normalized rows are not the public query contract anymore. The backend now builds one ordered same-day event list for the timeline backbone. When more than one `eventsPredicted` row shares the same boundary `Key` (e.g. WSF ETA vs ML), `mergeTimelineRows` picks a single backbone `EventPredictedTime` (WSF ETA row first). Trip-shaped queries still expose `Eta` plus prediction-enriched fields separately. The client derives `activeInterval` from that backbone and combines it with its existing real-time `VesselLocation` subscription for indicator placement.

Detailed `VesselTimeline` backend architecture now lives in:

- `convex/domain/README.md`

That document covers:

- schedule seeding
- live enrichment
- future-vs-history ownership rules
- reseed merge behavior
- event identity and invariants
- test coverage and file map

## Data Flow

### Orchestrator runtime flow

```text
WSF API
  -> fetch vessel locations once via adapters
  -> normalize locations in domain/updateVesselLocations
  -> bulkUpsertVesselLocations (locations dedupe/write + changed rows return)
  -> updateVesselTrip (compute changed rows in action)
  -> updateVesselPredictions (ML + vesselTripPredictions upserts in per-vessel persist)
  -> updateVesselTimeline (projection + apply in per-vessel persist)
```

### Timeline feed flow

```text
WSF schedule sync
  -> classify direct physical segments
  -> seed eventsScheduled skeleton

WSF vessel location samples
  -> VesselOrchestrator
  -> update trip lifecycle state
  -> project actual/predicted event updates

Frontend VesselTimeline
  -> query backend-owned VesselTimeline backbone
  -> derive active interval locally from ordered events
  -> combine with live VesselLocation for indicator placement
```

## Error isolation

`updateVesselOrchestrator` runs **sequentially**. A failure in any step aborts the rest of the ping (after logging). Fetch/conversion failure stops the ping first.

Timeline overlays are applied **after** trip lifecycle mutations for the ping (`updateVesselTimeline`), instead of re-deriving actuals from raw location samples alone; the public timeline query does not depend on `vesselLocations` reads.

## Performance Characteristics

The orchestrator keeps external API usage efficient:

- one WSF vessel-location fetch per ping
- one internal query per ping for vessels, terminals, and active trips (`getOrchestratorModelData` in `query/queries.ts`), instead of multiple separate `runQuery` round trips for that baseline
- one standalone locations mutation call (`bulkUpsertVesselLocations`) carrying only location rows
- one converted location batch for write payload; trip compute consumes the mutation-returned changed subset

Trip compute and timeline projection both run in the action’s per-vessel loop (`updateVesselTrip` + `updateTimeline`); mutation handlers are write-only apply steps.

### Schedule access rule (do not add parallel seams)

Trip-field and continuity code must depend only on **`ScheduleContinuityAccess`**:

- **Production:** `action/pipeline/scheduleContinuity.ts` — memoized targeted `eventsScheduled` internal queries.
- **Tests:** in-memory implementations live under `domain/vesselOrchestration/shared/scheduleSnapshot/` (fixture data only; not a production schedule read path).

Do not introduce a second public “schedule provider” abstraction above this interface; extend these methods if new evidence shapes are needed.

The timeline overlay path is designed to stay lightweight:

- no extra external fetches
- no live-location dependency in the timeline query
- updates are keyed to stable event identities derived from the trip segment key
- unchanged event rows are not rewritten

## Relationship To Other Tables

`vesselLocations`

- current snapshot of live vessel state
- includes optional derived trip identity via `Key`
- used directly by the UI for current indicator state and warnings
- may include non-passenger marine locations when the WSF vessel feed reports them

`activeVesselTrips` / `completedVesselTrips`

- richer trip lifecycle models
- support trip state tracking, predictions, and other operational features
- intentionally exclude non-passenger marine-location rows

`vesselTimeline` event tables

- normalized persistence layer for `VesselTimeline`
- store ordered boundary events for one vessel/day
- feed the backend-owned backbone query
- are fed by schedule seeding plus trip-driven actual/predicted projection

## Core files

- `action/actions.ts` — `updateVesselOrchestrator`: read model, WSF fetch, location upsert via `bulkUpsertVesselLocations`, per-vessel trip/prediction planning, timeline projection, and write-only mutation calls.
- `action/pipeline/updateVesselLocations/updateVesselLocations.ts` — location update stage (fetch, normalize, augment with `AtDockObserved`, persist, and return changed rows).
- `action/pipeline/scheduleContinuity.ts` — targeted cached `eventsScheduled` access for continuity lookups during the trip stage.
- `action/pipeline/prediction.ts` — changed-trip prediction gating plus ML model preload and prediction execution.
- `action/pipeline/tripStage.ts` — per-vessel trip-stage compute and prediction-stage gating.
- `action/pipeline/tripWrites.ts` — sparse trip write construction and lifecycle event-flag shaping.
- `action/pipeline/timelineHandoff.ts` — adapter from trip writes into timeline handoff contract.
- `query/queries.ts` — `getOrchestratorModelData` bundled DB read for one ping.
- `mutation/mutations.ts` — write-only internal mutation: **`persistPerVesselOrchestratorWrites`** (trip writes + prediction upserts + timeline rows).
- `mutation/persistence/tripWrites.ts` — function-layer trip-table mutation apply step for one completed row and one active upsert, with leave-dock follow-up intent from supplied `actualDockWrite`.
- `mutation/persistence/predictionWrites.ts` — sparse prediction proposal persistence helper.
- `mutation/persistence/timelineWrites.ts` — thin writer for already-projected `actualEvents` / `predictedEvents` rows.
- `mutation/schemas/schemas.ts` — orchestrator write-contract validators.

## Tests

Trip sequencing (location upsert → plan/apply → predictions → timeline) for this module is covered by focused tests under `tests/` as they are added (see e.g. `updateVesselLocations.test.ts`).

Canonical vessel and terminal table refreshes from WSF basics are implemented in `convex/functions/vessels/actions.ts` (`syncBackendVessels` internal action, `runSyncBackendVessels` public action, `syncBackendVesselTable` helper) and `convex/functions/terminals/actions.ts` (`syncBackendTerminals`, `runSyncBackendTerminals`, `syncBackendTerminalTable`). Hourly cron entries for those internal actions live in `convex/crons.ts`.

## Related Documentation

- `convex/domain/vesselOrchestration/architecture.md` — orchestrator ping, four concerns, glossary, and canonical `Timestamp semantics (current code)` contract
- `convex/functions/vesselOrchestrator/VesselOrchestratorPipeline.md` — single-ping stage inputs/outputs and runtime invariants for the orchestrator hot path
- `convex/functions/vesselTrips/README.md`
- `convex/functions/scheduledTrips/README.md`
- `docs/IDENTITY_AND_TOPOLOGY_ARCHITECTURE.md`
- `src/features/VesselTimeline/docs/ARCHITECTURE.md`

## Summary

`updateVesselOrchestrator` uses one WSF batch per ping, then **`runOrchestratorPing`** in `action/actions.ts`: locations are written through standalone `bulkUpsertVesselLocations`, and each changed vessel runs a sparse pipeline (`updateVesselTrip` + `runPredictionStage`), persists trip/prediction writes, computes timeline rows in action memory, and applies those final dock writes through a thin timeline mutation.
