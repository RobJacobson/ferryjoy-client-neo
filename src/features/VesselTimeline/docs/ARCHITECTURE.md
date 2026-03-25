# VesselTimeline Architecture

`VesselTimeline` renders one vessel for one sailing day as a continuous dock and
sea timeline. The system is boundary-event based: the backend persists a small
set of normalized boundary rows, and the client turns those rows into semantic
segments, active state, and final render state.

This document describes only the current system.

## Public Scope

```ts
type VesselTimelineProps = {
  vesselAbbrev: string;
  sailingDay: string;
  now?: Date;
  theme?: TimelineVisualThemeOverrides;
};
```

- `vesselAbbrev` and `sailingDay` define the full backend query scope.
- `now` exists for deterministic tests and render previews.
- `theme` affects shared timeline presentation only; it does not change data
  interpretation.

## Product Boundaries

### Timeline window

The timeline is a service-day view, not a berth-occupancy view.

- It starts at the first scheduled departure for the vessel on that sailing day.
- It ends at the final scheduled arrival for the vessel on that sailing day.
- Overnight berth occupancy before service start or after service end is not
  expanded into proportional dock rows.

### Sailing day

`SailingDay` uses Pacific service-day rules: 3:00 AM through 2:59 AM Pacific.

### Single-vessel contract

The feature remains scoped to one vessel/day at a time. The entire pipeline is
built around that query scope.

## Backend Data Model

The backend persists three tables with different update cadences:

### `eventsScheduled`

This is the schedule backbone and the structural source of truth.

One row exists for each scheduled boundary event:

- one `dep-dock` row per direct scheduled sailing
- one `arv-dock` row per direct scheduled sailing

Primary fields:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `UpdatedAt`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `NextTerminalAbbrev`
- `EventType`
- `ScheduledTime`

Source of truth:

- direct physical schedule segments from the WSF schedule feed

Computed values:

- `Key` is built from sailing day, vessel, scheduled departure, departing
  terminal, and event type using Pacific-local timestamp formatting for
  debugging readability
- `NextTerminalAbbrev`
  - for `arv-dock`, it is the same as `TerminalAbbrev`
  - for `dep-dock`, it is the terminal abbrev of the paired arrival event
- identical same-terminal dock seams are normalized to avoid zero-length dock
  segments

Update cadence:

- replace-only during schedule sync
- never touched by live vessel-location ticks

### `eventsActual`

This is the sparse actual-time overlay.

One row exists only when a scheduled boundary event has an actual time.

Primary fields:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `UpdatedAt`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `ActualTime`

Source of truth:

- WSF vessel history during schedule sync
- live `vesselLocations` during ongoing operation

Computed behavior:

- schedule sync may hydrate actuals from WSF history
- live updates resolve actual departures and arrivals by matching the current
  vessel location against the ordered scheduled boundary events for that
  vessel/day
- false-departure unwind is supported: if the vessel is seen docked again at
  the same terminal within the unwind window, the departure actual is cleared
- live ticks update only `eventsActual`; they do not rewrite schedule rows

Update cadence:

- low to medium frequency
- much lower churn than raw vessel-location polling

### `eventsPredicted`

This is the sparse best-prediction overlay.

One row exists for the single best currently displayable prediction for a
boundary event.

Primary fields in storage:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `UpdatedAt`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `PredictedTime`
- `PredictionType`
- `PredictionSource`

Source of truth:

- active trip state and prediction models
- WSF ETA when available

Computed behavior:

- the backend chooses exactly one winning prediction per boundary event
- arrival precedence:
  - WSF ETA
  - `AtSeaArriveNext`
  - `AtDockArriveNext`
- next-departure precedence:
  - `AtSeaDepartNext`
  - `AtDockDepartNext`
- current-departure prediction:
  - `AtDockDepartCurr`
- `PredictionType` and `PredictionSource` are kept in storage for backend
  debugging and auditability
- timeline-facing client queries intentionally hide those provenance fields so
  the client only receives `PredictedTime`

Update cadence:

- medium frequency
- independent of schedule and actual writes

## Backend Flow

### Schedule sync

Schedule sync is replace-only.

Flow:

1. fetch and transform raw WSF schedule data for the target sailing day
2. keep only direct physical segments
3. convert each direct segment into paired `dep-dock` and `arv-dock` boundary
   events
4. merge WSF history actuals into those in-memory boundary events
5. replace `eventsScheduled` rows for the sailing day
6. replace `eventsActual` rows for the sailing day from the hydrated in-memory
   event set

This means:

- cancelled or removed sailings disappear cleanly
- the schedule backbone never preserves rows just because they used to exist

### Live vessel-location updates

The orchestrator fetches vessel locations once and fans the batch out to:

- `vesselLocations`
- active trip updates
- `eventsActual`

For `eventsActual`, the mutation:

1. loads the full scheduled boundary set for the vessel/day
2. loads existing actual overlays for the same vessel/day
3. merges them into ordered boundary events in memory
4. applies live actual reconciliation
5. rewrites only the actual overlay rows for that vessel/day

No live path writes to `eventsScheduled`.

### Prediction updates

Prediction writes happen from finalized active trip state.

The trip update flow computes the best prediction row per event key and upserts
only the winning `eventsPredicted` row. If no prediction is currently valid for
an event, its prediction row is removed.

## Client Data Flow

`ConvexVesselTimelineProvider` loads four pieces of data:

- scheduled boundary rows
- actual boundary rows
- predicted boundary rows
- current `vesselLocations` row for the vessel

The provider then performs all feature-local composition on the client.

### Step 1: merge overlays onto the schedule backbone

The client builds:

- `Map<Key, actual>`
- `Map<Key, predicted>`

Then it maps over scheduled rows and produces a merged ordered boundary-event
array with:

- `ScheduledTime`
- `ActualTime`
- `PredictedTime`

The client never sees prediction provenance.

### Step 2: build semantic segments

`buildSegmentsFromBoundaryEvents` converts adjacent merged boundary rows into
semantic timeline segments.

Rules:

- `arv-dock` -> `dep-dock` at the same terminal becomes a dock segment
- `dep-dock` -> `arv-dock` becomes a sea segment
- a final trailing `arv-dock` becomes a terminal-tail dock segment

Client-owned edge cases:

- if a departure has no matching prior arrival in the ordered day feed, the
  client inserts an arrival placeholder
- placeholder reason is either:
  - `start-of-day`
  - `broken-seam`

This is intentionally a presentation concern. The backend stores the real
boundary data; the client handles visual continuity when schedule data is
incomplete or malformed.

### Step 3: resolve active state locally

The client resolves active state from:

- merged boundary events
- current vessel location

Resolution order:

1. location anchor
2. open actual-backed row
3. scheduled window fallback
4. terminal-tail fallback
5. edge fallback

This produces:

- `LiveState`
- `ActiveState`

No separate active-state table or server snapshot is persisted.

### Step 4: build render state

The render-state layer takes:

- semantic segments
- resolved active state
- live state
- `now`

and produces:

- row geometry
- terminal cards
- active indicator placement
- content height

Display-time precedence for user-facing event display remains:

- `ActualTime`
- `PredictedTime`
- `ScheduledTime`

Layout-time precedence for segment heights remains schedule-first:

- `ScheduledTime`
- fallback to `ActualTime`
- fallback to `PredictedTime`

## Edge Cases

### Missing or malformed schedule seams

The client inserts placeholders when the ordered boundary feed starts with a
departure or when a seam is broken mid-day. This keeps the timeline readable
without turning malformed upstream data into backend-owned fake rows.

### Identical dock seams

If an arrival and the next same-terminal departure share the same scheduled
timestamp, the seam is normalized so the dock row gets a minimal real duration
instead of collapsing to zero height.

### Early arrivals

Arrival actuals can be written before scheduled arrival time when strong live
arrival evidence exists. Eligibility is based on the earliest known boundary
time, with scheduled departure as the hard lower bound.

### Prediction churn

Prediction provenance changes are backend-owned. The client only reacts to
changes in the winning `PredictedTime`.

### Off-service vessels

The timeline remains visible even when a vessel is out of service. The active
indicator can stop animating when live state says the vessel is off-service,
but the schedule backbone remains available.

## Invariants

- `eventsScheduled` is replace-only and is the structural source of truth
- `eventsActual` and `eventsPredicted` are overlays keyed to scheduled events
- the client never receives prediction provenance
- placeholders are client-owned presentation artifacts
- active-state resolution is client-owned presentation logic
- no server snapshot document exists for VesselTimeline
