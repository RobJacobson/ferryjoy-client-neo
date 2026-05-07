# Events Old-Code-First Stage 6 Actual Schemas Handoff

## Stage Scope

Review `convex/functions/events/eventsActual/schemas.ts` against the old
`eventsActual` schema and decide whether any schema delta is still required.

Default editable files:

- `convex/functions/events/eventsActual/schemas.ts`
- this handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

The worker may inspect callers, reload code, and tests, but should not edit
mutations, queries, reload helpers, or generated files unless the schema cannot
be safely simplified without a tiny import/type adjustment. If that happens,
stop and report the exact blocker before expanding scope.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/functions/events/eventsActual/schemas.ts`
- current `convex/functions/events/eventsActual/schemas.ts`
- current `convex/functions/events/eventsActual/mutations.ts`
- current `convex/domain/events/reload.ts`

Old schema shape:

- imported `dockEventTypeSchema` from `../eventsScheduled/schemas`
- defined a `persistedActualDockFields` object
- included optional `ScheduleKey`
- exported `eventsActualSchema` and `ConvexActualDockEvent`
- raw LoC: 38

Current schema shape:

- imports `dockEventTypeSchema` from `../common/schemas`
- defines the validator inline
- does not include `ScheduleKey`
- exports `eventsActualSchema` and `ConvexActualDockEvent`
- raw LoC before Stage 6: 28

## Current-Code Delta Table

| Delta | Default decision | Reason |
| --- | --- | --- |
| `ScheduleKey` absent from current schema | Keep absent unless a live requirement proves otherwise | Stage 5 intentionally preserved physical-only rows through `preserveAbsentTripKeys` instead of re-adding schedule alignment to actual rows. Do not undo that without owner approval. |
| `dockEventTypeSchema` imported from `../common/schemas` | Keep | Current shared event type schema avoids coupling actual schemas back to scheduled schemas. |
| Inline validator fields instead of `persistedActualDockFields` spread | Keep if readable | Current file is already 10 raw lines smaller than old. Do not add an abstraction just to match old shape. |
| Module comment and type export | Keep | Style guide requires meaningful module documentation and the type is a live Convex boundary type. |

## LoC Report

| Area | Old LoC | Current LoC before stage | Target |
| --- | ---: | ---: | --- |
| `eventsActual/schemas.ts` | 38 | 28 | No churn expected unless a real semantic mismatch is found |

## Verification Run Or Blocker

Run focused actual tests if the schema changes:

```sh
bun test convex/domain/events/tests/actual.test.ts convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts
```

If no code changes are made, verification may be a blocker-free review report
plus raw LoC confirmation.

## Recommendation

This is likely a no-change stage. The current schema is already smaller than
old code and Stage 5 supplied the missing physical-only replacement semantics
without `ScheduleKey`. Accept a no-op result if the worker confirms no live
caller, test, or product requirement needs `ScheduleKey` on `eventsActual`.

## Worker Result

The Stage 6 worker recommended no schema changes.

Evidence:

- old schema was 38 raw LoC and included optional `ScheduleKey`
- current schema is 28 raw LoC and omits `ScheduleKey`
- Stage 5 preserves physical-only actual rows through `preserveAbsentTripKeys`
  derived from physical-only trip context
- current actual schema callers do not require persisted actual-row
  `ScheduleKey`

Verification:

No tests were run because no code changed. Orchestrator reviewed schema callers,
actual mutations, actual queries, and reload references.

Recommendation:

Approve Stage 6 as a no-op and commit only this handoff plus the stage-log
entry if the owner wants the no-op audit trail recorded in git.
