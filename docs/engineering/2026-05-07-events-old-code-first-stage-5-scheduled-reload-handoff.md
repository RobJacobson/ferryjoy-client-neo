# Events Old-Code-First Stage 5 Scheduled Reload Handoff

## Stage Scope

Resolve scheduled reload row construction after Stage 4 removed it from
`convex/domain/events/scheduled.ts`.

Stage 5 exists only if scheduled reload construction is still required. Do not
restore reload builders to the scheduled continuity module. Do not preserve
static reload code merely because current imports are broken.

Primary blockers from Stage 4:

- `convex/functions/events/sync/mutations.ts` imports removed
  `buildScheduledDockEventRecords` and `buildScheduledDockEvents`.
- `convex/domain/events/actual.ts` imports removed
  `buildScheduledDockEventRecords`, `DockBoundaryEventRecord`, and
  `EventReloadScheduleSegment`.

Default editable files:

- `convex/functions/events/sync/mutations.ts`
- `convex/domain/events/actual.ts`, only for removing or isolating scheduled
  reload coupling needed by this stage
- focused reload tests that defend the kept behavior
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- this handoff note

Do not edit generated files. Do not broaden into sync actions/window structure;
that belongs to later sync stages unless a tiny import fix is required.

## Hard Acceptance Bar

Old scoped event code had no sync tree and old `domain/events/scheduled.ts` had
only 37 LoC of type contracts. Current scheduled reload construction must be
justified as an explicit current requirement.

This stage is approved only if one of these is true:

1. scheduled reload construction is deleted/deferred with exact blockers and no
   claim that the current static reload path is acceptable; or
2. the worker keeps a smallest readable scheduled reload construction path,
   located outside `domain/events/scheduled.ts`, with a serious justification
   for every helper and test retained.

A tiny import shuffle or re-export that keeps the old 500-line helper shape
alive elsewhere is rejected.

## Old-Code Trace Summary

`events-old-reference` has:

- no `convex/functions/events/sync` tree
- no scheduled reload row-construction helper flow in
  `convex/domain/events/scheduled.ts`
- old `convex/domain/events/actual.ts` is type contracts only

Therefore, all static scheduled reload behavior is current-only and must be
justified by live callers, product requirement, or focused correctness need.

## Required Pre-Edit Plan

Before implementation, produce a plan if the proposed kept reload code will be
more than roughly 120 raw LoC or requires creating/moving a helper module.

The plan must list:

- exact scheduled reload entrypoints to keep or delete
- whether `replaceScheduledDockEventsForSailingDayRows` remains
- whether actual reload still needs schedule boundary hydration in Stage 5, or
  should be deferred to Stage 10/17/19
- projected LoC for kept production and tests
- exact tests to keep/delete/rewrite
- known typecheck blockers after the stage

## Current-Code Delta Table

| Current addition beyond old code | Keep/delete/defer | Reason |
| --- | --- | --- |
| `replaceScheduledDockEventsForSailingDayRows` | Review | Current sync mutation uses it; keep only if scheduled static reload is still required before sync reduction. |
| `buildScheduledDockEventRecords` | Review | Removed from scheduled domain by Stage 4; if kept, implementation must live in the smallest Stage 5-owned location. |
| `buildScheduledDockEvents` | Review | Builds persisted scheduled rows for reload; keep only if `upsertScheduledRowsForSailingDay` still needs reload rows. |
| Actual reload schedule hydration in `domain/events/actual.ts` | Defer unless necessary | This may belong to actual static reload or later sync stages, not scheduled reload row construction. |
| Raw seed, seam normalization, official arrival fallback | Review skeptically | Keep only if required by focused reload behavior, not because current code had it. |
| Reload tests | Rewrite/delete | Keep only behavior tests for the retained Stage 5 path; delete tests defending deleted structure. |

## LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| Scheduled reload construction | 0 | TBD | TBD |
| `convex/functions/events/sync/mutations.ts` | 0 | 136 | TBD |
| `convex/domain/events/actual.ts` reload coupling | 0 | 615 | TBD |
| Focused reload tests touched | 0 | TBD | TBD |

Use raw line counts. If keeping code much larger than old zero-LoC baseline,
explain exactly what the code buys and why the maintenance cost is worth it.

## Verification Run Or Blocker

Run the focused tests for whichever reload path remains. Likely candidates:

```sh
bun test convex/functions/events/sync/tests/reloadMutations.test.ts
bun test convex/domain/events/tests/actual.test.ts
```

Do not run broad typecheck if later-stage sync/actual blockers are expected;
report those blockers exactly.

## Recommendation

Prefer the smallest fix that resolves the Stage 4 blockers without rebuilding a
large scheduled reload architecture. If scheduled reload construction cannot be
kept small in Stage 5, stop with a blocker report and recommend moving the work
to the later sync stages rather than preserving current reload code by default.

## Worker Blocker Report

The Stage 5 worker produced a plan-only blocker report and made no code edits.

Finding:

- scheduled reload construction is not safely implementable inside the Stage 5
  gate as a tiny fix
- the only current live reason to keep it is the cron/operator sync path through
  `reloadDockEventsAtSailingDayBoundary` to `runReloadDockEventsForSailingDay`
- old scoped event code had no sync tree and no scheduled reload helper flow
- preserving meaningful non-empty reload behavior would either recreate much of
  the removed scheduled builder or introduce/move a helper module

LoC projection:

| Area | Old LoC | Current / projected LoC |
| --- | ---: | ---: |
| scheduled reload construction baseline | 0 | 0 |
| pre-Stage-4 scheduled helper shape | 0 | 500 |
| `convex/functions/events/sync/mutations.ts` current | 0 | 136 |
| `convex/domain/events/actual.ts` current | 0 | 615 |
| small scheduled-only mapper | 0 | 90-115 projected |
| scheduled plus actual reload boundary hydration | 0 | 170-230 projected |

Blockers left:

- `convex/functions/events/sync/mutations.ts` imports removed scheduled builders
- `convex/domain/events/actual.ts` imports removed scheduled builder/types
- focused reload tests only cover empty payloads, so they do not justify
  retaining non-empty reload construction by themselves

Recommendation:

Treat Stage 5 as blocked/deferred. Move scheduled and actual static reload
construction into the later sync reduction stage, where the owner can decide
whether to keep the cron static reload path at all.
