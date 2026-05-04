# VesselTimeline Architecture

`VesselTimeline` renders one vessel and sailing day from **Convex event-row
subscriptions** and keeps **live vessel position** separate so location ticks do
not force a full event-table reread.

## Data boundaries

**Inside the feature (data host)**

- **`ConvexVesselTimelineEventsProvider`** — subscribes to the three public list
  queries (scheduled, actual, predicted) for **`vesselAbbrev`** +
  **`sailingDay`**. Exposes rows, combined loading, errors, and **`retry`**
  (remount key).

**Above the feature (typical app tree)**

- **`ConvexVesselLocationsProvider`** (or equivalent) — presentation reads
  **`useConvexVesselLocations`** for the **current** vessel’s **`VesselLocation`**
  (active indicator).
- **Terminal identity** — **`useTerminalsData`** (or equivalent) for display
  names.

There is **no** route snapshot Convex function on this screen path: timeline
structure comes from event rows and shared **`domain/timelineDockVisits`**
merge/visit assembly (plus **`RouteTimelineModel`** geometry helpers).

## Render pipeline

```text
scheduled / actual / predicted rows (Convex list queries)
  -> buildDomainDockVisitsForVesselDay (domain/timelineDockVisits: merge + visits)
  -> selectDockVisitVisualSpans + deriveRouteTimelineAxisGeometry (RouteTimelineModel)
  -> buildVesselTimelineRenderStateFromAxisGeometry
  -> VesselTimelineRenderState (rows, cards, active indicator inputs)
```

**`VesselLocation`** is passed only into the final render-state builder so
indicator motion stays local to presentation.

## What invalidates structure vs indicator

**Structure** (rows, dock/sea cards, span layout) changes when event rows change:

- schedule reseeds
- actual arrival/departure writes
- prediction writes

**Indicator-only** updates use the latest **`VesselLocation`** for the same
**`vesselAbbrev`** without re-merging the backbone.

## Terminal card geometry

Same rules as before (merged dock + sea glass card, terminal-tail handling, etc.);
see feature **`config`** and **`buildVesselTimelineRenderStateFromAxisGeometry`**.

## Related backend (not this screen’s primary path)

**`getVesselTimelineBackbone`** and other server read models may still exist for
other consumers; this feature’s **client** path is the three **list** queries plus
domain **`buildDomainDockVisitsForVesselDay`**.
