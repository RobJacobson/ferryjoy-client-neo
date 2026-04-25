# VesselOrchestrator - Real-Time Ferry Coordination

The `VesselOrchestrator` is the top-level coordination layer for real-time vessel processing. It fetches vessel locations from WSF once, normalizes that payload into backend-owned location rows, persists locations in a dedicated mutation, then runs trip/prediction/timeline orchestration for the same ping.

The orchestrator follows the backend layering rule:

```text
convex/functions -> convex/adapters -> convex/domain -> convex/functions/persistence
```

In this module, `actions.ts` is the Convex-facing shell (`updateVesselOrchestrator`): it loads the read model, runs one WSF fetch, normalizes locations, writes locations through standalone **`bulkUpsertVesselLocations`**, uses targeted cached `eventsScheduled` lookups only when trip continuity needs them, computes **`updateVesselTrips`** and **`runVesselPredictionPing`** in process, and then persists trips/predictions/timeline in **`persistOrchestratorPing`**. Prediction model blobs are preloaded in **`predictionStage.ts`** via **`getProductionModelParametersForPing`**. Raw vessel locations are fetched through `convex/adapters/fetch/fetchWsfVesselLocations.ts`, then normalized by `domain/vesselOrchestration/updateVesselLocations` into `ConvexVesselLocation` before Convex mutations run.

### O1 pipeline structure (named steps)

Phase **O1** ([handoff](../../../docs/handoffs/vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md)) named these sequential steps in **`actions.ts`**:

1. **Locations** — computed in `actions.ts` from the WSF batch, then written through public mutation **`bulkUpsertVesselLocations`** (reads `vesselLocations`, matches by `VesselAbbrev`, skips unchanged `TimeStamp`).
2. **`updateVesselTrips`** — the per-vessel loop calls `computeVesselTripUpdate` for each normalized location this tick, then function-layer `persistVesselTripWriteSet` applies active/completed rows after per-vessel failure isolation.
3. **`runPredictionStage`** — `runVesselPredictionPing` (`updateVesselPredictions` domain module) computes prediction rows and ML timeline overlays in action code.
4. **`persistOrchestratorPing`** — `persistVesselTripWriteSet`, prediction upserts, `runUpdateVesselTimelineFromAssembly` (`tripHandoffForTimeline` from trip persist output + `mlTimelineOverlays` after persist), then projection mutations for `eventsActual` / `eventsPredicted`.

The handler in `actions.ts` chains these steps; each step either calls domain helpers and/or `ctx.runMutation` with the payloads produced for that phase.

### O5 — Timeline consumer contract (cleanup)

Primary path: **`runUpdateVesselTimelineFromAssembly`** consumes **`RunUpdateVesselTimelineFromAssemblyInput`** (`tripHandoffForTimeline` + **`mlTimelineOverlays`**). ML merges in memory via **`mergeMlOverlayIntoTripHandoffForTimeline`** on the shared **`PersistedTripTimelineHandoff`** shape; timeline does not assemble from `vesselTripPredictions` DB reads. Older O5 handoff: [handoff](../../../docs/handoffs/vessel-orchestrator-o5-timeline-and-cleanup-handoff-2026-04-18.md).

## System Overview

The orchestrator runs periodically (currently every 5 seconds via `convex/crons.ts`). **`updateVesselOrchestrator`** runs **sequentially**: after one shared WSF batch and trip dependency wiring, it persists **locations first** in a dedicated mutation, then applies trip lifecycle writes, then predictions, then timeline rows through `persistOrchestratorPing`. This keeps the expensive external fetch centralized while the domain trip pipeline (`computeVesselTripUpdate` within the orchestrator’s per-vessel loop) and timeline assembly stay explicit.

### Operational concerns (Phase 1)

Naming matches [`architecture.md`](../../domain/vesselOrchestration/architecture.md):

- **Live `vesselLocations`** — standalone `bulkUpsertVesselLocations` mutation (`locations` arg: full normalized fleet; `collect()` + compare by `VesselAbbrev` / `TimeStamp`; per-vessel write failures logged without aborting remaining rows).
- **updateVesselTrips** — the per-vessel loop calls `computeVesselTripUpdate`, then function-layer `persistVesselTripWriteSet` applies the translated trip writes.
- **runAndPersistVesselPredictionPing** — `runVesselPredictionPing` from **`domain/vesselOrchestration/updateVesselPredictions`** + `batchUpsertProposals` when needed, after trips and before timeline.
- **updateTimeline** — `runUpdateVesselTimelineFromAssembly` from **`domain/vesselOrchestration/updateTimeline`** plus `eventsActual` / `eventsPredicted` writes (inside **`persistOrchestratorPing`** in **`mutations.ts`**).

```text
WSF VesselLocations API
  -> adapters/fetch/fetchRawWsfVesselLocations
  -> functions/vesselOrchestrator/actions.ts (persist locations -> trips -> predictions -> timeline)
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

### 1. Orchestrator Action (`actions.ts`)

Main entrypoint:

- `updateVesselOrchestrator`

Responsibilities:

- fetch vessel locations from WSF
- do that external fetch through `convex/adapters/fetch/fetchWsfVesselLocations.ts`
- load backend vessel rows, terminal rows, and **storage-native** `activeVesselTrips` in **one** internal query per ping (`getOrchestratorModelData` in `queries.ts` — no `vesselLocations` and no `eventsPredicted` join; public `getActiveTrips` still enriches for API subscribers); soft-fail when identity tables are empty (seed / hourly identity crons)
- **fetch:** `fetchRawWsfVesselLocations` throws when WSF returns no rows
- normalize raw WSF payloads through `computeVesselLocationRows`, which skips individual bad feed rows (`console.warn` per skip) and throws when every row fails conversion
- convert raw WSF payloads into `ConvexVesselLocation`, including resolved vessel identity, canonical optional `Key`, and terminal-or-marine-location fields derived from the backend `terminalsIdentity` table
- after normalizing the WSF batch: write locations through `bulkUpsertVesselLocations`, create cached targeted `eventsScheduled` access for the ping through `scheduleContinuityAccess.ts`, use that continuity seam during the per-vessel trip loop, preload ML models only if a materially changed trip needs predictions through `predictionStage.ts`, then run `updateVesselTrips` → `updateVesselPredictions` → `updateVesselTimeline` via **`persistOrchestratorPing`**

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

Normalized feed locations are written via standalone **`bulkUpsertVesselLocations`** (reads `vesselLocations`, matches by **`VesselAbbrev`**, skips when `TimeStamp` is unchanged, then replace/insert).

This table can therefore contain both:

- canonical passenger-terminal locations
- non-passenger marine locations reported by WSF, when needed to keep live vessel state visible

### 3. Trip Lifecycle (`vesselTrips/actions.ts`)

Purpose:

- maintain `activeVesselTrips` and `completedVesselTrips` for lifecycle state
- produce the authoritative per-ping trip arrays consumed by downstream phases

Trip lifecycle is now intentionally narrower than predictions and timeline. The trip phase owns lifecycle transitions and the resulting trip rows; predictions run afterward from those rows every ping, and timeline assembles its own writes from the persisted/apply results plus the prediction outputs.

The active-trip lifecycle now follows the vessel's physical state more directly:

- `at-dock`
- `at-sea`

When a vessel arrives at dock, the previous trip completes immediately and the next trip starts immediately. If the live feed lags on next-trip fields such as `ScheduledDeparture` or `ArrivingTerminalAbbrev`, the trip pipeline infers the next trip deterministically from the scheduled-trip backbone instead of holding the vessel in a separate waiting state.

Those provisional trip fields are observable, but not warnings by default. The trip pipeline logs only meaningful transitions: when schedule evidence starts or updates provisional trip fields, when partial WSF values conflict with the inferred result, and when authoritative WSF trip fields replace prior values. It intentionally does not log every benign reuse of unchanged provisional trip fields.

Trip processing remains intentionally stricter than vessel-location storage: only rows that resolve to passenger terminals participate in trip derivation.

At the orchestrator boundary, trip-stage failures are logged per vessel without aborting the rest of the fleet ping (`computeTripStageForLocations`).

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
  -> bulkUpsertVesselLocations (locations-only write)
  -> updateVesselTrips (compute in action -> persistOrchestratorPing: apply trips)
  -> updateVesselPredictions (ML + vesselTripPredictions upserts inside persistOrchestratorPing)
  -> updateVesselTimeline (build projection input -> eventsActual / eventsPredicted inside persistOrchestratorPing)
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
- one internal query per ping for vessels, terminals, and active trips (`getOrchestratorModelData` in `queries.ts`), instead of multiple separate `runQuery` round trips for that baseline
- one standalone locations mutation call (`bulkUpsertVesselLocations`) carrying only location rows
- one converted location batch reused for trip compute and the location write payload

Trip compute runs in the action’s per-vessel loop (`computeVesselTripUpdate`); trip table writes and timeline projection run inside **`persistOrchestratorPing`** (`upsertVesselTripsBatch` where applicable, then `buildDockWritesFromTripHandoff` for dock writes).

### Schedule access rule (do not add parallel seams)

Trip-field and continuity code must depend only on **`ScheduleContinuityAccess`**:

- **Production:** `scheduleContinuityAccess.ts` — memoized targeted `eventsScheduled` internal queries.
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

- `actions.ts` — `updateVesselOrchestrator`: read model, WSF fetch, location upsert via `bulkUpsertVesselLocations`, per-vessel trip/prediction flow, then **`persistOrchestratorPing`** (trips + predictions + timeline).
- `locationUpdates.ts` — shared location normalization and dedupe helpers for the orchestrator ping.
- `scheduleContinuityAccess.ts` — targeted cached `eventsScheduled` access for continuity lookups during the trip stage.
- `predictionStage.ts` — changed-trip prediction gating plus ML model preload and prediction execution.
- `testing.ts` — focused orchestrator test helpers kept out of the runtime hot-path file.
- `persistVesselTripWriteSet.ts` — function-layer trip-table mutation apply step for completed handoffs, active upserts, and leave-dock follow-ups.
- `mutations.ts` — **`persistOrchestratorPing`**: **`persistVesselTripWriteSet`**, prediction upserts, **`runUpdateVesselTimelineFromAssembly`**, dock writes.
- `computeVesselPredictionRows` / `runVesselPredictionPing` (domain `updateVesselPredictions`) — prediction proposals + ML overlays consumed by `persistOrchestratorPing`.
- `queries.ts` — `getOrchestratorModelData` (bundled DB read for one ping).
- `schemas.ts` — orchestrator-related schemas.

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

`updateVesselOrchestrator` uses one WSF batch per ping, then **`runOrchestratorPing`** in `actions.ts`: locations are written through standalone `bulkUpsertVesselLocations`, trip compute and **`runPredictionStage`** run in the action, and **`persistOrchestratorPing`** applies trip writes, prediction upserts, and timeline dock writes onto `eventsActual` / `eventsPredicted`.
