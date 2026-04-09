# PRD: Vessel trips lifecycle & projection refactor

**Status:** Complete — Stages 1–5 shipped  
**Owner:** TBD  
**Last updated:** 2026-04-09  

## Purpose

This document defined a **phased** refactor of `convex/functions/vesselTrips/updates` and related projection/read-model code. Stages were **sequential**; **all planned stages are done.** Follow-up work lives under [Future](#future-out-of-scope-for-stages-15) or separate PRDs (e.g. WSF feed hardening).

**Living document:** Append to the **Revision log** if you amend contracts or add follow-on refactors that supersede sections here.

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
| **VesselTrips updates boundaries** | [`convex/functions/vesselTrips/updates/ARCHITECTURE.md`](../convex/functions/vesselTrips/updates/ARCHITECTURE.md) — module checklist; lifecycle vs projection invariants; import rules for `tripLifecycle/` vs `projection/` vs barrel |
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

**Shipped.** See [`processTick/contracts.ts`](../convex/functions/vesselTrips/updates/processTick/contracts.ts) and pipeline sections in [`updates/README.md`](../convex/functions/vesselTrips/updates/README.md).

### Objectives

- Introduce **explicit types** for tick inputs, lifecycle commands, and projection intents (even if initially **aliases** to existing shapes).
- Document the **end-to-end tick** as a numbered pipeline (or diagram) aligned with code: `processVesselTrips` → `processCompletedTrips` / `processCurrentTrips` → mutations → `projectActualBoundaryPatches` / `projectPredictedBoundaryEffects`.
- Define **module boundary rules** (what may import what) as a checklist in [`updates/ARCHITECTURE.md`](../convex/functions/vesselTrips/updates/ARCHITECTURE.md); tightened in Stages 3–5 (projection vs lifecycle vs `processTick/`).

### Deliverables

- New or extended TypeScript types (e.g. `TripTickPlan`, `LifecycleCommand`, `ProjectionBatch`) colocated with `updates/` or `convex/domain/` per style guide (see [`processTick/contracts.ts`](../convex/functions/vesselTrips/updates/processTick/contracts.ts)).
- No user-visible behavior change; existing tests pass unchanged.

### Acceptance criteria

- `bun run type-check` and `bun run convex:typecheck` pass.
- `bun run check:fix` (or project’s lint script) passes.
- `bun test convex/functions/vesselTrips/updates/tests/*.test.ts` (or project’s equivalent) passes.
- Types are used in at least one **call site** (thin wiring) or are justified as preparatory with a follow-up issue/stage note.

### Risks / notes

- **Resolved (post–Stage 2):** `contracts.ts` is wired in `processVesselTrips`; drift risk was the original Stage 1 concern.

---

## Stage 2 — Split lifecycle persistence vs projection “dirty” checks

**Shipped.** Active-trip path uses explicit predicates and tagged overlay payloads; see [`tripLifecycle/tripEquality.ts`](../convex/functions/vesselTrips/updates/tripLifecycle/tripEquality.ts), [`tripLifecycle/processCurrentTrips.ts`](../convex/functions/vesselTrips/updates/tripLifecycle/processCurrentTrips.ts), [`tests/tripEquality.test.ts`](../convex/functions/vesselTrips/updates/tests/tripEquality.test.ts).

### Objectives

- **Decouple** “should we persist active/completed trip rows?” from “should we emit / refresh `eventsActual` or `eventsPredicted` effects this tick?”
- **Lifecycle:** `tripsEqualForStorage` (module-private `lifecycleTripsEqual`; both sides passed through `stripTripPredictionsForStorage`; `TimeStamp` ignored) so persistence matches `activeVesselTrips` columns only. Upsert when `!tripsEqualForStorage`.
- **Projection:** `tripsEqualForOverlay` (module-private `overlayTripsEqual`; normalized prediction fields) so overlay refresh matches prior behavior, including prediction-only ticks **without** an upsert when stored columns are unchanged. Refresh overlays when `!tripsEqualForOverlay`.
- **Ordering:** Completed branch unchanged; current branch uses `requiresSuccessfulUpsert` so leave-dock backfill and upsert-gated overlays stay tied to successful `upsertVesselTripsBatch` rows.

### Deliverables

- Refactored equality / write gating with **explicit** separation documented in code comments (TSDoc per style guide).
- Tests covering: lifecycle-only change, prediction-only change, timestamp-only churn, trip boundary.

### Acceptance criteria

- All Stage 1 acceptance criteria.
- No regression in projection behavior for ticks that previously relied on overlay trip equality (`overlayTripsEqual`) including normalized prediction fields.
- Documented invariant: **which fields** participate in lifecycle write suppression vs projection refresh ([`updates/ARCHITECTURE.md`](../convex/functions/vesselTrips/updates/ARCHITECTURE.md) Stage 2 table).

### Risks / notes

- **Hydration:** storage comparison strips the five ML fields on **both** sides, so hydrated `existingTrip` rows align with strip-shaped persistence; projection uses overlay equality for timeline semantics. **Stage 4:** orchestrator tick path uses **storage-native** `TickActiveTrip` preloads; **public `getActiveTrips`** remains **hydrated** for subscribers (see `hydrateTripPredictions.ts`).

---

## Stage 3 — Projection builders out of lifecycle modules

**Shipped.** Timeline overlay payloads are built in [`projection/timelineProjectionProjector.ts`](../convex/functions/vesselTrips/updates/projection/timelineProjectionProjector.ts) from DTOs in [`projection/projectionContracts.ts`](../convex/functions/vesselTrips/updates/projection/projectionContracts.ts); lifecycle branch files under [`tripLifecycle/`](../convex/functions/vesselTrips/updates/tripLifecycle/) do not import `domain/vesselTimeline` projection builders.

### Prerequisites (before starting)

- Stage 2 merged; **current-trip** lifecycle no longer couples overlay emission to lifecycle upserts for prediction-only ticks.
- **(Historical)** Move imports of `buildPredictedBoundaryProjectionEffect`, `buildPredictedBoundaryClearEffect`, and related patch builders out of `processCurrentTrips` / `processCompletedTrips` into the projector — **done** in Stage 3.

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

**Shipped.** `getOrchestratorTickReadModelInternal` returns storage-native active trips (`vesselTripStoredSchema`); `processVesselTrips` accepts `ReadonlyArray<TickActiveTrip>` with optional transitional hydrated shape; see orchestrator and [`vesselTrips/queries.ts`](../convex/functions/vesselTrips/queries.ts) TSDoc.

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

**Shipped.** `tripLifecycle/`, `projection/`, and `processTick/` under `updates/`; public barrel [`updates/index.ts`](../convex/functions/vesselTrips/updates/index.ts); removed `processVesselTrips/` shim folder.

### Objectives

- Final **folder names** (`tripLifecycle`, `projection`, etc.) and `index.ts` exports per code-style module rules.
- Remove obsolete helpers, duplicate README sections, and **finalize** architecture docs (updates README + `ARCHITECTURE.md` + this PRD).
- Optional: add **golden tick** fixtures for regression (location + prior trip snapshots) — **deferred**.

### Deliverables

- Clean tree; single obvious entrypoint for the tick pipeline (`processVesselTrips` in `processTick/`).
- Updated [`README.md`](../convex/functions/vesselTrips/updates/README.md) and [`ARCHITECTURE.md`](../convex/functions/vesselTrips/updates/ARCHITECTURE.md) to match post-refactor reality.

### Acceptance criteria

- Full test suite relevant to vessel trips + convex typecheck green.
- README, `ARCHITECTURE.md`, and this PRD updated; **Revision log** entry.

---

## Cross-cutting requirements (every stage)

- **TSDoc** on new exported functions; module top-level comment in new files (per `.cursor/rules/code-style.mdc`).
- **No `any`** in new code; validate public Convex args per project norms.
- **Performance:** preserve batching (`upsertVesselTripsBatch`, batched projection mutations) unless a stage explicitly benchmarks a change.

---

## Future (out of scope for Stages 1–5)

- **Outbox table + internal consumer** for projection retries and replay.
- **Stronger idempotency keys** on `projectPredictedBoundaryEffects` / `projectActualBoundaryPatches` if split across more mutations.
- **Golden tick fixtures** (optional regression snapshots for location + prior trip) — deferred from Stage 5.
- **WSF feed** at-dock / at-sea transition cleanup — see [Non-goals](#non-goals-for-this-prd) above; not part of this PRD’s deliverables.

---

## Completion summary

| Stage | Outcome |
|-------|---------|
| 1 | Tick contracts (`processTick/contracts.ts`), pipeline map, `ARCHITECTURE.md` checklist |
| 2 | `tripsEqualForStorage` / `tripsEqualForOverlay`; projection-only ticks without upsert |
| 3 | `projection/timelineProjectionProjector.ts`; lifecycle emits facts/intents only |
| 4 | `TickActiveTrip`; orchestrator storage-native bundle; no duplicate hot-path `getActiveTrips` |
| 5 | Folders `tripLifecycle/`, `projection/`, `processTick/`; barrel `updates/index.ts` |

---

## Revision log

| Date | Stage | Change |
|------|--------|--------|
| 2026-04-08 | — | Initial draft |
| 2026-04-08 | 1 | Added `updates/contracts.ts`, wired `processVesselTrips` to `TripTickPlan` / merged `ProjectionBatch`, documented numbered pipeline and `ARCHITECTURE.md` ([`c9f5e140`](https://github.com/RobJacobson/ferryjoy-client-neo/commit/c9f5e140beb95a9e1b5f844d3049d3110cf5eacc)) |
| 2026-04-08 | — | PRD: status set to Stage 1 complete; References + Stage 1 links to `ARCHITECTURE.md`; revision log traceability |
| 2026-04-08 | 2 | Split lifecycle persistence vs projection refresh: `lifecycleTripsEqual` / `shouldPersistLifecycleTrip`, `shouldRefreshTimelineProjection`; `processCurrentTrips` projection-only path; tests and `updates/ARCHITECTURE.md` invariants |
| 2026-04-09 | — | PRD: Stage 2 section finalized (shipped links, predicate names, hydration note); References + Stage 3 prerequisites |
| 2026-04-09 | 3 | Projection builders moved to `updates/timelineProjectionProjector.ts`; `projectionContracts.ts` DTOs; lifecycle branch files no longer import `domain/vesselTimeline/normalizedEvents` or `actualBoundaryPatchesFromTrip`; `processVesselTrips` composes projector after lifecycle mutations |
| 2026-04-09 | 4 | Tick contract `TickActiveTrip` / storage-native preloads; orchestrator `getOrchestratorTickReadModelInternal` returns storage rows (no hydrate); `getActiveTrips` remains hydrated; tests for preload vs query fallback and storage vs hydrated parity; docs (`updates/ARCHITECTURE.md`, orchestrator README) |
| 2026-04-08 | 5 | Module layout: `updates/tripLifecycle/`, `updates/projection/`, `updates/processTick/`; barrel `updates/index.ts`; `contracts.ts` → `processTick/contracts`; removed `processVesselTrips/` directory; docs (`README`, `ARCHITECTURE`, PRD) and `convex codegen` |
| 2026-04-08 | — | Public trip equality API: `tripsEqualForStorage` / `tripsEqualForOverlay` replace `shouldPersistLifecycleTrip` / `shouldRefreshTimelineProjection`; internal comparators `lifecycleTripsEqual` / `overlayTripsEqual` |
| 2026-04-09 | — | PRD closure: status **Complete**; refreshed references, Stage 2 hydration note, Stage 3–4 **Shipped** lines, path updates for `projection/` / `tripLifecycle/` / `processTick/`; completion summary table |

