# Handoff: Vessel orchestrator Stage E timeline pipeline

**Date:** 2026-04-19  
**Audience:** engineer or agent implementing Stage E of the idempotent
four-pipeline refactor  
**Status:** actionable handoff for the next implementation pass

## Primary reference

Read this PRD first and treat it as the source of truth for Stage E:

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)

Pay special attention to:

- **§8.4** `runUpdateVesselTimeline` (target input/output and notes on the
  transitional `TripLifecycleApplyOutcome` parameter)
- **§12** migration plan — Stage E: timeline
- **§15** acceptance criteria — item 6 (timeline consumes prior outputs)

Read these as active constraints:

- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- [`/.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)

Optional background, only if needed:

- [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)
- [`vessel-orchestrator-stage-d-predictions-handoff-2026-04-19.md`](./vessel-orchestrator-stage-d-predictions-handoff-2026-04-19.md)

## What Stages A through D already landed

**Stage A** froze public contracts for all four pipelines, including timeline:

- [`updateTimeline/contracts.ts`](../../convex/domain/vesselOrchestration/updateTimeline/contracts.ts)

**Stage B** established domain ownership for locations (upstream of trips).

**Stage C** made `runUpdateVesselTrips` the canonical trip compute boundary:

- `runUpdateVesselTrips(...) -> { activeTrips, completedTrips, tripComputations }`

**Stage D** made `runUpdateVesselPredictions` a plain-data consumer of
`tripComputations` and `predictionContext`, and emits `predictedTripComputations`
for downstream timeline. Domain prediction code does not query Convex on the
orchestrator path.

Stage E assumes those handoffs are stable and treats **`tripComputations`** and
**`predictedTripComputations`** as the authoritative inputs for timeline
assembly on the orchestrator path.

## Stage E goal

Make **`updateVesselTimeline`** the real domain owner of timeline *computation*
under the Stage A public contract: **black-box** `RunUpdateVesselTimelineInput ->
RunUpdateVesselTimelineOutput`, with **no** `ActionCtx`, no Convex reads/writes
in domain, and **no** dependency on **`TripLifecycleApplyOutcome`** as part of
the public story.

Concretely:

- **`runUpdateVesselTimeline(input) -> output`** is the canonical public
  entrypoint (signature and types should match
  [`contracts.ts`](../../convex/domain/vesselOrchestration/updateTimeline/contracts.ts)).
- Timeline consumes **`tripComputations`** (Stage C) and
  **`predictedTripComputations`** (Stage D) only — the PRD handoff in **§8.4**.
- The functions layer loads nothing extra for timeline that duplicates what
  those handoffs already encode; it **dedupes**, **persists**, and sequences
  mutations after domain returns rows (same layering as other pipelines).

Stage E is where the timeline concern stops being explained primarily through
**`TripLifecycleApplyOutcome`** merged with predictions in
[`orchestratorTimelineProjection.ts`](../../convex/domain/vesselOrchestration/updateTimeline/orchestratorTimelineProjection.ts).

## Current state

The Stage A **types** in `contracts.ts` already describe the target
`RunUpdateVesselTimelineInput` (including `tickStartedAt`, `tripComputations`,
`predictedTripComputations`).

The **runner** is still transitional:

- [`updateTimeline/index.ts`](../../convex/domain/vesselOrchestration/updateTimeline/index.ts)
  documents that `runUpdateVesselTimeline` does not yet match the final PRD
  handoff-only story.
- [`orchestratorTimelineProjection.ts`](../../convex/domain/vesselOrchestration/updateTimeline/orchestratorTimelineProjection.ts)
  takes **`TripLifecycleApplyOutcome`** as its first argument, merges ML via
  **`mergeTripApplyWithPredictedComputationsForTimeline`**, then calls
  **`buildTimelineTickProjectionInput`**. The merge exists because projection
  still expects lifecycle-shaped **`completedFacts`** /
  **`currentBranch`** (see
  [`buildTimelineTickProjectionInput.ts`](../../convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts)).

On the functions side, [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)
**`updateVesselTimeline`** still receives **`tripApplyResult`** from
**`persistVesselTripWriteSet`** (trip persistence) and passes it into domain
alongside `tripComputations` and `predictedTripComputations`. That is the
structural coupling Stage E removes from the orchestrator path.

The current **`runUpdateVesselTimeline`** return shape is **mutation-oriented**
(`Writes` / `Batches`), while **`RunUpdateVesselTimelineOutput`** in contracts
names **`actualEvents`** / **`predictedEvents`**. Stage E should align public
domain output with the frozen contract (including a clear mapping boundary at
**`convex/functions`** if mutation payloads differ from persisted row shapes).

## Desired Stage E end state

### Public domain story

- **`runUpdateVesselTimeline(input) -> { actualEvents, predictedEvents }`**
  per [`contracts.ts`](../../convex/domain/vesselOrchestration/updateTimeline/contracts.ts).
- **`RunUpdateVesselTimelineInput`** is exactly the PRD shape — no parallel
  “lifecycle outcome” parameter on the public API.

### Domain ownership

**`updateVesselTimeline`** should own:

- deriving timeline projection inputs from **`tripComputations`** and
  **`predictedTripComputations`** (including whatever replaced the current
  merge of ML onto **`TripLifecycleApplyOutcome`**),
- emitting the full computed **`actualEvents`** and **`predictedEvents`** for
  the tick.

Domain should **not** take **`TripLifecycleApplyOutcome`** as a public input
once Stage E is complete. Any legacy handshake types may remain **private**
adapters inside the folder only if still required briefly — prefer collapsing
to handoff-driven assembly per **§11** of the PRD.

### Functions-layer story

**`convex/functions`** should own:

- orchestration order (locations → trips → predictions → timeline),
- **dedupe** and **persistence** for timeline tables using table-specific
  identity and equality rules,
- mapping domain rows to mutation calls if the Convex mutation surface is
  batch-shaped.

Do **not** move dedupe/persistence semantics into domain.

### Relationship to trip persistence

Trip table writes remain the concern of the trips phase. Stage E should **not**
require timeline to depend on **`VesselTripPersistResult`** / apply outcomes for
the same information that is already recoverable from **`tripComputations`** and
**`predictedTripComputations`**, unless a gap analysis proves a field truly exists
only on the persist path — in that case, prefer extending the **handoff DTOs**
(in a minimal, additive way) with agreement from the PRD, rather than
reintroducing a second parallel pipeline input.

## Main implementation target

Replace the public explanation of timeline from:

- **`TripLifecycleApplyOutcome` + `RunUpdateVesselTimelineInput` → mutation-shaped
  projection payloads**

with:

- **`RunUpdateVesselTimelineInput` → `RunUpdateVesselTimelineOutput`**
  (plain data in, plain data out).

The core architectural win is **one** consumer story for timeline on the
orchestrator path: prior stage outputs in memory, not a merge with
persistence-scoped lifecycle structs.

## Recommended implementation approach

### 1. Keep the public contract stable unless unavoidable

Treat [`contracts.ts`](../../convex/domain/vesselOrchestration/updateTimeline/contracts.ts)
as the default surface. If **`ActualDockEventRow`** / **`PredictedDockEventRow`**
need adjustment, keep changes **minimal and additive** where possible.

### 2. Drive `buildTimelineTickProjectionInput` (or its successor) from handoffs

Today, **`BuildTimelineTickProjectionInputArgs`** mirrors
**`TripLifecycleApplyOutcome`** after ML merge. Stage E should re-derive
**`completedFacts`** / **`currentBranch`** (or an equivalent internal projection
input) from **`tripComputations`** and **`predictedTripComputations`**, so the
timeline module’s *public* entry no longer requires **`tripApplyResult`**.

Private refactor inside **`updateTimeline/`** is fine; avoid widening imports
across module boundaries (**§7** / **§11**, PRD).

### 3. Keep persistence and equality rules in functions

Domain emits full computed rows for the tick; functions compare and write.

### 4. Update the orchestrator caller

In [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts), thread
**`updateVesselTimeline`** so it only receives **`tickStartedAt`**,
**`tripComputations`**, and **`predictedTripComputations`** (plus **`ctx`** for
mutations). Drop **`tripApplyResult`** from this call path once domain no
longer needs it.

### 5. Do not pre-implement Stage F

Defer deleting **`TripLifecycleApplyOutcome`** from shared modules, deleting
legacy exports, and broad **`tickHandshake`** cleanup to **Stage F** unless a
small deletion falls out naturally from Stage E.

## Current likely files to touch

### Main Stage E files

- [`convex/domain/vesselOrchestration/updateTimeline/contracts.ts`](../../convex/domain/vesselOrchestration/updateTimeline/contracts.ts)
- [`convex/domain/vesselOrchestration/updateTimeline/orchestratorTimelineProjection.ts`](../../convex/domain/vesselOrchestration/updateTimeline/orchestratorTimelineProjection.ts)
- [`convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts`](../../convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts)
- [`convex/domain/vesselOrchestration/updateTimeline/timelineEventAssembler.ts`](../../convex/domain/vesselOrchestration/updateTimeline/timelineEventAssembler.ts)
- [`convex/domain/vesselOrchestration/updateTimeline/index.ts`](../../convex/domain/vesselOrchestration/updateTimeline/index.ts)

### Functions-layer caller

- [`convex/functions/vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)

### Tests likely involved

- [`convex/domain/vesselOrchestration/updateTimeline/tests/buildTimelineTickProjectionInput.test.ts`](../../convex/domain/vesselOrchestration/updateTimeline/tests/buildTimelineTickProjectionInput.test.ts)
- [`convex/domain/vesselOrchestration/updateTimeline/tests/processCompletedTripsTimeline.test.ts`](../../convex/domain/vesselOrchestration/updateTimeline/tests/processCompletedTripsTimeline.test.ts)
- [`convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts`](../../convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts)

Prefer new or extended tests under
**`convex/domain/vesselOrchestration/updateTimeline/tests/`** for concern-local
behavior.

## Non-goals for Stage E

Do **not** let Stage E expand into:

- **Stage F** wholesale removal of legacy bundle names, **`tickHandshake`**
  pruning, and deep import cleanup (unless a narrow deletion is unavoidable)
- redesigning **trips** or **predictions** public contracts
- moving compare-then-write into domain
- adding Convex queries inside **`updateVesselTimeline`** domain code

Stage E is about making timeline a **pure consumer** of the Stage C/D handoffs
under the frozen public contract.

## Acceptance criteria

Stage E is complete when all of the following are true:

1. **`runUpdateVesselTimeline`** is the canonical public entrypoint matching
   **`RunUpdateVesselTimelineInput` / `RunUpdateVesselTimelineOutput`** (no public
   **`TripLifecycleApplyOutcome`** parameter).
2. On the orchestrator path, timeline consumes **`tripComputations`** and
   **`predictedTripComputations`** as the PRD describes — not a parallel
   reconstruct-from-persist story.
3. Domain timeline code does **not** read Convex or take **`ActionCtx`**.
4. The functions layer still owns **dedupe** and **persistence** for timeline
   tables.
5. **`updateVesselOrchestrator`** (or equivalent) no longer passes
   **`tripApplyResult`** into **`updateVesselTimeline`** unless a documented,
   minimal exception remains — target is **none**.

## Test expectations

At minimum, preserve or extend coverage for:

- projection assembly from **`tripComputations`** + **`predictedTripComputations`**
  without relying on **`TripLifecycleApplyOutcome`** in the public path
- parity or intentional updates to dock **actual** / **predicted** payloads for
  representative ticks
- orchestrator sequencing after the **`actions.ts`** change

## Validation

After implementing Stage E, run the usual checks:

- `bun run type-check`
- `bun run convex:typecheck`
- `bun run check:fix`

Add targeted Stage E tests as needed to lock the new timeline boundary and
orchestrator wiring.
