# VesselTimeline Architecture

This document describes the current architecture for the `VesselTimeline`
feature.

`VesselTimeline` is a new feature. It should be built alongside the existing
`VesselTripTimeline` feature, not by refactoring `VesselTripTimeline` in-place.

The existing `VesselTripTimeline` remains focused on a single current trip. The
new `VesselTimeline` is a complete day timeline for one vessel, built from
scheduled trips and enriched with active, completed, and live vessel-location
data.

## Scope

`VesselTimeline` renders one continuous vertical timeline for one vessel on one
requested sailing day.

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

- `vesselAbbrev` is passed as a prop.
- `sailingDay` is passed as a prop.
- `routeAbbrevs` is passed as a prop for feature-level flexibility, even though
  the underlying data strategy for this feature is vessel-centric rather than
  route-centric.
- `now` is optional and exists mainly to support testing and deterministic
  rendering.

## Product Decisions

### Timeline window

The visible timeline is a service-day timeline, not a literal 3:00 AM to
2:59 AM berth-occupancy timeline.

- Start at the vessel's first scheduled departure for the requested sailing day.
- End at the vessel's last scheduled arrival for the requested sailing day.
- Overnight pre-service and post-service berth occupancy are not rendered as
  full proportional dock periods.

### Sailing-day boundary

The caller passes `sailingDay`, but the intended upstream day cutoff is:

- `4:00 AM` local time to decide "yesterday" vs "today"

This reduces edge cases where trips spill slightly past the standard sailing-day
 boundary.

### Single-vessel v1

Version 1 is scoped to one vessel only.

- One timeline
- One vessel
- One active indicator
- No list of vessel timelines

### Scheduled trips are the backbone

`ScheduledTrip` is the canonical source of structure for the day timeline.

- All scheduled trips for the vessel/day are included.
- Missing active/completed backend data does not remove a scheduled segment.
- Active/completed trip data enriches scheduled structure when available.
- `VesselLocation` drives live state, indicator behavior, and off-schedule
  detection.

### Missing historical data

If a past scheduled trip has no completed-trip record:

- render it as a normal past segment if the vessel otherwise appears consistent
  with the planned service
- show scheduled times only
- omit actual/predicted times that are unavailable

This treats missing completed-trip records as possible data loss, not automatic
evidence that the trip was skipped or canceled.

### Off-schedule / out-of-service behavior

If current evidence suggests the vessel is no longer following the expected
service path, the timeline remains visible but live progression stops.

Primary signals:

- `VesselLocation.InService === false`
- the vessel appears to have moved onto an unscheduled route inconsistent with
  the day plan

Behavior:

- keep the scheduled timeline visible
- freeze the indicator at the last reliable position
- keep the indicator visible
- render the indicator in a greyed-out warning style

### Long dock periods

Normal turnarounds are short. Long dock periods are real dock segments, but they
should not consume proportional screen space indefinitely.

Rules:

- dock segment `< 60 min`: render proportionally
- dock segment `>= 60 min`: render as a compressed break row

Compressed break row layout:

- visible arrival stub: `10 min`
- break marker: explicit visual discontinuity
- visible departure window: `50 min`

This preserves the user's question, "how much time do I have before departure?"
without rendering multi-hour idle periods proportionally.

### Indicator behavior inside compressed breaks

For a compressed dock-break row:

- arrival stub: indicator moves normally
- compressed middle: indicator remains visible and pins at the break marker
- departure window: indicator resumes movement
- indicator label continues showing true minutes remaining even when pinned

Indicator styling should remain customizable later. The render-state model must
carry style hooks instead of hardcoding the final visual treatment.

## Why This Is A New Feature

`VesselTripTimeline` already has a clean pipeline and a good vertical overlay
renderer, but it is still specialized around a single trip and a fixed three-row
model:

- origin dock
- at sea
- destination dock

`VesselTimeline` needs:

- an arbitrary number of dock/sea segments across a day
- schedule-first construction
- compressed outlier dock behavior
- frozen warning-state indicator behavior
- vessel-centric rather than route-centric data loading

Those requirements justify a separate feature implementation. The business
logic, document model, and render-state derivation remain feature-local even
though the visual timeline renderer now shares a common UX layer with
`VesselTripTimeline`.

## Shared UX Boundary

`VesselTimeline` and `VesselTripTimeline` are now intentionally split this way:

- separate feature pipelines and render-state logic under `src/features/...`
- shared styling-sensitive timeline UX primitives under
  `src/components/timeline`

The shared UX layer owns only generic renderer concerns:

- row shell measurement
- row label / marker layout
- track rendering
- indicator overlay rendering
- shared timeline theme constants
- generic overlay/view-state helpers

The shared UX layer now also owns:

- row-kind marker icons inside the static dock/sea circles
- separate blur surfaces for the active indicator badge and banner pill
- the banner renderer above the active indicator
- rocking animation for the active at-sea indicator
- terminal card backgrounds for "at terminal" portions (pre-computed geometry,
  rendered below the track)

`VesselTimeline` still owns:

- vessel-day data loading
- day-scoped row construction
- compressed dock-break rules
- indicator state (`active`, `pinned-break`, `inactive-warning`)
- banner content derived from vessel state (`at dock` vs speed/distance)
- explicit pixel geometry and scroll behavior

This boundary is deliberate. The two features should look the same by default,
but they should not share domain logic just because they share the same UX.

## Data Architecture

### New vessel-centric context

Create a new Convex-backed context beside the existing providers under
`src/data/contexts/convex`.

Recommended file:

- `src/data/contexts/convex/ConvexVesselDayTimelineContext.tsx`

This context should not be a variant of `ConvexUnifiedTripsContext`.
`ConvexUnifiedTripsContext` is route/day-centric. `VesselTimeline` needs a
vessel/day-centric data boundary.

### Context responsibilities

The new context should:

- fetch scheduled trips for `vesselAbbrev + sailingDay`
- fetch active vessel trips for `vesselAbbrev`
- fetch completed vessel trips for `vesselAbbrev + sailingDay`
- fetch current vessel location for `vesselAbbrev`
- normalize all data into an ordered feature-specific array
- expose one normalized context value

The context should include `VesselLocation` directly instead of leaving it to a
separate consumer-level join. That keeps loading, error handling, and live-state
logic centralized.

### Context output shape

The context should expose normalized, ordered data rather than raw query arrays.

Recommended shape:

```ts
type VesselTimelineTrip = {
  key: string;
  vesselAbbrev: string;
  sailingDay: string;

  routeAbbrev?: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev?: string;

  scheduledDeparture: Date;
  scheduledArrival?: Date;
  scheduledArriveCurr?: Date;
  nextScheduledDeparture?: Date;

  tripStart?: Date;
  leftDock?: Date;
  arriveDest?: Date;
  tripEnd?: Date;

  predictedDepartCurr?: Date;
  predictedArriveNext?: Date;
  predictedDepartNext?: Date;

  hasActiveData: boolean;
  hasCompletedData: boolean;
};

type VesselDayTimelineContextValue = {
  vesselAbbrev: string;
  sailingDay: string;
  trips: VesselTimelineTrip[];
  vesselLocation?: VesselLocation;
  isLoading: boolean;
  error: string | null;
};
```

The shape should stay narrow and feature-specific. It should not expose all raw
backend fields.

### Ordering

The ordered trip array should be sorted by scheduled `DepartingTime`.

Rationale:

- this feature is always scoped to one vessel and one day
- the number of items is small
- clock order is simpler and sufficiently authoritative here

`PrevKey`/`NextKey` may still be useful for validation or diagnostics, but they
are not required as the primary traversal mechanism for v1.

## Technical Pipeline

The feature should mirror the successful literal-pipeline shape used by
`VesselTripTimeline`, but with a new day-level document model.

Suggested stages:

1. `boundaries`
2. `rows`
3. `document`
4. `renderRows`
5. `renderState`

### Stage 1: boundaries

Input:

- normalized `VesselTimelineTrip[]`
- `vesselLocation`

Responsibilities:

- derive timeline boundary points from scheduled data plus available actual and
  predicted overlays
- determine trip-to-trip transitions
- identify dock vs sea intervals

### Stage 2: rows

Build ordered day-scoped rows.

Rows are not "trips". They are timeline segments.

Expected row kinds:

- `dock`
- `sea`

Responsibilities:

- alternate dock and sea rows across the day
- calculate actual segment durations
- calculate display durations
- mark compressed long-dock rows

### Stage 3: document

Create the canonical document and determine the active cursor.

Responsibilities:

- assemble ordered rows
- determine `activeSegmentIndex`
- determine whether the indicator is fully active or in warning/frozen mode
- prefer live departure evidence from `vesselLocation.LeftDock` /
  `vesselLocation.AtDock === false` when choosing dock vs sea ownership

### Stage 4: renderRows

Derive render-ready labels and row metadata.

Responsibilities:

- boundary labels
- row display metadata
- break marker render data
- row style hooks

### Stage 5: renderState

Compute the active indicator and final render state.

Responsibilities:

- indicator row ownership
- indicator label
- indicator appearance variant
- indicator banner content
- indicator y-position mapping across proportional and compressed rows
- terminal card geometry (top/bottom/single positions for dock blocks, computed
  from row adjacency and terminal matching; single cards omit the lower
  extension used for top/bottom pairs)

## Canonical Document Model

The document must explicitly represent display compression. Raw duration and
display duration are separate concepts.

Suggested model:

```ts
type TimelineRowKind = "dock" | "sea";

type TimelineRowDisplayMode =
  | "proportional"
  | "compressed-dock-break";

type TimelineIndicatorState =
  | "active"
  | "pinned-break"
  | "inactive-warning";

type TimelineBoundary = {
  terminalAbbrev?: string;
  timePoint: {
    scheduled?: Date;
    actual?: Date;
    estimated?: Date;
  };
};

type VesselTimelineRow = {
  id: string;
  segmentIndex: number;
  kind: TimelineRowKind;

  startBoundary: TimelineBoundary;
  endBoundary: TimelineBoundary;

  actualDurationMinutes: number;
  displayDurationMinutes: number;

  displayMode: TimelineRowDisplayMode;

  compression?: {
    thresholdMinutes: number;
    visibleArrivalMinutes: number;
    visibleDepartureMinutes: number;
  };
};

type VesselTimelineDocument = {
  rows: VesselTimelineRow[];
  activeSegmentIndex: number;
  indicatorState: TimelineIndicatorState;
};
```

The key architectural decision is that row display geometry is owned by the
document, not inferred ad hoc in the renderer.

## Rendering Architecture

The feature should reuse the broad rendering strategy that already works in
`VesselTripTimeline`:

- measured row layouts
- terminal card backgrounds (rendered first, below the track)
- one full-height track
- one absolute overlay indicator

This is still the correct approach because:

- the indicator can overlap row boundaries
- the track and indicator must share the same measured coordinate system
- blur and overlay concerns remain easier to manage with one absolute overlay

The renderer composition stays feature-local in `VesselTimeline`, but it should
compose the shared primitives from `src/components/timeline` rather than
forking row/track/indicator implementations.

`VesselTimeline.tsx` also owns a local `useNowMs(1000)` clock so time-based
progress continues to update between Convex refreshes. The optional `now` prop
still overrides that clock for deterministic rendering and tests.

### Terminal card backgrounds

"At terminal" dock portions are highlighted with semi-transparent card
backgrounds. The pipeline (`renderState`) computes card geometry (top/bottom/
single positions, pixel bounds) from row adjacency and terminal matching. The
shared `TimelineTerminalCardBackgrounds` component renders from that
pre-computed geometry. Cards must be rendered before the track so they appear
below it in the stacking order.

## Layout Model

`VesselTimeline` should not depend on flexbox to infer proportional row heights.

`VesselTripTimeline` uses flexbox because it must compress one trip into a fixed
card height. `VesselTimeline` does not have that constraint. It is a continuous,
scrollable day timeline, so row geometry should be computed deterministically.

Recommended layout approach:

- compute row heights explicitly from `displayDurationMinutes`
- use a fixed `pixelsPerMinute` scale
- enforce a `minRowHeightPx` for readability
- use explicit pixel geometry as the source of truth for row height and
  indicator positioning

Suggested rule:

```ts
displayHeightPx = Math.max(
  minRowHeightPx,
  displayDurationMinutes * pixelsPerMinute
);
```

This should make the layout:

- predictable
- easy to tune
- easier to reason about for compressed dock-break rows
- independent of flex distribution across sibling rows

Measured row layout can still exist as a safety check for final rendered bounds,
but it should not be the primary geometry model.

### Layout config

The feature should use a small layout/config object so sizing can be tuned later
without redesigning the pipeline.

Suggested shape:

```ts
type VesselTimelineLayoutConfig = {
  pixelsPerMinute: number;
  minRowHeightPx: number;
  compressedBreakMarkerHeightPx: number;
  compressedBreakStubMinutes: number;
  compressedBreakDepartureWindowMinutes: number;
  terminalCardTopOffsetPx: number;
  terminalCardDepartureCapHeightPx: number;
};
```

This config should be owned by the feature and treated as part of the renderer's
display policy rather than as raw domain logic.

## Indicator Positioning

The existing simple "percent complete within a row" model is not sufficient once
compressed rows exist.

The render layer needs an explicit mapping from actual progress to displayed
position.

For proportional rows:

- map progress normally through the row height

For compressed dock-break rows:

- arrival stub maps to the top visible slice
- compressed middle pins to the break marker
- departure window maps to the lower visible slice

The indicator label should always reflect real countdown information, even when
the indicator itself is pinned and not moving.

The active indicator also renders a banner above the badge:

- title: vessel name
- dock subtitle: `at dock`
- sea subtitle: speed in knots and remaining distance when available

When the active row is a live sea segment and the vessel is moving, the shared
indicator applies a speed-scaled rocking animation. Dock rows remain upright.

Because layout is deterministic, absolute y-position should be derived from
cumulative row heights rather than inferred indirectly from flex measurements.

Recommended model:

- `rowTopPx` = sum of all prior row `displayHeightPx`
- `rowLocalOffsetPx` = row-specific mapping from progress to display position
- `indicatorTopPx` = `rowTopPx + rowLocalOffsetPx`

This applies to both proportional rows and compressed dock-break rows.

## Scroll Behavior

The full vessel-day timeline should remain fully scrollable.

- the timeline height is whatever the computed rows require
- the user can scroll through the entire day
- the app may perform an initial auto-scroll on first mount
- after initial positioning, the scroll view should not fight user input

### Initial auto-scroll

Initial auto-scroll is recommended for v1.

Default behavior:

- on first mount only, scroll to center the active indicator in the viewport

This should be configurable rather than hardcoded.

Suggested viewport config:

```ts
type VesselTimelineViewportConfig = {
  initialAutoScroll: "center-active-indicator" | "center-active-row" | "none";
  initialScrollAnchorPercent: number;
};
```

Recommended defaults:

- `initialAutoScroll = "center-active-indicator"`
- `initialScrollAnchorPercent = 0.5`

This allows future tuning, such as placing the active segment slightly above
center to reveal more upcoming timeline below it, without changing the core
layout architecture.

## File Layout

Suggested feature structure:

```text
src/features/VesselTimeline/
  ARCHITECTURE.md
  index.ts
  VesselTimeline.tsx
  types.ts
  utils/
    pipeline/
      boundaries.ts
      rows.ts
      document.ts
      renderRows.ts
      renderState.ts
      index.ts
  components/
    TimelineContent.tsx
```

Shared UX primitives live separately:

```text
src/components/timeline/
  index.ts
  types.ts
  theme.ts
  viewState.ts
  useAnimatedProgress.ts
  TimelineRow.tsx
  TimelineRowContent.tsx
  TimelineTerminalCardBackgrounds.tsx
  TimelineTrack.tsx
  TimelineIndicator.tsx
  TimelineIndicatorOverlay.tsx
  TimelineRowEventTimes.tsx
  TimelineMarkerIcon.tsx
```

Data-provider addition:

```text
src/data/contexts/convex/
  ConvexVesselDayTimelineContext.tsx
```

And export it through:

- `src/data/contexts/index.ts`

## Implementation Guidance

Initial implementation should prioritize:

1. New vessel-centric context
2. Normalized ordered trip array
3. New day-level document model
4. Vertical renderer with overlay
5. Compressed dock-break behavior

It should explicitly avoid:

- refactoring `VesselTripTimeline` first
- widening route-scoped providers to fetch everything
- exposing raw backend arrays from the new context
- over-engineering field-level provenance tracking

## Documentation Boundary

These docs should stay separate rather than being merged into one file.

- `VesselTimeline/ARCHITECTURE.md` should explain vessel-day data flow,
  document shape, explicit geometry, and compressed-break behavior.
- `VesselTripTimeline/LAYOUT_ARCHITECTURE.md` should explain the trip-specific
  renderer composition and single-trip overlay behavior.

A short shared note in each file is enough to point readers at
`src/components/timeline` for the common UX layer. Merging the full documents
would blur the line between shared UX and feature-specific logic.
