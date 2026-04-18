# Handoff: Step C — Remove `createVesselOrchestratorTickDeps` (factory cleanup)

**Date:** 2026-04-17  
**Audience:** Implementing agent  
**Parent plan:** [`docs/engineering/vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md) — **Step C**

---

## 1. Objective

Remove [`createVesselOrchestratorTickDeps.ts`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts) from the codebase. Production **already** does not use it: [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts) calls only [`executeVesselOrchestratorTick`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts). The factory exists for **historical wiring** and for **tests** that still call domain [`runVesselOrchestratorTick`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts) with injected `VesselOrchestratorTickDeps`.

**Non-goals for this step**

- **Step D/E** (delete `runVesselOrchestratorTick`, move types, rewrite domain tests) — out of scope unless you discover a hard blocker.
- **Step G** (import-boundary cleanup) — optional follow-up; do not expand scope unless trivial.

**Behavior must not change:** Same Convex mutations/queries, same branch structure, same parity between `executeVesselOrchestratorTick` and `runVesselOrchestratorTick` + deps.

---

## 2. Current state (facts to rely on)

### 2.1 Production path

- [`executeVesselOrchestratorTick.ts`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts) **inlines** all three effects:
  - **Locations:** `runUpdateVesselLocationsTick` + `ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, …)`.
  - **Trips:** `createDefaultProcessVesselTripsDeps(createScheduledSegmentLookup(ctx), createVesselTripPredictionModelAccess(ctx))` then `runProcessVesselTripsTick(…)`.
  - **Timeline:** `applyTickEventWrites(ctx, tripResult.tickEventWrites)` inside the trip branch after `runProcessVesselTripsTick`.

This matches the body of `createVesselOrchestratorTickDeps` today: the factory is **duplicative** of `executeVesselOrchestratorTick`’s wiring, not a separate behavior.

### 2.2 Remaining consumers of the factory

| Consumer | Purpose |
| --- | --- |
| [`tests/createVesselOrchestratorTickDeps.test.ts`](../../convex/functions/vesselOrchestrator/tests/createVesselOrchestratorTickDeps.test.ts) | Smoke test: deps object has three functions. |
| [`tests/executeVesselOrchestratorTick.parity.test.ts`](../../convex/functions/vesselOrchestrator/tests/executeVesselOrchestratorTick.parity.test.ts) | Compares `runVesselOrchestratorTick(input, createVesselOrchestratorTickDeps(ctx))` vs `executeVesselOrchestratorTick(ctx, input)`. |

No `actions.ts` import. Grep the repo after edits for `createVesselOrchestratorTickDeps` — **docs and comments** still mention it widely (see §5).

### 2.3 Generated Convex API

[`convex/_generated/api.d.ts`](../../convex/_generated/api.d.ts) references the module path `functions/vesselOrchestrator/createVesselOrchestratorTickDeps`. After deleting the source file, **regenerate** Convex artifacts (see §6) so generated types update; **do not** hand-edit `_generated/*`.

---

## 3. Recommended implementation strategy

### 3.1 Keep parity tests green (domain branch)

[`runVesselOrchestratorTick`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts) still takes `VesselOrchestratorTickDeps`. Parity tests **must** keep building **equivalent** deps to what production wiring used, or parity is meaningless.

**Pick one approach (A preferred):**

- **A — Test-local helper module (recommended)**  
  Add something like  
  `convex/functions/vesselOrchestrator/tests/vesselOrchestratorTickDepsFromCtx.ts`  
  (name is flexible) that exports **one** function, e.g.  
  `vesselOrchestratorTickDepsFromCtx(ctx: ActionCtx): VesselOrchestratorTickDeps`,  
  with **the same implementation** as today’s `createVesselOrchestratorTickDeps` (same imports and closures).  
  - **Only** import this from `executeVesselOrchestratorTick.parity.test.ts` (and from a merged smoke test if you keep one).  
  - **Do not** export it from any `index.ts` or production entry — it exists to support **domain runner parity until Step D** removes `runVesselOrchestratorTick`.

- **B — Inline in `parity.test.ts`**  
  Duplicate the factory body inside the test file as a private function. Works; worse DRY if the file grows.

**Optional DRY with production:** The memo allows a tiny **`createTripBranchDeps(ctx)`**-style helper **only** for `ProcessVesselTripsDeps` + `runProcessVesselTripsTick` wiring. That would dedupe `executeVesselOrchestratorTick` and the test helper **if** you choose to extract it; it is **not** required for Step C. If you extract, keep it **functions-layer**, no new domain callback types.

### 3.2 Smoke test file

[`createVesselOrchestratorTickDeps.test.ts`](../../convex/functions/vesselOrchestrator/tests/createVesselOrchestratorTickDeps.test.ts) only asserts three callables exist.

**Preferred:** **Delete** this file and fold a **single** minimal assertion into parity setup (e.g. after building deps from the test helper, `expect` the three keys are functions) **or** one `describe` block in `parity.test.ts` that only checks deps shape.

**Acceptable:** Keep a tiny `*.test.ts` that imports the **new test helper** (not a production module named `createVesselOrchestratorTickDeps`).

### 3.3 Delete the factory module

Remove [`createVesselOrchestratorTickDeps.ts`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts) after call sites use the test helper or inlined code.

---

## 4. Code and TSDoc to update in this PR

Minimum set:

| Area | Change |
| --- | --- |
| [`executeVesselOrchestratorTick.ts`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts) | TSDoc still says parity with `createVesselOrchestratorTickDeps(ctx)` — rephrase to **domain** `runVesselOrchestratorTick` with **equivalent** Convex-backed deps (no link to deleted symbol). |
| [`applyTickEventWrites.ts`](../../convex/functions/vesselOrchestrator/applyTickEventWrites.ts) | Remove or replace `{@link createVesselOrchestratorTickDeps}`; describe call sites: `executeVesselOrchestratorTick` trip branch and any test helper. |
| [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) | Diagrams and file list still describe the factory — update to **execute**-first narrative; drop or relocate smoke-test path. |

Optional in Step C (small doc fixes if quick):

- [`convex/functions/vesselTrips/queries.ts`](../../convex/functions/vesselTrips/queries.ts) — TSDoc mention of factory.
- [`convex/domain/vesselOrchestration/updateVesselTrips/index.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/index.ts) — top comment referencing `createVesselOrchestratorTickDeps` (say **execute** + `runProcessVesselTripsTick` wiring or “functions layer” without the old filename).

Larger doc trees (`architecture.md`, `updateTimeline/README.md`, ML readme, old handoffs) can be **batch-updated in Step F** per the memo; at least **don’t leave** `functions/vesselOrchestrator` README wrong.

---

## 5. Grep checklist (before merge)

```bash
rg "createVesselOrchestratorTickDeps" --glob "*.ts" --glob "*.tsx"
rg "createVesselOrchestratorTickDeps" convex/
```

Expect **no** remaining imports of the deleted module. Residual mentions in **markdown** outside this PR are acceptable if tracked for Step F; **TypeScript** and **Convex runtime** must be clean.

---

## 6. Verification (required)

From repo root (use **Bun** per project convention):

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
```

Run tests touching orchestrator:

```bash
bun test convex/functions/vesselOrchestrator
```

Regenerate Convex codegen if your workflow requires it after deleting a `convex/functions/**` file (e.g. `npx convex dev` once or the project’s codegen script) so `_generated/api.d.ts` matches the filesystem.

---

## 7. Success criteria

- [ ] `createVesselOrchestratorTickDeps.ts` is **removed**.
- [ ] No production or test code imports the removed path.
- [ ] Parity tests still pass: `executeVesselOrchestratorTick` vs `runVesselOrchestratorTick` + deps built with **same** wiring as before.
- [ ] Smoke coverage for “deps has three functions” is **preserved or intentionally replaced** by an equivalent assertion.
- [ ] `executeVesselOrchestratorTick` / `applyTickEventWrites` / orchestrator **README** no longer describe the deleted factory as the primary wiring story.
- [ ] `check:fix`, `type-check`, `convex:typecheck`, and targeted `bun test` pass.

---

## 8. Relationship to later steps

- **Step D** removes `runVesselOrchestratorTick` and `VesselOrchestratorTickDeps` from domain; the **test helper** from §3.1 becomes **deleteable** when parity no longer needs the domain runner.
- **Step G** may then simplify imports in `executeVesselOrchestratorTick` (peer `index.ts` only) — separate PR.

---

## Document history

- **2026-04-17:** Initial handoff for Step C implementation.
