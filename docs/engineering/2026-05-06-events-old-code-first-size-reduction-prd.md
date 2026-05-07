# Events Old-Code-First Size Reduction PRD

## Purpose

Reduce the event-table implementation toward the size and directness of
`events-old-reference`, while preserving only current behavior that is backed by
live callers, product requirements, or clear correctness improvements.

This is not a cleanup pass over the current implementation. It is a
re-derivation pass from the old implementation and current requirements.

## Current Situation

The event-table reset removed the worst nested helper trees, but the resulting
implementation is still much larger than the old working code. The earlier
reset planning docs and handoff memos are deleted by this PRD because they
centered the wrong question: how to preserve current behavior while trimming the
overgrown implementation.

The new question is narrower and stricter:

For each entrypoint, what did the old code do, what does current product code
actually require, and what is the smallest readable implementation that meets
that requirement?

## Scope

Allowed paths:

- `convex/functions/events`
- `convex/domain/events`
- direct imports from those modules, only when required to keep callers working
- focused tests for the entrypoint being reduced

Out of scope:

- VesselOrchestrator architecture cleanup
- broad app refactors
- generated Convex files, except normal regeneration if a later implementation
  stage explicitly requires it
- use of `events-current-reference` as an architectural reference

## Required References

Implementation agents must read:

- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- this PRD

Reference branches:

- `events-old-reference`: implementation baseline and primary source.
- current branch: compatibility and live-caller check.

Do not use `events-current-reference` during implementation unless the owner
explicitly asks for archaeology. That branch was useful during the first reset;
it is now a temptation to preserve the wrong architecture.

## Core Rule

Each stage starts from the old code, not the current code.

For every entrypoint:

1. Inspect the old implementation in `events-old-reference`.
2. Trace the complete old flow from entrypoint to database read, write, or
   return value.
3. Inspect the current implementation and current live callers.
4. List every addition beyond the old flow.
5. Keep an addition only if it has a concrete current requirement.
6. Rewrite the path to the smallest readable implementation.
7. Delete or rewrite tests that mostly defend the larger current shape.

Concrete current requirements include:

- a live production caller needs the function or type
- a schema shape changed and callers require the new shape
- the code prevents a known bug
- a focused behavior test protects product behavior
- stricter typing materially prevents misuse
- separation of concerns makes this exact path shorter or clearer overall

Not acceptable rationales:

- looks more professional
- purer domain separation
- might be useful later
- easier to test because every branch became its own helper
- preserving compatibility with deleted generated paths
- keeping behavior only because the current implementation has it

## Required Stage Report

After every implementation stage, the worker must report:

1. Old LoC for the functionality being changed.
2. Current LoC before the stage.
3. Updated LoC after the stage.
4. Whether the updated code is substantially different from the old code.
5. If different, why the difference is necessary.
6. If substantially longer than old code, what the extra code buys and why that
   benefit is worth the maintenance cost.

Use raw line counts, not semantic line counts. Report production and test LoC
separately when tests are touched.

Suggested command shape:

```sh
wc -l path/to/files
git show events-old-reference:path/to/file | wc -l
```

Each stage must also include a small delta justification table:

```md
| Current addition beyond old code | Keep/delete | Reason |
| --- | --- | --- |
| Public list query wrapper | Keep | App subscription uses generated API path. |
| Separate planner helper | Delete | Old loop is clearer and no live caller needs the helper. |
```

## Success Metrics

Use raw LoC and file count.

Targets are intentionally aggressive:

- production code under `convex/functions/events` and `convex/domain/events`:
  aim for 1,500 to 2,000 raw LoC
- scoped file count: aim for 20 to 30 files including focused tests
- max domain shape: flat `convex/domain/events/{actual,predicted,scheduled}.ts`
  only if each file is justified by live callers
- no nested `convex/domain/events/*/*` folders
- no planner modules for simple table reconciliation
- no app DTO converter files unless a live app caller requires them

Missing a target is allowed only with a serious stage-by-stage explanation.

## Hard Acceptance Rules

A stage is not successful merely because it reduces LoC versus the current
implementation.

For each stage, the old implementation is the benchmark. The worker must either:

1. produce code close to the old implementation in size and directness,
2. justify every additional function, type, export, and test beyond the old
   implementation with a live caller or concrete product requirement, or
3. stop and report a blocker.

Tiny reductions to a still-overgrown file are failures.

If a stage starts from a file or path that is more than 3x the old LoC, the
expected result is a substantial reduction. A result that remains more than 3x
the old LoC requires explicit owner approval before acceptance.

Passing tests is not sufficient for approval. Tests prove that the chosen shape
works; they do not prove that the chosen shape is appropriately small.

## Deferred Code Is Not Preserved Code

If a function belongs to a later stage, do not keep it in the current stage
simply because current imports reference it.

The worker must either:

- remove it and report the exact downstream blockers,
- move it only if that move is inside the approved stage scope, or
- stop and ask for owner approval.

Current imports are evidence of coupling. They are not automatically evidence
that the code belongs in the current stage.

For example, if scheduled reload construction helpers are out of scope for a
scheduled-continuity-helper stage, sync imports of those helpers are Stage 5 or
sync-stage blockers. They are not justification for preserving reload helpers in
the continuity-helper stage.

## Required Pre-Edit Plan For Large Deltas

When current code for a stage is more than 3x the old code, the worker must
produce a pre-edit plan before changing implementation files.

The plan must include:

- old raw LoC
- current raw LoC
- target raw LoC range
- exact functions and types proposed to keep
- exact functions and types proposed to delete or defer
- imports expected to break
- stage responsible for fixing those imports

No code edits should proceed until the orchestrator or owner approves the plan.

## Sync Code Reduction Focus

The largest obvious bloat risk is static reload sync code.

Old scoped event code had no `convex/functions/events/sync` tree. Current sync
has roughly 643 production lines and 294 test lines across:

- `actions.ts`
- `mutations.ts`
- `reloadDockEventsForSailingDay.ts`
- `reloadDockEventsWindow.ts`
- `buildConvexReloadDockDataFromFetchedSlices.ts`
- `fetchHistoryRecordsForDate.ts`
- `loadTripIndexesForSailingDay.ts`
- `reloadDockDataSchemas.ts`
- `types.ts`
- four sync test files

Obvious reduction questions for the sync stages:

- Is `reloadDockEventsForCurrentSailingDay` actually used, or is it only an
  operator convenience?
- Is `reloadDockEventsForSailingDay` actually used outside manual operation?
- Is `reloadDockEventsWindow` needed as an exported internal action, or only as
  implementation detail for the cron boundary action?
- Can `runReloadDockEventsForSailingDay` and `runReloadDockEventsWindow` live in
  `actions.ts` instead of separate files?
- Can `buildConvexReloadDockDataFromFetchedSlices` be inlined into the single
  action path?
- Can `fetchHistoryRecordsForDate` be inlined unless it has independent value?
- Can `reloadDockDataSchemas.ts` and `types.ts` collapse into the mutation file?
- Can sync tests be reduced to one cron/window behavior test and one mutation
  behavior test?
- Should any static reload transformation live with scheduled-trip or shared
  ferry logic instead of `functions/events/sync`?

Do not preserve sync code merely because the current branch has it. The only
known live current caller is the cron boundary path:

```text
internal.functions.events.sync.index.reloadDockEventsAtSailingDayBoundary
```

Manual/operator actions may still be valuable, but they need explicit
justification.

## Proposed Stages

Each stage is intentionally narrow. A worker should not continue into the next
entrypoint without owner or orchestrator approval.

1. `eventsScheduled/schemas.ts`
2. `eventsScheduled/queries.ts`: public vessel-day list query and any required
   reader
3. `eventsScheduled/mutations.ts`: `upsertScheduledRowsForSailingDay`
4. scheduled helpers used by live callers
5. scheduled reload row construction, if still required after sync reduction
6. `eventsActual/schemas.ts`
7. `eventsActual/queries.ts`: public vessel-day list query
8. `eventsActual/mutations.ts`: `upsertActualDockRows`
9. actual write projection from orchestrator
10. actual static reload path, if still required after sync reduction
11. `eventsPredicted/schemas.ts`
12. `eventsPredicted/queries.ts`: public vessel-day list query
13. `eventsPredicted/queries.ts`: `loadPredictedRowsGroupedForTrips`
14. `eventsPredicted/mutations.ts`: `upsertPredictedDockBatches`
15. `eventsPredicted/mutations.ts`: depart-next ML actualization
16. predicted projection helpers
17. sync cron boundary action
18. sync manual/operator actions, only if justified
19. sync internal mutations and reload payload validators
20. barrel/export surface cleanup
21. test reduction and final audit

## Stage 4 Special Rule

`convex/domain/events/scheduled.ts` was 37 raw LoC in `events-old-reference`
and roughly 500 raw LoC before this reduction pass.

Stage 4 must not accept a tiny reduction to this file. The expected Stage 4
result is the old type contract plus only live scheduled-continuity helpers.

Reload construction helpers are out of scope for Stage 4 and must be deleted,
deferred, or reported as blockers for Stage 5.

Out of scope for Stage 4 unless the owner explicitly expands the stage:

- `buildScheduledDockEventRecords`
- `buildScheduledDockEvents`
- raw seed segment builders
- seam normalization
- official arrival-time fallback logic
- reload schedule segment DTOs unless required by a kept continuity helper

If removing these would break current sync or actual reload imports, stop and
report the exact blockers. Do not use those imports as a reason to preserve
reload code in Stage 4.

A Stage 4 result over 200 raw LoC requires owner approval before acceptance.

## Stage Verification

For each stage:

- run focused tests for the touched entrypoint
- run typecheck only when the stage has enough restored surface for meaningful
  signal
- do not add future-stage stubs to make typecheck pass
- report exact blockers if broader checks are blocked by later stages

Final audit must run:

- focused event tests retained after reduction
- `bun run convex:typecheck`
- `bun run type-check`
- `bun run check`

## Convex-Specific Guardrails

Follow `docs/convex_rules.mdc`.

In particular:

- use the new Convex function object syntax
- include argument and return validators for all Convex functions
- keep public functions public only when they are truly public API
- prefer internal functions for cron and server-only workflow
- avoid unnecessary action-to-mutation fragmentation when direct helper code is
  simpler and still respects Convex transaction boundaries
- preserve required index ordering in queries

## Style Guardrails

Follow `.cursor/rules/code-style.mdc`.

However, remember that the style guide makes helpers expensive because each
function requires TSDoc. This is another reason to prefer fewer, direct
functions. Do not create helpers unless the resulting code is genuinely shorter
or clearer after style-guide-compliant comments are included.

## Final Audit Requirements

The final audit must compare old, pre-stage current, and final code using raw
LoC.

It must include:

- raw production LoC
- raw test LoC
- file count
- max directory depth
- list of entrypoints still substantially longer than old code
- justification for every longer entrypoint
- list of deleted surfaces
- remaining domain helpers and why each exists

The final audit should not claim success by comparing only against the larger
current implementation. The benchmark is `events-old-reference`.
