# Handoff: Vessel orchestrator Stage C trips pipeline

**Date:** 2026-04-19  
**Audience:** engineer or agent implementing Stage C of the idempotent
four-pipeline refactor  
**Status:** actionable handoff for the next implementation pass

## Primary reference

Read this PRD first and treat it as the source of truth for Stage C:

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)

Read these as active constraints:

- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- [`/.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)

Optional background, only if needed:

- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)
- [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)

## What Stages A and B already landed

Stage A froze the public trips contract and created the canonical wrapper:

- [updateVesselTrips/contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/contracts.ts)
- [updateVesselTrips/runUpdateVesselTrips.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/runUpdateVesselTrips.ts)
- [updateVesselTrips/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/index.ts)

Stage B moved the locations concern into domain, so the trips stage can now
assume the upstream `vesselLocations` handoff is the canonical normalized domain
output.

## Stage C goal

Make `updateVesselTrips` the real domain owner of trip computation under the
Stage A public contract.

This means:

- `runUpdateVesselTrips(input) -> output` remains the canonical public entrypoint
- trips compute every tick
- trips computes authoritative trip truth
- trips emits:
  - `activeTrips`
  - `completedTrips`
  - `tripComputations`
- the functions layer owns persistence, dedupe, and table-specific mutation
semantics

Stage C is where the trips concern stops being just a thin wrapper over the
legacy bundle story and becomes the real public story.

## Current state

Right now, [runUpdateVesselTrips.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/runUpdateVesselTrips.ts)
is intentionally a Stage A adapter:

- it builds legacy `ProcessVesselTripsDeps`
- it calls `computeVesselTripsWithClock(...)`
- it converts the resulting `VesselTripsComputeBundle` into the canonical Stage
  A contract
- it still depends on legacy persistence-oriented helpers like
  `buildVesselTripTickWriteSetFromBundle(...)` to derive row outputs

That was the correct compromise for Stage A. It is not the desired Stage C end
state.

## Desired Stage C end state

### Public domain story

The trips concern should present this single public story:

- `runUpdateVesselTrips(input) -> { activeTrips, completedTrips, tripComputations }`

The public contracts in [contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/contracts.ts)
should remain stable unless a very strong reason appears. Prefer preserving the
Stage A surface.

### Domain ownership

`updateVesselTrips` should own the computation of:

- completed trip rows
- active trip rows
- handoff data for downstream stages

The trips concern should not require function-layer mutation wrappers or
storage-write helpers to explain its own output.

### Functions-layer story

The functions layer should own:

- loading `existingActiveTrips`
- loading `scheduleContext`
- calling `runUpdateVesselTrips`
- deduping active and completed rows
- persisting them to the correct tables
- passing `tripComputations` to Stage D

## Main implementation target

Reduce or remove the trips concern's dependence on legacy persistence-shaped
intermediate outputs as the main public explanation of what the stage does.

Today, this helper is a key sign of the old architecture:

- [buildVesselTripTickWriteSetFromBundle(...)](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/shared/orchestratorPersist/vesselTripTickWriteSet.ts)

That helper still has value for persistence, but it should not be the primary
way the trips concern derives its own public outputs.

## Recommended implementation approach

### 1. Keep the public contract stable

Do not redesign the public Stage A contract unless absolutely necessary.

Preserve:

- `RunUpdateVesselTripsInput`
- `RunUpdateVesselTripsOutput`
- `TripComputation`
- `runUpdateVesselTrips`

If `TripComputation` needs small refinements, keep them minimal and additive if
possible.

### 2. Make `runUpdateVesselTrips` derive outputs from trip compute directly

Preferred direction:

- compute the trip results
- derive `activeTrips`, `completedTrips`, and `tripComputations` directly from
  the trip lifecycle outputs
- avoid routing the public output story through a persistence write set unless
  no reasonable short-term alternative exists

It is fine if some legacy helpers still exist internally, but Stage C should
move the conceptual ownership away from persistence-shaped bundle adapters.

### 3. Keep `scheduleContext` as plain data

The Stage A public contract already defines:

- `scheduleContext: VesselTripScheduleContext`

That should remain plain data at the boundary. Internally, Stage C may still
convert it into whatever lookup helpers the current trip internals need.

Do not reintroduce a public dependency bag or query-backed schedule port.

### 4. Preserve "always compute" behavior

This stage should continue the new architectural direction:

- trips runs every tick
- trips computes the correct current truth
- functions decides whether rows changed enough to persist

Do not let legacy event-gated scheduling logic creep back into the public
contract or orchestration story.

### 5. Keep prediction concerns out of the trips boundary

Do not make Stage C depend on prediction tables or query-backed prediction
lookups.

The public trips story should remain prediction-free even if some legacy helper
types still mention prediction-enriched trip rows internally.

## Current likely files to touch

### Main Stage C files

- [convex/domain/vesselOrchestration/updateVesselTrips/runUpdateVesselTrips.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/runUpdateVesselTrips.ts)
- [convex/domain/vesselOrchestration/updateVesselTrips/contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/contracts.ts)
- [convex/domain/vesselOrchestration/updateVesselTrips/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/index.ts)

### Legacy internal machinery likely involved

- [computeVesselTripsWithClock.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/processTick/computeVesselTripsWithClock.ts)
- [processVesselTrips.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts)
- [vesselTripsComputeBundle.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/vesselTripsComputeBundle.ts)
- [processCompletedTrips.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCompletedTrips.ts)
- [processCurrentTrips.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts)

### Persistence-shaped helpers to treat carefully

- [persistVesselTripWriteSet.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/persistVesselTripWriteSet.ts)
- [vesselTripTickWriteSet.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/shared/orchestratorPersist/vesselTripTickWriteSet.ts)
- [tripsComputeStorageRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/shared/orchestratorPersist/tripsComputeStorageRows.ts)

### Caller to understand but not fully refactor yet

- [convex/functions/vesselOrchestrator/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/actions.ts)

The functions-layer caller does not need a full architectural rewrite in Stage
C, but you should keep its needs in mind so the repo stays coherent.

## Non-goals for Stage C

Do **not** let Stage C expand into:

- Stage D prediction-context migration
- Stage E timeline redesign
- a broad `shared/tickHandshake` redesign
- a full persistence-layer rewrite
- aggressive cleanup of every legacy trip helper just because you touched it

Stage C is about making the trips concern the real domain owner under the
already-frozen public contract.

## Acceptance criteria

Stage C is complete when all of the following are true:

1. `runUpdateVesselTrips` remains the canonical public entrypoint.
2. The trips concern owns the real computation story for:
   - `activeTrips`
   - `completedTrips`
   - `tripComputations`
3. The public trips story is not primarily explained through persistence write
   sets or mutation payloads.
4. `scheduleContext` remains plain data at the boundary.
5. No new public dependency bags, query ports, or mutation adapters are added.
6. Functions code still owns dedupe and persistence.
7. `tripComputations` remains the handoff consumed by Stage D.

## Test expectations

At minimum, preserve or extend coverage for:

- current-trip computation
- completed-trip computation
- row outputs for active and completed trips
- shape and stability of `tripComputations`
- functions-layer sequencing remaining coherent after the Stage C changes

Likely existing test anchor:

- [processVesselTrips.tick.test.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts)

If you add concern-local tests for `runUpdateVesselTrips`, prefer placing them
under `convex/domain/vesselOrchestration/updateVesselTrips/tests/` rather than
expanding the public API for test reachability.

## Validation

After implementing Stage C, run the usual checks:

- `bun run type-check`
- `bun run convex:typecheck`
- `bun run check:fix`

If Stage C meaningfully changes trip behavior, add or rerun the most relevant
targeted test suites as well.

## Risks and pitfalls

1. Letting persistence helpers remain the real owner of row derivation.
   - That would preserve the old architecture behind a new wrapper.
2. Over-expanding `TripComputation`.
   - Prefer a stable, minimal handoff over speculative richness.
3. Reintroducing scheduling or write-suppression logic into domain outputs.
   - Trips should compute truth every tick; functions decides what to write.
4. Pulling prediction concerns back into trips.
   - Stage C should make the trips boundary cleaner, not more entangled.

## Practical recommendation

If you need a simple decision rule for Stage C, use this:

- `runUpdateVesselTrips` should tell the truth about trips
- persistence helpers should help persist that truth, not define it

That is the architectural move this stage should accomplish.

## Follow-on stages

After Stage C, the next stages are:

- Stage D: predictions
- Stage E: timeline
- Stage F: cleanup

See the PRD for details:

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)

## Revision history

- **2026-04-19:** Initial Stage C handoff created after Stages A and B landed.
  Focused on making `updateVesselTrips` the real domain owner under the frozen
  public contract.
