# Vessel Orchestrator Per-Vessel Pipeline Memo

**Date:** 2026-04-21  
**Audience:** Engineers and coding agents working in `convex/functions/vesselOrchestrator`, `convex/domain/vesselOrchestration`, `convex/functions/vesselTrips`, `convex/functions/events`, and adjacent modules.

## 1. Purpose

Describe the current post-revert baseline for Vessel Orchestrator and define the
next deliberate refactor target:

- keep the schedule snapshot optimization
- keep the single orchestrator-owned persistence mutation
- reshape the in-memory compute flow around **per-vessel stage outputs**
- add a clean off-ramp after trip computation

This memo is intentionally focused on the current Convex implementation. It is
not a platform comparison and it is not a historical narrative of all previous
experiments.

## 2. Executive summary

The current orchestrator is already in a better place than the earlier
high-bandwidth refactor:

- `getScheduleSnapshotForPing` now reads a compact materialized schedule
  snapshot instead of grouped raw `eventsScheduled` rows
- the hot write path is already collapsed into one internal mutation:
  `persistOrchestratorPing`
- the reverted Stage 3 experiment is gone, so predictions and timeline still
  run on the current every-ping contract

The next improvement should **not** be another batch-level heuristic layered on
top of the current shape.

Instead, the orchestrator should move toward a more legible pipeline:

1. load shared state once
2. compute per-vessel location outputs
3. compute per-vessel trip updates
4. stop immediately for vessels with no trip updates
5. run prediction/timeline work only for vessels that survived that off-ramp
6. merge all outputs and persist once

This keeps batched Convex I/O while making the in-memory logic easier to
understand, debug, and test.

## 3. Current baseline

## 3.1 What stays in place

The current baseline after reverting the Stage 3 gating experiment is:

- one action:
  [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)
- one orchestrator schedule read query:
  [`convex/functions/vesselOrchestrator/queries.ts`](../../convex/functions/vesselOrchestrator/queries.ts)
- one orchestrator persistence mutation:
  [`convex/functions/vesselOrchestrator/mutations.ts`](../../convex/functions/vesselOrchestrator/mutations.ts)

Important retained improvements:

- `vesselOrchestratorScheduleSnapshots` remains the schedule source for the hot
  path
- `persistOrchestratorPing` remains the single functions-owned write boundary
- predictions still run on the current “every ping” contract

## 3.2 Current action shape

Today the action is still organized as one batch pipeline:

1. load orchestrator snapshot
2. fetch/normalize vessel locations
3. compute all trip rows for the ping
4. compute all prediction rows for the ping
5. persist the entire write bundle

That shape works, but it has two drawbacks:

- it is harder to reason about one vessel end-to-end
- the natural off-ramp after trip computation is obscured by batch-level DTOs

## 3.3 Current behavioral contract

The current contract should be treated as the baseline to preserve until the new
per-vessel design is explicitly landed:

- predictions run every ping for eligible trips
- timeline assembly runs every ping from the same-ping trip + prediction
  handoffs
- no vessel-level Stage 2 off-ramp currently exists

This matters because the reverted Stage 3 experiment changed that contract too
early.

## 4. Design goal

The desired refactor is **not** “make the orchestrator event-driven again.”

The desired refactor is:

- **shared Convex reads**
- **per-vessel pure computation**
- **shared Convex writes**

In other words:

- do not spin up per-vessel Convex functions
- do not fall back to lots of child `runQuery`/`runMutation` calls
- do express the in-memory orchestration as a sequence of per-vessel transforms

## 5. Target pipeline

## 5.1 High-level shape

The target shape is a two-phase per-vessel pipeline:

### Phase A: location + trip updates for all vessels

1. load orchestrator snapshot
2. fetch and normalize vessel locations
3. map each vessel location into `computeVesselTripUpdates`
4. partition outputs into:
   - vessels with trip updates
   - vessels with no trip updates

### Phase B: prediction + timeline only for changed vessels

5. preload prediction context for the changed-vessel subset
6. map changed vessels into prediction updates
7. map changed vessels into timeline updates
8. merge all stage outputs into one write bundle
9. persist once through `persistOrchestratorPing`

## 5.2 Why not one literal end-to-end map?

The only reason not to run a single `location -> trip -> prediction -> timeline`
map is that prediction context is shared state. The changed-vessel subset should
be known before model rows are loaded.

So the clean practical shape is:

- `map` Stage 1
- `map` Stage 2
- `filter` / `partition`
- shared preload for changed vessels
- `map` Stage 3
- `map` Stage 4
- merge and persist

That is still a per-vessel pipeline in the place that matters: the pure compute
layer.

## 6. Proposed stage names

Avoid numbered stage language in the implementation where possible. Prefer
single-vessel names:

- `computeVesselLocationUpdates`
- `computeVesselTripUpdates`
- `computeVesselPredictionUpdates`
- `computeVesselTimelineUpdates`

The most important rename is the current “Stage 2” concept:

- **`computeVesselTripUpdates`**

That name correctly suggests:

- one vessel at a time
- multiple possible outputs
- both completed and replacement trips are possible
- the result is a change bundle, not just one row

## 7. Stage 2 off-ramp

## 7.1 Intended rule

The off-ramp after `computeVesselTripUpdates` should be:

> Continue only if we would write a different `activeVesselTrips` row, or emit a
> completed/replacement handoff.

This is the current best working definition of “trip updates.”

## 7.2 Why this is the right first gate

This rule is:

- concrete
- explainable
- easy to test
- closely tied to persisted behavior

It avoids a fuzzier question like “did anything material happen?” while still
capturing the real downstream cases that matter.

## 7.3 Practical interpretation

For one vessel after trip computation:

- if the storage-shaped active trip row is unchanged
- and there is no completed/replacement transition
- then prediction and timeline work should stop for that vessel

Otherwise that vessel continues.

## 8. Important constraints

The next refactor should preserve these constraints:

- one shared orchestrator query for baseline state
- one shared schedule snapshot query
- one shared orchestrator persistence mutation
- no per-vessel Convex function fan-out
- no rollback of the schedule snapshot optimization
- no silent change to the current prediction contract until the off-ramp is
  explicitly introduced as part of the new design

## 9. Expected benefits

If the pipeline is reshaped this way, the expected wins are:

- simpler reasoning about one vessel through all stages
- easier debugging for specific vessels
- clearer stage contracts and output types
- a much cleaner place to short-circuit prediction/timeline work
- lower function calls and bandwidth for the common “unchanged trip” case

The biggest practical win is likely that trip updates are much rarer than the
5-second orchestration cadence, so many vessels should stop after
`computeVesselTripUpdates`.

## 10. Non-goals for this slice

The next refactor should **not** try to do all of the following at once:

- reintroduce the old event-driven architecture wholesale
- revisit alternative platforms or hosting models
- redesign schedule persistence again
- rewrite every DTO name in one pass
- change frontend/public query contracts

Keep the scope on the orchestrator compute flow and the Stage 2 off-ramp.

## 11. Suggested implementation posture

Land this in deliberate slices:

1. introduce the new per-vessel output types and helpers
2. reshape the action around per-vessel stage transforms without changing
   behavior yet
3. once parity is stable, add the Stage 2 off-ramp
4. only then consider naming cleanups for handshake objects like
   `completedFacts`

This ordering reduces the chance of mixing structural refactor, behavioral
policy, and terminology cleanup in one risky patch.

## 12. References

### Internal code

- [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)
- [`convex/functions/vesselOrchestrator/mutations.ts`](../../convex/functions/vesselOrchestrator/mutations.ts)
- [`convex/functions/vesselOrchestrator/queries.ts`](../../convex/functions/vesselOrchestrator/queries.ts)
- [`convex/functions/vesselOrchestrator/persistVesselTripWriteSet.ts`](../../convex/functions/vesselOrchestrator/persistVesselTripWriteSet.ts)
- [`convex/functions/vesselOrchestrator/materializeScheduleSnapshot.ts`](../../convex/functions/vesselOrchestrator/materializeScheduleSnapshot.ts)
- [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md)

### Internal guidance

- [`docs/convex-mcp-cheat-sheet.md`](../convex-mcp-cheat-sheet.md)
- [`docs/convex_rules.mdc`](../convex_rules.mdc)

### Convex docs

- [Functions](https://docs.convex.dev/functions)
- [Actions](https://docs.convex.dev/functions/actions)
- [Database](https://docs.convex.dev/database)
- [Reading Data](https://docs.convex.dev/database/reading-data)
- [Realtime](https://docs.convex.dev/realtime)
- [Limits](https://docs.convex.dev/production/state/limits)
