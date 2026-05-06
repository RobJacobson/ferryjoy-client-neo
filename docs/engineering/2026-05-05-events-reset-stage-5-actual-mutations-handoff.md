# Events Reset Stage 5 Actual Mutations Handoff

## Assignment

Complete Stage 5 of the events tables blank-slate refactor: rebuild the
`eventsActual` mutation surface.

This stage should implement sparse actual-row upserts directly in the actual
table module. Keep the work narrowly focused on current actual mutation behavior
and the smallest actual-domain surface needed by live current callers. Do not
pull sync, reload, predicted, scheduled, or planner architecture forward.

## Required Reading

- `docs/engineering/2026-05-05-events-tables-blank-slate-refactor-prd.md`
- `docs/engineering/2026-05-05-events-tables-engineering-memo.md`
- `docs/engineering/2026-05-05-events-reset-stage-2-queries-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-3-scheduled-mutations-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-4-predicted-mutations-handoff.md`
- `.cursor/rules/code-style.mdc`

Pay special attention to the PRD Stage 5 section, the engineering memo rows for
`upsertActualDockRows`, `ConvexActualDockWritePersistable`, and
`buildActualDockEventFromWrite`, and the style guide requirements for module
comments, function TSDoc, const arrow functions, and explicit exports.

## Stage Scope

Implement:

- `convex/functions/events/eventsActual/mutations.ts`
- Focused actual mutation behavior tests under
  `convex/functions/events/eventsActual/tests/`

Allowed only if needed for live current callers:

- `convex/domain/events/actual.ts`
- Import-path-only updates in
  `convex/domain/vesselOrchestration/updateEvents/eventWriteAssembler.ts`
- Import-path-only updates in
  `convex/domain/vesselOrchestration/updateEvents/actualDockWritesFromTrip.ts`
- Focused tests for the minimal actual-domain helper or existing caller tests
  that exercise it.

Allowed only if needed for export wiring:

- `convex/functions/events/eventsActual/index.ts`

Do not implement:

- Static reload actions or sync mutations.
- Full actual reload reconciliation or physical-only reconstruction.
- Nested `convex/domain/events/actual/*` folders.
- Planner modules such as `planActualRows.ts`.
- Public/internal Convex mutation wrappers such as old `projectActualDockWrites`.
- Predicted projection helpers or predicted mutation behavior.
- Scheduled domain helpers.
- Compatibility barrels or generated-path placeholder files.
- Future-stage stubs just to satisfy typecheck.

If `bun run convex:typecheck` remains blocked by missing later-stage APIs, report
the exact missing surfaces instead of creating stubs.

## Required Mutation Surface

Implement and export:

```ts
upsertActualDockRows(
  ctx: MutationCtx,
  rows: ConvexActualDockEvent[]
): Promise<void>
```

Behavior:

- Deduplicate incoming rows by physical `EventKey`.
- If duplicate incoming rows share an `EventKey`, keep the last row.
- For each deduped row, query `eventsActual` with `by_event_key`.
- Use `.unique()` for the physical-key lookup.
- Insert rows that do not already exist.
- Replace rows whose stored data differs from the incoming row.
- Skip unchanged rows so `_id`, `_creationTime`, `UpdatedAt`, and subscriptions
  remain stable.
- Compare actual row fields while ignoring Convex metadata and `UpdatedAt`.
- Keep reconciliation logic in `mutations.ts`; use a small local equality helper
  only if it keeps the mutation readable.

Comparable fields for unchanged-row detection:

- `EventKey`
- `TripKey`
- `EventType`
- `VesselAbbrev`
- `SailingDay`
- `ScheduledDeparture`
- `TerminalAbbrev`
- optional `EventActualTime`
- effective occurrence state from optional `EventOccurred`

Occurrence comparison:

- Treat `EventOccurred: true` as equivalent to an omitted `EventOccurred` when
  `EventActualTime` is present.
- Preserve real differences when the effective occurrence state or
  `EventActualTime` changes.

Use the current Stage 2 schema surface from
`convex/functions/events/eventsActual/schemas.ts`.

## Minimal Actual-Domain Surface

Current live caller imports require actual-domain write normalization. If you
restore this in Stage 5, keep it flat and minimal:

```ts
// convex/domain/events/actual.ts
type ConvexActualDockWritePersistable = ...

buildActualDockEventFromWrite(
  write: ConvexActualDockWritePersistable,
  updatedAt: number
): ConvexActualDockEvent
```

Required behavior for `buildActualDockEventFromWrite`:

- Build `EventKey` from `TripKey` and `EventType` when `EventKey` is omitted.
- Preserve a provided `EventKey`.
- Derive `SailingDay` from the available anchor timestamp when omitted.
- Use `EventActualTime` as the primary anchor when present.
- Fall back to `ScheduledDeparture` when `EventActualTime` is omitted.
- Fill `ScheduledDeparture` from `EventActualTime` when
  `ScheduledDeparture` is omitted.
- Set `EventOccurred: true`.
- Stamp the provided `updatedAt`.

Keep only the sparse-write types and helper required by current callers. Do not
port actual reload, hydration, binding, or reconciliation helpers in this stage.
Prefer updating current imports to the flat `domain/events/actual` module over
recreating nested `domain/events/actual/types` files.

## Reload Boundary

Stage 5 should not implement static reload orchestration. The physical-only
actual preservation behavior remains required for the overall PRD, but it should
be handled when the sync/reload stage introduces a live reload path.

If you find a live production caller that requires reload-specific actual
behavior now, stop and report the exact caller and required surface instead of
recreating the current nested reload tree.

## Reference Files

Inspect behavior with `git show`, but do not port files wholesale:

- `events-current-reference:convex/functions/events/eventsActual/mutations.ts`
- `events-current-reference:convex/functions/events/eventsActual/planActualRows.ts`
- `events-current-reference:convex/functions/events/eventsActual/tests/planActualRows.test.ts`
- `events-current-reference:convex/domain/events/actual/types.ts`
- `events-current-reference:convex/domain/events/actual/buildActualDockEvents.ts`
- `events-current-reference:convex/domain/events/actual/actualDockWriteHelpers.ts`
- `events-old-reference:convex/functions/events/eventsActual/mutations.ts`

The old reference is useful for direct table-local shape. The current reference
is useful for required behavior and minimal domain-helper semantics. Neither
reference should force planner or nested domain files.

## Test Guidance

Add or rewrite focused behavior tests for `upsertActualDockRows`.

Cover:

- The mutation reads existing rows with `by_event_key`.
- The lookup uses `.unique()`.
- Incoming duplicates keep the last row for an `EventKey`.
- Missing rows are inserted.
- Changed rows are replaced.
- Unchanged rows are skipped.
- Convex metadata and `UpdatedAt` do not affect equality.
- Optional `EventActualTime` changes are detected.
- Effective `EventOccurred` comparison handles omitted versus true consistently.

If you implement `buildActualDockEventFromWrite`, cover:

- EventKey derivation and preservation.
- SailingDay derivation from actual or scheduled anchor.
- ScheduledDeparture fallback from EventActualTime.
- `EventOccurred: true` and `UpdatedAt` stamping.

Prefer direct mock `MutationCtx` objects that record `query`, `insert`, and
`replace` calls. Tests may import `mutations.ts` directly; do not widen barrels
only for tests.

Do not preserve tests that only assert planner-helper shape. Preserve behavior,
not the old decomposition.

## Verification Gate

Run:

- The focused actual mutation tests you add or update.
- Existing actual query tests if your change touches actual exports.
- Focused actual-domain or current caller tests if you implement the flat
  actual-domain helper.
- `bun run convex:typecheck` only if the current branch has enough restored API
  surface for useful signal.

If typecheck fails because later stages are still missing sync, reload,
predicted projection, or scheduled-domain surfaces, report those blockers
exactly. Do not create future-stage stubs.

Before finishing, report:

- Files changed.
- Reference files inspected.
- Tests run and results.
- Whether `bun run convex:typecheck` was meaningful and what blocked it, if
  anything.
- Any intentional exceptions to the PRD or style guide.
