# Vessel Trip Timeline Layout Architecture

This document explains the current architecture for the vessel trip timeline.
The feature keeps the working full-surface blur overlay and uses a **literal
five-stage pipeline** in `utils/pipeline/`: each stage is a single module
whose output is the input for the next. That makes the data flow explicit and
easier to extend (e.g. for a future multi-stop day timeline) without
duplicating ordered-row mechanics per feature.

## High-Level Flow

Callers use a single entry point: `getTimelineRenderState(item, now?)`. It
runs the pipeline internally; only `TimelineRenderState` is exposed.

```mermaid
flowchart TD
  featureInput[FeatureInput trip + vesselLocation] --> getRenderState[getTimelineRenderState]
  getRenderState --> boundaries[1. boundaries]
  boundaries --> boundaryData[BoundaryData]
  boundaryData --> rows[2. rows]
  rows --> rowsWithGeometry[TimelineDocumentRow[]]
  rowsWithGeometry --> document[3. document]
  document --> timelineDocument[TimelineDocument]
  timelineDocument --> renderRows[4. renderRows]
  renderRows --> renderRowsOut[TimelineRenderRow[]]
  timelineDocument --> renderState[5. renderState]
  renderRowsOut --> renderState
  renderState --> renderStateOut[TimelineRenderState]
  getRenderState --> renderStateOut
  renderStateOut --> timelineContent[TimelineContent]
  timelineContent --> fullTrack[FullTimelineTrack]
  timelineContent --> rowShells[TimelineRowComponent rows]
  timelineContent --> overlayLayer[TimelineIndicatorOverlay]
```

## Pipeline (utils/pipeline/)

The pipeline is a **literal chain**: the output of one stage is the input for
the next. Each stage is a single file; any helpers used by that stage are
co-located in the same module.

| Stage | Module | Input | Output |
|-------|--------|--------|--------|
| 1 | `boundaries.ts` | `TimelineItem` | `BoundaryData` (points + fallback context) |
| 2 | `rows.ts` | `BoundaryData` + `TimelineItem` | `TimelineDocumentRow[]` |
| 3 | `document.ts` | rows + `TimelineItem` | `TimelineDocument` |
| 4 | `renderRows.ts` | `TimelineDocument` + `now` | `TimelineRenderRow[]` |
| 5 | `renderState.ts` | document + render rows + `TimelineItem` + `now` | `TimelineRenderState` |

The entry point `pipeline/index.ts` runs the stages in order and exports
`getTimelineRenderState`. The document and intermediate types are internal;
callers only see `TimelineRenderState`.

## Canonical Document Model

The feature's internal source of truth is a `TimelineDocument` produced by
pipeline stage 3 (`document.ts`). It is not part of the public API.

The base document and render-state **types** live in `utils/types.ts` (re-exported
by `@/components/Timeline`). `VesselTripTimeline` supplies feature-specific
boundary payloads, progress modes, labels, and telemetry rules.

The document contains:

- ordered `rows` (this feature uses three: origin dock, at-sea, destination dock)
- one `activeSegmentIndex` cursor

Each `TimelineDocumentRow` contains:

- `id`
- `segmentIndex`
- `kind`: `"at-dock"` or `"at-sea"`
- `startBoundary` / `endBoundary`
- `geometryMinutes`
- `fallbackDurationMinutes`
- `progressMode`: `"time"` or `"distance"`

Adjacent rows share boundary `TimePoint`s; the pipeline does not create a
separate presentation-row model—stage 4 derives render rows from the
document.

## Renderer + Overlay

After the pipeline, the UI layer is:

- **`components/TimelineContent.tsx`**
  - Receives render-ready rows and the active indicator from
    `getTimelineRenderState`.
  - Measures row bounds.
  - Renders the shared timeline rows in background mode.
  - Paints one absolute indicator overlay above the whole timeline.

## Why the Overlay Stays

The blur requirement is the main architectural constraint.

The active indicator can overlap adjacent rows, so rendering it inside just the
active row is not sufficient. Instead, the feature keeps one normal timeline
layer and one absolute overlay layer:

```text
View (timeline container)
└── BlurTargetView
    ├── FullTimelineTrack (absolute, full height)
    │   └── two bars: completed (0→topPx) + remaining (topPx→bottom)
    ├── TimelineRowComponent[]
    │   └── leftContent | center-marker | rightContent
    └── TimelineIndicatorOverlay (absolute inset-0)
        └── TimelineIndicator
```

The track and overlay share the same boundary notion. Both use `topPx`:

`topPx = rowLayout.y + rowLayout.height * clamp(positionPercent, 0, 1)`

- rows report measured `y` and `height` through `onRowLayout`
- the pipeline (renderState stage) decides which row owns the active indicator (`positionPercent`)
- `topPx` is computed once from active row layout + `positionPercent`
- `FullTimelineTrack` draws two bars: completed (0→topPx), remaining (topPx→bottom)
- `TimelineIndicatorOverlay` renders exactly one indicator at `topPx`

## Geometry vs Current State

The architecture now cleanly separates:

### Canonical geometry

- row ordering
- shared boundaries
- fallback durations
- progress mode

### Current render state

- active row
- boundary label tense
- countdown label
- active indicator position

This keeps `TimelineContent` focused on layout and rendering instead of feature
business logic.

## One label set per row (no end-boundary display)

Each row shows exactly one set of labels and one marker: its **start** boundary.
The end of a segment is not shown on that row; the **next** row's start is the
end of the previous segment. So there is no "ownership" of an end boundary for
display—each row owns only its start. The document still has `startBoundary` and
`endBoundary` for geometry (e.g. duration); the renderer only receives
`startBoundary` per row.

- **Three rows**: origin dock (arrive at origin), at-sea (depart origin → arrive destination), destination dock (arrive at destination). Each has a timeline dot at its start.
- **Final row**: The last row (destination dock) has `isFinalRow: true`. It has no duration-based height—only the space needed for the circle and its start labels (`minHeight: 0`, no flex growth).

## Shared Timeline Primitive Boundary

`src/components/Timeline` remains domain-agnostic.

The shared module now owns:

- generic document/render-state types (from `VesselTripTimeline/utils/types.ts`, re-exported by `@/components/Timeline`)

`VesselTripTimeline` still owns:

- the pipeline (`utils/pipeline/`: boundaries → rows → document → render rows → render state)
- boundary label copy and tense (in `renderRows.ts` / `renderState.ts`)
- time-vs-distance progress choice (in `renderState.ts`)
- overlay label content (e.g. `getMinutesUntil` in `renderState.ts`)
- blur-specific overlay rendering

For now, `VesselTripTimeline` intentionally renders `TimelineRowComponent`
directly instead of going through the higher-level `VerticalTimeline` API.
That is a deliberate choice:

- the feature needs row measurement
- the feature owns a full-surface overlay indicator
- the current public primitive API does not expose that overlay workflow cleanly

This keeps the shared primitive generic while letting `VesselTripTimeline`
manage its feature-specific blur overlay locally.

## Indicator State Rules

`utils/pipeline/renderState.ts` owns the current-state rules:

- `activeSegmentIndex` points at the active row
- `rows.length` means all rows are completed
- at-sea rows prefer distance-based progress when telemetry is available
- otherwise progress is time-based from the row boundary `TimePoint`s
- the first active dock row applies a small minimum offset (`0.06`) so the
  indicator does not sit directly on top of the static marker

## Indicator Position Animation

`positionPercent` still updates infrequently from Convex data. To avoid visible
jumps:

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
- Terminal abbreviations remain canonical in the document model and are only
  translated to display names in the UI layer.
