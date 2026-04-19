# Handoff: Step 7 — Cleanup and documentation

**Date:** 2026-04-18  
**Audience:** engineers or agents executing Step 7 (final cleanup) of the vessel-trips pure-pipeline refactor  
**Roadmap:** [`docs/engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)  
**Prerequisites:** Steps 1–6 — especially [`vessel-trips-step6-remove-timeline-baggage-handoff-2026-04-18.md`](./vessel-trips-step6-remove-timeline-baggage-handoff-2026-04-18.md) (`tickLifecycle`, no `updateTimeline` imports under `updateVesselTrips/`)

## Purpose

Deliver memo **Step 7 — Cleanup and documentation**: remove **dead or legacy** trip-path code left over from earlier steps, align **docs and naming** with the steady-state story (canonical trip tick API, clear orchestrator layering), and close the loop on the roadmap memo.

This step is **hygiene and clarity**, not new product behavior—delete or consolidate only with **tests proving parity** (or explicit sign-off on removed paths).

**Status (2026-04-18):** Not started.

## Goal

- **Dead code** — Audit and remove (or inline) leftovers called out in the memo, e.g. **`vesselTripsExecutionPayloads`** / **`buildVesselTripsExecutionPayloads`** if **`buildVesselTripTickWriteSetFromBundle`** and related helpers fully subsume that layer; drop **obsolete fields** on **`VesselTripsComputeBundle`** or related types if nothing reads them; trim **unused “messages”** on the trip path if production no longer queues them for cron/timeline assembly (confirm against **`tickLifecycle`** and **`updateTimeline`** consumers first).
- **Naming (memo acceptance)** — Documentation should describe the **canonical trip tick API** clearly. Today the orchestrator still uses **`computeVesselTripsWithClock`** + **`computeVesselTripsBundle`**; the memo’s long-term name **`runUpdateVesselTrips`** may be introduced here **only if** a rename is low-churn and reviewers agree—otherwise document the **actual** entry points (`computeVesselTripsWithClock`, `updateVesselTrips` in `actions.ts`, `persistVesselTripWriteSet`) as the supported contract.
- **Docs to touch** — At minimum: [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md), [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md), and **[`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)** (status / revision history / Steps 1–7 checklist). Update any READMEs under **`updateVesselTrips/`** that still describe pre-**`tickLifecycle`** or pre–write-set wiring.
- **Barrels** — Ensure **`domain/vesselOrchestration/index.ts`**, **`updateVesselTrips/index.ts`**, and **`orchestratorTick/index.ts`** exports match the story after deletions (no dangling re-exports).

## Non-goals (this step)

- **No** full **`updateVesselPredictions`** redesign (tracked separately unless cleanup forces a tiny import trim).
- **No** bulk snapshot or **`getScheduleSnapshotForTick`** semantic changes.
- **No** large folder moves (**Step 5** optional `completed/` / `inService/` / `shared/` split) unless bundled with a dedicated follow-up PR.

## Current landmarks (audit first)

| Area | Notes |
|------|--------|
| Execution payloads | [`orchestratorTick/vesselTripsExecutionPayloads.ts`](../../convex/domain/vesselOrchestration/orchestratorTick/vesselTripsExecutionPayloads.ts) — still used by **`vesselTripTickWriteSet.ts`**, **`persistVesselTripsCompute.ts`**, tests; confirm before deleting. |
| Write set | [`orchestratorTick/vesselTripTickWriteSet.ts`](../../convex/domain/vesselOrchestration/orchestratorTick/vesselTripTickWriteSet.ts) — primary mapping from bundle → mutations. |
| Bundle | [`updateVesselTrips/tripLifecycle/vesselTripsComputeBundle.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/vesselTripsComputeBundle.ts) — `pending*Messages` fields vs timeline expectations. |
| Tick handshake | [`tickLifecycle/`](../../convex/domain/vesselOrchestration/tickLifecycle/) — source of truth for lifecycle outcome shapes post–Step 6. |

## Acceptance criteria (memo)

- CI green: **`bun run check:fix`**, **`bun run type-check`**, **`bun run test`**, **`bun run convex:typecheck`**.
- Engineering memo and domain/orchestrator docs **describe the shipped pipeline** (`tickLifecycle`, write-set persist, snapshot-backed deps) and, if applicable, state **`runUpdateVesselTrips`** vs actual API names honestly.
- No unexplained dead exports or orphaned files left in the trip/orchestrator tick tree after cleanup.

## Verification

```bash
bun run check:fix
bun run type-check
bun run test
bun run convex:typecheck
```

## Related docs

- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md) — §Step 7, §(b) target end state
- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- Step 5–6 handoffs — barrel and **`tickLifecycle`** boundaries
