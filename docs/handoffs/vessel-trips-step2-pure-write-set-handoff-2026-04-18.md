# Handoff: Step 2 — Pure trip tick write set (parallel path)

**Date:** 2026-04-18  
**Audience:** engineers or agents executing Step 2 of the vessel-trips refactor  
**Roadmap:** [`docs/engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)  
**Prerequisite:** Step 1 (tick anchor) complete — [`vessel-trips-step1-tick-anchor-handoff-2026-04-18.md`](./vessel-trips-step1-tick-anchor-handoff-2026-04-18.md)

## Purpose

Introduce a **serializable “write set” type** for the vessel-trips tick that mirrors **storage row shapes** (completed vs in-service buckets), and a **parallel pure computation** that fills it from the same inputs as today’s bundle path—**without** switching orchestrator persistence yet.

This step establishes the **data contract** for the later “pure domain → idempotent functions persistence” split (Step 3). It deliberately **does not** delete `VesselTripsComputeBundle`, `persistVesselTripsCompute`, or `buildVesselTripsExecutionPayloads`.

**Status (2026-04-18):** Implemented — `vesselTripTickWriteSet.ts`, `leaveDockActualization.ts`, `orchestratorTick/tests/vesselTripTickWriteSet.test.ts`; exports on `orchestratorTick` (domain root unchanged).

## Goal

- Define a type (working name **`VesselTripTickWriteSet`**, TBD) with at least:
  - **Completed** — rows or write-shaped POJOs aligned to the **completed-trips** table (exact fields follow existing schema and mutation args).
  - **In-service** — **new + continuing** active trip rows in one stream (aligned to **`activeVesselTrips`** / batch upsert shape), idempotent by natural keys as today’s storage expects.
- Implement **`buildVesselTripTickWriteSet`** (or equivalent) as a **pure** function or small pipeline that:
  - Takes the **same conceptual inputs** as the existing tick compute (locations, active trips, deps, tick policy)—reuse or wrap `computeVesselTripsBundle` / `computeVesselTripsWithClock` internals only as needed; avoid `ActionCtx` and Convex in the **unit-tested** surface.
  - Produces **`VesselTripTickWriteSet`** **in parallel** with the legacy bundle (feature flag, internal-only export, or test-only caller is fine).
- Types should be **JSON-serializable POJOs** where possible (no functions, no mutation handles).

## Non-goals (this step)

- **No** change to `updateVesselOrchestrator` production path that persists trips (still `computeVesselTripsWithClock` → `persistVesselTripsCompute`).
- **No** replacement of `buildVesselTripsExecutionPayloads` or `TripLifecycleApplyOutcome` emission (Step 3).
- **No** bulk schedule snapshot / `ScheduledSegmentLookup` removal (Step 4).
- **No** barrel collapse or `runUpdateVesselTrips` rename as the sole public API (Step 5)—optional stub naming only if it clarifies intent.

## Current landmarks (read first)

| Area | Location |
|------|----------|
| Bundle shape | `convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/vesselTripsComputeBundle.ts` — `VesselTripsComputeBundle`: `completedHandoffs` + `current` (`activeUpserts`, messages, `pendingLeaveDockEffects`). |
| Execution payloads | `convex/domain/vesselOrchestration/orchestratorTick/vesselTripsExecutionPayloads.ts` — maps bundle → mutation-oriented payloads (`buildVesselTripsExecutionPayloads`); anti-pattern name per memo; **target for retirement in Step 3**. |
| Write set (Step 2) | `convex/domain/vesselOrchestration/orchestratorTick/vesselTripTickWriteSet.ts` — `VesselTripTickWriteSet` + `buildVesselTripTickWriteSetFromBundle` (parallel to persist; uses same payload builder). |
| Leave-dock timestamp | `convex/domain/vesselOrchestration/orchestratorTick/leaveDockActualization.ts` — `actualDepartMsForLeaveDockEffect` shared with `persistVesselTripsCompute`. |
| Persist | `convex/domain/vesselOrchestration/orchestratorTick/persistVesselTripsCompute.ts` — drives Convex mutations from execution payloads; returns `TripLifecycleApplyOutcome`. |
| Strip for storage | `convex/domain/vesselOrchestration/updateVesselPredictions/stripTripPredictionsForStorage.ts` — ML fields stripped before persistence; write set should match **stored** trip shapes. |
| Schemas | `convex/functions/vesselTrips/schemas.ts` — `ConvexVesselTrip`, `vesselTripStoredSchema`, enriched query shapes. |

## Suggested implementation outline

1. **Lock the write-set schema** — List exact table write shapes (completed vs active) from mutations and validators; document them as the fields of `VesselTripTickWriteSet` (may include small metadata arrays if required for idempotency).
2. **Pure mapper or parallel compute** — Either:
   - derive `VesselTripTickWriteSet` **from** `VesselTripsComputeBundle` in a pure mapper (fastest path to parity tests), or
   - duplicate the minimal logic from bundle construction with shared helpers (heavier; only if mapper is lossy).
3. **Call site** — Wire an **internal or test-only** entry (e.g. `buildVesselTripTickWriteSetFromBundle(bundle)`) so CI runs unit tests; optionally assert parity with a golden fixture from the bundle.
4. **Tests** — Fixtures in `convex/domain/.../tests/`; **no Convex** in domain unit tests for the mapper; assert round-trip field presence and strip rules (predictions off storage rows).

## Acceptance criteria

- `VesselTripTickWriteSet` (or chosen name) is **documented** and matches **storage-oriented** rows, not timeline handoff types.
- **Unit tests** cover mapping from representative **fixtures** (empty tick, handoff + active upsert, leave-dock follow-up if represented in write set).
- Legacy path remains **unchanged** for production orchestrator behavior.

## Verification

```bash
bun run type-check
bun run test
```

## Related docs

- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md) — Step 2–3 boundaries and “no write plans as domain output”
- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md) — if new modules need export boundaries

**Consumers:** import from `domain/vesselOrchestration` as `orchestratorTick.buildVesselTripTickWriteSetFromBundle` / types (same namespace pattern as other orchestrator tick symbols).
