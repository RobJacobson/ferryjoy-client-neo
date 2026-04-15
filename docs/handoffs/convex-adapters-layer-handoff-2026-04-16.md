# Handoff: Introduce `convex/adapters/` (boundary layer)

**Date:** 2026-04-16  
**Audience:** implementation agent  
**Goal:** Add a **peer layer** to `convex/domain/` and `convex/functions/`: **`convex/adapters/`** holds **all code that belongs to the boundary** between external systems (WSF APIs, raw vendor shapes) and **backend-owned types / Convex persistence**. Shrink `convex/shared/` so it is **not** a catch-all for “imported twice”—reserve it for **genuinely generic** utilities.

This handoff does **not** require completing every move in one PR; use phased PRs with green CI at each step.

---

## Problem statement

1. **`shared/`** has accumulated **integration and multi-caller** code (e.g. WSF fetch helpers used from Convex **and** offline ML). That makes **discoverability** poor and blurs “generic util” vs “vendor boundary.”
2. **`functions/`** folders sometimes contain **long ingress pipelines** (fetch → map → domain → persist). That can **feel** like “business logic at the database layer,” even when domain already owns rules—because the **translation** layer is not named.
3. We want an **easy-to-understand adapter pattern**: **WSF → Convex (or internal DTO)**, and optionally **Convex doc → domain inputs**, without duplicating **business rules** outside `domain/`.

---

## Target architecture (three peers)

| Layer | Owns | Must not own |
|-------|------|----------------|
| **`convex/functions/`** | Convex **`query` / `mutation` / `action` / `internalAction`**, `ctx`, orchestration **wiring** (call adapter → domain → mutation) | Heavy vendor mapping, HTTP clients, classification policy |
| **`convex/domain/`** | **Business rules**, pipelines (`runScheduleTransformPipeline`, trip lifecycle, orchestration **after** inputs are typed) | Raw WSF HTTP, env-specific fetch, `ctx` |
| **`convex/adapters/`** (new) | **Boundary translation**: fetch wrappers, raw-segment → row/DTO, “ingress” modules, **integration** reused by scripts/ML | Product rules that belong in domain; Convex registration |

**`convex/shared/`** (reduced): **Cross-cutting primitives** with **no vendor story** (e.g. time helpers, key helpers, small pure utilities)—document this rule in [`convex/domain/README.md`](../../convex/domain/README.md) or a short [`convex/shared/README.md`](../../convex/shared/README.md) if you add one.

Mental flow:

```text
External API (WSF) / scripts
  → adapters (fetch + map to internal / Convex-shaped DTOs)
  → domain (rules, pipelines)
  → functions (Convex API + persistence)
```

This aligns with how **VesselOrchestrator** already separates **fetch** (`shared/fetchWsfVesselLocations` + `toConvexVesselLocation` in functions) from **`runVesselOrchestratorTick`** in domain—adapters would **name** that edge explicitly.

---

## Suggested folder shape

Initial proposal (adjust as you implement):

```text
convex/adapters/
  README.md                 # boundary definition + import rules
  wsf/                      # Washington State Ferries integration
    fetchVesselLocations.ts # move from shared/fetchWsfVesselLocations.ts
    scheduledTrips/         # optional: migrate from functions/scheduledTrips/sync/*
    index.ts                # optional barrel; avoid mega-barrels per project rules
```

**Naming:** Prefer **integration-first** (`wsf/`) so future non-WSF sources get their own subtree without polluting `shared/`.

**Convex codegen:** Adapters are **plain TypeScript modules** (not `query`/`mutation`/`action` files) unless you deliberately register something—keep them **import-only** so they do not appear as Convex endpoints.

---

## Guardrails (avoid a second chum-bucket)

1. **Adapters translate; domain decides.** Classification, estimates, official crossing policy, trip lifecycle branching → **`domain/`**.
2. **If it only knows about WSF routes, segments, or env keys** → **`adapters/`**, not `shared/`.
3. **Functions stay thin:** `actions.ts` imports adapter + domain; minimal glue.
4. **ML / scripts** may import from `convex/adapters/wsf/...` instead of `convex/shared/...` for the same implementation—**one canonical** fetch/map location.

---

## Phased rollout (recommended)

### Phase 1 — Scaffold + one vertical slice

1. Create **`convex/adapters/README.md`** with the contract above.
2. Move **`convex/shared/fetchWsfVesselLocations.ts`** → **`convex/adapters/wsf/fetchVesselLocations.ts`** (or equivalent name), update imports (`vesselOrchestrator/actions.ts`, ML scripts, any tests).
3. Run **`bun run check:fix`**, **`bun run type-check`**, **`bun run convex:typecheck`**, **`bun test`** for touched areas.

### Phase 2 — Scheduled trips ingress

1. Migrate **WSF download + raw mapping** currently under [`convex/functions/scheduledTrips/sync/`](../../convex/functions/scheduledTrips/sync/) into **`convex/adapters/wsf/scheduledTrips/`** (or keep a thin **`functions/scheduledTrips/ingest/`** shell that only calls adapters—see existing restructuring ideas in [`docs/handoffs/scheduled-trips-functions-domain-cleanup-handoff-2026-04-15.md`](scheduled-trips-functions-domain-cleanup-handoff-2026-04-15.md)).
2. Leave **`runScheduleTransformPipeline`** and related rules in **`convex/domain/scheduledTrips/`**.
3. Optionally rename **`sync/`** → **`ingest/`** under functions for clarity (separate PR).

### Phase 3 — Tighten `shared/`

1. Audit `convex/shared/` for **vendor or integration** code; move to **`adapters/`**.
2. Add **`convex/shared/README.md`** listing what **may** live there (short).

---

## Verification checklist

- [ ] No duplicate fetch implementations; ML and Convex use the same adapter module where intended.
- [ ] Domain modules do **not** import HTTP or raw WSF types unless through a **typed port** passed in (prefer adapters producing DTOs).
- [ ] `functions/*` handlers remain **thin**; complex transforms live in **adapters** or **domain** as appropriate.
- [ ] Documentation updated: domain README, scheduled trips README, orchestrator README if import paths change.

---

## Reference `*.md` files (links)

### Convex — boundary and modules

- [`convex/domain/README.md`](../../convex/domain/README.md) — domain vs functions conventions (update after adapters land).
- [`convex/domain/ml/readme-ml.md`](../../convex/domain/ml/readme-ml.md) — ML + schedule/trip pipelines; many paths cite `functions`/`domain`.

### Convex — functions (entrypoints + ingress today)

- [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) — fetch vs `runVesselOrchestratorTick`.
- [`convex/functions/vesselTrips/README.md`](../../convex/functions/vesselTrips/README.md) — thin surface + domain pointers.
- [`convex/functions/scheduledTrips/README.md`](../../convex/functions/scheduledTrips/README.md) — scheduled trips public surface.
- [`convex/functions/scheduledTrips/sync/README.md`](../../convex/functions/scheduledTrips/sync/README.md) — current **sync adapter** narrative (may move/rename during adapters work).

### Repository root

- [`README.md`](../../README.md) — project structure overview.

### Prior handoffs (context for this work)

- [`docs/handoffs/scheduled-trips-functions-domain-cleanup-handoff-2026-04-15.md`](scheduled-trips-functions-domain-cleanup-handoff-2026-04-15.md) — scheduled trips cleanup + optional `sync` rename.
- [`docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`](convex-functions-domain-boundary-reorg-memo-2026-04-14.md) — historical functions/domain split.
- [`docs/handoffs/convex-domain-boundary-reorg-quality-review-2026-04-14.md`](convex-domain-boundary-reorg-quality-review-2026-04-14.md) — quality review, coverage notes.
- [`docs/handoffs/vessel-trip-and-timeline-redesign-spec-2026-04-12.md`](vessel-trip-and-timeline-redesign-spec-2026-04-12.md) — large timeline/trip spec (cross-links).
- [`docs/handoffs/vessel-timeline-module-boundary-handoff-2026-04-13.md`](vessel-timeline-module-boundary-handoff-2026-04-13.md) — timeline module boundaries.
- [`docs/handoffs/vesseltimeline-reconciliation-memo-2026-04-14.md`](vesseltimeline-reconciliation-memo-2026-04-14.md) — reconciliation.
- [`docs/handoffs/vessel-trip-timestamp-glossary-2026-04-15.md`](vessel-trip-timestamp-glossary-2026-04-15.md) — timestamp glossary.
- [`docs/handoffs/trip-timestamp-semantics-prd-2026-04-14.md`](trip-timestamp-semantics-prd-2026-04-14.md) — semantics PRD.
- [`docs/handoffs/trip-timestamp-semantics-memo-2026-04-14.md`](trip-timestamp-semantics-memo-2026-04-14.md) — semantics memo.

### Optional

- [`docs/ai-agent-architecture-research-memo.md`](../ai-agent-architecture-research-memo.md) — if useful for agent-wide layering language.

---

## Non-goals (for this initiative)

- Rewriting **domain** business rules—only **relocate and name** boundary code.
- Introducing a **fourth** Convex “deployment” concept; `adapters` remains **import-only** TypeScript.

---

## First files to grep when starting

- `fetchWsfVesselLocations` / `fetchWsfScheduleData` / `scheduledTrips/sync`
- `from "shared/` imports that touch WSF or raw schedule types

Good luck—keep PRs small and documented.
