# Handoff: Colocate orchestrator concerns in named domain folders

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Problem:** The vessel-orchestration refactor introduced **folder names** that match the four operational concerns (**updateVesselLocations**, **updateVesselTrips**, **updateVesselPredictions**, **updateTimeline**), but **much of the code for those concerns still lives outside the folder that bears its name**. That defeats the goal of the refactor: **find all logic for a concern by opening one directory**, not by following README pointers and re-export barrels.

This handoff is **not** about adding Convex actions or changing tick semantics unless required for extraction. It is about **physical colocation** (and import cleanup) so the tree matches the mental model documented in [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md).

---

## Intended outcome (definition of done)

For each concern, **production implementation code** (and **tests that are primarily about that concern**) should live under:

| Concern | Target folder | Notes |
| --- | --- | --- |
| **updateVesselLocations** | `convex/domain/vesselOrchestration/updateVesselLocations/` | `bulkUpsertArgsFromLocations.ts` shapes `bulkUpsert` args; orchestrator runs mutation. |
| **updateVesselTrips** | `convex/domain/vesselOrchestration/updateVesselTrips/` | Trip/tick/lifecycle code; `tripLifecycle` is state machine + `buildTrip` (ML calls into `updateVesselPredictions`). |
| **updateVesselPredictions** | `convex/domain/vesselOrchestration/updateVesselPredictions/` | `applyVesselPredictions`, `appendPredictions`, `stripTripPredictionsForStorage`, tests under this folder. |
| **updateTimeline** | `convex/domain/vesselOrchestration/updateTimeline/` | Domain assembly here; **apply** = `applyTickEventWrites` in `functions/vesselOrchestrator/applyTickEventWrites.ts` (single owner; wired by `createVesselOrchestratorTickDeps`; documented). |

**Barrels are fine** (`index.ts`) **after** the implementation files live in the right place — not **instead** of moving implementation.

---

## Current state (inventory — after colocation pass)

### updateVesselLocations

- **Folder:** [`updateVesselLocations/`](../../convex/domain/vesselOrchestration/updateVesselLocations/) — [`bulkUpsertArgsFromLocations.ts`](../../convex/domain/vesselOrchestration/updateVesselLocations/bulkUpsertArgsFromLocations.ts), [`index.ts`](../../convex/domain/vesselOrchestration/updateVesselLocations/index.ts), [`README.md`](../../convex/domain/vesselOrchestration/updateVesselLocations/README.md).
- **Wiring:** [`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts) (from [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)) supplies `persistLocations` using `bulkUpsertArgsFromConvexLocations` then `bulkUpsert`.

### updateVesselPredictions

- **Folder:** [`updateVesselPredictions/`](../../convex/domain/vesselOrchestration/updateVesselPredictions/) — implementation: [`applyVesselPredictions.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/applyVesselPredictions.ts), [`appendPredictions.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/appendPredictions.ts), [`stripTripPredictionsForStorage.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/stripTripPredictionsForStorage.ts); tests: [`tests/applyVesselPredictions.test.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/tests/applyVesselPredictions.test.ts). [`buildTrip.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts) imports the apply step from here.

### updateTimeline

- **Domain:** [`updateTimeline/`](../../convex/domain/vesselOrchestration/updateTimeline/) — assembly as before.
- **Apply (single owner):** [`applyTickEventWrites`](../../convex/functions/vesselOrchestrator/applyTickEventWrites.ts) (canonical module; no re-exports). Documented in [`updateTimeline/README.md`](../../convex/domain/vesselOrchestration/updateTimeline/README.md) and [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md).

### updateVesselTrips

- **Folder:** [`updateVesselTrips/`](../../convex/domain/vesselOrchestration/updateVesselTrips/) — lifecycle/tick; **tripLifecycle** is trip state machine + `buildTrip` orchestration (ML via `updateVesselPredictions`).

---

## Suggested work order (minimize churn)

1. **updateVesselPredictions — move implementation files**
   - Move (git mv) at minimum: `applyVesselPredictions.ts`, `appendPredictions.ts`, and tightly coupled helpers/tests currently named for predictions, from `updateVesselTrips/tripLifecycle/` → `updateVesselPredictions/`.
   - Update [`buildTrip.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts) and any other imports; keep **one** canonical path — update [`updateVesselPredictions/index.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/index.ts) to export from local files.
   - Move or duplicate tests: e.g. [`applyVesselPredictions.test.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tests/applyVesselPredictions.test.ts) → under `updateVesselPredictions/tests/` (preferred) and fix import paths.
   - **Cycle check:** the old barrel comment mentioned avoiding import cycles; re-run `bun run convex:typecheck` and fix any new cycles by adjusting import direction (domain may import types from `functions/*/schemas` only, per [`convex/domain/README.md`](../../convex/domain/README.md)).

2. **updateVesselLocations — introduce a real module**
   - Extract the **pure** parts that belong in domain (e.g. validation/normalization of location batches, mapping to mutation args, or a single `runUpdateVesselLocations` that takes injected `bulkUpsert` — mirror patterns used elsewhere).
   - Keep Convex `ctx.runMutation` in **`functions/vesselOrchestrator`** or a thin `functions/vesselLocation` wrapper if that is existing convention; the **named domain folder** should still contain the **policy and structure** of “what updateVesselLocations means,” not only a README pointer.
   - Update [`updateVesselLocations/README.md`](../../convex/domain/vesselOrchestration/updateVesselLocations/README.md) to list the real files.

3. **updateTimeline — align documentation with code**
   - Canonical apply implementation: [`applyTickEventWrites.ts`](../../convex/functions/vesselOrchestrator/applyTickEventWrites.ts) only; state that in [`updateTimeline/README.md`](../../convex/domain/vesselOrchestration/updateTimeline/README.md) and [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) so “timeline concern” = domain assembly **+** one documented apply site.
   - If you move the apply helper again, update all call sites and tests; avoid two competing “apply timeline” entrypoints.

4. **Repo hygiene**
   - Run `bun run convex:codegen`, `bun run convex:typecheck`, `bun run check:fix`, `bun run type-check`.
   - Run domain tests: `bun test convex/domain/vesselOrchestration/` (and any moved test paths).
   - Grep for stale paths to moved modules in docs/READMEs after refactors.

---

## Non-goals (unless explicitly expanded)

- Changing **tick ordering** (locations ∥ trips; mutations before timeline apply; upsert-gated projection).
- Splitting **`completeAndStartNewTrip`** or other atomic mutations without a data model reason.
- Adding new **public** `api.*` surface for orchestration.

---

## References

- Canonical narrative and folder map: [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) (especially *Target reorganization* and §5 folder map).
- Domain layer rules: [`convex/domain/README.md`](../../convex/domain/README.md).
- Orchestrator wiring: [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts), [`createVesselOrchestratorTickDeps.ts`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts), [`convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts).

---

## Success check (for the implementing agent)

- [ ] Opening `updateVesselLocations/` shows **TypeScript** that defines the concern, not only README.
- [ ] Opening `updateVesselPredictions/` shows **implementation** files for ML attachment, not only re-exports from `tripLifecycle`.
- [ ] `updateTimeline/` story is **documented**: domain builders live here; apply path has **one** clear owner.
- [ ] No duplicate “canonical” implementations of the same concern in two trees without an explicit deprecation comment.
