# Events Old-Code-First Stage 8 Actual Mutations Handoff

## Stage Scope

Review and reduce `convex/functions/events/eventsActual/mutations.ts`, focused
on `upsertActualDockRows`, without breaking the Stage 5 static reload
replacement path.

Default editable files:

- `convex/functions/events/eventsActual/mutations.ts`
- `convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts`
- this handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

Do not edit schemas, actual domain reload code, sync mutations, orchestrator
mutations, generated files, or frontend callers unless a tiny type/import
adjustment is required. If broader changes look necessary, stop and report the
blocker first.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/functions/events/eventsActual/mutations.ts`
- current `convex/functions/events/eventsActual/mutations.ts`
- current `convex/functions/events/sync/mutations.ts`
- current `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`
- focused mutation tests

Old mutation shape:

- `projectActualDockWrites` internal mutation wrapper
- `upsertActualDockRows` helper
- `replaceActualRowsForSailingDay` helper
- imported shared `actualDockRowsEqual`
- preserved physical-only stale rows through optional row `ScheduleKey`
- raw LoC: 138

Current mutation shape:

- exports only helper functions, no internal mutation wrapper
- `upsertActualDockRows` is called directly by orchestrator persistence
- `replaceActualRowsForSailingDay` is called by Stage 5 sync reload
- dedupes by `EventKey`
- compares actual rows inline while ignoring Convex metadata and `UpdatedAt`
- preserves absent physical-only rows through `preserveAbsentTripKeys` because
  current `eventsActual` rows no longer store `ScheduleKey`
- raw LoC before Stage 8: 147
- focused test before Stage 8: 366

## Current-Code Delta Table

| Delta | Default decision | Reason |
| --- | --- | --- |
| Missing `projectActualDockWrites` wrapper | Keep missing unless a live caller requires it | Current orchestrator persistence imports `upsertActualDockRows` directly. Do not add wrappers for old-shape nostalgia. |
| Inline equality helper | Review | Old used shared `actualDockRowsEqual`; current inline compare may be okay if no shared helper remains or if importing it would reintroduce dead surface. |
| `replaceActualRowsForSailingDay` | Keep | Stage 5 static reload needs it. Do not delete or weaken physical-only preservation. |
| `preserveAbsentTripKeys` option | Keep unless a better no-schema-change equivalent exists | Current actual rows do not have `ScheduleKey`; this is the Stage 5-approved preservation mechanism. |
| Focused test file size | Reduce if possible | Keep behavior coverage for upsert, equality, `UpdatedAt` ignore, occurrence comparison, and reload replacement preservation. |

## Hard Acceptance Bar

This stage is not allowed to simplify by removing Stage 5 semantics. In
particular:

- unchanged rows must still be skipped
- `UpdatedAt` and Convex metadata must still be ignored in equality
- duplicate incoming rows must remain last-row-wins by `EventKey`
- `replaceActualRowsForSailingDay` must still delete stale schedule-aligned rows
  while preserving absent physical-only rows passed via `preserveAbsentTripKeys`

If the current file is already close to the old baseline, a small/no-code result
is acceptable. Do not churn useful documentation just to beat the old LoC.

## LoC Report

| Area | Old LoC | Current LoC before stage | Target |
| --- | ---: | ---: | --- |
| `eventsActual/mutations.ts` | 138 | 147 | Small reduction or justified no-op; current is only 9 lines over old while carrying current schema/reload deltas |
| focused mutation test | 0 | 366 | Keep behavior coverage; reduce harness duplication only if straightforward |

## Stage 8 Result

No code or test changes were made.

| Area | Old LoC | Before Stage 8 | After Stage 8 | Decision |
| --- | ---: | ---: | ---: | --- |
| `eventsActual/mutations.ts` | 138 | 147 | 147 | Keep current shape. The file is roughly old-sized and the 9-line delta is justified by current direct helper exports plus Stage 5 `preserveAbsentTripKeys` semantics. |
| focused mutation test | 0 | 366 | 366 | Keep current coverage. The harness is large, but straightforward reductions risk weakening coverage for dedupe, equality, `UpdatedAt` ignore, occurrence comparison, and physical-only preservation. |

Delta decisions:

- `projectActualDockWrites`: keep deleted. No live caller was found; current
  orchestrator persistence imports `upsertActualDockRows` directly.
- Inline equality: keep. No shared helper remains, and the local comparison is
  narrow to this table while preserving Convex metadata and `UpdatedAt` ignore
  semantics.
- `replaceActualRowsForSailingDay`: keep. Stage 5 sync reload calls it.
- `preserveAbsentTripKeys`: keep. Current `eventsActual` rows intentionally do
  not store `ScheduleKey`, so this is the approved physical-only preservation
  path.
- Focused tests: keep. The file is test-only and covers the current persistence
  contract that caused Stage 5 review risk.

## Verification Run Or Blocker

Run focused verification if code or tests change:

```sh
bun test convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts convex/functions/events/sync/tests/reloadMutations.test.ts
```

Run typecheck only if exported signatures change.

Stage 8 verification: not run. No production or test files changed.

## Recommendation

Approve Stage 8 as a no-code result. The production file is already close to the
old baseline, and the current deltas map to live caller and Stage 5 reload
requirements rather than avoidable architecture.
