# Vessel Trip Timeline Layout Architecture

This document explains the layout strategy for the vessel timeline,
with emphasis on the indicator overlay layer used for the moving indicator.

## Indicator Overlay Approach

The moving indicator must blur whatever is behind it, including the timeline
track. A row-local indicator previously caused z-order conflicts and unreliable
blur when crossing row boundaries. The indicator overlay approach solves this:

- Timeline rows render normally in document order
- A separate **absolute overlay tree** is rendered above the entire timeline
- The overlay tree mirrors each row's height using the same `flexGrow` and `minHeight`
- Only the **active indicator row** renders the indicator
- The indicator is positioned via `top: ${positionPercent * 100}%` inside the indicator row
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

2. **Layout + indicator overlay renderer**
   - `components/VesselTripTimelineOverlay.tsx` – Main orchestrator. Wraps timeline in
     `BlurTargetView`, derives active indicator via `utils/deriveOverlayIndicator`,
     maps presentation rows to timeline rows, renders `TimelineRowComponent` and
     `TimelineIndicatorOverlay`.
   - `components/TimelineIndicatorOverlay.tsx` – Indicator row overlay layer.
     Renders rows that mirror timeline geometry; only the active row renders the
     indicator.
   - `components/TimelineIndicator.tsx` – BlurView + label for the active row.
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

The indicator rows are not visual duplicates of the cards or track. They only
recreate the vertical geometry needed to position the active indicator in the
correct row without measuring layout.

Indicator position is `top: ${positionPercent * 100}%` within the indicator row
center column. `TimelineIndicator` handles the BlurView and label. No global
coordinate math is needed because the overlay tree uses the same row
sizing inputs (`getDurationMinutes`, `row.minHeight`, `MIN_SEGMENT_PX`) as the
rendered timeline rows.

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
- `TimelineIndicatorOverlay` uses `pointerEvents="none"` so card/timeline
  interactions are not blocked.
- Indicator rows must use the same sizing inputs as timeline rows:
  `getDurationMinutes(row)`, `row.minHeight`, and `MIN_SEGMENT_PX`.
- Indicator wrapper uses explicit width/height for stable centering.
