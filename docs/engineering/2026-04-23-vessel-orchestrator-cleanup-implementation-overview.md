# Vessel Orchestrator Cleanup Implementation Overview

**Date:** 2026-04-23  
**Audience:** Engineers planning and sequencing cleanup in
`convex/functions/vesselOrchestrator`,
`convex/domain/vesselOrchestration`, `convex/functions/events`, and adjacent
modules.  
**Primary companion spec:**
[2026-04-23-vessel-orchestrator-cleanup-prd.md](./2026-04-23-vessel-orchestrator-cleanup-prd.md)

## Purpose

Provide a concrete plan of attack for cleaning up `vesselOrchestrator` and its
four primary concerns:

- `updateVesselLocations`
- `updateVesselTrips`
- `updateVesselPredictions`
- `updateVesselTimeline`

The main objective is to recover the old system's hot-path cost profile while
keeping the best parts of the newer architecture.

## Executive Summary

The cleanup should proceed in this order:

1. simplify `updateVesselLocations` first
2. remove unconditional schedule snapshot reads second
3. reshape `actions.ts` around a single visible per-vessel loop
4. tighten prediction/timeline gating around real trip changes only
5. delete obsolete tables and DTOs last

This sequence restores bandwidth and invocation efficiency early, while
reducing the risk of another large refactor that touches every moving part at
once.

The implementing agent does not need the historical story of the refactor.
They should focus on the current code, the target runtime shape, and the
required cleanup steps below.

## Planning Principles

### Keep

- one orchestrator-owned baseline snapshot query
- one WSF fetch per ping
- one orchestrator-owned persistence mutation
- a distinct `updateVesselTrips` compute boundary
- a distinct `updateVesselPredictions` compute boundary
- timeline projection from persisted trip facts plus prediction handoffs

### Change

- stop reading `vesselLocationsUpdates` on the hot path
- stop reading `vesselOrchestratorScheduleSnapshots` on the hot path
- stop rereading location dedupe state inside persistence
- stop running prediction and timeline work when no material trip change
- reduce DTO layering in `actions.ts`

### Avoid

- per-vessel `ctx.runMutation(...)`
- per-vessel broad snapshot queries
- another large "all at once" orchestrator rewrite
- preserving helper tables purely because they already exist

## Target Runtime Shape

The intended steady-state ping should look like this:

1. load orchestrator snapshot once
2. fetch WSF vessel locations once
3. compute normalized live locations once
4. compare against existing stored live locations
5. persist live-location changes once
6. for each changed vessel location:
   - compute trip update
   - if trip materially changed, compute prediction update
   - if trip materially changed, build timeline update inputs
7. persist once through the orchestrator mutation

Important nuance:

- the code may loop per vessel in memory
- the database should still stay mostly batch-oriented
- rare targeted schedule queries are acceptable for continuity lookups

## Recommended Implementation Sequence

## Phase 0: Establish Baseline And Constraints

Before code movement, the implementing agent should confirm:

- current hot-path reads in `actions.ts`
- current hot-path reads in location persistence
- current schedule reads in the trip path
- current prediction and timeline gating behavior

This is mainly a sanity pass to prevent accidental regressions while removing
the current broad reads.

### Deliverables

- short written note in the implementation summary describing the old vs new
  hot path
- no behavior changes required in this phase

## Phase 1: Simplify `updateVesselLocations`

This is the highest-priority cost reduction.

### Goal

Move location logic back toward the old successful pattern:

1. fetch latest WSF vessel data
2. load existing stored vessel locations once
3. upsert the normalized current rows

The query is needed only to support upsert and timestamp comparison. A separate
`vesselLocationsUpdates` helper table should not be needed.

### Main changes

- remove `vesselLocationsUpdates` from the orchestrator hot path
- remove the second dedupe read inside location persistence
- compare incoming locations directly against stored `vesselLocations`
- preserve "write only when timestamp changed" behavior if practical

### Likely file targets

- `convex/functions/vesselOrchestrator/actions.ts`
- `convex/functions/vesselOrchestrator/queries.ts`
- `convex/functions/vesselLocationsUpdates/mutations.ts`
- `convex/functions/vesselLocationsUpdates/queries.ts`
- `convex/functions/vesselLocationsUpdates/schemas.ts`
- `convex/schema.ts`

### Definition of done

- orchestrator no longer reads `vesselLocationsUpdates`
- location persistence no longer rereads `vesselLocationsUpdates`
- unchanged vessel locations do not trigger writes
- `vesselLocationsUpdates` is unused and ready for deletion

## Phase 2: Remove Daily Schedule Snapshot Reads

This is the second highest-priority cost reduction.

### Goal

Replace the unconditional same-day schedule snapshot read with narrow schedule
lookups only when a changed vessel actually needs continuity help.

### Main changes

- stop calling `getScheduleSnapshotForPing`
- stop depending on `vesselOrchestratorScheduleSnapshots`
- reuse or restore targeted `eventsScheduled` queries
- keep schedule access behind trip-field resolution helpers

### Likely file targets

- `convex/functions/vesselOrchestrator/queries.ts`
- `convex/functions/vesselOrchestrator/actions.ts`
- `convex/functions/vesselOrchestrator/materializeScheduleSnapshot.ts`
- `convex/functions/vesselOrchestrator/schemas.ts`
- `convex/functions/events/eventsScheduled/queries.ts`
- `convex/functions/events/eventsScheduled/mutations.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/*`
- `convex/domain/vesselOrchestration/shared/scheduleSnapshot/*`

### Definition of done

- orchestrator no longer loads a same-day schedule snapshot every ping
- targeted schedule lookups exist for:
  - direct segment lookup by key
  - same-vessel rollover lookup after previous departure
- trip-field resolution still supports:
  - explicit WSF fields
  - next-leg continuity from existing trip
  - rollover continuity
  - fallback reuse

## Phase 3: Simplify `actions.ts` Around A Visible Per-Vessel Loop

This is the readability pass.

### Goal

Make the top-level flow easy to reason about:

```text
updateVesselLocations
for each changed vessel
  updateVesselTrip
  if trip changed
    updateVesselPrediction
    buildVesselTimelineUpdate
persist once
```

### Main changes

- move away from stage-wide DTO plumbing where it obscures control flow
- keep per-vessel compute in the action layer
- keep persistence batched at the end
- preserve the single orchestrator mutation

### Likely file targets

- `convex/functions/vesselOrchestrator/actions.ts`
- `convex/functions/vesselOrchestrator/schemas.ts`
- `convex/functions/vesselOrchestrator/testing.ts`

### Definition of done

- `actions.ts` reads clearly from top to bottom
- the main control flow is visible without jumping through helper DTOs
- per-vessel helpers accept narrow inputs and return narrow outputs
- no per-vessel persistence calls were introduced

## Phase 4: Tighten Prediction And Timeline Gating

This is the functional simplification pass after the hot path is lean again.

### Goal

Make predictions and timeline work contingent on real trip changes only.

### Main changes

- skip prediction loading when no vessel has a material trip update
- skip timeline assembly when no vessel has a material trip update
- keep completed-trip handoffs flowing into predictions and timeline when they
  are real
- avoid rebuilding broad wrapper DTOs only to flatten them later

### Likely file targets

- `convex/functions/vesselOrchestrator/actions.ts`
- `convex/domain/vesselOrchestration/updateVesselPredictions/*`
- `convex/domain/vesselOrchestration/updateTimeline/*`
- `convex/functions/vesselOrchestrator/mutations.ts`

### Definition of done

- unchanged trips trigger no prediction query
- unchanged trips trigger no timeline projection work
- completed-trip and replacement-trip cases still flow correctly

## Phase 5: Delete Obsolete Tables, Helpers, And Docs

This is the cleanup and convergence pass.

### Goal

Remove now-dead infrastructure once the leaner path is in place.

### Candidates for removal

- `vesselLocationsUpdates`
- `vesselOrchestratorScheduleSnapshots`
- snapshot materialization helpers
- transitional pipeline DTOs that no longer express real boundaries

### Likely file targets

- `convex/schema.ts`
- `convex/functions/vesselLocationsUpdates/*`
- `convex/functions/vesselOrchestrator/materializeScheduleSnapshot.ts`
- docs that describe the removed hot-path model

### Definition of done

- schema no longer contains the removed tables
- no live code imports the removed helpers
- tests and docs reflect the new design

## Suggested PR Breakdown

To keep risk contained, I would split the work into roughly these PRs:

1. `updateVesselLocations` simplification and `vesselLocationsUpdates`
   deprecation
2. targeted schedule-query restoration and snapshot-table removal
3. `actions.ts` per-vessel loop simplification
4. prediction/timeline gating cleanup plus dead-code deletion

If the first two PRs become entangled, they can be combined, but the safer
default is to land them separately.

## Invariants To Preserve

- one WSF fetch per ping
- one orchestrator persistence mutation per ping when writes are needed
- no broad same-day schedule read on every ping
- no broad dedupe-table read on every ping
- trip updates remain the source of truth for downstream prediction/timeline
  work
- timeline projection still depends on persisted trip facts, not speculative
  writes

## Suggested Success Metrics

The implementing agent should report the new steady-state behavior in plain
language, ideally matching this shape:

- unchanged tick:
  - 1 baseline snapshot query
  - 1 WSF fetch
  - 0 schedule queries
  - 0 prediction model query
  - 0 persistence mutation
- changed location with no real trip change:
  - 1 baseline snapshot query
  - 1 WSF fetch
  - location persistence only
  - 0 prediction model query
  - 0 timeline projection writes
- schedule-sensitive changed trip:
  - targeted `eventsScheduled` lookups only for that vessel
  - prediction/timeline only for that vessel

## Risks And Mitigations

### Risk: accidentally reintroducing per-vessel Convex fan-out

Mitigation:

- keep the per-vessel loop in memory
- allow only rare targeted schedule reads
- persist once at the end

### Risk: timeline projection drifting from trip persistence

Mitigation:

- continue projecting timeline from persisted trip facts and prediction
  handoffs
- do not write timeline rows directly from speculative action-layer results

### Risk: deleting snapshot infrastructure before trip continuity is restored

Mitigation:

- land targeted schedule reads before deleting the snapshot table
- keep continuity tests green throughout

## Recommended Reading For The Implementing Agent

- [2026-04-23-vessel-orchestrator-cleanup-prd.md](./2026-04-23-vessel-orchestrator-cleanup-prd.md)
- current branch:
  - `convex/functions/vesselOrchestrator/actions.ts`
  - `convex/functions/vesselOrchestrator/mutations.ts`
  - `convex/functions/vesselOrchestrator/queries.ts`
- pre-refactor reference worktree:
  - `/private/tmp/ferryjoy-client-neo-pre-vessel-orchestration`

If the implementing agent opens the older memos at all, they should use them
only to clarify a specific current-code concern. They do not need the broader
"how we got here" narrative.

## Final Recommendation

Treat this cleanup as a focused recovery effort, not as a fresh architecture
exercise.

The best near-term outcome is:

- old hot-path discipline
- newer trip/prediction/timeline separation
- simpler orchestrator control flow

That is the lowest-risk path back to a system that is both cheaper and easier
to reason about.
