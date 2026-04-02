# VesselOrchestrator - Real-Time Ferry Coordination

The `VesselOrchestrator` is the top-level coordination layer for real-time
vessel processing. It fetches vessel locations from WSF once, converts that
payload into the Convex location shape, and then fans the same location batch
out to multiple backend consumers.

## System Overview

The orchestrator runs periodically, roughly every 5 seconds, and coordinates
two separate downstream branches:

1. store the latest vessel locations
2. update trip lifecycle state in `vesselTrips/updates`, which also projects the
   timeline overlays consumed by `VesselTimeline`

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
- support a backend-built row/view-model query instead of exposing raw event
  tables as the public timeline contract

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
- load backend vessel/terminal identity snapshots once per tick
- convert raw WSF payloads into `ResolvedVesselLocation`, including
  resolved vessel identity, canonical optional `Key`, and
  terminal-or-marine-location fields derived from the backend `terminals`
  table
- capture one tick timestamp shared by downstream consumers
- execute two downstream branches in parallel with error isolation

Transformation pipeline:

```text
WSF VesselLocation
  -> toConvexVesselLocation(raw, vessels, terminals)
  -> ResolvedVesselLocation[]
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

- maintain `activeVesselTrips`, `completedVesselTrips`, and their prediction
  lifecycle

This remains the richer state machine responsible for trip lifecycle tracking,
ML predictions, and event-driven trip transitions. Inside that module, event
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
  public `VesselTimeline` view model

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
now builds:

- stable `at-dock` / `at-sea` rows keyed by trip identity
- backend-owned `activeRowId`
- compact active-indicator hints

Detailed `VesselTimeline` backend architecture now lives in:

- `convex/domain/vesselTimeline/README.md`

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
       branch 2: processVesselTrips
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
  -> query backend-owned VesselTimeline view model
  -> render backend-owned rows
```

## Error Isolation

The orchestrator isolates failures at the branch level.

- fetch/conversion failure stops the tick because nothing downstream can run
- location storage failure does not block trip updates
- trip update failure does not block location storage
- the two downstream branches run concurrently via `Promise.allSettled`, while
  preserving branch-specific success flags and error reporting

This matters because timeline projection now rides on the trip pipeline’s
transition logic instead of re-deriving actuals from raw location ticks, and
the public timeline query now trusts that backend-owned model directly.

## Performance Characteristics

The orchestrator keeps external API usage efficient:

- one WSF vessel-location fetch per tick
- one backend vessel snapshot load per tick
- one backend terminal snapshot load per tick
- one converted location batch reused by all downstream consumers
- one conversion pass over the fetched payload before downstream fan-out
- concurrent downstream execution instead of serial branch processing

Within `processVesselTrips`, per-vessel trip build/enrichment work is also
parallelized before persistence, while database writes remain batched where
possible (`upsertVesselTripsBatch` and batched predicted-event sync).

The timeline projection path is designed to stay lightweight:

- no extra external fetches
- no frontend-side source merging in the target architecture
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
- feed the backend-owned row/view-model query
- are fed by schedule seeding plus trip-driven actual/predicted projection

## Related Documentation

- `convex/functions/vesselTrips/updates/README.md`
- `convex/functions/scheduledTrips/sync/README.md`
- `docs/IDENTITY_AND_TOPOLOGY_ARCHITECTURE.md`
- `src/features/VesselTimeline/docs/ARCHITECTURE.md`

## Summary

The current orchestrator coordinates one shared vessel-location fetch across
two backend consumers:

1. `vesselLocations` for current live state
2. `vesselTrips/updates` for full trip lifecycle management plus timeline
   projection

That split keeps the timeline contract simple without removing the richer trip
pipeline that other parts of the system still depend on.
