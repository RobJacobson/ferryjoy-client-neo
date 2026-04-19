# VesselOrchestrator - Real-Time Ferry Coordination

The `VesselOrchestrator` is the top-level coordination layer for real-time
vessel processing. It fetches vessel locations from WSF once, converts that
payload into the Convex location shape, and then fans the same location batch
out to multiple backend consumers.

The orchestrator follows the backend layering rule:

```text
convex/functions -> convex/adapters -> convex/domain -> convex/functions/persistence
```

In this module, `actions.ts` is the Convex-facing shell (`updateVesselOrchestrator`):
it loads the read model, records one **`tickStartedAt`** (shared by trips, predictions,
and timeline), runs one WSF fetch, **`vesselLocation.mutations.bulkUpsert`**
(live snapshot), **`getScheduleSnapshotForTick`** (bounded schedule snapshot), then
**`updateVesselTrips`**, **`updateVesselPredictions`**, and **`updateVesselTimeline`**
in sequence. [`utils.ts`](./utils.ts) supplies trip mutation ports and prediction
model access—**not** a separate “phases” runner. Raw vessel locations are fetched through
`convex/adapters/fetch/fetchWsfVesselLocations.ts`, translated into
`ConvexVesselLocation`, and then passed into domain orchestration plus Convex
mutations.

### O1 pipeline structure (named steps)

Phase **O1** ([handoff](../../../docs/handoffs/vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md))
named these sequential steps in **`actions.ts`** without changing mutation order:

1. **`vesselLocation` bulk upsert** — runs **first** in `actions.ts` (live `vesselLocations`
   snapshot for this tick).
2. **`updateVesselTrips`** — `computeVesselTripsWithClock` → function-layer `persistVesselTripWriteSet`
   (trip compute uses **`buildTripCore` only**).
3. **`updateVesselPredictions`** — `runUpdateVesselPredictions`
   (`updateVesselPredictions` domain module), then `batchUpsertProposals` into `vesselTripPredictions` when non-empty.
4. **`updateVesselTimeline`** — `buildOrchestratorTimelineProjectionInput` then
   projection mutations for `eventsActual` / `eventsPredicted`.

The handler in `actions.ts` chains these steps; each step either calls domain
helpers and/or `ctx.runMutation` with the payloads produced for that phase.

### O5 — Timeline consumer contract (cleanup)

Phase **O5** ([handoff](../../../docs/handoffs/vessel-orchestrator-o5-timeline-and-cleanup-handoff-2026-04-18.md))
documents that `buildOrchestratorTimelineProjectionInput` must receive
`TripLifecycleApplyOutcome` **after** `updateVesselPredictions` (ML merged in
memory for the same tick; timeline does not assemble from `vesselTripPredictions` DB
reads). Implementation plan: [`.cursor/plans/o5_timeline_cleanup_11ff7b1c.plan.md`](../../../.cursor/plans/o5_timeline_cleanup_11ff7b1c.plan.md).

## System Overview

The orchestrator runs periodically, roughly every 15 seconds. **`updateVesselOrchestrator`**
runs **sequentially**: after one shared WSF batch and trip dependency wiring, it
persists **locations first**, then applies trip lifecycle writes, then predictions,
then timeline rows. This keeps the expensive external fetch centralized while the
domain trip pipeline (`processVesselTrips` via `computeVesselTripsWithClock`) and
timeline assembly stay explicit.

### Operational concerns (Phase 1)

Naming matches [`architecture.md`](../../domain/vesselOrchestration/architecture.md):

- **Live `vesselLocations`** — `bulkUpsert` in **`actions.ts`** (first step each tick).
- **updateVesselTrips** — `computeVesselTripsWithClock`, then function-layer `persistVesselTripWriteSet` applies the trip write set.
- **updateVesselPredictions** — `runUpdateVesselPredictions` from **`domain/vesselOrchestration/updateVesselPredictions`** + `batchUpsertProposals` when needed, after trips and before timeline.
- **updateTimeline** — `buildOrchestratorTimelineProjectionInput` / `runUpdateVesselTimeline` from **`domain/vesselOrchestration/updateTimeline`** plus `eventsActual` / `eventsPredicted` writes (mutations from **`actions.ts`**).

```text
WSF VesselLocations API
  -> adapters/fetch/fetchWsfVesselLocations
  -> functions/vesselOrchestrator/actions.ts (bulkUpsert -> trips -> predictions -> timeline)
  -> vesselLocations / vesselTrips / vesselTripPredictions / eventsActual / eventsPredicted
```

## Why The Timeline Event Tables Exist

`VesselTimeline` used to depend on a more convoluted frontend data pipeline that
merged scheduled trips, active trips, completed trips, and current vessel
location state in the browser.

The normalized `vesselTimeline` event tables exist to simplify that contract.

Its purpose is:

- provide the normalized persistence layer for timeline structure and overlays
- separate timeline rendering needs from the heavier trip lifecycle tables
- keep reconciliation and source-priority logic on the backend
- support a small backbone query instead of exposing raw event tables directly
  or rebuilding structure from live vessel ticks on the client

The timeline event tables are not intended to replace `activeVesselTrips` or
`completedVesselTrips`. Those tables still support trip lifecycle logic and
other features. `eventsScheduled`, `eventsActual`, and `eventsPredicted` are a
purpose-built read model for `VesselTimeline`.

## Architecture Components

### 1. Orchestrator Action (`actions.ts`)

Main entrypoint:

- `updateVesselOrchestrator`

Responsibilities:

- fetch vessel locations from WSF
- do that external fetch through `convex/adapters/fetch/fetchWsfVesselLocations.ts`
- load backend vessel rows, terminal rows, and **storage-native** `activeVesselTrips`
  in **one** internal query per tick (`getOrchestratorModelData` in
  `queries.ts` — no `eventsPredicted` join; public `getActiveTrips` still enriches
  for API subscribers); soft-fail when identity tables are empty (seed / hourly
  identity crons)
- **fetch:** `fetchWsfVesselLocations` skips individual bad feed rows (`console.warn`
  per skip) and continues with the rest; if **every** row fails conversion, the fetch
  throws and the tick reports a fetch error
- convert raw WSF payloads into `ConvexVesselLocation`, including
  resolved vessel identity, canonical optional `Key`, and
  terminal-or-marine-location fields derived from the backend `terminalsIdentity`
  table
- after locations: **`buildScheduleSnapshotQueryArgs`** + **`getScheduleSnapshotForTick`**, then **`createDefaultProcessVesselTripsDeps(createScheduledSegmentLookupFromSnapshot(snapshot))`** once, shared by trips and predictions; **`createVesselTripPredictionModelAccess`**
  for the predictions phase only; then `updateVesselTrips` → `updateVesselPredictions` → `updateVesselTimeline`

Domain pipeline (same tick semantics as before):

- passenger-terminal allow-list and trip-eligible location filtering
- `computeShouldRunPredictionFallback(tickStartedAt)` (from `domain/vesselOrchestration/updateVesselTrips`)
  applied inside the domain orchestrator when building `processVesselTrips` options
- lifecycle mutations always precede timeline projection for the tick
- pass the same tick’s active-trip list into `computeVesselTripsWithClock` so the trip
  branch does not run a separate `getActiveTrips` query

Transformation pipeline:

```text
WSF VesselLocation
  -> adapters/fetch/fetchWsfVesselLocations()
  -> actions.ts
  -> toConvexVesselLocation(raw, vessels, terminals)
  -> ConvexVesselLocation[]
```

Notes:

- the backend `terminalsIdentity` table remains the canonical lookup for passenger
  terminals
- it also contains a small number of known non-passenger marine locations used
  by the WSF vessel feed, such as `EAH` and `VIG`
- unknown future marine-location abbreviations are preserved for vessel-location
  continuity instead of failing ingestion
- only passenger-terminal locations are forwarded into trip processing
- passenger-terminal trip eligibility is intentionally simple set membership on
  departing and optional arriving terminal abbreviations

On failure, `updateVesselOrchestrator` logs and **rethrows** (the handler returns `void`).

### 2. Vessel Location Storage (`vesselLocation/`)

Purpose:

- store one current vessel-location record per vessel
- keep the optional canonical trip `Key` alongside live vessel state when it is
  safely derivable from the feed

The orchestrator passes the full converted location batch to the
`bulkUpsert` mutation, which atomically inserts or replaces the current
`vesselLocations` rows.

This table can therefore contain both:

- canonical passenger-terminal locations
- non-passenger marine locations reported by WSF, when needed to keep live
  vessel state visible

### 3. Trip Lifecycle (`vesselTrips/actions.ts`)

Purpose:

- maintain `activeVesselTrips` and `completedVesselTrips` for lifecycle state;
  ML boundary predictions live in `eventsPredicted`. The orchestrator passes
  **storage-native** active trips into `processVesselTrips` (joined predictions are
  not required for lifecycle strip/compare; overlay assembly uses normalized
  prediction fields from the built trip vs existing when present). Public queries
  still **enrich** trips with predictions for API parity. Post-upsert depart-next backfill writes
  **actuals** onto the prior leg’s `eventsPredicted` rows, not onto stored trip
  rows. Timeline projection runs in **`updateVesselTimeline`** (`vesselOrchestratorConvexBindings.ts`)
  after trip apply for the tick.

This remains the richer state machine responsible for trip lifecycle tracking,
ML inference (in memory, then projected), and event-driven trip transitions. Inside that module, event
detection and base-trip construction now share one normalized derivation layer
so carry-forward fields, `Key`, and `SailingDay` stay consistent across the
pipeline.

The active-trip lifecycle now follows the vessel's physical state more directly:

- `at-dock`
- `at-sea`

When a vessel arrives at dock, the previous trip completes immediately and the
next trip starts immediately. If the live feed lags on next-trip fields such as
`ScheduledDeparture` or `ArrivingTerminalAbbrev`, the trip pipeline infers the
next trip deterministically from the scheduled-trip backbone instead of holding
the vessel in a separate waiting state.

Trip processing remains intentionally stricter than vessel-location storage:
only rows that resolve to passenger terminals participate in trip derivation.

### 4. Timeline Projection (`vesselTimeline/`)

Purpose:

- maintain the normalized boundary-event persistence layer used to build the
  public `VesselTimeline` backbone

This remains intentionally smaller than the trip lifecycle pipeline. It stores
only the boundary fields needed to derive a day timeline:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `EventType`
- `EventScheduledTime?`
- `EventPredictedTime?`
- `EventActualTime?`

Those normalized rows are not the public query contract anymore. The backend
now builds one ordered same-day event list for the timeline backbone. When more
than one `eventsPredicted` row shares the same boundary `Key` (e.g. WSF ETA vs ML),
`mergeTimelineRows` picks a single backbone `EventPredictedTime` (WSF ETA row
first). Trip-shaped queries still expose `Eta` plus prediction-enriched fields separately.
The client derives `activeInterval` from that backbone and combines it with its
existing real-time `VesselLocation` subscription for indicator placement.

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
  -> convert locations in functions
  -> updateVesselTrips (compute -> bulkUpsert locations -> apply trips)
  -> updateVesselPredictions (ML merge + prediction table upserts)
  -> updateVesselTimeline (build projection input -> eventsActual / eventsPredicted)
```

### Timeline feed flow

```text
WSF schedule sync
  -> classify direct physical segments
  -> seed eventsScheduled skeleton

WSF vessel location ticks
  -> VesselOrchestrator
  -> update trip lifecycle state
  -> project actual/predicted event updates

Frontend VesselTimeline
  -> query backend-owned VesselTimeline backbone
  -> derive active interval locally from ordered events
  -> combine with live VesselLocation for indicator placement
```

## Error isolation

`updateVesselOrchestrator` runs **sequentially**. A failure in any step aborts the
rest of the tick (after logging). Fetch/conversion failure stops the tick first.

Timeline overlays are applied **after** trip lifecycle mutations for the tick
(`updateVesselTimeline`), instead of re-deriving actuals from raw location ticks
alone; the public timeline query does not depend on `vesselLocations` reads.

## Performance Characteristics

The orchestrator keeps external API usage efficient:

- one WSF vessel-location fetch per tick
- one internal query per tick for vessels, terminals, and active trips (see
  `queries.ts`), instead of three separate `runQuery` round trips from the
  action
- one converted location batch reused for trip compute and location upsert

Within `processVesselTrips`, per-vessel trip build/enrichment work is also
parallelized before persistence, while database writes remain batched where
possible (`upsertVesselTripsBatch`). `updateVesselTimeline` applies batched
timeline mutations from `buildTimelineTickProjectionInput`.

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
- may include non-passenger marine locations when the WSF vessel feed reports
  them

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

- `actions.ts` — `updateVesselOrchestrator`: read model, WSF fetch, location bulk upsert, schedule snapshot query, shared trip deps, then `updateVesselTrips` / `updateVesselPredictions` / `updateVesselTimeline`.
- `persistVesselTripWriteSet.ts` — function-layer trip-table mutation apply step for completed handoffs, active upserts, and leave-dock follow-ups.
- `utils.ts` — `createVesselOrchestratorConvexBindings` (**`createVesselTripTableMutations`**, **`createVesselTripPredictionModelAccess`**); schedule data comes from **`getScheduleSnapshotForTick`** in `queries.ts`, not from this module.
- `runUpdateVesselPredictions` (domain `updateVesselPredictions`) — prediction proposals + ML overlay; **`updateVesselPredictions`** persists proposals then returns `mlFull` for timeline.
- `queries.ts` — `getOrchestratorModelData` (bundled DB read for one tick); **`getScheduleSnapshotForTick`** (bounded `eventsScheduled` snapshot for trip deps).
- `schemas.ts` — orchestrator-related schemas.

## Tests

Trip sequencing (location upsert → plan/apply → predictions → timeline) for this module is
covered in [`tests/processVesselTrips.tick.test.ts`](./tests/processVesselTrips.tick.test.ts).

Canonical vessel and terminal table refreshes from WSF basics are implemented in
`convex/functions/vessels/actions.ts` (`syncBackendVessels` internal action,
`runSyncBackendVessels` public action, `syncBackendVesselTable` helper) and
`convex/functions/terminals/actions.ts` (`syncBackendTerminals`,
`runSyncBackendTerminals`, `syncBackendTerminalTable`). Hourly cron entries for
those internal actions live in `convex/crons.ts`.

## Related Documentation

- `convex/domain/vesselOrchestration/architecture.md` — orchestrator tick, four concerns, glossary
- `convex/functions/vesselTrips/README.md`
- `convex/functions/scheduledTrips/README.md`
- `docs/IDENTITY_AND_TOPOLOGY_ARCHITECTURE.md`
- `src/features/VesselTimeline/docs/ARCHITECTURE.md`

## Summary

`updateVesselOrchestrator` uses one WSF batch per tick, then runs **named pipeline
steps** in `vesselOrchestratorConvexBindings.ts`: trip compute and apply (with location upsert
between plan and apply), **updateVesselPredictions** (ML + `vesselTripPredictions`),
and timeline projection onto `eventsActual` / `eventsPredicted`.
