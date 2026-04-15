# Phase 1 Checklist: ScheduledTrips Domain Migration

Date prepared: 2026-04-14  
Audience: implementation agent handling Phase 1 of the functions/domain boundary
reorganization  
Status: actionable migration checklist  
Scope: move schedule transformation business logic out of
`convex/functions/scheduledTrips/` and into `convex/domain/`

## Purpose

This document turns Phase 1 of
`docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
into a concrete implementation checklist.

The goal of Phase 1 is narrow:

- move scheduled-trip transformation logic into `convex/domain/`
- keep `convex/functions/scheduledTrips/` as a thin Convex-facing adapter layer
- remove the current `domain -> functions` dependency caused by timeline reseed
  importing scheduled-trip transformation code from the functions layer

This phase should preserve runtime semantics.

## Read First

Before implementing, read:

- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
- `docs/convex_rules.mdc`
- `convex/domain/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `docs/handoffs/vessel-trip-and-timeline-redesign-spec-2026-04-12.md`
- `docs/handoffs/vessel-timeline-module-boundary-handoff-2026-04-13.md`
- `docs/handoffs/vesseltimeline-reconciliation-memo-2026-04-14.md`

## Phase Goal

At the end of this phase:

- classification and estimate logic no longer lives under
  `convex/functions/scheduledTrips/sync/transform/`
- `convex/domain/timelineReseed/seedScheduledEvents.ts` no longer imports from
  `convex/functions/scheduledTrips/sync/transform/*`
- `fetchAndTransformScheduledTrips(...)` remains available to function-layer
  callers, but becomes a thin adapter over domain logic
- tests protecting scheduled-trip business rules move with the logic

## Current Source Map

### Files that should move to `convex/domain/`

These files are business logic and should not remain in the functions layer:

- `convex/functions/scheduledTrips/sync/transform/directSegments.ts`
- `convex/functions/scheduledTrips/sync/transform/estimates.ts`
- `convex/functions/scheduledTrips/sync/transform/grouping.ts`
- `convex/functions/scheduledTrips/sync/transform/officialCrossingTimes.ts`
- `convex/functions/scheduledTrips/sync/transform/pipeline.ts`
- `convex/functions/scheduledTrips/sync/transform/tests/directSegments.test.ts`

### Files that should stay in `convex/functions/`

These files are still part of the adapter / persistence layer:

- `convex/functions/scheduledTrips/actions.ts`
- `convex/functions/scheduledTrips/mutations.ts`
- `convex/functions/scheduledTrips/queries.ts`
- `convex/functions/scheduledTrips/schemas.ts`
- `convex/functions/scheduledTrips/sync/fetchAndTransform.ts`
- `convex/functions/scheduledTrips/sync/fetching/mapping.ts`
- `convex/functions/scheduledTrips/sync/fetching/*`
- `convex/functions/scheduledTrips/sync/persistence.ts`
- `convex/functions/scheduledTrips/sync/sync.ts`
- `convex/functions/scheduledTrips/sync/types.ts`

### Current call sites that must be updated

Known direct or meaningful consumers:

- `convex/functions/scheduledTrips/sync/fetchAndTransform.ts`
- `convex/domain/timelineReseed/seedScheduledEvents.ts`
- `convex/domain/ml/readme-ml.md`

Indirectly affected consumers:

- `convex/functions/scheduledTrips/sync/sync.ts`
- `convex/functions/vesselTimeline/actions.ts`

Note:

- the generated file `convex/_generated/api.d.ts` will update automatically after
  type generation; do not hand-edit it

## Proposed Target Structure

Recommended target layout:

```text
convex/domain/scheduledTrips/
  index.ts
  classifyDirectSegments.ts
  calculateTripEstimates.ts
  grouping.ts
  officialCrossingTimes.ts
  runScheduleTransformPipeline.ts
  tests/
    classifyDirectSegments.test.ts
```

This keeps the module small and pipeline-oriented.

## Public API Recommendation

The domain module should expose:

- `classifyDirectSegments`
- `calculateTripEstimates`
- `getOfficialCrossingTimeMinutes`
- `runScheduleTransformPipeline`
- grouping helpers only if still truly needed externally

Recommended default:

- keep `grouping.ts` internal unless a real external use exists
- export only what current call sites need

## Detailed Checklist

### Step 1: Create `convex/domain/scheduledTrips/`

Create the new domain folder and move the transformation logic into it.

Suggested mapping:

- `sync/transform/directSegments.ts`
  -> `domain/scheduledTrips/classifyDirectSegments.ts`
- `sync/transform/estimates.ts`
  -> `domain/scheduledTrips/calculateTripEstimates.ts`
- `sync/transform/grouping.ts`
  -> `domain/scheduledTrips/grouping.ts`
- `sync/transform/officialCrossingTimes.ts`
  -> `domain/scheduledTrips/officialCrossingTimes.ts`
- `sync/transform/pipeline.ts`
  -> `domain/scheduledTrips/runScheduleTransformPipeline.ts`
- `sync/transform/tests/directSegments.test.ts`
  -> `domain/scheduledTrips/tests/classifyDirectSegments.test.ts`

Implementation guidance:

- preserve behavior exactly
- preserve existing generics and grouping semantics
- keep comments/TSDoc concise but clear
- avoid broad barrels

### Step 2: Keep schema types in `functions/schemas.ts`

Do **not** move:

- `ConvexScheduledTrip`
- `scheduledTripSchema`

The domain module may import `ConvexScheduledTrip` from
`convex/functions/scheduledTrips/schemas.ts`.

That is acceptable because the schema file is the source of truth for persisted
table row shape.

### Step 3: Update `fetchAndTransformScheduledTrips.ts`

This file should remain in the functions layer, but become thinner.

Current role:

- fetch routes
- download raw schedule payloads
- map raw segments into `ConvexScheduledTrip`
- run transformation pipeline
- return the final data bundle

Desired role after this phase:

- same external behavior
- same return shape
- same fetch/mapping logic
- transformation imported from `convex/domain/scheduledTrips`

Expected change:

- replace `import { runTransformationPipeline } from "./transform";`
  with an import from `domain/scheduledTrips`

This file should remain the adapter used by:

- `convex/functions/scheduledTrips/sync/sync.ts`
- `convex/functions/vesselTimeline/actions.ts`

### Step 4: Update `timelineReseed`

`convex/domain/timelineReseed/seedScheduledEvents.ts` currently imports:

- `classifyDirectSegments`
- `getOfficialCrossingTimeMinutes`

from the functions layer.

Update it to import those from `convex/domain/scheduledTrips/` instead.

This is the highest-priority architectural fix in Phase 1 because it removes the
current `domain -> functions` inversion in this area.

### Step 5: Decide whether `grouping.ts` should be public

Before exporting grouping helpers from the new domain module:

- confirm whether any non-scheduledTrips code needs them
- if not, keep them internal to the module

Current behavior:

- `directSegments.ts` depends on generic grouping helpers
- `estimates.ts` depends on grouped vessel/departure logic

Default recommendation:

- keep `grouping.ts` private unless a caller outside
  `convex/domain/scheduledTrips/` requires it

### Step 6: Replace `sync/transform/index.ts`

After the move, decide between these options:

Option A:

- delete `convex/functions/scheduledTrips/sync/transform/index.ts`
- update all call sites to use `convex/domain/scheduledTrips`

Option B:

- leave a temporary compatibility shim that re-exports from the domain module
- remove it in a later cleanup pass

Recommendation:

- prefer a short-lived shim only if it reduces churn during the same PR
- otherwise update imports directly and delete the old directory

### Step 7: Move Tests With the Logic

Move `directSegments.test.ts` with the domain module.

After the move:

- update imports so the test points at `convex/domain/scheduledTrips`
- keep the same cases unless a rename requires minor cleanup

Optional:

- if estimate logic currently lacks direct tests and the moved code feels risky,
  add one focused test only if it materially reduces regression risk

Do **not** add broad test scaffolding just to mirror the file move.

### Step 8: Update Documentation References

Update any docs that still refer to the old file locations.

Known likely docs:

- `convex/domain/ml/readme-ml.md`
- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
  if the implementation agent wants the memo to reflect completed moves

Only update docs that become misleading because of the relocation.

## Suggested File-by-File Ownership After Phase 1

### `convex/functions/scheduledTrips/`

Should own:

- Convex schemas
- public/internal actions
- queries
- mutations
- persistence helpers
- WSF fetching and raw mapping to persisted row shape

Should not own:

- direct/indirect classification
- estimate derivation
- official crossing-time policy
- grouping logic used to reason about physical departures

### `convex/domain/scheduledTrips/`

Should own:

- physical-departure grouping rules
- direct/indirect classification
- estimate derivation
- official scheduled-arrival fallback policy
- one functional transformation pipeline entrypoint

Should not own:

- Convex mutations
- Convex queries
- raw WSF download calls
- table replacement logic

## Minimal Safe Implementation Sequence

Recommended execution order:

1. create `convex/domain/scheduledTrips/`
2. move `grouping.ts`
3. move `classifyDirectSegments.ts`
4. move `officialCrossingTimes.ts`
5. move `calculateTripEstimates.ts`
6. create `runScheduleTransformPipeline.ts`
7. update `fetchAndTransformScheduledTrips.ts`
8. update `timelineReseed/seedScheduledEvents.ts`
9. move/update `directSegments.test.ts`
10. remove the old `sync/transform/` directory or leave a short-lived shim

This order reduces broken imports while the code is in motion.

## Acceptance Criteria

Phase 1 is complete when all of the following are true:

- no substantive scheduled-trip transform logic remains under
  `convex/functions/scheduledTrips/sync/transform/`
- `convex/domain/timelineReseed/seedScheduledEvents.ts` imports only from
  domain-level scheduled-trip modules
- `convex/functions/scheduledTrips/sync/fetchAndTransform.ts` is still the
  adapter used by the functions layer, but delegates transformation to the
  domain layer
- scheduled-trip classification behavior is unchanged
- scheduled-trip estimate behavior is unchanged
- the moved test(s) still pass
- the codebase typechecks

## Validation Checklist

After implementation, run:

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
```

Then run focused tests covering this phase, at minimum:

```bash
bun test convex/domain/scheduledTrips/tests/*.test.ts
```

And any directly affected timeline reseed tests if imports or shared helpers
changed:

```bash
bun test convex/domain/timelineReseed/tests/*.test.ts
```

## Risks

### Risk 1: Silent semantic drift in direct/indirect classification

Mitigation:

- move the existing test with the code
- avoid opportunistic rewrites in the same PR

### Risk 2: Over-expanding Phase 1 into schedule fetch refactors

Mitigation:

- keep WSF fetch/download/mapping code where it is for now
- only move transformation logic

### Risk 3: Creating a new broad domain barrel

Mitigation:

- keep `convex/domain/scheduledTrips/index.ts` small
- export only the public transformation entrypoints actually needed

## Out of Scope for Phase 1

Do not include these in the same implementation unless explicitly directed:

- moving `vesselTrips/updates/` into `convex/domain/`
- reorganizing `VesselOrchestrator`
- changing timeline semantics
- changing schedule-sync persistence policy
- redesigning type ownership or creating a DTO layer

## Definition of Success

A new engineer should be able to look at the post-Phase-1 code and conclude:

- `convex/functions/scheduledTrips/` is the schedule sync adapter layer
- `convex/domain/scheduledTrips/` is where the schedule transformation rules live
- `timelineReseed` no longer reaches back into the functions layer for domain
  logic

That is enough for Phase 1 to be considered successful.
