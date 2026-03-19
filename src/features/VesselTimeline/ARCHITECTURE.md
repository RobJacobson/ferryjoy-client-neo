# VesselTimeline Architecture

This document describes the current architecture for the `VesselTimeline`
feature.

`VesselTimeline` renders one continuous day timeline for one vessel on one
requested sailing day. The feature is event-based: the backend assembles a
minimal ordered list of dock events, and the frontend converts adjacent event
pairs into dock and sea rows for display.

## Scope

Public API:

```ts
type VesselTimelineProps = {
  vesselAbbrev: string;
  sailingDay: string;
  routeAbbrevs: string[];
  now?: Date;
};
```

Notes:

- `vesselAbbrev` and `sailingDay` define the vessel/day scope.
- `routeAbbrevs` remains part of the feature API for flexibility, but the
  underlying data model is vessel-centric.
- `now` is optional and mainly supports deterministic rendering and tests.

## Product Decisions

### Timeline window

The visible timeline is a service-day timeline, not a literal 3:00 AM to
2:59 AM berth-occupancy timeline.

- Start at the vessel's first scheduled departure for the requested sailing
  day.
- End at the vessel's last scheduled arrival for the requested sailing day.
- Overnight pre-service and post-service berth occupancy are not rendered as
  full proportional dock periods.

### Sailing-day boundary

The upstream day cutoff remains:

- `4:00 AM` local time to decide "yesterday" vs "today"

### Single-vessel v1

Version 1 remains scoped to one vessel at a time.

### Minimal backend contract

The backend owns reconciliation and returns only the minimum event data needed
 to render the timeline.

- The frontend does not merge `ScheduledTrip`, `ActiveVesselTrip`, and
  `CompletedVesselTrip` records anymore.
- The frontend receives a sorted array of vessel/day events.
- The frontend still owns row construction, dock/sea segmentation, compression,
  indicator behavior, and visual rendering.

### Long dock periods

Long dock periods are still represented as real dock spans, but they are
compressed in the UI.

- dock segment `< 60 min`: render proportionally
- dock segment `>= 60 min`: render as a compressed break row

Compressed break row layout:

- visible arrival stub: `10 min`
- break marker: explicit visual discontinuity
- visible departure window: `50 min`

### Off-schedule / out-of-service behavior

The scheduled/event timeline remains visible even if the vessel is no longer
following the expected path.

Primary signals:

- `VesselLocation.InService === false`
- live vessel state no longer aligns with expected progression

Behavior:

- keep the timeline visible
- keep the active indicator visible
- freeze or warn when live state is unreliable

## Why This Is A Separate Feature

`VesselTripTimeline` is specialized around one current trip and a fixed
three-row model. `VesselTimeline` instead needs:

- a complete vessel-day document
- any number of alternating dock and sea rows
- compressed long-dock behavior
- a vessel-centric data source
- a live indicator driven by current vessel location

The feature therefore has its own backend contract and feature-local pipeline,
while still sharing generic timeline presentation primitives with
`VesselTripTimeline`.

## Data Architecture

### Backend-owned event feed

The current backend contract is a vessel/day event feed returned by:

- `functions.vesselTripEvents.queries.getVesselDayTimelineEvents`

The query returns:

```ts
type VesselTimelineEvent = {
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: Date;
  TerminalAbbrev: string;
  EventType: "dep-dock" | "arv-dock";
  ScheduledTime?: Date;
  PredictedTime?: Date;
  ActualTime?: Date;
};
```

Important characteristics:

- events are scoped to one vessel and one sailing day
- events are returned already sorted
- each physical scheduled segment contributes two event boundaries:
  - departure from a terminal
  - arrival at a terminal
- the identity anchor is:
  - `Key = SailingDay--VesselAbbrev--ScheduledDepartureIsoUtc--DepartingTerminalAbbrev--EventKind`

### `vesselTripEvents` table

The persistent backend read model is the Convex table:

- `vesselTripEvents`

Stored fields:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `EventType`
- `ScheduledTime?`
- `PredictedTime?`
- `ActualTime?`

This table exists specifically to support `VesselTimeline`. It is intentionally
smaller than the trip lifecycle tables and is not an audit log. It is a mutable
read model that stores the best current boundary data for one vessel/day.

### Schedule seeding and historical backfill

The event skeleton is seeded during scheduled-trip sync.

Source of truth for seeding:

- raw WSF schedule data, transformed into direct physical scheduled segments
- WSF vessel history for completed trips on the same sailing day

The schedule pipeline classifies direct vs indirect marketing trips and then
creates seed events only from direct segments. For each direct segment:

- create one `dep-dock` event
- create one `arv-dock` event

Field creation rules:

- `Key`
  - `VesselAbbrev + ScheduledDeparture + EventType`
- `ScheduledDeparture`
  - segment departure time
- `TerminalAbbrev`
  - departing terminal for `dep-dock`
  - arriving terminal for `arv-dock`
- `ScheduledTime`
  - departure event: `DepartingTime`
  - arrival event: `ArrivingTime ?? SchedArriveNext`
- `PredictedTime`
  - omitted at seed time
- `ActualTime`
  - omitted at raw schedule seed time

After the direct schedule skeleton is built, the backend may backfill completed
rows from WSF vessel history:

- departure actual source
  - WSF `ActualDepart`
- arrival actual source
  - WSF `EstArrival` proxy

When a stored `ActualTime` already exists for the same logical event:

- departure rows keep it when the delta from WSF `ActualDepart` is `< 3 minutes`
- departure rows replace it when the delta is `>= 3 minutes`
- arrival rows keep it when the delta from WSF `EstArrival` proxy is `< 2 minutes`
- arrival rows replace it when the delta is `>= 2 minutes`

This creates a stable vessel/day event skeleton before any live data arrives.

### Live enrichment

Live `VesselLocation` updates enrich the seeded event rows in place.

The orchestrator fetches vessel locations once, converts them to the Convex
shape, and passes the same location batch to three parallel backend branches:

1. store the latest `vesselLocations`
2. update trip lifecycle tables via `vesselTrips/updates`
3. update `vesselTripEvents`

For `VesselTimeline`, live updates use lightweight boundary rules rather than
the full trip lifecycle model. Their main job is to refine in-progress and
future rows after the daily rebuild has already populated completed rows from
schedule/history sources.

Departure / arrival evidence:

- strong departure:
  - `AtDock === false && Speed >= 0.2`
- strong arrival:
  - `AtDock === true && Speed < 0.2`

Update rules:

- departure event prediction
  - when the vessel is still at dock and the matching departure event has no
    actual time, `PredictedTime` is set from `ScheduledDeparture`
- arrival event prediction
  - when `Eta` is present and the matching arrival event has no actual time,
    `PredictedTime` is updated from `Eta`
  - newer arrival-side predictions overwrite older ones on the same event row
- departure actual
  - when strong departure evidence exists, set `ActualTime` from
    `LeftDock ?? TimeStamp`
- arrival actual
  - when strong arrival evidence exists, resolve the most recent unresolved
    arrival event for the current terminal and set `ActualTime = TimeStamp`
- false departure unwind
  - if the vessel quickly appears docked again at the same terminal before the
    paired arrival has actualized, clear the mistaken departure `ActualTime`

Field precedence:

- display/state quality:
  - `ActualTime` is the best truth when present
  - `PredictedTime` is mutable and may be overwritten by better live data
  - `ScheduledTime` remains the fallback baseline
- layout geometry:
  - `ScheduledTime` is the stable baseline for row sizing and positioning
  - `ActualTime` is the fallback when schedule time is missing
  - `PredictedTime` is the last-resort fallback when neither scheduled nor
    actual time exists

### Frontend context

`VesselTimeline` consumes a dedicated vessel/day context:

- `src/data/contexts/convex/ConvexVesselTripEventsContext.tsx`

Current context value:

```ts
type ConvexVesselTripEventsContextType = {
  VesselAbbrev: string;
  SailingDay: string;
  Events: VesselTimelineEvent[];
  VesselLocation?: VesselLocation;
  IsLoading: boolean;
  Error: string | null;
};
```

Responsibilities:

- fetch the backend-owned vessel/day event feed
- fetch the current `VesselLocation`
- expose both in one vessel/day-scoped context

The context no longer merges raw scheduled, active, and completed trip arrays
client-side.

## Frontend Pipeline

The frontend pipeline is event-based and intentionally small.

### Stage 1: Row construction

`buildTimelineRows.ts` builds semantic rows directly from adjacent
`VesselTimelineEvent` pairs.

Rules:

- dock row:
  - current event is `arv-dock`
  - next event is `dep-dock`
  - both share the same terminal
- sea row:
  - current event is `dep-dock`
  - next event is `arv-dock`
- terminal tail row:
  - if the final event is an arrival, append a zero-duration terminal row

Each row is represented by:

- `startEvent`
- `endEvent`
- row kind
- display mode
- duration metadata

Duration calculations intentionally use schedule-first layout precedence:

- `scheduled`
- `actual`
- `estimated`

This keeps row heights and positions stable as live predictions and actuals
arrive throughout the day. Live times are still preserved for labels and
indicator behavior.

### Stage 2: Active row and layout

The later pipeline steps derive:

- the active row
- active indicator state
- pixel heights
- terminal card geometry
- final render rows for the shared timeline renderer

The frontend still owns:

- dock/sea segmentation
- compressed long-dock behavior
- active row selection
- indicator positioning
- warning presentation

`VesselLocation` remains important even though the timeline rows come from
events:

- it helps place the active indicator within the current row
- it contributes at-dock vs at-sea presentation details
- it surfaces out-of-service warning state

## Source Of Truth Boundaries

The current design intentionally separates concerns:

- `ScheduledTrips`
  - still exists as a richer backend schedule model
  - seeds the `vesselTripEvents` skeleton through direct physical segments
- `vesselTripEvents`
  - the backend-owned read model consumed by `VesselTimeline`
- `VesselLocation`
  - the live operational source used to enrich event rows and drive the active
    indicator
- `activeVesselTrips` / `completedVesselTrips`
  - still power other features and backend logic
  - no longer form the frontend contract for `VesselTimeline`

## Current End-To-End Flow

```text
WSF schedule feed
  -> direct-segment classification
  -> seed vesselTripEvents for each vessel/day

WSF vessel locations
  -> VesselOrchestrator fetch + conversion
  -> store vesselLocations
  -> update vesselTrips lifecycle tables
  -> enrich vesselTripEvents with predicted/actual boundary times

Frontend VesselTimeline
  -> query vesselTripEvents for vessel/day
  -> fetch current VesselLocation
  -> convert ordered events to boundaries
  -> convert boundaries to dock/sea rows
  -> render timeline + active indicator
```
