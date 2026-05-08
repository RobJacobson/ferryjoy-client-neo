# Events Old-Code-First Stage 14 Predicted Upsert Mutations Handoff

## Stage Scope

Review and reduce `upsertPredictedDockBatches` in
`convex/functions/events/eventsPredicted/mutations.ts` against the old sparse
predicted write-batch mutation flow.

This stage covers:

- `upsertPredictedDockBatches`
- the scope merge and reconciliation helpers used only by that upsert path
- the `upsertPredictedDockBatches` portion of
  `convex/functions/events/eventsPredicted/tests/mutations.test.ts`

Stage 15 owns `patchDepartNextMlRowsForDepBoundary` / depart-next ML
actualization. Do not rewrite the patching function in this stage. The current
upsert path also contains depart-next ML preservation logic for omitted rows;
inspect and justify it carefully before changing it. If that behavior really
belongs with Stage 15 and cannot be simplified safely here, report the blocker
instead of deleting it.

Default editable files:

- `convex/functions/events/eventsPredicted/mutations.ts`
- `convex/functions/events/eventsPredicted/tests/mutations.test.ts`
- this handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

Do not edit predicted schemas, predicted queries, domain projection helpers,
vessel-orchestrator persistence, generated files, or barrels unless the upsert
mutation cannot be safely simplified without a tiny compatibility adjustment.
If that happens, stop and report the exact blocker before expanding scope.

## Required Reading

Read before implementation:

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- `docs/engineering/2026-05-08-events-old-code-first-stage-11-predicted-schemas-handoff.md`
- `docs/engineering/2026-05-08-events-old-code-first-stage-13-predicted-grouped-loader-handoff.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-3-scheduled-mutations-handoff.md`
- `docs/engineering/2026-05-07-events-old-code-first-stage-8-actual-mutations-handoff.md`

Use `events-old-reference` as the implementation baseline. Do not use
`events-current-reference` unless the owner explicitly asks for archaeology.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/functions/events/eventsPredicted/mutations.ts`
- current `convex/functions/events/eventsPredicted/mutations.ts`
- current `convex/functions/events/eventsPredicted/tests/mutations.test.ts`
- current
  `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`
- current `convex/domain/vesselOrchestration/updateEvents/projectionWire.ts`

Old upsert flow:

1. Public surface was `projectPredictedDockWriteBatches` as an internal
   mutation wrapper around `projectPredictedDockWriteBatchesInDb`.
2. `projectPredictedDockWriteBatchesInDb` accepted sparse batches with
   `VesselAbbrev`, `SailingDay`, `TargetKeys`, and `Rows`.
3. Batches were merged by vessel/sailing-day scope.
4. Duplicate target keys were unioned.
5. Duplicate incoming rows were last-row-wins by
   `predictedDockCompositeKey(row)`.
6. Each non-empty target scope loaded existing rows by
   `by_vessel_and_sailing_day`.
7. Existing targeted rows missing from incoming composite ids were deleted.
8. Incoming rows outside `TargetKeys` were ignored.
9. Missing incoming rows were inserted with fresh `UpdatedAt`.
10. Existing changed rows were replaced.
11. Existing unchanged rows were skipped by `predictedRowsEqual`, ignoring
    Convex metadata and `UpdatedAt`.

Old code did not preserve omitted depart-next ML rows in the sparse upsert
path. Old depart-next actualization was a separate function later in the same
file.

Raw LoC:

- old full `eventsPredicted/mutations.ts`: 207
- old upsert/writer slice: about 148 raw lines, including wrapper,
  `projectPredictedDockWriteBatchesInDb`, and `predictedRowsEqual`
- current full `eventsPredicted/mutations.ts` before Stage 14: 350
- current focused predicted mutation test before Stage 14: 474

## Current Upsert Shape

Current code has:

- no internal mutation wrapper; `persistVesselUpdates` calls
  `upsertPredictedDockBatches` directly inside the vessel-orchestrator aggregate
  persistence transaction
- local `PredictedDockWriteBatchLike`, `MergedPredictedDockScope`, and
  `PredictedDockReplacement` types
- `mergePredictedDockBatchesByScope` plus
  `mergePredictedDockBatchIntoScope`
- `reconcilePredictedDockScope`, which builds delete/insert/replace arrays
  before applying writes
- `arePredictedRowsEqual`, equivalent to old `predictedRowsEqual`
- depart-next ML omitted-row preservation through
  `buildIncomingSourceKeys`, `shouldPreserveOmittedDepartNextMlRow`, and
  `predictedSourceKey`

Live production caller:

- `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`
  calls `upsertPredictedDockBatches(ctx, args.predictedEvents)`.

## Current-Code Delta Table

| Delta beyond old upsert flow | Default decision | Reason |
| --- | --- | --- |
| Old internal mutation wrapper removed | Keep removed | Current orchestrator persistence calls the helper directly in one transaction. Do not re-add a generated wrapper without a live caller. |
| Final export block and non-inline exports | Keep | Matches current style guide and does not add runtime indirection. |
| `mergePredictedDockBatchesByScope` helper | Investigate | Old code merged inline. Keep only if it makes the current upsert shorter/clearer overall. |
| `mergePredictedDockBatchIntoScope` helper | Investigate skeptically | This may be helper extraction without much payoff; inline if it reduces indirection and keeps readability. |
| `reconcilePredictedDockScope` returning write arrays | Investigate skeptically | Old code applied writes directly. Keep only if depart-next preservation or testability justifies the extra plan object. |
| `PredictedDockReplacement` type | Delete if reconciliation plan disappears | It exists only to support the replace array. |
| Depart-next ML omitted-row preservation | Keep only with concrete requirement, or report blocker | This is a behavior beyond old upsert. Current tests cover it, but the worker must tie it to live product behavior or Stage 15 coupling, not merely to current tests. |
| `buildIncomingSourceKeys` / `predictedSourceKey` | Keep only if preservation stays | These helpers are preservation support code. |
| Focused mutation tests | Reduce only if straightforward | Preserve coverage for scope merging, target filtering, duplicate rows, equality/UpdatedAt skipping, and any kept depart-next preservation behavior. |

## Hard Acceptance Bar

Current full `eventsPredicted/mutations.ts` is about 1.7x the old full file, and
the upsert path has more helper layers than old code. A valid Stage 14 result
must either:

1. reduce the upsert path materially while preserving live sparse reconciliation
   behavior;
2. produce a blocker/no-op report explaining why the current extra helpers and
   depart-next preservation are necessary until Stage 15; or
3. make a small, direct simplification only if it clearly moves the code toward
   the old flow and does not leave a still-overgrown helper tree untouched.

Do not claim success for a tiny reduction that leaves avoidable upsert
indirection intact. Do not remove depart-next preservation solely because old
code lacked it; first prove whether current live behavior relies on it.

## Required Worker Report

The result must include:

1. Old upsert/writer LoC and old full-file LoC.
2. Current production LoC before edits.
3. Updated production LoC after edits.
4. Old/current/updated focused test LoC if tests are touched.
5. A complete old-flow trace from batches to database deletes/inserts/replaces.
6. A delta table explaining every meaningful difference from old code.
7. A specific explanation for depart-next ML omitted-row preservation:
   keep/delete/defer, with live behavior or blocker rationale.
8. A clear recommendation: approve edits, no-op, or blocker.

If code changes are made, update this handoff with a Worker Result section and
update the stage log after verification. If the correct answer is a blocker,
record the out-of-scope lever and the later stage responsible.

## Verification

If code or tests change, run:

```sh
bun test convex/functions/events/eventsPredicted/tests/mutations.test.ts
```

Run broader type checks if exported signatures, validators, or
vessel-orchestrator persistence imports change:

```sh
bun run type-check
bun run convex:typecheck
```

If no code or test files change, verification may be a blocker-free review
report plus raw LoC confirmation.

## Recommendation

Start by trying to restore the old direct reconciliation shape: merge scopes,
load existing rows, delete stale targeted rows, insert missing rows, replace
changed rows, and skip unchanged rows. The key decision is whether current
depart-next preservation can be expressed simply inside that direct loop. If it
cannot, report why Stage 15 should own that behavior instead of adding more
Stage 14 machinery.

## Worker Result

The Stage 14 worker recommends approving the production edit.

### Old-Flow Trace

Old `projectPredictedDockWriteBatchesInDb` worked as follows:

1. Accept sparse batches with `VesselAbbrev`, `SailingDay`, `TargetKeys`, and
   `Rows`.
2. Stamp one `updatedAt` value for the mutation run.
3. Merge batches by vessel and sailing-day scope using
   `buildVesselSailingDayScopeKey`.
4. Union duplicate `TargetKeys` inside a scope.
5. Dedupe duplicate incoming rows by `predictedDockCompositeKey(row)`, keeping
   the later row.
6. Skip scopes whose merged target set is empty.
7. Read existing rows for the scope through
   `eventsPredicted.by_vessel_and_sailing_day`.
8. Map existing rows by composite prediction identity.
9. Delete existing targeted rows whose composite identity is absent from the
   incoming row set.
10. Ignore incoming rows outside the merged target key set.
11. Insert incoming rows with no existing composite identity, adding
   `UpdatedAt`.
12. Replace changed existing rows and skip unchanged rows with
   `predictedRowsEqual`, ignoring Convex metadata and `UpdatedAt`.

The old public/internal mutation wrapper was not restored because current
`persistVesselUpdates` calls `upsertPredictedDockBatches` directly inside the
same vessel persistence transaction.

### Live Current Callers

- `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`
  calls `upsertPredictedDockBatches(ctx, args.predictedEvents)` when a ping
  carries predicted event batches.
- `convex/domain/events/predicted.ts` builds sparse write and clear batches
  with the same old contract: scope keys in `TargetKeys`, replacement rows in
  `Rows`, and table-owned `UpdatedAt` stamping.
- `convex/domain/vesselOrchestration/updateLeaveDockEventPatch/updateLeaveDockEventPatch.ts`
  builds the leave-dock patch payload that later calls
  `patchDepartNextMlRowsForDepBoundary` in the same persistence mutation.

### Change Made

`upsertPredictedDockBatches` now follows the old direct shape again:

- scope merging is inline in the upsert function
- stale deletes, inserts, replaces, and unchanged skips are applied directly
- the separate merge helper, merge-into helper, reconciliation planner helper,
  and replacement DTO type were deleted

Depart-next ML omitted-row preservation stays, but it is now a single delete
guard inside the direct stale-row loop. This keeps the current product
requirement without keeping the larger write-plan abstraction.

### Depart-Next Preservation Decision

Keep for now.

Old sparse upsert deleted omitted depart-next ML rows, but current live
orchestrator persistence can produce a leave-dock patch in the same transaction
as predicted write batches. The patcher targets `AtDockDepartNext` and
`AtSeaDepartNext` ML rows for the departure boundary after predicted batches
are upserted. If a clear batch omits those rows and the upsert deletes them
first, the patcher cannot stamp `Actual` and `DeltaTotal` for that leave-dock
edge.

The preserved behavior is narrow: only ML depart-next rows survive omission,
and only when the incoming scope does not carry another row for the same
boundary key and prediction source. If an incoming same-key ML replacement
family arrives, stale depart-next rows are still deleted. Stage 15 still owns
the patcher function itself.

### LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| Full `eventsPredicted/mutations.ts` | 207 | 350 | 263 |
| Upsert/writer slice | about 148 | about 242 | about 155 |
| Focused predicted mutation tests | 0 | 474 | 474 |

Focused tests were not edited.

### Delta Table

| Current addition beyond old upsert flow | Keep/delete | Reason |
| --- | --- | --- |
| Old internal mutation wrapper removed | Keep removed | Current orchestrator persistence calls the helper directly inside one transaction. |
| Final export block and local helper exports | Keep | Matches current style and exposes only the live helper surface. |
| `mergePredictedDockBatchesByScope` helper | Delete | Old inline merge is readable and removes helper indirection. |
| `mergePredictedDockBatchIntoScope` helper | Delete | Its body is clearer at the one call site. |
| `reconcilePredictedDockScope` write-plan helper | Delete | Old direct write loop is shorter and avoids delete/insert/replace DTO arrays. |
| `PredictedDockReplacement` type | Delete | Only existed for the removed replacement plan array. |
| Depart-next ML omitted-row preservation | Keep | Needed so same-transaction leave-dock patching can actualize omitted depart-next ML rows. |
| `buildIncomingSourceKeys` / `predictedSourceKey` | Keep | Small support for the preserved depart-next delete guard. |
| Focused mutation tests | Keep | Coverage maps to product behavior: scope merge, target filtering, duplicate rows, equality skips, preservation, and Stage 15 patch behavior. |

### Verification

```sh
bun test convex/functions/events/eventsPredicted/tests/mutations.test.ts
```

Passed: 7 tests, 15 assertions.

### Recommendation

Approve Stage 14. The upsert path is back near the old sparse writer shape, with
the one retained current behavior documented and tested. Stage 15 should review
`patchDepartNextMlRowsForDepBoundary` without re-expanding the upsert path.
