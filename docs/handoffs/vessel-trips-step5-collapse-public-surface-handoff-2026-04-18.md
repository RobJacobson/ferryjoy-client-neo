# Handoff: Step 5 — Collapse `updateVesselTrips` public surface

**Date:** 2026-04-18  
**Audience:** engineers or agents executing Step 5 of the vessel-trips refactor  
**Roadmap:** [`docs/engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)  
**Prerequisites:** Steps 1–4 complete — handoffs [`vessel-trips-step1-tick-anchor-handoff-2026-04-18.md`](./vessel-trips-step1-tick-anchor-handoff-2026-04-18.md), [`vessel-trips-step2-pure-write-set-handoff-2026-04-18.md`](./vessel-trips-step2-pure-write-set-handoff-2026-04-18.md), [`vessel-trips-step3-persist-write-set-handoff-2026-04-18.md`](./vessel-trips-step3-persist-write-set-handoff-2026-04-18.md), [`vessel-trips-step4-bulk-schedule-snapshot-handoff-2026-04-18.md`](./vessel-trips-step4-bulk-schedule-snapshot-handoff-2026-04-18.md)

## Purpose

Deliver memo **Step 5 — Collapse `updateVesselTrips` public surface**: a **small, intentional** `updateVesselTrips/index.ts` (per [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)), optional **physical folder split** (`completed/`, `inService/`, `shared/` as in the memo’s target sketch), and **no more ad-hoc deep imports** from outside the folder except where the team explicitly allows (e.g. colocated tests).

Step 4 is done: bulk **`ScheduleSnapshot`**, **`getScheduleSnapshotForTick`**, and **sync** **`createScheduledSegmentLookupFromSnapshot`** are wired; this step is **organizational and API-boundary** work, not schedule I/O.

**Status (2026-04-18):** **Shipped** — public surface is `updateVesselTrips/index.ts` only for external callers; `processCompletedTrips` tests colocated under `updateVesselTrips/tests/`; Biome `noRestrictedImports` extended to `convex/functions/vesselTrips/**/*.ts`. Optional **`completed/` / `inService/` / `shared/`** folder split remains for a follow-up PR.

## Goal

- **Designed public API** — `index.ts` exports **one primary trip-tick story** (the memo’s steady state names it e.g. `runUpdateVesselTrips`; today the orchestrator still uses **`computeVesselTripsWithClock`** in `computeVesselTripsWithClock.ts` plus symbols from this barrel). Decide whether the **canonical runner** lives in **`updateVesselTrips/`** or remains **`domain/vesselOrchestration/computeVesselTripsWithClock.ts`**, but **outside** the folder should import **only** what `index.ts` exposes for that contract (types included), not grab-bags of internals.
- **Folder layout (memo)** — Move or group implementation files under **`completed/`**, **`inService/`**, **`shared/`** as appropriate; keep **`snapshot/`** and other cross-cutting subtrees coherent (exact mapping is a design choice; preserve git history with directory moves if the team prefers).
- **Stop exporting implementation noise** — Snapshot caps, composite keys, and **`processCompletedTrips`** are useful, but **only** belong on the public barrel if **external** modules legitimately need them; otherwise keep them internal and expose a narrower façade (memo warns against barrel dumps).
- **Fix external deep imports** — Code **outside** `updateVesselTrips/` should import **`domain/vesselOrchestration/updateVesselTrips`** (the entry) for every supported need; add exports **deliberately** when a caller has a real contract requirement.

## Non-goals (this step)

- **No** removal of **`TripLifecycleApplyOutcome`** or timeline coupling from the trip step (**Step 6**).
- **No** requirement to delete **`vesselTripsExecutionPayloads`** or complete **Step 7** doc sweep unless a rename forces it.
- **No** change to **bulk snapshot semantics** or **`getScheduleSnapshotForTick`** contracts unless a **public-API** rename requires it.

## Current landmarks (read first)

| Area | Location |
|------|----------|
| Barrel (wide today) | `convex/domain/vesselOrchestration/updateVesselTrips/index.ts` — deps, snapshot helpers, lifecycle types, `processCompletedTrips`, etc. |
| Orchestrator consumers | `convex/functions/vesselOrchestrator/actions.ts`, `convex/functions/vesselOrchestrator/queries.ts` — import from **`updateVesselTrips`** entry today (good). |
| Parent wrapper | `convex/domain/vesselOrchestration/computeVesselTripsWithClock.ts` — imports bundle API from **`./updateVesselTrips`** but **`VesselTripsComputeBundle`** type from **`./updateVesselTrips/tripLifecycle/vesselTripsComputeBundle`** (deep). |
| Peer domain | `convex/domain/vesselOrchestration/updateTimeline/types.ts` — deep-imports **`tripLifecycle/buildTrip`**, **`tripEventTypes`**. |
| Functions façade | `convex/functions/vesselTrips/queries.ts`, `mutations.ts` — deep-import **`read/`**, **`mutations/departNextActualization`**. |
| Shared | `convex/shared/effectiveTripIdentity.ts` — deep-import **`continuity/types`**. |
| Events | `convex/functions/events/eventsPredicted/mutations.ts` — deep-import **`mutations/departNextActualization`**. |
| Policy | [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md) — **one entry file**, callers outside the folder import **only** that entry. |

## Implementation notes (suggested order)

1. **Inventory** — Grep for `updateVesselTrips/` paths **outside** the folder; classify each symbol as **public contract** vs **internal** (tests may keep deep paths per team rules).
2. **API design** — List the **minimum** exports needed by `actions.ts`, `queries.ts`, `computeVesselTripsWithClock`, `orchestratorTick/*`, `updateVesselPredictions`, `updateTimeline`, and `functions/vesselTrips/*`. Promote types/functions to `index.ts` only when required; shrink the rest.
3. **Folder moves** — After imports stabilize, move files into **`completed/`** / **`inService/`** / **`shared/`** (and adjust relative imports); update `architecture.md` §paths only if the team wants docs in scope for this PR.
4. **Tests** — Prefer updating imports to the entry; colocated **`updateVesselTrips/tests/**`** may still target leaf modules if documented.

## Acceptance criteria

- **External** modules (outside `convex/domain/vesselOrchestration/updateVesselTrips/`) do not depend on **unsupported** deep paths, or each exception is **documented** (e.g. test-only).
- `updateVesselTrips/index.ts` reads as a **coherent** module boundary—not a re-export of every subdirectory.
- `bun run type-check`, `bun run test`, and `bun run convex:typecheck` pass.

## Verification

```bash
bun run check:fix
bun run type-check
bun run test
bun run convex:typecheck
```

Optional: ripgrep for remaining deep imports:

```bash
rg 'domain/vesselOrchestration/updateVesselTrips/' --glob '!**/updateVesselTrips/**'
```

## Related docs

- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md) — Step 5 definition; target file tree in §(b)
- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md) — entry-file rules
- [`convex/domain/vesselOrchestration/architecture.md`](../convex/domain/vesselOrchestration/architecture.md) — live orchestrator + `updateVesselTrips` layout
