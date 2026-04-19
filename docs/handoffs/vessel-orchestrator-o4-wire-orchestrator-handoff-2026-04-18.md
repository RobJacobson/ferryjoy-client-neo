# Handoff: O4 — Wire orchestrator (trips without ML; predictions phase real)

**Status:** **Shipped** — see engineering memo §8 and implementation pointers below.

## Context

**Roadmap:** [`docs/engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)

**Phase:** **O4** — Connect the four-pipeline layout to **one** ML execution path:
trip lifecycle builds **schedule + gates only** (`buildTripCore`), persists **strip-shaped**
trips, then runs **`updateVesselPredictions`** to execute `applyVesselPredictions`,
map results to `vesselTripPredictions` proposals, and call the O3 writer. Simplify
the strip path where ML no longer rides on trip upsert payloads.

**Depends on:**

- **O1** — `orchestratorPipelines.ts`, thin `actions.ts` (ordering at the time:
  plan → location upsert → apply; **current:** location upsert **before** trip compute — see `architecture.md`).
- **O2** — Exported `buildTripCore` / `BuildTripCoreResult`; `buildTrip` remains
  the composer for tests; production orchestrator deps use `buildTripCore` only.
- **O3** — `vesselTripPredictions` table, `internal.functions.vesselTripPredictions.*`
  (`batchUpsertProposals`, `listByVesselTripScopes`), domain
  `planVesselTripPredictionWrite` / overlay-normalized equality.

**Coding standards:** [`.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc).
**Test comment sync:** When editing orchestrator tests, follow
[`vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md`](vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md)
§**Test and comment sync**.

---

## Goal (definition of done)

1. **Trip tick uses `buildTripCore` only** — Production `ProcessVesselTripsDeps`
   wired from `createDefaultProcessVesselTripsDeps` should invoke **`buildTripCore`**
   (not `buildTrip`) inside `processCurrentTrips` and `processCompletedTrips`
   (same call graph as today, different builder). `predictionModelAccess` may
   remain on the deps bag for typing parity, but **must not** be used by the
   core builder.

2. **`updateVesselPredictions` is real** — After `applyVesselTripTickWritePlan`
   returns (and **before** `updateVesselTimeline`), the orchestrator runs ML:
   for each relevant **core** outcome from the tick, call
   `applyVesselPredictions(predictionModelAccess, core.withFinalSchedule, core.gates)`,
   derive **`VesselTripPredictionProposal[]`** (natural key: `VesselAbbrev` +
   `TripKey` from the trip row + `PredictionType`), and invoke
   `ctx.runMutation(internal.functions.vesselTripPredictions.mutations.batchUpsertProposals, { proposals })`.
   Reuse O3 compare-then-write semantics (already inside the mutation).

3. **Strip path simplified** — `stripTripPredictionsForStorage` should become
   redundant for trips that **never** carry the five ML fields in the tick plan
   (or remain a safe no-op). Applier and docs should state the single source of
   ML truth: **`vesselTripPredictions`** for storage reads, not trip documents.

4. **End-to-end tick behavior** — Predicted/actual timeline projection must
   still see **ML-enriched trip shapes** where today’s code uses
   `ConvexVesselTripWithML` in `pendingPredictedMessages` /
   `buildTickEventWritesFromCurrentMessages`. **Do not** ship O4 with silent
   regression on `eventsPredicted` / overlay rows. Typical approach:
   - Run `applyVesselPredictions` in the predictions phase, then **thread** the
     resulting trips (or an equivalent augmentation) into
     `buildTimelineTickProjectionInput` (e.g. enrich `CurrentTripLifecycleBranchResult`
     or extend `UpdateVesselTimelineInput`), **or**
   - Merge from `listByVesselTripScopes` before timeline assembly (extra reads;
     trade latency vs simpler types).
   Exact contract refinement may still overlap **O5**; if anything is deferred,
   document known gaps in the PR and in [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md).

5. **Docs** — Update `convex/functions/vesselOrchestrator/README.md` (predictions
   step no longer a stub), `architecture.md` §10 / trip flow, and engineering memo
   §8 when merged.

---

## Non-goals (defer unless explicitly agreed)

- **O5 scope** — Final `buildTimelineTickProjectionInput` consumer contract if
  the product wants timeline to read **only** `vesselTripPredictions` and not
  in-memory ML; broad cleanup of ML-only gates in `appendPredictions` after
  profiling.
- Changing WSF fetch cadence, cron, or `PREDICTION_FALLBACK_WINDOW_SECONDS`
  policy (memo §7 open decisions).
- Perfect deduplication beyond O3’s application-level diffing.

---

## Supervisor notes (current code landmarks)

| Area | Today | O4 target |
|------|--------|-----------|
| [`defaultProcessVesselTripsDeps.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/defaultProcessVesselTripsDeps.ts) | Injects `buildTrip` | Inject `buildTripCore` (or a thin alias) for orchestrator-driven ticks |
| [`processCurrentTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts) | `deps.buildTrip` → `ConvexVesselTripWithML` | `buildTripCore` → core proposal shape; **overlay/suppression** (`tripWriteSuppressionFlags`) may need to compare **core vs core** for storage, and use ML from predictions phase for overlay refresh — verify against [`tripEquality.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripEquality.ts) |
| [`processCompletedTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCompletedTrips.ts) | `newTrip` from `buildTrip` | `newTrip` from `buildTripCore` only |
| [`orchestratorPipelines.ts`](../../convex/functions/vesselOrchestrator/orchestratorPipelines.ts) | `updateVesselPredictions` no-op | Pass `predictionModelAccess`, tick policy, and **structured inputs** from the trip plan/apply path into ML + writer |
| [`applyVesselTripTickWritePlan.ts`](../../convex/functions/vesselTrips/applyVesselTripTickWritePlan.ts) | Strips ML before upsert | Keep strip until all producers omit ML fields; then narrow or document identity |
| [`applyVesselPredictions.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/applyVesselPredictions.ts) | Invoked from `buildTrip` | Invoked from predictions phase only for orchestrator ticks |

**Threading `BuildTripCoreResult`:** The trip **plan** already computes one core
result per transition. O4 likely needs an explicit **carry-forward** structure
(e.g. extend `VesselTripTickWritePlan` or add a parallel `predictionInputs` array
keyed by vessel) so `updateVesselPredictions` does not re-run `buildTripCore`
blindly without the same transition context. Avoid duplicate `buildTripCore`
calls per vessel per tick unless profiling says otherwise.

**Proposal construction:** Each non-absent field among `AtDockDepartCurr`,
`AtDockArriveNext`, `AtDockDepartNext`, `AtSeaArriveNext`, `AtSeaDepartNext`
on the **output** of `applyVesselPredictions` becomes up to one
`VesselTripPredictionProposal` (see
[`schemas.ts`](../../convex/functions/vesselTripPredictions/schemas.ts));
`TripKey` comes from the trip row (`functions/vesselTrips/schemas`).

---

## Tests

- Extend or add orchestrator- and domain-level tests so that:
  - Trip mutations do not rely on ML fields on `activeVesselTrips` /
    `completedVesselTrips` rows for the new path.
  - `batchUpsertProposals` receives proposals when ML output changes; skips when
    overlay-normalized equal (align with O3 tests).
  - Where feasible, assert timeline tick inputs still receive ML-shaped trips for
    predicted batches (or document the interim merge strategy).

Suggested commands:

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test convex/functions/vesselOrchestrator
bun test convex/domain/vesselOrchestration/updateVesselTrips
bun test convex/functions/vesselTripPredictions
```

---

## PR / review checklist

- [ ] Orchestrator order unchanged except predictions step **doing work**:
  `updateVesselTrips` → **`updateVesselPredictions` (ML + persistence)** →
  `updateVesselTimeline`.
- [ ] No double ML compute (remove `applyVesselPredictions` from the trip builder
  on the orchestrator path).
- [ ] `stripTripPredictionsForStorage` usage matches actual trip payload shapes.
- [ ] TSDoc on new/changed pipeline signatures (`@param` / `@returns`).
- [ ] README + architecture memo + engineering memo §8 updated when shipped.
- [ ] Lint, typecheck, Convex typecheck green.

---

## Suggested commit message

`feat(vesselOrchestrator): wire O4 predictions phase and buildTripCore-only trip tick`

---

## Implementation pointers (post-ship)

- **`createDefaultProcessVesselTripsDeps(lookup)`** — `buildTripCore` only; no
  `predictionModelAccess` (`defaultProcessVesselTripsDeps.ts`).
- **`enrichTripApplyResultWithPredictions`** — `applyVesselPredictions`, merge
  onto `completedFacts` / current messages, `batchUpsertProposals`
  (`enrichTripApplyResultWithPredictions.ts`).
- **Orchestrator** — `actions.ts` passes `predictionModelAccess` only to
  `updateVesselPredictions`; timeline receives enriched apply result.
- **Proposals** — `vesselTripPredictionProposalsFromMlTrip` (domain).

## Revision

- **2026-04-18:** Initial O4 handoff (supervisor review of memo, O1–O3 handoffs,
  and current `vesselOrchestrator` / `vesselTripPredictions` / trip pipeline code).
- **2026-04-18:** Marked **Shipped**; added implementation pointers after land.
