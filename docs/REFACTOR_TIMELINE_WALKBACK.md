# Timeline Refactor: Walk Back to Feature-Owned Composition

## Goal

Return to the previous architecture where **ScheduledTrips and VesselTrips decide what to display** and **Timeline provides only slim UX primitives**. Composition and time selection live in the features; Timeline is Marker, AtDockBar, AtSeaBar, DisplayTime (and layout/indicator internals).

## Target Structure

### VesselTrips (single-leg)

VesselTrips composes the timeline and owns all content:

```tsx
<>
  <TimelineMarker><ArriveCurrLabel trip={trip} /></TimelineMarker>
  <TimelineBarAtDock startTimeMs={...} endTimeMs={...} status={...} ... />
  <TimelineMarker><DepartCurrLabel ... /></TimelineMarker>
  <TimelineBarAtSea startTimeMs={...} endTimeMs={...} status={...} ... />
  <TimelineMarker><DestinationArriveLabel ... /></TimelineMarker>
</>
```

- **Time selection**: VesselTrips computes `arriveCurrTime`, `departCurrTime`, `predictedArrivalTime`, `departurePrediction`, `arrivalPrediction` (e.g. via `getBestDepartureTime`, `getBestArrivalTime`, `getPredictedDepartCurrTime`, `getPredictedArriveNextTime`) and passes them as **props** to the bars.
- **Marker content**: VesselTrips defines `ArriveCurrLabel`, `DepartCurrLabel`, `DestinationArriveLabel` (or any custom children). Timeline only renders `<TimelineMarker>{children}</TimelineMarker>`.

### ScheduledTrips (multi-segment)

ScheduledTrips composes one “leg” per segment using the same primitives:

- For each segment: optional **origin arrive marker + at-dock bar**, then **depart marker**, **at-sea bar**, **arrive marker**, optional **next at-dock bar**.
- **What to display**: ScheduledTrips (or a ScheduledTrips-owned component like `ScheduledTripLeg`) computes times and status from `displayState`, `vesselTripMap`, `vesselLocation`, and passes flat props to `TimelineBarAtDock` / `TimelineBarAtSea`. Marker children are defined in ScheduledTrips (e.g. inside `ScheduledTripLeg`).

### Timeline (slim)

- **TimelineMarker**: circle + optional `children` (zero width).
- **TimelineBarAtDock**: flat props `startTimeMs`, `endTimeMs`, `status`, `predictionEndTimeMs?`, `isArrived?`, `isHeld?`, `showIndicator?`, `vesselName?`, `atDockAbbrev?`. Renders bar + optional indicator; no Segment/VesselTrip.
- **TimelineBarAtSea**: same idea + `departingDistance`, `arrivingDistance`, `speed`, `animate`.
- **TimelineDisplayTime**: presentational time label.
- **TimelineSegment**: optional layout wrapper (flexGrow from duration, minWidth).
- **Utils**: `getTimelineLayout`, `getSegmentLegDerivedState`, `getBestDepartureTime`, `getBestArrivalTime`, etc. stay in Timeline for reuse; **callers** use them to build props and content.

No “god” component: **TimelineSegmentLeg is removed**. Resolution (`activeKey`, `activePhase`, `statusByKey`) stays in ScheduledTrips (e.g. `computePageDisplayState` / `resolveTimeline`); the leg is either inlined in `ScheduledTripTimeline` or a **ScheduledTrips** component `ScheduledTripLeg` that uses only Timeline primitives.

---

## Plan (Steps)

### 1. Timeline bars: flat props only

- **TimelineBarAtDock** and **TimelineBarAtSea** accept **flat props** (e.g. `startTimeMs`, `endTimeMs`, `status`, `predictionEndTimeMs?`, `isArrived?`, `isHeld?`, `showIndicator?`, plus display props). No single `state: TimelineSegmentState` prop.
- Internally they call `getTimelineLayout(...)` and render `TimelineBar` + `TimelineIndicator` (and optionally `TimelineSegment` for layout).  
- **Done on branch**: Bar components were updated to flat props.

### 2. VesselTrips: own composition and labels

- **VesselTripTimeline** renders exactly: `Marker → AtDockBar → Marker → AtSeaBar → Marker`.
- VesselTrips selects times (arrive/depart/predictions) and passes them as props to the bars.
- Marker content is implemented in VesselTrips (e.g. `ArriveCurrLabel`, `DepartCurrLabel`, `DestinationArriveLabel`).
- No `TimelineSegmentLeg`, no `resolveTimeline` in VesselTrips, no `vesselTripToSegment` for rendering.  
- **Done on branch**: `src/features/VesselTrips/VesselTripTimeline.tsx` added with this structure.

### 3. ScheduledTrips: own leg composition

- **ScheduledTripTimeline** (or equivalent) maps over segments and, per segment, renders the same primitive pattern: origin marker + at-dock bar (if first), depart marker, at-sea bar, arrive marker, next at-dock bar (if not last).
- “What to display” and “which times/status” are computed in ScheduledTrips (e.g. in `ScheduledTripLeg` or inline). Use `getSegmentLegDerivedState`, `timelineState`, `vesselTripMap`, `vesselLocation` to build **flat props** for each bar and content for each marker.
- **Done on branch**: `src/features/ScheduledTrips/ScheduledTripLeg.tsx` added; it uses only Timeline primitives and flat bar props.

### 4. ScheduledTripTimeline: use ScheduledTripLeg

- Replace `<TimelineSegmentLeg ... />` with `<ScheduledTripLeg ... />` in the component that renders the timeline (e.g. `ScheduledTripTimelineContent`). Pass `predictionTrip={index === 0 ? inboundTripForFirstSegment : undefined}` (and existing segment/trip/state props).  
- **To do on branch**: In the file that currently imports and renders `TimelineSegmentLeg`, switch the import to `ScheduledTripLeg` and adjust props as above.

### 5. Remove TimelineSegmentLeg and clean exports

- **Delete** `src/features/Timeline/TimelineSegmentLeg.tsx`.
- **Timeline index**: Remove export of `TimelineSegmentLeg`. Keep exports for `TimelineBarAtDock`, `TimelineBarAtSea`, `TimelineMarker`, `TimelineDisplayTime`, `resolveTimeline` (if still used by ScheduledTrips for types only), and `types` (e.g. `Segment`, `TimelineSegmentStatus`).
- **VesselTrips**: Remove `vesselTripToSegment` and any `resolveTimeline` usage for rendering (already done in the new VesselTripTimeline).
- **ScheduledTrips**: Ensure it no longer imports `TimelineSegmentLeg` (use `ScheduledTripLeg` only).

---

## Reference: Old VesselTripTimeline (git 69ffcc4)

Structure to mirror:

- Marker (ArriveCurrLabel) → TimelineBarAtDock (flat start/end/status) → Marker (DepartCurrLabel) → TimelineBarAtSea (flat props) → Marker (DestinationArriveLabel).
- Time selection in the component with `getPredictedDepartCurrTime`, `getBestDepartureTime`, `getBestArrivalTime`, `getPredictedArriveNextTime`.
- Label components receive `trip`, `vesselLocation`, predictions and render `Text` + `TimelineDisplayTime`.

---

## Summary

| Item | Owner | Responsibility |
|------|--------|----------------|
| What to show (which markers/bars, which segment) | VesselTrips / ScheduledTrips | Composition and ordering |
| Which times (actual / predicted / scheduled) | VesselTrips / ScheduledTrips | Time selection, passed as props |
| Marker content (labels, times in markers) | VesselTrips / ScheduledTrips | Children of `TimelineMarker` |
| Bar progress, layout, indicator UI | Timeline | `TimelineBarAtDock`, `TimelineBarAtSea` (slim, prop-driven) |
| Shared time/derived helpers | Timeline utils | Reused by both features |

After the walk-back, Timeline is no longer a “god” layer; it only provides presentational building blocks and shared utilities.
