# PRD: Vessel trips lifecycle & projection refactor

**Status:** Draft — Stage 2 complete (revise after each stage)  
**Owner:** TBD  
**Last updated:** 2026-04-08  

## Purpose

This document defines a **phased** refactor of `convex/functions/vesselTrips/updates` and related projection/read-model code. Stages are **sequential**: complete and sign off each stage before starting the next, unless a follow-up explicitly revises scope.

**Living document:** Update the **Revision log** at the bottom when a stage ships or requirements change.

---

## Goals

1. **Clear boundaries** between trip **lifecycle** (`activeVesselTrips` / `completedVesselTrips`), **timeline overlays** (`eventsActual`, `eventsPredicted`), and **read-model hydration**.
2. **Deterministic tick pipeline:** plan → persist lifecycle → project overlays (same ordering guarantees as today unless explicitly changed).
3. **Testable units:** lifecycle decisions vs projection intents vs DB adapters.
4. **No gratuitous behavior change:** each stage preserves existing semantics unless the stage explicitly calls out an intentional delta.

## Non-goals (for this PRD)

- Fixing all messy WSF feed edge cases (at-dock / at-sea transitions); isolate those behind clearer modules so they can be finessed later.
- Async outbox / replay **infrastructure** (optional **future** stage after the synchronous pipeline is stable).
- Rewriting ML training or schedule sync wholesale.

---

## References (must read for implementers)

| Resource | Path / link |
|----------|-------------|
| **Project code style (Cursor rule)** | [`.cursor/rules/code-style.mdc`](../.cursor/rules/code-style.mdc) — TypeScript strict, Biome, Bun, module layout, TSDoc, `bun run check:fix` / `bun run type-check` / `bun run convex:typecheck` |
| **Convex MCP cheat sheet** | [`docs/convex-mcp-cheat-sheet.md`](./convex-mcp-cheat-sheet.md) — using Convex MCP against this repo, auth, project dir |
| **VesselTrips updates architecture** | [`convex/functions/vesselTrips/updates/README.md`](../convex/functions/vesselTrips/updates/README.md) |
| **VesselTrips updates boundaries (Stage 1)** | [`convex/functions/vesselTrips/updates/ARCHITECTURE.md`](../convex/functions/vesselTrips/updates/ARCHITECTURE.md) — module checklist; Stage 3 import rules TBD |
| **Vessel orchestrator** | [`convex/functions/vesselOrchestrator/README.md`](../convex/functions/vesselOrchestrator/README.md) |
| **VesselTimeline domain** | [`convex/domain/vesselTimeline/README.md`](../convex/domain/vesselTimeline/README.md) |
| **Convex MCP (official)** | [Convex MCP server](https://docs.convex.dev/ai/convex-mcp-server) |

**Style compliance:** All Convex and app code must follow `.cursor/rules/code-style.mdc`. Agents should use **Bun** (`bun`, `bunx`, `bun run`) as specified there.

**Convex MCP:** When validating data, deployments, or using AI-assisted Convex tools, follow [`docs/convex-mcp-cheat-sheet.md`](./convex-mcp-cheat-sheet.md) for project connection and CLI/MCP usage.

---

## Current constraints (do not violate without explicit approval)

1. **Persist lifecycle before overlay projection** — Trip mutations must succeed before `eventsActual` / `eventsPredicted` projection mutations that assume durable trip state (see existing `processVesselTrips` ordering).
2. **Convex actions are not one global transaction** — Multi-mutation ticks require **idempotent** projection writes or documented retry behavior if split further later.
3. **Stored trips omit ML blobs** — `stripTripPredictionsForStorage` / join-on-read patterns remain the storage contract unless this PRD is amended.
4. **Bi-phase dock identity** — Schedule-assisted backfill (`resolveEffectiveLocation`, `shared/effectiveTripIdentity`, `dockedScheduleResolver`) is the intended direction; do not replace with feed-only “pending” as the sole strategy without product sign-off.

---

## Stage 1 — Contracts & pipeline map (no behavior change)

### Objectives

- Introduce **explicit types** for tick inputs, lifecycle commands, and projection intents (even if initially **aliases** to existing shapes).
- Document the **end-to-end tick** as a numbered pipeline (or diagram) aligned with code: `processVesselTrips` → `processCompletedTrips` / `processCurrentTrips` → mutations → `projectActualBoundaryPatches` / `projectPredictedBoundaryEffects`.
- Define **module boundary rules** (what may import what) as a checklist in [`updates/ARCHITECTURE.md`](../convex/functions/vesselTrips/updates/ARCHITECTURE.md) (Stage 1); optional forward links to stricter Stage 3 enforcement.

### Deliverables

- New or extended TypeScript types (e.g. `TripTickPlan`, `LifecycleCommand`, `ProjectionBatch`) colocated with `updates/` or `convex/domain/` per style guide (see [`updates/contracts.ts`](../convex/functions/vesselTrips/updates/contracts.ts)).
- No user-visible behavior change; existing tests pass unchanged.

### Acceptance criteria

- `bun run type-check` and `bun run convex:typecheck` pass.
- `bun run check:fix` (or project’s lint script) passes.
- `bun test convex/functions/vesselTrips/updates/tests/*.test.ts` (or project’s equivalent) passes.
- Types are used in at least one **call site** (thin wiring) or are justified as preparatory with a follow-up issue/stage note.

### Risks / notes

- Avoid “types-only” drift: types should mirror real data flow within one release cycle of Stage 2.

---

## Stage 2 — Split lifecycle persistence vs projection “dirty” checks

### Objectives

- **Decouple** “should we persist active/completed trip rows?” from “should we emit / refresh `eventsActual` or `eventsPredicted` effects this tick?”
- Today `tripsAreEqual` + `shouldWriteCurrentTrip` can gate **both**; projection-only updates must still run when lifecycle storage is unchanged (see analysis of prediction-only ticks).
- Introduce parallel predicates (names TBD), e.g. storage fingerprint vs projection fingerprint, while preserving **observable behavior** (including prediction-only refresh paths).

### Deliverables

- Refactored equality / write gating with **explicit** separation documented in code comments (TSDoc per style guide).
- Tests covering: lifecycle-only change, prediction-only change, timestamp-only churn, trip boundary.

### Acceptance criteria

- All Stage 1 acceptance criteria.
- No regression in projection behavior for ticks that previously relied on `tripsAreEqual` including normalized prediction fields.
- Documented invariant: **which fields** participate in lifecycle write suppression vs projection refresh.

### Risks / notes

- **Hydration:** If `existing` trip is loaded with or without `eventsPredicted` join, document how the new predicates stay consistent with [`hydrateTripPredictions.ts`](../convex/functions/vesselTrips/hydrateTripPredictions.ts) and orchestrator read model.

---

## Stage 3 — Projection builders out of lifecycle modules

### Objectives

- Remove **direct imports** of timeline projection builders (e.g. `buildPredictedBoundaryProjectionEffect` from `domain/vesselTimeline/normalizedEvents`) from **`processCurrentTrips` / `processCompletedTrips`**-style modules.
- **Composition root** (e.g. `processVesselTrips` or a dedicated `tickComposition.ts`) wires: lifecycle output facts → **projection helpers** → batched mutations.
- Optional: shared **DTO-only** module for effect shapes to avoid circular imports (behavior stays in projectors).

### Deliverables

- Folder/import structure reflecting: lifecycle package → emits facts/commands; projector package → builds `eventsActual` / `eventsPredicted` payloads.
- Enforceable rule documented: lifecycle modules do not import projection **implementations** (types-only shared path allowed).

### Acceptance criteria

- All Stage 2 acceptance criteria.
- Grep/architecture check: no `domain/vesselTimeline/*` projection **builders** imported from core lifecycle transition files (list allowed paths in PR description).

### Risks / notes

- Keep **one tick** semantics unless explicitly staging async work later.

---

## Stage 4 — Orchestrator read model & hydration alignment

### Objectives

- Align **orchestrator** `getOrchestratorTickReadModelInternal` and **`processVesselTrips`** inputs with Stage 2–3 decisions: lifecycle may consume **storage-native** active trips; **hydration** for API parity may remain on **query** paths or be narrowed to “projection diff only.”
- Document when `hydrateStoredTripsWithPredictions` runs and why (see [`convex/functions/vesselOrchestrator/queries.ts`](../convex/functions/vesselOrchestrator/queries.ts)).

### Deliverables

- Clear contract: what `activeTrips` passed into the tick **must** contain vs what is optional.
- Tests or internal docs for orchestrator + trip update interaction.

### Acceptance criteria

- All prior stage acceptance criteria.
- No duplicate `getActiveTrips` round-trips on the hot path unless justified and documented.

### Risks / notes

- **Non-atomic** action: if lifecycle succeeds and a later step fails, document behavior and logging.

---

## Stage 5 — Module layout cleanup & delete dead paths

### Objectives

- Final **folder names** (`tripLifecycle`, `projection`, etc.) and `index.ts` exports per code-style module rules.
- Remove obsolete helpers, duplicate README sections, and **finalize** architecture docs (updates README + this PRD).
- Optional: add **golden tick** fixtures for regression (location + prior trip snapshots).

### Deliverables

- Clean tree; single obvious entrypoint for the tick pipeline.
- Updated [`convex/functions/vesselTrips/updates/README.md`](../convex/functions/vesselTrips/updates/README.md) to match post-refactor reality.

### Acceptance criteria

- Full test suite relevant to vessel trips + convex typecheck green.
- README and this PRD updated; **Revision log** entry.

---

## Cross-cutting requirements (every stage)

- **TSDoc** on new exported functions; module top-level comment in new files (per `.cursor/rules/code-style.mdc`).
- **No `any`** in new code; validate public Convex args per project norms.
- **Performance:** preserve batching (`upsertVesselTripsBatch`, batched projection mutations) unless a stage explicitly benchmarks a change.

---

## Future (out of scope for Stages 1–5)

- **Outbox table + internal consumer** for projection retries and replay.
- **Stronger idempotency keys** on `projectPredictedBoundaryEffects` / `projectActualBoundaryPatches` if split across more mutations.

---

## Revision log

| Date | Stage | Change |
|------|--------|--------|
| 2026-04-08 | — | Initial draft |
| 2026-04-08 | 1 | Added `updates/contracts.ts`, wired `processVesselTrips` to `TripTickPlan` / merged `ProjectionBatch`, documented numbered pipeline and `ARCHITECTURE.md` ([`c9f5e140`](https://github.com/RobJacobson/ferryjoy-client-neo/commit/c9f5e140beb95a9e1b5f844d3049d3110cf5eacc)) |
| 2026-04-08 | — | PRD: status set to Stage 1 complete; References + Stage 1 links to `ARCHITECTURE.md`; revision log traceability |
| 2026-04-08 | 2 | Split lifecycle persistence vs projection refresh: `lifecycleTripsEqual` / `shouldPersistLifecycleTrip`, `shouldRefreshTimelineProjection`; `processCurrentTrips` projection-only path; tests and `updates/ARCHITECTURE.md` invariants |

