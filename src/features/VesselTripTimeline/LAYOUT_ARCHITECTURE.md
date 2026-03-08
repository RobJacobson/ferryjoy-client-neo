# Vessel Trip Timeline Layout Architecture

This document explains the current architecture for the vessel trip timeline.
The feature is now built around ordered segments with shared `TimePoint`
boundaries, while the shared timeline primitive remains domain-agnostic.

## Canonical Model

The feature's source of truth is an ordered array of `TimelineSegment` objects.
The ordered model also carries one `activeSegmentIndex` cursor. Each segment
contains:

- `kind`: `"at-dock"` or `"at-sea"`
- `segmentIndex`: zero-based order within the timeline
- `startPoint` / `endPoint`: shared `TimePoint` boundaries
- `startTerminalAbbrev` / `endTerminalAbbrev`: canonical terminal abbreviations
- `fallbackDurationMinutes`: route-specific fallback geometry
- `rendersEndLabel`: optional fencepost flag for the last segment

Adjacent segments share boundary `TimePoint`s. This makes the timing model
semantic and composable, even though today's vessel card still produces three
segments.

## Separation of Concerns

The feature is split into three layers:

1. **Canonical segment builder**
   - `utils/buildTimelineSegments.ts`
   - Builds ordered `TimelineSegment[]` plus `activeSegmentIndex` from trip and
     vessel-location data.
   - Keeps terminal abbreviations canonical in the model.

2. **Presentation adapter**
   - `adapters/buildTimelineModelFromTrip.ts`
   - Maps canonical segments into feature presentation rows.
   - Computes `durationMinutes` from boundary `TimePoint`s when possible.
   - Falls back to route-specific duration defaults when timing data is sparse.
   - Contains no JSX.

3. **Renderer + overlay**
   - `components/TimelineContent.tsx`
   - Wraps the shared timeline in `BlurTargetView`.
   - Maps presentation rows to shared `TimelineRow` objects.
   - Renders the shared timeline in `renderMode="background"` so the inline
     progress indicator is disabled for this feature.
   - Renders `RowContentLabel`, `RowContentTimes`, and the indicator overlay.
   - `utils/deriveOverlayIndicator.ts`
     derives the active segment, indicator position, and countdown label.

## Geometry vs Labels

The refactor explicitly separates **layout geometry** from **user-facing copy**.

### Geometry

- The shared timeline primitive uses `durationMinutes`, not absolute wall-clock
  dates.
- Feature code derives duration from `startPoint` / `endPoint` when possible.
- When boundary times are missing or invalid, geometry falls back to
  route-specific historical averages from ML config.
- No synthetic absolute `Date` timeline is constructed for rendering.

### Labels

- Terminal abbreviations stay canonical in the segment model.
- `RowContentLabel` translates abbreviations to names at render time.
- Countdown labels only use `actual ?? estimated` from the segment `endPoint`.
- Historical averages are never shown to the user.
- Label tense is derived from `segmentIndex` relative to `activeSegmentIndex`,
  not from visual completion.

This is important for delayed departures: a dock segment can remain `active`
even after its predicted geometry is fully consumed, so the indicator may sit at
`100%` while the label still reflects the real-world state.

## Shared Timeline Primitive

`src/components/Timeline` remains feature-agnostic. Its `TimelineRow` model
contains:

- `id`
- `durationMinutes`
- `percentComplete`
- render slots (`leftContent`, `rightContent`, `markerContent`,
  `indicatorContent`)
- optional `minHeight`

The primitive is now split so:

- `TimelineTrack` renders the track backbone plus the static marker
- `TimelineProgressIndicator` owns inline moving-indicator visibility/rendering
- feature code can still bypass the inline indicator entirely and use a custom
  overlay, as `VesselTripTimeline` does

It does not know about `TimePoint`, terminal semantics, or the active-segment
cursor.

## Overlay Structure

At a high level:

```text
View (timeline container)
└── BlurTargetView
    ├── TimelineRowComponent[]
    │   └── leftContent (RowContentLabel) | axis (track + marker) | rightContent
    │       (RowContentTimes)
    └── TimelineIndicatorOverlay (absolute inset-0)
        └── TimelineIndicator (single absolute child)
```

The overlay does not duplicate rows. Instead:

- rows report measured `y` and `height` through `onRowLayout`
- the active row is chosen from `activeSegmentIndex`
- row-local `positionPercent` is converted into container-relative `top`
- the overlay renders exactly one indicator above the full timeline

Indicator position is:

`rowLayout.y + rowLayout.height * positionPercent`

Horizontal centering remains `left: "50%"` with negative margins so the
indicator stays aligned to the shared axis.

## Indicator State Rules

The overlay indicator model is:

- `rowId`
- `segmentIndex`
- `positionPercent`
- `label`

Rules:

- `activeSegmentIndex` points at the active row
- `-1` means no segment has started yet
- `rows.length` means all segments are completed
- at-sea segments prefer distance-based progress when telemetry is available
- otherwise progress is time-based from the segment boundary `TimePoint`s
- the first active dock segment applies a small minimum offset (`0.06`) so the
  indicator does not sit directly on top of the static marker

## Boundary Ownership

Each segment owns its **starting** boundary label and time chips.

The final segment may also own its **ending** boundary via `rendersEndLabel`.
This avoids a dummy placeholder row while still solving the fencepost problem
for the terminal UI.

## Indicator Position Animation

`positionPercent` updates relatively infrequently from Convex data. To avoid
visible jumps:

- `hooks/useAnimatedProgress.ts` animates the indicator's absolute `top` value
  with a Reanimated spring
- `TimelineIndicator.tsx` applies the animated `top` via `useAnimatedStyle`

Animation runs on the UI thread, so the indicator remains smooth even when the
backing data updates only every few seconds.

## Important Constraints

- `BlurTargetView` wraps the full timeline for Android blur support.
- `TimelineIndicatorOverlay` uses `pointerEvents="none"` so interactions are not
  blocked.
- The overlay must share the same positioned ancestor as the measured rows.
- The indicator renders only after the active row has measured bounds.
- Terminal abbreviations remain canonical in the feature model and are only
  translated to display names in the UI layer.
