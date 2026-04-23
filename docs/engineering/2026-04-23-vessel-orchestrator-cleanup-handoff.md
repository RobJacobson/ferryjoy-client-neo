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

I also fixed one follow-up issue during review:

- [`convex/functions/vesselOrchestrator/queries.ts`](../../convex/functions/vesselOrchestrator/queries.ts)
  now strips `_creationTime` from `storedLocations` while preserving `_id`, so
  the query result matches `storedVesselLocationSchema`

## What I Verified

- `bun run convex:typecheck`
- `bun test convex/functions/vesselOrchestrator/tests/updateVesselLocations.test.ts`

Both passed after the query-shape fix above.

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
- trimming leftover transitional DTOs and compatibility helpers
- tightening or clarifying the schedule continuity access seam
- removing snapshot-era comments/docs that no longer describe reality
- expanding focused tests around the changed-vessel loop and targeted schedule lookups

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
reintroducing broad reads or per-vessel Convex fan-out.
