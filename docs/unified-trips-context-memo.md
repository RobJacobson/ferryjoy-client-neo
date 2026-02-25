# UnifiedTripsContext — Design Memo

**Date:** February 2025  
**Status:** Phase 1 complete; Phase 2 pending

## Executive Summary

UnifiedTripsContext joins scheduled, active, and completed ferry trips by composite `Key` into a single `Record<key, UnifiedTrip>`. The goal is to simplify TimelineFeatures by making them purely presentational: components receive pre-joined data and use map/reduce/filter to shape it for display. This memo documents the underlying problems, our exploration, and proposed solutions.

---

## 1. Underlying Problems

### 1.1 Data Model Mismatch: Direct vs Indirect Trips

**Problem:** WSF schedule data includes both direct trips (A→B) and indirect trips (A→C when A→B→C exists). ActiveVesselTrip and CompletedVesselTrip tables store only direct trips—they are built from vessel location data that tracks physical legs. Therefore, indirect trips never have matching vessel trip records when joined by `Key`.

**Impact:** If UnifiedTripsContext includes indirect scheduled trips, they will always have empty `activeVesselTrip` and `completedVesselTrip`, leading to incomplete or confusing UI.

### 1.2 F/V/S Triangle Route Fragmentation

**Problem:** The Fauntleroy/Vashon/Southworth triangle is reported in WSF REST data as three distinct routes: `f-s` (FAU↔SOU), `f-v-s` (FAU↔VAI), and `s-v` (SOU↔VAI). When a user views the triangle (e.g. "Southworth / Vashon / Fauntleroy"), we need data from all three routes. A single-route query returns only one subset.

**Impact:** Timeline or map views for the triangle would show incomplete schedules and missing vessel trip data.

### 1.3 TimelineFeatures Data Complexity

**Problem:** TimelineFeatures (ScheduledTrips, VesselTimeline) currently orchestrate multiple data sources: schedule by terminal, active trips, completed trips, vessel locations, and hold-window logic. Each component manages its own fetching, joining, and synthesis. This makes components hard to test and reuse.

**Impact:** Adding new features that rely on scheduled + actual data requires duplicating coordination logic.

### 1.4 Hold Window UX

**Problem:** When a vessel arrives at dock, the trip disappears from active trips immediately. Without a hold window, the UI jumps abruptly to the next scheduled trip. The hold window (e.g. 30 seconds) keeps the completed trip visible briefly for a smoother transition.

**Impact:** Hold logic is currently embedded in `useDelayedVesselTrips` and `buildAllPageMaps`. It is not reusable for other contexts (e.g. UnifiedTrips-based views).

### 1.5 Error Handling

**Problem:** Convex queries can throw (server errors) or remain loading (network issues). The context currently sets `error: null` and never surfaces failures. Network connectivity loss is typically not an "error" in the thrown sense—Convex retries internally—but the UI has no way to show "Reconnecting" or "Offline."

**Impact:** Users see indefinite loading or unhandled errors without clear feedback.

---

## 2. Exploration

### 2.1 Direct vs Indirect — Options Considered

| Option | Description | Pros | Cons |
|-------|-------------|------|------|
| A. Direct-only context | Filter scheduled trips to `TripType === "direct"` at backend | Simple; matches vessel trip model | Consumers must resolve indirect via DirectKey |
| B. Include both, resolve in context | Copy actuals from DirectKey into indirect entries | Consumers get complete data | Context logic more complex; duplicates data |
| C. Two-layer | Direct-only context + helper for resolution | Clear separation | Extra helper to maintain |

**Decision:** Option A. Backend filters to direct trips. A convenience function `resolveIndirectToSegments` breaks indirect trips (A→C) into direct segments (A→B, B→C) and returns UnifiedTrips for each segment. Consumers build A→B→C cards from the segment list.

### 2.2 F/V/S Triangle — Options Considered

| Option | Description | Pros | Cons |
|-------|-------------|------|------|
| A. Route group expansion in provider | When `routeAbbrev === "f-v-s"`, expand to `["f-s","f-v-s","s-v"]` and fetch each | No backend changes; flexible | Multiple queries; merge in provider |
| B. New Convex queries | Add `getScheduledTripsByRoutesAndTripDate(routeAbbrevs[])` | Single round-trip | New query; schema/index considerations |
| C. Single provider, internal expansion | Same as A; use `"f-v-s"` as canonical triangle slug | Consistent naming | `"f-v-s"` is also a real route—potential ambiguity |

**Decision:** Option C. Use `"f-v-s"` internally as the triangle group identifier. When the provider receives `routeAbbrev === "f-v-s"`, it expands to fetch all three routes and merges results. For single-route FAU-VAI, a different convention can be used if needed (e.g. explicit flag or slug).

### 2.3 Route Abbreviation Consistency

**Finding:** `RouteAbbrev` comes from `route.RouteAbbrev` in the WSF schedule API. Vessel locations use `OpRouteAbbrev` from the WSF vessels API. Our internal abbreviations (`f-s`, `f-v-s`, `s-v`, `sea-bi`, etc.) are consistent with the WSF API.

### 2.4 Hold Window Generalization

**Finding:** `useDelayedVesselTrips` is specialized to `VesselTrip` + `VesselLocation`. The core logic: when an item disappears from the source list, hold it for N seconds; when a new item appears for the same "group" (vessel), keep showing the old one until hold expires. This can be abstracted into a generic `useHoldWindow<T>` hook.

**Decision:** Phase 2 will extract `useHoldWindow` and refactor `useDelayedVesselTrips` to use it. UnifiedTrips-based components can then use `useHoldWindow` with their own item shape.

---

## 3. Proposed Solutions

### 3.1 Phase 1: Refine Context, Backend, Helpers ✅ (Complete)

1. **Backend queries** (implemented)
   - `getDirectScheduledTripsByRoutesAndTripDate(routeAbbrevs, tripDate)` — direct trips only, multi-route.
   - `getScheduledTripsByRoutesAndTripDate(routeAbbrevs, tripDate)` — all trips (direct + indirect) for building byKey.
   - `getActiveTripsByRoutes(routeAbbrevs)` — active vessel trips for multiple routes.
   - `getCompletedTripsByRoutesAndTripDate(routeAbbrevs, tripDate)` — completed vessel trips for multiple routes.

2. **UnifiedTripsContext** (implemented)
   - Accepts `routeAbbrev` and `tripDate`. When `routeAbbrev === "f-v-s"`, expands to `["f-s","f-v-s","s-v"]`.
   - Denormalized `UnifiedTrip` fields: `key`, `vesselAbbrev`, `routeAbbrev`, `departingTerminalAbbrev`, `arrivingTerminalAbbrev`, `scheduledDeparture`.
   - Error boundary catches query errors; `error: string | null` exposed in context.

3. **Helper functions** (implemented in `unifiedTripsHelpers.ts`)
   - `expandRouteAbbrev(routeAbbrev)`: Returns `[routeAbbrev]` or `["f-s","f-v-s","s-v"]` for triangle.
   - `resolveIndirectToSegments(indirectTrip, byKey, unifiedTrips)`: Resolves indirect A→C to segments [A→B, B→C] with UnifiedTrip per segment.

### 3.2 Phase 2: TimelineFeatures Refactor

- Replace `useScheduledTripsPageData` and `useScheduledTripsMaps` with UnifiedTripsContext + map/reduce/filter.
- Extract `useHoldWindow` from `useDelayedVesselTrips`; use in both legacy and new flows.
- Make ScheduledTripCard, ScheduledTripTimeline, etc. purely presentational.
- Hand off to separate agent for wholesale refactor.

---

## 4. Data Flow (Post Phase 1)

```
UnifiedTripsProvider(routeAbbrev="f-v-s", tripDate="2025-02-24")
  │
  ├─ expandRouteAbbrev("f-v-s") → ["f-s","f-v-s","s-v"]
  ├─ getDirectScheduledTripsByRoutesAndTripDate(["f-s","f-v-s","s-v"], tripDate)
  ├─ getActiveTripsByRoute (x3, one per route) → merge
  ├─ getCompletedTripsByRouteAndTripDate (x3, one per route) → merge
  │
  └─ buildUnifiedTripRecord(scheduled, active, completed)
       → Record<key, UnifiedTrip> with denormalized fields

Consumer (e.g. TimelineFeature):
  const { unifiedTrips, isLoading, error } = useUnifiedTrips();
  const byVessel = Object.values(unifiedTrips).reduce(...);
  const byTerminalPair = Object.values(unifiedTrips).filter(...);

For indirect A→C:
  const indirectTrips = useQuery(getIndirectScheduledTripsByRouteAndTripDate, ...);
  const segments = indirectTrips.flatMap(t =>
    resolveIndirectToSegments(t, byKey, unifiedTrips)
  );
```

---

## 5. Open Questions

- **Single-route f-v-s:** If we need to show only FAU-VAI (not the full triangle), how do we distinguish from triangle? Possible: `routeAbbrev="f-v-s"` + `expandTriangle: false` prop, or a separate slug.
- **Hold window integration:** Phase 1 does not integrate hold window into UnifiedTripsContext. Phase 2 will add `useHoldWindow` and wire it into components that consume unified trips.
