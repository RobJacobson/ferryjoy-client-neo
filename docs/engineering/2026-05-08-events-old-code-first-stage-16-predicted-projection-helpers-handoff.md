# Events Old-Code-First Stage 16 Predicted Projection Helpers Handoff

## Stage Scope

Review and reduce the predicted projection helpers in
`convex/domain/events/predicted.ts` using the old prediction projection flow as
the baseline where comparable.

This stage covers:

- `buildPredictedDockWriteBatch`
- `buildPredictedDockClearBatch`
- helpers used only by those projection functions
- `predictedDockCompositeKey`, but only if changes do not disrupt its live
  table-query and mutation callers
- `convex/domain/events/tests/predicted.test.ts`

Do not edit predicted table schemas, queries, mutations, event assembler,
vessel-trip merge code, generated files, or barrels unless the projection
helpers cannot be safely simplified without a tiny compatibility adjustment. If
that happens, stop and report the exact blocker before expanding scope.

## Required Reading

Read before implementation:

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- `docs/engineering/2026-05-08-events-old-code-first-stage-11-predicted-schemas-handoff.md`
- `docs/engineering/2026-05-08-events-old-code-first-stage-14-predicted-upsert-mutations-handoff.md`
- `docs/engineering/2026-05-08-events-old-code-first-stage-15-predicted-depart-next-actualization-handoff.md`

Use `events-old-reference` as the implementation baseline. Do not use
`events-current-reference` unless the owner explicitly asks for archaeology.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/domain/events/predicted.ts`
- `events-old-reference:convex/domain/vesselOrchestration/updateVesselPredictions/vesselTripPredictionProposalsFromMlTrip.ts`
- current `convex/domain/events/predicted.ts`
- current `convex/domain/events/tests/predicted.test.ts`
- current `convex/domain/vesselOrchestration/updateEvents/eventWriteAssembler.ts`
- current predicted table query/mutation callers of `predictedDockCompositeKey`

Important baseline warning:

The old `convex/domain/events/predicted.ts` was only a contracts file plus
`predictedDockCompositeKey`; it did not build `eventsPredicted` table batches.
The nearest old projection flow was
`vesselTripPredictionProposalsFromMlTrip`, which converted ML fields on a trip
into `vesselTripPredictions` proposal rows. That old flow is related, but not
the same persisted table behavior as current `eventsPredicted` dock rows.

Old comparable pieces:

1. Old `domain/events/predicted.ts` defined predicted row/write-batch contracts
   and `predictedDockCompositeKey`.
2. Old `vesselTripPredictionProposalsFromMlTrip` iterated five ML prediction
   fields.
3. It skipped absent fields.
4. It skipped joined/minimal prediction payloads that were not full ML
   predictions.
5. It emitted simple proposal rows keyed by vessel/trip/prediction type.

Current projection does more because live `eventsPredicted` rows are dock-event
table rows:

- target-key scoping for current departure, current arrival, and next
  departure boundaries
- WSF ETA row projection
- best-current-arrival ML selection (`AtSeaArriveNext` over
  `AtDockArriveNext`)
- best-next-departure ML selection (`AtSeaDepartNext` over
  `AtDockDepartNext`)
- sparse clear batches when existing trip scope changes
- optional `Actual` / `DeltaTotal` copy-through for already-actualized ML
  payloads

Raw LoC:

- old `domain/events/predicted.ts`: 62
- old `vesselTripPredictionProposalsFromMlTrip.ts`: 57
- old focused proposal test: 68
- current `domain/events/predicted.ts` before Stage 16: 381
- current `domain/events/tests/predicted.test.ts` before Stage 16: 262

## Current Live Callers

Current production callers:

- `convex/domain/vesselOrchestration/updateEvents/eventWriteAssembler.ts`
  calls `buildPredictedDockWriteBatch` and `buildPredictedDockClearBatch`.
- `convex/functions/events/eventsPredicted/mutations.ts`,
  `convex/functions/events/eventsPredicted/queries.ts`, and
  `convex/functions/vesselTrips/read/mergeTripsWithPredictions.ts` call
  `predictedDockCompositeKey`.

Current tests:

- `convex/domain/events/tests/predicted.test.ts` covers target-key scope, WSF
  ETA, ML row priority, actualization field copy-through, null cases, dedupe,
  TripKey fallback, and clear batches.

## Current-Code Delta Table

| Delta beyond old comparable flow | Default decision | Reason |
| --- | --- | --- |
| `predictedDockCompositeKey` in domain/events | Keep | Old code had it, and current table query/mutation/merge callers use it. |
| `buildPredictedDockWriteBatch` | Keep if live behavior needs table rows | `eventWriteAssembler` emits predicted table batches through this helper. Simplify internals if possible. |
| `buildPredictedDockClearBatch` | Keep unless event assembler no longer needs scope-change clears | Current assembler clears stale prediction scope when sailing-day/schedule identity changes. |
| Target-key derivation helper | Investigate | It may be justified because write and clear batches share exactly the same scope. Inline only if it reduces complexity. |
| Per-boundary row builder helpers | Investigate skeptically | Current file has several small helpers. Keep when they isolate real row-specific prerequisites; inline if they add indirection. |
| Best ML selector helpers | Investigate | Priority behavior is real; helpers are acceptable only if clearer than direct local expressions. |
| `buildPredictedDockWriteRow` copier | Investigate | It exists mostly to copy optional `Actual` / `DeltaTotal`; inline or simplify if possible. |
| `dedupePredictedDockRows` | Keep only if live duplicate cases require it | Current tests cover duplicate target/source behavior; verify whether it protects real possible duplicates. |
| `toArray` helper | Investigate skeptically | A generic zero-or-one array helper may be avoidable local cleverness. |
| Focused tests | Reduce only if straightforward | Keep product behavior coverage; trim only harness duplication or tests that defend implementation shape rather than behavior. |

## Hard Acceptance Bar

Current `domain/events/predicted.ts` is much larger than the old contracts file
because it now owns live table projection behavior old code did not perform in
that file. A valid Stage 16 result must either:

1. materially reduce helper indirection while preserving live predicted table
   projection behavior;
2. produce a blocker/no-op report explaining that the extra code is the
   necessary table projection boundary and naming later stages that could reduce
   it; or
3. make a small direct simplification only if it clearly removes local
   abstraction without weakening the behavior tests.

Do not compare only against old `domain/events/predicted.ts` and declare
failure because current code has table projection responsibilities. Also do not
use broad current behavior as a blanket excuse: every row builder and helper
must tie to live `eventWriteAssembler` behavior or focused product tests.

## Required Worker Report

The result must include:

1. Old comparable LoC: old contracts file and old ML proposal mapper.
2. Current production LoC before edits.
3. Updated production LoC after edits.
4. Old/current/updated focused test LoC if tests are touched.
5. A complete old-flow trace and an explanation of where current table
   projection differs from old proposal projection.
6. A delta table explaining every meaningful difference from old code.
7. A clear recommendation: approve edits, no-op, or blocker.

If code changes are made, update this handoff with a Worker Result section and
update the stage log after verification. If the correct answer is a blocker,
record the out-of-scope lever and the later stage responsible.

## Verification

If code or tests change, run:

```sh
bun test convex/domain/events/tests/predicted.test.ts
```

Run broader tests if exported signatures or event assembler behavior changes:

```sh
bun test convex/domain/vesselOrchestration/updateEvents/tests
```

Run type checks if exported signatures change:

```sh
bun run type-check
bun run convex:typecheck
```

If no code or test files change, verification may be a blocker-free review
report plus raw LoC confirmation.

## Recommendation

Start by looking for small helper indirection that can be removed without
changing behavior, especially `toArray`, single-use selector helpers, or a row
builder that obscures simple row construction. But be ready to return a no-op
or blocker if the apparent size is mostly the unavoidable cost of mapping trip
ML/ETA fields into the current `eventsPredicted` table shape.

## Worker Result

The Stage 16 worker recommends approving the production edit.

### Pre-Edit Plan

The summed old comparable flow is 119 raw production lines: 62 lines for old
`convex/domain/events/predicted.ts` contracts plus 57 lines for old
`vesselTripPredictionProposalsFromMlTrip.ts` ML proposal projection. Current
`convex/domain/events/predicted.ts` was 381 raw lines before edits, slightly
over the PRD's 3x tripwire.

Keep:

- `predictedDockCompositeKey`, because old code had it and current predicted
  queries, mutations, and trip-merge code use it.
- `buildPredictedDockWriteBatch`, because `eventWriteAssembler` emits
  `eventsPredicted` sparse write batches through it.
- `buildPredictedDockClearBatch`, because `eventWriteAssembler` clears stale
  predicted scopes when schedule or sailing-day identity changes.
- The target-key helper, because write and clear batches must derive exactly
  the same current departure, current arrival, and next departure scope.
- The row-specific helpers and ML selector helpers, because they keep distinct
  ETA/current-arrival/next-departure prerequisites local.

Delete:

- `buildPredictedDockWriteRows`, because it only wrapped a three-step local
  row assembly sequence for one caller.
- `dedupePredictedDockRows`, because the current row builders already emit at
  most one row per composite identity. Duplicate target keys are still deduped
  by `getPredictedBoundaryTargetKeys`, and duplicate incoming rows remain
  deduped in the table mutation.
- `toArray`, because the direct push sequence is clearer than a generic
  nullable-to-array helper.

Expected broken imports: none. No exported signatures change, so no later stage
must repair callers.

### Old-Flow Trace

Old `convex/domain/events/predicted.ts` was a contract module. It defined
prediction types, predicted source types, persisted/write-row/write-batch
shapes, and `predictedDockCompositeKey(row)`.

The nearest old projection flow was
`vesselTripPredictionProposalsFromMlTrip`:

1. Iterate the five ML prediction fields:
   `AtDockDepartCurr`, `AtDockArriveNext`, `AtDockDepartNext`,
   `AtSeaArriveNext`, and `AtSeaDepartNext`.
2. Read the raw trip field value.
3. Skip absent fields and joined/minimal prediction payloads that are not full
   ML predictions.
4. Emit one `vesselTripPredictions` proposal row with vessel, trip key,
   prediction type, and prediction payload.

That old mapper did not build `eventsPredicted` dock rows, did not scope
current departure/current arrival/next departure boundary keys, did not project
WSF ETA, did not build clear batches, and did not copy through already
actualized ML fields.

### Current Flow

Current `eventWriteAssembler` calls `buildPredictedDockWriteBatch` for
prediction-enriched trips and `buildPredictedDockClearBatch` for stale scopes.
Those batches feed the predicted table mutation, which owns sparse
reconciliation and `UpdatedAt` stamping.

`buildPredictedDockWriteBatch` now derives target keys, directly appends the
current departure row, current arrival rows, and next departure row, then
returns the sparse batch. The current projection still differs from old code
because live `eventsPredicted` rows need table-ready dock-boundary rows instead
of old `vesselTripPredictions` proposal rows.

### LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| Old `domain/events/predicted.ts` contracts | 62 | n/a | n/a |
| Old ML proposal mapper | 57 | n/a | n/a |
| Current `domain/events/predicted.ts` | 119 comparable | 381 | 354 |
| Focused prediction test | 68 old proposal test | 262 | 262 |

### Delta Table

| Current addition beyond old comparable flow | Keep/delete | Reason |
| --- | --- | --- |
| `predictedDockCompositeKey` in `domain/events` | Keep | Old code had it, and current predicted queries, mutations, and trip merge callers share the same composite identity. |
| `buildPredictedDockWriteBatch` | Keep | Live `eventWriteAssembler` emits predicted table batches through this helper; old code emitted proposal rows instead of dock-table rows. |
| `buildPredictedDockClearBatch` | Keep | Live current-branch and completed-trip flows clear stale predicted scopes when schedule identity changes. |
| Target-key derivation helper | Keep | Write and clear batches must use the same deduped current departure, current arrival, and next departure scope. |
| Per-boundary row builder helpers | Keep | Each row has different prerequisites and terminal/schedule fields; keeping them local avoids a generic builder mode. |
| Best ML selector helpers | Keep | The AtSea-over-AtDock priority is current product behavior and clearer as two small named selectors than as nested local conditions. |
| `buildPredictedDockWriteRow` copier | Keep | It centralizes optional `Actual` and `DeltaTotal` copy-through for already-actualized ML payloads without affecting WSF ETA rows. |
| `buildPredictedDockWriteRows` wrapper | Delete | It only wrapped a one-call three-step row assembly sequence. |
| `dedupePredictedDockRows` | Delete | Current row builders do not produce duplicate composite identities; table mutation still owns duplicate incoming row reconciliation. |
| `toArray` | Delete | Direct null checks are clearer and shorter than a generic zero-or-one array helper. |
| Focused tests | Keep unchanged | The tests cover target scope, WSF ETA, ML priority, actualization field copy-through, null cases, TripKey fallback, and clear batches. |

### Verification

`bun test convex/domain/events/tests/predicted.test.ts` passed, 11 tests.

Broader updateEvents tests and type checks were not run because no exported
signature or event assembler behavior changed.

### Recommendation

Approve Stage 16. The production file remains longer than the old comparable
flow because it now owns table-row projection that old code did not perform,
but the stage removes avoidable local helper indirection and brings the file
under the 3x comparable-old tripwire without weakening behavior coverage.
