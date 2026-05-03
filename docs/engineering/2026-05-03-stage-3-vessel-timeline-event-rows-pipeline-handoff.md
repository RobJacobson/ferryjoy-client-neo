# Handoff: Stage 3 — event-row-to-render pipeline (`VesselTimeline`)

**Status:** Ready for implementation  
**Depends on:** [Stage 1 handoff](./2026-05-03-stage-1-vessel-timeline-event-queries-handoff.md) (public list queries), Stage 2 (`ConvexVesselTimelineEventsProvider` + `useConvexVesselTimelineEvents`)  
**Spec:** [PRD § Stage 3](./2026-05-03-vessel-timeline-client-event-queries-prd.md)

Stage 3 replaces the **route snapshot** path inside the feature with a pipeline that
starts from the **three vessel/day event row arrays** already subscribed in Stage 2.
Stage 4 will remove `ConvexRouteTimelineProvider` from the screen tree; Stage 3 may
still run **under** that provider for a short time, but **feature code** must not
depend on `useConvexRouteTimeline` or `RouteTimelineSnapshot`.

---

## Objective

```text
scheduledEvents + actualEvents + predictedEvents
  -> merged timeline events (same semantics as backend merge)
  -> dock visits / visual spans (equivalent to today’s route-model selection)
  -> VesselTimelineRenderState
```

Preserve **row order, terminal card geometry, active row, and active indicator**
behavior produced today by `fromRouteTimelineModel` + `RouteTimelineModel`
selectors, with **`VesselLocation`** still a **separate** input (only the current
vessel’s location passed into the render-state builder).

---

## Current code to migrate away from (reference only)

| Area | Role today |
|------|------------|
| `useRouteModelVesselTimelinePresentationState` | `useConvexRouteTimeline` + `buildRouteModelTimelinePresentationState` |
| `presentationStateBuilders.ts` | Loading/error/empty branches; calls `fromRouteTimelineModel` |
| `renderPipeline/fromRouteTimelineModel.ts` | `RouteTimelineSnapshot` → dock visits via `@/features/RouteTimelineModel` → rows / indicator |

After Stage 3, **`src/features/VesselTimeline/**` must not import
`convex/functions/routeTimeline`** or **`ConvexRouteTimelineContext`**.

---

## New and updated files

### Add

- `src/features/VesselTimeline/renderPipeline/fromEventRows.ts`  
  Pure pipeline: event row arrays (+ scope helpers) → `VesselTimelineRenderState`.
- `src/features/VesselTimeline/renderPipeline/tests/fromEventRows.test.ts`  
  Parity, empty sets, prediction-only updates, active indicator inputs.

### Shared merge module (Option 1 — preferred)

If you can keep **`src` free of Convex runtime** (`QueryCtx`, server-only modules):

- Introduce a **client-safe** module (e.g. under `src/shared/...` or
  `src/features/VesselTimeline/merge/`) that implements the same pure policy as
  `convex/domain/timelineRows/mergeTimelineRows.ts`, or **move** the pure merge
  into a folder that both `convex/domain` and `src` import (no server-only
  imports in that file).

**Option 2 (incremental):** implement a **feature-local** merge that mirrors
`mergeTimelineRows` and lock behavior with **fixture parity tests** against the
same inputs/outputs as backend tests (`mergeTimelineRows.test.ts` and related).

### Update

- `src/features/VesselTimeline/hooks/useVesselTimelinePresentationState.ts`  
  - Consume **`useConvexVesselTimelineEvents`** (scheduled / actual / predicted,
    `isLoading`, `errorMessage`, `retry`) instead of **`useConvexRouteTimeline`**.  
  - Keep **`useConvexVesselLocations`**, **`useTerminalsData`**, **`useNowMs`**.  
  - Rename or split hooks if helpful (e.g. event-row presentation hook vs legacy
    name); avoid breaking exports used outside the feature without checking
    call sites.
- `src/features/VesselTimeline/hooks/presentationStateBuilders.ts`  
  - Add **`buildEventRowTimelinePresentationState`** (or evolve existing builder)
    that takes event-row context inputs + the same terminal/location/theme/now
    inputs as today.  
  - Branch on **events** `isLoading` / `errorMessage` consistently with Stage 2
    semantics (remember: empty arrays while loading are **not** “empty day” until
    `isLoading` is false — see `buildConvexVesselTimelineEventsContextValue`).

Optional cleanup in the same PR if low-risk: deprecate or narrow
`fromRouteTimelineModel` usage to tests-only (Stage 4 may delete it).

---

## Merge parity (required)

Behavior must match **`mergeTimelineRows`** for:

- Exact **`ScheduleKey + EventType`** actual attachment  
- Arrival fallback by **terminal + scheduled departure**  
- Arrival fallback ordered by **previous actual time**  
- Prediction precedence: **`wsf_eta`**, then ML **`AtSeaArriveNext`**, then ML
  **`AtDockArriveNext`**, then first remaining candidate  

Use **`convex/domain/timelineRows/mergeTimelineRows.ts`** and
**`convex/domain/timelineRows/tests/mergeTimelineRows.test.ts`** as the source
of truth. Prefer **sharing** the pure function over duplicating logic long-term.

---

## Dock visits and visual spans

Today, **`fromRouteTimelineModel`** uses:

- `selectVesselDockVisits(snapshot, vesselAbbrev)`
- `selectDockVisitVisualSpans`, `deriveRouteTimelineAxisGeometry`, etc. from
  **`@/features/RouteTimelineModel`**

Those selectors are **route-snapshot-shaped**. Stage 3 needs either:

1. **New selectors** that accept **merged timeline events** (or an intermediate
   “vessel dock visit” list) built from event rows, producing the **same**
   structural inputs the row/span builders expect, or  
2. A **thin adapter** that converts merged events into the minimal structure
   `RouteTimelineModel` helpers need **without** importing `routeTimeline` types
   (feature-local types only).

Do **not** reintroduce `RouteTimelineSnapshot` in `src/features/VesselTimeline`
as the primary path.

---

## Types and time fields

Stage 1 list queries return **Convex row shapes** (**epoch ms** on time fields).
`fromRouteTimelineModel` / timeline components may assume **`Date`** or mixed
conventions — align **`fromEventRows`** with existing **`TimelineRenderRow`**
builders (convert at the boundary once, consistently).

---

## Tests

- **Presentation:** loading / error / empty / ready using the new builder (mock
  context values; no need for full Convex in unit tests).  
- **Pipeline:** parity against **representative route-model fixtures** (golden
  or snapshot): same render rows / indicator inputs for the same underlying
  events.  
- **Active indicator:** unchanged **`VesselLocation`** inputs → same placement
  logic as today.  
- **Empty** event sets.  
- **Prediction-only** updates: estimated times change without disturbing
  unrelated actual/scheduled row identity.

Reuse or extend **`fromRouteTimelineModel.test.ts`** patterns where useful; add
**`fromEventRows.test.ts`** as the primary home for row-pipeline tests.

---

## Acceptance checklist (Stage 3)

- `VesselTimeline` **renders from event rows** (hook driven by
  `useConvexVesselTimelineEvents`).  
- Visual behavior matches **representative** fixtures (rows, cards, active
  indicator).  
- **No** `import` from `convex/functions/routeTimeline` under
  `src/features/VesselTimeline`.  
- **No** `ConvexRouteTimelineContext` import under `src/features/VesselTimeline`.  
- `bun run type-check`, `bun run check:fix`, and targeted feature tests pass.

---

## Out of scope for Stage 3

- Removing **`ConvexRouteTimelineProvider`** from **`VesselTimeline.tsx`** (Stage 4).  
- Deleting **`convex/functions/routeTimeline`** (Stage 5).  
- Changing event **schemas** or orchestrator **writes**.

---

## Suggested implementation order

1. Pure **merge** (shared or feature-local) + unit tests vs backend fixtures.  
2. **Merged events → dock visits / spans → `VesselTimelineRenderState`** in
   `fromEventRows.ts` + tests.  
3. **`buildEventRowTimelinePresentationState`** + switch hook to event context.  
4. Rip out route-timeline imports from feature files; fix any re-exports.  
5. Full typecheck, lint, and manual smoke on a live vessel/day.

---

## Document history

- **2026-05-03:** Initial Stage 3 handoff (pipeline, merge parity, hook/builder
  migration, tests, acceptance).
