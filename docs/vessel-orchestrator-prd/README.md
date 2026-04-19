# Vessel orchestrator PRD — document home

This folder holds **forward-only** instructions for restructuring `convex/domain/vesselOrchestration` and related orchestrator code.

| File | Purpose |
|------|---------|
| **[`vessel-orchestration-next-work-prd.md`](vessel-orchestration-next-work-prd.md)** | Canonical PRD: target tree, import rules (inlined), execution sequence **S0–S10**, layering, anti-patterns. **Start here.** |
| **[`migration-inventory.md`](migration-inventory.md)** | **S0** audit template — fill before any file moves; one row per file under `tickLifecycle/`, `orchestratorTick/`, and cross-cutting `updateVesselTrips` paths. |

**Related (outside this folder):** [`../engineering/vessel-orchestrator-decoupling-agents-memo.md`](../engineering/vessel-orchestrator-decoupling-agents-memo.md), [`../engineering/imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md), [`../../convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md).

Do **not** add unrelated engineering notes here; keep this directory **small** and **action-oriented**.
