# Events Reset Stage 4 Predicted Mutations Handoff

## Assignment

Complete Stage 4 of the events tables blank-slate refactor: rebuild the
`eventsPredicted` mutation surface.

This stage should implement sparse predicted-row reconciliation directly in the
predicted table module. Keep the work narrowly focused on predicted mutation
behavior and depart-next actualization. Do not pull projection, sync, reload,
actual, scheduled, or planner architecture forward.

## Required Reading

- `docs/engineering/2026-05-05-events-tables-blank-slate-refactor-prd.md`
- `docs/engineering/2026-05-05-events-tables-engineering-memo.md`
- `docs/engineering/2026-05-05-events-reset-stage-2-queries-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-3-scheduled-mutations-handoff.md`
- `.cursor/rules/code-style.mdc`

Pay special attention to the PRD Stage 4 section, the engineering memo rows for
`upsertPredictedDockBatches`, `patchDepartNextMlRowsForDepBoundary`, and
`predictedDockCompositeKey`, and the style guide requirements for module
comments, function TSDoc, const arrow functions, and explicit exports.

## Stage Scope

Implement:

- `convex/functions/events/eventsPredicted/mutations.ts`
- Focused predicted mutation behavior tests under
  `convex/functions/events/eventsPredicted/tests/`

Allowed only if needed for export wiring:

- `convex/functions/events/eventsPredicted/index.ts`

Use the existing flat helper:

- `convex/domain/events/predicted.ts`

Do not implement:

- Predicted DTO projection helpers such as `buildPredictedDockWriteBatch` or
  `buildPredictedDockClearBatch`.
- Nested `convex/domain/events/predicted/*` folders.
- Planner modules such as `planPredictedDockBatches.ts` or
  `reconcilePredictedDockBatches.ts`.
- Public/internal Convex mutation wrappers such as old
  `projectPredictedDockWriteBatches`.
- `sync/` actions or mutations.
- Reload schemas or reload helpers.
- `eventsActual` mutation, domain, or reload behavior.
- Scheduled domain helpers.
- Compatibility barrels or generated-path placeholder files.
- Future-stage stubs just to satisfy typecheck.

If `bun run convex:typecheck` remains blocked by missing later-stage APIs, report
the exact missing surfaces instead of creating stubs.

## Required Mutation Surface

Implement and export:

```ts
upsertPredictedDockBatches(
  ctx: MutationCtx,
  batches: ReadonlyArray<{
    VesselAbbrev: string;
    SailingDay: string;
    TargetKeys: string[];
    Rows: ConvexPredictedDockWriteRow[];
  }>
): Promise<void>
```

Implement and export:

```ts
patchDepartNextMlRowsForDepBoundary(
  ctx: MutationCtx,
  depKey: string,
  actualMs: number
): Promise<boolean>
```

Export these through `eventsPredicted/index.ts` only if that is needed by
current imports or generated API shape. Do not add unrelated exports.

## `upsertPredictedDockBatches` Behavior

Batch merge:

- Merge incoming batches by vessel and sailing day.
- Use `buildVesselSailingDayScopeKey` from `shared/keys` or an equivalent local
  scope key.
- Union `TargetKeys` across batches in the same scope.
- Deduplicate incoming rows by the existing `predictedDockCompositeKey` helper.
- If duplicate composite rows appear, the later row should win.
- Skip merged scopes with no targeted keys.

Scope loading:

- For each merged scope with targeted keys, query `eventsPredicted` with
  `by_vessel_and_sailing_day`.
- Load each merged vessel/day scope once.

Targeted reconciliation:

- Reconcile only rows whose `Key` is in the merged `TargetKeys`.
- Do not delete, insert, or replace incoming rows whose `Key` is outside
  `TargetKeys`.
- Delete existing targeted rows whose composite key is absent from incoming rows,
  except for the depart-next ML preservation rule below.
- Insert missing incoming rows.
- Replace changed incoming rows.
- Skip unchanged incoming rows.
- Inserted and replaced rows should include a fresh `UpdatedAt` timestamp.
- Unchanged-row comparison should ignore Convex metadata and ignore `UpdatedAt`,
  so a fresh timestamp alone does not cause churn.

Comparable fields for unchanged-row detection:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `EventPredictedTime`
- `PredictionType`
- `PredictionSource`
- optional `Actual`
- optional `DeltaTotal`

Depart-next ML preservation:

- Preserve omitted existing ML rows with `PredictionType` of
  `AtDockDepartNext` or `AtSeaDepartNext` when the incoming scope does not
  include a replacement row for the same `Key` and `PredictionSource`.
- Delete stale depart-next ML rows when an incoming row for the same `Key` and
  `PredictionSource` exists but the specific composite is omitted. This preserves
  the current at-dock to at-sea replacement behavior.

## `patchDepartNextMlRowsForDepBoundary` Behavior

- Query `eventsPredicted` with `by_key_type_and_source`.
- For the provided `depKey`, look up both ML prediction types:
  `AtDockDepartNext` and `AtSeaDepartNext`.
- Use `PredictionSource` of `"ml"`.
- Skip missing rows.
- Skip rows that already have `Actual`.
- Patch rows with:
  - `Actual: actualMs`
  - `DeltaTotal: getRoundedMinutesDelta(existing.EventPredictedTime, actualMs)`
- Return `true` if at least one row was patched.
- Return `false` if no rows were patched.

## Reference Files

Inspect behavior with `git show`, but do not port files wholesale:

- `events-current-reference:convex/functions/events/eventsPredicted/mutations.ts`
- `events-current-reference:convex/domain/events/predicted/reconcilePredictedDockBatches.ts`
- `events-current-reference:convex/domain/events/predicted/departNextActualization.ts`
- `events-current-reference:convex/functions/events/eventsPredicted/tests/mutations.test.ts`
- `events-current-reference:convex/functions/events/eventsPredicted/tests/patchDepartNextMlRowsForDepBoundary.test.ts`
- `events-old-reference:convex/functions/events/eventsPredicted/mutations.ts`

The old reference is useful for direct table-local shape. The current reference
is useful for required behavior, especially depart-next preservation. Neither
reference should force planner or nested domain files.

## Test Guidance

Add or rewrite focused behavior tests for the two exported mutation helpers.

Cover `upsertPredictedDockBatches`:

- Merged scopes load with `by_vessel_and_sailing_day`.
- Duplicate vessel/day scopes are loaded once.
- Target keys are unioned across batches.
- Duplicate composite rows keep the later row.
- Stale targeted rows are deleted.
- Existing rows outside `TargetKeys` are left alone.
- Incoming rows outside `TargetKeys` are ignored.
- Missing incoming rows are inserted with `UpdatedAt`.
- Changed rows are replaced with `UpdatedAt`.
- Unchanged rows are skipped even though a fresh `UpdatedAt` is available.
- Depart-next ML rows are preserved during target-key clearing when no incoming
  same-key/source row is present.
- Stale at-dock depart-next rows are deleted when a same-key/source at-sea row
  arrives.

Cover `patchDepartNextMlRowsForDepBoundary`:

- Both depart-next ML rows are queried with `by_key_type_and_source`.
- Both rows are patched when present and not already actualized.
- `DeltaTotal` uses rounded minute delta.
- Already actualized rows are skipped.
- Missing rows are skipped.
- The returned boolean reflects whether any patch occurred.

Prefer direct mock `MutationCtx` objects that record `query`, `delete`,
`insert`, `replace`, and `patch` calls. Tests may import `mutations.ts` directly;
do not widen barrels only for tests.

Do not preserve tests that only assert planner-helper shape. Preserve behavior,
not the old decomposition.

## Verification Gate

Run:

- The focused predicted mutation tests you add or update.
- Existing predicted query tests if your change touches predicted exports.
- Scheduled tests only if you touch shared predicted helpers in a way that could
  affect grouped prediction loading.
- `bun run convex:typecheck` only if the current branch has enough restored API
  surface for useful signal.

If typecheck fails because later stages are still missing actual, sync, reload,
or scheduled-domain surfaces, report those blockers exactly. Do not create
future-stage stubs.

Before finishing, report:

- Files changed.
- Reference files inspected.
- Tests run and results.
- Whether `bun run convex:typecheck` was meaningful and what blocked it, if
  anything.
- Any intentional exceptions to the PRD or style guide.
