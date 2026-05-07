# Events Old-Code-First Stage Log

Running log for
`docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`.

Update this file after each stage with raw LoC, verification, review result, and
commit status. Keep detailed reasoning in the stage handoff; this log is the
compact audit trail.

| Stage | Scope | Prod LoC old | Prod LoC before | Prod LoC after | Test LoC old | Test LoC before | Test LoC after | Verification | Review result | Commit |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| 1 | `eventsScheduled/schemas.ts` | 26 | 28 | 28 | 0 | 0 | 0 | `bun test convex/functions/events/eventsScheduled/tests/listScheduledDockEventsForVesselSailingDay.test.ts convex/functions/events/eventsScheduled/tests/upsertScheduledRowsForSailingDay.test.ts` passed, 8 tests | Approved by orchestrator; owner approval pending. Kept `DockEventType` only for current barrel compatibility. | Pending |

## Notes

- Stage 1 remains two raw lines longer than old code because it preserves the
  current `DockEventType` type export. Revisit during Stage 20 barrel/export
  surface cleanup if no live caller appears.
