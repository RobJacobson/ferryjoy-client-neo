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
- When the **active row layout is available**, the overlay converts the
  active row's local progress into a single container-relative Y position:
  `rowLayout.y + rowLayout.height * positionPercent`
- The overlay renders exactly **one active indicator**
- The indicator is positioned via absolute `top` in pixels and `left: "50%"`
  (with negative margins) inside the full overlay container
- Each indicator is wrapped in `BlurView`; one `BlurTargetView` wraps the timeline

This alignment ensures the indicator sits on the track tip: timeline row
heights are content-driven, so measured bounds are the only vertical source of
truth and avoid drift from duplicated overlay sizing rules.

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
  - `components/TimelineIndicatorOverlay.tsx` – Single-indicator overlay layer.
    Reads the active row layout from `rowLayouts`, converts row-local progress
    into container-relative `top` pixels, and renders exactly one indicator.
  - `components/TimelineIndicator.tsx` – BlurView + label for the active row;
    absolute `top` is animated via `hooks/useAnimatedProgress` and Reanimated
    spring.
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
        └── TimelineIndicator (single absolute child)
```

The overlay does not duplicate the timeline rows. Instead, it reads the active
row's measured `y` and `height`, converts row-local progress into one absolute
Y position, and places a single indicator at that coordinate. Horizontal
centering remains `left: "50%"` with negative margins so the indicator stays on
the shared axis center.

Indicator position is `top: rowLayout.y + rowLayout.height * positionPercent`
and `left: "50%"` (with `marginTop`/`marginLeft` for centering) inside the full
overlay container. `TimelineIndicator` handles the BlurView and label. The only
coordinate math needed is the row-local-to-container Y conversion.

## Why This Shape

This structure keeps the benefits of the refactor while avoiding the z-order
regression from a row-local overlay:

- The timeline track and row content keep their normal sibling stacking
- The indicator lives in a single top-level overlay layer, so it can paint above
  markers and content in adjacent rows
- Minimal row layout measurement (y, height for the active row) aligns the
  indicator with content-driven timeline row heights
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
  toward the latest absolute `top` position. Callers can opt into an immediate
  jump at segment boundaries; otherwise it uses `withSpring` so the indicator
  glides between updates.
- **`TimelineIndicator.tsx`** – Wraps the indicator in Reanimated’s
  `Animated.View`, uses `useAnimatedProgress(topPx, shouldJump)` and
  `useAnimatedStyle` to drive pixel `top` from the shared value. Layout uses
  inline `style` (not only `className`) so positioning remains correct on
  web (see `docs/animated-view-classname-web-bug.md`).

Animation runs on the UI thread, so smooth movement does not depend on
high-frequency JS updates; a few data updates per minute are enough.

## Important Constraints

- `BlurTargetView` wraps the entire timeline for Android blur support.
- `BlurView` around each indicator receives `blurTarget` ref.
- `TimelineIndicatorOverlay` uses `pointerEvents="none"` so card/timeline
  interactions are not blocked.
- The overlay must stay in the same positioned ancestor as the measured rows so
  `onRowLayout`'s `y` values remain valid.
- The indicator renders once the active row has measured bounds available.
- Indicator is centered horizontally in the center column via `left: "50%"`
  and `marginLeft: -sizePx/2`; vertically via absolute `top` pixels
  and `marginTop: -sizePx/2`. Indicator wrapper uses explicit width/height for
  stable centering.
