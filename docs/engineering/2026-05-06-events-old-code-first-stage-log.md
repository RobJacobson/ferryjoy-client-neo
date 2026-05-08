# Events Old-Code-First Stage Log

Running log for
`docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`.

Update this file after each stage with raw LoC, verification, review result, and
commit status. Keep detailed reasoning in the stage handoff; this log is the
compact audit trail.

| Stage | Scope | Prod LoC old | Prod LoC before | Prod LoC after | Test LoC old | Test LoC before | Test LoC after | Verification | Review result | Commit |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| 1 | `eventsScheduled/schemas.ts` | 26 | 28 | 28 | 0 | 0 | 0 | `bun test convex/functions/events/eventsScheduled/tests/listScheduledDockEventsForVesselSailingDay.test.ts convex/functions/events/eventsScheduled/tests/upsertScheduledRowsForSailingDay.test.ts` passed, 8 tests | Approved by orchestrator. Kept `DockEventType` only for current barrel compatibility. | Committed `3c707c56` |
| 2 | `eventsScheduled/queries.ts` | 74 | 112 | 78 | 0 | 190 | 190 | `bun test convex/functions/events/eventsScheduled/tests/listScheduledDockEventsForVesselSailingDay.test.ts` passed, 4 tests | Approved by orchestrator. Kept public app query, direct reader import, and compact deterministic ordering; deleted old internal wrappers and verbose sort helper split. | Committed `1ff874c4` |
| 3 | `eventsScheduled/mutations.ts` | 81 | 84 | 86 | 0 | 262 | 262 | `bun test convex/functions/events/eventsScheduled/tests/upsertScheduledRowsForSailingDay.test.ts` passed, 4 tests | Revised after owner feedback. Entry was already tight, so documentation was preserved. Only code-shape change is restoring the old `scheduledRowsEqual` helper name while keeping strict optional comparison. | Committed `42a96a70` |
| 4 | `domain/events/scheduled.ts` | 37 | 500 | 139 | 0 | 121 | 107 | `bun test convex/domain/events/tests/scheduled.test.ts` passed, 2 tests | Implemented approved old-code-first continuity surface. Kept only old type contracts, `inferScheduledSegmentFromDepartureEvent`, `findNextDepartureEvent`, and private support helpers; deferred reload builders as Stage 5 blockers. | Committed `b154545d` |
| 5 | scheduled + actual reload reseed | 1,462 | 903 | 1,556 | 0 | 516 | 690 | `bun test convex/domain/events/tests/actual.test.ts convex/domain/events/tests/reload.test.ts convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts convex/functions/events/sync/tests/reloadMutations.test.ts` passed, 13 tests; `bun run type-check` passed; `bun run convex:typecheck` passed. | Implemented required old reseed behavior in flat `domain/events/reload.ts`, moved reload coupling out of `actual.ts`, and preserved physical-only actual rows through physical-only TripKey context because `eventsActual` no longer stores `ScheduleKey`. Requires owner approval for the 1,142-LoC helper exceeding the plan-first threshold, though total production LoC is close to the corrected old baseline. | Committed `0fcd5703` |
| 6 | `eventsActual/schemas.ts` | 38 | 28 | 28 | 0 | 0 | 0 | Not run; no code changed. Orchestrator reviewed schema callers and confirmed no persisted actual-row caller requires `ScheduleKey`. | No-op recommended. Current schema is already smaller than old, keeps shared `common` event type import, and leaves physical-only preservation in Stage 5 TripKey context instead of re-adding `ScheduleKey`. | Committed `305f8eb9` |
| 7 | `eventsActual/queries.ts` | 25 | 75 | 55 | 0 | 207 | 154 | `bun test convex/functions/events/eventsActual/tests/listActualDockEventsForVesselSailingDay.test.ts` passed, 4 tests | Inlined the local-only reader into the public query and reduced focused test harness boilerplate. Kept the live app query, metadata stripping, and deterministic ordering. | Committed `4b3eac57` |
| 8 | `eventsActual/mutations.ts` | 138 | 147 | 147 | 0 | 366 | 366 | Not run; no code or test files changed. | No-op recommended. Current production file is roughly old-sized, no live caller needs the old `projectActualDockWrites` wrapper, and the remaining delta preserves Stage 5 `preserveAbsentTripKeys` replacement semantics without re-adding `ScheduleKey`. | Pending orchestrator review |
| 9 | `domain/events/actual.ts` | 108 | 87 | 78 | 0 | 186 | 201 | `bun test convex/domain/vesselOrchestration/updateEvents/tests convex/domain/events/tests/actual.test.ts convex/functions/events/eventsActual/tests` passed, 26 tests; `bun run check:fix`, `bun run type-check`, `bun run convex:typecheck` passed. | Approved by orchestrator. Inlined anchor resolution; aligned row `ScheduledDeparture` with old three-part expression; added runtime-guard test. See Stage 9 handoff. | Committed `fc3739eb` |
| 10 | actual static reload (`domain/events/reload.ts` + sync actual path) | 1,232 | 1,142 | 1,142 | 0 | 229 | 229 | Not run; plan-only blocker report. | **Blocker reported** (Acceptance Criteria #1). Within Stage 10 scope, current `reload.ts` is ~7% smaller than the comparable old `vesselTimeline` / `timelineReseed` reseed slice (1,142 vs 1,232 raw LoC). Real reduction levers — numeric payload collapse, hydration back to action layer, deletion of scheduled-only reload entrypoint, unification of scheduled/actual builders — are all out of Stage 10 scope and belong to Stages 17-19. Recorded an in-scope but deferred observation: `buildReloadDockEventRows` returns `scheduledRows` that the actual path never consumes. | Pending owner approval |
| 11 | `eventsPredicted/schemas.ts` | 64 | 62 | 62 | 0 | 0 | 0 | Not run; no code changed. | Approved by orchestrator. Current schema preserves the old validator/type surface, keeps live write-batch and prediction-source contracts, and is already two raw lines smaller than old. | Pending owner approval |

## Notes


- Stage 1 remains two raw lines longer than old code because it preserves the
  current `DockEventType` type export. Revisit during Stage 20 barrel/export
  surface cleanup if no live caller appears.
- Stage 2 remains four raw lines longer than old code because current live
  callers require a public app query plus an exported reader, and focused tests
  require stable scheduled timeline ordering.
- Stage 3 is not a size-reduction win. The scheduled mutation was already close
  to old-code directness; keeping useful persistence documentation is more
  valuable here than shaving comments. Larger reductions should come from sync
  and domain paths.
- Stage 4 intentionally leaves reload import blockers in
  `convex/functions/events/sync/mutations.ts` and `convex/domain/events/actual.ts`.
  Stage 5 should address those instead of restoring reload construction to the
  scheduled continuity module.
- Stage 5 exceeds the handoff's plan-first threshold because the corrected old
  `vesselTimeline` / `timelineReseed` baseline is a full reseed system, not
  zero-LoC scoped event code. Review should explicitly approve or reject the
  size tradeoff before commit.
- Stage 6 is intentionally no-op unless a future caller proves `ScheduleKey`
  belongs back on persisted `eventsActual` rows.
- Stage 7 remains larger than old code because the old baseline had no public
  app query wrapper, return validator, metadata stripping, or deterministic
  app-facing sort.
- Stage 8 is intentionally no-op. The production file is only 9 raw lines over
  old while carrying current direct helper exports and the approved Stage 5
  physical-only preservation mechanism.
- Stage 9 production `actual.ts` is below the old split baseline (108 lines
  combined on `events-old-reference`) because contracts and normalization live in
  one file, anchor resolution is inlined, and `ScheduleKey` stays off persisted
  rows per Stage 6. Test LoC rose due to the runtime-guard case.
- Stage 10 returned a plan-only blocker report. The current
  `convex/domain/events/reload.ts` (1,142 LoC) is already ~7% smaller than the
  comparable old static reseed slice (1,232 LoC summed across
  `seedScheduledEvents.ts`, `hydrateWithHistory.ts`, `buildReseedTimelineSlice.ts`,
  `normalizeEventRecords.ts`, `reconcileLiveLocations.ts`,
  `scheduleDepartureLookup.ts`, `mergeActualDockWritesIntoRows.ts`). Meaningful
  further reduction requires Stages 17-19 sync/reload architecture work
  (numeric reload payload collapse, action-layer hydration, scheduled-only
  entrypoint deletion, scheduled/actual builder unification). Marginal helper
  inlining within scope (~30-50 LoC) is rejected per PRD as a tiny reduction
  to a still-overgrown shape.
- Deferred Stage 10 observation for Stages 17-19: `buildReloadDockEventRows`
  builds and returns `scheduledRows`/`scheduledCount` (via
  `buildScheduledDockEvents` plus `lastArrivalKey` computation) that the only
  production caller (`reloadActualDockEventsForSailingDayRows`) does not
  consume. Removing this work cleanly couples to the scheduled reload
  entrypoint and so belongs to the same later sync/reload reduction.
- Stage 11 is intentionally no-op. The current predicted schema file preserves
  the old schema validators and inferred type surface while keeping live current
  callers for table schema wiring, predicted queries and mutations,
  vessel-orchestration persistence, vessel-trip prediction merging, and app
  timeline types.
