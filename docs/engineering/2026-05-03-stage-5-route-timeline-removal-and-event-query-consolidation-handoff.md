# Handoff: Stage 5 — remove legacy route timeline API + consolidate event list queries

**Status:** Completed  
**Depends on:** [Stage 4](./2026-05-03-stage-4-remove-route-timeline-from-vessel-timeline-handoff.md)  
**Spec:** [PRD § Stage 5](./2026-05-03-vessel-timeline-client-event-queries-prd.md)

## What shipped

- **`convex/domain/timelineDockVisits/`** — wire validators, domain converters,
  **`mergedEventsToWireDockVisits`**, wire→domain converters in **`schemas`**,
  **`buildDomainDockVisitsForVesselDay`**, and tests (replaces deleted
  **`convex/domain/routeTimeline`** and **`convex/functions/routeTimeline`**).
- **`convex/functions/index.ts`** — removed **`routeTimeline`** export;
  **`ConvexRouteTimelineContext`** removed from app contexts.
- **`read*DockEventsForVesselSailingDay`** — single read implementation per table;
  public **`list*ForVesselSailingDay`** queries delegate; **`loadVesselTimelineBackbone`**
  and **`vesselTripScheduleQueries`** call **`read*`**; **`loadPredictedRowsGroupedForTrips`**
  uses stripped **`ConvexPredictedDockEvent`** maps (no **`Doc`**).
- **`fromEventRows`** and **`RouteTimelineModel`** import from **`domain/timelineDockVisits`**.

---

## Original planning notes (historical)

Pre-implementation sequencing (inventory consumers, relocate types before deleting
`functions/routeTimeline`, predicted **`Doc`** caveat) lived in earlier revisions
of this file and in the PRD. The predicted **`Doc`** split was resolved by using
the same stripped rows as the public list reader.

## Document history

- **2026-05-03:** Initial Stage 5 handoff (planning).
- **2026-05-03:** Marked **Completed**; added **What shipped**; retained tail of file
  for Part B naming table if needed (see below).

---

## Part B — naming reference (implemented)

| Public Convex query | Shared reader used by server + tests |
|---------------------|--------------------------------------|
| `listScheduledDockEventsForVesselSailingDay` | `readScheduledDockEventsForVesselSailingDay` |
| `listActualDockEventsForVesselSailingDay` | `readActualDockEventsForVesselSailingDay` |
| `listPredictedDockEventsForVesselSailingDay` | `readPredictedDockEventsForVesselSailingDay` |
