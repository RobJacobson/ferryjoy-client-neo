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

The feature is split into 3 layers:

1. **Pure model builder**
   - `adapters/buildTimelineModelFromTrip.ts`
   - Converts trip/location domain data into timeline row models.
   - No JSX is created here.
   - **Geometry vs labels**: Separates timeline layout times (using route-specific
     historical averages as fallbacks) from user-facing labels (using only
     actual/predicted times, showing "--" for missing data).

2. **Layout + overlay renderer**
   - `components/VesselTripTimelineOverlay.tsx`
   - Renders `VerticalTimeline` plus one absolute blur-backed indicator.
   - Performs final slot placement and card component selection from row phase
     plus trip/location domain data.
   - Derives the active overlay indicator from row timing + trip state at render
     time.

3. **Overlay measurement hook**
   - `components/hooks/useTimelineOverlayPlacement.ts`
   - Owns row measurement state plus timeline-width measurement.
   - Returns grouped props (`timelineContainerProps`, `timelineProps`) and
     computed overlay placement.

This keeps business logic testable and rendering logic explicit while keeping
layout measurement concerns isolated.

## Coordinate System and Measurement

`VerticalTimeline` exposes an optional callback:

- `onRowLayout(rowId, { y, height })`

`useTimelineOverlayPlacement` stores row values by `rowId`, measures timeline
container width once, and computes overlay position:

- `top = rowY + rowHeight * positionPercent`
- `left = timelineWidth * axisXRatio`

The overlay dot is centered at that point by subtracting half its size via
negative margins.

`axisXRatio` defaults to `0.5` for the current symmetric layout. If future
layouts use uneven left/right widths, pass a different ratio (for example
`0.4` or `0.6`) without reintroducing per-row axis measurement callbacks.

## Geometry vs Labels

Timeline calculations separate **layout geometry** from **user-facing labels**:

### Geometry (for rendering)
- Timeline segment start/end times used for visual layout and positioning
- Uses route-specific historical averages from ML config as fallbacks when
  actual/predicted data is unavailable
- Ensures the UI can always render a complete timeline structure
- Examples:
  - CLI→MUK: 16.38 min at-dock, 14.6 min at-sea
  - MUK→CLI: 15.4 min at-dock, 14.6 min at-sea

### Labels (for user display)
- Time remaining indicator labels (e.g., "13m", "--")
- Only use actual departure times, actual ETA, or ML predictions
- Never display estimates from historical averages
- Show "--" when actual/predicted data is unavailable
- This ensures users only ever see accurate timing information

This separation prevents misleading displays while maintaining visual continuity in
the UI.

## Indicator State Rules

The overlay indicator model (`rowId`, `positionPercent`, `label`) is computed
from trip state:

- **Pre-departure**: first row, minutes until departure from actual/predicted
  data, or "--" if data is unavailable
- **In transit**: second row, minutes until arrival from actual/predicted data,
  or "--" if data is unavailable
- **Completed**: third row, label "--"

Labels only use actual departure times, actual ETA, or ML predictions.
Historical averages are used for geometry fallbacks only, never displayed to users.

For pre-departure, we apply a small minimum offset (`0.06`) so the indicator
does not visually sit on top of the static marker at row start.

## Important Constraints

- Indicator wrapper uses explicit width/height for stable centering.
- Overlay container uses `pointerEvents="none"` so card/timeline interactions
  are not blocked.
- Overlay renders only after required row+width measurements are available.

## Future Notes

If additional timeline features need the same overlay behavior, consider
promoting `useTimelineOverlayPlacement` into a shared timeline utility while
keeping `VerticalTimeline` primitive-focused.
