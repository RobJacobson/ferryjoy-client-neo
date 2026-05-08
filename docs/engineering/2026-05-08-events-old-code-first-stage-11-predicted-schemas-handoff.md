# Events Old-Code-First Stage 11 Predicted Schemas Handoff

## Stage Scope

Review `convex/functions/events/eventsPredicted/schemas.ts` against the old
`eventsPredicted` schema and decide whether any schema delta is still required.

Default editable files:

- `convex/functions/events/eventsPredicted/schemas.ts`
- this handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

The worker may inspect predicted callers, domain projection code, orchestrator
persistence, and focused tests. Do not edit predicted queries, predicted
mutations, domain projection helpers, sync/reload code, generated files, or
barrels unless the schema cannot be safely reviewed without a tiny compatibility
adjustment. If that happens, stop and report the exact blocker before expanding
scope.

## Required Reading

Read before implementation:

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- `docs/engineering/2026-05-06-events-old-code-first-stage-1-scheduled-schemas-handoff.md`
- `docs/engineering/2026-05-07-events-old-code-first-stage-6-actual-schemas-handoff.md`

Use `events-old-reference` as the implementation baseline. Do not use
`events-current-reference` unless the owner explicitly asks for archaeology.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/functions/events/eventsPredicted/schemas.ts`
- current `convex/functions/events/eventsPredicted/schemas.ts`
- current `convex/functions/events/eventsPredicted/index.ts`
- current `convex/functions/events/eventsPredicted/queries.ts`
- current `convex/functions/events/eventsPredicted/mutations.ts`
- current `convex/domain/events/predicted.ts`
- current `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`

Old schema shape:

- `predictionSourceSchema` for `"ml"` and `"wsf_eta"`
- `ConvexPredictionSource`
- `predictedDockSharedFields`
- `eventsPredictedSchema` with `UpdatedAt`
- `ConvexPredictedDockEvent`
- `predictedDockWriteRowSchema`
- `ConvexPredictedDockWriteRow`
- `predictedDockWriteBatchSchema`
- `ConvexPredictedDockWriteBatch`
- raw LoC: 64

The old schema file is the full old flow for this stage: it exports validators
and inferred wire types. There is no database read, write, or helper flow beyond
the Convex object validators.

Current schema shape:

- same exported validator and type surface as old code
- `predictionTypeValidator` import uses the current absolute import style
- inline TSDoc comments from old code have been collapsed into the module
  comment and final export block
- raw LoC before Stage 11: 62

## Live Caller Notes

Current live callers require the predicted schema surface:

- `eventsPredictedSchema` is used by table schema wiring and query return
  validation.
- `ConvexPredictedDockEvent` is used by predicted queries, mutations, app
  timeline data wiring, and timeline render pipeline types.
- `predictedDockWriteBatchSchema` is used by
  `persistVesselUpdates` argument validation in vessel-orchestrator persistence.
- `ConvexPredictedDockWriteBatch` and `ConvexPredictedDockWriteRow` are used by
  `convex/domain/events/predicted.ts` and predicted mutation tests.
- `predictionSourceSchema` and `ConvexPredictionSource` are re-exported by the
  predicted barrel. Removing them belongs to Stage 20 barrel/export cleanup
  unless this stage finds no production import and gets explicit approval.

## Current-Code Delta Table

| Current addition beyond old code | Default decision | Reason |
| --- | --- | --- |
| Absolute `functions/predictions/schemas` import | Keep unless local convention demands otherwise | It matches current path alias usage in the same event modules and does not add schema complexity. |
| Final export block instead of inline exports | Keep | Matches current style guide preference and keeps the export surface explicit without growing code. |
| Collapsed comments compared with old TSDoc-heavy schema | Keep | Current file is already smaller than old and still has a useful module comment. Do not re-add old comment volume. |
| Write-batch validators and types | Keep | They existed in old code and are live in current orchestrator persistence and domain predicted projection code. |
| `predictionSourceSchema` barrel export | Keep by default | Current barrel re-exports it. Any export-surface reduction belongs to Stage 20 unless a tiny no-risk deletion is approved. |

## LoC Report

| Area | Old LoC | Current LoC before stage | Target |
| --- | ---: | ---: | --- |
| `eventsPredicted/schemas.ts` | 64 | 62 | No churn expected unless a real semantic mismatch is found |

If code changes are made, report updated production LoC and any focused test
LoC touched. Use raw line counts, not semantic line counts.

## Required Worker Report

The result must include:

1. Old production LoC.
2. Current production LoC before edits.
3. Updated production LoC after edits.
4. Old/current/updated focused test LoC if tests are touched.
5. A complete old-flow trace from exported schema/type to live callers.
6. A delta table explaining every meaningful difference from old code.
7. A clear recommendation: no-op, schema edit, or blocker.

Reject a result that starts by trimming the current file without first tracing
the old schema surface and live current callers.

## Verification Run Or Blocker

If the schema changes, run focused predicted and orchestrator persistence tests:

```sh
bun test convex/functions/events/eventsPredicted/tests convex/domain/events/tests/predicted.test.ts convex/functions/vesselOrchestrator/tests/persistVesselUpdates.test.ts
```

Then run type checks if validators or exported types changed:

```sh
bun run type-check
bun run convex:typecheck
```

If no code changes are made, verification may be a blocker-free review report
plus raw LoC confirmation.

## Recommendation

This is likely a no-change stage. The current predicted schema file is already
two raw lines smaller than old code while preserving the same validator/type
surface and live write-batch contract. Accept a no-op result if the worker
confirms no live caller, test, or product requirement needs a different schema
shape.

## Worker Result

The Stage 11 worker recommends no schema changes.

### Old-Flow Trace

Old `eventsPredicted/schemas.ts` was the complete old flow for this stage:

1. Define `predictionSourceSchema` as `"ml" | "wsf_eta"` and infer
   `ConvexPredictionSource`.
2. Define `predictedDockSharedFields` for persisted rows and write rows:
   `Key`, `VesselAbbrev`, `SailingDay`, `ScheduledDeparture`,
   `TerminalAbbrev`, `EventPredictedTime`, `PredictionType`,
   `PredictionSource`, optional `Actual`, and optional `DeltaTotal`.
3. Define `eventsPredictedSchema` by adding `UpdatedAt` to shared fields and
   infer `ConvexPredictedDockEvent`.
4. Define `predictedDockWriteRowSchema` from shared fields and infer
   `ConvexPredictedDockWriteRow`.
5. Define `predictedDockWriteBatchSchema` with `VesselAbbrev`, `SailingDay`,
   `TargetKeys`, and `Rows`, then infer `ConvexPredictedDockWriteBatch`.

There is no old database read, write, projection, or helper flow for this
stage; the schema file only exposes Convex validators and inferred wire types.

### Live Current Callers

- `eventsPredictedSchema` is used by `convex/schema.ts` and the public
  predicted vessel-day list query return validator.
- `ConvexPredictedDockEvent` is used by predicted queries, predicted mutations,
  vessel-trip prediction merging, app timeline data wiring, timeline render
  pipeline types, and focused tests.
- `predictedDockWriteBatchSchema` is used by
  `persistVesselUpdates` argument validation in
  `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`.
- `ConvexPredictedDockWriteBatch` and `ConvexPredictedDockWriteRow` are used by
  `convex/domain/events/predicted.ts`, vessel-orchestration event assembly and
  wire contracts, orchestrator persistence callers, and focused tests.
- `predictionSourceSchema` and `ConvexPredictionSource` are re-exported by the
  predicted barrel; `ConvexPredictionSource` is also used by vessel-trip
  prediction merge code. Any export-surface trimming belongs to Stage 20.

### LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| `convex/functions/events/eventsPredicted/schemas.ts` | 64 | 62 | 62 |

Focused tests were not touched. Old/current/updated focused test LoC is not
applicable for this no-op schema review.

### Delta Table

| Current addition beyond old code | Keep/delete | Reason |
| --- | --- | --- |
| Absolute `functions/predictions/schemas` import | Keep | Matches current event-module import style and does not add schema complexity. |
| Final export block instead of inline exports | Keep | Matches the style guide preference and preserves the same public surface. |
| Collapsed old TSDoc into a module comment | Keep | Current file is smaller than old code and still documents the schema role. |
| Write-batch validators and inferred types | Keep | These existed in old code and are live in orchestrator persistence and predicted projection callers. |
| `predictionSourceSchema` and `ConvexPredictionSource` export surface | Keep | Barrel and vessel-trip merge callers still use this surface; broader export cleanup belongs to Stage 20. |

### Verification

No tests were run because no production code or test code changed. The review
confirmed the current file preserves the old validator/type surface and remains
two raw lines smaller than old code.

### Recommendation

Approve Stage 11 as a no-op. Proceed to Stage 12 for the public predicted
vessel-day list query.
