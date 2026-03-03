# Vessel Trip Timeline Layout Architecture

This document explains the current layout strategy for the vessel timeline,
with emphasis on why the moving indicator is implemented as a feature-level
overlay instead of a per-row timeline element.

## Why We Use an Overlay

The moving indicator must blur whatever is behind it, including the timeline
track itself. A row-local indicator caused two problems:

- z-order conflicts when the indicator crosses row boundaries
- unreliable blur composition because the indicator lived inside one row subtree

To solve this, the indicator is rendered once as an absolute overlay above the
entire timeline in `VesselTripTimelineOverlay`.

## Separation of Concerns

The feature is split into 2 layers:

1. **Pure model builder**
   - `adapters/buildTimelineModelFromTrip.ts`
   - Converts trip/location domain data into timeline row models only.
   - No JSX is created here.

2. **Layout + overlay renderer**
   - `components/VesselTripTimelineOverlay.tsx`
   - Renders `VerticalTimeline` plus one absolute blur-backed indicator.
   - Performs final slot placement and card component selection from row phase
     plus trip/location domain data.
   - Derives the active overlay indicator from row timing + trip state at render
     time.

This keeps business logic testable and rendering logic explicit.

## Coordinate System and Measurement

`VerticalTimeline` exposes an optional callback:

- `onRowLayout(rowId, { y, height })`

`VesselTripTimelineOverlay` stores row values by `rowId`, measures timeline
container width once, and computes overlay position:

- `top = rowY + rowHeight * positionPercent`
- `left = timelineWidth * axisXRatio`

The overlay dot is centered at that point by subtracting half its size via
negative margins.

`axisXRatio` defaults to `0.5` for the current symmetric layout. If future
layouts use uneven left/right widths, pass a different ratio (for example
`0.4` or `0.6`) without reintroducing per-row axis measurement callbacks.

## Indicator State Rules

The overlay indicator model (`rowId`, `positionPercent`, `label`) is computed
from trip state:

- Pre-departure: first row, minutes until departure
- In transit: second row, minutes until arrival
- Completed: third row, label `"--"`

For pre-departure, we apply a small minimum offset (`0.06`) so the indicator
does not visually sit on top of the static marker at row start.

## Important Constraints

- `BlurView` must have explicit width/height.
- Overlay container uses `pointerEvents="none"` so card/timeline interactions
  are not blocked.
- Overlay renders only after required row+axis measurements are available.

## Future Notes

If additional timeline features need the same overlay behavior, extract shared
measurement/placement helpers from `VesselTripTimelineOverlay` into a reusable
timeline utility or hook while keeping `VerticalTimeline` primitive-focused.
