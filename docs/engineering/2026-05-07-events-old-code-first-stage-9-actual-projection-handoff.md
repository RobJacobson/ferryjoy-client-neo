# Events Old-Code-First Stage 9 Actual Projection Handoff

## Forwarding instructions (for the orchestrator owner)

Paste the block below into a new Cursor agent chat (or equivalent). The worker
implements Stage 9; **you** are the reviewer and orchestrator afterward.

````text
You are the implementation worker for Ferry Joy Stage 9 (actual event
projection). Read:

- docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md
- docs/engineering/2026-05-07-events-old-code-first-stage-9-actual-projection-handoff.md

Follow the handoff exactly. Produce the required Stage Report (LoC tables,
delta-justification table, verification commands run). Append the Stage Result
section to this handoff when done.

Do not refactor VesselOrchestrator/updateEvents broadly. Do not touch predicted
projection design or domain/events/predicted.ts reduction (Stage 16 only).
Preserve Stage 5/10 reload and Stage 8 mutation behavior.

Report back with: summary of code changes (or intentional no-op), test output,
typecheck outcome, blocker list if any.

Return the markdown you added to this handoff in your reply so the orchestrator can review.
````

---

## Stage scope

Goal: shrink and clarify the **actual** event projection surface owned by
`convex/domain/events/actual.ts` (sparse write → persisted row), matching the PRD:
start from **`events-old-reference`**, trace behavior (not filenames), keep only
what live callers require.

Approved **write** scope:

- `convex/domain/events/actual.ts`
- Focused tests for actual projection behavior (below)
- `convex/domain/vesselOrchestration/updateEvents/**` **only** for import or
  type adjustments needed to consume a simplified `domain/events/actual` surface
- Minimal type/import cleanup in **direct** callers elsewhere if required by
  the above edits

Inspection scope (read and trace):

- `convex/domain/vesselOrchestration/updateEvents/actualDockWritesFromTrip.ts`
- `convex/domain/vesselOrchestration/updateEvents/eventWriteAssembler.ts`
- `convex/domain/vesselOrchestration/updateEvents/projectEventsFromHandoff.ts`
- `convex/domain/vesselOrchestration/updateEvents/contracts.ts`

Out of scope (do **not** do in Stage 9):

- Broader refactor of `updateEvents`: no file split/merge/restructure beyond what
  is strictly required by import path updates for `actual.ts`
- Predicted projection changes or trimming `domain/events/predicted.ts`
- Changing `persistVesselUpdates` orchestration architecture
- Stage 10 actual static reload / sync reload behavior (if simplification would
  couple reload here, stop and record a **Stage 10 blocker**)

---

## Predicted projection

Frozen. If actual and predicted share a file (`eventWriteAssembler.ts` etc.), at
most **tiny** import/type tweaks required by `actual.ts` edits. No redesign of
predicted batches or clearing logic.

---

## Live-caller invariant

Must preserve:

- VesselOrchestrator / `updateEvents` emits sparse actual rows derived from trips
  and pings as today
- Persistence still calls `upsertActualDockRows` **directly** (Stage 8)
- Stage 8 semantics unchanged
- Stage 5 and Stage 10 reload paths **not** regressed; do not silently fold reload
  concerns into realtime `actual.ts`

Reload code (`convex/domain/events/reload.ts`) uses
`buildActualDockEventFromWrite` and `ConvexActualDockWritePersistable`; retain
compat or document break as Stage 10 if unavoidable.

---

## Old-code benchmark paths

Use **`events-old-reference`** as the benchmark. Inspect (paths may differ or be
missing; trace equivalent behavior):

- `convex/domain/events/actual.ts` (historically type-heavy)
- `convex/domain/timelineRows/buildActualRows.ts` → `buildActualDockEventFromWrite`
  (old home of the normalization logic the current module carries)
- If present:
  `convex/domain/vesselTrips/projection/actualDockWritesFromTrip.ts` and
  `convex/domain/vesselTrips/tests/actualDockWritesFromTrip.test.ts`
- `convex/functions/events/eventsActual/mutations.ts` (persist contract context)

Compare current orchestrator callers listed in scope above.

Record **production** vs **test** raw LoC with `wc -l`; for old equivalents use
`git show events-old-reference:path/to/file | wc -l` when paths exist.

---

## Pre-edit plan rule

If the **actual projection surface being edited** (primarily production
`convex/domain/events/actual.ts` plus any unavoidable boundary edits) stays
greater than **3×** the old baseline for **that same responsibility**, stop and
add a **Pre-edit plan** subsection before edits. The plan must list:

1. Old flow summary and measured LoC
2. Current flow summary and measured LoC
3. Exact functions/types on the **actual** realtime path to keep
4. Reload-only helpers to **defer** to Stage 10 (do not redesign here)
5. Exact imports in `updateEvents` needing migration after `actual.ts` changes
6. Whether any predicted code was touched and why

If under 3×, note that briefly in the Stage Result and omit the formal plan.

---

## Hard acceptance bar (PRD-aligned)

Tiny churn that does not move toward old-code **directness** or LoC parity is not
success. Passing tests alone does not suffice. Prefer fewer helpers when the PRD,
style rule TSDoc cost, and clarity allow.

Acceptable outcomes:

- Meaningful reduction or clarity win in `actual.ts`, or a justified **no-change**
  result documented with LoC parity vs old **`buildActualDockEventFromWrite`**
  responsibility and typed surface

---

## Default editable artifacts

Production:

- `convex/domain/events/actual.ts`

Tests (when behavior or surface changes):

- `convex/domain/events/tests/actual.test.ts`
- `convex/domain/vesselOrchestration/updateEvents/tests/actualDockWritesFromTrip.test.ts`
- `convex/domain/vesselOrchestration/updateEvents/tests/runUpdateVesselEventsFromAssembly.test.ts`
  — only if actual output shape changes demand it

Also update:

- This handoff (Stage Result / LoC sections at bottom)
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

---

## Minimum verification

Run whichever apply after edits:

```sh
bun test convex/domain/vesselOrchestration/updateEvents/tests
bun test convex/domain/events/tests/actual.test.ts
```

If persisted row shape or normalization changes:

```sh
bun test convex/functions/events/eventsActual/tests
```

When the repo is otherwise typecheck-clean:

```sh
bun run convex:typecheck
```

If `convex:typecheck` fails for unrelated incomplete stages, list exact
blockers—**no stubs**.

---

## Stage result

Filled by Stage 9 implementation worker.

**Pre-edit 3× gate:** Not triggered. Before-edit `domain/events/actual.ts` was
**87** lines; old `buildActualDockEventFromWrite` block in
`events-old-reference` `timelineRows/buildActualRows.ts` is **43** lines (lines
62–104), and \(87 < 3 \times 43\).

**Summary:** Inlined anchor resolution into `buildActualDockEventFromWrite`,
restored old three-part `ScheduledDeparture` assignment
(`write.ScheduledDeparture ?? write.EventActualTime ?? anchorMs`) for
bit-for-bit parity with the reference implementation, removed the separate
`getActualDockWriteAnchorMs` helper, and added a regression test for the
runtime guard when both timestamps are missing at runtime. No changes to
`predicted` projection, `updateEvents` structure, or Stage 8 mutation flow; no
`updateEvents` import churn beyond what was already using `domain/events/actual`.

### LoC summary

| Area | Old baseline LoC | Before Stage 9 | After Stage 9 |
| --- | ---: | ---: | ---: |
| `domain/events/actual.ts` prod | 108 | 87 | 78 |
| Focused projection tests | 0 | 186 | 201 |

Old production **108** combines **65** lines from `git show
events-old-reference:convex/domain/events/actual.ts` (contracts only) and **43**
lines for `buildActualDockEventFromWrite` in
`git show events-old-reference:convex/domain/timelineRows/buildActualRows.ts`
(lines 62–104 inclusive). Before/after **focused projection tests** sums
`wc -l` on `convex/domain/events/tests/actual.test.ts` and
`convex/domain/vesselOrchestration/updateEvents/tests/actualDockWritesFromTrip.test.ts`
(old branch had no comparable paths, so baseline **0**).

### Delta justification

| Addition beyond old / current | Keep/delete | Reason |
| --- | --- | --- |
| Single module for contracts + `buildActualDockEventFromWrite` vs split `actual.ts` + `buildActualRows.ts` | Keep | Current layout matches Stage 5 handoff; reload stays in `reload.ts`. |
| `ConvexActualDockEvent` from `functions/events/eventsActual/schemas` vs old inline row type | Keep | Validator alignment; table omits `ScheduleKey` per Stage 6. |
| `ActualDockWriteAnchor` intersection on `ConvexActualDockWritePersistable` | Keep | Stricter than old `as number` anchor; documents ping/reload contract. |
| Explicit throw when anchor timestamps missing | Keep | Replaces unsound cast; covered by test. |
| Inlined anchor branches vs `getActualDockWriteAnchorMs` helper | Keep | Fewer lines, same behavior. |
| Three-part row `ScheduledDeparture` expression | Keep | Matches old `buildActualDockEventFromWrite` expression order. |

### Verification

Commands run; all passed:

- `bun test convex/domain/vesselOrchestration/updateEvents/tests convex/domain/events/tests/actual.test.ts convex/functions/events/eventsActual/tests` — **26** tests
- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`

No blockers.

---

## Recommendation

**Approved by orchestrator.** Stage 9 meets the PRD benchmark for
`buildActualDockEventFromWrite`: smaller `actual.ts`, old three-part
`ScheduledDeparture`, inlined anchor resolution with explicit `undefined` guards,
runtime-guard test, and unchanged `updateEvents` / reload / mutation contracts.
