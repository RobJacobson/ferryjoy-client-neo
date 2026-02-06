# Handoff: VesselTrips / ScheduledTrips Refactor & Phantom Indicator Fix

**Date:** February 2025  
**Branch:** add-scheduled-trip-indicator  
**Remaining Work:** (a) Fix phantom TimelineIndicator bug, (b) Implement Stage 7

---

## 1. Refactoring Overview

### Completed (Stages 1–6)

VesselTrips and ScheduledTrips were refactored to share code via the Timeline primitives:

- **Stage 1 – Shared constants:** `TIMELINE_CIRCLE_SIZE`, `TIMELINE_MARKER_CLASS` in `src/features/Timeline/config.ts`
- **Stage 2 – `useScheduledTripDisplayData`:** Hook in `src/features/ScheduledTrips/useScheduledTripDisplayData.ts` for fetching, vesselTripMap, and vessel location resolution
- **Stage 3 – Shared `TimelineSegmentLeg`:** Moved from ScheduledTrips to `src/features/Timeline/TimelineSegmentLeg.tsx`; `Segment` type in `src/features/Timeline/types.ts`
- **Stage 4 – Reverted:** TimelineMarkerLabel consolidation was reverted (added bloat without benefit)
- **Stage 5 – Shared TripCard:** `src/components/TripCard.tsx` used by VesselTripCard and ScheduledTripCard
- **Stage 6 – `vesselTripToSegment` + single-leg flow:** `src/features/VesselTrips/vesselTripToSegment.ts` converts VesselTrip → Segment; VesselTripTimeline renders one `TimelineSegmentLeg` with `isFirst`, `isLast`, `skipAtDock={false}`

### Architectural Principle

**VesselLocation is the PRIMARY source for vessel state.** VesselTrip and ScheduledTrips are SECONDARY for predictions and schedule data. All state flags (isAtOriginDock, isInTransitForSegment, isCorrectTrip) are derived from vesselLocation + displayTrip in `getSegmentLegDerivedState`.

---

## 2. Component Architecture

### Timeline Primitives

| File | Role |
|------|------|
| `TimelineSegmentLeg.tsx` | Renders one leg: origin at-dock bar (when isFirst), depart marker, at-sea bar, arrive marker, inter-segment at-dock bar (when !isLast) |
| `TimelineBarAtDock.tsx` | At-dock bar; shows indicator when `showIndicator ?? (status === "InProgress" && !isArrived && !isHeld)` |
| `TimelineBarAtSea.tsx` | At-sea bar; shows indicator when `showIndicator ?? (status === "InProgress" \|\| isArrived \|\| isHeld)` |
| `TimelineIndicator.tsx` | Progress dot with labels (vessel name, "At Dock X", "Arrived ❤️❤️❤️") |
| `utils.ts` | `getSegmentLegDerivedState`, `createVesselTripMap`, `getTimelineLayout` |

### Data Flow

**ScheduledTrips:**

1. `ScheduledTripTimeline` gets `vesselLocation` and `vesselTripMap` from `useScheduledTripDisplayData`
2. Maps over segments; each `TimelineSegmentLeg` gets `displayTrip = vesselTripMap.get(segment.DirectKey || segment.Key)`
3. `getSegmentLegDerivedState(segment, vesselLocation, displayTrip, tripArrivingAtOrigin)` produces `legState`

**VesselTrips:**

1. `VesselTripTimeline` receives `vesselLocation` and `trip` as props
2. Builds `segment` via `vesselTripToSegment(trip)` and `vesselTripMap = new Map([[trip.Key, trip]])`
3. Passes `displayTrip={trip}` to `TimelineSegmentLeg`

### Key Logic: `getSegmentLegDerivedState` (Timeline/utils.ts)

```ts
isAtOriginDock = vesselLocation.AtDock && vesselLocation.DepartingTerminalAbbrev === segment.DepartingTerminalAbbrev
isInTransitForSegment = !vesselLocation.AtDock && vessel matches segment direction (Departing + Arriving)
isCorrectTrip = vessel matches segment direction AND displayTrip.ScheduledDeparture === segment.DepartingTime
```

`isCorrectTrip` mixes vesselLocation terminals with displayTrip timing; both must agree for the “current” trip to be the one for this segment.

---

## 3. The Phantom TimelineIndicator Bug

### Symptoms

- An unwanted “arrived at dock” TimelineIndicator appears for **ORI**
- Occurs for **ANA→ORI** and **ANA→ORI→SHI**
- Does **not** occur for ANA→FRH or ANA→LOP
- Only for the **first trip of the day**
- Marker shows “Arrived at ORI”

### Where Indicators Can Appear

1. **Origin at-dock bar** (isFirst && !skipAtDock): “At Dock {segment.DepartingTerminalAbbrev}”, e.g. “At Dock ANA”
2. **At-sea bar**: “Arrived ❤️❤️❤️” when isArrived; label is “Arrived” near the destination marker
3. **Inter-segment at-dock bar** (!isLast): no `showIndicator` or `atDockAbbrev` passed; uses default `status === "InProgress" && !isArrived && !isHeld` — status is only Pending/Completed, so default is false

### Current showIndicator Logic (TimelineSegmentLeg)

**Origin at-dock (lines 121–126):**

```tsx
showIndicator={
  legState.isAtOriginDock &&
  legState.isCorrectTrip &&
  !!displayTrip &&
  !displayTrip.TripEnd
}
```

**At-sea (lines 211–220):**

```tsx
showIndicator={
  (legState.isInTransitForSegment && legState.isCorrectTrip && !!displayTrip) ||
  (!!displayTrip &&
    !!displayTrip.TripEnd &&
    displayTrip.ArrivingTerminalAbbrev === segment.ArrivingTerminalAbbrev &&
    legState.isCorrectTrip)
}
```

### Bug Analysis

The phantom indicator is ORI-specific and first-trip-specific. Likely contributors:

1. **Wrong displayTrip match:** A completed trip from another run (e.g. ANA→ORI→SHI) matching a segment (e.g. ANA→ORI) via Key/DirectKey when it shouldn’t
2. **isCorrectTrip mis-computed:** `vesselLocation` and `displayTrip` disagree (e.g. vessel at ORI, displayTrip from completed ANA→ORI)
3. **Multi-leg + DirectKey:** For ANA→ORI→SHI, segments share DirectKey; `displayTrip.ArrivingTerminalAbbrev` is the final destination (SHI). The at-sea condition checks `displayTrip.ArrivingTerminalAbbrev === segment.ArrivingTerminalAbbrev`, which is correct for per-segment matching
4. **First trip of the day:** Early runs, overnight at ORI, or SchedArriveCurr undefined for the first run could produce edge cases
5. **Hold window:** `useDelayedVesselTrips` freezes vesselLocation during the 30s hold; a stale location could make isCorrectTrip true when it shouldn’t be

### Fix Approach

**Do not fix by adding props (e.g. `showIndicator={false}`) to hide the indicator.**  
Find the underlying logic bug. Review:

- `getSegmentLegDerivedState` and when `isCorrectTrip` should be false
- How `displayTrip` is chosen for segments (DirectKey vs Key, sailing day, time)
- Whether a completed trip with `TripEnd` should ever drive an indicator when the vessel has moved to another run
- Whether the “first trip of the day” case needs special handling (e.g. missing SchedArriveCurr, overnight at ORI)

---

## 4. Stage 7: Extract `useVesselTripDisplayData`

### Goal

Create a hook that mirrors `useScheduledTripDisplayData` for VesselTrips, so `VesselTripTimeline` becomes presentational and all data resolution lives in the hook.

### Reference Implementation: `useScheduledTripDisplayData`

- Fetches `activeVesselTrips`, `vesselLocations`
- Uses `useDelayedVesselTrips` for hold logic
- Fetches completed trips via `getCompletedTripsForSailingDayAndTerminals`
- Builds `vesselTripMap` (completed → active → displayData)
- Resolves `vesselLocation` from displayData (hold) or live

### Proposed: `useVesselTripDisplayData`

**Location:** `src/features/VesselTrips/useVesselTripDisplayData.ts`

**Inputs:**

- `vesselAbbrev` (or `trip` with VesselAbbrev)
- Optional: `sailingDay`, `departingTerminalAbbrevs` if we need completed-trip context

**Outputs:**

- `vesselLocation: VesselLocation | undefined`
- `vesselTripMap: Map<string, VesselTrip>`
- Possibly `displayTrip: VesselTrip | undefined` for the given trip

**Behavior:**

- Same sources as `useScheduledTripDisplayData`: activeTrips, vesselLocations, displayData, completedTrips
- For a single vessel/trip, the hook should return the right vesselLocation (including hold-frozen state) and a vesselTripMap containing at least the current/display trip
- `VesselTripTimeline` should then consume this hook and pass results into `TimelineSegmentLeg`, similar to `ScheduledTripTimeline`

### Refactor Steps

1. Add `useVesselTripDisplayData.ts` alongside `useScheduledTripDisplayData.ts`
2. Implement the hook; consider reusing shared logic (e.g. building vesselTripMap) if useful
3. Update `VesselTripTimeline` to call the hook and use `vesselLocation`, `vesselTripMap`, and `displayTrip` instead of receiving them as props
4. Update callers of `VesselTripTimeline` to pass `vesselAbbrev` (or trip) instead of `vesselLocation` and `trip`; or keep props for backwards compatibility during migration
5. Run type-check and `check:fix`; verify existing behavior

---

## 5. Key Files Reference

| Path | Purpose |
|------|---------|
| `src/features/Timeline/TimelineSegmentLeg.tsx` | Main leg renderer; origin at-dock, at-sea, inter-segment bars; showIndicator logic |
| `src/features/Timeline/utils.ts` | `getSegmentLegDerivedState`, `createVesselTripMap`, layout helpers |
| `src/features/Timeline/TimelineBarAtDock.tsx` | At-dock bar; `showIndicator ?? (InProgress && !isArrived && !isHeld)` |
| `src/features/Timeline/TimelineBarAtSea.tsx` | At-sea bar; `showIndicator ?? (InProgress \|\| isArrived \|\| isHeld)` |
| `src/features/ScheduledTrips/useScheduledTripDisplayData.ts` | ScheduledTrips data hook |
| `src/features/ScheduledTrips/ScheduledTripTimeline.tsx` | Uses hook, maps segments to TimelineSegmentLeg |
| `src/features/VesselTrips/VesselTripTimeline.tsx` | Receives vesselLocation + trip; builds segment, vesselTripMap; delegates to TimelineSegmentLeg |
| `src/features/VesselTrips/vesselTripToSegment.ts` | VesselTrip → Segment |
| `src/features/VesselTrips/useDelayedVesselTrips.ts` | 30s hold; freezes vesselLocation during hold |

---

## 6. Checklist for New Agent

- [ ] **(a) Phantom indicator:** Trace logic for the ORI, first-trip case; fix the root cause (e.g. isCorrectTrip or displayTrip selection), not with extra props
- [ ] **(b) Stage 7:** Implement `useVesselTripDisplayData` and refactor `VesselTripTimeline` to use it
- [ ] Run `bun run type-check` and `bun run check:fix`
- [ ] Manually verify: first ANA→ORI and ANA→ORI→SHI of the day, ANA→FRH and ANA→LOP, vessel trip view
