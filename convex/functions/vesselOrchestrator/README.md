# VesselOrchestrator - Real-Time Ferry Coordination

The `VesselOrchestrator` is the top-level coordination layer for real-time
vessel processing. It fetches vessel locations from WSF once, converts that
payload into the Convex location shape, and then fans the same location batch
out to multiple backend consumers.

## System Overview

The orchestrator runs periodically, roughly every 5 seconds, and coordinates
three separate downstream branches:

1. store the latest vessel locations
2. update trip lifecycle state in `vesselTrips/updates`
3. update `vesselTripEvents`, the minimal timeline event feed used by
   `VesselTimeline`

This keeps the expensive external vessel-location fetch centralized while
allowing each downstream subsystem to evolve independently.

```text
WSF VesselLocations API
  -> VesselOrchestrator fetch + conversion
  -> vesselLocations table
  -> vesselTrips/updates
  -> vesselTripEvents
```

## Why `vesselTripEvents` Exists

`VesselTimeline` used to depend on a more convoluted frontend data pipeline that
merged scheduled trips, active trips, completed trips, and current vessel
location state in the browser.

The new `vesselTripEvents` table exists to simplify that contract.

Its purpose is:

- provide one backend-owned vessel/day event feed for timeline rendering
- separate timeline rendering needs from the heavier trip lifecycle tables
- keep reconciliation and source-priority logic on the backend
- let the frontend render from a small ordered boundary list instead of merging
  multiple raw sources

`vesselTripEvents` is not intended to replace `activeVesselTrips` or
`completedVesselTrips`. Those tables still support trip lifecycle logic and
other features. `vesselTripEvents` is a purpose-built read model for
`VesselTimeline`.

## Architecture Components

### 1. Orchestrator Action (`actions.ts`)

Main entrypoint:

- `updateVesselOrchestrator`

Responsibilities:

- fetch vessel locations from WSF
- convert raw WSF payloads into `ConvexVesselLocation`
- enrich locations with distance-to-terminal fields
- execute three downstream branches with error isolation

Transformation pipeline:

```text
WSF VesselLocation
  -> toConvexVesselLocation()
  -> add DepartingDistance / ArrivingDistance
  -> convertConvexVesselLocation()
  -> ConvexVesselLocation[]
```

The orchestrator returns branch-level success flags:

```ts
{
  locationsSuccess: boolean;
  tripsSuccess: boolean;
  tripEventsSuccess: boolean;
  errors?: {
    fetch?: { message: string; stack?: string };
    locations?: { message: string; stack?: string };
    trips?: { message: string; stack?: string };
    tripEvents?: { message: string; stack?: string };
  };
}
```

### 2. Vessel Location Storage (`vesselLocation/`)

Purpose:

- store one current vessel-location record per vessel

The orchestrator passes the full converted location batch to the
`bulkUpsert` mutation, which atomically inserts or replaces the current
`vesselLocations` rows.

### 3. Trip Lifecycle Updates (`vesselTrips/updates/`)

Purpose:

- maintain `activeVesselTrips`, `completedVesselTrips`, and their prediction
  lifecycle

This remains the richer state machine responsible for trip lifecycle tracking,
ML predictions, and event-driven trip transitions.

### 4. Timeline Event Updates (`vesselTripEvents/`)

Purpose:

- maintain the minimal vessel/day boundary feed consumed by `VesselTimeline`

This is intentionally smaller than the trip lifecycle pipeline. It stores only
the fields needed to render a day timeline:

- `EventId`
- `VesselAbbrev`
- `SailingDay`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `EventType`
- `ScheduledTime?`
- `PredictedTime?`
- `ActualTime?`

## How `vesselTripEvents` Is Built

### Schedule seeding

The persistent event skeleton is seeded during scheduled-trip sync, not by the
orchestrator itself.

Upstream flow:

1. fetch raw WSF schedule data
2. classify direct vs indirect marketing trips
3. keep only direct physical segments for timeline seeding
4. generate two boundary events per direct segment

Per direct segment:

- departure event
  - `EventType = "dep-dock"`
  - `TerminalAbbrev = DepartingTerminalAbbrev`
  - `ScheduledTime = DepartingTime`
- arrival event
  - `EventType = "arv-dock"`
  - `TerminalAbbrev = ArrivingTerminalAbbrev`
  - `ScheduledTime = ArrivingTime ?? SchedArriveNext`

Stable identity:

- `EventId = VesselAbbrev + ScheduledDeparture + EventType`

That identity lets later live updates overwrite the same boundary row instead
of creating new timeline records.

### Live enrichment from the orchestrator

After the orchestrator fetches the current vessel-location batch, it now passes
that same batch into:

- `functions.vesselTripEvents.mutations.applyLiveUpdates`

This mutation resolves each location to one vessel/day scope and updates the
already-seeded event rows in place.

The event updater uses lightweight dock-boundary rules:

- strong departure:
  - `AtDock === false && Speed >= 0.2`
- strong arrival:
  - `AtDock === true && Speed < 0.2`

Update behavior:

- departure prediction
  - while at dock, the matching departure event may carry a
    `PredictedTime = ScheduledDeparture`
- arrival prediction
  - if `Eta` is present, the matching arrival event gets
    `PredictedTime = Eta`
  - later predictions overwrite older predictions on the same row
- departure actual
  - when strong departure evidence appears, set
    `ActualTime = LeftDock ?? TimeStamp`
- arrival actual
  - when strong arrival evidence appears, update the most recent unresolved
    arrival event for the current terminal
- false departure unwind
  - if the vessel quickly appears docked again at the same terminal before the
    paired arrival actualizes, clear the mistaken departure `ActualTime`

Precedence:

- `ActualTime` is best when present
- `PredictedTime` is mutable and may be overwritten
- `ScheduledTime` is the fallback baseline

## Data Flow

### Orchestrator runtime flow

```text
WSF API
  -> fetch vessel locations once
  -> convert and enrich locations
  -> branch 1: vesselLocations bulkUpsert
  -> branch 2: runUpdateVesselTrips
  -> branch 3: vesselTripEvents.applyLiveUpdates
```

### Timeline feed flow

```text
WSF schedule sync
  -> classify direct physical segments
  -> seed vesselTripEvents skeleton

WSF vessel location ticks
  -> VesselOrchestrator
  -> apply predicted/actual event updates

Frontend VesselTimeline
  -> query vesselTripEvents for vessel/day
  -> build dock/sea rows from ordered events
```

## Error Isolation

The orchestrator isolates failures at the branch level.

- fetch/conversion failure stops the tick because nothing downstream can run
- location storage failure does not block trip updates
- trip update failure does not block location storage
- trip event update failure does not block the other two branches

This matters because `vesselTripEvents` is intentionally parallel to the
existing trip pipeline, not embedded inside it.

## Performance Characteristics

The orchestrator keeps external API usage efficient:

- one WSF vessel-location fetch per tick
- one converted location batch reused by all downstream consumers

The new `vesselTripEvents` branch is designed to stay lightweight:

- no extra external fetches
- no frontend-side source merging
- updates are keyed to stable event identities
- unchanged event rows are not rewritten

## Relationship To Other Tables

`vesselLocations`

- current snapshot of live vessel state
- used directly by the UI for current indicator state and warnings

`activeVesselTrips` / `completedVesselTrips`

- richer trip lifecycle models
- support trip state tracking, predictions, and other operational features

`vesselTripEvents`

- minimal read model for `VesselTimeline`
- stores ordered boundary events for one vessel/day
- fed by schedule seeding plus live vessel-location enrichment

## Related Documentation

- `convex/functions/vesselTrips/updates/README.md`
- `convex/domain/scheduledTrips/README.md`
- `src/features/VesselTimeline/ARCHITECTURE.md`

## Summary

The current orchestrator coordinates one shared vessel-location fetch across
three backend consumers:

1. `vesselLocations` for current live state
2. `vesselTrips/updates` for full trip lifecycle management
3. `vesselTripEvents` for the minimal vessel/day timeline feed

That split keeps the timeline contract simple without removing the richer trip
pipeline that other parts of the system still depend on.
