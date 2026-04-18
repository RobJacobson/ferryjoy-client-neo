# Handoff: Step G — Import boundaries (`functions/vesselOrchestrator` → `domain`)

**Date:** 2026-04-17  
**Audience:** Implementing agent  
**Parent plan:** [`docs/engineering/vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md) — **Step G** (optional **Step H** if shape review is needed)

---

## 1. Prerequisites (current baseline)

These are **done** and should stay behavior-stable:

- **Steps A–E:** Production tick is **`executeVesselOrchestratorTick`**; domain **`runVesselOrchestratorTick`**, **`domain/vesselOrchestration/types.ts`**, and **`VesselOrchestratorTickDeps`** are removed; contracts live in **`functions/vesselOrchestrator/types.ts`**.
- **Step C:** `createVesselOrchestratorTickDeps` removed; no factory path.
- **Follow-up polish (FYI):** `executeVesselOrchestratorTick` module TSDoc points at post–Step D reality; shared **[`orchestratorTickTestFixtures.ts`](../../convex/functions/vesselOrchestrator/tests/orchestratorTickTestFixtures.ts)** documents that **trip-eligible filtering** and **prediction fallback** stay covered in **domain/unit** tests, not duplicated at the orchestrator integration layer.
- **Docs:** [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) and orchestrator README/tests sections updated for **execute-first** narrative.

**Explicitly out of scope for Step G** (unless product/regression demands later):

- **Spy on `runProcessVesselTripsTick` / assert filtered locations** — optional hardening only if regressions appear; see fixtures comment.

**Maps to:** [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md) **Stage B/C** (peer façades, then external callers).

---

## 2. Objective

Route **`convex/functions/vesselOrchestrator/**`** imports of **`convex/domain/**`** through **peer folder `index.ts`** files (and existing agreed roots like **`functions/vesselOrchestrator/types.ts`**), **not** deep paths into leaf files such as `.../processTick/defaultProcessVesselTripsDeps` or `.../passengerTerminalEligibility`.

**Non-goals:**

- **No** change to tick **semantics**, branch ordering, metrics, or logging.
- **No** automatic “export everything” on `index.ts` — if adding a symbol would **bloat** a façade, stop and consider **Step H** (split or submodule entry) per the engineering memo §1.3.

---

## 3. Primary target: [`executeVesselOrchestratorTick.ts`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts)

Current **deep** domain imports (verify with `rg` before editing):

| Current path | Likely peer entry |
| --- | --- |
| `updateVesselLocations/runUpdateVesselLocationsTick` | [`domain/vesselOrchestration/updateVesselLocations`](../../convex/domain/vesselOrchestration/updateVesselLocations/index.ts) (exports `runUpdateVesselLocationsTick`) |
| `updateVesselTrips/passengerTerminalEligibility` (`isTripEligibleLocation`) | [`domain/vesselOrchestration/updateVesselTrips`](../../convex/domain/vesselOrchestration/updateVesselTrips/index.ts) |
| `updateVesselTrips/processTick/tickEnvelope` (`VesselTripsTickResult`) | `updateVesselTrips/index.ts` (already exports type) |
| `updateVesselTrips/processTick/tickPredictionPolicy` (`computeShouldRunPredictionFallback`) | `updateVesselTrips/index.ts` (already exports) |
| `updateVesselTrips/processTick/defaultProcessVesselTripsDeps` (`createDefaultProcessVesselTripsDeps`) | **Not** on `updateVesselTrips/index.ts` today — **add a deliberate export** if it is part of the stable orchestrator trip contract, **or** document a rare exception (boundaries memo §6 Stage E) |

**Judgment:** Prefer **one** additional named export on `updateVesselTrips/index.ts` for `createDefaultProcessVesselTripsDeps` **if** the module story remains “orchestrator trip tick + deps”; if that makes the entry incoherent, **Step H** (e.g. `processTick/index.ts` façade) comes first.

---

## 4. Secondary targets (same PR or follow-up)

- **[`runProcessVesselTripsTick.ts`](../../convex/functions/vesselOrchestrator/runProcessVesselTripsTick.ts)** — already imports **`updateTimeline`** and **`updateVesselTrips`** entries; keep aligned when `updateVesselTrips` exports change.
- **[`createScheduledSegmentLookup.ts`](../../convex/functions/vesselOrchestrator/createScheduledSegmentLookup.ts)** — may import **`ScheduledSegmentLookup`** from a **deep** continuity path; prefer a **narrow type export** from a peer entry (or a small `types` surface under continuity) **without** turning `index.ts` into a bucket — coordinate with §3 judgment.
- **Tests** under `functions/vesselOrchestrator/tests/` — prefer peer entries where they mirror production contracts (memo Step E §3).

---

## 5. Step H (optional; same PR only if G forces it)

Per [`vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md) **Step H:**

- If Step G **requires** many unrelated exports on one `index.ts`, **pause** and split folders or add a **submodule** `index.ts` with a clear primary behavior.
- After shape stabilizes, consider **lint** (`no-restricted-imports` from `functions/vesselOrchestrator` into `domain/**/internal/**`) per boundaries memo Stage D.

---

## 6. Residual Step F (optional doc)

If not already done, add a short **current snapshot** note to [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md) pointing at the **functions-owned** memo as final-shape follow-up (engineering memo Step F §3). Can ship with Step G or separately.

---

## 7. Verification

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test convex/functions/vesselOrchestrator
bun test convex/domain/vesselOrchestration
```

**Sanity grep** (adjust patterns as needed):

```bash
rg "domain/vesselOrchestration/updateVesselTrips/" convex/functions/vesselOrchestrator --glob "*.ts"
rg "domain/vesselOrchestration/updateVesselLocations/" convex/functions/vesselOrchestrator --glob "*.ts"
```

Expect **no** deep imports under orchestrator **except** documented exceptions (if any).

---

## 8. Success criteria

- [ ] `executeVesselOrchestratorTick.ts` uses **peer `index.ts`** imports for symbols already on those façades; any new exports on peer entries are **justified** and documented if non-obvious.
- [ ] `createDefaultProcessVesselTripsDeps` either appears on a peer entry **or** has a short **why deep** note per boundaries memo.
- [ ] `bun run convex:typecheck` and targeted **`bun test`** pass; **no** intentional behavior change.
- [ ] Engineering memo checklist / Step G row updated to **shipped** when done (and Step H noted if performed).

---

## 9. Related links

- [`docs/engineering/imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- [`docs/engineering/vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md) — §3 Step G–H

---

## Document history

- **2026-04-17:** Initial handoff after Steps D–E + Step F doc polish; next work is Step G (import boundaries).
