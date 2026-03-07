# Vessel Trip Timeline Layout Architecture

This document explains the layout strategy for the vessel timeline,
with emphasis on the mirrored overlay layer used for the moving indicator.

## Mirrored Overlay Approach

The moving indicator must blur whatever is behind it, including the timeline
track. A row-local indicator previously caused z-order conflicts and unreliable
blur when crossing row boundaries. The mirrored overlay approach solves this:

- Timeline rows render normally in document order
- A separate **absolute overlay tree** is rendered above the entire timeline
- The overlay tree mirrors each row's height using the same `flexGrow` and `minHeight`
- Only the **active mirrored row** renders the indicator
- The indicator is positioned via `top: ${positionPercent * 100}%` inside the mirrored row
- Each indicator is wrapped in `BlurView`; one `BlurTargetView` wraps the timeline
- **No layout measurement** is required

This eliminates `useVerticalTimelineOverlayPlacement` and `VerticalTimelineIndicatorOverlay`
for this feature.

## Separation of Concerns

The feature is split into 2 layers:

1. **Pure model builder**
   - `adapters/buildTimelineModelFromTrip.ts`
   - Converts trip/location domain data into timeline row models.
   - No JSX is created here.
   - **Geometry vs labels**: Separates timeline layout times (using route-specific
     historical averages as fallbacks) from user-facing labels (using only
     actual/predicted times, showing "--" for missing data).

2. **Layout + mirrored overlay renderer**
   - `components/VesselTripTimelineOverlay.tsx`
   - Wraps timeline in `BlurTargetView`.
   - Renders rows via `TimelineRowComponent` with `renderMode="background"` in normal stacking order.
   - Renders a second absolute overlay tree that mirrors row sizing above the timeline.
   - Places the `BlurView`-wrapped indicator inside the active mirrored row only.
   - Derives active indicator from row timing + trip state at render time.

## Overlay Structure

At a high level:

```
View (timeline container)
└── BlurTargetView
    ├── TimelineRowComponent[]
    │   └── leftContent | axis (track + marker) | rightContent
    └── View (overlay layer: absoluteFillObject, pointerEvents="none")
        └── Mirrored row[]
            └── [spacer] | [center column with optional BlurView indicator] | [spacer]
```

The mirrored rows are not visual duplicates of the cards or track. They only
recreate the vertical geometry needed to position the active indicator in the
correct row without measuring layout.

Indicator position is still `top: ${positionPercent * 100}%` within the mirrored
center column. No global coordinate math is needed because the mirrored overlay
tree uses the same row sizing inputs as the rendered timeline rows.

## Why This Shape

This structure keeps the benefits of the refactor while avoiding the z-order
regression from a row-local overlay:

- The timeline track and row content keep their normal sibling stacking
- The indicator lives in a single top-level overlay layer, so it can paint above
  markers and content in adjacent rows
- The feature still avoids `onLayout` measurement and cross-tree coordinate math
- Indicator label centering is handled entirely inside the overlay circle

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

- `BlurTargetView` wraps the entire timeline for Android blur support.
- `BlurView` around each indicator receives `blurTarget` ref.
- The overlay layer uses `pointerEvents="none"` so card/timeline interactions
  are not blocked.
- Mirrored rows must use the same sizing inputs as timeline rows:
  `getDurationMinutes(row)`, `row.minHeight`, and `MIN_SEGMENT_PX`.
- Indicator wrapper uses explicit width/height for stable centering.
