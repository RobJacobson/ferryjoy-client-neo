# Vessel orchestrator PRD — working set

This folder is the **canonical working set** for the `vesselOrchestration/` tree migration.
Keep it **small**, **forward-only**, and **implementation-oriented**.

## Source-of-truth rules

1. **Code is the source of truth for current behavior.**
2. **`vessel-orchestration-next-work-prd.md` is the source of truth for target structure, sequencing, and purity direction.**
3. **`migration-inventory.md` is the required audit artifact before any file moves.**
4. Background docs outside this folder are **optional context**, not required reading for the migration. If they disagree with code or this PRD, do **not** follow them blindly.

## Start here

| File | Purpose |
|------|---------|
| **[`vessel-orchestration-next-work-prd.md`](vessel-orchestration-next-work-prd.md)** | Canonical PRD: target tree, import rules, execution sequence **S0–S10**, layering, and anti-patterns. **Start here.** |
| **[`migration-inventory.md`](migration-inventory.md)** | **S0** audit artifact. Fill it from the current codebase before any file moves. |

## Background only

Open these only if you need extra history or rationale:

- [`../engineering/vessel-orchestrator-decoupling-agents-memo.md`](../engineering/vessel-orchestrator-decoupling-agents-memo.md)
- [`../engineering/imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- [`../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)
- [`../../convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md)
