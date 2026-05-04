# PRD: VesselTimeline client-owned event queries

**Status:** Proposed  
**Owner:** Engineering  
**Related memo:**
[Engineering memo: client-owned vessel timeline event queries](./2026-05-03-vessel-timeline-client-owned-event-queries-memo.md)

---

## Purpose

Refactor `VesselTimeline` so it subscribes to the three normalized event tables
for one vessel/day and builds its own render model on the client. The goal is to
remove the route-scoped `routeTimeline` dependency from the vessel timeline
feature and eventually delete `convex/functions/routeTimeline`.

This PRD focuses on implementation stages and concrete code changes. For
architecture rationale, read the memo linked above.

---

## References

- [Engineering memo](./2026-05-03-vessel-timeline-client-owned-event-queries-memo.md)
- [VesselTimeline architecture](../../src/features/VesselTimeline/docs/ARCHITECTURE.md)
- [VesselTimeline docs README](../../src/features/VesselTimeline/docs/README.md)
- [VesselOrchestrator pipeline](../../convex/functions/vesselOrchestrator/VesselOrchestratorPipeline.md)
- [VesselOrchestrator README](../../convex/functions/vesselOrchestrator/README.md)
- [Events functions](../../convex/functions/events)
- [Dock visit assembly (domain)](../../convex/domain/timelineDockVisits) —
  replaced legacy `functions/routeTimeline` + `domain/routeTimeline` (Stage 5)
- [Official Convex rules](../convex_rules.mdc)
- [Opinionated Convex guide](../opinionated-convex-guide.md)
- [Convex realtime docs](https://docs.convex.dev/realtime)
- [Convex sync overview](https://www.convex.dev/sync)
- [Code style guide](../../.cursor/rules/code-style.mdc)

---

## Success criteria

- `VesselTimeline` no longer imports or consumes
  `ConvexRouteTimelineContext`.
- `VesselTimeline` renders from three vessel/day event query results:
  scheduled, actual, and predicted.
- Existing active indicator behavior still derives from the separate
  `vesselLocations` subscription.
- Backend public event queries are thin, indexed, validator-backed Convex
  functions.
- Event merge semantics remain covered by tests, especially actual attachment
  and prediction precedence.
- `convex/functions/routeTimeline` and `convex/domain/routeTimeline` are removed
  after consumers migrate to `domain/timelineDockVisits` (Stage 5 — done).
- Typecheck and relevant tests pass:
  `bun run type-check`, `bun run convex:typecheck`, and targeted test commands.

---

## Stage 1: add public event-row queries

### Goal

Expose the three event tables through small, indexed, vessel/day public queries
without changing the current `VesselTimeline` consumer yet.

### Backend changes

Update:

- `convex/functions/events/eventsScheduled/queries.ts`
- `convex/functions/events/eventsActual/queries.ts`
- `convex/functions/events/eventsPredicted/queries.ts`
- each corresponding `index.ts` barrel if needed
- `convex/functions/index.ts` only if the public surface is not already
  reachable through the existing namespace exports

Add public Convex queries:

- `listScheduledDockEventsForVesselSailingDay`
- `listActualDockEventsForVesselSailingDay`
- `listPredictedDockEventsForVesselSailingDay`

Each query must:

- use new Convex function syntax with `args` and `returns`
- accept `{ VesselAbbrev: v.string(), SailingDay: v.string() }`
- use `by_vessel_and_sailing_day`
- return `v.array(...)` using the existing event row validators
- strip Convex metadata unless the chosen return schema explicitly includes it
- keep existing internal helpers available for orchestrator and timeline code

Suggested implementation detail:

- Keep the existing helper functions as implementation helpers.
- Register the public query in the same file, delegating to the helper and
  mapping through `stripConvexMeta` where needed.
- For `eventsActual` and `eventsPredicted`, avoid returning `Doc<...>` from the
  public query unless the client needs `_id`.

### Tests

Add focused Convex query unit tests if the existing test harness supports these
helpers. At minimum, add pure or mocked tests proving:

- the helper uses `by_vessel_and_sailing_day`
- metadata is stripped for public return shapes
- rows are not filtered by route, window, or terminal

### Acceptance checklist

- Public query names appear in generated API after codegen.
- No existing route timeline behavior changes.
- `bun run convex:typecheck` passes.

---

## Stage 2: introduce client vessel timeline event context

### Goal

Create a client data boundary that subscribes to the three event-row queries for
the current `VesselAbbrev` and `SailingDay`.

### Frontend changes

Add a new provider and hook, likely:

- `src/data/contexts/convex/ConvexVesselTimelineEventsContext.tsx`

The context should expose:

```ts
type ConvexVesselTimelineEventsContextType = {
  vesselAbbrev: string;
  sailingDay: string;
  scheduledEvents: ScheduledDockEvent[];
  actualEvents: ActualDockEvent[];
  predictedEvents: PredictedDockEvent[];
  isLoading: boolean;
  errorMessage: string | null;
  retry: () => void;
};
```

Implementation requirements:

- Run three `useQuery` calls against the Stage 1 public queries.
- Treat each `undefined` query result as loading.
- Expose empty arrays only after the relevant query has loaded.
- Preserve an error-boundary pattern similar to
  `ConvexRouteTimelineContext.tsx`.
- Do not merge rows in the context unless the final implementation deliberately
  chooses context-level projection. Prefer exposing rows and doing feature
  projection inside `src/features/VesselTimeline`.
- Do not subscribe when required scope fields are missing. If the existing
  screen guarantees `vesselAbbrev`, keep the prop required.

### Provider wiring

Find the route or screen composition that currently mounts
`ConvexRouteTimelineProvider` for `VesselTimeline`. Add the new provider beside
it for the first migration step or replace it behind a feature flag if needed.

### Tests

Add tests for:

- loading state while any of the three queries is `undefined`
- ready state after all three load
- error fallback context values
- retry callback passthrough

### Acceptance checklist

- The new context compiles and can be mounted without changing
  `VesselTimeline` rendering.
- The context does not import `routeTimeline` types or functions.
- Existing `ConvexRouteTimelineContext` remains unchanged in this stage.

---

## Stage 3: build event-row-to-render pipeline in VesselTimeline

### Goal

Replace the route snapshot adapter with a feature-owned pipeline that starts
from the three event row arrays.

### Frontend pipeline changes

Add a new render pipeline module, likely:

- `src/features/VesselTimeline/renderPipeline/fromEventRows.ts`
- `src/features/VesselTimeline/renderPipeline/tests/fromEventRows.test.ts`

The new pipeline should perform:

```text
scheduledEvents + actualEvents + predictedEvents
  -> merged timeline events
  -> dock visits or visual spans
  -> VesselTimelineRenderState
```

Implementation requirements:

- Preserve the current row, terminal card, active row, and active indicator
  behavior produced by `fromRouteTimelineModel`.
- Keep `vesselLocations` separate and pass only the current vessel location into
  the render-state builder.
- Avoid importing `convex/functions/routeTimeline` types.
- Use feature-local types if the route model types are only needed because of
  the old snapshot shape.

### Merge policy options

Choose one approach during implementation:

1. Move the pure merge policy to a shared, client-safe module.
2. Create a client-local adapter that mirrors `mergeTimelineRows` and add parity
   tests.

Option 1 is preferred if it can be done without importing Convex-only runtime
code into `src`. Option 2 is acceptable for a safer incremental migration.

Parity coverage must include:

- exact `ScheduleKey + EventType` actual matching
- arrival fallback by terminal and scheduled departure
- arrival fallback ordered by previous actual time
- prediction precedence: `wsf_eta`, then ML `AtSeaArriveNext`, then ML
  `AtDockArriveNext`, then first remaining candidate

### Hook changes

Update:

- `src/features/VesselTimeline/hooks/useVesselTimelinePresentationState.ts`
- `src/features/VesselTimeline/hooks/presentationStateBuilders.ts`

The hook should consume:

- new vessel timeline events context
- existing vessel locations context
- existing terminal identity context

It should stop consuming `useConvexRouteTimeline`.

### Tests

Update or add tests for:

- presentation state loading/error/empty/ready states
- render pipeline parity with existing route model fixtures
- active indicator behavior with unchanged `VesselLocation` inputs
- empty event row sets
- prediction-only updates changing estimated times without changing unrelated
  actual/scheduled rows

### Acceptance checklist

- `VesselTimeline` renders from event rows.
- Existing visual behavior is preserved for representative fixtures.
- No `src/features/VesselTimeline` file imports
  `convex/functions/routeTimeline`.
- No `src/data/contexts/convex/ConvexRouteTimelineContext` import remains in
  `VesselTimeline` code.

---

## Stage 4: remove route timeline from VesselTimeline app wiring

### Goal

Remove route timeline provider usage from the `VesselTimeline` screen path once
the event-row pipeline is verified.

### Changes

Update screen/provider composition so `VesselTimeline` receives:

- vessel timeline events provider
- vessel locations provider
- terminal identity provider

Remove `ConvexRouteTimelineProvider` from any composition that exists only to
serve `VesselTimeline`.

Run repository searches for:

- `useConvexRouteTimeline`
- `ConvexRouteTimelineProvider`
- `RouteTimelineSnapshot`
- `fromRouteTimelineModel`
- `api.functions.routeTimeline` (removed from codegen after Stage 5)

Keep anything that belongs to a separate route-level feature. Remove or replace
anything that exists only for `VesselTimeline`.

### Tests

Run the `VesselTimeline` test suite and any screen-level tests that mount the
timeline provider tree.

### Acceptance checklist

- The app path for `VesselTimeline` no longer mounts route timeline data.
- `fromRouteTimelineModel` is gone; `VesselTimeline` uses `fromEventRows`.
- `ConvexRouteTimelineContext` is not part of the `VesselTimeline` tree (context
  removed in Stage 5).

---

## Stage 5: delete legacy routeTimeline

**Completed (2026-05-03):** Shared dock-visit assembly moved to
`convex/domain/timelineDockVisits/` (not a wholesale delete of merge logic).
`convex/functions/routeTimeline`, `convex/domain/routeTimeline`, and
`ConvexRouteTimelineContext` are removed; public event queries unchanged by name;
internal readers consolidated to `read*ForVesselSailingDay`. See
[Stage 5 handoff](./2026-05-03-stage-5-route-timeline-removal-and-event-query-consolidation-handoff.md).

### Goal (original PRD wording)

Remove `convex/functions/routeTimeline` after all production consumers are gone.

### What was removed or relocated

- Deleted: `convex/functions/routeTimeline`, `convex/domain/routeTimeline`, route
  snapshot–only tests, `ConvexRouteTimelineContext`.
- Added: `convex/domain/timelineDockVisits/` (wire + merge + dock visits +
  `buildDomainDockVisitsForVesselDay`).
- Updated: `convex/functions/index.ts`, codegen, engineering and feature docs
  (continue `rg "routeTimeline"` for stragglers).

If another product surface still needs a route-scoped dock-visit snapshot,
document that consumer explicitly; it is no longer the `VesselTimeline` path.

### Frontend (original PRD list)

- `fromRouteTimelineModel.ts` — removed with the vessel timeline migration.
- `RouteTimelineModel` — kept for shared presentation geometry where needed.

### Documentation updates

Update:

- [VesselTimeline architecture](../../src/features/VesselTimeline/docs/ARCHITECTURE.md)
- [VesselTimeline docs README](../../src/features/VesselTimeline/docs/README.md)
- any orchestrator docs that imply `routeTimeline` is the public consumer path

The updated architecture doc should describe:

- backend event row queries
- client event merge and render pipeline
- separate `VesselLocation` subscription for active indicator placement
- removal of route-shaped snapshot coupling

### Acceptance checklist

- `rg "routeTimeline"` returns only historical docs or intentionally retained
  route-level consumers.
- Convex codegen no longer exposes deleted route timeline functions.
- `bun run type-check` passes.
- `bun run convex:typecheck` passes.

---

## Stage 6: verification and rollout

### Manual verification

Verify a vessel with:

- no actual events yet
- active at-dock interval
- active at-sea interval
- completed arrival and departure actuals
- WSF ETA prediction
- ML prediction without WSF ETA

Confirm:

- row order matches the previous route timeline adapter
- terminal card geometry remains stable
- active indicator still moves from `VesselLocation`
- predicted row updates do not require route snapshot refresh semantics
- schedule reseed updates still rebuild the visual backbone

### Automated verification

Run:

- `bun run type-check`
- `bun run convex:typecheck`
- targeted `VesselTimeline` tests
- targeted event query tests
- targeted merge/parity tests

If the app has an accessible local preview for this screen, capture before/after
screenshots for one representative vessel/day.

---

## Risks and mitigations

### Risk: duplicate merge semantics drift

Mitigation: prefer a shared pure merge module. If mirroring is faster, add
fixture-based parity tests and track a follow-up to consolidate.

### Risk: loading states become flickery with three subscriptions

Mitigation: the events context should expose a single `isLoading` while any
required query is loading. The presentation builder should not render partial
rows unless explicitly designed to do so.

### Risk: client imports backend-only code

Mitigation: check imports carefully. Do not import Convex generated server
types, `QueryCtx`, or Convex function modules into `src`. Use client-safe types
or inferred API return types.

### Risk: route-level behavior was implicitly relied on

Mitigation: use fixture parity tests before deleting `routeTimeline`. Search all
imports and verify whether any route overview surface still consumes the route
model intentionally.

---

## Out of scope

- Changing event table schemas.
- Changing orchestrator persistence semantics.
- Adding pagination to vessel/day event queries.
- Redesigning the visual timeline UI.
- Replacing Convex realtime subscriptions with manual fetches.

---

## Document history

- **2026-05-03:** Initial implementation PRD for migrating `VesselTimeline` from
  route snapshots to client-owned event row queries.
