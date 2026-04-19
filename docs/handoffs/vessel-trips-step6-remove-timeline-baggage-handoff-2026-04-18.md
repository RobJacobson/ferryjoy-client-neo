# Handoff: Step 6 — Remove trip-path timeline baggage

**Date:** 2026-04-18  
**Audience:** engineers or agents executing Step 6 of the vessel-trips refactor  
**Roadmap:** [`docs/engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)  
**Prerequisites:** Steps 1–5 — especially [`vessel-trips-step5-collapse-public-surface-handoff-2026-04-18.md`](./vessel-trips-step5-collapse-public-surface-handoff-2026-04-18.md) (barrel-only external imports)

## Purpose

Deliver memo **Step 6 — Remove trip-path timeline baggage**: stop treating **`TripLifecycleApplyOutcome`** and other **`updateTimeline`** shapes as the **primary output** of the trip tick, and remove **`updateVesselTrips`**’s dependency on **`updateTimeline`** for its **core** types (memo acceptance: trip domain has **no** imports from **`updateTimeline`** for primary outputs).

**Status (2026-04-18):** **Shipped** — Handshake DTOs and projection wire shapes live in **`domain/vesselOrchestration/tickLifecycle`** (`TripTickLifecycleOutcome` with **`TripLifecycleApplyOutcome`** / **`VesselTripPersistResult`** as aliases). **`updateTimeline/types.ts`** and **`tickEventWrites.ts`** re-export from **`tickLifecycle`**; **`updateVesselTrips/**`** has **no** `updateTimeline` imports (Biome-enforced). **`persistVesselTripWriteSet`** returns **`VesselTripPersistResult`**; **`updateVesselTrips`** in `actions.ts` exposes that label; timeline merge still uses the same struct. Integration tests moved to **`updateTimeline/tests/`** and **`orchestratorTick/tests/`**.

## Goal

- **Trip-native outputs** — Persist and compute layers expose **rows / facts / intents** aligned with trip tables and the existing **`VesselTripTickWriteSet`** story, without **`TripLifecycleApplyOutcome`** as the return type of **`persistVesselTripWriteSet`** (or equivalent) from the trip lane’s perspective.
- **Decouple `updateVesselTrips` from `updateTimeline` imports** — Move or duplicate **handoff DTOs** into a **neutral** module (e.g. `tripTimelineBridge`, `orchestratorTick` types, or `shared/`) *or* have **`updateTimeline`** own assembly while the trip step emits only **storage-shaped** or **minimal fact** lists (memo §Design principles: boundary facts are downstream handoffs, not the trip module’s long-term public contract).
- **Orchestrator wiring** — [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts) may **construct** or **map** into **`TripLifecycleApplyOutcome`** for the predictions/timeline phases until those steps are refactored, so **`functions`** owns the glue, not **`updateVesselTrips`**.
- **Interim strategies (memo)** — Timeline/predictions may **read persisted DB state**, recompute slices, or call a **thin bridge**; parity tests should prove **no behavior regression** on dock projection and ML merge.

## Non-goals (this step)

- **No** mandatory **`runUpdateVesselTrips`** rename or Step 5–style barrel-only pass over unrelated folders (**Step 7** doc/dead-code sweep).
- **No** complete redesign of **`updateVesselPredictions`** unless required to drop **`VesselTripsComputeBundle`** coupling; prefer **narrow adapters** and **temporary** outcome shaping in **`orchestratorTick`** / **`actions.ts`**.
- **No** change to bulk schedule snapshot contracts (**Step 4**) unless import moves force file splits.

## Landmarks after Step 6 (reference)

| Area | Location |
|------|----------|
| Canonical handshake + aliases | [`tickLifecycle/types.ts`](../../convex/domain/vesselOrchestration/tickLifecycle/types.ts), [`tickLifecycle/index.ts`](../../convex/domain/vesselOrchestration/tickLifecycle/index.ts) |
| Projection wire | [`tickLifecycle/projectionWire.ts`](../../convex/domain/vesselOrchestration/tickLifecycle/projectionWire.ts) |
| Timeline re-exports | [`updateTimeline/types.ts`](../../convex/domain/vesselOrchestration/updateTimeline/types.ts), [`updateTimeline/tickEventWrites.ts`](../../convex/domain/vesselOrchestration/updateTimeline/tickEventWrites.ts) |
| Persist | [`orchestratorTick/persistVesselTripsCompute.ts`](../../convex/domain/vesselOrchestration/orchestratorTick/persistVesselTripsCompute.ts) — **`Promise<VesselTripPersistResult>`** |
| Orchestrator | [`functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts) |
| Guardrail | [`biome.json`](../../biome.json) — `updateVesselTrips/**/*.ts` must not import **`updateTimeline/**`** |

## Implementation notes (suggested)

1. **Inventory** — List every `updateTimeline` import under **`updateVesselTrips/**`** and classify: **can move to neutral types**, **can be built in orchestratorTick**, or **timeline-only** (delete from trip path if cron/tick no longer queues messages).
2. **Define the new persist result** — e.g. **`VesselTripPersistResult`** with **`completedFacts`**-shaped data using **trip-owned** types, plus explicit fields timeline needs—or **only** IDs/keys if timeline reads DB.
3. **Map to legacy at the boundary** — Single function in **`orchestratorTick`** or **`actions.ts`**: `tripPersistResult → TripLifecycleApplyOutcome` until Step 6+ consumers are updated.
4. **Tests** — Orchestrator tick tests, **`persistVesselTripsCompute`**, **`processCompletedTrips`**, timeline projection tests: update fixtures and assertions for the new boundary; keep **behavioral parity** where production semantics require it.

## Acceptance criteria (memo)

- **`updateVesselTrips`** does not import **`updateTimeline`** for its **primary** output / core bundle typing (handoff lists current files to clear).
- **`TripLifecycleApplyOutcome`** is no longer **produced** as the direct return of the trip persist entry from the **domain trip** perspective—or the trip step returns a trip-native shape and **only** the orchestrator glue constructs timeline outcomes (document the chosen split).
- **`bun run type-check`**, **`bun run test`**, **`bun run convex:typecheck`** pass.

## Verification

```bash
bun run check:fix
bun run type-check
bun run test
bun run convex:typecheck
```

Confirm no stray coupling:

```bash
rg 'from "domain/vesselOrchestration/updateTimeline' convex/domain/vesselOrchestration/updateVesselTrips --glob '*.ts'
```

(Expect **no** matches when Step 6 is complete; tests that intentionally integration-test across modules may need imports from **`updateTimeline`** only if relocated—prefer moving those tests next to the bridge.)

## Related docs

- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md) — §(b) target end state, §Messages/cron/timeline
- [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)
- [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) — orchestrator sequence and timeline merge
