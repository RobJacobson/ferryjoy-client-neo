# TimelineFeatures — Overview

This feature renders ferry trip progress as visual timelines. Two sub-features share a common set of primitives:

- **ScheduledTrips**: Multi-leg journeys from the WSF schedule, with optional real-time overlay (actual/estimated times).
- **VesselTrips**: Active vessel trips with live progress (at-dock → at-sea).

Both converge on a shared **TripSegment** view model and the same timeline UI primitives.

---

## Structure

```
TimelineFeatures/
├── shared/           # Shared types, components, hooks, and utilities
├── ScheduledTrips/   # Schedule-based journeys (see ScheduledTrips/README.md for details)
└── VesselTrips/     # Active vessel trip list
```

### Data Flow (High Level)

1. **ScheduledTrips**: `useUnifiedTripsPageData` → journeys + maps → `ScheduledTripList` → `ScheduledTripCard` → `ScheduledTripTimeline` → `synthesizeTripSegments` → `TripSegment[]` → shared primitives.

2. **VesselTrips**: `useConvexVesselTrips` + `useConvexVesselLocations` + `useDelayedVesselTrips` → `VesselTripList` → `VesselTripCard` → `VesselTripTimeline` → `vesselTripToTripSegment` → `TripSegment` → shared primitives.

Both paths produce `TripSegment`, which is split into `AtDockSegment` / `AtSeaSegment` for rendering via `toAtDockSegment` / `toAtSeaSegment`.

---

## File Map (Quick Reference for Agents)

### shared/

| File | Purpose |
| :--- | :--- |
| `types.ts` | Shared types: `TimePoint`, `TerminalInfo`, `TripSegment`, `AtDockSegment`, `AtSeaSegment`, `Segment`, `TimelineBarStatus`, `ScheduledTripJourney`, `TimelineActivePhase`. |
| `config.ts` | Styling constants: colors, marker config, indicator config, segment layout, shadow styles. |
| `index.ts` | Public exports for shared components and types. |
| `TimelineBlock.tsx` | Layout wrapper for timeline blocks (flex-grow, min-width). |
| `TimelineBar.tsx` | Base progress bar component (track + fill). |
| `TimelineBarAtDock.tsx` | At-dock segment: time-based progress, indicator, labels. |
| `TimelineBarAtSea.tsx` | At-sea segment: distance/time progress, rocking indicator. |
| `TimelineIndicator.tsx` | Circular badge overlay showing minutes remaining; optional rocking animation. |
| `TimelineMarker.tsx` | Anchor + circle for timeline markers. |
| `TimelineMarkerContent.tsx` | Content slot for marker label and times. |
| `TimelineMarkerLabel.tsx` | Single-line label text. |
| `TimelineMarkerTime.tsx` | Formatted time with icon (scheduled/actual/estimated). |
| `SegmentBlockMarkers.tsx` | Composed markers: `ArriveCurrMarker`, `ArriveNextMarker`, `DepartCurrMarker`. |
| `hooks/useAnimatedProgress.ts` | Shared hook for spring-animated progress (0–1). |
| `hooks/useDelayedVesselTrips.ts` | Hold-window logic: keeps completed trips visible ~30s to avoid flicker. |
| `hooks/useUnifiedTripsPageData.ts` | Data coordinator for ScheduledTrips; consumes UnifiedTripsContext, builds maps and journeys. |
| `utils/index.ts` | Barrel: re-exports from buildJourneyChains, synthesizeTripSegments, tripTimeHelpers, timelineLayout. |
| `utils/buildJourneyChains.ts` | Walks `NextKey` chain to build multi-leg journeys from flat schedule rows. |
| `utils/synthesizeTripSegments.ts` | Maps raw segments + vessel data → `TripSegment[]` (status, phase, times). |
| `utils/segmentBlockHelpers.ts` | `toAtDockSegment`, `toAtSeaSegment`; `getDockBarStatus`, `getSeaBarStatus`, etc. |
| `utils/tripTimeHelpers.ts` | `getPredictedArriveNextTime`, `getBestDepartureTime`, `getBestArrivalTime`. |
| `utils/timelineLayout.ts` | `getTimelineLayout`: progress, duration, minutes remaining from status and times. |
| `utils/useRockingAnimation.ts` | Rocking animation for TimelineIndicator when vessel is at sea. |

### ScheduledTrips/

| File | Purpose |
| :--- | :--- |
| `index.ts` | Public API: useUnifiedTripsPageData, ScheduledTripCard, ScheduledTripList, ScheduledTripTimeline, types. |
| `types.ts` | Re-exports `Segment`, `ScheduledTripJourney`; defines `ScheduledTripListPageData`. |
| `ScheduledTripList.tsx` | Presentational list; loading/empty/ready states; maps journeys to cards. |
| `ScheduledTripCard.tsx` | Card wrapper: route header + ScheduledTripTimeline. |
| `ScheduledTripTimeline.tsx` | Composes markers and bars for multi-segment journeys; calls `synthesizeTripSegments`. |
| `README.md` | Detailed data flow, synthesis logic, and debugging notes. |

### VesselTrips/

| File | Purpose |
| :--- | :--- |
| `index.ts` | Exports `VesselsTripList` (alias for TripProgressList). |
| `VesselTripList.tsx` | List of active trips; uses useDelayedVesselTrips, Convex contexts. |
| `VesselTripCard.tsx` | Card wrapper: route header + VesselTripTimeline. |
| `VesselTripTimeline.tsx` | Single-leg timeline; uses `vesselTripToTripSegment` → shared primitives. |
| `vesselTripToTripSegment.ts` | Converts `VesselTripWithScheduledTrip` + `VesselLocation` → `TripSegment`. |

---

## Key Types

- **TripSegment**: Canonical view model for one leg (curr/next terminals, arrive/leave times, status, phase).
- **AtDockSegment** / **AtSeaSegment**: Subsets for dock vs sea blocks; derived via `toAtDockSegment` / `toAtSeaSegment`.
- **Segment**: Raw schedule row shape (from Convex); used in `synthesizeTripSegments` and `buildJourneyChains`.
- **ScheduledTripJourney**: Multi-leg journey shape (id, vesselAbbrev, routeAbbrev, departureTime, segments).
