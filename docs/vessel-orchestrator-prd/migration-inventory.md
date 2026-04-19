# Vessel orchestration migration — S0 inventory

**Status:** Initial audit captured from the current codebase on **2026-04-19**; section **B** reflects the completed S4 ownership move targets.
This inventory is the required input to the first move PR per [§6 S0 in `vessel-orchestration-next-work-prd.md`](vessel-orchestration-next-work-prd.md).

**How to use**

1. Replace placeholder rows with **every** file under `convex/domain/vesselOrchestration/tickLifecycle/` and `orchestratorTick/`, and every **cross-cutting** file under `updateVesselTrips/` (see S0 steps 5–6 in the PRD).
2. Run `rg` / IDE references to list **all** importing modules for each path; paste or summarize in **Importing modules**.
3. Set **Classification** and **Target**; get review if **Target** is ambiguous.
4. **Commit** this file with the first migration PR (or with the audit-only PR).

---

## A. `tickLifecycle/` (one row per file)

| Path (under `convex/domain/vesselOrchestration/tickLifecycle/`) | Exports (summary) | Importing modules (grouped) | Classification: trip-only \| single-pipeline \| cross-pipeline | Target: `shared/` \| `updateVesselTrips/` \| `updateTimeline/` \| `updateVesselPredictions/` \| `functions/` | Notes |
|----------------------------------------------------------------|---------------------|-----------------------------|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|-------|
| `index.ts` | Public façade for handshake DTOs + projection-wire exports | `functions/vesselOrchestrator/actions.ts`; `domain/vesselOrchestration/index.ts`; tests/docs via package path | `cross-pipeline` | `shared/index.ts` | Completed in S3: façade dissolved into `shared/index.ts`. |
| `projectionWire.ts` | `TickEventWrites`, `TimelineTickProjectionInput`, `mergeTickEventWrites` | `tickLifecycle/index.ts`; consumed externally through that façade | `cross-pipeline` | `shared/tickHandshake/projectionWire.ts` | Pure cross-cutting projection wire; moved in S3. |
| `types.ts` | `CompletedTripBoundaryFact`, current-branch message DTOs, `TripLifecycleApplyOutcome` / `VesselTripPersistResult` | `functions/vesselOrchestrator/actions.ts`; `updateTimeline/types.ts`; `updateTimeline/tickEventWrites.ts`; `updateVesselTrips/processTick/tickEnvelope.ts`; `updateVesselTrips/tripLifecycle/processCompletedTrips.ts`; `updateVesselTrips/tripLifecycle/processCurrentTrips.ts`; `updateVesselTrips/tripLifecycle/vesselTripsComputeBundle.ts`; `orchestratorTick/persistVesselTripsCompute.ts`; `orchestratorTick/tripsComputeStorageRows.ts`; tests | `cross-pipeline` | `shared/tickHandshake/types.ts` | Currently deep-imports trip internals (`BuildTripCoreResult`, `TripEvents`), so it should move only after those dependencies are accepted or narrowed. |

---

## B. `orchestratorTick/` (one row per file)

| Path (under `convex/domain/vesselOrchestration/orchestratorTick/`) | Exports (summary) | Importing modules (grouped) | Classification | Target | Notes |
|--------------------------------------------------------------------|-------------------|-----------------------------|----------------|--------|-------|
| `index.ts` | Public façade for persist glue, prediction materialization, timeline apply prep, write-set helpers | `functions/vesselOrchestrator/actions.ts`; `domain/vesselOrchestration/index.ts`; orchestrator tests; docs | `cross-pipeline` | Split across `shared/index.ts`, `updateVesselPredictions/index.ts`, and `updateTimeline/index.ts` | Completed in S4; façade removed with `orchestratorTick/`. |
| `materializePostTripTableWrites.ts` | ML overlay, proposal building, timeline merge/apply prep (`runUpdateVesselPredictions`, `runUpdateVesselTimeline`, etc.) | `orchestratorTick/index.ts`; `functions/vesselOrchestrator/actions.ts` via index; tests/docs | `cross-pipeline` | Split between `updateVesselPredictions/orchestratorPredictionWrites.ts` and `updateTimeline/orchestratorTimelineProjection.ts` | Completed in S4. |
| `persistVesselTripsCompute.ts` | `VesselTripTableMutations`, `persistVesselTripWriteSet`, alias `persistVesselTripsCompute` | `orchestratorTick/index.ts`; `functions/vesselOrchestrator/actions.ts` via index; `functions/vesselOrchestrator/utils.ts` direct leaf import; tests/docs | `cross-pipeline` | `shared/orchestratorPersist/persistVesselTripsCompute.ts` | Completed in S4; still a candidate for `functions/vesselOrchestrator/` in S10. |
| `tripsComputeStorageRows.ts` | `buildTripsComputeStorageRows`, `completedFactsForSuccessfulHandoffs` | `persistVesselTripsCompute.ts`; `vesselTripTickWriteSet.ts`; `orchestratorTick/index.ts`; tests/docs | `cross-pipeline` | `shared/orchestratorPersist/tripsComputeStorageRows.ts` | Completed in S4. |
| `vesselTripTickWriteSet.ts` | `VesselTripTickWriteSet`, `buildVesselTripTickWriteSetFromBundle` | `persistVesselTripsCompute.ts`; `orchestratorTick/index.ts`; tests/docs | `cross-pipeline` | `shared/orchestratorPersist/vesselTripTickWriteSet.ts` | Completed in S4. |
| `leaveDockActualization.ts` | `actualDepartMsForLeaveDockEffect` | `vesselTripTickWriteSet.ts`; `orchestratorTick/index.ts`; docs | `single-pipeline` | `shared/orchestratorPersist/leaveDockActualization.ts` | Completed in S4. |
| `tests/processCompletedTripsTimeline.test.ts` | Test coverage for persist + predictions + timeline merge sequencing | Local test imports; docs by path only | `cross-pipeline test` | `updateTimeline/tests/processCompletedTripsTimeline.test.ts` | Completed in S4; colocated with timeline-owned merge/apply prep. |
| `tests/vesselTripTickWriteSet.test.ts` | Test coverage for storage rows + write-set shaping | Local test imports; docs by path only | `cross-pipeline test` | `shared/orchestratorPersist/tests/vesselTripTickWriteSet.test.ts` | Completed in S4. |

---

## C. Root `computeVesselTripsWithClock.ts`

| Path | Exports (summary) | Importing modules | Classification | Target | Notes |
|------|-------------------|-------------------|----------------|--------|-------|
| `convex/domain/vesselOrchestration/computeVesselTripsWithClock.ts` | `computeVesselTripsWithClock`, `VesselTripsWithClock`, `VesselTripsWithClockOptions` | `domain/vesselOrchestration/index.ts`; `functions/vesselOrchestrator/actions.ts`; `functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts`; `domain/vesselOrchestration/tests/computeVesselTripsWithClock.test.ts`; docs | `trip-only public entry` | `updateVesselTrips/processTick/computeVesselTripsWithClock.ts` | Root file should survive only as a re-export path through `updateVesselTrips/index.ts`, not as a loose top-level module. |

---

## D. `updateVesselTrips/` — cross-cutting candidates (T1 / T2 only)

List files that are **not** T0 (trip-internal only). T0 files do not need a row unless you want to track them.

| Path | T1/T2 rationale | Importing modules | Target | Notes |
|------|-------------------|-------------------|--------|-------|
| `snapshot/buildScheduleSnapshotQueryArgs.ts` | `T2` — one-per-tick orchestrator query args; not trip-internal | `functions/vesselOrchestrator/actions.ts`; snapshot tests/docs; re-exported via `updateVesselTrips/index.ts` | `shared/scheduleSnapshot/` | First clean move after S0/S1. |
| `snapshot/createScheduledSegmentLookupFromSnapshot.ts` | `T2` — orchestrator loads snapshot once, trip deps consume lookup | `functions/vesselOrchestrator/actions.ts`; `updateVesselTrips` internals/tests; re-exported via `updateVesselTrips/index.ts` | `shared/scheduleSnapshot/` | Keep return type stable or move `ScheduledSegmentLookup` with related continuity types if needed. |
| `snapshot/scheduleSnapshotCompositeKey.ts` | `T2` — used by orchestrator query and snapshot helpers | `functions/vesselOrchestrator/queries.ts`; snapshot helpers/tests; re-exported via `updateVesselTrips/index.ts` | `shared/scheduleSnapshot/` | Cross-cutting utility, not trip lifecycle logic. |
| `snapshot/scheduleSnapshotLimits.ts` | `T2` — used by orchestrator query validators and snapshot arg builder | `functions/vesselOrchestrator/queries.ts`; snapshot builder; re-exported via `updateVesselTrips/index.ts` | `shared/scheduleSnapshot/` | Belongs with the snapshot contract. |
| `snapshot/scheduleSnapshotTypes.ts` | `T2` — return shape for the shared snapshot query + lookup builder | Snapshot helpers/tests; docs; re-exported via `updateVesselTrips/index.ts` | `shared/scheduleSnapshot/` | Should move with the rest of snapshot. |
| `read/mergeTripsWithPredictions.ts` | `T2` — query-time API enrichment, not trip tick compute | `functions/vesselTrips/queries.ts`; read tests/docs; re-exported via `updateVesselTrips/index.ts` | `functions/vesselTrips/` or dedicated read module | Keep out of the trip-tick public story. |
| `read/dedupeTripDocsByTripKey.ts` | `T2` — query-time read helper only | `functions/vesselTrips/queries.ts`; read tests/docs; re-exported via `updateVesselTrips/index.ts` | `functions/vesselTrips/` or dedicated read module | Same ownership as `mergeTripsWithPredictions`. |
| `mutations/departNextActualization.ts` | `T2` — shared policy for `functions/vesselTrips` and `functions/eventsPredicted` | `functions/vesselTrips/mutations.ts`; `functions/events/eventsPredicted/mutations.ts`; docs; re-exported via `updateVesselTrips/index.ts` | `shared/` (or `functions/vesselTrips/` if ownership is narrowed) | Multiple functions modules consume it today, so it is not trip-internal. |
| `continuity/types.ts` | `T2` — generic shared helper depends on `DockedScheduledSegmentSource` | `convex/shared/effectiveTripIdentity.ts`; continuity internals/docs; re-exported via `updateVesselTrips/index.ts` | `shared/continuity/` | Current dependency direction is wrong: generic shared code imports a trip barrel type. |

---

## E. Sign-off

- [x] Inventory complete for **A** and **B** (every file accounted for).
- [x] **C** filled after `rg computeVesselTripsWithClock`.
- [x] **D** lists the T1/T2 files identified in this audit from S0 step 5.
- [ ] Reviewer initials / date: _______________
