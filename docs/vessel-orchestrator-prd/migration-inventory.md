# Vessel orchestration migration — S0 inventory

**Status:** Working document — fill **before** the first move PR per [§6 S0 in `vessel-orchestration-next-work-prd.md`](vessel-orchestration-next-work-prd.md).

**How to use**

1. Replace placeholder rows with **every** file under `convex/domain/vesselOrchestration/tickLifecycle/` and `orchestratorTick/`, and every **cross-cutting** file under `updateVesselTrips/` (see S0 steps 5–6 in the PRD).
2. Run `rg` / IDE references to list **all** importing modules for each path; paste or summarize in **Importing modules**.
3. Set **Classification** and **Target**; get review if **Target** is ambiguous.
4. **Commit** this file with the first migration PR (or with the audit-only PR).

---

## A. `tickLifecycle/` (one row per file)

| Path (under `convex/domain/vesselOrchestration/tickLifecycle/`) | Exports (summary) | Importing modules (grouped) | Classification: trip-only \| single-pipeline \| cross-pipeline | Target: `shared/` \| `updateVesselTrips/` \| `updateTimeline/` \| `updateVesselPredictions/` \| `functions/` | Notes |
|----------------------------------------------------------------|---------------------|-----------------------------|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|-------|
| _example: `types.ts`_ | _…_ | _…_ | _cross-pipeline_ | _`shared/tickHandshake/types.ts`_ | _…_ |
| | | | | | |

---

## B. `orchestratorTick/` (one row per file)

| Path (under `convex/domain/vesselOrchestration/orchestratorTick/`) | Exports (summary) | Importing modules (grouped) | Classification | Target | Notes |
|--------------------------------------------------------------------|-------------------|-----------------------------|----------------|--------|-------|
| | | | | | |

---

## C. Root `computeVesselTripsWithClock.ts`

| Path | Exports (summary) | Importing modules | Classification | Target | Notes |
|------|-------------------|-------------------|----------------|--------|-------|
| `convex/domain/vesselOrchestration/computeVesselTripsWithClock.ts` | | | | `updateVesselTrips/...` (per PRD S5) | |

---

## D. `updateVesselTrips/` — cross-cutting candidates (T1 / T2 only)

List files that are **not** T0 (trip-internal only). T0 files do not need a row unless you want to track them.

| Path | T1/T2 rationale | Importing modules | Target | Notes |
|------|-------------------|-------------------|--------|-------|
| _example: `snapshot/buildScheduleSnapshotQueryArgs.ts`_ | _T2 — orchestrator + trip_ | _actions, …_ | _`shared/scheduleSnapshot/`_ | |

---

## E. Sign-off

- [ ] Inventory complete for **A** and **B** (every file accounted for).
- [ ] **C** filled after `rg computeVesselTripsWithClock`.
- [ ] **D** lists every T1/T2 file from S0 step 5.
- [ ] Reviewer initials / date: _______________
