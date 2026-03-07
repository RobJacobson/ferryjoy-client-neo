# Vessel Trip Timeline Layout Architecture

This document explains the layout strategy for the vessel timeline,
with emphasis on the indicator overlay layer used for the moving indicator.

## Indicator Overlay Approach

The moving indicator must blur whatever is behind it, including the timeline
track. A row-local indicator previously caused z-order conflicts and unreliable
blur when crossing row boundaries. The indicator overlay approach solves this:

- Timeline rows render normally in document order
- A separate **absolute overlay tree** is rendered above the entire timeline
- Timeline rows report layout via `onRowLayout` (y, height per row)
- When **row layouts are available for all rows**, overlay rows use absolute
  positioning (`top`, `height`) from that measurement so they align exactly
  with the timeline rows; otherwise overlay rows fall back to the same
  `flexGrow` and `minHeight` as timeline rows
- Only the **active indicator row** renders the indicator
- The indicator is positioned via `top: ${positionPercent * 100}%` and
  `left: "50%"` (with negative margins) inside the indicator row center column
- Each indicator is wrapped in `BlurView`; one `BlurTargetView` wraps the timeline

This alignment ensures the indicator sits on the track tip: timeline row
heights are content-driven, so measured bounds avoid vertical drift when overlay
rows would otherwise be sized only by flex.

This eliminates `useVerticalTimelineOverlayPlacement` and
`VerticalTimelineIndicatorOverlay` for this feature.

## Separation of Concerns

The feature is split into 2 layers:

1. **Pure model builder**
   - `adapters/buildTimelineModelFromTrip.ts`
   - Converts trip/location domain data into timeline row models.
   - No JSX is created here.
   - **Geometry vs labels**: Separates timeline layout times (using route-specific
     historical averages as fallbacks) from user-facing labels (using only
     actual/predicted times, showing "--" for missing data).

2. **Layout + indicator overlay renderer**
   - `components/VesselTripTimelineOverlay.tsx` – Main orchestrator. Wraps timeline in
     `BlurTargetView`, derives active indicator via `utils/deriveOverlayIndicator`,
     maps presentation rows to timeline rows, renders `TimelineRowComponent` with
     `onRowLayout` to collect row bounds, and `TimelineIndicatorOverlay` with
     `rowLayouts` for alignment.
   - `components/TimelineIndicatorOverlay.tsx` – Indicator row overlay layer.
     Accepts optional `rowLayouts`; when present for all rows, overlay rows use
     measured `y`/`height` for exact alignment. Renders rows that mirror timeline
     geometry; only the active row renders the indicator.
   - `components/TimelineIndicator.tsx` – BlurView + label for the active row;
     position animated via `hooks/useAnimatedProgress` and Reanimated spring.
   - `components/RowContentLabel.tsx` – Label content for row slots (terminal names).
   - `components/RowContentTimes.tsx` – Time events content for row slots.
   - `utils/deriveOverlayIndicator.ts` – Pure function that derives active overlay
     indicator from rows and trip state.

## Overlay Structure

At a high level:

```
View (timeline container)
└── BlurTargetView
    ├── TimelineRowComponent[]
    │   └── leftContent (RowContentLabel) | axis (track + marker) | rightContent
    │       (RowContentTimes)
    └── TimelineIndicatorOverlay (inset-0, z-10, pointerEvents="none")
        └── Indicator row[]
            └── [spacer] | [center column with optional TimelineIndicator] | [spacer]
```

The indicator rows are not visual duplicates of the cards or track. They
recreate the vertical geometry needed to position the active indicator. When
`rowLayouts` is complete, overlay rows are absolutely positioned with the
measured `y` and `height` of each timeline row so the indicator aligns with
the track tip; otherwise overlay rows use the same sizing inputs as the
timeline (`getDurationMinutes`, `row.minHeight`, `MIN_SEGMENT_PX`).

Indicator position is `top: ${positionPercent * 100}%` and `left: "50%"` (with
`marginTop`/`marginLeft` for centering) within the indicator row center column.
`TimelineIndicator` handles the BlurView and label. No global coordinate math
is needed: either measured row bounds or the same flex/minHeight inputs align
the overlay with the timeline.

## Why This Shape

This structure keeps the benefits of the refactor while avoiding the z-order
regression from a row-local overlay:

- The timeline track and row content keep their normal sibling stacking
- The indicator lives in a single top-level overlay layer, so it can paint above
  markers and content in adjacent rows
- Minimal row layout measurement (y, height per row) aligns overlay rows with
  content-driven timeline row heights; no cross-tree coordinate math
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

## Indicator position animation

`positionPercent` is derived from trip and vessel location data that updates
infrequently (e.g. every 5 seconds from Convex). If the indicator position
were applied directly, it would jump every time new data arrives.

To smooth motion, the indicator uses **Reanimated 4** spring animation:

- **`hooks/useAnimatedProgress.ts`** – Exposes a `SharedValue` that animates
  toward the latest `positionPercent`. At 0 and 1 it jumps immediately (no
  overshoot at segment boundaries); for values in between it uses
  `withSpring` so the indicator glides between updates.
- **`TimelineIndicator.tsx`** – Wraps the indicator in Reanimated’s
  `Animated.View`, uses `useAnimatedProgress(positionPercent)` and
  `useAnimatedStyle` to drive `top` from the shared value. Layout uses
  inline `style` (not only `className`) so positioning remains correct on
  web (see `docs/animated-view-classname-web-bug.md`).

Animation runs on the UI thread, so smooth movement does not depend on
high-frequency JS updates; a few data updates per minute are enough.

## Important Constraints

- `BlurTargetView` wraps the entire timeline for Android blur support.
- `BlurView` around each indicator receives `blurTarget` ref.
- `TimelineIndicatorOverlay` uses `pointerEvents="none"` so card/timeline
  interactions are not blocked.
- When `rowLayouts` is provided for all rows, overlay rows use explicit
  `top` and `height` from measurement; otherwise they use the same sizing
  inputs as timeline rows: `getDurationMinutes(row)`, `row.minHeight`, and
  `MIN_SEGMENT_PX`.
- Indicator is centered horizontally in the center column via `left: "50%"`
  and `marginLeft: -sizePx/2`; vertically via `top: ${positionPercent * 100}%`
  and `marginTop: -sizePx/2`. Indicator wrapper uses explicit width/height for
  stable centering.
