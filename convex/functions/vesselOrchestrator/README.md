# VesselOrchestrator - Real-Time Ferry Coordination

The `VesselOrchestrator` is the top-level coordination layer for real-time
vessel processing. It fetches vessel locations from WSF once, converts that
payload into the Convex location shape, and then fans the same location batch
out to multiple backend consumers.

## System Overview

The orchestrator runs periodically, roughly every 5 seconds, and coordinates
two separate downstream branches:

1. store the latest vessel locations
2. update trip lifecycle state via `vesselTrips/updates` (domain implementation
   in `convex/domain/vesselTrips/`), then apply timeline overlay writes
   (`applyTickEventWrites`) for `VesselTimeline`

This keeps the expensive external vessel-location fetch centralized while
allowing each downstream subsystem to evolve independently.

```text
WSF VesselLocations API
  -> VesselOrchestrator fetch + conversion
  -> vesselLocations table
  -> vesselTrips/updates
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
- load backend vessel rows, terminal rows, and **storage-native** `activeVesselTrips`
  in **one** internal query per tick (`getOrchestratorTickReadModelInternal` in
  `queries.ts` — no `eventsPredicted` join; public `getActiveTrips` still hydrates
  for API subscribers), with identity-table bootstrap via `syncBackendVesselTable` /
  `syncBackendTerminalTable` when either snapshot is empty
- convert raw WSF payloads into `ConvexVesselLocation`, including
  resolved vessel identity, canonical optional `Key`, and
  terminal-or-marine-location fields derived from the backend `terminals`
  table
- capture one tick timestamp shared by downstream consumers
- execute two downstream branches in parallel with error isolation
- pass the same tick’s active-trip list into `processVesselTrips` so the trip
  branch does not run a separate `getActiveTrips` query
- compute `shouldRunPredictionFallback` once per tick via
  `tickPredictionPolicy.computeShouldRunPredictionFallback` and pass it into
  `processVesselTrips` options
- after `processVesselTrips` returns, call `applyTickEventWrites` with
  `tripResult.tickEventWrites` (lifecycle mutations always precede timeline mutations)

Transformation pipeline:

```text
WSF VesselLocation
  -> toConvexVesselLocation(raw, vessels, terminals)
  -> ConvexVesselLocation[]
```

Notes:

- the backend `terminals` table remains the canonical lookup for passenger
  terminals
- it also contains a small number of known non-passenger marine locations used
  by the WSF vessel feed, such as `EAH` and `VIG`
- unknown future marine-location abbreviations are preserved for vessel-location
  continuity instead of failing ingestion
- only passenger-terminal locations are forwarded into trip processing
- passenger-terminal trip eligibility is intentionally simple set membership on
  departing and optional arriving terminal abbreviations

The orchestrator returns branch-level success flags:

```ts
  {
    locationsSuccess: boolean;
    tripsSuccess: boolean;
    errors?: {
      fetch?: { message: string; stack?: string };
      locations?: { message: string; stack?: string };
      trips?: { message: string; stack?: string };
    };
  }
```

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

### 3. Trip Lifecycle Updates (`vesselTrips/updates/`)

Purpose:

- maintain `activeVesselTrips` and `completedVesselTrips` for lifecycle state;
  ML boundary predictions live in `eventsPredicted`. The orchestrator passes
  **storage-native** active trips into `processVesselTrips` (joined predictions are
  not required for lifecycle strip/compare; overlay assembly uses normalized
  prediction fields from the built trip vs existing when present). Public queries
  still **hydrate** trips for API parity. Post-upsert depart-next backfill writes
  **actuals** onto the prior leg’s `eventsPredicted` rows, not onto stored trip
  rows. Timeline table mutations run in `applyTickEventWrites` after lifecycle
  completes for the tick.

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
first). Trip-shaped queries still expose `Eta` plus ML-hydrated fields separately.
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
  -> fetch vessel locations once
  -> convert locations
  -> fan out in parallel:
       branch 1: vesselLocations bulkUpsert
       branch 2: processVesselTrips -> applyTickEventWrites(tickEventWrites)
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

## Error Isolation

The orchestrator isolates failures at the branch level.

- fetch/conversion failure stops the tick because nothing downstream can run
- location storage failure does not block trip updates
- trip update failure does not block location storage
- the two downstream branches run concurrently via `Promise.allSettled`, while
  preserving branch-specific success flags and error reporting

This matters because timeline overlays are applied after the trip pipeline’s
lifecycle mutations (`applyTickEventWrites`), instead of re-deriving actuals
from raw location ticks alone, and the public timeline query no longer depends on
`vesselLocations` reads.

## Performance Characteristics

The orchestrator keeps external API usage efficient:

- one WSF vessel-location fetch per tick
- one internal query per tick for vessels, terminals, and active trips (see
  `queries.ts`), instead of three separate `runQuery` round trips from the
  action
- one converted location batch reused by all downstream consumers
- one conversion pass over the fetched payload before downstream fan-out
- concurrent downstream execution instead of serial branch processing

Within `processVesselTrips`, per-vessel trip build/enrichment work is also
parallelized before persistence, while database writes remain batched where
possible (`upsertVesselTripsBatch`). `applyTickEventWrites` applies batched
timeline mutations from the returned `tickEventWrites`.

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

- `actions.ts` — `updateVesselOrchestrator`, `processVesselTrips` +
  `applyTickEventWrites`, passenger-terminal gating helpers
- `applyTickEventWrites.ts` — runs `projectActualBoundaryPatches` /
  `projectPredictedBoundaryEffects` from `tickEventWrites`
- `queries.ts` — `getOrchestratorTickReadModelInternal` (bundled DB read for one tick)

Canonical vessel and terminal table refreshes from WSF basics are implemented in
`convex/functions/vessels/actions.ts` (`syncBackendVessels` internal action,
`runSyncBackendVessels` public action, `syncBackendVesselTable` helper) and
`convex/functions/terminals/actions.ts` (`syncBackendTerminals`,
`runSyncBackendTerminals`, `syncBackendTerminalTable`). Hourly cron entries for
those internal actions live in `convex/crons.ts`.

## Related Documentation

- `convex/functions/vesselTrips/updates/README.md`
- `convex/functions/scheduledTrips/sync/README.md`
- `docs/IDENTITY_AND_TOPOLOGY_ARCHITECTURE.md`
- `src/features/VesselTimeline/docs/ARCHITECTURE.md`

## Summary

The current orchestrator coordinates one shared vessel-location fetch across
two backend consumers:

1. `vesselLocations` for current live state
2. `vesselTrips/updates` for trip lifecycle management, then `applyTickEventWrites`
   for timeline overlays

That split keeps the timeline contract simple without removing the richer trip
pipeline that other parts of the system still depend on.
