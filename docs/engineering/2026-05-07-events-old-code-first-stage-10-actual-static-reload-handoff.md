# Events Old-Code-First Stage 10 Actual Static Reload Handoff

## Orchestrator disposition (required reading)

**Stage 10 is not landed.** A first implementation pass was **rejected** by the
owner:

- `convex/domain/events/reload.ts` grew from **1,142 → 1,212** production lines.
  That contradicts the PRD’s old-code-first **size reduction** goal: the largest
  file must not grow for a narrow pipeline-clarity win unless the owner approved
  **before** implementation.
- The pre-edit plan framed a “target” as **accepting a small net increase** in
  `reload.ts`. That is **not** an acceptable Stage 10 target under the PRD.
- Comparing one mega-file to a **hand-summed aggregate** of several old
  `timelineReseed` files is context only; it does **not** justify growing the
  current module.

**Production code from that pass was reverted** to the parent tree. **This
handoff is gate-only until a new plan is approved.**

### What the owner requires next

1. **Plan first, then code** — no `reload.ts` edits until the orchestrator or
   owner approves a written plan.
2. Baseline the **actual reload flow only** on `events-old-reference` (narrow
   trace: what old code did to produce **actual** replace/reconcile semantics),
   not a broad “whole reseed” aggregate used to excuse file growth.
3. The plan must list **exact current functions** to **delete, merge, or
   inline**, **projected prod LoC before/after for `reload.ts`**, **imports that
   break**, and whether to **defer** structural work until **Stages 17–19**
   (holistic sync reduction) keeps the combined builder meanwhile.
4. An **actual-only** entrypoint is optional. If retained, it must be **net
   negative** on `reload.ts` production LoC versus pre-stage **or** ship with an
   explicit **pre-approved** trade (correctness bug or measured performance),
   documented in the plan—not asserted after the fact.

---

## Forwarding instructions (for the orchestrator owner)

Paste the block below into a **new** agent chat after disposition is understood.

````text
You are preparing or implementing Ferry Joy Stage 10 (actual static reload).
Read:

- docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md
- docs/engineering/2026-05-07-events-old-code-first-stage-5-scheduled-reload-handoff.md
- docs/engineering/2026-05-07-events-old-code-first-stage-10-actual-static-reload-handoff.md
  (especially Orchestrator disposition and Hard rules below)

Phase 1 — **Plan only (no convex/ edits):**

- Produce the pre-edit plan sections required in this handoff (narrow old actual
  flow, current call graph, projected `reload.ts` prod LoC after your proposal,
  delete/merge list, import breakers, defer-vs-implement NOW).
- **Do not modify** `convex/**` until the orchestrator or owner replies
  approved.

Phase 2 — **After approval:**

- Implement the approved plan.
- **`reload.ts` production LoC must not increase versus pre-stage unless the
  plan was explicitly approved to allow growth** (justify in Stage Result).

Keep Stage 8 `replaceActualRowsForSailingDay`, Stage 9
`buildActualDockEventFromWrite`, and predicted paths intact. Append Stage Result
when implementation is complete.

Report back with plan (Phase 1) or Diff + tests (Phase 2).
````

---

## Stage scope (PRD stage 10)

**Title:** Actual static reload path, if still required after sync reduction.

The static reload **is required**: internal sync calls domain assembly then
`replaceActualRowsForSailingDay` with `preserveAbsentTripKeys`. Stage 10 must
**shrink or justify** the **actual** slice toward old directness—not grow the
largest domain file without owner pre-approval.

**Primary edit surface (after approved plan):**

- `convex/domain/events/reload.ts`

**Secondary** (thin glue only):

- `convex/functions/events/sync/mutations.ts` — actual reload path only
- `convex/functions/events/sync/loadTripIndexesForSailingDay.ts` — only when the
  plan requires it

**Focused tests:**

- `convex/domain/events/tests/reload.test.ts`
- `convex/functions/events/sync/tests/reloadMutations.test.ts`
- `convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts` when
  replacement semantics move

**Out of scope:**

- Sync actions, cron window, operators, fetch slice builders — Stages **17–19**
  unless the plan obtains owner approval for a minimal exception list
- `domain/events/predicted.ts` (Stage 16)
- `updateEvents` realtime tree (Stage 9 closed)

---

## Hard rules (binding)

| Rule | Detail |
| --- | --- |
| Size | Default outcome: **`reload.ts` prod LoC down** versus stage start. Growth requires **pre-approved** explicit trade in the Phase 1 plan. |
| Plan gate | No production edits until plan is approved (disposition section). |
| Old baseline | Measure **actual-reload-specific** old paths (`git show`, narrow trace); do not use broad multi-file totals as rationale to enlarge `reload.ts`. |
| Dedup | Prefer **replacing** dead or redundant code; **never** Layer a second pipeline that only adds helpers without deleting more than it adds. |
| Holistic deferral | The plan must state clearly if Stage 10 should **defer** structural changes and keep the combined builder until sync stages shrink architecture. |

---

## Live-caller invariants

1. `replaceActualRowsForSailingDay` + `preserveAbsentTripKeys` unchanged in
   externally visible behavior unless the plan argues a bugfix and owns test
   updates.
2. Actual rows produced for reload continue through
   **`buildActualDockEventFromWrite`** only (Stage 9).
3. Prefer keeping scheduled vs actual reload **split** at the mutation boundary
   unless owner pre-approves collapsing.

---

## Pre-edit plan (required content)

Plans must repeat and answer:

1. **Old actual-only flow:** files, functions traced, **`wc -l` per traced file**.
2. **Current actual-only flow:** function names call order, **`wc -l` on
   `reload.ts`** and relevant tests Before.
3. **Target:** **`reload.ts` prod LoC after Phase 2** — must be computed as a number.
4. **Delete / merge / inline:** exact symbols.
5. **Defer:** what waits for Stage 17–19 and exact blockers.
6. Optional actual-only adapter: prove **ΔLoC ≤ 0** on `reload.ts` or flagged
   pre-approved trade.

Orchestrator or owner approves in writing before Phase 2.

---

## Verification (after Phase 2)

```sh
bun test convex/domain/events/tests/reload.test.ts
bun test convex/functions/events/sync/tests/reloadMutations.test.ts
bun test convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts
```

```sh
bun run convex:typecheck
bun run type-check
bun run check
```

---

## Stage result

_Pending. Phase 1: append **Proposed plan** here after owner approval._

### Proposed plan (Phase 1)

_To be filled. No convex/ edits until approved._

### Implementation result (Phase 2)

_To be filled after approved implementation._

---

## Recommendation

Orchestrator: fill after reviewing Phase 1 plan or Phase 2 diff.
