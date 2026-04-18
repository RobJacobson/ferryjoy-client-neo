# Handoff: Step D — Remove domain `runVesselOrchestratorTick` and tick callback types

**Date:** 2026-04-17  
**Audience:** Implementing agent  
**Parent plan:** [`docs/engineering/vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md) — **Step D** (and **Step E** test work; see §2)

**Prerequisite:** **Step C shipped** — factory removed; parity today compares
`executeVesselOrchestratorTick` vs `runVesselOrchestratorTick` +
[`vesselOrchestratorTickDepsFromCtx`](../../convex/functions/vesselOrchestrator/tests/vesselOrchestratorTickDepsFromCtx.ts).

---

## 1. Objective

Finish the “**no orchestration in domain**” cleanup for the vessel tick:

- **Delete** [`runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts) from `domain/vesselOrchestration/`.
- **Remove** [`VesselOrchestratorTickDeps`](../../convex/domain/vesselOrchestration/types.ts) from the domain layer (and **drop the type entirely** once nothing references it — see §4).
- **Relocate** orchestrator **input/result** types used by the action and `executeVesselOrchestratorTick` to
  **`convex/functions/vesselOrchestrator/types.ts`** (single home for Convex-facing tick contracts).
- **Shrink** [`domain/vesselOrchestration/index.ts`](../../convex/domain/vesselOrchestration/index.ts): no export of the domain runner or tick types that moved to `functions/`.

**Non-goals (unless trivial):**

- **Step G** (import-boundary cleanup / peer `index.ts` only) — can follow in a separate PR.
- **Step F** (full documentation sweep) — update orchestrator/domain READMEs if quick; large `architecture.md` pass can stay tracked for Step F.

---

## 2. Strong recommendation: combine Step D with Step E in one PR

The memo lists **Step E** (tests) separately, but **deleting `runVesselOrchestratorTick` without updating tests will break the build**:

- [`executeVesselOrchestratorTick.parity.test.ts`](../../convex/functions/vesselOrchestrator/tests/executeVesselOrchestratorTick.parity.test.ts) imports and calls **`runVesselOrchestratorTick`**.
- [`vesselOrchestratorTickDepsFromCtx.ts`](../../convex/functions/vesselOrchestrator/tests/vesselOrchestratorTickDepsFromCtx.ts) exists **only** to feed that domain branch.
- [`runVesselOrchestratorTick.test.ts`](../../convex/domain/vesselOrchestration/tests/runVesselOrchestratorTick.test.ts) targets the domain runner directly.

**Treat Step D + Step E as one deliverable:** remove the domain runner, relocate types, **delete or rewrite** the above tests in the same PR so `bun run convex:typecheck` and `bun test` stay green.

---

## 3. Current code map (what touches what)

### 3.1 Domain runner and types

| Artifact | Role |
| --- | --- |
| [`runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts) | Domain orchestration (parallel locations vs trip branch); **duplicate control flow** of `executeVesselOrchestratorTick` with injected `deps`. |
| [`types.ts`](../../convex/domain/vesselOrchestration/types.ts) | `VesselOrchestratorTickInput`, `VesselOrchestratorTickDeps`, `VesselOrchestratorTickMetrics`, `VesselOrchestratorTickResult`, `UpdateVesselOrchestratorResult`. Imports `functions/.../schemas` and domain trip/timeline types for **Deps** and **Input**. |

After removal, **`domain/vesselOrchestration/types.ts` should go away** if it only held tick contracts — there are **no** other TS imports of `domain/vesselOrchestration/types` outside tick types today (verify with `rg` before deleting the file).

### 3.2 Production consumers of tick **types** (must compile after move)

| File | Imports today |
| --- | --- |
| [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts) | `VesselOrchestratorTickResult` from `domain/vesselOrchestration`; `getPassengerTerminalAbbrevs` stays from domain **index**. |
| [`executeVesselOrchestratorTick.ts`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts) | `VesselOrchestratorTickInput`, `VesselOrchestratorTickResult` from `domain/vesselOrchestration/types`. |
| [`vesselOrchestratorTickHelpers.ts`](../../convex/functions/vesselOrchestrator/vesselOrchestratorTickHelpers.ts) | `VesselOrchestratorTickMetrics` from `domain/vesselOrchestration/types`. |

After Step D, these should import from **`./types`** (or a single agreed path under `functions/vesselOrchestrator/`).

### 3.3 Generated API

[`convex/_generated/api.d.ts`](../../convex/_generated/api.d.ts) references `domain/vesselOrchestration/runVesselOrchestratorTick` and `domain/vesselOrchestration/types`. After file deletions, run **`bun run convex:codegen`** — **never** hand-edit `_generated/*`.

---

## 4. Implementation checklist

### 4.1 Add `convex/functions/vesselOrchestrator/types.ts`

- Move **at minimum:** `VesselOrchestratorTickInput`, `VesselOrchestratorTickMetrics`, `VesselOrchestratorTickResult`, `UpdateVesselOrchestratorResult` (same shapes as today).
- **Imports:** Reuse the same dependencies the domain file used (`functions/vesselLocation/schemas`, `functions/vesselTrips/schemas`, etc.). Domain must **not** depend on this file.
- **TSDoc:** Update `VesselOrchestratorTickResult` line that says tick metrics are “always populated by `runVesselOrchestratorTick`” — point at **`executeVesselOrchestratorTick`** / action instead.
- **`VesselOrchestratorTickDeps`:** Do **not** move to functions unless you temporarily need it for a straggling test. Preferred end state: **delete** the type and **delete** [`vesselOrchestratorTickDepsFromCtx.ts`](../../convex/functions/vesselOrchestrator/tests/vesselOrchestratorTickDepsFromCtx.ts) once parity no longer uses deps (§4.3).

### 4.2 Delete domain files

1. Delete **`runVesselOrchestratorTick.ts`**.
2. Delete **`types.ts`** under `domain/vesselOrchestration/` **after** all symbols are moved and imports updated (or leave a stub only if something else must live there — today nothing should).

### 4.3 Tests (Step E — same PR)

1. **Parity tests**  
   - Remove the **`fromDomain` / `runVesselOrchestratorTick`** branch entirely.  
   - **Delete** `vesselOrchestratorTickDepsFromCtx.ts` and the **`describe("vesselOrchestratorTickDepsFromCtx (deps shape)")`** block unless you replace them with a narrower test that does not need `VesselOrchestratorTickDeps`.  
   - Keep **execute**-focused scenarios: same stubs, assert results/metrics/errors on **`executeVesselOrchestratorTick` only** (rename file or top-level `describe` to match: e.g. `executeVesselOrchestratorTick` integration tests).

2. **Domain test file**  
   - Delete or **rewrite** [`runVesselOrchestratorTick.test.ts`](../../convex/domain/vesselOrchestration/tests/runVesselOrchestratorTick.test.ts): port valuable cases to `functions/vesselOrchestrator/tests/` using **fake `ActionCtx`** and spies on `runMutation` / `runQuery`, targeting **`executeVesselOrchestratorTick`** (per memo Step E).

3. **Comments**  
   - Update [`processVesselTrips.tick.test.ts`](../../convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts) and [`vesselOrchestratorTickHelpers.ts`](../../convex/functions/vesselOrchestrator/vesselOrchestratorTickHelpers.ts) if they still mention the domain runner.

### 4.4 `domain/vesselOrchestration/index.ts`

- Replace module comment: orchestration lives in **`functions/vesselOrchestrator`** (`executeVesselOrchestratorTick`), not `runVesselOrchestratorTick`.
- **Remove** `export { runVesselOrchestratorTick } ...` and **remove** re-exports of tick types from `./types`.
- **Keep** eligibility exports from `./updateVesselTrips` (`getPassengerTerminalAbbrevs`, `isPassengerTerminalAbbrev`, `isTripEligibleLocation`).

### 4.5 `actions.ts`

- Change `VesselOrchestratorTickResult` import from `domain/vesselOrchestration` to **`./types`** (or `./executeVesselOrchestratorTick` re-export — prefer **`./types`** for a stable contract surface).

### 4.6 `executeVesselOrchestratorTick.ts`

- Import tick types from **`./types`**.
- TSDoc: remove “same semantics as `runVesselOrchestratorTick` … parity tests use `vesselOrchestratorTickDepsFromCtx`” — describe **only** production behavior (parity helper is gone).

### 4.7 Optional minimal docs in this PR

- [`convex/domain/README.md`](../../convex/domain/README.md) — vesselOrchestration bullet: no primary “`runVesselOrchestratorTick`”.
- [`docs/engineering/vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md) — mark Step D (and E if combined) **shipped**, checklist rows.

---

## 5. Verification

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test convex/functions/vesselOrchestrator
bun test convex/domain/vesselOrchestration   # if domain tests remain
```

**Grep (expect no TS references to removed symbols):**

```bash
rg "runVesselOrchestratorTick" --glob "*.ts" --glob "*.tsx"
rg "VesselOrchestratorTickDeps" --glob "*.ts" --glob "*.tsx"
rg "domain/vesselOrchestration/types" --glob "*.ts"
```

Residual mentions in **markdown** or archived handoffs are OK if tracked for Step F; **TypeScript** must be consistent.

---

## 6. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Missed import after deleting `domain/.../types.ts` | `rg "vesselOrchestration/types"` and full `convex:typecheck`. |
| Lost behavioral coverage | Port domain test cases to `executeVesselOrchestratorTick` with fakes; keep assertion strength (branch outcomes, metrics keys, errors). |
| Accidental **barrel** on new `functions/.../types.ts` | Keep the file **tick contracts only**; do not re-export unrelated domain helpers. |
| Client / external imports of `VesselOrchestratorTickResult` from `domain/vesselOrchestration` | Grep repo and `src/` for `domain/vesselOrchestration` type imports; update to `functions/vesselOrchestrator/types` or re-export from a single app-facing module if any exist. |

---

## 7. Success criteria

- [ ] `runVesselOrchestratorTick.ts` deleted; **no** `runVesselOrchestratorTick` in TS sources (except optional comments/docs).
- [ ] `domain/vesselOrchestration/types.ts` removed or reduced to nothing; tick contracts live in **`functions/vesselOrchestrator/types.ts`**.
- [ ] `domain/vesselOrchestration/index.ts` exports **only** the remaining deliberate surface (eligibility + trip helpers via existing paths).
- [ ] Parity/deps test artifacts aligned: **`vesselOrchestratorTickDepsFromCtx` removed** if `VesselOrchestratorTickDeps` is gone; tests target **`executeVesselOrchestratorTick`**.
- [ ] `bun run convex:codegen` run after deletes; `_generated` updated.
- [ ] All checks in §5 pass.

---

## 8. After this step

- **Step G:** Update `functions/vesselOrchestrator` imports to use **peer `domain/.../index.ts`** paths where applicable (memo §3.2 no longer lists `domain/vesselOrchestration/types` as an orchestrator contract root).
- **Step F:** Broader README / `architecture.md` / legacy memo updates.

---

## Document history

- **2026-04-17:** Initial handoff (Step D + coordinated Step E).
