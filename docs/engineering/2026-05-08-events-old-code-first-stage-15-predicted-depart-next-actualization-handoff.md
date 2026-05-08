# Events Old-Code-First Stage 15 Predicted Depart-Next Actualization Handoff

## Stage Scope

Review `patchDepartNextMlRowsForDepBoundary` in
`convex/functions/events/eventsPredicted/mutations.ts` against the old
depart-next ML actualization helper.

This stage covers:

- `patchDepartNextMlRowsForDepBoundary`
- the `DEPART_NEXT_ML_PREDICTION_TYPES` constant only as needed by that helper
  and the Stage 14 preservation guard
- the depart-next actualization portion of
  `convex/functions/events/eventsPredicted/tests/mutations.test.ts`

Stage 14 already restored `upsertPredictedDockBatches` to a direct old-style
reconciliation loop and retained the narrow omitted-row preservation guard.
Do not re-expand the upsert path in this stage.

Default editable files:

- `convex/functions/events/eventsPredicted/mutations.ts`
- `convex/functions/events/eventsPredicted/tests/mutations.test.ts`
- this handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

Do not edit predicted schemas, predicted queries, domain projection helpers,
vessel-orchestrator persistence, leave-dock domain code, generated files, or
barrels unless the actualization helper cannot be safely simplified without a
tiny compatibility adjustment. If that happens, stop and report the exact
blocker before expanding scope.

## Required Reading

Read before implementation:

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- `docs/engineering/2026-05-08-events-old-code-first-stage-14-predicted-upsert-mutations-handoff.md`

Use `events-old-reference` as the implementation baseline. Do not use
`events-current-reference` unless the owner explicitly asks for archaeology.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/functions/events/eventsPredicted/mutations.ts`
- current `convex/functions/events/eventsPredicted/mutations.ts`
- current `convex/functions/events/eventsPredicted/tests/mutations.test.ts`
- current
  `convex/domain/vesselOrchestration/updateLeaveDockEventPatch/updateLeaveDockEventPatch.ts`
- current
  `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`

Old actualization flow:

1. Accept `ctx`, departure boundary key, and observed actual departure time.
2. Iterate `DEPART_NEXT_ML_PREDICTION_TYPES`:
   `AtDockDepartNext` and `AtSeaDepartNext`.
3. For each prediction type, query `eventsPredicted` with
   `by_key_type_and_source`.
4. Constrain `Key` to the departure boundary key, `PredictionType` to the loop
   value, and `PredictionSource` to `"ml"`.
5. Skip when no row exists.
6. Skip when the row already has `Actual`.
7. Patch `Actual` to the observed timestamp and `DeltaTotal` to
   `getRoundedMinutesDelta(existing.EventPredictedTime, actualMs)`.
8. Return `true` if at least one row was patched, otherwise `false`.

Current helper shape is substantially the same as old code, with a renamed
export and a local constant instead of importing the constant from the old
vessel-orchestration shared module.

Raw LoC:

- old full `eventsPredicted/mutations.ts`: 207
- old actualization helper slice: about 39 raw lines, including TSDoc
- current full `eventsPredicted/mutations.ts` before Stage 15: 263
- current actualization helper slice: about 43 raw lines, including TSDoc
- current focused predicted mutation test before Stage 15: 474

## Current Actualization Shape

Current code has:

- `patchDepartNextMlRowsForDepBoundary`, called by
  `persistVesselUpdates` after predicted event upsert
- `updateLeaveDockEventPatch`, which emits `depBoundaryKey` and
  `actualDepartMs` only for the leave-dock edge ping
- local `DEPART_NEXT_ML_PREDICTION_TYPES`, also used by the Stage 14 omitted-row
  preservation guard
- focused tests for patching both ML rows and skipping missing/already
  actualized rows

Live production caller:

- `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`
  calls `patchDepartNextMlRowsForDepBoundary(ctx, depBoundaryKey,
  actualDepartMs)` when `updateLeaveDockEventPatch` is present.

## Current-Code Delta Table

| Delta beyond old actualization flow | Default decision | Reason |
| --- | --- | --- |
| Helper renamed from `actualizeDepartNextMlPredictions` to `patchDepartNextMlRowsForDepBoundary` | Keep unless a better local name reduces confusion | Current name describes the table row patch and live caller import. |
| No internal mutation wrapper | Keep removed | Current orchestrator persistence calls the helper directly inside the aggregate mutation transaction. |
| Local `DEPART_NEXT_ML_PREDICTION_TYPES` constant | Keep | It avoids importing vessel-orchestration shared code into table persistence and is shared with the Stage 14 preservation guard. |
| `existing === null` instead of truthy check | Keep | Matches Convex `first()` result exactly and is readable. |
| Focused tests for patch query/patch behavior | Keep unless obvious trim | The patch helper is small, and the tests cover the live leave-dock behavior. |

## Hard Acceptance Bar

The current actualization helper is already close to old code. A valid Stage 15
result may be a no-op if the worker confirms:

- the helper still matches the old query/skip/patch flow;
- the local constant is justified by table-local ownership and the Stage 14
  preservation guard;
- tests are focused and not defending unnecessary architecture.

Do not churn naming or comments for a cosmetic LoC win. Do not move the
depart-next constant into shared/domain code without a concrete reduction or
ownership benefit.

## Required Worker Report

The result must include:

1. Old actualization helper LoC and old full-file LoC.
2. Current production LoC before edits.
3. Updated production LoC after edits.
4. Old/current/updated focused test LoC if tests are touched.
5. A complete old-flow trace from leave-dock boundary key to row patches.
6. A delta table explaining every meaningful difference from old code.
7. A clear recommendation: approve edits, no-op, or blocker.

If code changes are made, update this handoff with a Worker Result section and
update the stage log after verification. If no code changes are appropriate,
record the no-op result and update the stage log only if appropriate.

## Verification

If code or tests change, run:

```sh
bun test convex/functions/events/eventsPredicted/tests/mutations.test.ts
```

Run broader type checks if exported signatures or vessel-orchestrator imports
change:

```sh
bun run type-check
bun run convex:typecheck
```

If no code or test files change, verification may be a blocker-free review
report plus raw LoC confirmation.

## Recommendation

This is likely a no-op stage. The current helper is almost identical to the old
actualization flow, and the main Stage 15 work is to document that it should
remain a direct table-local helper tied to `updateLeaveDockEventPatch` and the
Stage 14 preservation guard.

## Worker Result

The Stage 15 worker recommends approving this stage as a no-op.

### Old-Flow Trace

Old `actualizeDepartNextMlPredictions` worked as follows:

1. Accept `ctx`, a departure dock boundary key, and the observed actual
   departure timestamp.
2. Iterate `DEPART_NEXT_ML_PREDICTION_TYPES`: `AtDockDepartNext` and
   `AtSeaDepartNext`.
3. For each prediction type, query `eventsPredicted` through
   `by_key_type_and_source`.
4. Constrain the indexed read to the boundary `Key`, the prediction type, and
   `PredictionSource === "ml"`.
5. Skip when no matching row exists.
6. Skip when the row already has `Actual`.
7. Patch `Actual` to the observed timestamp and `DeltaTotal` to
   `getRoundedMinutesDelta(existing.EventPredictedTime, actualMs)`.
8. Return `true` if any row was patched; otherwise return `false`.

The current live flow starts in `runOrchestratorPing`, where
`updateLeaveDockEventPatch` emits a payload only for the leave-dock edge ping
with `LeftDockActual` and a schedule key. `persistVesselUpdates` then writes
trip and event rows in one transaction, and calls
`patchDepartNextMlRowsForDepBoundary(ctx, depBoundaryKey, actualDepartMs)` when
that optional payload exists. The helper performs the same indexed read, skip,
patch, and boolean-return loop as the old implementation.

### Raw LoC

- Old full `eventsPredicted/mutations.ts`: 207
- Old actualization helper slice: 40 raw lines, including TSDoc
- Current production before edits: 263
- Updated production after edits: 263
- Old focused test LoC: 0
- Current focused mutation test before edits: 474
- Updated focused mutation test after edits: 474

### Delta Table

| Current addition beyond old actualization flow | Keep/delete | Reason |
| --- | --- | --- |
| Helper renamed to `patchDepartNextMlRowsForDepBoundary` | Keep | The name matches the current table-local patch helper imported by `persistVesselUpdates`; changing it would churn the live caller without reducing code. |
| Final export block instead of inline export | Keep | Matches current style guide and adds no runtime indirection. |
| Local `DEPART_NEXT_ML_PREDICTION_TYPES` constant | Keep | Keeps predicted-table persistence independent from vessel-orchestration shared code and also supports the Stage 14 omitted-row preservation guard. |
| `existing === null` check | Keep | Matches Convex `first()` exactly and is as direct as the old truthy check. |
| Focused patch tests | Keep | They verify the live behavior: both ML rows are queried and patched, missing rows are skipped, and already actualized rows are not patched. |

### Verification

No tests were run because no production or test code changed.

### Recommendation

Approve Stage 15 as a no-op. The current helper remains close to the old
implementation in size and shape, and the extra code around it is justified by
current live caller naming, export style, and the Stage 14 preservation guard.
