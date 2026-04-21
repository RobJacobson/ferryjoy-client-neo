# Vessel Orchestrator Per-Vessel Pipeline PRD

**Date:** 2026-04-21  
**Primary reference:** [docs/engineering/vessel-orchestrator-per-vessel-pipeline-memo-2026-04-21.md](../engineering/vessel-orchestrator-per-vessel-pipeline-memo-2026-04-21.md)

## 1. Objective

Refactor Vessel Orchestrator from a batch-shaped in-memory pipeline into a
**per-vessel compute pipeline with batched Convex I/O**, then add a clean
off-ramp after trip computation.

Do this without regressing the recently landed improvements:

- keep the compact schedule snapshot
- keep the single orchestrator persistence mutation
- keep one shared read model load

## 2. Success criteria

The slice is successful when:

- the action is structured around per-vessel stage outputs rather than one
  large batch DTO at each step
- the code has a clear Stage 2-style unit named `computeVesselTripUpdates`
  or equivalent
- unchanged vessels can stop after trip computation
- prediction context is loaded only for vessels that survived that off-ramp
- Convex reads/writes remain batched
- behavior is preserved until the deliberate off-ramp slice lands

## 3. Guardrails

- Do not revert `vesselOrchestratorScheduleSnapshots`.
- Do not split the hot path back into many child Convex functions.
- Do not reintroduce per-vessel `runQuery` / `runMutation` fan-out.
- Do not silently change public query shapes.
- Do not mix naming cleanup with behavior changes unless it directly improves
  the current slice.

## 4. Proposed implementation plan

## Task 1: introduce per-vessel stage output types

Goal:

- create explicit types for single-vessel outputs used by the action pipeline

Suggested outputs:

- `VesselLocationUpdates`
- `VesselTripUpdates`
- `VesselPredictionUpdates`
- `VesselTimelineUpdates`

Notes:

- keep these shapes plain-data and action-friendly
- prefer names that describe one vessel and one stage
- avoid carrying large batch-level DTOs farther than necessary

Definition of done:

- the new types exist
- they are documented close to their canonical stage helpers
- no behavior change yet

## Task 2: carve out `computeVesselTripUpdates`

Goal:

- extract a pure helper that computes the trip-side outcome for one vessel

Required behavior:

- accept one vessel location, one existing active trip, schedule snapshot, and
  ping context
- produce:
  - current active trip candidate
  - completed trip when applicable
  - replacement trip when applicable
  - booleans or equivalent fields representing:
    - `tripStorageChanged`
    - `tripLifecycleChanged`

Suggested continuation predicate:

- continue when:
  - `tripStorageChanged === true`, or
  - `tripLifecycleChanged === true`

Definition of done:

- one-vessel trip computation exists as a standalone helper
- it is covered by focused tests
- the old batch outputs can still be reconstructed from the per-vessel outputs

## Task 3: reshape the action around per-vessel transforms

Goal:

- make the action read like a sequence of stage transforms, not a monolithic
  batch handoff

Target structure:

1. load shared state
2. compute location updates for all vessels
3. compute trip updates for all vessels
4. partition into changed vs unchanged trip outcomes
5. preload prediction context for changed outcomes
6. compute prediction updates for changed outcomes
7. compute timeline updates for changed outcomes
8. merge and persist

Important:

- at this step, preserve current behavior where reasonable
- if needed, land the structural reshape before activating the off-ramp

Definition of done:

- `actions.ts` reads as a stage pipeline over per-vessel outputs
- the shared Convex query and shared persistence mutation remain intact

## Task 4: activate the Stage 2 off-ramp

Goal:

- skip Stage 3 and Stage 4 for vessels with no trip updates

Policy:

- off-ramp when:
  - the active storage-shaped trip row is unchanged, and
  - there is no completed/replacement handoff

This is the key behavioral change for the slice.

Definition of done:

- prediction context is loaded only for vessels with trip updates
- prediction/timeline work is computed only for that subset
- unchanged vessels stop after trip computation

## Task 5: reconcile persistence bundle inputs

Goal:

- make `persistOrchestratorPing` accept the merged output of the new stage
  pipeline without forcing the action back into batch-shaped reasoning

Notes:

- it is fine if the persistence mutation still receives arrays
- the important thing is that those arrays come from merging stage outputs, not
  from one giant action-local batch abstraction

Definition of done:

- persistence args remain compact and explicit
- merged arrays are built from the per-vessel outputs

## Task 6: test the policy, not just the plumbing

Required cases:

- unchanged vessel:
  - Stage 2 produces no trip update
  - Stage 3 and Stage 4 are skipped
- same-trip storage change:
  - Stage 3 and Stage 4 continue
- completed trip with replacement active trip:
  - Stage 3 and Stage 4 continue
- mixed ping:
  - some vessels stop after Stage 2
  - others continue through Stage 4

Recommended test levels:

- pure unit tests for `computeVesselTripUpdates`
- focused orchestrator tests for changed/unchanged partitioning
- persistence bundle tests for merged arrays

## 5. Likely files to change

- [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)
- [`convex/functions/vesselOrchestrator/mutations.ts`](../../convex/functions/vesselOrchestrator/mutations.ts)
- [`convex/functions/vesselOrchestrator/schemas.ts`](../../convex/functions/vesselOrchestrator/schemas.ts)
- [`convex/functions/vesselOrchestrator/persistVesselTripWriteSet.ts`](../../convex/functions/vesselOrchestrator/persistVesselTripWriteSet.ts)
- `convex/domain/vesselOrchestration/updateVesselTrips/*`
- `convex/domain/vesselOrchestration/updateVesselPredictions/*`
- `convex/domain/vesselOrchestration/updateTimeline/*`

New files are expected if they improve stage clarity.

## 6. Suggested working order for the next agent

1. Read the memo first.
2. Confirm the current baseline still matches the memo.
3. Land Task 1 and Task 2 without changing orchestrator behavior.
4. Land Task 3 as a structural refactor.
5. Land Task 4 as the deliberate behavior change.
6. Only then adjust persistence bundling and naming if needed.

## 7. Definition of done for the whole PRD

The PRD is complete when:

- the orchestrator is organized around per-vessel stage outputs
- a clear `computeVesselTripUpdates`-style unit exists
- unchanged vessels stop after trip computation
- prediction/timeline work only runs for vessels with trip updates
- Convex I/O remains shared and batched
- tests cover unchanged, changed, completed, and mixed-vessel pings

## 8. Notes for the next agent

- Resist the temptation to fold this into another generic “materially changed
  vessels” batch heuristic.
- Keep the reasoning anchored on one vessel at a time.
- Preserve the current schedule snapshot and single write mutation unless a
  concrete bug forces otherwise.
- If terminology cleanup becomes attractive, treat it as a separate small slice
  after the pipeline refactor is stable.
