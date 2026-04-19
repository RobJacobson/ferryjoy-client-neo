# Vessel orchestrator glue decoupling — agent briefing

**Status:** Active companion to the phased refactor (O1–O5 **complete**; occasional doc/code drift cleanup continues).  
**Audience:** Engineers and coding agents working on `convex/functions/vesselOrchestrator`, `convex/domain/vesselOrchestration`, trips, predictions, timeline.  
**Canonical roadmap / history:** [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md) (goals, phases, definition of done).

---

## 1. What “legacy glue” meant

Before the refactor, **one** internal action tended to mix:

- Convex I/O (`runQuery` / `runMutation`, WSF fetch),
- Trip lifecycle semantics,
- ML / prediction attachment, and
- Timeline assembly,

…without a **stable story** for which layer owned which table or which step ran when. Predictions could appear as a **side effect** of trip building (`buildTrip`), which made debugging and ownership unclear (“whose field is this?”).

**Decoupling goal:** separate **orchestration** (when and how Convex runs) from **domain** (what to compute) from **persistence** (which mutations fire), with **four explicit phases** aligned to product concerns (locations, trips, predictions, timeline).

---

## 2. Separation of concerns: `actions.ts` vs business layer

**`convex/functions/vesselOrchestrator/actions.ts`** exists to:

1. Call **business-level** functions (under `convex/domain/...` and related domain modules).
2. Receive their outputs — **in theory**, plain serializable **arrays of POJOs** (or small DTO-shaped objects) ready to write.
3. **Persist** those results to the database via `ctx.runMutation` / `ctx.runQuery` (and external fetch adapters where applicable), using thin bindings.

It should **not** own trip rules, ML policy, schedule logic, or timeline semantics. Those belong in the **business layer** (`convex/domain/vesselOrchestration`, domain ML helpers, etc.): filtering, deduplication, “what changed,” compute bundles, and merge rules stay there.

**Practical note:** Some steps still return **richer structs** (e.g. compute bundles with multiple branches) until a later pass narrows public shapes to “rows only.” The **direction** remains: functions = call domain → get payloads → persist; domain = everything else. See §5.

---

## 3. Current design goals (still in force)

1. **Four sequential pipelines in one tick** — Same process, strict order, no `Promise.all` across phases that would break invariants:
   - Live **`vesselLocations`** (WSF → `bulkUpsert`).
   - **`updateVesselTrips`** — domain trip compute → trip-table mutations only (orchestrator path uses `buildTripCore`, not full `buildTrip` + predictions).
   - **`updateVesselPredictions`** — ML overlay + `vesselTripPredictions` proposals; may **recompute** trip-shaped inputs for isolation from the trip persist pass.
   - **`updateVesselTimeline`** — `eventsActual` / `eventsPredicted` projection from **in-memory** merged outcomes (not reloading prediction rows for assembly).

2. **Domain vs `convex/functions`** — Domain code does **not** import `ActionCtx` or `_generated/api`. It receives **ports**: schedule lookups, model-parameter reads, and mutation shapes implemented in the functions layer.

3. **Convex bindings in one place** — `runQuery` / `runMutation` wiring for the orchestrator lives in a small module (e.g. `createVesselOrchestratorConvexBindings` and helpers under `convex/functions/vesselOrchestrator/`), not scattered through domain.

4. **Clear table ownership** — Trips vs predictions vs events: each phase should map to **obvious** tables and mutations; avoid smuggling ML into trip documents beyond strip/overlay rules already documented.

5. **Agent-friendly boundaries** — Follow [`imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md): public APIs via folder entry files; tests may deep-import internals under agreed paths.

---

## 4. Where things live now (quick map)

| Concern | Primary location |
|--------|------------------|
| Tick entry, step ordering | `convex/functions/vesselOrchestrator/actions.ts` |
| Convex query/mutation wiring for orchestrator steps | `convex/functions/vesselOrchestrator/` (e.g. utils/bindings next to `actions.ts`) |
| Trip compute + clock policy | `convex/domain/vesselOrchestration/computeVesselTripsWithClock.ts` |
| Trip persistence from compute bundle | `convex/domain/vesselOrchestration/orchestratorTick/persistVesselTripsCompute.ts` |
| Prediction writes + ML overlay | `convex/domain/vesselOrchestration/orchestratorTick/materializePostTripTableWrites.ts` |
| Timeline projection input | `convex/domain/vesselOrchestration/updateTimeline/` |
| Deep architecture narrative | `convex/domain/vesselOrchestration/architecture.md` |
| Operator-oriented README | `convex/functions/vesselOrchestrator/README.md` |

Symbol names evolved during cleanup (e.g. `VesselTripsComputeBundle`, `computeVesselTripsWithClock`, `runUpdateVesselPredictions`). If a **handoff** or **older memo** still says `orchestratorPipelines`, `persistTripTickMutations`, or `computeOrchestratorTripTick`, treat the **code** as source of truth until that doc is updated.

---

## 5. Loose ends (intentional follow-ups)

These are **not** blockers for the four-pipeline model; they are polish and future refactors:

- **Documentation sync** — Handoffs under `docs/handoffs/` and long memos may retain pre-rename identifiers; grep and align when touching an area.
- **Trip compute bundle vs “rows only”** — Domain may still return **structured** bundles (completed + active branch + messages), not only flat arrays. A later refactor may narrow boundaries to “concise POJOs per table” where that helps; see discussions in orchestrator planning notes.
- **Throttle / fallback policy** — `computeShouldRunPredictionFallback` and related policy remain; whether to simplify further is a **product + profiling** decision (see four-pipelines memo §7).
- **Parallelism** — Tick remains **sequential** by design; do not parallelize phases without an explicit design review.

---

## 6. Checklist for agents changing this area

- [ ] Preserve **phase order**: locations → trips → predictions → timeline.
- [ ] Keep **domain** free of `ActionCtx`; add or extend **ports** and bind them in `functions/`.
- [ ] Keep **`actions.ts`** thin: domain computes; functions **persist** POJO-shaped payloads (or current intermediate shapes on the path to POJOs-only).
- [ ] After renames or new files, update **orchestrator README** and/or **domain architecture** if behavior or entrypoints change.
- [ ] Prefer **parity / sequencing tests** under `convex/functions/vesselOrchestrator/tests/` when behavior is subtle.
- [ ] Cross-link this memo and the **four-pipelines** memo when adding new engineering notes so agents find both.

---

## Related documents

- **[`docs/vessel-orchestrator-prd/`](../vessel-orchestrator-prd/README.md)** — **Canonical PRD home:** [`vessel-orchestration-next-work-prd.md`](../vessel-orchestrator-prd/vessel-orchestration-next-work-prd.md) (forward-only instructions: `shared/`, tree dissolve, imports inlined, **S0–S10** sequence); [`migration-inventory.md`](../vessel-orchestrator-prd/migration-inventory.md) (S0 audit template).
- [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md) — Full goals, O1–O5 status, definition of done, open decisions.
- [`imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md) — Import/export rules.
- [`convex/domain/vesselOrchestration/architecture.md`](../convex/domain/vesselOrchestration/architecture.md) — Domain map.
- [`convex/functions/vesselOrchestrator/README.md`](../convex/functions/vesselOrchestrator/README.md) — Operational overview.

---

## Revision history

- **Initial:** Post–O1–O5 snapshot; summarizes decoupling goals and agent checklist while refactor cleanup continues.
- **Separation of concerns:** Documented `actions.ts` as call-domain → receive payloads (POJOs in theory) → persist; business layer owns all other logic.
- **Forward-only PRD:** Lives under [`docs/vessel-orchestrator-prd/`](../vessel-orchestrator-prd/README.md); stub at [`vessel-orchestration-next-work-prd.md`](vessel-orchestration-next-work-prd.md) redirects.
