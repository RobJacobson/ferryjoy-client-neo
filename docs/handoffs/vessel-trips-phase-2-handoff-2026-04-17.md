# Handoff: Vessel trips refactor — Phase 2 (folder scaffolding)

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Prerequisites:** Phase 0 (golden path + docs) and Phase 1 (four-concern naming + `TimelineTickProjectionInput`) complete. Canonical narrative: [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) — *Target reorganization*, *Phased cleanup / reorg*, **§10 Suggested refactor sequence**.

**Goal:** **Phase 2 — Folder scaffolding (domain)** per architecture §10: add the **four concern folders** under `domain/vesselOrchestration`, move **only the smallest, lowest-risk units** first, and keep **backward-compatible re-exports** from previous paths until all imports are updated. **No behavior changes** and **no extraction** of timeline or prediction logic from `vesselTrips` yet (those are Phases 3–4).

---

## What Phase 2 is (and is not)

**In scope**

- Physical folder layout matching the target mental model (one folder per concern).
- Moving or aliasing **clearly owned** helpers with **thin barrels** and **unchanged public APIs** at `domain/vesselOrchestration` boundary.
- Updating imports **incrementally**; optional deprecation comments on old paths if both coexist briefly.
- Short `README.md` (or `architecture.md` pointer) per new folder **only if** it aids navigation without duplicating the main vesselTrips doc.

**Out of scope (later phases)**

- **Phase 3:** Splitting “lifecycle result → `TickEventWrites`” from “run mutations” or relocating `timelineEventAssembler` / projection pipeline ownership.
- **Phase 4:** Pulling ML out of `buildTrip`.
- **Phase 5:** New Convex actions or metrics.
- Large moves of `convex/domain/vesselTrips/**` into `vesselOrchestration` in one PR — **avoid**; prefer incremental slices.

---

## Target shape (from architecture)

Illustrative layout ([`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) §353–365):

```text
convex/domain/vesselOrchestration/
  updateVesselLocations/
  updateVesselTrips/
  updateVesselPredictions/
  updateTimeline/
  ... existing coordinator files (runVesselOrchestratorTick.ts, types.ts, etc.)
```

Exact naming can stay as above; the point is **reviewable surfaces** aligned with operations.

**Dependency truth (unchanged)**

- **updateVesselLocations** — parallel with the stack below.
- **updateVesselTrips** → **updateVesselPredictions** (still embedded in `buildTrip` until Phase 4) → **updateTimeline**.

Phase 2 **does not** need to realize that split in code flow — only **folder + file placement** toward it.

---

## Suggested migration strategy

1. **Add the four directories** under `convex/domain/vesselOrchestration/`.

2. **Seed each folder** with one of:
   - a **minimal `index.ts`** that re-exports from the current canonical module; or
   - the **first moved module** + `index.ts` barrel.

3. **Keep `convex/domain/vesselOrchestration/index.ts`** as the **stable entry**: re-export `runVesselOrchestratorTick`, eligibility helpers, and types from their **new or unchanged paths** so `functions/` and other callers need at most one import-path update per PR.

4. **Prefer small PRs:** e.g. (A) add folders + re-exports only, (B) move one file, (C) update imports repo-wide for that file.

5. **Do not** create empty placeholder packages with fake exports — if a folder has nothing to own yet, a **short README** pointing to the current implementation (`buildTrip` for predictions, `actions.applyTickEventWrites` for timeline apply) is enough until Phase 3/4.

---

## Candidate “first moves” (pick 1–2; justify in PR)

These are **suggestions**, not requirements — choose based on diff size and clarity.

| Concern | Possible first unit | Rationale |
| --- | --- | --- |
| **updateVesselTrips** | [`passengerTerminalEligibility.ts`](../../convex/domain/vesselOrchestration/passengerTerminalEligibility.ts) | Pure gating for trip-eligible locations used inside `runVesselOrchestratorTick`; no Convex, small, already “orchestration” scoped. |
| **updateTimeline** | Type-only or doc-only barrel re-exporting [`TimelineTickProjectionInput`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/tickEventWrites.ts) / [`mergeTickEventWrites`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/tickEventWrites.ts) from `vesselTrips` | Names the handoff home without moving projection builders yet. Risk: duplicate export surface — prefer **re-export only** from `vesselOrchestration` barrel, not a second source of truth. |
| **updateVesselLocations** | Doc-only folder + README | Production persist lives in [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts); domain has little beyond `deps.persistLocations`. Scaffolding may be **documentation-first** until a real helper exists. |
| **updateVesselPredictions** | Doc-only folder + README | Logic still inside `buildTrip`; folder marks future home per Phase 1 honesty. |

**Avoid early:** Moving `runVesselOrchestratorTick.ts` or `types.ts` before dependents are stable — coordinator files can stay at `vesselOrchestration/` root until a later Phase 2 follow-up.

---

## Import and export rules

- **Stable public API:** Callers outside `domain/vesselOrchestration` should keep importing from `domain/vesselOrchestration` (barrel) where possible.
- **Barrel discipline:** Match project rules — export only what production needs; tests may import internals if the project already allows it for domain tests.
- **No new cycles:** `vesselOrchestration` must not start importing heavy `vesselTrips` subgraphs beyond what it already does (e.g. `types.ts` importing `domain/vesselTrips` is fine).

---

## Verification

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test convex/domain/vesselOrchestration/tests/
bun test convex/domain/vesselOrchestration/updateVesselTrips/tests/
```

If any import path changes touch `functions/`, run targeted function tests if present.

---

## Acceptance criteria

- [ ] Four folders exist under `convex/domain/vesselOrchestration/` named for the four concerns (or documented equivalent if names are adjusted in PR).
- [ ] At least **one** concrete move **or** a justified **doc-only** scaffold for the concerns that have no domain module yet (locations / predictions).
- [ ] **No behavioral change** — same tick ordering, same mutations, same projection payloads.
- [ ] **Green** `check:fix`, `type-check`, `convex:typecheck`, and orchestration + vesselTrips domain tests.
- [ ] `architecture.md` §10 **Phase 2** checkbox or short note updated **only if** the team tracks progress there (optional; avoid large doc edits).

---

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Import churn across the repo | Move one module per PR; keep re-exports at old paths during transition. |
| Duplicate barrels / confusing re-exports | One canonical export per symbol; prefer `vesselOrchestration/index.ts` as the gateway. |
| Over-moving `vesselTrips` code | Keep lifecycle code in `domain/vesselTrips` until Phase 3+; Phase 2 is scaffolding, not relocation of `buildTrip`. |

---

## After Phase 2

**Phase 3** — Extract **updateTimeline**: lifecycle returns authoritative facts; timeline module builds/applies `TickEventWrites` only after required mutations settle — **separate handoff** when ready.

**Reference:** [`architecture.md` §10](../../convex/domain/vesselOrchestration/architecture.md) Phases 3–5.
