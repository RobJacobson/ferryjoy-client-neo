# Vessel orchestrator: functions-owned orchestration (final layering)

## Purpose

This memo **supplements** [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md).
That document described staged migration (write plans, read ports, orchestrator
deps factory, trip apply outside domain).

**As of Steps A–D (shipped):** production **`updateVesselOrchestrator`** calls
[`executeVesselOrchestratorTick`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts)
in **`convex/functions/vesselOrchestrator/`**. Tick **input/result types** live in
[`types.ts`](../../convex/functions/vesselOrchestrator/types.ts). The domain-layer
**`runVesselOrchestratorTick`** runner and **`VesselOrchestratorTickDeps`** are
**removed** (Step D + E). The top-level tick’s **parallelism, metrics, and logging**
live next to Convex `ActionCtx`. **Trip lifecycle** remains “domain computes plan;
functions applies” via
[`runProcessVesselTripsTick`](../../convex/functions/vesselOrchestrator/runProcessVesselTripsTick.ts).

Here we record **current reality** and **remaining steps** toward the overarching
goal:

> **Domain** has **no** role in scheduling or invoking persistence. It exposes
> **pure inputs → data** (plans, filtered rows, projection inputs). **`convex/functions/`**
> (the orchestrator action and adjacent modules) loads context, calls domain
> helpers, performs **all** Convex writes, and aggregates results.

This is an engineering guide for implementation and review, not a line-by-line
spec.

## Audience

Backend engineers touching `convex/functions/vesselOrchestrator`,
`convex/domain/vesselOrchestration`, and related tests or docs.

## Related documents

- Original staged memo: [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md)
- Step A handoff: [`docs/handoffs/vessel-orchestrator-execute-tick-step-a-handoff-2026-04-17.md`](../handoffs/vessel-orchestrator-execute-tick-step-a-handoff-2026-04-17.md)
- Step B handoff: [`docs/handoffs/vessel-orchestrator-execute-tick-step-b-handoff-2026-04-17.md`](../handoffs/vessel-orchestrator-execute-tick-step-b-handoff-2026-04-17.md)
- Step C handoff (remove `createVesselOrchestratorTickDeps`): [`docs/handoffs/vessel-orchestrator-step-c-createVesselOrchestratorTickDeps-handoff-2026-04-17.md`](../handoffs/vessel-orchestrator-step-c-createVesselOrchestratorTickDeps-handoff-2026-04-17.md)
- Step D + E handoff (remove domain runner; relocate tick types; test rewrites): [`docs/handoffs/vessel-orchestrator-step-d-remove-domain-tick-runner-handoff-2026-04-17.md`](../handoffs/vessel-orchestrator-step-d-remove-domain-tick-runner-handoff-2026-04-17.md)
- Step G handoff (import boundaries; `executeVesselOrchestratorTick` → peer `index.ts`): [`docs/handoffs/vessel-orchestrator-step-g-import-boundaries-handoff-2026-04-17.md`](../handoffs/vessel-orchestrator-step-g-import-boundaries-handoff-2026-04-17.md)
- Post–Step G closeout (Step F audit, optional Step H, lint Stage D): [`docs/handoffs/vessel-orchestrator-post-g-closeout-handoff-2026-04-17.md`](../handoffs/vessel-orchestrator-post-g-closeout-handoff-2026-04-17.md)
- Domain map: [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md)
- Orchestrator README: [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md)
- Module boundaries: [`docs/engineering/imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md)

---

## 1. Final goal (definition of done)

### 1.1 Layering

- **`convex/domain/vesselOrchestration/`** may export:
  - **Pure** or **read-port-only** helpers: eligibility filters, prediction policy,
    `computeVesselTripTickWritePlan`, `buildTimelineTickProjectionInput`, timeline
    assemblers, trip lifecycle builders that **do not** take `ActionCtx` and **do
    not** invoke injected “persist” callbacks.
  - **Shared types** that describe tick inputs/outputs if useful for the action
    signature (optional; see §3.2).

- **`convex/functions/vesselOrchestrator/`** owns:
  - **`ActionCtx`** usage (`runMutation`, `runQuery`, internal APIs).
  - **Orchestration**: `Promise.allSettled` between the location branch and the
    trip stack; **sequential** trip processing then timeline apply inside the trip
    branch; metrics; `[VesselOrchestratorTick]` logging; branch error aggregation.

- **No** `VesselOrchestratorTickDeps` (or equivalent **callback bag**) in
  **`domain/`** — **done** (Step D).

### 1.2 Behavior parity (non-goals)

- Do **not** change: parallel locations vs trip stack; ordering inside the trip
  stack (trips then timeline); per-branch success flags; tick metrics fields
  unless dashboards agree.

### 1.3 Module boundaries, “revealing modules,” and `index.ts`

This work **must** stay aligned with
[`imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md).
That memo’s **staged adoption** (its §6 Stages A–E) maps onto this refactor as
**§3.3** and **Steps G–H** below.

**Policy in practice (vessel orchestrator):**

- **One coherent story per folder.** Each folder should implement **one**
  capability readers can name without reaching for a laundry list.
- **One designed public surface per folder** — typically `index.ts`. Callers
  **outside** the folder import **only** from that entry (or a **small, explicit**
  root such as `types.ts` when the team agrees the contract is type-only and
  deserves its own file).
- **Re-exports are for façades, not buckets.** The **only** place a folder should
  aggregate and re-export sibling or child modules for **external** callers is its
  **`index.ts`** (or the agreed alternate root). We **do not** add “barrel” files
  scattered through the tree, and we **do not** grow an `index.ts` into an
  unrelated grab-bag of exports. If adding “one more export” to an entry file
  feels wrong, that is a **signal to split** responsibilities into another folder
  with its own entry, not to paper over it with mechanical re-exports.
- **Files inside a folder** implement **one main behavior each** (single
  responsibility); the **folder’s** `index.ts` exposes **one broader function** —
  the module’s **primary operation** plus the types and helpers that belong to
  **that** contract (same spirit as the boundaries memo §5).
- **Mechanical import fixes are not always enough.** Routing all imports through
  a bloated `index.ts` **without** tightening what the module *means* produces
  **barrel dumps**. Prefer **separation of concerns**: new subfolders with clear
  names and small entries, or moving types next to the behavior they describe,
  **before** or **instead of** widening a poor façade.

**Vessel-specific watch:** `updateVesselTrips/` and the root
`domain/vesselOrchestration/index.ts` are candidates for **shape review** during
Step H if they accumulate unrelated exports or if `functions/vesselOrchestrator`
must deep-import to avoid a barrel.

---

## 2. Current state (after Steps A–G)

### 2.1 Production path (matches “functions own orchestration”)

- [`updateVesselOrchestrator`](../../convex/functions/vesselOrchestrator/actions.ts)
  returns **`executeVesselOrchestratorTick(ctx, input)`** — no
  `runVesselOrchestratorTick`, no `createVesselOrchestratorTickDeps` in this file.

- [`executeVesselOrchestratorTick`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts)
  owns **`Promise.allSettled`**, branch metrics, `[VesselOrchestratorTick]` logging,
  and inlined effects (locations via `runUpdateVesselLocationsTick` + bulk upsert;
  trips via [`runProcessVesselTripsTick`](../../convex/functions/vesselOrchestrator/runProcessVesselTripsTick.ts);
  timeline via [`applyTickEventWrites`](../../convex/functions/vesselOrchestrator/applyTickEventWrites.ts)).
  Shared telemetry helpers live in
  [`vesselOrchestratorTickHelpers.ts`](../../convex/functions/vesselOrchestrator/vesselOrchestratorTickHelpers.ts);
  schedule lookup wiring in
  [`createScheduledSegmentLookup.ts`](../../convex/functions/vesselOrchestrator/createScheduledSegmentLookup.ts).

- **Trip write path (unchanged):** plan from the trip tick pipeline
  (`computeVesselTripTickWritePlan` in domain) →
  [`runProcessVesselTripsTick`](../../convex/functions/vesselOrchestrator/runProcessVesselTripsTick.ts)
  → apply → timeline projection input from domain (`buildTimelineTickProjectionInput`).

  Implementation files remain as today; **call sites** should prefer **peer
  `index.ts` imports** per §1.3 and Step G.

### 2.2 Remaining cleanup (not production-critical)

- **Steps D + E (shipped):** domain **`runVesselOrchestratorTick`** and
  **`domain/vesselOrchestration/types.ts`** are deleted; orchestrator tick
  contracts live in
  [`functions/vesselOrchestrator/types.ts`](../../convex/functions/vesselOrchestrator/types.ts).
  Tests: [`executeVesselOrchestratorTick.integration.test.ts`](../../convex/functions/vesselOrchestrator/tests/executeVesselOrchestratorTick.integration.test.ts),
  [`executeVesselOrchestratorTick.behavior.test.ts`](../../convex/functions/vesselOrchestrator/tests/executeVesselOrchestratorTick.behavior.test.ts).

**Net:** **Production** control flow is in **functions**. **Step F**
(documentation reconciliation against domain README, `architecture.md`,
orchestrator README, persistence memo §1.8) is **complete** (2026-04-17;
[post–G closeout handoff](../handoffs/vessel-orchestrator-post-g-closeout-handoff-2026-04-17.md)).
**Step G** (peer `index.ts` imports) is shipped. **Step H** is **N/A** unless the
team later chooses a deliberate façade split—see §3 Step H.

---

## 3. Migration plan (actionable steps)

Work in **one PR or a short chain**; run `bun run check:fix`, `bun run type-check`,
and `bun run convex:typecheck` after each logical step.

### 3.1 When to do boundary and module-shape work

Boundary cleanup is **intentionally staged**; it does not all belong in one
mega-PR.

| Phase | What | Good time to start |
| --- | --- | --- |
| **G (imports)** | **Stage B/C** of the boundaries memo: `functions/vesselOrchestrator` imports domain **only** via peer/root entries; extend peer entries **deliberately** when a symbol is part of a **stable contract**. | **Anytime** — can proceed in parallel with C–F or immediately after the next merge. Low behavioral risk if signatures stay the same. Starting **after Step B (shipped)** is already valid. |
| **D–E (domain tick removal)** | Shrinks **domain** exports and moves tests; **best moment** to trim `domain/vesselOrchestration/index.ts` and `types.ts` **without** leaving compatibility re-export layers. | **Step D** is the natural window for **root** domain façade cleanup. |
| **H (shape)** | If Step G exposes a **barrel** or muddled story, **refactor folders** (split modules, narrow entries) rather than only fixing import paths. | After **D–E** when dead symbols are gone **or earlier** if a barrel blocks a clean G — judgment call. |

**Rule of thumb:** **Mechanical** import fixes (G) can run first and often.
**Structural** splits (H) follow **honest** module boundaries; do not “fix” a bad
facade by listing every internal in `index.ts`.

### Step A — Add the functions-layer orchestrator entry (**shipped**)

Implemented: [`executeVesselOrchestratorTick.ts`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts),
[`createScheduledSegmentLookup.ts`](../../convex/functions/vesselOrchestrator/createScheduledSegmentLookup.ts),
and parity coverage. Orchestration logic duplicated from domain until Step D; effects
inlined per §2.1.

### Step B — Point the action at the new entry (**shipped**)

[`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts) calls
`executeVesselOrchestratorTick(ctx, input)` only; no domain runner or factory on
the production path.

### Step C — Delete or shrink `createVesselOrchestratorTickDeps` (**shipped**)

- **Done:** deleted `createVesselOrchestratorTickDeps.ts`. Follow-up parity-only
  wiring was removed in Step D (see below).

- **Optional (not taken):** a tiny **internal** helper `createTripBranchDeps(ctx)` that
  only returns `ProcessVesselTripsDeps` + `runProcessVesselTripsTick` wiring —
  still functions-only, no domain callback interface.

### Step D — Remove domain `runVesselOrchestratorTick` and `VesselOrchestratorTickDeps` (**shipped**)

1. **Deleted** `runVesselOrchestratorTick.ts` from `domain/vesselOrchestration/`.

2. **Deleted** `domain/vesselOrchestration/types.ts`; tick contracts moved to
   [`functions/vesselOrchestrator/types.ts`](../../convex/functions/vesselOrchestrator/types.ts).

3. **Updated** [`domain/vesselOrchestration/index.ts`](../../convex/domain/vesselOrchestration/index.ts)
   to export eligibility helpers only (no runner or tick types).

### Step E — Tests (**shipped** with Step D)

1. **Added** [`executeVesselOrchestratorTick.integration.test.ts`](../../convex/functions/vesselOrchestrator/tests/executeVesselOrchestratorTick.integration.test.ts)
   and [`executeVesselOrchestratorTick.behavior.test.ts`](../../convex/functions/vesselOrchestrator/tests/executeVesselOrchestratorTick.behavior.test.ts);
   removed parity/deps helper tests.

2. **Grep** for removed symbols in TypeScript sources before merge; update READMEs
   as needed.

3. **Tests and deep imports:** colocated tests may still reach into internals if
   the area documents it; prefer **peer entries** where they carry the same
   contract as production (aligns with boundaries memo §4).

### Step F — Documentation sweep (**done**, 2026-04-17)

Reconciled in post–G closeout: [`convex/domain/README.md`](../../convex/domain/README.md),
[`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md),
[`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md),
[`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md) §1.8,
and peer READMEs under `updateVesselLocations` / `updateVesselTrips` describe
**functions-owned** tick orchestration (`executeVesselOrchestratorTick`), not the
removed domain runner.

### Step G — Import boundaries (`functions` → `domain`) (**shipped**)

Maps to **Stage B/C** in
[`imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md).

- **`convex/functions/vesselOrchestrator/**` (excluding colocated tests if
  documented):** import `convex/domain/**` only via **`index.ts`** (or the small
  set of **documented** roots, e.g. `functions/vesselOrchestrator/types.ts` for
  tick contracts).
- **Peer folders** under `domain/vesselOrchestration/` (e.g. `updateVesselTrips/`,
  `updateVesselLocations/`, `updateTimeline/`): callers in **functions** use
  **`PeerFolder/index.ts`**, not `PeerFolder/.../internalFile`.
- **Extend a peer entry only on purpose:** e.g. if
  `createDefaultProcessVesselTripsDeps` is part of the **stable** orchestrator
  trip contract, add it to the **`updateVesselTrips`** façade **if** that façade’s
  story stays coherent; if adding it **bloats** the module, do **Step H** first
  (split a submodule with its own `index.ts`).
- **Replace** deep imports in
  [`executeVesselOrchestratorTick.ts`](../../convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts)
  where peer entries already export the symbol; align tests the same way when
  practical.

### Step H — Module shape review (optional; when Step G surfaces smell) (**N/A**, 2026-04-17)

- **Decision:** No submodule split in this pass. The extended
  [`updateVesselTrips/index.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/index.ts)
  façade remains **intentional** for orchestrator/tick-pipeline discoverability; a
  mechanical split would not improve the module story yet. Extra exports for tests
  (e.g. `processCompletedTrips`) follow the same contract story; if the façade
  later feels overloaded, **revisit** this decision with a deliberate split (e.g.
  `tripLifecycle/index.ts` façade)—without undoing import-boundary policy.
- **If** a future review objects to façade size, prefer **folder splits** and
  **new entries** with a clear primary behavior over expanding a barrel.
  Examples (not prescriptions): separate **trip tick** vs **eligibility** façades;
  move **schedule lookup types** next to the continuity story; keep
  `vesselOrchestration` root `index.ts` **small** and delegate to peer modules.
- **Relationship to lint (boundaries memo Stage D):** Biome `noRestrictedImports`
  for `functions/vesselOrchestrator` is **enabled**—see
  [`imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md) §6
  and [`biome.json`](../../biome.json) `overrides`; optional widening (e.g.
  `functions/vesselTrips`) remains a follow-up.

---

## 4. Files likely touched (checklist)

| File / area | Status |
| --- | --- |
| `functions/vesselOrchestrator/executeVesselOrchestratorTick.ts` | **Done** (Steps A, G: peer `index.ts` imports) |
| `functions/vesselOrchestrator/actions.ts` | **Done** (Step B) |
| `functions/vesselOrchestrator/createScheduledSegmentLookup.ts` | **Done** (Steps A, G: `ScheduledSegmentLookup` via `updateVesselTrips` index) |
| `functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts` | **Removed** (Step C) |
| `domain/vesselOrchestration/runVesselOrchestratorTick.ts` | **Removed** (Step D) |
| `domain/vesselOrchestration/types.ts` | **Removed** (Step D); contracts → `functions/vesselOrchestrator/types.ts` |
| `domain/vesselOrchestration/index.ts` | **Done** (Step D); unchanged in G |
| `domain/vesselOrchestration/updateVesselTrips/index.ts` (and peers) | **Done** Step G (orchestrator façade exports); **N/A** Step H (façade accepted for discoverability; see §3 Step H) |
| `functions/vesselOrchestrator/types.ts` | **Done** (Step D) |
| `functions/vesselOrchestrator/tests/executeVesselOrchestratorTick.*.test.ts` | **Done** (Step E) |
| READMEs under `domain/vesselOrchestration/**`, `functions/vesselOrchestrator/**` | **Done** (Step F reconciliation, 2026-04-17; [post–G closeout handoff](../handoffs/vessel-orchestrator-post-g-closeout-handoff-2026-04-17.md)) |

---

## 5. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Import cycles when functions imports many domain modules | Prefer **fewer, clearer** peer modules (Step H) over a shallow import graph; run `bun run convex:typecheck` frequently. |
| Barrel dumps after Step G | If G forces a **large** `index.ts`, **stop** and do Step H (split) instead of listing every leaf export. |
| Lost test coverage when mocks change | Port tests to fake `ctx`; assert call order and branch outcomes explicitly. |
| Doc drift | Use §4 checklist; grep for old symbols before merge. |

---

## 6. Verification

After each PR:

- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`
- `bun test` for `convex/functions/vesselOrchestrator` and affected domain tests

**When Steps C–D are complete:**

- **Grep:** no remaining production need for `createVesselOrchestratorTickDeps` from
  `actions.ts` (already true after Step B).
- **Grep (end state):** no `runVesselOrchestratorTick` or `VesselOrchestratorTickDeps`
  under `convex/domain/` except any intentional, documented façade choices.

**When Steps G–H are complete:**

- **`functions/vesselOrchestrator` → `domain`:** imports follow **entry files**
  (and agreed roots); no casual deep paths into leaf files (**Step G shipped**).
- **Facades:** Step H submodule split **deferred / N/A** unless a later review
  demands it; optional lint Stage D may still tighten boundaries (see imports memo
  §6 and post–G closeout handoff).

---

## Document history

- **2026-04-17:** Initial memo (post–Stage 4 baseline; functions-owned orchestration plan).
- **2026-04-17:** Updated for **shipped Steps A and B**: production uses
  `executeVesselOrchestratorTick`; §2 and checklist reflect current vs pending work.
- **2026-04-17:** **§1.3** module boundaries and revealing-module guidance; **Steps G–H**
  (imports + optional shape review); **§3.1** timing vs boundaries memo stages;
  checklist and verification extended; trip path in §2.1 described without deep-only
  links.
- **2026-04-17:** **Related documents** — link to Step G handoff
  [`vessel-orchestrator-step-g-import-boundaries-handoff-2026-04-17.md`](../handoffs/vessel-orchestrator-step-g-import-boundaries-handoff-2026-04-17.md).
- **2026-04-17:** **Step G shipped** — `functions/vesselOrchestrator` imports domain via peer `index.ts`; `updateVesselTrips` façade extended (`createDefaultProcessVesselTripsDeps`, `ScheduledSegmentLookup`, `TripEvents`).
- **2026-04-17:** **Related documents** — post–G closeout handoff
  [`vessel-orchestrator-post-g-closeout-handoff-2026-04-17.md`](../handoffs/vessel-orchestrator-post-g-closeout-handoff-2026-04-17.md); **§4 checklist** README row points at that audit.
- **2026-04-17:** **Step F complete** — README / architecture / persistence §1.8
  reconciled; **Step H** marked **N/A** (large `updateVesselTrips` façade accepted);
  §4 checklist README row **Done**; Stage D lint optional follow-up noted in
  [imports-and-module-boundaries-memo.md](imports-and-module-boundaries-memo.md) §6.
- **2026-04-17:** Post-review — Step H notes façade revisit + Stage D **enabled** in
  `biome.json` (imports memo §6).
