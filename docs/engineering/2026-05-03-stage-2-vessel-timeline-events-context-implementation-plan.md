# Stage 2 implementation plan: client vessel timeline events context

**Status:** Planning  
**Related:** [PRD](./2026-05-03-vessel-timeline-client-event-queries-prd.md), [Stage 1 handoff](./2026-05-03-stage-1-vessel-timeline-event-queries-handoff.md)

This document captures the implementation plan for **Stage 2** of the VesselTimeline
migration: a client context that subscribes to the three Stage 1 public event-row
queries without yet changing timeline rendering or removing the route timeline.

---

## Goals (from PRD)

- Add **`ConvexVesselTimelineEventsContext`** with provider and hook that run
  **three** `useQuery` subscriptions (scheduled, actual, predicted) for one
  **`vesselAbbrev` + `sailingDay`**.
- **Do not** change `VesselTimeline` rendering or
  `useVesselTimelinePresentationState` consumption yet (no feature hook-up until
  Stage 3).
- **Do not** edit `ConvexRouteTimelineContext.tsx`.
- **Do not** import `routeTimeline` or merge event rows in the context.

---

## Files to add

| File | Role |
|------|------|
| `src/data/contexts/convex/ConvexVesselTimelineEventsContext.tsx` | Error boundary + query provider + context + `useConvexVesselTimelineEvents` |
| `src/data/contexts/convex/tests/ConvexVesselTimelineEventsContext.test.ts` (or `.tsx` if rendering) | Unit tests for context value behavior |

Optional (only if it keeps tests simple without mocking `useQuery`):

| File | Role |
|------|------|
| `src/data/contexts/convex/convexVesselTimelineEventsValue.ts` | Pure function: raw triple + scope + retry → context value (`isLoading`, arrays, `errorMessage`) |

**Update** `src/data/contexts/index.ts` to re-export the new provider and hook.

---

## Convex API wiring

- Use the Stage 1 public queries with **`vesselAbbrev`** / **`sailingDay`** args
  (camelCase), matching handlers.
- Paths mirror **`ConvexRouteTimelineContext`**
  (`api.functions.routeTimeline.queries.…`). Codegen nests modules under
  `convex/functions/events/` as **`api.functions.events.*`** (not the flat
  names on `convex/functions/index.ts`):
  - `api.functions.events.eventsScheduled.queries.listScheduledDockEventsForVesselSailingDay`
  - `api.functions.events.eventsActual.queries.listActualDockEventsForVesselSailingDay`
  - `api.functions.events.eventsPredicted.queries.listPredictedDockEventsForVesselSailingDay`  
  Confirm in `convex/_generated/api` if the project’s Convex version changes
  layout.

---

## Context contract

Expose a type aligned with the PRD, for example:

```ts
type ConvexVesselTimelineEventsContextType = {
  vesselAbbrev: string;
  sailingDay: string;
  scheduledEvents: …;
  actualEvents: …;
  predictedEvents: …;
  isLoading: boolean;
  errorMessage: string | null;
  retry: () => void;
};
```

### Row typing (decision)

- **Recommended for Stage 2:** Use the **wire shapes** returned by the three list
  queries (same as `ConvexScheduledDockEvent`, `ConvexActualDockEvent`,
  `ConvexPredictedDockEvent` from the `functions/events/.../schemas` modules,
  imported from `convex/...` paths consistent with the rest of `src`). That
  avoids new converters and matches `useQuery` exactly.
- The PRD names `ScheduledDockEvent` / `ActualDockEvent` / `PredictedDockEvent`
  already mean something in this repo: **`ScheduledDockEvent`** /
  **`ActualDockEvent`** in `@/types` are **domain** shapes with **`Date`**
  fields via `toDomain*`. **`PredictedDockEvent`** is **not** exported from
  `@/types` today.  
  **Either:** (a) use `Convex*` names in the context type for honesty, or (b)
  add **`toDomainPredictedDockEvent`** next to `dockEventToDomain.ts`, export
  **`PredictedDockEvent`**, and map all three in the provider so the PRD names
  match reality.  
  Pick one approach in implementation; (a) is faster; (b) matches the PRD
  snippet literally and aligns with Dates if any UI reads times before Stage 3.

### Loading / arrays

- `isLoading === true` if **any** of the three `useQuery` results is **`undefined`**
  (still fetching).
- Per PRD: **only treat a slice as “loaded” when it is non-`undefined`**. Practical
  pattern: while that slice is `undefined`, expose **`[]`** for it **and** rely on
  **`isLoading`** so consumers do not interpret “loading” as “empty day”.
  Document that invariant in TSDoc on the context type.

### Skip / no subscription

- If **`vesselAbbrev`** or **`sailingDay`** were optional, use Convex **`"skip"`**
  for all three queries. The PRD allows **required** props if the screen always
  has them—**`VesselTimeline` already has required `vesselAbbrev` and
  `sailingDay`**, so the provider can require them too and always pass real args
  (no `skip`).

---

## Error boundary and retry

- **Copy the structure** from `ConvexRouteTimelineContext.tsx`: class
  **`ConvexVesselTimelineEventsErrorBoundary`** with the same
  `getDerivedStateFromError` / `componentDidCatch` / fallback pattern.
- Outer provider: on error, provide context with a stable **`errorMessage`**,
  **`isLoading: false`**, empty arrays, and **`retry`** from props (default
  no-op).
- Inner **`ConvexVesselTimelineEventsQueryProvider`**: three `useQuery` calls,
  **`errorMessage: null`** in the happy path.
- **`onRetry?: () => void`** on the public provider (same as route timeline);
  **`VesselTimelineDataHost`** can pass the same **`retry`** / **`providerKey`**
  pattern when something consumes this context; for Stage 2, passing
  **`onRetry={retry}`** from `VesselTimelineDataHost` keeps behavior consistent
  even if nothing reads the hook yet.

---

## Provider wiring in `VesselTimeline`

In **`VesselTimelineDataHost`** (`VesselTimeline.tsx`), after
**`resolvedRouteAbbrev`** is known and inside the successful branch that today
returns:

`ConvexRouteTimelineProvider` → `RouteModelVesselTimelinePresentation`

**Wrap with** (or nest) **`ConvexVesselTimelineEventsProvider`** so both providers
wrap the same presentation subtree:

- Suggested tree:

  `ConvexVesselTimelineEventsProvider` (**vesselAbbrev**, **sailingDay**,
  **onRetry**)  
  → `ConvexRouteTimelineProvider` (unchanged props)  
  → `RouteModelVesselTimelinePresentation`

- Reuse **`providerKey`** on the **outer** wrapper or on both so retry remounts
  the intended subtree (match how route timeline uses `key` today).

**No changes** to **`useRouteModelVesselTimelinePresentationState`** or
**`VesselTimelineContent`** in Stage 2.

---

## Tests

PRD: loading, ready, error fallback, retry.

**Recommended approach:**

1. **Pure function tests** (if you extract
   `buildConvexVesselTimelineEventsContextValue` or similar):  
   - all `undefined` → `isLoading: true`, arrays `[]`  
   - all arrays (possibly empty) → `isLoading: false`  
   - mixed `undefined` / data → `isLoading: true`  
   - `retry` identity passed through  

2. **Error boundary:** minimal test that a throwing child triggers fallback and
   the context exposes a non-null **`errorMessage`** (React Testing Library +
   `render`, or a small test component). If RTL is not set up for `src`, a
   follow-up task can add it; the PRD tests are still valuable via (1) + manual
   smoke.

**Do not** mock the entire Convex client unless you already have a pattern;
prefer testing **value construction** and thin provider logic.

---

## Verification

- `bun run type-check`
- `bun run check:fix`
- Manual: open a screen that mounts **`VesselTimeline`**, confirm no regressions
  (still route-timeline-driven).
- Confirm **no** new imports from `convex/functions/routeTimeline` in the new
  file.

---

## Out of scope (Stage 2)

- `useVesselTimelinePresentationState` / `fromRouteTimelineModel` migration  
- Feature flag (only if you hit a blocker; PRD allows “beside” provider without
  flag)  
- Shared generic error-boundary extraction (optional cleanup)

---

## Order of work

1. Implement context module + types + provider + hook.  
2. Export from `src/data/contexts/index.ts`.  
3. Wire provider in `VesselTimeline.tsx`.  
4. Add tests + run typecheck / lint / targeted `bun test`.

This sequence keeps the UI behavior unchanged while making the new subscriptions
live and testable for Stage 3.

---

## Document history

- **2026-05-03:** Initial Stage 2 implementation plan (context, wiring, tests,
  verification).
