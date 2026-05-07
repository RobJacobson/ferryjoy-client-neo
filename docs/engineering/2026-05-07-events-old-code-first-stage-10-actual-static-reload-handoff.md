# Events Old-Code-First Stage 10 Actual Static Reload Handoff

## Forwarding instructions (for the orchestrator owner)

Paste the block below into a new Cursor agent chat (or equivalent). The worker
implements Stage 10; **you** review and commit afterward.

````text
You are the implementation worker for Ferry Joy Stage 10 (actual static
reload path). Read:

- docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md
- docs/engineering/2026-05-07-events-old-code-first-stage-5-scheduled-reload-handoff.md
- docs/engineering/2026-05-07-events-old-code-first-stage-10-actual-static-reload-handoff.md

Follow the handoff exactly. Produce the PRD Required Stage Report (LoC, delta
justification table, old vs current vs after). Append the Stage Result section
when done.

Broad sync action/window architecture is out of scope (Stages 17–19). Predicted
projection is out of scope (Stage 16). Do not weaken Stage 8
`replaceActualRowsForSailingDay` or Stage 9 `buildActualDockEventFromWrite`
contracts.

Report back with file list, tests run, typecheck outcome, and blockers. Return
your filled Stage Result markdown in the reply for orchestrator review.
````

---

## Stage scope (PRD stage 10)

**Title:** Actual static reload path, if still required after sync reduction.

The static reload **is required** today: internal sync mutations call domain
reload assembly then `replaceActualRowsForSailingDay` with
`preserveAbsentTripKeys`. Stage 10 re-derives this **actual** slice from
`events-old-reference` timeline reseed behavior and shrinks it toward old
directness without losing live-caller semantics.

Approved **primary** edit surface:

- `convex/domain/events/reload.ts` (currently very large; expect a **mandatory**
  pre-edit plan per PRD and the section below)

Approved **secondary** surface (thin wrappers and glue only):

- `convex/functions/events/sync/mutations.ts` — actual reload internal mutation
  path (`reloadActualDockEventsForSailingDay*`) and validators it owns
- `convex/functions/events/sync/loadTripIndexesForSailingDay.ts` — only when
  required to simplify `reload.ts` call pattern
- Focused tests:
  - `convex/domain/events/tests/reload.test.ts`
  - `convex/functions/events/sync/tests/reloadMutations.test.ts`
  - `convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts`
    when row shape or replacement semantics are at risk

**Out of scope for Stage 10**

- Sync **actions**, window runners, cron boundary, operator actions, fetch slice
  builders, and reload schema shape refactors (`reloadDockEventsForSailingDay.ts`,
  `reloadDockEventsWindow.ts`, `buildConvexReloadDockDataFromFetchedSlices.ts`,
  `fetchHistoryRecordsForDate.ts`, etc.) except **minimal** type/import fixes
  required by `reload.ts` signature changes—if that explodes scope, stop and file
  a **Stage 17–19 blocker** instead
- `domain/events/predicted.ts` and predicted projection (Stage 16)
- Orchestrator realtime `updateEvents` tree (Stage 9 boundary is closed)
- Re-adding `ScheduleKey` onto persisted `eventsActual` rows (Stage 6)

---

## Live-caller invariants

1. **Replace contract:** `replaceActualRowsForSailingDay` must still delete stale
   schedule-aligned same-day rows and **preserve absent physical-only** rows via
   `preserveAbsentTripKeys` (Stage 5 + Stage 8).
2. **Normalization:** Actual rows built for reload must still flow through
   `buildActualDockEventFromWrite` from `domain/events/actual.ts` (Stage 9); do
   not duplicate that normalization in reload helpers.
3. **Split mutations:** Sync layer keeps scheduled vs actual reload split at the
   mutation boundary unless the owner pre-approves collapsing (default: **keep
   split**).

---

## Old-code benchmark

Use **`events-old-reference`**. Stage 5 already mapped the old system under:

- `convex/domain/timelineReseed/*` (especially hydrate, merge, reconcile, slice
  build paths that feed **actual** dock rows)
- `convex/functions/vesselTimeline/*` reseed entrypoints

For Stage 10, trace **only** the old flow that produced **actual** reload/replace
semantics (history merge, live location reconcile, physical-only preservation),
not the entire timeline product surface.

Measure raw LoC with `wc -l` and `git show events-old-reference:… | wc -l`.
Behavior matters more than file name parity.

---

## Pre-edit plan (required)

`convex/domain/events/reload.ts` is on the order of **1,100+** production lines,
well above the PRD **3×** threshold versus any old single-file responsibility.

**No implementation edits** to `reload.ts` (or sync glue) until the worker posts
an approved pre-edit plan in this handoff (or in the Stage Result) that includes:

1. Old flow summary + measured LoC for the **actual reload** responsibility
2. Current flow summary + measured LoC (prod and tests **separately**)
3. Target LoC range for Stage 10
4. Functions/types to **keep** (exact names)
5. Functions/types to **delete** or **defer** (e.g. to Stages 17–19) with
   import breaker list
6. Risk note for **scheduled** row construction that lives in the same module:
   prefer isolating actual-path edits; if coupling forbids, document the smallest
   shared change

The orchestrator or owner approves the plan before the worker edits production
code.

---

## Verification bar (minimum)

After edits:

```sh
bun test convex/domain/events/tests/reload.test.ts
bun test convex/functions/events/sync/tests/reloadMutations.test.ts
bun test convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts
```

When the branch is otherwise clean:

```sh
bun run convex:typecheck
bun run type-check
bun run check
```

If broader checks fail for unrelated future-stage work, list exact blockers—**no
stubs**.

---

## Default editable artifacts

Production (after plan approval):

- `convex/domain/events/reload.ts`
- `convex/functions/events/sync/mutations.ts` (actual reload path only)
- `convex/functions/events/sync/loadTripIndexesForSailingDay.ts` (only if needed)

Tests:

- `convex/domain/events/tests/reload.test.ts`
- `convex/functions/events/sync/tests/reloadMutations.test.ts`
- `convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts` if
  needed

Documentation:

- This handoff (Stage Result)
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

---

## Stage result

_To be filled by the implementation worker._

### Pre-edit plan

_To be filled before code edits; mandatory for this stage._

### LoC summary

| Area | Old baseline LoC | Before Stage 10 | After Stage 10 |
| --- | ---: | ---: | ---: |
| Actual reload prod (name paths) | — | — | — |
| Focused tests | — | — | — |

### Delta justification

| Addition beyond old / current | Keep/delete | Reason |
| --- | --- | --- |

### Verification

_Commands and outcomes._

---

## Recommendation

_Orchestrator: fill after independent review._
