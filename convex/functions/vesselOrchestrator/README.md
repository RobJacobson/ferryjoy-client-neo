# VesselOrchestrator - Real-Time Ferry Coordination

The `VesselOrchestrator` is the top-level coordination layer for real-time vessel processing. It fetches vessel locations from WSF once, normalizes that payload into backend-owned location rows, persists locations in a dedicated mutation, then runs trip/prediction/timeline orchestration for the same ping.

The orchestrator follows the backend layering rule:

```text
convex/functions -> convex/adapters -> convex/domain -> convex/functions/persistence
```

In this module, `actions/updateVesselOrchestrator.ts` is the Convex-facing shell (`updateVesselOrchestrator`): it loads **identities** (`getOrchestratorIdentities`), runs one WSF fetch, normalizes locations, writes locations through internal mutation **`bulkUpsertVesselLocations`** (returns **changed rows** plus **`activeTripsForChanged`** for those vessels in the **same transaction**), then runs a **sequential per-vessel sparse pipeline** for each changed location. For each changed vessel, it computes **`updateVesselTrip`** → **`VesselTripUpdate | null`**, runs domain **`updateLeaveDockEventPatch`** (`domain/vesselOrchestration/updateLeaveDockEventPatch`) when this ping is an observed leave-dock transition (optional **`updateLeaveDockEventPatch`** on **`persistVesselUpdates`**), loads prediction model context via **`loadPredictionContext`** when domain-derived preload requests apply, runs domain **`updateVesselPredictions`**, computes timeline rows with domain **`updateTimeline`** (sequenced in **`actions/ping/runOrchestratorPing`**), then applies trip, prediction, timeline, and optional depart-next ML row patches through one atomic **`persistVesselUpdates`** mutation. **`loadPredictionContext`** wraps **`getProductionModelParametersForPing`**; terminal-pair requests are derived in **`domain/vesselOrchestration/updateVesselPredictions`** (**`predictionModelLoadRequestForTripUpdate`**). Raw vessel locations are fetched through `convex/adapters/fetch/fetchWsfVesselLocations.ts`, then normalized by `domain/vesselOrchestration/updateVesselLocations` into `ConvexVesselLocation` before Convex mutations run.

### O1 pipeline structure (named steps)

Phase **O1** ([handoff](../../../docs/handoffs/vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md)) named these sequential steps in **`actions/updateVesselOrchestrator.ts`**:

1. **Locations** — `runStage1UpdateVesselLocations` (`actions/ping`) persists the normalized batch via **`bulkUpsertVesselLocations`** and returns changed rows plus **`activeTripsForChanged`** (timestamp dedupe + indexed active-trip reads after writes).
2. **`updateVesselTrip`** — domain compute only; returns **`VesselTripUpdate | null`** (skip vessel when null).
3. **`updateLeaveDockEventPatch`** (`domain/vesselOrchestration/updateLeaveDockEventPatch`) — optional patch payload when the active trip just left dock with `LeftDockActual` (same name on **`persistVesselUpdates`**).
4. **`loadPredictionContext`** + **`updateVesselPredictions`** — preload production models when needed, then ML overlay + **`vesselTripPredictions`** proposal rows + **`mlTimelineOverlays`** for the same ping.
5. **`updateTimeline`** — domain projection from **`{ pingStartedAt, tripUpdate, mlTimelineOverlays }`**; derives **`PersistedTripTimelineHandoff`** internally (**`timelineHandoffFromTripUpdate`**).
6. **`persistVesselUpdates`** — applies trip, prediction, timeline, and optional **`updateLeaveDockEventPatch`** (patches depart-next ML on `eventsPredicted`) in one transaction for that vessel.

The handler in `actions/updateVesselOrchestrator.ts` chains these steps; domain helpers compute payloads in memory, and `persistVesselUpdates` is the single per-vessel persistence boundary.

### O5 — Timeline consumer contract (cleanup)

Primary path: **`updateTimeline`** consumes **`RunUpdateVesselTimelineFromAssemblyInput`** (`pingStartedAt`, **`tripUpdate`**, **`mlTimelineOverlays`**) in `actions/ping/runOrchestratorPing.ts` *before* aggregate persistence. The domain derives **`PersistedTripTimelineHandoff`** from **`VesselTripUpdate`** (**`timelineHandoffFromTripUpdate`**), applies ML overlays in memory, and projects **`actualEvents`** / **`predictedEvents`**; timeline assembly does not read `vesselTripPredictions` from the database on this path. Older O5 handoff: [handoff](../../../docs/handoffs/vessel-orchestrator-o5-timeline-and-cleanup-handoff-2026-04-18.md).

## System Overview

The orchestrator runs periodically (currently every 5 seconds via `convex/crons.ts`). **`updateVesselOrchestrator`** runs **sequentially**: after one shared WSF batch, it persists **locations first** in a dedicated mutation, then computes trip lifecycle, prediction, and timeline rows in action memory before applying each vessel's durable writes through one aggregate mutation. This keeps the expensive external fetch centralized while the domain trip pipeline (`updateVesselTrip` within the orchestrator’s per-vessel loop) and timeline assembly stay explicit.

### Operational concerns (Phase 1)

Naming matches [`architecture.md`](../../domain/vesselOrchestration/architecture.md):

- **Live `vesselLocations`** — standalone `bulkUpsertVesselLocations` mutation (`locations` arg: full normalized fleet; `collect()` + compare by `VesselAbbrev` / `TimeStamp`; per-vessel write failures logged without aborting remaining rows) returning **`{ changedLocations, activeTripsForChanged }`** to the action.
- **updateVesselTrip** — the per-vessel loop calls `updateVesselTrip` (returns **`VesselTripUpdate | null`**); trip-table rows are persisted through the aggregate per-vessel mutation.
- **loadPredictionContext** + **updateVesselPredictions** — **`loadPredictionContext`** issues the model-parameter query when **`predictionModelLoadRequestForTripUpdate`** returns a request; **`updateVesselPredictions`** from **`domain/vesselOrchestration/updateVesselPredictions`** computes prediction proposals + ML overlays per changed vessel.
- **updateTimeline** — **`updateTimeline`** from **`domain/vesselOrchestration/updateTimeline`** runs in `actions/ping/runOrchestratorPing.ts` with **`tripUpdate`** + same-ping **`mlTimelineOverlays`**; timeline rows are applied in the same per-vessel mutation as trip/prediction writes.

```text
WSF VesselLocations API
  -> adapters/fetch/fetchRawWsfVesselLocations
  -> functions/vesselOrchestrator/actions/updateVesselOrchestrator.ts (persist locations -> trips -> predictions -> timeline; ping stages under actions/ping/)
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

### 1. Orchestrator Action (`actions/updateVesselOrchestrator.ts`)

Main entrypoint:

- `updateVesselOrchestrator`

Responsibilities:

- fetch vessel locations from WSF
- do that external fetch through `convex/adapters/fetch/fetchWsfVesselLocations.ts`
- load backend vessel and terminal identity rows in **one** internal query per ping (`getOrchestratorIdentities` in `queries/orchestratorSnapshotQueries.ts` — no `vesselLocations`, no `activeVesselTrips`, no `eventsPredicted` join; public `getActiveTrips` still enriches for API subscribers); fail fast when identity tables are empty (seed / hourly identity crons)
- **`bulkUpsertVesselLocations`** also loads **storage-native** `activeVesselTrips` for **changed** `VesselAbbrev` values (indexed `.first()` per abbrev; **post–location-write** inside the same mutation)
- **fetch:** `fetchRawWsfVesselLocations` throws when WSF returns no rows
- normalize raw WSF payloads through `mapWsfVesselLocations` + `assertUsableVesselLocationBatch`, which skip individual bad feed rows (`console.warn` per skip) and throw when every row fails conversion
- convert raw WSF payloads into `ConvexVesselLocation`, including resolved vessel identity, canonical optional `Key`, and terminal-or-marine-location fields derived from the backend `terminalsIdentity` table
- after normalizing the WSF batch: write locations through `bulkUpsertVesselLocations` and use only the returned changed rows for trip compute, create key-first schedule access through `actions/ping/updateVesselTrip/updateVesselTripDbAccess.ts`, and for each changed vessel run `updateVesselTrip` → `updateLeaveDockEventPatch` → `loadPredictionContext` → `updateVesselPredictions` → `updateTimeline` → `persistVesselUpdates`.

Domain pipeline (same ping semantics as before):

- passenger-terminal allow-list and trip-eligible location filtering
- lifecycle mutations always precede timeline projection for the ping
- pass an **`activeTripsByVesselAbbrev`** map built from the mutation’s **`activeTripsForChanged`** (not a full-table snapshot); the trip branch does not call public `getActiveTrips`

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

**Ping-level failures** (empty identity tables, WSF fetch/conversion failures, snapshot load, location stage before the per-vessel loop, or any throw outside the per-vessel `try` / `catch`) are logged and **rethrown**, so the rest of that ping does not run. **Per-vessel failures** inside the loop are logged and **do not** abort other vessels (intentional blast-radius limiting).

### 2. Vessel Location Storage (`vesselLocation/`)

Purpose:

- store one current vessel-location record per vessel
- keep the optional canonical trip `Key` alongside live vessel state when it is safely derivable from the feed

Normalized feed locations are written via **`bulkUpsertVesselLocations`** (reads `vesselLocations`, matches by **`VesselAbbrev`**, skips when `TimeStamp` is unchanged, then replace/insert, then reads **`activeVesselTrips`** for changed abbrevs); the mutation returns **`changedLocations`** and **`activeTripsForChanged`** for downstream trip compute.

This table can therefore contain both:

- canonical passenger-terminal locations
- non-passenger marine locations reported by WSF, when needed to keep live vessel state visible

### 3. Trip Lifecycle (`vesselTrips/mutations.ts`)

Purpose:

- maintain `activeVesselTrips` and `completedVesselTrips` for lifecycle state
- orchestrator persistence consumes sparse **`VesselTripUpdate`** rows (**`existingActiveTrip`**, **`activeVesselTripUpdate`**, **`completedVesselTripUpdate`**); downstream domain stages derive prediction inputs and timeline handoffs from that shape

Trip lifecycle stays prediction-free at compute time. **`updateVesselTrip`** emits only substantive row changes. Predictions and timeline consume **`VesselTripUpdate`** in domain code (**`predictionInputsFromTripUpdate`**, **`timelineHandoffFromTripUpdate`**); pipeline-stage persistence then applies durable writes in explicit per-unit order.

The active-trip lifecycle now follows the vessel's physical state more directly:

- `at-dock`
- `at-sea`

Trip-row `AtDock` now uses the stabilized location-phase signal
`AtDockObserved` (not raw WSF `AtDock`) so lifecycle and prediction phase
routing share the same observed contract.

When a vessel arrives at dock, the previous trip completes immediately and the next trip starts immediately. If the live feed lags on next-trip fields such as `ScheduledDeparture` or `ArrivingTerminalAbbrev`, the trip pipeline infers the next trip deterministically from the scheduled-trip backbone instead of holding the vessel in a separate waiting state.

Those provisional trip fields are observable, but not warnings by default. The trip pipeline logs only meaningful transitions: when schedule evidence starts or updates provisional trip fields, when partial WSF values conflict with the inferred result, and when authoritative WSF trip fields replace prior values. It intentionally does not log every benign reuse of unchanged provisional trip fields.

Trip processing remains intentionally stricter than vessel-location storage: only rows that resolve to passenger terminals participate in trip derivation.

At the orchestrator boundary, trip-stage failures are logged per vessel without aborting the rest of the fleet ping (the **`try` / `catch`** around each vessel in **`runOrchestratorPing`**).

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
  -> getOrchestratorIdentities (vessels + terminals for normalization)
  -> fetch vessel locations once via adapters
  -> normalize locations in domain/updateVesselLocations
  -> bulkUpsertVesselLocations (locations dedupe/write + active trips for changed abbrevs in same mutation)
  -> updateVesselTrip (domain; VesselTripUpdate | null)
  -> loadPredictionContext + updateVesselPredictions (action query + domain ML + proposals + mlTimelineOverlays)
  -> updateTimeline (domain projection to actualEvents / predictedEvents)
  -> persistVesselUpdates (atomic trip + predictions + timeline + optional actualization)
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

Runs are **sequentially ordered**, but failure boundaries differ by stage:

- **Shared stages** (identities snapshot, WSF fetch + normalization, `bulkUpsertVesselLocations`, and anything else outside the per-vessel loop): on failure the handler logs and **rethrows**; the remainder of that ping is skipped.
- **Per-vessel pipeline** (`updateVesselTrip` through `persistVesselUpdates`): failures are caught **per vessel**, logged, and processing **continues** for the other changed vessels in the same ping. This limits blast radius when one branch misbehaves.

Within **`bulkUpsertVesselLocations`**, a write failure for one vessel is logged and remaining rows in that batch still attempt.

Same-ping ML overlays are merged in domain **`updateTimeline`** with the handoff derived from **`VesselTripUpdate`** before `persistVesselUpdates` applies durable rows; the public timeline query does not depend on `vesselLocations` reads.

## Performance Characteristics

The orchestrator keeps external API usage efficient:

- one WSF vessel-location fetch per ping
- one internal query per ping for **vessels + terminals only** (`getOrchestratorIdentities` in `queries.ts`); additional `runQuery` calls still apply for schedule continuity and optional prediction preload per vessel
- one locations mutation (`bulkUpsertVesselLocations`) that returns changed rows and **`activeTripsForChanged`** (no separate active-trip query)
- one converted location batch for write payload; trip compute consumes the mutation-returned changed subset

Trip compute, predictions, and timeline projection run in the action’s per-vessel loop before the aggregate `persistVesselUpdates` call; mutation handlers remain write-only apply steps.

At current fleet size (~21 vessels), this sequential loop is not a practical bottleneck.

Current hot-path implementation notes:

- `updateVesselLocations` now keeps a short-lived in-memory cache of existing
  location rows for `AtDockObserved` continuity and falls back to DB reads when
  the cache is empty or stale.
- Trip persistence gating uses deterministic key-by-key storage comparison in
  `isUpdatedTrip` (ignoring `TimeStamp`), which avoids false writes
  from object key-order differences.

### Schedule access rule (do not add parallel seams)

Trip-field and continuity code must depend only on **`UpdateVesselTripDbAccess`**:

- **Production:** `actions/ping/updateVesselTrip/updateVesselTripDbAccess.ts` — key-first internal queries for `NextScheduleKey` continuity and rollover fallback.
- **Tests:** fakes and fixtures live under `domain/vesselOrchestration/updateVesselTrip/schedule/activeTripSchedule/tests/` and `domain/vesselOrchestration/updateVesselTrip/tests/` (not a production schedule read path).

Do not introduce a second public “schedule provider” abstraction above this interface; evolve the key lookup or rollover fallback methods if new evidence shapes are needed.

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
- **Active trips:** the product invariant is at most one active trip row per vessel. Convex does not provide SQL-style `UNIQUE` constraints; writers and trip lifecycle code enforce this. **`bulkUpsertVesselLocations`** loads trips per changed abbrev (`.first()` on `by_vessel_abbrev`; see `schema.ts` comment on `activeVesselTrips`).

`vesselTimeline` event tables

- normalized persistence layer for `VesselTimeline`
- store ordered boundary events for one vessel/day
- feed the backend-owned backbone query
- are fed by schedule seeding plus trip-driven actual/predicted projection

## Core files

- `actions/updateVesselOrchestrator.ts` — `updateVesselOrchestrator`: Convex action entrypoint for one orchestrator ping.
- `actions/ping/runOrchestratorPing.ts` — pipeline stage sequencing and per-vessel isolation.
- `actions/ping/updateVesselLocations/` — location update stage (fetch, normalize, augment with `AtDockObserved`, persist via `bulkUpsertVesselLocations`, return changed rows + active trips map).
- `actions/ping/updateVesselTrip/updateVesselTripDbAccess.ts` — scheduled-events DB access used by trip stage continuity.
- `actions/ping/loadSnapshot/index.ts` — **`loadOrchestratorSnapshot`** identity read model for one ping (vessels + terminals).
- `actions/ping/updateVesselPredictions/index.ts` — **`loadPredictionContext`**: Convex query for **`getProductionModelParametersForPing`** when domain preload requests are non-empty.
- `domain/vesselOrchestration/updateVesselTrip/` — **`updateVesselTrip`**, **`VesselTripUpdate`**.
- `domain/vesselOrchestration/updateVesselPredictions/` — **`updateVesselPredictions`**, **`predictionInputsFromTripUpdate`**, **`predictionModelLoadRequestForTripUpdate`**.
- `domain/vesselOrchestration/updateTimeline/` — **`updateTimeline`**, **`timelineHandoffFromTripUpdate`**.
- `queries/orchestratorSnapshotQueries.ts` — **`getOrchestratorIdentities`** (vessels + terminals).
- `mutations/orchestratorPersistMutations.ts` — aggregate per-vessel persistence boundary (`persistVesselUpdates`).

## Tests

Under `tests/`: location-stage coverage (`updateVesselLocations.test.ts`), domain policy helpers (`tripStagePolicy.test.ts`, `predictionStagePolicy.test.ts`), persistence (`persistVesselUpdates.test.ts`), and **`orchestratorPing.integration.test.ts`** (mocked domain branches wiring location writes + aggregate per-vessel persists with per-vessel failure isolation).

Canonical vessel and terminal table refreshes from WSF basics are implemented in `convex/functions/vessels/actions.ts` (`syncBackendVessels` internal action, `runSyncBackendVessels` public action, `syncBackendVesselTable` helper) and `convex/functions/terminals/actions.ts` (`syncBackendTerminals`, `runSyncBackendTerminals`, `syncBackendTerminalTable`). Hourly cron entries for those internal actions live in `convex/crons.ts`.

## Related Documentation

- `convex/domain/vesselOrchestration/architecture.md` — orchestrator ping, four concerns, glossary, and canonical `Timestamp semantics (current code)` contract
- `convex/functions/vesselOrchestrator/VesselOrchestratorPipeline.md` — single-ping stage inputs/outputs and runtime invariants for the orchestrator hot path
- `convex/functions/vesselTrips/README.md`
- `convex/functions/scheduledTrips/README.md`
- `docs/IDENTITY_AND_TOPOLOGY_ARCHITECTURE.md`
- `src/features/VesselTimeline/docs/ARCHITECTURE.md`

## Summary

`updateVesselOrchestrator` uses one WSF batch per ping, then **`runOrchestratorPing`** in `actions/ping/runOrchestratorPing.ts`: locations are written through standalone `bulkUpsertVesselLocations`, and each changed vessel runs **`updateVesselTrip`** → **`updateLeaveDockEventPatch`** → **`loadPredictionContext`** → **`updateVesselPredictions`** → **`updateTimeline`** → **`persistVesselUpdates`**.
