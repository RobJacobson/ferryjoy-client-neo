# Handoff: Vessel trips refactor — Phase 1 (four-concern naming + explicit handoff types)

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Prerequisite:** Phase 0 complete — see [`vessel-trips-phase-0-handoff-2026-04-17.md`](./vessel-trips-phase-0-handoff-2026-04-17.md) and canonical narrative in [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) (especially *Target reorganization*, *Phased cleanup / reorg*, and **§10 Suggested refactor sequence**).

**Goal:** **Phase 1 — Four-concern composition without changing behavior** (architecture §10): name the four operational concerns in code and docs, optionally add **thin wrappers** that delegate to today’s implementations, and introduce **explicit types** at the trip-tick → timeline boundary so later phases can extract modules without churn.

---

## Canonical Phase 1 scope (from architecture)

Per [`architecture.md` §10](../../convex/domain/vesselOrchestration/architecture.md):

1. **Name** the four concerns: `updateVesselLocations`, `updateVesselTrips`, `updateVesselPredictions`, `updateTimeline` (comments and/or thin wrappers).
2. **Introduce explicit types:** structured trip-tick output → handoff to **updateTimeline** (today: `TickEventWrites`), without changing runtime behavior.

Aligned with the earlier *Phased cleanup* list (same doc, “Phase 1 — Document and compose”): orchestrator + domain docs updated; optional wrappers like `runUpdateVesselLocations` delegating to existing code.

**Explicitly out of scope for Phase 1**

- Moving files or creating the four folders under `domain/vesselOrchestration` (**Phase 2**).
- Splitting lifecycle vs timeline execution inside `runVesselOrchestratorTick` beyond naming/clarity (**Phase 3**).
- Extracting ML from `buildTrip` (**Phase 4**).
- New Convex actions or metrics (**Phase 5**).
- Any change to trip lifecycle semantics, mutation ordering, or projection payloads.

---

## Operational mapping (today’s code)

| Concern (target name) | Role today | Primary code |
| --- | --- | --- |
| **updateVesselLocations** | Persist live `vesselLocations` snapshot | `VesselOrchestratorTickDeps.persistLocations` — wired from [`updateVesselLocations`](../../convex/functions/vesselOrchestrator/actions.ts) in `actions.ts` |
| **updateVesselTrips** | Authoritative `activeVesselTrips` / `completedVesselTrips` mutations; event detection; `buildTrip` pipeline | `processVesselTripsWithDeps` in [`processVesselTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts) |
| **updateVesselPredictions** | Trip-shaped ML fields | **Still embedded** in `buildTrip` / `appendPredictions` — Phase 1 only **documents** this; do not extract yet |
| **updateTimeline** | Apply `eventsActual` / `eventsPredicted` writes | `applyTickEventWrites` in [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts); input is `TickEventWrites` |

**Sequential chain inside the “trip branch”** (same tick): **updateVesselTrips** (and embedded predictions) **→** **updateTimeline**. Locations run **in parallel** with that stack via `Promise.allSettled` in [`runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts).

---

## Deliverable 1 — Name the four concerns (docs + code)

### 1.1 Domain orchestration

**File:** [`convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts)

- Expand module-level and/or `runVesselOrchestratorTick` TSDoc to name the four concerns and map `deps` fields:
  - `persistLocations` → **updateVesselLocations**
  - `processVesselTrips` → **updateVesselTrips** (predictions still inside this step until Phase 4)
  - `applyTickEventWrites` → **updateTimeline**
- Optionally refactor the inner IIFE `runTripLifecycleAndTimeline` into named locals (e.g. comments or tiny functions) so **updateTimeline** is visibly “consume `VesselTripsTickResult.tickEventWrites`” — **no change to call order or error handling**.

**File:** [`convex/domain/vesselOrchestration/types.ts`](../../convex/domain/vesselOrchestration/types.ts)

- TSDoc on `VesselOrchestratorTickDeps`: each field labeled with the concern name above.

### 1.2 Functions layer (orchestrator)

**File:** [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)

- In `updateVesselOrchestrator` handler TSDoc (and/or inline comments at the `runVesselOrchestratorTick` call), map:
  - `updateVesselLocations` mutation path → **updateVesselLocations**
  - `processVesselTripsWithDeps` + deps → **updateVesselTrips** (+ embedded **updateVesselPredictions**)
  - `applyTickEventWrites` → **updateTimeline**

**Optional thin wrappers (still no behavior change)**

- Local `const` functions or file-private helpers, e.g. `runUpdateVesselLocations` delegating to `updateVesselLocations(ctx, ...)`, and `runUpdateTimeline` delegating to `applyTickEventWrites(ctx, ...)`, **only if** they improve readability without widening exports. Prefer **documentation first**; wrappers are optional per architecture doc.

### 1.3 Domain vesselTrips entry

**File:** [`convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts) and/or [`convex/domain/vesselOrchestration/updateVesselTrips/index.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/index.ts)

- Short TSDoc noting that **updateVesselTrips** is the lifecycle owner here and **updateVesselPredictions** is still implemented inside `buildTrip` until Phase 4.

### 1.4 README touchpoints (light)

- [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) — one short subsection or bullet list mapping the four names to the steps in the tick (link to `architecture.md`).
- [`convex/domain/vesselOrchestration/updateVesselTrips/README.md`](../../convex/domain/vesselOrchestration/updateVesselTrips/README.md) — optional one-liner that **updateVesselTrips** / embedded predictions / timeline assembly are staged per §10 (avoid duplicating `architecture.md`).

**Avoid:** Large new markdown files or rewriting `architecture.md` wholesale — small cross-links only.

---

## Deliverable 2 — Explicit types (trip tick → updateTimeline)

**Problem:** `VesselTripsTickResult` already holds `tickEventWrites: TickEventWrites`, but Phase 1 asks for an **explicit “handoff to updateTimeline”** type so Phase 3 can split concerns without renaming everything.

**Recommended approach (behavior-neutral)**

1. **File:** [`convex/domain/vesselOrchestration/updateVesselTrips/processTick/tickEventWrites.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/tickEventWrites.ts) (or adjacent `types.ts` if you prefer no churn in consumers)

   - Export a **documented type alias**, e.g.  
     `export type TimelineTickProjectionInput = TickEventWrites;`  
     with TSDoc: “Input to **updateTimeline** (`applyTickEventWrites`); produced after **updateVesselTrips** (and embedded predictions) for this tick.”

2. **File:** [`convex/domain/vesselOrchestration/updateVesselTrips/processTick/tickEnvelope.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/tickEnvelope.ts)

   - Update `VesselTripsTickResult` TSDoc to state that `tickEventWrites` is the **updateTimeline** handoff (reference `TimelineTickProjectionInput`).
   - Optionally use the alias in the type definition:  
     `tickEventWrites: TimelineTickProjectionInput`  
     (still identical at runtime and to TypeScript structurally).

3. **File:** [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)

   - `applyTickEventWrites` TSDoc: parameter type described as **updateTimeline** input (`TickEventWrites` / alias).

4. **Exports:** Re-export the alias from [`convex/domain/vesselOrchestration/updateVesselTrips/index.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/index.ts) **only if** other modules need it; otherwise keep barrel minimal per project rules.

**Do not** introduce duplicate runtime objects or wrap `tickEventWrites` in new envelopes unless necessary — alias + docs are enough for Phase 1.

---

## Verification

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test convex/domain/vesselOrchestration/tests/
bun test convex/domain/vesselOrchestration/updateVesselTrips/tests/
```

No new behavioral tests are required if changes are comment/type-alias only; run existing suites to guard accidental refactors.

---

## Acceptance criteria

- [ ] Four concern names appear in **orchestrator domain** (`runVesselOrchestratorTick`, `VesselOrchestratorTickDeps`) and **functions** (`actions.ts`) documentation, with **updateVesselPredictions** called out as **inside** `processVesselTrips` / `buildTrip` until Phase 4.
- [ ] Explicit **updateTimeline** handoff type (alias or equivalent) ties `TickEventWrites` to `applyTickEventWrites` without changing call sites’ behavior.
- [ ] `bun run type-check`, `bun run convex:typecheck`, and targeted tests pass.
- [ ] Diff is **documentation + typing clarity**; no production logic edits except harmless refactors (e.g. extracted local function with identical body).

---

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Over-engineering new wrappers | Prefer TSDoc; add named locals only where they clarify the four concerns. |
| Export creep | Keep new types to the smallest surface (`tickEventWrites.ts` / `index.ts` as needed). |
| Drift from `architecture.md` | Quote §10 concern table; link from README bullets. |

---

## After Phase 1

**Phase 2** — Folder scaffolding under `domain/vesselOrchestration` (or agreed root); move smallest units first with re-exports.

**Reference:** [`architecture.md` §10](../../convex/domain/vesselOrchestration/architecture.md) Phases 2–5.
