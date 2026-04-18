# Handoff: Post–Step A follow-ups (helpers, imports, parity tests)

**Audience:** implementation agent  
**Context:** Step A added `executeVesselOrchestratorTick` under `convex/functions/vesselOrchestrator/`. The **migration memo** path continues with Step B (wire `actions.ts` to `executeVesselOrchestratorTick`), then later steps remove `runVesselOrchestratorTick` and `createVesselOrchestratorTickDeps`.

These items are **non-blocking** polish and regression hardening. Order matters.

### Status (implemented in repo)

- **Helpers:** [`vesselOrchestratorTickHelpers.ts`](../../convex/functions/vesselOrchestrator/vesselOrchestratorTickHelpers.ts) exports `nowMs`, `elapsedMs`, `toError`, `logVesselOrchestratorTickLine`; [`executeVesselOrchestratorTick.ts`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts) imports them. **Domain** [`runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts) still inlines the same helpers until Step D deletes it (no `domain` → `functions` import).
- **Imports:** `executeVesselOrchestratorTick` uses direct paths for `isTripEligibleLocation`, `computeShouldRunPredictionFallback`, and `VesselTripsTickResult` (aligned with `createVesselOrchestratorTickDeps` / `runProcessVesselTripsTick` style).
- **Parity:** [`executeVesselOrchestratorTick.parity.test.ts`](../../convex/functions/vesselOrchestrator/tests/executeVesselOrchestratorTick.parity.test.ts) includes a happy-path case with `fakeActionCtxOrchestratorHappyPath` (args-shaped `runMutation` stubs) plus assertions on all three `tickMetrics` when both branches succeed.

**Remaining after Step D:** Remove duplicate helpers from domain only; rewrite parity tests that compare to `runVesselOrchestratorTick` per §3 below.

---

## 1. Duplicated helpers (`nowMs`, `elapsedMs`, `toError`, `logVesselOrchestratorTickLine`)

**When:** After **domain** `runVesselOrchestratorTick` is **deleted** (parent memo Step D), not before — **functions** extraction above was done early so `executeVesselOrchestratorTick` stays DRY; domain copy remains until removal.

**Why wait:** Extracting shared helpers while **two** call sites still exist in domain + functions risks churn and merge conflicts. Once only **`executeVesselOrchestratorTick`** (or a single functions module) owns orchestration, dedupe is safe.

**What to do:**

1. Add a small module under `convex/functions/vesselOrchestrator/`, e.g. `orchestratorTickTelemetry.ts` or `vesselOrchestratorTickHelpers.ts`, exporting:
   - `nowMs`, `elapsedMs`, `toError`, `logVesselOrchestratorTickLine`  
   (same signatures and behavior as today — move verbatim).

2. Replace local copies in **`executeVesselOrchestratorTick.ts`** with imports from that module.

3. **Do not** import that helpers module from **`convex/domain/`** — domain should not depend on functions. If anything in domain still needed those helpers after partial migration, they would live in `convex/shared/` or stay duplicated until domain orchestration is gone.

4. Run `bun run check:fix`, `bun run type-check`, `bun run convex:typecheck`, and orchestrator tests.

---

## 2. Import style in `executeVesselOrchestratorTick.ts`

**When:** Anytime; low priority (cosmetic).

**What to do:**

- Align with project convention: either import `isTripEligibleLocation` and `computeShouldRunPredictionFallback` from **`domain/vesselOrchestration/updateVesselTrips`** the same way sibling files do, or use **direct paths** (`.../passengerTerminalEligibility`, `.../processTick/tickPredictionPolicy`) if the codebase prefers avoiding the barrel for hot paths.
- Grep `convex/functions/vesselOrchestrator/` for existing patterns and match them.
- No behavior change; formatting/import order only.

---

## 3. Parity test coverage (`executeVesselOrchestratorTick.parity.test.ts`)

**When:** After **Step B** (production uses `executeVesselOrchestratorTick`), or when stabilizing before removing the domain path.

**What to do:**

1. Add at least **one happy path** where both branches succeed: extend `fakeActionCtx` so `runMutation` resolves successfully for both location bulk upsert and the trip/timeline mutations used in the stubbed path (mirror patterns from `createVesselOrchestratorTickDeps.test.ts` or domain orchestrator tests).

2. Optionally assert **`tickMetrics`** numeric values are present for all three steps when both branches succeed (not only key sets).

3. Keep tests **fast and deterministic** — no real Convex deployment.

4. When **domain** `runVesselOrchestratorTick` is removed, **delete or rewrite** parity tests that compare against it; tests should then target **`executeVesselOrchestratorTick` + `fakeActionCtx`** only, or integration tests at the action boundary if you add them later.

---

## Ordering summary

| Issue | Action | Timing |
|--------|--------|--------|
| Duplicated helpers | Extract to `functions/vesselOrchestrator/*Helpers*.ts`; use from `executeVesselOrchestratorTick` only | After domain tick file removed |
| Import style | Normalize imports to match nearby orchestrator files | Anytime |
| Parity tests | Add success-path + tighten metrics assertions; remove domain-vs-execute parity when domain path is gone | After Step B; cleanup with Step D |

---

## References

- Parent memo: [`docs/engineering/vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md)
