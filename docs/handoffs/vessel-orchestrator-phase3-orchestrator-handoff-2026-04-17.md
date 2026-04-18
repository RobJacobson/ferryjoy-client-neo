# Handoff: Phase 3 — Orchestrator tick shape (reduce callback surface)

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Prerequisites:**

- Phase 1: trip write plan + [`applyVesselTripTickWritePlan`](../../convex/functions/vesselTrips/applyVesselTripTickWritePlan.ts) ([handoff](vessel-trip-phase1-write-plan-handoff-2026-04-17.md))
- Phase 2: [`VesselTripPredictionModelAccess`](../../convex/domain/ml/prediction/vesselTripPredictionModelAccess.ts) + [`createVesselTripPredictionModelAccess`](../../convex/functions/predictions/createVesselTripPredictionModelAccess.ts) ([handoff](vessel-trip-phase2-read-ports-handoff-2026-04-17.md))

**Parent doc:** [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md) (Stage 3)

---

## Goal

**Simplify how the vessel orchestrator tick is expressed** so
[`updateVesselOrchestrator`](../../convex/functions/vesselOrchestrator/actions.ts)
(using [`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts))
is easier to read and maintain, while **preserving**:

- **Parallelism:** `Promise.allSettled` between **updateVesselLocations** and the
  **trip stack** (same top-level branches as today).
- **Ordering inside the trip stack:** **updateVesselTrips** (including Phase 1
  plan → apply → `buildTimelineTickProjectionInput` inside
  [`processVesselTripsWithDeps`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts))
  **before** **updateTimeline** [`applyTickEventWrites`](../../convex/functions/vesselOrchestrator/applyTickEventWrites.ts)
  (canonical: [`applyTickEventWrites.ts`](../../convex/functions/vesselOrchestrator/applyTickEventWrites.ts), wired by [`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts))
  in [`runVesselOrchestratorTick`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts).
- **Metrics and logging:** `tickMetrics` (`persistLocationsMs`,
  `processVesselTripsMs`, `applyTickEventWritesMs`) and the
  `[VesselOrchestratorTick]` JSON log line.
- **Branch error isolation:** failures recorded in
  [`VesselOrchestratorTickResult`](../../convex/domain/vesselOrchestration/types.ts)
  as today (locations vs trips).

**Out of scope (unless explicitly expanded)**

- Reverting Phase 1 (moving mutations back into domain lifecycle files).
- Changing **Phase 2** prediction ports.
- Product behavior changes (new transaction boundaries, different parallel/success
  semantics).
- **“Full data-out orchestrator”** (domain returns only plans and the action
  applies every mutation) — possible future work; this handoff treats it as
  **optional stretch**, not the default deliverable.

---

## Current shape (baseline)

[`runVesselOrchestratorTick`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts)
takes [`VesselOrchestratorTickInput`](../../convex/domain/vesselOrchestration/types.ts)
+ [`VesselOrchestratorTickDeps`](../../convex/domain/vesselOrchestration/types.ts):

1. **`persistLocations(locations)`** — bulk location upsert path.
2. **`processVesselTrips(locations, tick, activeTrips, options)`** — full trip
   tick (`processVesselTripsWithDeps` + internal apply + timeline **writes**
   assembly only; returns `tickEventWrites`).
3. **`applyTickEventWrites(writes)`** — timeline overlay mutations.

Production wiring uses
[`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts)
(called from [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)),
which closes over **`ActionCtx`** and composes **`createDefaultProcessVesselTripsDeps`**,
**`createScheduledSegmentLookup`**, **`createVesselTripPredictionModelAccess`**, etc.

**Pain (pre–Strategy B):** three lambdas inline in **`actions.ts`** and a **deps bag** that read as
indirection even though Phase 1–2 already clarified domain vs functions
boundaries elsewhere.

---

## Directional options (pick one strategy in implementation)

Implementers should **choose the smallest change** that meets readability goals;
do not combine every option in one PR.

### Option A — Collapse **trip + timeline** into one dep (two callbacks total)

Because **`applyTickEventWrites`** always runs **immediately after**
**`processVesselTrips`** on the success path, the action can expose a **single**
async function, e.g. **`runTripTickAndReturnWrites`** is wrong name — better:
**`runTripBranch`** that:

1. Calls **`processVesselTripsWithDeps`** (returns `VesselTripsTickResult`).
2. Awaits **`applyTickEventWrites(tripResult.tickEventWrites)`**.
3. Returns **`void`** (or the same `VesselTripsTickResult` if callers need it).

Then **`runVesselOrchestratorTick`** only needs **`persistLocations`** +
**`runTripBranch`**, and timing splits: either **one** `processVesselTripsMs`
span covering both trip processing and timeline apply, or **keep two** timer
sections inside `runVesselOrchestratorTick` by having `runTripBranch` accept
hooks — prefer **two metrics** for parity with dashboards unless product agrees
to merge.

**Files:** [`types.ts`](../../convex/domain/vesselOrchestration/types.ts)
(`VesselOrchestratorTickDeps` shrink),
[`runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts),
[`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts),
[`applyTickEventWrites.ts`](../../convex/functions/vesselOrchestrator/applyTickEventWrites.ts)
(if timeline apply moves with the collapsed branch),
[`runVesselOrchestratorTick.test.ts`](../../convex/domain/vesselOrchestration/tests/runVesselOrchestratorTick.test.ts).

### Option B — Keep **`runVesselOrchestratorTick`** API but add a **factory** in functions

Add e.g. **`createVesselOrchestratorTickDeps(ctx): VesselOrchestratorTickDeps`**
next to the orchestrator that encapsulates the three closures. **`actions.ts`**
becomes a one-liner `runVesselOrchestratorTick(input, createVesselOrchestratorTickDeps(ctx))`.
Implemented in [`createVesselOrchestratorTickDeps.ts`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts).
Low risk; smaller win than A.

### Option C — Inline parallelism in **`actions.ts`**, keep domain helpers

Move **`Promise.allSettled`** + metrics + logging into the action (or a
**`functions/vesselOrchestrator/runUpdateVesselOrchestratorTick.ts`** module), and
have [`runVesselOrchestratorTick`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts)
either shrink to a **pure** “orchestration only” helper or be deleted if fully
duplicated. **Risk:** domain vs functions layering; avoid pulling **`_generated`**
into domain.

### Stretch — Domain returns **only** computed outputs; action applies all effects

Aligns with memo “location payload + trip artifacts” but **conflicts** with
current **Phase 1** design where **`processVesselTripsWithDeps`** calls the
**functions** applier. Doing this cleanly requires **lifting** apply steps to
the action and re-threading types; treat as a **separate** initiative with its
own design review.

---

## Testing and verification

- Update [`runVesselOrchestratorTick.test.ts`](../../convex/domain/vesselOrchestration/tests/runVesselOrchestratorTick.test.ts)
  for any **deps shape** change; preserve cases for branch isolation, metrics,
  and ordering expectations.
- Run: `bun run check:fix`, `bun run type-check`, `bun run convex:typecheck`.
- Grep consumers of **`VesselOrchestratorTickDeps`** (if renamed) across the repo.

---

## Documentation

- [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md):
  update the orchestrator flow if deps or file layout changes.
- [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md):
  short note if **`runVesselOrchestratorTick`** contract changes.
- Optional: resolve memo [open question](../vessel-orchestrator-domain-persistence-refactor-memo.md)
  on a single top-level “persistable tick” type if Option C or stretch
  partially answers it.

---

## Definition of done

- [ ] **`updateVesselOrchestrator`** is materially simpler to read **or** deps
      wiring is centralized (per chosen option), without changing tick
      semantics.
- [ ] **Parallelism** and **trip → timeline** ordering unchanged.
- [ ] **Metrics / structured log** behavior preserved or intentionally updated
      with a short note (e.g. merged timers).
- [ ] Tests and typecheck pass.

---

## References

- Memo Stage 3: [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md)
- Phase 1 handoff: [`docs/handoffs/vessel-trip-phase1-write-plan-handoff-2026-04-17.md`](vessel-trip-phase1-write-plan-handoff-2026-04-17.md)
- Phase 2 handoff: [`docs/handoffs/vessel-trip-phase2-read-ports-handoff-2026-04-17.md`](vessel-trip-phase2-read-ports-handoff-2026-04-17.md)

---

## Document history

- **2026-04-17:** Initial Phase 3 handoff.
