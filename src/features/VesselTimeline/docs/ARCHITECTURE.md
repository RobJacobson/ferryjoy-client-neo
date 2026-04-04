# VesselTimeline Architecture

`VesselTimeline` shows one vessel for one sailing day as a dock/sea timeline.
The backend contract is now event-first:

- backend owns ordered timeline events
- backend owns the active interval
- frontend derives rows from events for presentation

This document reflects the current feature architecture after moving the
public query back toward fundamental event truth.

## Public API

```ts
type VesselTimelineProps = {
  vesselAbbrev: string;
  sailingDay: string;
  now?: Date;
  theme?: TimelineVisualThemeOverrides;
};
```

- `vesselAbbrev` and `sailingDay` define the full query scope.
- `now` is only for deterministic previews and tests.
- `theme` changes presentation, not data interpretation.

## Product Boundaries

- Scope is one vessel and one sailing day.
- The timeline is a service-day view, not a full berth-occupancy history.
- The service day follows Pacific rules: `3:00 AM` through `2:59 AM`.
- The visible window is bounded by the backend-owned events returned for that
  day.

## Target Data Flow

### 1. Provider fetches one backend query result

`ConvexVesselTimelineProvider` loads one query result:

- `getVesselTimelineViewModel({ VesselAbbrev, SailingDay })`

That payload includes:

- ordered backend-owned events
- `activeInterval`
- `ObservedAt`
- raw live state for title and position calculations

`ObservedAt` comes from `vesselLocations.TimeStamp`. The timeline no longer
falls back to `activeVesselTrips.TimeStamp`.

Source:

- [ConvexVesselTimelineContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx)

Backend layering for that query is now:

- [queries.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/queries.ts)
  is a thin public Convex entrypoint
- [loaders.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/loaders.ts)
  owns Convex table reads for the requested same-day event slice plus the live
  vessel-location row, with one indexed previous-day last-arrival lookup when
  the first dock interval needs a carry-in anchor
- [timelineEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/timelineEvents.ts)
  owns event merging and stable ordering
- [activeInterval.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/activeInterval.ts)
  owns same-day active-interval resolution directly from ordered events plus
  live vessel state
- [viewModel.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/viewModel.ts)
  owns final pure assembly from loaded inputs

### 2. The frontend derives rows from backend events

The backend query now returns normalized timeline events plus live
vessel-location state and one backend-owned `activeInterval`.
That event list is still day-focused, but it may prepend one prior-sailing-day
arrival when the first visible interval is an overnight dock stay leading into
the first departure.

The feature layer derives rows locally from ordered events:

- `arv-dock -> dep-dock` becomes an `at-dock` row
- `dep-dock -> arv-dock` becomes an `at-sea` row
- start-of-day gaps produce placeholder dock rows
- final arrivals produce terminal-tail dock rows

This is presentation logic, not storage truth. The feature layer may own row
IDs, placeholder handling, and terminal-tail rendering as long as it stays a
pure derivation from backend events.

### 3. The backend owns active attachment

The backend returns:

- `activeInterval`
- raw live state

Active attachment uses `vesselLocations` plus the requested sailing day's
ordered events.
The frontend should not resolve same-terminal ambiguity or trip ownership on
its own.
For docked vessels, the backend resolves the active dock interval directly from
event order and the observed dock terminal. For at-sea vessels, it uses
`vesselLocations.Key` only when that key matches a visible segment with both
boundaries present. The only cross-day carry is one prepended arrival used to
anchor the first dock interval; the query still never consults
`activeVesselTrips`.
When `activeInterval` is `null`, the frontend still renders rows but omits the
active indicator.

### 4. The render-state layer stays presentation-focused

The frontend render-state layer should continue to own:

- row derivation from ordered events
- row layout sizing
- labels and display copy
- terminal-name shortening
- terminal card geometry
- active-indicator position within the chosen row
- compressed presentation of the overnight first dock interval
- animation and scroll behavior
- indicator subtitle / speed formatting
- terminal-tail `"--"` label behavior
- terminal-tail indicator alignment with the arrival marker line

The render-state layer should not own:

- schedule ownership inference
- live trip attachment inference
- cross-day continuity guesses

## Rendering Notes

- `VesselTimelineContent` renders a fixed-height scrollable canvas.
- Initial auto-scroll centers the active indicator when one exists.
- Displayed event times are chosen in user-facing order:
  - `EventActualTime`
  - `EventPredictedTime`
  - `EventScheduledTime`
- Layout sizing remains schedule-first:
  - `EventScheduledTime`
  - fallback to `EventActualTime`
  - fallback to `EventPredictedTime`

## Important Invariants

- normalized boundary-event tables remain the persistence layer, not the public
  feature contract
- the requested sailing day is a hard ownership boundary for the timeline read
  path
- `eventsScheduled` is the only schedule backbone used by the timeline read
  path
- `eventsScheduled.IsLastArrivalOfSailingDay` is the indexed carry-in hook used
  to anchor overnight first-row arrivals without loading the whole prior day
- `vesselLocations` is the only live-state source used by the timeline query
- predictions can change displayed times but never event identity
- row derivation is pure and local to the feature layer
- `activeInterval` is sufficient for the frontend to place the indicator
- terminal-tail rows anchor the indicator to the arrival marker line, not the
  vertical center of the full row box
- no separate backend snapshot table exists for `VesselTimeline`

## Where To Look

- Public feature entry:
  [VesselTimeline.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/VesselTimeline.tsx)
- Provider and data host:
  [ConvexVesselTimelineContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx)
- Backend read-model contract:
  [schemas.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/schemas.ts)
- Backend query loaders:
  [loaders.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/loaders.ts)
- Backend event merger:
  [timelineEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/timelineEvents.ts)
- Backend active-interval resolver:
  [activeInterval.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/activeInterval.ts)
- Backend view-model assembler:
  [viewModel.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/viewModel.ts)
- Backend query:
  [queries.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/queries.ts)
- Shared scheduled-segment resolver logic:
  [segmentResolvers.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsScheduled/segmentResolvers.ts)
- Frontend render pipeline:
  [toDerivedRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderPipeline/toDerivedRows.ts),
  [toActiveRow.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderPipeline/toActiveRow.ts),
  [toRenderRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderPipeline/toRenderRows.ts),
  [toActiveIndicator.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderPipeline/toActiveIndicator.ts)
- Render-pipeline assembly:
  [getVesselTimelineRenderState.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderPipeline/getVesselTimelineRenderState.ts)
- Final renderer:
  [VesselTimelineContent.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/VesselTimelineContent.tsx)
