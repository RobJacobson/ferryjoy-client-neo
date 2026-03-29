# VesselTimeline Architecture

`VesselTimeline` shows one vessel for one sailing day as a dock/sea timeline.
The data model is boundary-event based:

- scheduled rows define the structure
- actual and predicted rows overlay onto that structure
- the client turns merged boundary events into semantic segments
- the render-state layer turns those segments into fixed-height timeline rows

This document describes the current implementation only.

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
- The visible window is bounded by the scheduled events returned for that day.

## Current Client Flow

### 1. Provider fetches four query results

`ConvexVesselTimelineProvider` loads:

- scheduled boundary events
- actual boundary events
- predicted boundary events
- the current vessel location

Source:

- [ConvexVesselTimelineContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx)

### 2. The provider merges overlays onto the schedule backbone

The provider keeps scheduled rows as the structural source of truth, then joins
actual and predicted times by stable event key.

The merged event shape is effectively:

- scheduled time from `eventsScheduled`
- optional actual time from `eventsActual`
- optional predicted time from `eventsPredicted`

No prediction provenance is exposed to the feature UI.

### 3. The client builds semantic segments

`buildSegmentsFromBoundaryEvents` converts ordered merged boundary events into
semantic segments:

- `arv-dock -> dep-dock` at the same terminal becomes a dock segment
- `dep-dock -> arv-dock` becomes a sea segment
- a final `arv-dock` becomes a terminal dock segment

If a departure has no immediately preceding same-terminal arrival, the client
inserts a synthetic dock placeholder before the sea segment. The placeholder is
marked with `placeholderReason`:

- `start-of-day`
- `broken-seam`

Source:

- [buildSegmentsFromBoundaryEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/buildSegmentsFromBoundaryEvents.ts)

### 4. The client resolves active state

`resolveActiveStateFromTimeline` uses merged events plus the current vessel
location to choose the active row and live subtitle.

Resolution order:

1. location anchor
2. actual-backed row
3. scheduled-window fallback
4. terminal-tail fallback
5. edge fallback

This produces:

- `LiveState`
- `ActiveState`

There is no separate persisted active-state snapshot.

Source:

- [resolveActiveStateFromTimeline.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/resolveActiveStateFromTimeline.ts)

### 5. The render-state layer builds UI-ready geometry

`getStaticVesselTimelineRenderState` and
`getVesselTimelineActiveIndicator` turn semantic segments plus active/live
state into:

- timeline rows
- row display props such as start labels, optional terminal headlines, and
  placeholder visibility
- row layout bounds
- terminal card geometry
- active indicator placement
- content height

Source:

- [getVesselTimelineRenderState.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/getVesselTimelineRenderState.ts)

## Rendering Notes

- `VesselTimelineContent` renders a fixed-height scrollable canvas.
- Initial auto-scroll centers the active indicator when one exists.
- Displayed event times are chosen in user-facing order:
  - `EventActualTime`
  - `EventPredictedTime`
  - `EventScheduledTime`
- Layout sizing is schedule-first:
  - `EventScheduledTime`
  - fallback to `EventActualTime`
  - fallback to `EventPredictedTime`

## Important Invariants

- scheduled events remain the structural backbone
- actual and predicted rows are sparse overlays keyed to scheduled rows
- placeholders are client-owned presentation artifacts
- active-state resolution is client-owned
- row display copy is computed in render-state, not in shared row components
- no backend snapshot document exists for `VesselTimeline`

## Where To Look

- Public feature entry:
  [VesselTimeline.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/VesselTimeline.tsx)
- Provider and data composition:
  [ConvexVesselTimelineContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx)
- Segment construction:
  [buildSegmentsFromBoundaryEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/buildSegmentsFromBoundaryEvents.ts)
- Active-state resolution:
  [resolveActiveStateFromTimeline.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/resolveActiveStateFromTimeline.ts)
- Render-state assembly:
  [getVesselTimelineRenderState.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/getVesselTimelineRenderState.ts)
- Final renderer:
  [VesselTimelineContent.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/VesselTimelineContent.tsx)
