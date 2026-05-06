# Events Reset Stage 3 Scheduled Mutations Handoff

## Assignment

Complete Stage 3 of the events tables blank-slate refactor: rebuild the
`eventsScheduled` mutation surface.

This stage should implement full-day scheduled-row replacement directly in the
scheduled table module. Keep the work narrowly focused on scheduled mutation
behavior and do not pull scheduled domain, sync, reload, actual, or predicted
architecture forward.

## Required Reading

- `docs/engineering/2026-05-05-events-tables-blank-slate-refactor-prd.md`
- `docs/engineering/2026-05-05-events-tables-engineering-memo.md`
- `docs/engineering/2026-05-05-events-reset-stage-2-queries-handoff.md`
- `.cursor/rules/code-style.mdc`

Pay special attention to the PRD Stage 3 section, the engineering memo row for
`upsertScheduledRowsForSailingDay`, and the style guide requirements for module
comments, function TSDoc, const arrow functions, and explicit exports.

## Stage Scope

Implement:

- `convex/functions/events/eventsScheduled/mutations.ts`
- Focused scheduled mutation behavior tests under
  `convex/functions/events/eventsScheduled/tests/`

Allowed only if needed for export wiring:

- `convex/functions/events/eventsScheduled/index.ts`

Do not implement:

- Scheduled domain helpers such as `inferScheduledSegmentFromDepartureEvent`,
  `findNextDepartureEvent`, or `ConvexInferredScheduledSegment`.
- Scheduled row construction from schedule adapter segments.
- `sync/` actions or mutations.
- Reload schemas or reload helpers.
- `eventsActual` mutation, domain, or reload behavior.
- `eventsPredicted` mutation, projection, or patch behavior.
- Compatibility barrels or generated-path placeholder files.
- Planner modules such as `planScheduledRowsForSailingDay.ts`.
- Future-stage stubs just to satisfy typecheck.

If `bun run convex:typecheck` remains blocked by missing later-stage APIs, report
the exact missing surfaces instead of creating stubs.

## Required Mutation Surface

Implement and export:

```ts
upsertScheduledRowsForSailingDay(
  ctx: MutationCtx,
  SailingDay: string,
  nextRows: ConvexScheduledDockEvent[]
): Promise<void>
```

Behavior:

- Query `eventsScheduled` with `by_sailing_day`.
- Treat `nextRows` as the complete replacement slice for the provided
  `SailingDay`.
- Delete existing rows whose `Key` is absent from `nextRows`.
- Insert rows whose `Key` is not already stored.
- Replace rows whose stored data differs from the incoming row.
- Skip unchanged rows so `_id`, `_creationTime`, and subscriptions remain stable.
- Compare scheduled row fields while ignoring Convex metadata.
- Keep reconciliation logic in `mutations.ts`; use a small local equality helper
  only if it keeps the mutation readable.

Expected comparable fields:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `UpdatedAt`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `NextTerminalAbbrev`
- `EventType`
- optional `EventScheduledTime`
- optional `IsLastArrivalOfSailingDay`

Use the current Stage 2 schema surface from
`convex/functions/events/eventsScheduled/schemas.ts`.

## Reference Files

Inspect behavior with `git show`, but do not port files wholesale:

- `events-current-reference:convex/functions/events/eventsScheduled/mutations.ts`
- `events-current-reference:convex/functions/events/eventsScheduled/planScheduledRowsForSailingDay.ts`
- `events-current-reference:convex/functions/events/eventsScheduled/tests/planScheduledRowsForSailingDay.test.ts`
- `events-old-reference:convex/functions/events/eventsScheduled/mutations.ts`

The old reference is useful for direct table-local shape. The current reference
is useful for required behavior. Neither reference should force a planner file.

## Test Guidance

Add or rewrite focused behavior tests for `upsertScheduledRowsForSailingDay`.

Cover:

- The mutation reads existing rows with `by_sailing_day`.
- Rows absent from `nextRows` are deleted.
- New rows are inserted.
- Changed rows are replaced.
- Unchanged rows are skipped.
- Convex metadata does not affect equality.
- Optional fields are compared consistently, including
  `IsLastArrivalOfSailingDay`.

Prefer a direct mock `MutationCtx` that records `query`, `delete`, `insert`, and
`replace` calls. Tests may import `mutations.ts` directly; do not widen barrels
only for tests.

Do not preserve tests that only assert planner-helper shape. Preserve behavior,
not the old decomposition.

## Verification Gate

Run:

- The focused scheduled mutation tests you add or update.
- Existing scheduled query tests if your change touches scheduled exports.
- `bun run convex:typecheck` only if the current branch has enough restored API
  surface for useful signal.

If typecheck fails because later stages are still missing mutation, sync, or
domain surfaces, report those blockers exactly. Do not create future-stage stubs.

Before finishing, report:

- Files changed.
- Reference files inspected.
- Tests run and results.
- Whether `bun run convex:typecheck` was meaningful and what blocked it, if
  anything.
- Any intentional exceptions to the PRD or style guide.
