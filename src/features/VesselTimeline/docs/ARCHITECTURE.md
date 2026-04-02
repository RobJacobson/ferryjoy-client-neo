# VesselTimeline Architecture

`VesselTimeline` shows one vessel for one sailing day as a dock/sea timeline.
The backend contract is now row-based:

- backend owns row identity
- backend owns active-row attachment
- frontend should render backend-owned rows with minimal domain logic

This document reflects the current feature architecture after the backend
hard-reset and frontend migration to backend-owned rows.

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
- The visible window is bounded by the backend-owned rows returned for that
  day.

## Target Data Flow

### 1. Provider fetches one backend query result

`ConvexVesselTimelineProvider` loads one query result:

- `getVesselTimelineViewModel({ VesselAbbrev, SailingDay })`

That payload includes:

- ordered backend-owned rows
- `activeRowId`
- `ObservedAt`
- raw live state for title and position calculations

Source:

- [ConvexVesselTimelineContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx)

### 2. The backend owns row construction

The backend query now derives rows from normalized boundary events plus live
trip/location state.

Each row has:

- stable `rowId`
- `tripKey`
- `kind`: `at-dock` or `at-sea`
- `rowEdge`: `normal` or `terminal-tail`
- optional `placeholderReason`
- `startEvent`
- `endEvent`
- `durationMinutes`

The frontend should not reconstruct dock/sea rows from raw boundary adjacency.
Terminal-tail is represented as one final backend-owned `at-dock` row, not a
synthetic extra row added by the client.

### 3. The backend owns active attachment

The backend returns:

- `activeRowId`
- raw live state

The frontend should not resolve same-terminal ambiguity, nearest-row fallback,
or terminal-tail fallback on its own.
When `activeRowId` is `null`, the frontend still renders rows but omits the
active indicator.

### 4. The render-state layer stays presentation-focused

The frontend render-state layer should continue to own:

- row layout sizing
- labels and display copy
- terminal-name shortening
- terminal card geometry
- active-indicator position within the chosen row
- animation and scroll behavior
- indicator subtitle / speed formatting
- terminal-tail `"--"` label behavior

The render-state layer should not own:

- row identity
- placeholder synthesis
- terminal-tail identity
- active-row selection

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
- predictions can change displayed times but never row identity
- dock and sea rows for one trip share the same trip key
- placeholders are backend-emitted fallback only
- terminal-tail is backend-owned row metadata
- `activeRowId` is sufficient for the frontend to place the indicator
- no separate backend snapshot table exists for `VesselTimeline`

## Where To Look

- Public feature entry:
  [VesselTimeline.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/VesselTimeline.tsx)
- Provider and data host:
  [ConvexVesselTimelineContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx)
- Backend read-model contract:
  [schemas.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/schemas.ts)
- Backend row/view-model builder:
  [viewModel.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/viewModel.ts)
- Backend query:
  [queries.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/queries.ts)
- Render-state assembly:
  [getVesselTimelineRenderState.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/getVesselTimelineRenderState.ts)
- Final renderer:
  [VesselTimelineContent.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/VesselTimelineContent.tsx)
