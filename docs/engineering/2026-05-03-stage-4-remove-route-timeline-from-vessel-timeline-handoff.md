# Handoff: Stage 4 — remove route timeline from `VesselTimeline` wiring

**Status:** Completed  
**Depends on:** [Stage 3](./2026-05-03-stage-3-vessel-timeline-event-rows-pipeline-handoff.md)  
**Spec:** [PRD § Stage 4](./2026-05-03-vessel-timeline-client-event-queries-prd.md)

---

## What shipped

- **`VesselTimeline.tsx`:** Only **`ConvexVesselTimelineEventsProvider`** wraps the
  presentation tree (`key` + `onRetry` unchanged). **`ConvexRouteTimelineProvider`**
  removed; no **`useConvexVesselLocations`** in the data host (locations remain
  app-level for **`useVesselTimelinePresentationState`**).
- **Route gating removed:** **`resolvedRouteAbbrev`**, **`shouldWaitForVesselTimelineRouteScope`**, and the “no route” / route-scope loading branches deleted.
- **`routeAbbrev`** dropped from **`VesselTimelineProps`**; **`vessel-timeline-placeholder.tsx`** updated (no **`routeAbbrev`** on **`VesselOption`** or **`<VesselTimeline />`**).
- **`pipelineMode.ts`** and **`tests/pipelineMode.test.ts`** removed.
- **`fromEventRows.ts`** module comment avoids implying a Convex route snapshot
  payload (still uses **`domain/routeTimeline`** for merge + dock visits — that
  is not `convex/functions/routeTimeline`).

**Global:** **`ConvexRouteTimelineContext`** and backend **`routeTimeline`** APIs
unchanged (Stage 5).

---

## PRD objective (for context)

- **`VesselTimeline`** path: **event rows** + **vessel locations** + **terminal
  identity**; no **`getRouteTimelineSnapshot`** subscription on this screen.
- No **`ConvexRouteTimelineContext`** under **`src/features/VesselTimeline`**.

---

## Verification (performed)

```bash
rg "useConvexRouteTimeline" src/features/VesselTimeline
rg "ConvexRouteTimeline" src/features/VesselTimeline
rg "api\.functions\.routeTimeline" src/features/VesselTimeline
```

**Note:** **`buildVesselTimelineRenderStateFromAxisGeometry`** and
**`@/features/RouteTimelineModel`** names are expected (presentation geometry), not
`convex/functions/routeTimeline`.

---

## Tests

- **`bun test src/features/VesselTimeline/`**
- **`bun run type-check`**, **`bun run check:fix`**
- Manual smoke on **`vessel-timeline-placeholder`** (loading, retry, empty day,
  multi-leg, active indicator) — recommended after releases.

---

## Document history

- **2026-05-03:** Initial Stage 4 handoff (planning).
- **2026-05-03:** Marked **Completed**; replaced pre-implementation “current state”
  with **What shipped** after implementation landed.
