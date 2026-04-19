# Vessel orchestration domain — next work (PRD)

**Status:** Active instructions for implementation (forward-looking).  
**Audience:** Engineers and coding agents working under `convex/domain/vesselOrchestration`, `convex/functions/vesselOrchestrator`, and related Convex modules.

**Location:** This file lives under [`docs/vessel-orchestrator-prd/`](.) with companion artifacts (**`README.md`**, **`migration-inventory.md`**, and any future addenda). **Do not** scatter PRD follow-ups across `docs/engineering/` unless cross-linking from here.

**Purpose:** This document is the **single place** for *what to do next* and *how the tree should look*. It does **not** narrate past refactors. **Agents must follow §5 (import rules) and §6 (execution sequence)** even if they do not open other docs.

When instructions conflict, **this PRD wins** for structure and purity goals; **[`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)** wins for import-ring mechanics **unless this PRD explicitly duplicates or overrides them in §5**.

**Related (background):** [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md), [`vessel-orchestrator-decoupling-agents-memo.md`](../engineering/vessel-orchestrator-decoupling-agents-memo.md), [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md), [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md).

---

## 1. Summary

Shipped work already improved **tick anchor ownership** and **bulk schedule snapshots**. **Remaining work** is **not** “general cleanup”: it is a **deterministic migration** to a **fixed folder layout** (§2), a **mandatory audit** of every file’s consumers (§6 **S0**), and **sequenced moves** so that **`updateVesselTrips`** contains **only** trip-tick concerns while **cross-cutting** code lives in **`shared/`** or in the **correct peer pipeline**.

**Remaining work** still has two **priority** layers:

1. **P0 — Tree and imports** — Execute **§6 S0–S9** in order unless a step is blocked (then document the blocker and stop).
2. **P1 — Purity** — **§6 S10** (trip data-only outputs; persist in `functions/` where agreed).

---

## 2. Normative target layout (`vesselOrchestration/`)

After migration, **`convex/domain/vesselOrchestration/`** must contain **exactly** this **top-level** structure:

| Entry | Role |
|-------|------|
| **`index.ts`** | **Only** re-exports that the package wants to expose at `domain/vesselOrchestration` — typically thin barrels pointing at the four modules below. **No** business logic. |
| **`shared/`** | **All** code that is **not** owned exclusively by a single `update*` pipeline: orchestrator-level schedule snapshot, handshake types used by **multiple** pipelines, persist/write-set glue consumed from **more than one** place, and any other **cross-cutting** artifact. See §3. |
| **`updateTimeline/`** | Timeline assembly and consumer-owned logic for `eventsActual` / `eventsPredicted` projection inputs. |
| **`updateVesselPredictions/`** | ML overlay, prediction proposals, prediction-domain helpers. |
| **`updateVesselTrips/`** | **Only** vessel **trip tick** computation: detect events, completed vs in-service, bundle/compute for one tick — **not** orchestrator-wide snapshot builders, **not** read-model merge for queries, **not** handshake types that are shared only between predictions and timeline (those go to **`shared/`** or the owning consumer). |

### 2.1 What must disappear from the top level

The following **must not** exist as **sibling** top-level modules under `vesselOrchestration/` after the migration is complete:

| Current | Action |
|---------|--------|
| **`tickLifecycle/`** | **Dissolve.** Every file is classified in **S0** and moved to **`shared/`** (e.g. handshake/projection wire types), **`updateTimeline/`**, or **`updateVesselPredictions/`** — never left in limbo. |
| **`orchestratorTick/`** | **Dissolve.** Contents split per **S0**: trip write-set + persist orchestration → **`shared/`** and/or **`functions/`** (see S4, S10); ML/timeline materialization → **`updateVesselPredictions`** / **`shared/`** as the audit dictates. |
| **`computeVesselTripsWithClock.ts`** (loose file at `vesselOrchestration/` root) | **Move** into **`updateVesselTrips/`** (recommended under `processTick/` or the folder’s public entry story) and re-export from **`updateVesselTrips/index.ts`**. Root **`index.ts`** may re-export it **only** via **`updateVesselTrips`**. |
| **`tests/`** at `vesselOrchestration/` root (if present) | **Move** tests next to the module they test (`updateVesselTrips/tests`, `shared/tests`, etc.). |

**Counting:** The **three** `update*` folders + **`shared/`** + **`index.ts`** are the **only** allowed top-level entries (plus standard non-code files like `architecture.md`).

### 2.2 What `shared/` is for (precise)

**`shared/` holds:**

1. **Everything** that **two or more** of `{ updateVesselTrips, updateVesselPredictions, updateTimeline, functions/vesselOrchestrator/actions.ts }** need **and** that is **not** exclusively one pipeline’s internal detail.
2. **Schedule snapshot** — query arg builders, snapshot types, in-memory lookup from snapshot, limits, composite keys — because the orchestrator loads it **once per tick** at the **top level**, not “inside” trip logic as an implementation secret.
3. **Artifacts dissolving from `tickLifecycle/` and `orchestratorTick/`** until a **clearer** home exists in a single `update*` folder.

**`shared/` is not:**

- A second copy of **`updateVesselTrips`**.
- A place for **query-time read-model** helpers (`mergeTripsWithPredictions`) unless the audit proves **multiple** legitimate consumers — prefer **`functions/vesselTrips`** or a dedicated **`read/`** module with its own entry (see §5).

---

## 3. Goals

| ID | Goal |
|----|------|
| G1 | **Orchestration clarity:** `functions/vesselOrchestrator/actions.ts` sequences phases, owns **tick anchor**, loads **shared** inputs once. |
| G2 | **Cross-cutting code** lives in **`shared/`** (or a **single** agreed consumer), **not** under `updateVesselTrips` unless it is **trip-tick-only**. |
| G3 | **`updateVesselTrips/index.ts`** is a **designed façade** — not a dump of every helper in the repo. |
| G4 | **Subfolders** under `updateVesselTrips` each have **one purpose**; optional **`index.ts`**; merge **one-file** folders when it clarifies structure. |
| G5 | **`types.ts` per subfolder** for multi-file / exported types; **no** monolithic `vesselOrchestration/types.ts`. |
| G6 | **Trip outputs** trend toward **data-only**; **mutations** trend toward **`functions/`** (S10). |
| G7 | **Handshake types** are **not** long-term **`updateVesselTrips` exports**; they land in **`shared/`** or the **consumer** pipeline after **S3–S4**. |

---

## 4. Priority tiers

- **P0** — Complete **§6 S0–S9** (audit → dissolve loose folders → fix `index.ts` → Biome).
- **P1** — **§6 S10** (purity / persist location).

---

## 5. Import and module boundaries (full guidance — read this section)

**This section duplicates the intent of [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md) so agents are not excused for skipping it.** If anything disagrees, **this PRD’s tree rules (§2) win**; import *mechanics* follow the memo and Biome.

### 5.1 Core idea

- Each **folder** is **one module** with a **small public API**.
- The public API is exposed through **`index.ts`** (or one explicitly documented entry file).
- Code **outside** the folder imports **only** from that **`index.ts`**, **not** from internal paths like `.../tripLifecycle/foo.ts`.

This is **not** “shorter import paths.” A good `index.ts` is a **designed contract**; a **barrel dump** (re-exporting everything) is **forbidden** for public surfaces.

### 5.2 Rings

| Ring | Who | Rule |
|------|-----|------|
| **External** | Any file **outside** the folder | Import **only** from that folder’s **`index.ts`** (or the single documented entry). |
| **Peer** | Another folder at the same abstraction level | Import **only** from the **peer’s `index.ts`**, never `peer/internal/...`. |
| **Internal** | Files **inside** the same folder | Relative imports between implementation files; **no** requirement to route through `index.ts` for same-folder plumbing. |

### 5.3 What belongs on `index.ts`

Put a symbol on the public `index.ts` **only if**:

1. A **caller outside the folder** needs it to use the module’s **primary behavior** correctly; **or**
2. It is part of a **stable contract** (options types, result shapes).

If renaming an internal file **should not** break external code, the symbol **must not** be public — keep it internal.

**Explicit non-goal:** The entry file does **not** need exactly **one** export. It needs a **coherent** set.

### 5.4 `vesselOrchestration`-specific rules

1. **`functions/vesselOrchestrator/**/*.ts`** (including tests in that tree): **no deep imports** into  
   `domain/vesselOrchestration/updateVesselTrips/**`,  
   `updateTimeline/**`,  
   `updateVesselPredictions/**`  
   **except** each module’s **`index.ts`**.  
   **Enforcement:** Biome `noRestrictedImports` in [`biome.json`](../../biome.json) — **update paths** when folders move (**S9**).

2. **`shared/`** — external code imports **`domain/vesselOrchestration/shared`** (resolved to **`shared/index.ts`**). **Never** import `shared/scheduleSnapshot/...` directly from **`functions/`** unless the team adds a documented exception.

3. **After §6 moves:** grep the repo for old paths (`tickLifecycle`, `orchestratorTick`, deep `updateVesselTrips/...`). **Zero** remaining imports to deleted folders.

4. **Tests:** Prefer colocated tests; deep-import internals **only** with **`biome-ignore`** and a **one-line reason**, per the memo.

### 5.5 Staged adoption (from memo — still required)

- **Stage B–C:** Peers import via **`index.ts`**; fix external callers.
- **Stage D:** Keep Biome rules **tight** — do **not** widen globs to “make green” without updating exports.

---

## 6. Execution sequence (mandatory order)

Do **not** skip **S0**. Do **not** start **S2** before **S0** is written down. Steps **S1–S5** may be **one PR** or **split PRs**, but **order must not** invert (e.g. do not delete `tickLifecycle/` before imports are updated).

### S0 — Audit (blocking all moves)

**Output:** A single audit artifact: **[`migration-inventory.md`](migration-inventory.md)** in **`docs/vessel-orchestrator-prd/`** (start from the template table; replace placeholder rows with real data). Alternatively append a copy-paste table as an **appendix at the end of this PRD**. **Commit** the inventory before the first move PR.

**Actions (check each box):**

1. [ ] List **every** top-level path under `convex/domain/vesselOrchestration/` (`ls` or equivalent).
2. [ ] For **`tickLifecycle/`**: Open `tickLifecycle/index.ts`. For **each** export, run repository search (`rg`) for imports of that symbol / path. Record **every** importing file path.
3. [ ] For **`orchestratorTick/`**: Same — enumerate exports from `orchestratorTick/index.ts` (and any file not re-exported), **rg** for `orchestratorTick` and specific symbol names.
4. [ ] For **`computeVesselTripsWithClock.ts`** at domain root: **rg** `computeVesselTripsWithClock` — list all importers.
5. [ ] For **`updateVesselTrips/`** — for **each** of: `snapshot/`, `read/`, `mutations/`, `continuity/`, `processTick/`, `tripLifecycle/`, and any loose `*.ts` at `updateVesselTrips/` root: list files and classify **each file** as:
   - **T0** — Imported **only** from within `updateVesselTrips/` → **stays** in `updateVesselTrips/` **unless** a later row proves cross-import.
   - **T1** — Imported from **`updateVesselPredictions`** or **`updateTimeline`** or **`orchestratorTick`** or **`tickLifecycle`** → **candidate for `shared/`** or the **non-trip** pipeline.
   - **T2** — Imported from **`functions/vesselOrchestrator`** for orchestrator wiring only → **candidate for `shared/`** (snapshot, deps wiring).
6. [ ] Fill the **inventory table** for every file under **`tickLifecycle/`** and **`orchestratorTick/`** with columns:

   `Path | Exports (summary) | Importing modules (grouped) | Classification: trip-only | single-pipeline | cross-pipeline | Target: shared / updateVesselTrips / updateTimeline / updateVesselPredictions / functions | Notes`

7. [ ] **Review:** Any **T1/T2** file still sitting under `updateVesselTrips/` after migration is a **failure** unless the inventory documents an explicit exception.

**Acceptance:** Inventory **merged**; **no** file move in S2+ without a **row** in the inventory.

---

### S1 — Create `shared/` skeleton

1. [ ] Create `convex/domain/vesselOrchestration/shared/README.md` — two paragraphs: what belongs here (§2.2) and what does **not**.
2. [ ] Create `shared/index.ts` — start **empty** or with a **comment** listing planned exports.
3. [ ] `bun run check` — green.

---

### S2 — Migrate schedule snapshot into `shared/`

**Prerequisite:** S0 row for every file in `updateVesselTrips/snapshot/`.

1. [ ] Create `shared/scheduleSnapshot/` (or the name in the inventory — **one** agreed name).
2. [ ] Move **all** files from `updateVesselTrips/snapshot/` into `shared/scheduleSnapshot/`.
3. [ ] Move colocated tests to `shared/scheduleSnapshot/tests/` (or `shared/tests/...`).
4. [ ] Export the **designed** public API from `shared/index.ts` (snapshot types, `buildScheduleSnapshotQueryArgs`, `createScheduledSegmentLookupFromSnapshot`, limits, keys — **only** what orchestrator + trip need from outside).
5. [ ] Update **`convex/functions/vesselOrchestrator/actions.ts`** to import snapshot symbols from **`domain/vesselOrchestration/shared`** (via package path to `shared/index.ts`).
6. [ ] Update **`updateVesselTrips`** internal imports to use **`shared`** entry.
7. [ ] **Remove** snapshot re-exports from `updateVesselTrips/index.ts`.
8. [ ] Delete empty `updateVesselTrips/snapshot/` directory.
9. [ ] `bun run check`; fix Biome.

**Acceptance:** **No** `updateVesselTrips/snapshot/` path remains; **one** snapshot query per tick in `actions.ts`; imports use **`shared/index.ts`**.

---

### S3 — Dissolve `tickLifecycle/`

**Prerequisite:** S0 table for `tickLifecycle/` complete.

1. [ ] For **each** file in `tickLifecycle/`, execute the **Target** from the inventory (e.g. types → `shared/tickHandshake/types.ts`, projection wire → `shared/projectionWire.ts`, or into `updateTimeline/` if **only** timeline imports it).
2. [ ] Update **all** imports across the repo.
3. [ ] Remove `export * as tickLifecycle` from `convex/domain/vesselOrchestration/index.ts`.
4. [ ] Delete `tickLifecycle/` when empty.
5. [ ] `bun run check`.

**Acceptance:** **No** `tickLifecycle` path in the repo; **no** broken imports.

---

### S4 — Dissolve `orchestratorTick/`

**Prerequisite:** S0 table for `orchestratorTick/` complete.

1. [ ] Split by **concern** (inventory decides):
   - Trip **write-set** construction / storage rows / **persist** orchestration that is still domain-side → **`shared/orchestratorPersist/`** (name per inventory) **and/or** **`functions/vesselOrchestrator`** in S10.
   - **ML overlay + timeline materialization** (`materializePostTripTableWrites`, etc.) → **`updateVesselPredictions/`** or **`shared/`** if **both** predictions and timeline import without a single owner.
2. [ ] Move files; update `orchestratorTick/index.ts` consumers to import from **new** module `index.ts` files.
3. [ ] Remove `export * as orchestratorTick` from `vesselOrchestration/index.ts`.
4. [ ] Delete `orchestratorTick/` when empty.
5. [ ] `bun run check`; run orchestrator tests.

**Acceptance:** **No** `orchestratorTick` path; behavior unchanged (parity tests).

---

### S5 — Move root `computeVesselTripsWithClock.ts`

1. [ ] Move `convex/domain/vesselOrchestration/computeVesselTripsWithClock.ts` → **`updateVesselTrips/processTick/computeVesselTripsWithClock.ts`** (or path in inventory).
2. [ ] Export `computeVesselTripsWithClock` and its option types from **`updateVesselTrips/index.ts`**.
3. [ ] Update `vesselOrchestration/index.ts` to re-export from **`updateVesselTrips`** only (not from a loose file path).
4. [ ] **rg** for old path; fix all imports.
5. [ ] `bun run check`.

---

### S6 — Relocate domain-root tests

1. [ ] If `convex/domain/vesselOrchestration/tests/` exists, move each test file beside the module under test (`updateVesselTrips/tests`, `shared/tests`, `updateTimeline/tests`, …).
2. [ ] Update imports inside tests.

---

### S7 — `updateVesselTrips` internal cleanup

**Prerequisite:** S0 classification for **read/**, **mutations/**, **continuity/**.

1. [ ] Move **`read/`** (mergeTripsWithPredictions, dedupe) out of trip tick **public** story per inventory — typically **`functions/vesselTrips`** or **`shared/read`** with its own **`index.ts`**.
2. [ ] **`mutations/departNextActualization`**: if consumed only from `functions/vesselTrips` mutations, consider **`functions/`** domain-adjacent; if shared, **`shared/`** — **inventory row decides**.
3. [ ] Add **`index.ts`** to subfolders where multiple files need a stable internal façade.
4. [ ] Merge **single-file** subfolders only when §2.2 does not mix concerns.
5. [ ] Consolidate **`types.ts`** per subfolder per **§8**.
6. [ ] Narrow **`updateVesselTrips/index.ts`** to the **designed** set.

**Acceptance:** Trip barrel contains **only** trip-tick contract + necessary types.

---

### S8 — Final `vesselOrchestration/index.ts` surface

1. [ ] **Exactly** these exports (adjust names to match code):  
   - From **`shared/index.ts`** (namespace `shared` **or** named re-exports — **pick one** style and document in a comment).  
   - From **`updateVesselTrips/index.ts`**.  
   - From **`updateVesselPredictions/index.ts`** (if re-exported).  
   - From **`updateTimeline/index.ts`** (if re-exported).  
2. [ ] **Remove** any `export * as tickLifecycle` / `orchestratorTick`.
3. [ ] Add a **short comment block** at bottom of `index.ts`: **what** this package exports at the top level and **what** importers should use.

**Acceptance:** `list` of top-level `vesselOrchestration` matches §2.

---

### S9 — Biome and grep gate

1. [ ] Update [`biome.json`](../../biome.json) `noRestrictedImports` paths if folder names changed.
2. [ ] `rg "tickLifecycle|orchestratorTick|updateVesselTrips/snapshot"` — **must** return **no** imports in code (allowed in **`docs/vessel-orchestrator-prd/**`, changelogs, and archived handoffs).
3. [ ] `bun run check` full.

---

### S10 — P1 purity (persist location + data-only outputs)

1. [ ] Domain trip compute produces **storage-oriented** data; minimize mutation **ports** in domain over time.
2. [ ] Move **`persistVesselTripWriteSet`** (or successor) toward **`functions/vesselOrchestrator`** when feasible; narrow handshake types with predictions/timeline owners.
3. [ ] Update **`architecture.md`**; parity tests green.

---

## 7. Ground rules (layering)

### 7.1 Domain vs functions

1. **`convex/domain`** — Business rules and **pure** transforms. **No** `ActionCtx`, **no** `_generated/api` imports in domain modules.
2. **`convex/functions`** — Convex registration, **`ctx.runQuery` / `ctx.runMutation`**, and **binding** domain **ports** (interfaces) where needed.

Domain may define **TypeScript interfaces** for mutation/query ports that **`functions`** implements; **do not** treat those ports as the **final** design—**S10** moves concrete mutation **calls** toward **`functions/`** where possible.

### 7.2 Tick anchor

**`tickStartedAt`** is created **once** per `updateVesselOrchestrator` run and **passed in** to steps. Inner helpers **must not** become the source of truth for wall-clock. Treat it as a **tick correlation id** and input to **coarse** policy (e.g. second-of-minute windows), not sub-millisecond physics.

### 7.3 Schedule data

- **Plan A:** Bulk snapshot via **`shared/`**, bounded queries, logging in **`actions.ts`** as needed.
- **Plan B:** Narrow read **port** — document + test-double; no unbounded per-segment callback graphs.

### 7.4 Orchestration step pattern

**gather inputs → call domain (pure rules) → persist plain outputs → done.**

### 7.5 `actions.ts` contract (`functions/vesselOrchestrator/actions.ts`)

| Step | Responsibility |
|------|----------------|
| **Load model snapshot** | `getOrchestratorModelData` — vessels, terminals, active trips; fail if empty. |
| **Tick anchor** | `tickStartedAt = Date.now()` **once** (or test hook). |
| **Locations** | `updateVesselLocations` — WSF + `bulkUpsert`; **no** trip/prediction logic. |
| **Schedule snapshot** | Build args via **`shared/`** (`buildScheduleSnapshotQueryArgs`); **`runQuery`** `getScheduleSnapshotForTick` **once**; build **`tripDeps`** from `createScheduledSegmentLookupFromSnapshot` + `createDefaultProcessVesselTripsDeps`. |
| **Trips** | `updateVesselTrips` — compute + persist via bindings; **no** lifecycle rules inlined in `actions.ts`. |
| **Predictions** | `updateVesselPredictions` — same **`tripDeps`** as trips; proposals mutation if non-empty. |
| **Timeline** | `updateVesselTimeline` — merge persist + ML; dock mutations. |

**Must not:** Encode **when a trip completes** or **how rows are stripped** in `actions.ts`. **Must not** re-fetch the schedule snapshot **per vessel** in a loop.

**Bindings:** `createVesselOrchestratorConvexBindings(ctx)` stays **thin** (wiring only).

### 7.6 Tick policy bits (single source)

Policy flags (e.g. **prediction fallback** window) are derived **once** per run from **`tickStartedAt`** or as an explicit **boolean** computed in **`actions.ts`**. **Do not** call **`Date.now()`** again inside domain for the **same** policy decision.

---

## 8. `types.ts` per subfolder

| Rule | Detail |
|------|--------|
| **Where** | `types.ts` inside **each** subfolder that has **multiple** files sharing exported types. |
| **Contents** | Types used in **≥2** files in that subfolder **or** exported. **Local** types stay in the owning file. |
| **Not** | One **`vesselOrchestration/types.ts`**. **Not** a **`shared/types.ts`** that holds **every** symbol — split by subfolder under **`shared/`** (`shared/scheduleSnapshot/types.ts`, etc.). |

---

## 9. Dependency bags vs plain data

**`ProcessVesselTripsDeps`** (and similar) bundle injectable functions for tests. **Rules:**

1. After **`shared/`** owns schedule **data**, construct adapters in **one** place (`createDefaultProcessVesselTripsDeps`) from that data—**do not** add new injectables to avoid threading snapshot **data**.
2. **Shrink** injectable surface over time: production-only helpers need not stay injectable forever.
3. **Document** each field on the deps type (short comment block).

**Anti-pattern:** Adding a new callback to deps because passing **`ScheduleSnapshot`** through would require signature work—usually means the **data** should live in **`shared/`** and be passed explicitly.

---

## 10. Anti-patterns (review gate)

| Avoid | Prefer |
|-------|--------|
| Vague `*Payloads` / `*ExecutionPlan` for real row data | Named write-set / row types |
| Barrel dumps | Designed `index.ts` |
| Deep imports from outside module | Entry-only imports |
| Leaving `tickLifecycle` / `orchestratorTick` “for later” | **S0 inventory + S3/S4** |

---

## 11. Agent self-check before merge

1. [ ] **S0** inventory updated for every moved file?
2. [ ] **§2** top-level tree satisfied?
3. [ ] **§5** import rings respected; Biome green?
4. [ ] **`architecture.md`** updated?
5. [ ] `bun run check`?

---

## 12. Document maintenance

- Update **[`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md)** after **S8**.
- The agent briefing links here: **[`vessel-orchestrator-decoupling-agents-memo.md`](../engineering/vessel-orchestrator-decoupling-agents-memo.md)** — keep **Related documents** pointing at **`docs/vessel-orchestrator-prd/vessel-orchestration-next-work-prd.md`**.

---

## Revision history

- **Initial:** Forward-only PRD.
- **Expanded:** Priorities, actions contract, anti-patterns, WS4 split.
- **Restructure:** Normative target tree (§2); **`shared/`** scope beyond snapshot; **dissolve `tickLifecycle` / `orchestratorTick` / loose root file**; **§5 full import rules** (memo inlined); **§6 sequenced S0–S10** with checklists and audit artifact; inventory path for S0.
- **Hardening:** Restored §7 layering detail (`actions.ts` table, tick policy); inlined §9 deps; execution sequence treats audit as **blocking**.
- **Relocated:** PRD and companions now live under **`docs/vessel-orchestrator-prd/`**; S0 inventory template added as **`migration-inventory.md`**.
