# Engineering memo: Backend layering, domain purity, and Convex actions

**Date:** 2026-04-16 (adapter layout section updated 2026-04-16)  
**Audience:** future maintainers and AI agents working on the Convex backend  
**Status:** architectural intent and agreed direction (not a completed migration checklist)

## Purpose

This memo captures **intent and boundaries** for `convex/functions`, `convex/domain`, and `convex/adapters`, how **Convex actions** should relate to **business logic**, and **pragmatic choices** (including what may change in a later phase). It is meant to complement—not replace—existing Convex guidelines and code.

Older handoff documents may describe historical refactors; **treat them as context**, not immutable law, when they conflict with the principles below.

---

## Architectural intent

### `convex/functions` (Convex surface + persistence)

- Owns **`query` / `mutation` / `action` / internal variants**, **`ctx`** usage, and **all direct database access** (`ctx.db`, scheduling, `ctx.runQuery` / `ctx.runMutation` / `ctx.runAction` from handlers).
- Should trend toward **normal, composable CRUD-style operations** where possible: small reads, focused writes, clear validators.
- **Other layers must not use Convex context** or otherwise “reach into” the database. If something needs persistence, it belongs in `functions` (or is passed in as **already loaded data** from `functions`).

### `convex/domain` (business rules on plain data)

- Holds **decisions, transforms, and orchestration logic that can be expressed without `ctx`**.
- Target state: **no imports of `ActionCtx`, `MutationCtx`, `QueryCtx`, `api` / `internal`, or any database access.** Domain functions take **inputs** (DTOs, read models) and return **outputs** (new state, write plans, errors)—the **action or mutation** applies those results.
- Unit tests should be able to run domain logic with **plain objects**, without Convex.

### `convex/adapters` (external boundaries)

- Holds **integration** code: HTTP/fetch, vendor-specific shapes (e.g. WSF), mapping **from raw external data** toward **backend-owned types** (often `Infer` types from `functions/*/schemas.ts`).
- Adapters **translate**; they do not own core product policy that belongs in domain.

#### Layout (YAGNI: no vendor subfolder until needed)

Today **WSF is the only integration**. We **do not** use a `convex/adapters/wsf/` directory—paths stay short, and when a second vendor appears we can introduce `adapters/<vendor>/` in a focused move.

**Naming:** Use **role prefix + `Wsf` + rest** in camelCase (e.g. `fetchWsfVesselLocations.ts`, `resolveWsfVessel.ts`, `buildWsfTerminalsTopology.ts`). Utils without a vendor story stay short (e.g. `retryOnce.ts`). This keeps a flat tree under `adapters/` easy to grep and avoids ambiguous names like `fetchRoutes.ts` if another system appears later.

**Subfolders by role** (avoid an explosion of tiny files; longer modules with private helpers are fine):

| Folder | Role |
|--------|------|
| **`fetch/`** | Call upstream APIs (`ws-dottie`, etc.), normalize responses, map toward backend-owned DTOs. Same spirit as “fetch then transform into the Convex shape” (e.g. vessel pings). |
| **`resolve/`** | Pure lookups: match vendor or feed fields to loaded **identity** rows (`TerminalIdentity`, `VesselIdentity`). No network. |
| **`pipelines/`** | **Named integration workflows**: ordered steps, multiple calls, error handling between phases. Prefer **one file per pipeline** (e.g. `WsfScheduledTrips.ts`) that imports from `fetch/` and `resolve/`, instead of many small pipeline folders. |
| **`compose/`** (optional) | Assembly of **already-fetched** data into larger DTOs when it is not a full pipeline and not a single fetch. Omit until multiple modules need it; small cases can live next to their primary fetch. |
| **`utils/`** | Cross-cutting adapter helpers (e.g. retry, shared normalizers used by several WSF modules). **Not** a junk drawer—avoid domain policy here. |

**Barrels:** Prefer **`convex/adapters/index.ts`** re-exporting the public surface; optional sub-barrels (`fetch/index.ts`) only if the main barrel becomes unwieldy.

**Other top-level adapter modules:** e.g. `convex/adapters/vesselTrips/processTick.ts` may stay at the adapters root when it is not WSF-specific or when it is shared orchestration glue; revisit when the tree grows.

**Import path:** Call sites use `adapters` or `adapters/fetch/...` per `convex/tsconfig.json` `paths`—**not** `adapters/wsf`.

### `convex/shared` (optional note)

- Reserved for **small, generic utilities** without a vendor story (time helpers, key helpers, etc.), not a second dumping ground for integration code.

---

## DTOs, validators, and TypeScript types

The codebase uses **Convex validators** (`v.*`) and **`Infer<typeof schema>`** so table shapes and TS types stay aligned. That pattern has worked well.

**Current stance:** `domain` (and adapters) may **import types from `functions/*/schemas.ts`** for now. That creates a **dependency from domain toward the functions tree for type definitions only**—acceptable as a **Stage 1** tradeoff for a single developer who understands the boundaries.

**Optional Stage 2 (later):** move validator + inferred-type modules to a **neutral folder** (e.g. `convex/model/` or `convex/tables/`) that **does not** register Convex functions, with `functions` and `domain` both importing from there. That is **not** two sources of truth—only a **folder move** for cleaner dependency direction. No requirement to do this until it pays off.

---

## Convex actions: unavoidable “workflow” at the boundary

Some workflows **must** be `action`s (cron, scripts, Node, fetch, or orchestration across steps). Those handlers often **look** “bloated” compared to CRUD mutations. That is **normal** when the bloating is **integration and sequencing**, not ad hoc business rules.

### Preferred pattern: thin action, pure middle, persistence at the end

For non-trivial actions, aim for:

1. **Load** — use `ctx.runQuery` (and related) to build a **read model** (plain data). Prefer **fewer, coarser reads** when you need a **consistent snapshot**; many small reads can invite races between steps.
2. **Decide** — call **pure domain function(s)** with that read model and explicit inputs. Pass **time** (`now`) or other non-determinism from the action if needed for tests.
3. **Persist** — `ctx.runMutation` (often **one internal mutation**) that applies a structured **write plan** or equivalent, using **only** `ctx.db` operations.

**Anti-pattern under this model:** branching business rules, lifecycle policy, or timeline assembly **inside** the action file. That logic belongs in **`domain`**, with types passed in and results passed out.

**Convex constraints to remember:** actions **cannot** use `ctx.db` directly; loads and writes go through queries/mutations. Splitting work across many separate mutations from one action **may** weaken transactional guarantees compared to a single mutation that applies a batch of writes—choose based on consistency needs.

---

## Independent assessment (brief)

A textbook “hexagonal” stack would put **persistence-agnostic types** at the center. This repo is **schema-centric**: validators and inferred DTOs often live next to Convex registration, and **domain consumes those shapes**. That is a **reasonable Convex tradeoff**. The important part for this project is **`ctx` and DB access stay in `functions`**, not the exact folder that exports `Infer` types.

---

## Suggested order for refactors (when doing the work)

1. **Adapter folder reorg** — Move from `convex/adapters/wsf/` to the layout above (`fetch/`, `resolve/`, `pipelines/`, `utils/`), `Wsf*` filenames, single-file scheduled-trips pipeline; update all imports and barrels (see task list below).
2. **Remaining boundary cleanup** — Move `fetchVesselHistories…` usage out of `convex/functions/vesselTimeline/sync/fetchHistoryRecordsForDate.ts` into `adapters/fetch/`; move **`loadWsfTrainingData`** network I/O out of `convex/domain/ml/training/data/loadTrainingData.ts` into adapters so **domain** does not call `ws-dottie`.
3. **Smaller slices:** historic vessel locations mapping, timeline reseed “plan” in domain, orchestrators—after adapters and domain/network split are stable.

---

## Adapter layer: work remaining (task list)

Use this as a living checklist; reorder as dependencies land.

### Structure and naming

- [ ] Remove `convex/adapters/wsf/`; place modules under `fetch/`, `resolve/`, `pipelines/`, `utils/` (and `compose/` only if justified).
- [ ] Rename files to include **`Wsf`** in the basename per table above.
- [ ] Replace `adapters/wsf/scheduledTrips/` with **`fetch/`** modules that own fetch + map, plus **one** `pipelines/WsfScheduledTrips.ts` orchestrator (merge small fetch files into larger modules where it reduces churn).
- [ ] Point **`convex/adapters/index.ts`** (and optional sub-indexes) at the new paths; update **`convex/adapters/README.md`**.
- [ ] Update all imports (`functions/`, `domain/`, tests, `scripts/`, root `README.md`, handoffs) from `adapters/wsf` to `adapters` / `adapters/fetch/...`.
- [ ] Run `bun run check:fix`, `bun run type-check`, `bun run convex:typecheck`, and relevant tests.

### Boundary hygiene (separate from folder moves)

- [ ] **Timeline:** Implement `WsfFetchVesselHistoriesForSchedule…` (or similar) under `adapters/fetch/`; delete direct `ws-dottie` imports from `convex/functions/vesselTimeline/sync/fetchHistoryRecordsForDate.ts`.
- [ ] **ML training:** Move `fetchVesselBasics` / `fetchVesselHistoriesByVesselAndDates` out of `domain/ml/training/data/loadTrainingData.ts` into `adapters/fetch/`; domain consumes plain DTOs only.
- [ ] Optionally relocate **`convex/domain/ml/training/actions.ts`** to `convex/functions/` so **Convex registration** lives only under `functions/` (memo alignment); low priority if disruptive.

### Documentation

- [ ] Refresh **`docs/handoffs/wsf-terminal-vessel-topology-adapters-handoff-2026-04-16.md`** and **`docs/handoffs/convex-adapters-layer-handoff-2026-04-16.md`** paths and terminology—or add a pointer to this memo as canonical for adapter layout.

**Implementation plan (step-by-step):** [adapters-wsf-reorg-implementation-plan-2026-04-16.md](./adapters-wsf-reorg-implementation-plan-2026-04-16.md).

---

## Summary

| Topic | Intent |
|--------|--------|
| **Domain** | No `ctx` / DB; pure data in, structured results out. |
| **Functions** | All Convex I/O and persistence; composable handlers where possible. |
| **Adapters** | External systems → typed, backend-friendly shapes; **flat `adapters/`** with **`Wsf`** filenames and **role folders** (`fetch`, `resolve`, `pipelines`, `utils`). |
| **Actions** | Orchestration shell: load → domain → persist; keep policy out of the shell. |
| **DTO location** | Validators + `Infer` stay coupled; optional neutral folder later. |

---

## Related references (non-authoritative)

- `docs/convex_rules.mdc` — Convex function and validator conventions.
- `convex/domain/README.md` — if present, domain module notes.
- Historical handoffs under `docs/handoffs/` — useful background; defer to this memo when priorities differ.
