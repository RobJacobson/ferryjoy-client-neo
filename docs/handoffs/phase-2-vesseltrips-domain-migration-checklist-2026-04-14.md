# Phase 2 Checklist: VesselTrips Domain Migration

Date prepared: 2026-04-14  
Audience: implementation agent handling Phase 2 of the functions/domain boundary
reorganization  
Status: actionable migration checklist  
Scope: move the substantive `vesselTrips/updates` lifecycle pipeline into
`convex/domain/` while preserving current runtime semantics

## Purpose

This document turns Phase 2 of
`docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
into a concrete implementation checklist.

The goal of Phase 2 is:

- move the vessel-trip lifecycle state machine and projection assembly logic into
  `convex/domain/vesselTrips/`
- keep `convex/functions/vesselTrips/` as the Convex-facing persistence and
  adapter layer
- preserve existing orchestrator tick ordering and runtime behavior
- avoid reintroducing `domain -> functions` implementation coupling

This phase should preserve semantics and avoid broad rewrites.

## Read First

Before implementing, read:

- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
- `convex/functions/vesselTrips/updates/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `docs/handoffs/vessel-trip-and-timeline-redesign-spec-2026-04-12.md`
- `docs/handoffs/trip-timestamp-semantics-prd-2026-04-14.md`
- `docs/handoffs/vesseltimeline-reconciliation-memo-2026-04-14.md`
- `docs/handoffs/vessel-timeline-module-boundary-handoff-2026-04-13.md`
- `docs/convex_rules.mdc`

## Phase Goal

At the end of this phase:

- the lifecycle pipeline currently under
  `convex/functions/vesselTrips/updates/` lives primarily in
  `convex/domain/vesselTrips/`
- `convex/functions/vesselTrips/updates/` becomes a small compatibility/adaptor
  surface
- the orchestrator can still call `processVesselTrips(...)` without semantic
  changes
- the timeline projection write envelope (`TickEventWrites`) remains stable
- business-rule tests move with the logic

Important boundary for this phase:

- **do not** fully solve docked schedule continuity in this phase
- `resolveEffectiveLocation.ts` and `dockedScheduleResolver.ts` are addressed in
  Phase 3
- Phase 2 should introduce dependency seams so lifecycle code can move without
  keeping deep imports back into the functions layer

## Current Source Map

### Primary source areas to migrate

- `convex/functions/vesselTrips/updates/processTick/`
- `convex/functions/vesselTrips/updates/tripLifecycle/`
- `convex/functions/vesselTrips/updates/projection/`
- `convex/functions/vesselTrips/updates/tests/`

### Files that are strong move candidates

These are substantive lifecycle/domain modules:

- `processTick/processVesselTrips.ts`
- `processTick/tickEnvelope.ts`
- `processTick/tickEventWrites.ts`
- `processTick/tickPredictionPolicy.ts`
- `tripLifecycle/baseTripFromLocation.ts`
- `tripLifecycle/buildTrip.ts`
- `tripLifecycle/buildCompletedTrip.ts`
- `tripLifecycle/detectTripEvents.ts`
- `tripLifecycle/physicalDockSeaDebounce.ts`
- `tripLifecycle/tripDerivation.ts`
- `tripLifecycle/tripEquality.ts`
- `tripLifecycle/processCompletedTrips.ts`
- `tripLifecycle/processCurrentTrips.ts`
- `tripLifecycle/appendPredictions.ts`
- `projection/lifecycleEventTypes.ts`
- `projection/actualBoundaryPatchesFromTrip.ts`
- `projection/timelineEventAssembler.ts`
- `tests/*.test.ts`

### Additional helper to relocate or neutralize

`convex/functions/vesselTrips/stripTripForStorage.ts` is a shared data-shaping
rule currently used by:

- `convex/functions/vesselTrips/mutations.ts`
- `convex/functions/vesselTrips/updates/tripLifecycle/tripEquality.ts`

Because `tripEquality.ts` should move into `convex/domain/`, this helper should
either:

- move into `convex/domain/vesselTrips/`, or
- move into a neutral shared location used by both the domain module and
  mutations

Recommendation:

- move it into `convex/domain/vesselTrips/stripTripPredictionsForStorage.ts`
- update `functions/vesselTrips/mutations.ts` to import the helper from domain

### Explicitly deferred for Phase 3

These files are important, but should not be fully reorganized in Phase 2:

- `convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts`
- `convex/functions/eventsScheduled/dockedScheduleResolver.ts`

Reason:

- they own docked schedule continuity behavior and query wiring that Phase 3 is
  supposed to isolate cleanly

## Current Public / Cross-Module Call Sites

Known important call sites today:

- `convex/functions/vesselOrchestrator/actions.ts`
  - imports `processVesselTrips`
  - imports `computeShouldRunPredictionFallback`
- `convex/functions/vesselOrchestrator/applyTickEventWrites.ts`
  - imports `TickEventWrites`
- `convex/functions/vesselTrips/mutations.ts`
  - imports `stripTripPredictionsForStorage`

Tests and docs also reference many current deep paths, but the runtime-sensitive
call sites above are the main compatibility points.

## Proposed Target Structure

Recommended target layout:

```text
convex/domain/vesselTrips/
  index.ts
  processTick/
    processVesselTrips.ts
    tickEnvelope.ts
    tickEventWrites.ts
    tickPredictionPolicy.ts
  tripLifecycle/
    baseTripFromLocation.ts
    buildTrip.ts
    buildCompletedTrip.ts
    detectTripEvents.ts
    physicalDockSeaDebounce.ts
    tripDerivation.ts
    tripEquality.ts
    processCompletedTrips.ts
    processCurrentTrips.ts
    appendPredictions.ts
    stripTripPredictionsForStorage.ts
  projection/
    lifecycleEventTypes.ts
    actualBoundaryPatchesFromTrip.ts
    timelineEventAssembler.ts
  tests/
```

Recommendation:

- preserve the current internal subfolder structure for this phase
- do **not** attempt a big naming cleanup at the same time
- get the code into the right layer first, then simplify names later if needed

## Public API Recommendation

The new domain module should expose only a small public surface.

Recommended public entrypoints:

- `processVesselTrips`
- `ProcessVesselTripsOptions`
- `VesselTripsTickResult`
- `computeShouldRunPredictionFallback`
- `TickEventWrites`
- `stripTripPredictionsForStorage` if mutations still need it

Keep everything else private to the module unless a concrete caller needs it.

## Key Architectural Constraint for Phase 2

### Introduce dependency seams instead of dragging functions-layer logic upward

`buildTrip.ts` currently depends on:

- `resolveEffectiveLocation(...)`
- `appendFinalSchedule(...)`
- prediction enrichers

To avoid `domain -> functions` imports during the move:

1. move the lifecycle core into `convex/domain/vesselTrips/`
2. make `buildTrip` and/or the higher-level process functions accept injected
   adapters for the remaining function-layer behaviors
3. keep the actual adapter implementations in `convex/functions/` for now

Recommended temporary adapters:

- `resolveEffectiveLocation`
- `appendFinalSchedule`

These can be passed via dependency bags or explicit function parameters.

This lets Phase 2 move the state machine without prematurely collapsing Phase 3
into the same PR.

## Detailed Checklist

### Step 1: Create `convex/domain/vesselTrips/`

Create the new domain folder and move the lifecycle pipeline into it while
preserving the current subfolder structure.

Suggested move mapping:

- `updates/processTick/*`
  -> `domain/vesselTrips/processTick/*`
- `updates/projection/*`
  -> `domain/vesselTrips/projection/*`
- selected `updates/tripLifecycle/*`
  -> `domain/vesselTrips/tripLifecycle/*`
- `updates/tests/*`
  -> `domain/vesselTrips/tests/*`

Implementation guidance:

- prefer move-first, rewrite-second
- preserve exported names unless a rename is clearly beneficial and low-risk
- keep comments/TSDoc aligned with the current semantics

### Step 2: Move the pure / domain-owned lifecycle helpers

Move these first because they are the least controversial:

- `tripEventTypes.ts`
- `tripDerivation.ts`
- `detectTripEvents.ts`
- `physicalDockSeaDebounce.ts`
- `baseTripFromLocation.ts`
- `buildCompletedTrip.ts`
- `tripEquality.ts`
- `projection/lifecycleEventTypes.ts`
- `projection/actualBoundaryPatchesFromTrip.ts`
- `projection/timelineEventAssembler.ts`
- `processTick/tickEnvelope.ts`
- `processTick/tickEventWrites.ts`
- `processTick/tickPredictionPolicy.ts`

Also relocate:

- `stripTripForStorage.ts`
  -> `domain/vesselTrips/tripLifecycle/stripTripPredictionsForStorage.ts`
  or another neutral path inside `domain/vesselTrips/`

Then update:

- `functions/vesselTrips/mutations.ts`
- any moved domain files

to import the helper from its new home.

### Step 3: Move `appendPredictions.ts`

`appendPredictions.ts` is business logic and already depends mainly on domain ML
modules plus schema types.

Move it into `convex/domain/vesselTrips/tripLifecycle/`.

This reduces the amount of function-layer logic still embedded in `buildTrip`.

### Step 4: Refactor `buildTrip.ts` to use injected adapters

Before moving `buildTrip.ts`, remove hard dependencies on function-layer
implementation modules.

Current blockers:

- `resolveEffectiveLocation.ts`
- `appendSchedule.ts`

Recommended approach:

- introduce a `BuildTripDeps` or equivalent type
- inject adapters for:
  - effective location resolution
  - final schedule enrichment
- keep the default adapter wiring in the functions layer for now

This is the most important design decision in Phase 2.

Success criterion for this step:

- moved `buildTrip.ts` does not import from
  `convex/functions/vesselTrips/updates/*`
- moved `buildTrip.ts` does not import
  `functions/eventsScheduled/dockedScheduleResolver`

### Step 5: Move branch processors and top-level tick orchestration

Once `buildTrip` is movable, relocate:

- `processCompletedTrips.ts`
- `processCurrentTrips.ts`
- `processTick/processVesselTrips.ts`

The domain entrypoint should still return the same result envelope:

- `tickStartedAt`
- `activeTripsSource`
- `tickEventWrites`

Behavior to preserve:

- completed branch runs before current branch
- lifecycle persistence precedes timeline projection
- upsert-gated side effects remain gated
- per-vessel failure isolation remains intact

### Step 6: Leave thin compatibility shims in `convex/functions/`

To minimize churn, keep stable adapter files in place during this phase.

At minimum:

- `convex/functions/vesselTrips/updates/index.ts`
  should re-export the domain entrypoint/types

Optional compatibility shims if they reduce churn:

- `updates/processTick/tickPredictionPolicy.ts`
- `updates/processTick/tickEventWrites.ts`
- `updates/processTick/processVesselTrips.ts`

Recommendation:

- shims are acceptable in this phase
- delete them later only after downstream imports are simplified

### Step 7: Update orchestrator imports carefully

`convex/functions/vesselOrchestrator/actions.ts` currently imports:

- `processVesselTrips`
- `computeShouldRunPredictionFallback`

Choose one of these approaches:

Option A:

- keep current imports working via function-layer re-export shims

Option B:

- update orchestrator imports to point directly at `convex/domain/vesselTrips`

Recommendation:

- prefer Option A in Phase 2 to keep orchestrator churn low
- Phase 4 is the better moment to simplify the orchestrator import surface

### Step 8: Move tests with the logic

Move the current business-rule tests under:

- `convex/functions/vesselTrips/updates/tests/`
- `convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.test.ts`

into `convex/domain/vesselTrips/tests/`.

Likely tests worth keeping:

- `detectTripEvents.test.ts`
- `physicalDockSeaDebounce.test.ts`
- `baseTripFromLocation.test.ts`
- `buildTrip.test.ts`
- `buildCompletedTrip.test.ts`
- `tripEquality.test.ts`
- `processCompletedTrips.test.ts`
- `processVesselTrips.test.ts`
- `resolveEffectiveLocation.test.ts` should likely stay deferred with Phase 3 if
  the file itself remains deferred
- `appendSchedule.test.ts` should follow the file if moved; otherwise defer
- `actualBoundaryPatchesFromTrip.test.ts`

Do not prune aggressively in the same PR. Move first, then reassess later.

### Step 9: Update docs only where they become misleading

Minimum docs to refresh after the move:

- `convex/functions/vesselTrips/updates/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `convex/domain/README.md`
- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`

Carryover docs gap from Phase 1:

- `convex/domain/ml/readme-ml.md` still contains stale implementation-path
  references, including scheduledTrips paths removed in Phase 1

If touched, update only the sections made actively misleading by the move.

## Minimal Safe Implementation Sequence

Recommended order:

1. create `convex/domain/vesselTrips/`
2. move pure types/helpers and `stripTripPredictionsForStorage`
3. move `appendPredictions.ts`
4. introduce adapter/dependency seam for `buildTrip`
5. move `buildTrip.ts`
6. move `processCompletedTrips.ts` and `processCurrentTrips.ts`
7. move `processTick/processVesselTrips.ts`
8. leave/update function-layer re-export shims
9. move tests
10. refresh the minimum necessary docs

This order minimizes the chance of getting stuck with `domain -> functions`
imports mid-refactor.

## Acceptance Criteria

Phase 2 is complete when all of the following are true:

- the majority of lifecycle logic formerly under
  `convex/functions/vesselTrips/updates/` now lives under
  `convex/domain/vesselTrips/`
- function-layer files used by orchestrator callers are thin wrappers or
  compatibility re-exports
- the moved domain code does not import function-layer implementation modules
- any remaining function-layer dependencies are explicit injected adapters
  awaiting Phase 3
- orchestrator behavior is unchanged
- `TickEventWrites` shape is unchanged
- business-rule tests moved with the logic and still pass

## Validation Checklist

After implementation, run:

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
```

Then run focused suites, at minimum:

```bash
bun test ./convex/domain/vesselTrips/tests/*.test.ts
bun test ./convex/functions/vesselOrchestrator/tests/*.test.ts
bun test ./convex/domain/timelineRows/tests/*.test.ts
```

And any still-function-layer tests that were intentionally deferred:

```bash
bun test ./convex/functions/vesselTrips/updates/tests/*.test.ts
```

Only keep this last command if some tests remain deferred in the functions
layer during the transition.

## Risks

### Risk 1: Smuggling function-layer dependencies into the new domain module

Mitigation:

- use explicit adapters for `resolveEffectiveLocation` and schedule enrichment
- do not allow moved domain files to deep-import from `convex/functions/...`

### Risk 2: Expanding Phase 2 into full docked continuity cleanup

Mitigation:

- keep `resolveEffectiveLocation.ts` and `dockedScheduleResolver.ts` explicitly
  deferred
- handle them in Phase 3

### Risk 3: Breaking orchestrator imports mid-move

Mitigation:

- keep stable compatibility shims in `convex/functions/vesselTrips/updates/`
- delay orchestrator simplification to Phase 4

### Risk 4: Accidentally changing tick ordering or upsert gating

Mitigation:

- preserve current branch sequencing exactly
- preserve `TickEventWrites` assembly order
- move tests with the logic before pruning anything

## Out of Scope for Phase 2

Do not include these unless explicitly reopened:

- moving `resolveEffectiveLocation.ts` and `dockedScheduleResolver.ts` fully into
  domain
- major `VesselOrchestrator` simplification
- changing timeline semantics
- changing persistence policy
- broad test pruning
- large doc rewrites beyond the files made misleading by the move

## Definition of Success

A new engineer should be able to look at the post-Phase-2 code and conclude:

- `convex/domain/vesselTrips/` owns the vessel lifecycle state machine and
  tick-level workflow
- `convex/functions/vesselTrips/` owns Convex schemas, queries, mutations, and
  a thin compatibility surface
- remaining docked schedule continuity concerns are clearly isolated for Phase 3

That is enough for Phase 2 to be considered successful.
