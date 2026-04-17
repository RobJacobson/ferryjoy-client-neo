# Handoff: Vessel trips refactor — Phase 0 (documentation + safety net)

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Owner / context:** Parent refactor is the “four orchestrator concerns” reorg described in  
[`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md)  
(sections *Target reorganization*, *Phased cleanup / reorg*, and *§10 Suggested refactor sequence*).

**Goal:** Complete **Phase 0 only** — no behavioral changes to production trip logic. Deliver **discoverable documentation** and a **single golden-path test** that locks in sequencing confidence before Phases 1–5.

---

## What Phase 0 is (canonical)

From `architecture.md` §10:

1. **Architecture doc and README links** — ensure the architecture narrative is easy to find from domain, functions, and orchestrator entrypoints.
2. **Golden-path lifecycle test** — one test that exercises the **happy sequence** called out in §B (narrow refactors): *continuing active trip → leave dock → arrive / complete* (and, where practical, orchestrator-consistent ordering: lifecycle then `applyTickEventWrites`).

This phase is explicitly **before** naming wrappers (Phase 1), folder moves (Phase 2), and timeline/prediction extraction (Phases 3–4).

---

## Current state (audit)

### Architecture document

- **Present:** [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) — execution paths, glossary, phased plan, four-concern target model.
- **Already linked from:**
  - [`convex/domain/README.md`](../../convex/domain/README.md) — `vesselTrips/` bullet points to `vesselTrips/architecture.md`.
  - [`convex/functions/vesselTrips/README.md`](../../convex/functions/vesselTrips/README.md) — top “Architecture (domain)” link.
  - [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) — “Related Documentation” section.

### Gaps / inconsistencies to fix in Phase 0 (docs)

1. **`convex/domain/vesselTrips/` has no `README.md`**  
   The folder is navigated via `index.ts` and cross-links from other READMEs. A **short** `README.md` that points to `architecture.md` and lists the main subfolders (`processTick/`, `tripLifecycle/`, `projection/`, etc.) improves onboarding and satisfies “README links” without duplicating the long doc.

2. **`convex/domain/README.md` duplicate bullets**  
   Lines describing `scheduledTrips/` appear **twice** (two slightly different wordings). Phase 0 should **dedupe** to one bullet so the vesselTrips link is not buried in noise.

3. **Orchestrator cadence mismatch**  
   - [`convex/crons.ts`](../../convex/crons.ts) schedules `updateVesselOrchestrator` every **15 seconds**.  
   - [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) currently says orchestrator runs roughly every **5 seconds** in the overview.  
   **Action:** Align README (and any other stray copies) with **15s** to match `crons.ts` and `architecture.md`.

4. **Optional polish:** Add a short “Related documentation” block at the **top** of `architecture.md` (after the title) linking back to `convex/domain/README.md`, `convex/functions/vesselTrips/README.md`, and `convex/functions/vesselOrchestrator/README.md` — only if it stays minimal; avoid duplicating §2’s path list.

---

## Golden-path test — intent and constraints

### Why

- `processVesselTrips.test.ts` already has many **focused** cases (upsert suppression, prediction-only projection, leave-dock ordering vs upsert, arrival actual, etc.).
- `processCompletedTrips.test.ts` exercises **completion** at the `processCompletedTrips` layer with `buildTickEventWritesFromCompletedFacts`.
- **Gap:** There is **no single narrative test** at `processVesselTripsWithDeps` that walks a **minimal multi-step lifecycle** in order, asserting **call ordering** and **high-level outcomes** the way §3–4 of the architecture doc describes (Paths 1–3).

Phase 0 should add **one** `describe` block (e.g. `"golden path: docked → at sea → completed rollover"`) that is **readable as documentation** (comments tie steps to architecture paths).

### Recommended scope (domain-only, matches existing patterns)

- **File:** extend [`convex/domain/vesselOrchestration/updateVesselTrips/tests/processVesselTrips.test.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tests/processVesselTrips.test.ts) **or** add a dedicated `goldenPathLifecycle.test.ts` next to it if the new test is long — prefer **one file** unless size forces a split.
- **Harness:** Reuse existing helpers: `runVesselTripsTick` / `createTestActionCtx` / `createDeps` / `makeTrip` / `makeLocation` patterns already in that file so behavior stays consistent with other sequencing tests.
- **Stages (illustrative — adjust to what fakes support cleanly):**
  1. **Continuing trip (Path 1):** stable active trip + location; events = not completed, not leave; built trip may change overlay-only or storage — assert **no unnecessary mutations** or a single upsert if you inject a storage-visible change (pick the smallest assertion that proves “tick ran”).
  2. **Leave dock (Path 2):** same vessel; `didJustLeaveDock: true`; built trip reflects departure boundary; assert **`mutation:upsert` before `mutation:departNextBackfill`** when upsert succeeds (pattern already in `"runs leave-dock post-persist work only after a successful upsert"`).
  3. **Completion / rollover (Path 3):** next tick **or** same test continuation with `isCompletedTrip: true` and deps supplying `buildCompletedTrip` / `buildTrip(... tripStart ...)` outputs as existing `processCompletedTrips` tests do — assert **`completeAndStartNewTrip`-style boundary mutation** is invoked and timeline writes are produced (mirror expectations from `processCompletedTrips.test.ts` but through **`processVesselTripsWithDeps` + `applyTickEventWritesLikeOrchestrator`**).

### Out of scope for Phase 0

- **Do not** refactor `buildTrip`, split prediction phases, or move folders.
- **Do not** add Convex `functions/` integration tests unless the domain fake cannot express completion — default is **domain unit test with fakes** only.
- **Do not** assert on every field of every row; golden path is **sequence and presence**, not exhaustive data parity.

### Acceptance criteria (test)

- One clearly named test (or nested `it` steps inside one `it` with comments) that references **architecture paths** in comments.
- Assertions cover **ordering** where the architecture promises it (e.g. upsert before depart-next backfill on leave-dock; lifecycle before timeline apply — already modeled by `runVesselTripsTick`).
- `bun test convex/domain/vesselOrchestration/updateVesselTrips/tests/` passes; run full project checks per repo standards.

---

## Verification commands

From repo root:

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test convex/domain/vesselOrchestration/updateVesselTrips/tests/
```

---

## Deliverables checklist

- [ ] `convex/domain/vesselOrchestration/updateVesselTrips/README.md` (short pointer to `architecture.md` + folder map) **or** explicit decision in PR why not needed (prefer adding it).
- [ ] `convex/domain/README.md` — remove duplicate `scheduledTrips/` bullet; keep one accurate description.
- [ ] `convex/functions/vesselOrchestrator/README.md` — cron interval aligned with `crons.ts` (15s).
- [ ] Golden-path test landed as above.
- [ ] No production logic changes; diff is docs + tests only (except trivial comment fixes in touched files).

---

## Open questions for the owner (resolve before or during implementation)

1. **Golden-path granularity:** Should completion be **two ticks** (leave, then complete) or **one tick** with multiple vessels? Prefer **one vessel, two or three ticks** for clarity.
2. **README in `domain/vesselTrips/`:** Confirm team wants a new README vs relying on `architecture.md` + `domain/README.md` only.
3. **Cross-link from `architecture.md`:** Add “back” links or keep it the single source of truth without reciprocal links?

---

## After Phase 0

Proceed to **Phase 1** in `architecture.md` §10: four-concern names in code comments or thin wrappers; introduce explicit trip-tick result → timeline types — **separate handoff**, separate PR if possible.
