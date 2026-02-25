# Phase 2 Handoff: TimelineFeatures Refactor

**For:** New agent  
**Date:** February 2025  
**Prerequisite:** Phase 1 complete (UnifiedTripsContext, backend queries, helpers)

---

## 1. Objective

Refactor TimelineFeatures to use UnifiedTripsContext as the primary data source. Make components **purely presentational** where possible: they receive pre-joined data and use map/reduce/filter to shape it for display. Remove data-managing logic from components.

---

## 2. What Phase 1 Delivered

### 2.1 UnifiedTripsContext

- **Location:** `src/data/contexts/convex/UnifiedTripsContext.tsx`
- **Provider:** `UnifiedTripsProvider({ routeAbbrev, tripDate, children })`
- **Hook:** `useUnifiedTrips()` → `{ unifiedTrips, isLoading, error }`
- **Scope:** Route-based. When `routeAbbrev === "f-v-s"`, expands to fetch all three South Sound triangle routes.

### 2.2 UnifiedTrip Shape

```typescript
type UnifiedTrip = {
  scheduledTrip?: ScheduledTrip;
  activeVesselTrip?: VesselTrip;
  completedVesselTrip?: VesselTrip;
  // Denormalized for filtering
  key: string;
  vesselAbbrev: string;
  routeAbbrev: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  scheduledDeparture: Date;
};
```

### 2.3 Helpers

- `expandRouteAbbrev(routeAbbrev)` — returns `[routeAbbrev]` or `["f-s","f-v-s","s-v"]` for triangle
- `resolveIndirectToSegments(indirectTrip, byKey, unifiedTrips)` — breaks A→C into [A→B, B→C] with UnifiedTrip per segment
- `SOUTH_SOUND_TRIANGLE_ROUTE_GROUP` — `"f-v-s"` constant

### 2.4 Backend Queries

- `getDirectScheduledTripsByRoutesAndTripDate(routeAbbrevs, tripDate)` — direct only
- `getScheduledTripsByRoutesAndTripDate(routeAbbrevs, tripDate)` — all trips (for byKey / indirect)
- `getActiveTripsByRoutes(routeAbbrevs)`
- `getCompletedTripsByRoutesAndTripDate(routeAbbrevs, tripDate)`

### 2.5 Documentation

- `docs/unified-trips-context-memo.md` — design rationale, problems, solutions
- `src/features/TimelineFeatures/ScheduledTrips/README.md` — current data flow

---

## 3. Current Architecture (To Be Replaced)

### 3.1 ScheduledTrips Flow

```
SchedulesScreen (app/(tabs)/schedules.tsx)
  └─ ScheduledTripList(terminalAbbrev, destinationAbbrev)
       └─ useScheduledTripsPageData({ terminalAbbrev, destinationAbbrev })
            ├─ getScheduledTripsForTerminal (by terminal, not route)
            ├─ reconstructJourneys(flatDomain, terminalAbbrev, destinationAbbrev)
            └─ useScheduledTripsMaps({ sailingDay, departingTerminalAbbrevs })
                 ├─ useConvexVesselTrips (active)
                 ├─ useConvexVesselLocations
                 ├─ useDelayedVesselTrips (hold window)
                 └─ getCompletedTripsForSailingDayAndTerminals
       └─ ScheduledTripCard (per journey)
            └─ ScheduledTripTimeline
                 └─ synthesizeTripSegments(segments, vesselTripMap, vesselLocation, heldTrip)
```

### 3.2 Key Mismatch: Terminal vs Route

- **Current:** `getScheduledTripsForTerminal` fetches by departing terminal + sailing day. Returns all vessel trips for vessels that depart from that terminal.
- **UnifiedTripsContext:** Fetches by `routeAbbrev` + `tripDate`.

**Implication:** You need a mapping from `(terminalAbbrev, destinationAbbrev?)` → `routeAbbrev` (or `routeAbbrevs[]`). For the F/V/S triangle, when the user selects FAU, SOU, or VAI, use `routeAbbrev="f-v-s"`. For other routes (e.g. P52↔BBI), use `routeAbbrev="sea-bi"`. See `src/data/routes.ts` and `src/data/terminalConnections.ts` for terminal–route relationships.

---

## 4. Phase 2 Tasks

### 4.1 Terminal-to-Route Mapping

Create a utility to derive `routeAbbrev` from `terminalAbbrev` and optional `destinationAbbrev`:

- Single terminal (e.g. "P52") → likely need all routes that serve that terminal, or the "primary" route for the schedules view. The current `getScheduledTripsForTerminal` returns trips for vessels departing from that terminal across all routes. You may need to fetch multiple routes and merge, or introduce a "terminal view" that aggregates.
- Terminal pair (e.g. P52 → BBI) → `routeAbbrev="sea-bi"`.
- Triangle terminals (FAU, SOU, VAI) → `routeAbbrev="f-v-s"`.

**Suggested location:** `src/shared/utils/terminalToRoute.ts` or similar.

### 4.2 Replace useScheduledTripsPageData

- Wrap the schedules screen (or a parent) with `UnifiedTripsProvider` using the derived `routeAbbrev` and `tripDate`.
- Replace `useScheduledTripsPageData` with logic that:
  - Calls `useUnifiedTrips()`
  - Maps `unifiedTrips` (Record) into `journeys` using `reconstructJourneys`-style logic, but working from `Object.values(unifiedTrips)` instead of raw schedule rows.
  - Builds `vesselTripMap` from `unifiedTrips` (each UnifiedTrip has active/completed vessel trip).
  - Handles `error` from context for error UI.

### 4.3 Hold Window Integration

- **Current:** `useDelayedVesselTrips` + `buildAllPageMaps` provide `displayTripByAbbrev` and synced `vesselLocationByAbbrev` for the hold window.
- **Phase 2 goal:** Extract `useHoldWindow<T>` (generic) from `useDelayedVesselTrips`. Refactor `useDelayedVesselTrips` to use it. Use `useHoldWindow` (or a UnifiedTrips-specific variant) in the new data pipeline so that when a trip completes, it stays visible for ~30s.
- **Note:** UnifiedTripsContext does not include vessel locations. You will still need `useConvexVesselLocations` (or equivalent) for real-time `AtDock`, `Eta`, `ScheduledDeparture`, etc. The hold window applies to the *trip* display; vessel locations are separate.

### 4.4 Make Components Presentational

- **ScheduledTripCard:** Should receive `trip`, `vesselTripMap`, `vesselLocation`, `heldTrip` (or equivalent) as props. No data fetching.
- **ScheduledTripTimeline:** Should receive segments and maps; no fetching.
- **synthesizeTripSegments:** Keep as a pure function. It may need to accept `UnifiedTrip`-derived structures if the shape changes slightly.

### 4.5 VesselTimeline

- **Location:** `src/features/TimelineFeatures/VesselTimeline/`
- **Current:** `useVesselDailyTimeline` fetches `getDirectScheduledTripsForVessel` and builds a vertical timeline. Does not use UnifiedTripsContext.
- **Phase 2:** Consider migrating to `useUnifiedTrips()` + filter by `vesselAbbrev` for consistency. Or leave as-is if it’s a different use case (vessel-centric vs route-centric).

### 4.6 VesselTrips (VesselTripList, VesselTripCard)

- These may use different data (active trips, vessel locations). Assess whether they should also consume UnifiedTripsContext or remain on their current hooks.

---

## 5. File Reference

| File | Purpose |
|------|---------|
| `src/data/contexts/convex/UnifiedTripsContext.tsx` | Provider, hook, types |
| `src/data/contexts/convex/unifiedTripsHelpers.ts` | expandRouteAbbrev, resolveIndirectToSegments |
| `src/features/TimelineFeatures/ScheduledTrips/useScheduledTripsPageData.ts` | **Replace** |
| `src/features/TimelineFeatures/ScheduledTrips/useScheduledTripsMaps.ts` | **Replace** (merge into new pipeline) |
| `src/features/TimelineFeatures/ScheduledTrips/utils/reconstructJourneys.ts` | **Adapt** to work from UnifiedTrips or keep for journey building |
| `src/features/TimelineFeatures/ScheduledTrips/utils/synthesizeTripSegments.ts` | **Keep** (pure); may need small signature changes |
| `src/features/TimelineFeatures/ScheduledTrips/utils/buildPageDataMaps.ts` | **Replace** (hold window + maps from unified data) |
| `src/features/TimelineFeatures/VesselTrips/useDelayedVesselTrips.ts` | **Refactor** to use extracted `useHoldWindow` |
| `src/app/(tabs)/schedules.tsx` | Mount `UnifiedTripsProvider` here or in a parent |
| `src/data/routes.ts` | Terminal–route mapping reference |
| `convex/functions/scheduledTrips/queries.ts` | New multi-route queries |
| `convex/functions/vesselTrips/queries.ts` | New multi-route queries |

---

## 6. Indirect Trips (A→B→C)

For displaying indirect trips (e.g. A→C as a single card):

1. Fetch all scheduled trips (direct + indirect) via `getScheduledTripsByRoutesAndTripDate`.
2. Filter to indirect trips for the desired origin/destination.
3. For each indirect trip, call `resolveIndirectToSegments(indirectTrip, byKey, unifiedTrips)` to get segments with actuals.
4. Build the card from the segment list.

Phase 1 does not wire this into the UI; it’s available for Phase 2 if needed.

---

## 7. Testing Strategy

- **Before refactor:** Capture current behavior (screenshots or snapshot tests if available).
- **After refactor:** Verify schedules screen shows the same trips, statuses (past/ongoing/future), and phases (at-dock/at-sea/completed).
- **Hold window:** Confirm that when a vessel arrives, the trip stays visible for ~30s before switching to the next.
- **Triangle:** If the schedules screen supports the F/V/S triangle, verify all three routes’ trips appear when appropriate.

---

## 8. Open Questions (From Memo)

- **Single-route f-v-s:** If we need only FAU–VAI (not full triangle), how to distinguish? Possible: `expandTriangle: false` prop or separate slug.
- **Terminal-only view:** When user selects a single terminal (no destination), which routes to fetch? Current behavior fetches all vessels departing from that terminal (multi-route). May need to fetch multiple routes and merge.

---

## 9. Code Style

- Follow `.cursor/rules/code-style.mdc`: TSDoc on functions, double quotes, 2 spaces, NativeWind for styling.
- Run `bun run check:fix` and `bun run type-check` (and `bun run convex:typecheck`) after changes.
