# Events Old-Code-First Final Stages Handoff

Date: 2026-05-08

This note hands off the remaining work for the event-table size-reduction
project. The project is still governed by
`docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md` and
the stage audit in
`docs/engineering/2026-05-06-events-old-code-first-stage-log.md`.

## Current State

Stages 1 through 18 are complete. The next stages are:

19. Sync internal mutations and reload payload validators.
20. Barrel/export surface cleanup.
21. Test reduction and final audit.

The most recent accepted stage is Stage 18. It was a no-op stage that confirmed
the current manual/operator sync actions mirror the old VesselTimeline surface
and are live through `package.json` script `sync:dock-events`, which runs
`scripts/sync-dock-events.ts`.

At handoff time, the final code stages should still be treated as
old-code-first refactors, not as generic cleanup. Every worker must start from
`events-old-reference`, trace the old flow, then add only what current live
callers and product behavior require.

## Required Reading

Before changing code, read:

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- Stage handoffs for the file family being changed

For sync/reload work, also read:

- `docs/engineering/2026-05-07-events-old-code-first-stage-10-actual-static-reload-handoff.md`
- `docs/engineering/2026-05-08-events-old-code-first-stage-17-sync-cron-boundary-action-handoff.md`
- `docs/engineering/2026-05-08-events-old-code-first-stage-18-sync-manual-actions-handoff.md`
- `docs/engineering/2026-05-08-events-old-code-first-stage-19-sync-internal-mutations-reload-validators-handoff.md`

## Project Bias To Preserve

Keep the table pipelines siloed unless a shared helper clearly deletes
meaningful complexity:

- scheduled logic belongs with scheduled
- actual logic belongs with actual
- predicted logic belongs with predicted

Prefer direct functions in the owning table or sync file. Do not add generic
reload, DTO, planner, mapper, or mode abstractions unless they make the live
path smaller and easier to read.

Passing tests is not enough. A stage succeeds only if the implementation is
close to the old baseline or the extra code has a concrete live-caller or
product-behavior reason.

## Standard Stage Workflow

For each remaining stage:

1. Draft a narrow stage handoff before assigning or doing implementation.
2. Inspect the old implementation on `events-old-reference`.
3. Trace the old flow from public/internal entrypoint to reads, writes, and
   return value.
4. Identify live current callers with `rg`.
5. Compare raw LoC:
   - old production LoC
   - current production LoC before edits
   - updated production LoC after edits
   - old/current/updated focused test LoC when tests change
6. Explain every meaningful addition beyond old code.
7. Edit only after the old/current comparison is clear.
8. Review the diff yourself before accepting any worker result.
9. Update `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`.
10. Commit only after the stage is accepted. If the stage grows code, changes
    direction, or returns a blocker, get owner approval first.

If current code for a stage is more than 3x the comparable old code, the worker
must produce a pre-edit plan before touching implementation files.

## Stage 19: Sync Internal Mutations And Reload Payload Validators

Detailed agent handoff (scope, baseline trace, verification, owner policy):
[`docs/engineering/2026-05-08-events-old-code-first-stage-19-sync-internal-mutations-reload-validators-handoff.md`](./2026-05-08-events-old-code-first-stage-19-sync-internal-mutations-reload-validators-handoff.md).

Second pass (**old-flow-first ruthless reduction**, dual LoC denominators):

[`docs/engineering/2026-05-08-events-old-code-first-stage-19-second-pass-reduction-plan.md`](./2026-05-08-events-old-code-first-stage-19-second-pass-reduction-plan.md).

### Likely Scope

Start with:

- `convex/functions/events/sync/mutations.ts`
- `convex/functions/events/sync/reloadDockPayload.ts` (action-to-mutation
  validators and inferred payload types; replaces the old
  `reloadDockDataSchemas.ts` file)
- Result types live next to `runReloadDockEventsForSailingDay` and
  `runReloadDockEventsWindow` (the old `sync/types.ts` file is gone)

Then inspect whether meaningful reduction also requires coordinated edits in:

- `convex/functions/events/sync/reloadDockEventsForSailingDay.ts`
- `convex/functions/events/sync/buildConvexReloadDockDataFromFetchedSlices.ts`
- `convex/functions/events/sync/loadTripIndexesForSailingDay.ts`
- `convex/domain/events/reload.ts`

Do not expand beyond `convex/functions/events/**` and
`convex/domain/events/**` except for direct import fixes.

### Old Baseline To Trace

Use `events-old-reference` and trace the comparable VesselTimeline reseed path.
Likely files include the old VesselTimeline actions, mutations, schemas, and
timeline reseed domain helpers. Do not compare against broad old files unless
the full file participated in the same current behavior.

The old flow to understand:

- operator or boundary action decides the target sailing day/window
- fetched slices are normalized into reseed rows
- one persistence mutation replaces boundary events for the target day
- validators protect the action-to-mutation payload, without growing a parallel
  DTO architecture

### Current Facts To Preserve

- Stage 17 confirmed the boundary cron/action is the old DST-safe two-cron plus
  Pacific hour-three guard, translated to event-table reloads.
- Stage 18 confirmed public current-day and explicit-date reload actions are
  live through `scripts/sync-dock-events.ts`.
- Do not delete the manual public actions in Stage 19.
- Current single-day reload runs split scheduled and actual persistence
  mutations.
- Stage 10 deferred a reload bloat observation that Stage 19 closed:
  `buildReloadDockEventRows` no longer materializes scheduled table rows; only
  `buildReloadScheduledDockRows` does, on the scheduled mutation path.

### Questions Stage 19 Must Answer

- Payload validators: they live in `reloadDockPayload.ts` with inferred types
  shared by mutations, the date-to-epoch converter, and domain row builders.
- Reload result types: colocated with the single-day and window action helpers;
  `actions.ts` imports those types only.
- Numeric epoch conversion: kept in `buildConvexReloadDockDataFromFetchedSlices`
  as the single adapter-to-mutation boundary; further inlining stays optional.
- Split persistence: unchanged; the actual path no longer builds scheduled
  table rows inside `buildReloadDockEventRows`.
- `buildConvexReloadDockDataFromFetchedSlices`, `fetchHistoryRecordsForDate`,
  and `loadTripIndexesForSailingDay` stayed separate modules for readability and
  test hooks (see Stage 19 handoff).
- Domain `reload.ts` change: required to drop unused scheduled-row work from
  `buildReloadDockEventRows`; see Stage 19 implementation report.

### Expected Outcome

Prefer one of these outcomes:

- A real reduction that collapses local-only sync payload validators/types into
  the owning mutation/action files and removes unused reload work.
- A blocker report showing that the current mutation/validator shape is already
  comparable to the old flow and naming the exact out-of-scope lever needed for
  further reduction.

Do not accept a tiny reduction that leaves the same overgrown sync/reload shape.

### Suggested Verification

Choose the smallest relevant set based on edits:

```sh
bun test convex/functions/events/sync/tests/reloadMutations.test.ts
bun test convex/functions/events/sync/tests/runReloadDockEventsForSailingDay.test.ts
bun test convex/functions/events/sync/tests/runReloadDockEventsWindow.test.ts
bun test convex/domain/events/tests/reload.test.ts
bun run type-check
bun run convex:typecheck
```

If Convex public/internal function signatures change, run:

```sh
bun run convex:codegen
```

## Stage 20: Barrel And Export Surface Cleanup

### Likely Scope

Inspect:

- `convex/functions/events/index.ts`
- `convex/functions/events/eventsScheduled/index.ts`
- `convex/functions/events/eventsActual/index.ts`
- `convex/functions/events/eventsPredicted/index.ts`
- `convex/functions/events/sync/index.ts`
- `convex/domain/events/index.ts`
- schema/type exports re-exported only for compatibility

Only update direct imports outside the scoped paths when required to keep live
callers compiling.

### Old Baseline To Trace

Compare the old generated/public surface and old module exports on
`events-old-reference`. The goal is not to copy old names blindly; it is to
remove current exports that exist only because earlier refactors exposed too
much.

### Known Cleanup Candidates

- Stage 1 kept `DockEventType` only for current barrel compatibility. Re-check
  live callers. Delete if no production caller needs it.
- Stage 11 kept predicted schema/type exports that were live at the time. Verify
  each with `rg`, especially schema exports that may only flow through barrels.
- Generated Convex paths may retain stale references until codegen. Do not edit
  generated files manually; run codegen only if function export changes require
  it.
- Tests may import through barrels only because helpers were exported during the
  refactor. Prefer direct local imports or test-local fixtures over preserving
  broad production exports for tests.

### Questions Stage 20 Must Answer

- Which exports are live production API paths, and which are internal
  convenience exports?
- Which exported types are consumed by app or orchestration code outside
  `convex/functions/events/**` and `convex/domain/events/**`?
- Are any barrels re-exporting helper functions that should be private to a
  table file?
- Can tests stop forcing production exports to stay public?
- After codegen, did the generated API surface shrink as expected?

### Expected Outcome

Reduce the public/exported surface without changing behavior. This is a
cleanup-of-boundaries stage, not a chance to reorganize implementation. If an
export is live through app code or scripts, keep it and record why.

### Suggested Verification

Use search plus type checks:

```sh
rg "DockEventType|predictionSourceSchema|ConvexPredictionSource|events\\.sync|eventsScheduled|eventsActual|eventsPredicted" convex app scripts
bun run convex:codegen
bun run type-check
bun run convex:typecheck
```

Run focused tests only if implementation imports changed.

## Stage 21: Test Reduction And Final Audit

### Likely Scope

Review focused tests under:

- `convex/functions/events/eventsScheduled/tests`
- `convex/functions/events/eventsActual/tests`
- `convex/functions/events/eventsPredicted/tests`
- `convex/functions/events/sync/tests`
- `convex/domain/events/tests`
- direct event-update tests that import event-domain helpers

Do not delete behavior coverage just to improve raw LoC. Delete or consolidate
tests that primarily defend helper decomposition, old oversized fixture
harnesses, or now-private implementation details.

### Test Reduction Targets

Look first at duplication and harness weight:

- sync tests currently cover boundary, reload mutation, single-day reload, and
  window reload. The PRD specifically asks whether sync tests can reduce to one
  cron/window behavior test and one mutation behavior test.
- predicted mutation tests are large relative to the old writer. Keep tests that
  protect sparse replacement, omitted-row preservation for depart-next ML
  actualization, duplicate incoming rows, and scope behavior. Remove tests that
  only exercise deleted planner/helper shapes.
- actual mutation tests are large but may protect Stage 5 physical-only
  preservation behavior. Do not remove those unless another focused test covers
  the same product behavior.
- scheduled tests should remain small and centered on public query and upsert
  behavior.
- domain tests should protect row projection semantics, not every private
  helper branch if the helper is no longer public.

### Final Audit Requirements

Produce a final audit note or final stage-log entry with:

- final production raw LoC under `convex/functions/events` and
  `convex/domain/events`
- final test raw LoC under the same scoped areas
- final file count under the same scoped areas
- list of files still materially larger than old baseline, with reasons
- list of remaining shared/domain helpers, with why each is justified
- confirmation that scheduled, actual, and predicted pipelines remain separated
- confirmation that no current implementation was justified solely by
  `events-current-reference`

Suggested metrics commands:

```sh
find convex/functions/events convex/domain/events -type f | sort
find convex/functions/events convex/domain/events -type f | wc -l
find convex/functions/events convex/domain/events -type f -name "*.ts" -print0 | xargs -0 wc -l
find convex/functions/events convex/domain/events -type f -path "*/tests/*" -name "*.ts" -print0 | xargs -0 wc -l
find convex/functions/events convex/domain/events -type f -name "*.ts" ! -path "*/tests/*" -print0 | xargs -0 wc -l
```

### Suggested Verification

Run the final focused suite:

```sh
bun test convex/functions/events/eventsScheduled/tests convex/functions/events/eventsActual/tests convex/functions/events/eventsPredicted/tests convex/functions/events/sync/tests convex/domain/events/tests
bun test convex/domain/vesselOrchestration/updateEvents/tests
bun run type-check
bun run convex:typecheck
bun run check
```

If Stage 20 changed exports or Convex function paths, include:

```sh
bun run convex:codegen
```

## Review Standard For The Finishing Agent

When a worker returns a stage:

- Review the diff before accepting it.
- Confirm the worker used `events-old-reference` as the baseline.
- Confirm live callers were checked with search.
- Reject vague justifications like "cleaner", "more robust", or "better
  separation" unless they name a concrete caller, behavior, or maintenance
  reduction.
- Confirm comments comply with `.cursor/rules/code-style.mdc`.
- Confirm Convex functions comply with `docs/convex_rules.mdc`.
- Confirm Stage 19 does not delete the manual reload actions justified by
  `scripts/sync-dock-events.ts`.
- Confirm Stage 20 does not preserve exports only for tests or stale generated
  paths.
- Confirm Stage 21 does not remove tests for live product behavior merely to
  hit a LoC target.

## Completion Checklist

- Stage 19 handoff written, reviewed, implemented or blocker recorded.
- Stage 19 stage-log row updated with LoC and verification.
- Stage 20 handoff written, reviewed, implemented or blocker recorded.
- Stage 20 stage-log row updated with LoC and verification.
- Stage 21 handoff written, reviewed, implemented or blocker recorded.
- Stage 21 stage-log row updated with final metrics and verification.
- Final scoped test suite passed, or failures documented with owner-visible
  blockers.
- Final type checks passed, or failures documented with owner-visible blockers.
- No unrelated files changed.
- Final commit uses a one-line Conventional Commit subject plus bullet-point
  summary.
