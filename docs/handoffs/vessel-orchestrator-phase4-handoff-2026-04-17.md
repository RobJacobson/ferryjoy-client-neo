# Handoff: Phase 4 — Remaining orchestrator / layering options

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Prerequisites:** Phases 1–3 complete:

- Phase 1: [`applyVesselTripTickWritePlan`](../../convex/functions/vesselTrips/applyVesselTripTickWritePlan.ts) + write plan types ([handoff](vessel-trip-phase1-write-plan-handoff-2026-04-17.md))
- Phase 2: [`VesselTripPredictionModelAccess`](../../convex/domain/ml/prediction/vesselTripPredictionModelAccess.ts) ([handoff](vessel-trip-phase2-read-ports-handoff-2026-04-17.md))
- Phase 3: [`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts) ([handoff](vessel-orchestrator-phase3-orchestrator-handoff-2026-04-17.md))

**Parent doc:** [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md) (open questions and stretch topics)

---

## What Phase 4 is

Phase 4 is **not** a single mandated refactor. It is a **menu of follow-ups**
left after the memo’s Stages 1–3 and the **open questions** in
[`vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md).
Pick **one initiative per PR** unless two items are provably coupled.

**Default goal:** Improve **layering clarity**, **observability**, or **runtime
cost** without changing ferry tick **semantics** unless explicitly agreed.

---

## Initiative A — “Full data-out” trip tick (largest)

**Problem:** [`processVesselTripsWithDeps`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts)
imports [`applyVesselTripTickWritePlan`](../../convex/functions/vesselTrips/applyVesselTripTickWritePlan.ts)
from **`functions/`**, so **domain** still depends on **functions** for one hop.

**Direction:** Split **compute** (plan + `buildTimelineTickProjectionInput`
inputs) from **apply** (mutations), so **functions** owns all Convex side effects
in one place (or a small orchestrator-local runner), and **domain** returns only
data. Must preserve **Phase 1 ordering:** timeline assembly only **after**
persist outcomes.

**Risks:** Large diff; careful test migration; watch **Convex import cycles**.

**When to do it:** Team values strict `domain → functions` acyclicity more than
the current pragmatic seam.

---

## Initiative B — Unified “persistable tick” type (memo open question)

**Problem:** Locations (`bulkUpsert`), trip lifecycle
([`VesselTripTickWritePlan`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/vesselTripTickWritePlan.ts)),
and timeline ([`TimelineTickProjectionInput`](../../convex/domain/vesselOrchestration/updateTimeline/tickEventWrites.ts))
are separate types passed through different code paths.

**Direction:** Introduce a **single** typed envelope (name TBD), e.g.
`OrchestratorTickPersistPlan`, grouping what one tick **could** persist, **or**
document explicitly that parallelism requires **separate** payloads and a
union is wrong. This is mostly **ergonomics and documentation**, not behavior.

**Pairing:** Complements Initiative A if you want one action-level `apply(...)`
signature; can also stand alone as types + README.

---

## Initiative C — Prefetch (Stage 2b / memo open question)

**Problem:** Per-vessel schedule lookups and/or **ML** model loads may fan out
queries within a tick.

**Direction:** One or a few **batched internal queries** at tick entry (e.g. by
**sailing day**, **active trip keys**, or **route** — breadth is the open
question), then implement
[`ScheduledSegmentLookup`](../../convex/domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment.ts)
and/or [`VesselTripPredictionModelAccess`](../../convex/domain/ml/prediction/vesselTripPredictionModelAccess.ts)
from **in-memory maps**.

**When to do it:** **Profiling** shows query count or latency dominates; ports
from Phase 2 should make this a **swap** of implementations behind the same
interfaces.

---

## Initiative D — Phase 3 Strategy A follow-up (optional)

If the team still wants **fewer deps** on
[`VesselOrchestratorTickDeps`](../../convex/domain/vesselOrchestration/types.ts):

- Collapse **`processVesselTrips` + `applyTickEventWrites`** into **`runTripBranch`**
  (two callbacks: locations + trip branch), per the Phase 3 orchestrator plan
  (`phase_3_orchestrator_tick` in repo plans) and the Phase 3 handoff.

**Tradeoff:** Merged vs split **metrics** (`processVesselTripsMs` vs
`applyTickEventWritesMs`) — see Phase 3 handoff and plan; align with dashboards
before merging timers.

---

## Initiative E — Hygiene and docs

- Update **`docs/handoffs/`** links that still describe **inline** wiring in
  [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts) to mention
  [`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts)
  where that improves accuracy.
- Refresh [`vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md)
  **section 1** (orchestrator action / deps) so it matches post–Phase 3 reality.
- Resolve memo **open question** on **`applyVesselTripTickWritePlan`** placement
  vs **internal mutation** only if Convex batching or deployment constraints
  justify it (usually low priority).

---

## Testing and verification (per initiative)

- **A / B:** Broad regression on orchestrator and trip tests; `bun run
  type-check`, `bun run convex:typecheck`.
- **C:** Load tests or staging metrics before/after; correctness tests for lookup
  parity.
- **D:** [`runVesselOrchestratorTick.test.ts`](../../convex/domain/vesselOrchestration/tests/runVesselOrchestratorTick.test.ts)
  + dashboard check for metrics field names.
- **E:** Doc-only or grep-driven consistency checks.

---

## Definition of done (per initiative)

Each initiative should ship with:

- Clear **scope** and **non-goals** in the PR description.
- **No accidental behavior change** unless called out (especially for A and D).
- Tooling green: `check:fix`, `type-check`, `convex:typecheck`, relevant tests.

---

## References

- Memo open questions: [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md) (section 7)
- Phase 3 handoff (Strategy A vs B): [`docs/handoffs/vessel-orchestrator-phase3-orchestrator-handoff-2026-04-17.md`](vessel-orchestrator-phase3-orchestrator-handoff-2026-04-17.md)

---

## Document history

- **2026-04-17:** Initial Phase 4 handoff (post–Phase 3 menu).
