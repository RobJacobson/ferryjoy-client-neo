# Handoff: Step B — Wire `updateVesselOrchestrator` to `executeVesselOrchestratorTick`

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Parent plan:** [`docs/engineering/vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md) — **§3 Step B**

**Prerequisite:** Step A complete — [`executeVesselOrchestratorTick`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts)
exists and matches [`runVesselOrchestratorTick`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts)
semantics (parity tests optional but recommended).

---

## Goal (Step B only)

Switch **production** orchestration so the internal action calls **`executeVesselOrchestratorTick(ctx, input)`** instead of **`runVesselOrchestratorTick(input, createVesselOrchestratorTickDeps(ctx))`**.

Return type and action behavior (fetch → read model → tick) stay the same unless a bug is discovered.

---

## Scope

### In scope

1. **[`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)**
   - **Remove** imports of `runVesselOrchestratorTick` from `domain/vesselOrchestration` and **`createVesselOrchestratorTickDeps`** from `./createVesselOrchestratorTickDeps`.
   - **Add** import of `executeVesselOrchestratorTick` from `./executeVesselOrchestratorTick`.
   - **Keep** `VesselOrchestratorTickResult` (and any other types) from `domain/vesselOrchestration/types` **via** the domain barrel **or** import types from `domain/vesselOrchestration/types` — whichever matches project style; no behavior change.
   - **Replace** the handler return:

     ```ts
     return runVesselOrchestratorTick(
       { convexLocations, passengerTerminalAbbrevs, tickStartedAt, activeTrips },
       createVesselOrchestratorTickDeps(ctx)
     );
     ```

     with:

     ```ts
     return executeVesselOrchestratorTick(ctx, {
       convexLocations,
       passengerTerminalAbbrevs,
       tickStartedAt,
       activeTrips,
     });
     ```

2. **TSDoc** on `updateVesselOrchestrator` — Update the module and handler comments so they describe **`executeVesselOrchestratorTick`** and the four concerns **without** claiming the domain file orchestrates the tick. Point to `executeVesselOrchestratorTick` for the parallel/sequential structure.

3. **[`executeVesselOrchestratorTick.ts`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts)** — Update the file header comment: remove “Production still uses `runVesselOrchestratorTick` … until Step B” and state that production uses this module via `actions.ts`.

### Out of scope (later steps)

- **Step C:** Delete or shrink [`createVesselOrchestratorTickDeps.ts`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts) (factory may remain **unused** in production after Step B until Step C removes it).
- **Step D:** Delete domain [`runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts) and [`VesselOrchestratorTickDeps`](../../convex/domain/vesselOrchestration/types.ts).
- **Step E:** Move [`runVesselOrchestratorTick.test.ts`](../../convex/domain/vesselOrchestration/tests/runVesselOrchestratorTick.test.ts) to functions tests.
- **Step F:** Full documentation sweep across READMEs.

You **may** land Step B without Step C in the same PR; if so, expect **dead code** (`createVesselOrchestratorTickDeps` only referenced by parity tests and its smoke test) until Step C.

---

## Tests and verification

**Required after edits:**

- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`
- `bun test` for `convex/functions/vesselOrchestrator` (and any domain tests still run).

**Manual / sanity:**

- Grep `actions.ts` — no remaining `runVesselOrchestratorTick` or `createVesselOrchestratorTickDeps`.

**Parity tests:** [`executeVesselOrchestratorTick.parity.test.ts`](../../convex/functions/vesselOrchestrator/tests/executeVesselOrchestratorTick.parity.test.ts)
may still compare domain+factory vs `executeVesselOrchestratorTick`; that remains valid until Step D removes the domain entry. No change **required** for Step B unless imports break.

---

## Definition of done

- [ ] `updateVesselOrchestrator` returns **`executeVesselOrchestratorTick(ctx, input)`** with the same input object shape as today.
- [ ] No production path from `actions.ts` to `runVesselOrchestratorTick` or `createVesselOrchestratorTickDeps`.
- [ ] Tooling green: `check:fix`, `type-check`, `convex:typecheck`, relevant tests.
- [ ] PR description notes: “Step B only; factory/domain tick cleanup in follow-up.”

---

## References

- Step A handoff (context): [`vessel-orchestrator-execute-tick-step-a-handoff-2026-04-17.md`](vessel-orchestrator-execute-tick-step-a-handoff-2026-04-17.md)
- Engineering memo §3 Steps B–F: [`vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md)

---

## Document history

- **2026-04-17:** Initial Step B handoff.
