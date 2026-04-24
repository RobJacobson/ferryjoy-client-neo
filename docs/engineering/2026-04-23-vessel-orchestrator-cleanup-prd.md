# Vessel Orchestrator Cleanup PRD

**Date:** 2026-04-23  
**Audience:** The next coding agent implementing cleanup in
`convex/functions/vesselOrchestrator`,
`convex/domain/vesselOrchestration`, `convex/functions/events`, and adjacent
modules.

## Purpose

Refactor `vesselOrchestrator` and its four primary concerns so the hot path is
closer to the old low-bandwidth model while preserving the best newer
architectural boundaries.

This PRD is specifically aimed at:

- reducing database bandwidth
- reducing total Convex function invocations per ping
- simplifying `actions.ts`
- making the code easier to reason about with KISS and DRY principles
- keeping production logging focused on real warnings and errors

## Executive Summary

The current orchestrator overshot. The system gained some healthy boundaries,
but the hot path became too broad:

- location dedupe now reads a helper table before persistence
- location persistence reads that same table again
- the trip path reads one full same-day schedule snapshot every ping
- `actions.ts` carries more DTO glue than the workload really needs

The desired end state is:

1. one orchestrator snapshot query
2. one WSF fetch
3. one location update pass
4. one visible per-vessel in-memory loop for changed locations
5. predictions and timeline only for vessels with real trip changes
6. one persistence mutation when writes are actually needed

## Current Status

As of the latest cleanup pass, the core hot-path goals are largely in place:

- `getOrchestratorModelData` includes current `vesselLocations`
- location dedupe compares directly against stored `vesselLocations`
- `actions.ts` uses a visible changed-vessel loop
- schedule continuity uses cached targeted `eventsScheduled` lookups
- predictions only run for materially changed trips
- persistence stays in one orchestrator-owned mutation
- `vesselLocationsUpdates` and `vesselOrchestratorScheduleSnapshots` are gone

Recent cleanup also removed a layer of prediction-stage DTO indirection:

- the prediction stage now returns the flat `predictionRows` and
  `predictedTripComputations` shapes that persistence actually consumes
- stale per-vessel prediction/timeline wrapper DTOs were removed
- small `Pick<...>` helper types in the touched orchestrator path were replaced
  with clearer explicit local types
- the extra `runTripStage` wrapper was removed from `actions.ts`
- prediction inputs now derive directly from changed `VesselTripUpdate` rows
  instead of re-filtering full `tripRows`
- shared location normalize/dedupe work now lives in
  `convex/functions/vesselOrchestrator/locationUpdates.ts` instead of the main
  hot-path action file
- prediction-stage orchestration now lives in
  `convex/functions/vesselOrchestrator/predictionStage.ts` instead of
  `actions.ts`
- targeted schedule continuity query/caching now lives in
  `convex/functions/vesselOrchestrator/scheduleContinuityAccess.ts` instead of
  `actions.ts`
- `actions.ts` no longer re-filters already-changed location updates before
  building the persistence write set
- `eventsScheduled` continuity queries now strip Convex metadata before
  returning, so their runtime return shape matches `eventsScheduledSchema`
- changed-location persistence writes now come from a shared helper in
  `convex/functions/vesselOrchestrator/locationUpdates.ts`, so test helpers do
  not need to import `actions.ts` just to reuse that mapping
- the unchanged-trip-stage summary `INFO` log was removed from `actions.ts`
- default trip-field inference `INFO` logging was removed from the hot path,
  with opt-in diagnostics exposed through `getTripFieldInferenceLog(...)`
- test-only compatibility helpers and persistence-bundle assembly now live in
  `convex/functions/vesselOrchestrator/testing.ts` instead of being exported
  from `actions.ts`

What remains is mostly polish and further simplification, not another large
hot-path redesign.

## Scope Note

This PRD is intentionally focused on the current code and the desired end
state. The implementing agent does not need the broader history of the
refactor. They should optimize for updating the current codebase directly.

## Problem Statement

The current implementation is too expensive and too indirect for a high-cadence
loop.

### Main cost problems

1. `vesselLocationsUpdates` is read on the hot path in the action
2. `vesselLocationsUpdates` is read again inside persistence
3. `vesselOrchestratorScheduleSnapshots` is read every ping
4. predictions and timeline still require too much orchestration overhead
   relative to the changed-vessel subset

### Main readability problems

1. `actions.ts` expresses the flow as staged batch DTO plumbing rather than a
   visible per-vessel control path
2. several wrapper types exist mainly to support the refactor shape rather than
   the runtime truth
3. the hot path no longer reads like the actual business logic

## Goals

- Make the hot path cheap again.
- Restore targeted schedule reads instead of broad schedule snapshot reads.
- Remove `vesselLocationsUpdates`.
- Remove `vesselOrchestratorScheduleSnapshots`.
- Make `actions.ts` easy to explain in one pass.
- Prefer a visible per-vessel in-memory loop after location updates.
- Keep one orchestrator-owned persistence mutation.
- Keep `updateVesselPredictions` as a separate concern.
- Keep timeline projection downstream of persisted trip facts.
- Prefer explicit local types over utility typing when the latter adds
  indirection without clear benefit.
- Prefer removing routine `INFO` logs over adding logging toggles or suppressed
  code paths.

## Non-Goals

- Do not redesign the entire trip lifecycle model.
- Do not re-embed prediction logic into trip construction.
- Do not make timeline writes speculative before persistence succeeds.
- Do not introduce per-vessel `runMutation` fan-out.
- Do not add new broad helper tables as replacements for the removed ones.

## Required Design Decisions

## 1. `actions.ts` should use a visible per-vessel loop

After `updateVesselLocations`, the action should explicitly iterate the changed
vessel locations:

```text
updateVesselLocations

for each changed vessel location
  updateVesselTrip(...)
  if trip materially changed
    updateVesselPrediction(...)
    buildVesselTimelineUpdate(...)

persist once
```

This is the preferred readability model.

Important constraint:

- this is an in-memory control-flow preference
- it is not permission to turn the system into per-vessel Convex I/O

## 2. Per-vessel loop is allowed, per-vessel broad I/O is not

The implementation may do:

- one shared snapshot query
- one shared WSF fetch
- one final persistence mutation
- rare targeted schedule queries for continuity
- shared cached model access for predictions

The implementation must avoid:

- per-vessel broad snapshot queries
- per-vessel persistence mutations
- per-vessel model preload queries

## 3. `updateVesselLocations` should move back toward the old model

The preferred shape is:

1. fetch latest WSF data
2. load existing stored vessel locations once
3. normalize current WSF rows
4. compare with existing rows
5. upsert changed rows

The current `vesselLocationsUpdates` table should be removed.

## 4. Schedule access should be atomic and conditional

The implementation should remove the always-on schedule snapshot read and move
back toward atomic schedule lookups that run only when needed.

Acceptable examples:

- direct segment lookup by `ScheduleKey`
- same-vessel next departure lookup after a prior scheduled departure

The old pre-refactor `eventsScheduled` query pattern is a valid reference.

## 5. Predictions and timeline should remain downstream concerns

The cleanup should preserve this structure:

- trip update computes the durable trip result
- prediction update computes ML enrichments only for changed trips
- timeline update builds projection inputs only for changed trips
- final persistence still owns durable writes

## Desired End State

## Runtime shape

The target runtime shape should be:

1. baseline snapshot query
2. WSF fetch
3. location normalization
4. existing-location comparison
5. changed-location extraction
6. per-vessel trip update for changed locations
7. per-vessel prediction/timeline only for changed trips
8. one persistence mutation

## Read/write shape

The target cost profile should roughly be:

- unchanged tick:
  - no persistence mutation
  - no schedule query
  - no prediction model query
- changed location with no trip change:
  - location writes only
  - no prediction/timeline work
- changed trip requiring continuity help:
  - only targeted `eventsScheduled` queries for that vessel

## Functional Requirements

## A. `updateVesselLocations`

### Requirements

- normalize WSF rows through the current location mapping code
- compare against stored `vesselLocations`
- write only changed rows
- return the changed-vessel subset needed by downstream logic
- stop using `vesselLocationsUpdates`

### Implementation guidance

- use one read of stored vessel locations keyed by vessel identity
- perform upsert using those existing rows
- do not reintroduce a second helper-table read inside persistence

## B. `updateVesselTrips`

### Requirements

- accept one changed vessel location at a time from `actions.ts`
- use the existing active trip for that vessel from the shared snapshot
- compute whether the trip materially changed
- support schedule continuity via targeted lookups only when needed
- preserve current trip-field resolution order:
  - WSF fields first
  - explicit next-leg continuity second
  - rollover continuity third
  - fallback reuse last

### Implementation guidance

- preserve the cleaner trip compute boundary from the refactor
- remove the unconditional dependency on `getScheduleSnapshotForPing`
- prefer narrow helper inputs and outputs
- prefer explicit local types over `Pick<...>` or similar utility typing when
  a small spelled-out type is clearer

## C. `updateVesselPredictions`

### Requirements

- run only when a vessel's trip materially changed
- keep separate from trip construction
- avoid per-vessel model preload fan-out
- allow shared cached model access by terminal pair

### Implementation guidance

- shared preload for the changed-trip subset is acceptable
- an in-memory cache keyed by pair is also acceptable
- the helper should feel single-vessel at the callsite even if it uses shared
  preloaded model state

## D. `updateVesselTimeline`

### Requirements

- run only when a vessel's trip materially changed
- remain downstream of persisted trip facts
- build per-vessel timeline inputs in the action layer if that simplifies the
  loop
- keep final event writes inside orchestrator persistence

### Implementation guidance

- it is acceptable for the action layer to build per-vessel timeline DTOs
- it is not acceptable to write timeline rows before trip persistence succeeds

## E. `actions.ts`

### Requirements

- express the main control flow visibly
- minimize stage-wide wrapper DTOs
- keep the top-level path readable without jumping through multiple "bundle"
  helpers
- preserve one final orchestrator persistence mutation

### Preferred pseudocode

```ts
const snapshot = await loadOrchestratorSnapshot(ctx);
const locationResult = await updateVesselLocations(...);

for (const changedLocation of locationResult.changedLocations) {
  const tripUpdate = await updateVesselTrip(...);
  if (!tripUpdate.materiallyChanged) {
    continue;
  }

  const predictionUpdate = await updateVesselPrediction(...);
  const timelineUpdate = buildVesselTimelineUpdate(...);

  collect(tripUpdate, predictionUpdate, timelineUpdate);
}

if (nothingChanged) {
  return;
}

await persistOrchestratorPing(...);
```

This pseudocode is illustrative. The implementing agent may adjust names and
exact helper boundaries, but the visible control flow should feel like this.

## F. Persistence

### Requirements

- keep one orchestrator-owned persistence mutation
- preserve trip persistence before timeline projection
- allow location-only writes when trips do not change
- skip the mutation entirely when nothing changed

### Implementation guidance

- persistence bundle shape may be simplified
- do not retain wrapper DTOs that exist only to be flattened immediately

## Schema And Query Requirements

The cleanup should remove these tables from live runtime use:

- `vesselLocationsUpdates`
- `vesselOrchestratorScheduleSnapshots`

The cleanup should rely instead on:

- `vesselLocations`
- `activeVesselTrips`
- `eventsScheduled`

If transitional compatibility is needed, deletion can occur in a later commit,
but the implementing agent should complete logical deprecation in this work.

## Suggested File Targets

Primary files likely to change:

- `convex/functions/vesselOrchestrator/actions.ts`
- `convex/functions/vesselOrchestrator/queries.ts`
- `convex/functions/vesselOrchestrator/mutations.ts`
- `convex/functions/vesselOrchestrator/locationUpdates.ts`
- `convex/functions/vesselOrchestrator/schemas.ts`
- `convex/functions/vesselOrchestrator/testing.ts`
- `convex/functions/events/eventsScheduled/queries.ts`
- `convex/functions/events/eventsScheduled/mutations.ts`
- `convex/functions/vesselLocationsUpdates/*`
- `convex/domain/vesselOrchestration/updateVesselTrips/*`
- `convex/domain/vesselOrchestration/updateVesselPredictions/*`
- `convex/domain/vesselOrchestration/updateTimeline/*`
- `convex/schema.ts`

Pre-refactor reference files:

- `/private/tmp/ferryjoy-client-neo-pre-vessel-orchestration/convex/functions/vesselOrchestrator/actions.ts`
- `/private/tmp/ferryjoy-client-neo-pre-vessel-orchestration/convex/functions/vesselLocation/mutations.ts`
- `/private/tmp/ferryjoy-client-neo-pre-vessel-orchestration/convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts`
- `/private/tmp/ferryjoy-client-neo-pre-vessel-orchestration/convex/functions/vesselTrips/updates/tripLifecycle/appendSchedule.ts`

## Testing Requirements

The implementing agent should add or update focused tests covering:

- unchanged location tick
- changed location with no trip change
- changed location with trip change
- targeted schedule continuity path
- completed-trip and replacement-trip path
- prediction/timeline gating behavior
- orchestrator no-op tick behavior

At minimum, the implementing agent should run focused tests for:

- vessel orchestrator
- location persistence
- trip update logic
- prediction stage
- timeline projection

If schema changes land, they should also run:

- `bun run convex:codegen`
- `bun run convex:typecheck`

Recent focused verification that already passed on this cleanup path:

- `bun test convex/functions/vesselOrchestrator/tests/updateVesselLocations.test.ts`
- `bun test convex/functions/vesselOrchestrator/tests/persistenceBundle.test.ts convex/functions/vesselOrchestrator/tests/tripStagePolicy.test.ts convex/functions/vesselOrchestrator/tests/predictionStagePolicy.test.ts`
- `bun run convex:typecheck`

## Observability Requirements

The implementation summary should explicitly state:

- whether `vesselLocationsUpdates` was fully removed
- whether `vesselOrchestratorScheduleSnapshots` was fully removed
- how schedule continuity now loads its data
- whether the action now exits early on unchanged ticks
- what the final per-ping query/mutation shape is

## Definition Of Done

- `actions.ts` expresses the orchestrator flow with a visible per-vessel loop
  for changed locations
- `vesselLocationsUpdates` is removed from the hot path
- `vesselOrchestratorScheduleSnapshots` is removed from the hot path
- schedule continuity uses targeted schedule queries instead of one daily
  snapshot read
- predictions run only for materially changed trips
- timeline work runs only for materially changed trips
- no per-vessel persistence fan-out was introduced
- final persistence still runs through one orchestrator mutation
- focused tests pass

## Issue-Style Checklist

- [ ] Read:
  - [ ] `docs/engineering/2026-04-23-vessel-orchestrator-before-after-memo.md`
  - [ ] `docs/engineering/2026-04-21-vessel-orchestrator-cost-reduction-memo.md`
  - [ ] this PRD
- [ ] Confirm the current hot-path reads in:
  - [ ] `convex/functions/vesselOrchestrator/actions.ts`
  - [ ] `convex/functions/vesselLocationsUpdates/mutations.ts`
  - [ ] `convex/functions/vesselOrchestrator/queries.ts`
- [ ] Refactor `updateVesselLocations` toward:
  - [ ] fetch WSF rows
  - [ ] load existing stored vessel locations
  - [ ] compare timestamps directly
  - [ ] upsert changed rows
- [ ] Remove `vesselLocationsUpdates` from action-layer dedupe.
- [ ] Remove `vesselLocationsUpdates` from persistence-layer dedupe.
- [ ] Deprecate and then delete `convex/functions/vesselLocationsUpdates/*`.
- [ ] Remove `vesselLocationsUpdates` from `convex/schema.ts`.
- [ ] Restore targeted schedule access through `eventsScheduled`.
- [ ] Remove `getScheduleSnapshotForPing` from the hot path.
- [ ] Remove `vesselOrchestratorScheduleSnapshots` from `convex/schema.ts`.
- [ ] Remove snapshot materialization from scheduled-event mutations.
- [ ] Simplify `actions.ts` so the main path is:
  - [ ] update locations
  - [ ] loop changed vessel locations
  - [ ] compute trip update
  - [ ] if trip changed, compute prediction update
  - [ ] if trip changed, build timeline update
  - [ ] persist once
- [ ] Keep the loop mostly in memory.
- [ ] Do not introduce per-vessel `runMutation(...)`.
- [ ] Keep rare targeted schedule queries acceptable.
- [ ] Ensure prediction model loading is shared or cached for the changed-trip
      subset.
- [ ] Ensure timeline writes still happen only after trip persistence succeeds.
- [ ] Simplify bundle/DTO shapes where they are immediately flattened.
- [ ] Add or update focused tests for no-op, location-only, trip-change, and
      continuity cases.
- [ ] Run focused tests and type checks.
- [ ] In the final summary, report the new hot-path read/write shape in plain
      language.

## Final Guidance

This work should feel like a focused cleanup pass, not a history review and not
a novel architecture pass.

The ideal result is:

- the old system's hot-path discipline
- the newer system's better separation of concerns
- a top-level orchestrator that reads like the real business flow

If a design choice improves abstraction but worsens hot-path cost or makes
`actions.ts` harder to reason about, prefer the simpler option.
