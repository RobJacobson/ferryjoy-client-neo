# Quality Review Memo: Convex Functions/Domain Boundary Reorg

Date reviewed: 2026-04-14

## Verdict

The refactor is largely complete and the core runtime paths look sound.

- `convex/functions/scheduledTrips/sync/transform/` is gone and the moved
  schedule logic now lives under `convex/domain/scheduledTrips/`.
- `convex/domain/vesselTrips/` owns the lifecycle pipeline and
  `convex/functions/vesselTrips/updates/` is now mostly wrapper/adaptor code.
- `convex/domain/vesselTrips/continuity/` owns docked continuity and the
  functions layer keeps thin `ctx.runQuery` adapters.
- `convex/domain/vesselOrchestration/` owns the tick pipeline and
  `convex/functions/vesselOrchestrator/actions.ts` is mostly fetch/load/convert
  plus adapter wiring.

I did not find evidence of a half-migrated main runtime path. The remaining
issues are mostly one real boundary leak, one observability bug, and several
documentation/test-inventory mismatches.

## Findings

### Low: the moved `scheduledTrips` logic is structurally correct but lightly tested

- Files:
  `convex/domain/scheduledTrips/calculateTripEstimates.ts`,
  `convex/domain/scheduledTrips/runScheduleTransformPipeline.ts`,
  `convex/domain/scheduledTrips/tests/classifyDirectSegments.test.ts`
- The moved module exists in the right place, but only direct-segment
  classification has dedicated domain tests.
- I did not find direct coverage for estimate/linking behavior such as
  `PrevKey`, `NextKey`, `EstArriveCurr`, indirect completion backfill, or the
  end-to-end transform pipeline.
- This is a coverage gap, not proof of an active bug. Still, it is the least
  protected part of the moved business logic.

### Low: a small type-only boundary leak remains in timeline reseed

- Files:
  `convex/domain/timelineReseed/seedScheduledEvents.ts`,
  `convex/domain/timelineReseed/hydrateWithHistory.ts`
- These modules import `TerminalIdentity` from
  `convex/functions/terminals/resolver.ts`.
- This is only a type import, so it is much less serious than the ML helper
  import above, but it still means the final boundary is not completely clean.

## Simplification Opportunities

- Split the trip branch in
  `convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts` so lifecycle
  failure and timeline-write failure are labeled separately. That would both fix
  the misleading log and make the code easier to reason about.
- Move `TerminalIdentity` to a shared type module if timeline reseed is meant to
  stay domain-owned without any functions-layer import.
- Deduplicate the local `toError` helper now defined in both
  `convex/functions/vesselOrchestrator/actions.ts` and
  `convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts`.
- Simplify `convex/domain/scheduledTrips/calculateTripEstimates.ts`. It works,
  but it uses repeated forward scans (`slice(...).flatMap(...).find(...)`) and
  repeated key lookups that could be replaced with precomputed maps or a reverse
  scan. The current logic is understandable, but more stateful and expensive than
  it needs to be.


## Overall Assessment

The backend reorganization achieved its main goal: the substantive trip,
schedule, and orchestrator logic is now predominantly in `convex/domain/`, and
the functions layer is much thinner.

The remaining cleanup should focus on:

- fixing the orchestrator's failure attribution for timeline-write errors,
- removing the last real domain-to-functions helper dependency,
- correcting live documentation that still points at removed paths or nonexistent
  tests/files,
- and adding a small amount of test coverage around scheduled-trip estimate and
  linking behavior.
