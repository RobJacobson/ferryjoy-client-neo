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
| 5 | scheduled reload row construction | 0 | see handoff | unchanged | 0 | see handoff | unchanged | Not run; plan-only blocker report. | Blocked/deferred by worker. Keeping scheduled plus actual reload construction would be roughly 170-230 LoC or a helper module, crossing the Stage 5 gate. Recommendation is to move static reload construction decision to later sync reduction stages. | Pending owner decision |

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
