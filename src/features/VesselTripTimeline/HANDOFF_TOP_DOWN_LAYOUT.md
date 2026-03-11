# Handoff: Implement Top-Down Timeline Layout

**Status:** Not yet implemented. The timeline still uses **bottom-up** layout (flex + `onRowLayout` callbacks). This note describes how to switch to **top-down** layout so the parent computes row heights and no row measurement is needed.

---

## Current State (Bottom-Up)

- **Container:** Fixed height `CONTAINER_HEIGHT_PX` (350) in [TimelineContent.tsx](components/TimelineContent.tsx).
- **Rows:** Rendered via [VesselTripTimelineRow](components/VesselTripTimelineRow.tsx), which wraps shared [TimelineRow](src/components/Timeline/TimelineRow.tsx). The shared row uses **flex**: `flexGrow: durationMinutes`, `minHeight` from theme or override (final row gets `minHeight: 0`).
- **Measurement:** Each row reports its laid-out `y` and `height` via `onRowLayout`. TimelineContent stores these in `rowLayouts` state.
- **Consumers of row layout:**
  - `getBoundaryTopPx(activeIndicator, rowLayouts)` → `boundaryTopPx` → [FullTimelineTrack](components/FullTimelineTrack.tsx) (where to draw completed vs remaining track bars).
  - `rowLayouts` → [TimelineIndicatorOverlay](components/TimelineIndicatorOverlay.tsx) (position of the moving indicator: `layout.y + layout.height * positionPercent`).
- **Problems:** Callbacks, async layout, state for bounds, overlay can’t render until active row has measured.

---

## Target State (Top-Down)

- **Parent computes all row heights** from `CONTAINER_HEIGHT_PX`, `renderRows` (geometryMinutes, isFinalRow), and theme (e.g. minSegmentPx for final row).
- **No `onRowLayout`**, no `rowLayouts` state. Row bounds are a **pure function** of inputs.
- **Each row receives an explicit height** (pixels) from the parent. The shared row (or feature row) must support a height prop when using top-down layout.
- **`boundaryTopPx`** and overlay position are computed from the same computed bounds (no measurement).

---

## Implementation Steps

### 1. Compute row heights and bounds in TimelineContent

Add a function (or inline logic) that, given:

- `containerHeightPx`: 350
- `rows`: render rows with `geometryMinutes`, `isFinalRow`, `id`
- `minSegmentPx`: e.g. from TIMELINE_THEME (32) for the final row height

returns:

- **Per-row height (px):**
  - For non–final rows: allocate by proportion of duration.  
    `totalDurationMinutes = sum(rows where !row.isFinalRow, r => r.geometryMinutes)`.  
    If `totalDurationMinutes <= 0`, treat all non-final rows as equal or use fallback.  
    Reserve a fixed height for the final row, e.g. `finalRowHeightPx = minSegmentPx` (or a named constant).  
    `availableForDuration = containerHeightPx - finalRowHeightPx`.  
    For each non–final row: `heightPx = (row.geometryMinutes / totalDurationMinutes) * availableForDuration`.  
    Use integer heights and assign any rounding remainder to the last duration row so heights sum exactly to `containerHeightPx`.
  - For the final row: `heightPx = finalRowHeightPx` (e.g. `minSegmentPx`).

- **Row layout map:** For each row, `y` = sum of all previous row heights, `height` = that row’s `heightPx`. Build `Record<string, RowLayoutBounds>` keyed by `row.id` (same shape as current `rowLayouts`).

Call this at render time (no state). Use the resulting map as the single source of truth for:

- `boundaryTopPx = getBoundaryTopPx(activeIndicator, computedRowLayouts)`
- Passing `rowLayouts={computedRowLayouts}` to TimelineIndicatorOverlay
- Passing each row’s `heightPx` into the row component (see below).

Handle edge cases: no rows; all rows final; `totalDurationMinutes` 0 (e.g. all duration rows have 0 geometryMinutes).

### 2. Support explicit height on the row component

Today the shared [TimelineRow](../../components/Timeline/TimelineRow.tsx) only supports **flex** sizing via `durationMinutes` and `minHeight`. For top-down, the parent must be able to set an **explicit height** (pixels).

**Option A (recommended):** Add an optional prop to the shared TimelineRow, e.g. `heightPx?: number`. When `heightPx` is defined:

- Use `style={{ height: heightPx }}` (or include height in the style object from `getVerticalRowStyle`).
- Do not use flex for sizing (e.g. set `flexGrow: 0` when heightPx is set).
- Omit or no-op `onLayout` for the parent’s layout logic when using top-down (parent already knows bounds). You may keep `onRowLayout` optional so other features can still use bottom-up if needed.

**Option B:** Keep the shared row as-is and add a **feature-only** wrapper that applies an explicit height style around the shared row (e.g. a View with `height: heightPx` containing the TimelineRow with flex disabled). Option A is cleaner and keeps one row component.

Update [VesselTripTimelineRow](components/VesselTripTimelineRow.tsx) to accept an optional `heightPx` and pass it through to TimelineRowComponent. When `heightPx` is provided, do not pass `onRowLayout` (or the shared row can ignore layout callback when heightPx is set).

### 3. TimelineContent: use computed bounds and remove measurement

In [TimelineContent.tsx](components/TimelineContent.tsx):

- **Remove** `rowLayouts` state and `onRowLayout` callback entirely.
- **Compute** `computedRowLayouts` (and per-row `heightPx`) from `renderRows` and `CONTAINER_HEIGHT_PX` (and theme) as in step 1.
- **Use** `computedRowLayouts` for:
  - `boundaryTopPx = getBoundaryTopPx(activeIndicator, computedRowLayouts)`
  - `rowLayouts={computedRowLayouts}` for TimelineIndicatorOverlay.
- **Pass** to each row the computed `heightPx` for that row (and remove `onRowLayout` from row props).

After this, no row ever reports layout; the overlay and track use the same computed bounds, so the indicator can render immediately (no “wait for measure”).

### 4. Types and LAYOUT_ARCHITECTURE

- **RowLayoutBounds** and **RowLayoutBounds**-keyed maps stay as-is; they now hold **computed** bounds instead of measured ones.
- **LAYOUT_ARCHITECTURE.md:** Update the “Renderer + overlay” and “Why the Overlay Stays” sections to describe **top-down** layout: parent computes row heights from container height and geometry; no `onRowLayout`; overlay and track use the same computed bounds. Remove or rephrase any “rows report measured y and height” and “indicator renders only after active row has measured bounds”.

### 5. Optional cleanup

- If the shared TimelineRow’s `onRowLayout` is only used by this feature and you’ve switched to top-down, you can keep it optional for future use or remove it from the shared API if no other callers exist (grep for `onRowLayout`).
- Reanimated `LinearTransition` on the row: it will still animate when the row’s **height** (the number you pass) changes; no change required.

---

## Files to Touch (Summary)

| File | Changes |
|------|--------|
| [TimelineContent.tsx](components/TimelineContent.tsx) | Add row height/bounds computation; remove `rowLayouts` state and `onRowLayout`; pass `heightPx` and computed `rowLayouts` to children. |
| [VesselTripTimelineRow.tsx](components/VesselTripTimelineRow.tsx) | Accept optional `heightPx`; pass to shared row; omit `onRowLayout` when using top-down. |
| [TimelineRow.tsx](../../components/Timeline/TimelineRow.tsx) (shared) | Add optional `heightPx`; when set, use explicit height style and no flex-based height; optionally skip or no-op onLayout when heightPx is set. |
| [TimelineIndicatorOverlay.tsx](components/TimelineIndicatorOverlay.tsx) | No API change; it already receives `rowLayouts`; they will just be computed instead of measured. |
| [LAYOUT_ARCHITECTURE.md](LAYOUT_ARCHITECTURE.md) | Document top-down layout and remove bottom-up / measurement wording. |

---

## Verification

- Run `bun run check:fix` and `bun run type-check`.
- Manually confirm: track completed/remaining split and moving indicator position match row boundaries and progress.
- Confirm the indicator appears without delay (no “wait for layout”).
- Resize or change data and confirm layout and overlay update correctly from the same computed bounds.

---

## Reference: Current Data Flow

- **Render rows** come from `selectTimelineRenderState`: each has `id`, `geometryMinutes`, `isFinalRow`, `startBoundary`, etc.
- **CONTAINER_HEIGHT_PX** = 350 in TimelineContent.
- **RowLayoutBounds** = `{ y: number; height: number }`.
- **getBoundaryTopPx(activeIndicator, rowLayouts):** returns `rowLayouts[activeIndicator.rowId].y + rowLayouts[activeIndicator.rowId].height * clamp(activeIndicator.positionPercent, 0, 1)` (with null checks).
