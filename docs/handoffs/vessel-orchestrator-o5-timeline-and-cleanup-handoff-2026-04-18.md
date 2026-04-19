# Handoff: O5 — Timeline contract + cleanup

**Status:** **Shipped** — see engineering memo §8; implementation plan
[`.cursor/plans/o5_timeline_cleanup_11ff7b1c.plan.md`](../../.cursor/plans/o5_timeline_cleanup_11ff7b1c.plan.md) (landed with this work).

## Context

**Roadmap:** [`docs/engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)

**Phase:** **O5** — Finalize the **updateTimeline** consumer contract for the four-pipeline tick, align docs with shipped layout, remove small inconsistencies (e.g. duplicate prediction-fallback policy), and optionally trim dead ML-only gates **only** where safe after review.

**Depends on (shipped):**

- **O1** — `orchestratorPipelines.ts`, thin `actions.ts`, compute → locations → apply ordering.
- **O2** — `buildTripCore` / `applyVesselPredictions` split.
- **O3** — `vesselTripPredictions`, `batchUpsertProposals`, overlay equality.
- **O4** — Trip tick uses `buildTripCore` only; `updateVesselPredictions` runs `enrichTripApplyResultWithPredictions` before `updateVesselTimeline`.

**Implementation plan (worker):** [`.cursor/plans/o5_timeline_cleanup_11ff7b1c.plan.md`](../../.cursor/plans/o5_timeline_cleanup_11ff7b1c.plan.md) — match structure to [`.cursor/plans/o4_wire_orchestrator_b4056b93.plan.md`](../../.cursor/plans/o4_wire_orchestrator_b4056b93.plan.md) if you revise scope; **reconcile plan todos with the tree** before treating work complete (plan frontmatter may be ahead of or behind the repo).

**Coding standards:** [`.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc).  
**Workflow:** [`.cursor/guides/agent-handoff-and-plan-pipeline.md`](../../.cursor/guides/agent-handoff-and-plan-pipeline.md) — orchestrator vs worker sessions.

---

## Goal (definition of done)

1. **Timeline input contract is explicit and accurate** — Production `buildTimelineTickProjectionInput` must receive **`ApplyVesselTripTickWritePlanResult` after `updateVesselPredictions`**: completed facts and current-branch messages carry **ML-enriched** trips where projection needs them (`finalProposed`, boundary `newTrip`, etc.). Same-tick timeline does **not** load `vesselTripPredictions` rows to assemble events; it consumes the in-memory enriched apply result (see [`enrichTripApplyResultWithPredictions.ts`](../../convex/functions/vesselOrchestrator/enrichTripApplyResultWithPredictions.ts)). Document this in:
   - [`buildTimelineTickProjectionInput.ts`](../../convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts) (file-level + `BuildTimelineTickProjectionInputArgs` as needed)
   - [`orchestratorPipelines.ts`](../../convex/functions/vesselOrchestrator/orchestratorPipelines.ts) — `UpdateVesselTimelineInput` / `updateVesselTimeline` already sketch this; tighten if anything is still implied-only.

2. **Single source for prediction-fallback policy in trip-plan prep** — [`computeOrchestratorTripWrites.ts`](../../convex/domain/vesselOrchestration/computeOrchestratorTripWrites.ts) should use the same helper as [`processVesselTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts): `computeShouldRunPredictionFallback` from [`tickPredictionPolicy.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/tickPredictionPolicy.ts) (re-exported from the `updateVesselTrips` barrel). Drop redundant inline `getSeconds()` / `PREDICTION_FALLBACK_WINDOW_SECONDS` wiring if unused after the change.

3. **Regression test** — Extend [`buildTimelineTickProjectionInput.test.ts`](../../convex/domain/vesselOrchestration/tests/buildTimelineTickProjectionInput.test.ts): e.g. completed boundary fact that would drive predicted writes but lacks `newTrip` where the assembler requires it should throw (guards the contract described in `timelineEventAssembler` / `completedBoundaryNewTripForTimeline`).

4. **Docs match code** — Fix stale names and links, especially:
   - [`convex/domain/vesselOrchestration/updateTimeline/README.md`](../../convex/domain/vesselOrchestration/updateTimeline/README.md) — replace references to removed entrypoints (`executeVesselOrchestratorTick`, `runProcessVesselTripsTick`, `applyTickEventWrites` if obsolete) with **`orchestratorPipelines.updateVesselTimeline`** / internal apply path actually used in production.
   - [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) — tick diagram and “Functions layer” lists: `actions.updateVesselOrchestrator` → named pipelines; grep for `executeVesselOrchestratorTick` / `runProcessVesselTripsTick` under `convex/domain/vesselOrchestration` after edits.
   - [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) — short **O5** note: timeline contract + pointer to this handoff (optional; handoff remains canonical).

5. **Memo §8** — When merged: mark **O5 — Done** in [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md), add revision bullet, and set this handoff **Status: Shipped** with a one-line pointer to the landed plan commit or PR.

---

## Non-goals (defer unless explicitly agreed)

- Large refactors of `appendPredictions` / `buildTripCore` gating; profiling-driven throttle changes (memo §7).
- Timeline reading **only** from `vesselTripPredictions` DB in the same tick (different latency/contract; would be a new phase).
- Changing WSF fetch cadence or public Convex APIs for this cleanup pass.

---

## Supervisor notes (landmarks)

| Area | Intent |
|------|--------|
| Tick order | `updateVesselTrips` → `updateVesselPredictions` (`enrichTripApplyResultWithPredictions`) → `updateVesselTimeline` (`buildTimelineTickProjectionInput` → `eventsActual` / `eventsPredicted` mutations) — [`orchestratorPipelines.ts`](../../convex/functions/vesselOrchestrator/orchestratorPipelines.ts) |
| ML merge | [`enrichTripApplyResultWithPredictions.ts`](../../convex/functions/vesselOrchestrator/enrichTripApplyResultWithPredictions.ts) — merge before return; `batchUpsertProposals` after merge |
| Domain builder | [`buildTimelineTickProjectionInput`](../../convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts) — pure merge of completed + current branch writes |

**Optional cleanup:** If memo §4.2 “dead ML-only gates” still applies, search `appendPredictions` / trip builders for redundant branches made obsolete by O4; remove only with tests and a short note in the PR.

---

## Tests

- Domain: `buildTimelineTickProjectionInput` tests (above).
- Regression smoke: existing orchestrator tests that chain enrich → `buildTimelineTickProjectionInput` (e.g. [`processVesselTrips.tick.test.ts`](../../convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts)).

Suggested commands:

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test convex/domain/vesselOrchestration/tests/buildTimelineTickProjectionInput.test.ts
bun test convex/functions/vesselOrchestrator
```

---

## PR / review checklist

- [x] Contract documented (TSDoc + README/architecture) — no stale orchestrator filenames in `updateTimeline` README.
- [x] `computeOrchestratorTripWrites` uses `computeShouldRunPredictionFallback` (no duplicate policy logic).
- [x] New or extended test covers the completed-fact / `newTrip` guard.
- [x] Engineering memo §8 and this handoff status updated when shipped.
- [x] Lint, typecheck, Convex typecheck green.

---

## Suggested commit message

`docs(vesselOrchestration): O5 timeline contract, fallback dedupe, and doc cleanup`

---

## Worker prompt (minimum)

Read this handoff and [`.cursor/plans/o5_timeline_cleanup_11ff7b1c.plan.md`](../../.cursor/plans/o5_timeline_cleanup_11ff7b1c.plan.md) first. Implement per approved plan; keep the diff minimal. Run the verification commands above and record results in the PR.

## Revision

- **2026-04-18:** Initial O5 supervisor handoff (memo §4.2 O5 row, O4 handoff pattern, plan path, current code landmarks).
- **2026-04-18:** Shipped — canonical plan `o5_timeline_cleanup_11ff7b1c`; handoff links + Worker prompt updated; TSDoc, fallback dedupe, regression test, docs/memo closeout.
- **2026-04-18:** Review follow-up — PR checklist marked complete; domain README + `updateVesselTrips` / `tripLifecycle` READMEs + `vesselTrips` README + `domain/ml/readme-ml.md` synced to `updateVesselOrchestrator` / `orchestratorPipelines` (removed stale `executeVesselOrchestratorTick` / `runProcessVesselTripsTick` references). *(Later: `updateVesselLocations` domain folder removed; locations upsert lives in `actions.ts`.)*
