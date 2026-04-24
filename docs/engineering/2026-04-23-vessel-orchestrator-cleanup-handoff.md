# Vessel Orchestrator Cleanup Handoff

**Date:** 2026-04-23  
**Primary docs:**
- [2026-04-23-vessel-orchestrator-cleanup-prd.md](./2026-04-23-vessel-orchestrator-cleanup-prd.md)
- [2026-04-23-vessel-orchestrator-cleanup-implementation-overview.md](./2026-04-23-vessel-orchestrator-cleanup-implementation-overview.md)

## What Changed In This Stage

The orchestrator hot path was updated toward the cleanup target:

- `getOrchestratorModelData` now includes current `vesselLocations`
- location dedupe compares directly against stored `vesselLocations`
- `actions.ts` now has a visible changed-vessel loop
- schedule continuity now uses cached targeted `eventsScheduled` lookups
- predictions only load/run for materially changed trips
- persistence still runs through one orchestrator-owned mutation
- `vesselLocationsUpdates` and `vesselOrchestratorScheduleSnapshots` were removed from code and schema

The latest cleanup pass also tightened the local code shape:

- the prediction stage now returns the flat persistence-native
  `predictionRows` / `predictedTripComputations` payload directly
- stale per-vessel prediction/timeline wrapper DTOs were removed
- `actions.ts` now passes precomputed `changedLocations` into the final bundle
  instead of re-filtering full location updates
- a small remaining `Pick<...>` usage in the touched orchestrator path was
  replaced with an explicit local type
- the extra `runTripStage` wrapper was removed so the changed-vessel trip path
  is more direct in `actions.ts`
- prediction inputs now derive directly from changed `VesselTripUpdate` rows
  instead of re-filtering full `tripRows`
- a few remaining utility/indexed-access aliases in the touched path were
  replaced with explicit local types
- `pipelineTypes.ts` was removed and `VesselLocationUpdates` now lives directly
  in `schemas.ts`
- shared location normalize/dedupe work moved out of `actions.ts` into
  `convex/functions/vesselOrchestrator/locationUpdates.ts`
- the snapshot-only `computeTripBatchForPing` compatibility helper moved out of
  `actions.ts` into `convex/functions/vesselOrchestrator/testing.ts`
- prediction-stage orchestration moved out of `actions.ts` into
  `convex/functions/vesselOrchestrator/predictionStage.ts`
- targeted schedule lookup/caching moved out of `actions.ts` into
  `convex/functions/vesselOrchestrator/scheduleContinuityAccess.ts`
- `actions.ts` now reads more like orchestration again, with helper modules
  carrying prediction and continuity details
- the changed-location persistence handoff no longer re-filters rows that are
  already known to be changed

I also fixed one follow-up issue during review:

- [`convex/functions/vesselOrchestrator/queries.ts`](../../convex/functions/vesselOrchestrator/queries.ts)
  now strips `_creationTime` from `storedLocations` while preserving `_id`, so
  the query result matches `storedVesselLocationSchema`

## What I Verified

- `bun run convex:typecheck`
- `bun test convex/functions/vesselOrchestrator/tests/updateVesselLocations.test.ts`
- `bun test convex/functions/vesselOrchestrator/tests/persistenceBundle.test.ts convex/functions/vesselOrchestrator/tests/tripStagePolicy.test.ts convex/functions/vesselOrchestrator/tests/predictionStagePolicy.test.ts`

All passed after the follow-up cleanup.

The latest focused verification also passed:

- `bun test convex/functions/vesselOrchestrator/tests/predictionStagePolicy.test.ts convex/functions/vesselOrchestrator/tests/persistenceBundle.test.ts convex/functions/vesselOrchestrator/tests/tripStagePolicy.test.ts`
- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`

The latest extraction pass also passed:

- `bun test convex/functions/vesselOrchestrator/tests/predictionStagePolicy.test.ts convex/functions/vesselOrchestrator/tests/persistenceBundle.test.ts convex/functions/vesselOrchestrator/tests/tripStagePolicy.test.ts convex/functions/vesselOrchestrator/tests/updateVesselLocations.test.ts`
- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`

The targeted `eventsScheduled` query-boundary bug was also fixed:

- [`convex/functions/events/eventsScheduled/queries.ts`](../../convex/functions/events/eventsScheduled/queries.ts)
  now strips Convex metadata in both scheduled-event query paths before
  returning
- `getScheduledDepartureEventBySegmentKey` no longer returns raw documents with
  `_id` / `_creationTime` that violate `eventsScheduledSchema`
- `getScheduledDockEventsForSailingDay` now uses the same schema-clean return
  shape for consistency

## What The Next Agent Should Focus On

Focus on the current code, not the refactor history.

### 1. Review the new hot path carefully

Pay particular attention to:

- [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)
- [`convex/functions/vesselOrchestrator/queries.ts`](../../convex/functions/vesselOrchestrator/queries.ts)
- [`convex/functions/vesselOrchestrator/mutations.ts`](../../convex/functions/vesselOrchestrator/mutations.ts)
- [`convex/domain/vesselOrchestration/updateVesselTrips`](../../convex/domain/vesselOrchestration/updateVesselTrips)

### 2. Look for the next cleanup pass

Most likely areas:

- further simplification of `actions.ts`
- keeping shared non-orchestration helpers like location normalize/dedupe logic
  out of the runtime hot-path file when they can live in adjacent helper modules
- trimming leftover transitional DTOs and compatibility helpers
- removing any remaining unnecessary utility typing or indexed-access aliasing
  when a small explicit local type would be clearer
- keeping snapshot-only compatibility helpers out of production hot-path files
  when they can live in `testing.ts`
- keeping extracted runtime helpers like `predictionStage.ts` and
  `scheduleContinuityAccess.ts` small, obvious, and free of leftover
  `actions.ts`-shaped plumbing
- tightening or clarifying the schedule continuity access seam
- removing snapshot-era comments/docs that no longer describe reality
- expanding focused tests around the changed-vessel loop and targeted schedule lookups
- reviewing the changed-vessel prediction/timeline handoff for any remaining
  flatten-then-filter or filter-then-rebuild patterns

### 2a. Specific style preference: avoid `Pick` unless it is clearly needed

There is a preference to avoid `Pick<...>` in this area when it adds indirection
without buying much.

Preferred direction:

- replace small `Pick<...>` helper aliases with explicit local object types
- replace small indexed-access type aliases too if they obscure the local shape
- keep action-layer and persistence-layer shapes obvious at the point of use
- choose the simpler type spelling when both options are equivalent

`Pick` is still acceptable when it genuinely prevents duplication or is needed
to stay aligned with a shared contract, but it should not be the default.

### 3. Preserve these invariants

- one orchestrator snapshot query
- one WSF fetch
- one final orchestrator persistence mutation when writes are needed
- no broad same-day schedule snapshot read
- no `vesselLocationsUpdates` table
- predictions and timeline remain downstream of real trip changes

## Notes

- The docs-only planning artifacts added this stage are:
  - [2026-04-23-vessel-orchestrator-cleanup-prd.md](./2026-04-23-vessel-orchestrator-cleanup-prd.md)
  - [2026-04-23-vessel-orchestrator-cleanup-implementation-overview.md](./2026-04-23-vessel-orchestrator-cleanup-implementation-overview.md)
- Follow the project style and Convex rules in:
  - [.cursor/rules/code-style.mdc](../../.cursor/rules/code-style.mdc)
  - [docs/convex_rules.mdc](../convex_rules.mdc)

## Short Prompt For The Next Agent

Read the cleanup PRD and implementation overview first, then review the current
orchestrator code. Focus on simplifying the current hot path further without
reintroducing broad reads or per-vessel Convex fan-out. Prefer explicit local
types over `Pick<...>` or other utility typing when they add needless
complexity.
