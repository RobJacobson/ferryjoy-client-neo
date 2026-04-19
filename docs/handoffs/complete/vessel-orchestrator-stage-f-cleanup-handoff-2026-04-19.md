# Handoff: Vessel orchestrator Stage F cleanup

**Date:** 2026-04-19  
**Audience:** engineer or agent implementing Stage F of the idempotent
four-pipeline refactor  
**Status:** complete — implemented 2026-04-19

## Primary reference

Read this PRD first and treat it as the source of truth for Stage F:

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)

Pay special attention to:

- **§12** migration plan — **Stage F: cleanup** (complete)
- **§15** acceptance criteria — full refactor criteria satisfied, including Stage F
  cleanup (see **§16** revision history)

Read these as active constraints:

- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- [`/.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)

Useful context from earlier stages (what Stage F is *not* redoing):

- [`vessel-orchestrator-stage-d-predictions-handoff-2026-04-19.md`](./vessel-orchestrator-stage-d-predictions-handoff-2026-04-19.md)
- [`vessel-orchestrator-stage-e-timeline-handoff-2026-04-19.md`](./vessel-orchestrator-stage-e-timeline-handoff-2026-04-19.md)

Optional background:

- [`vessel-orchestrator-supervising-agent-review-handoff-2026-04-19.md`](./vessel-orchestrator-supervising-agent-review-handoff-2026-04-19.md)

## What Stages A through E already landed

**Stage A** froze public black-box contracts for all four pipelines.

**Stage B** established domain ownership for locations.

**Stage C** made `runUpdateVesselTrips` the canonical trip compute boundary with
`tripComputations` as the handoff to downstream stages.

**Stage D** made `runUpdateVesselPredictions` plain-data in/out: it consumes
`tripComputations` and `predictionContext`, emits `predictedTripComputations`,
and does not query Convex on the orchestrator path.

**Stage E** made `runUpdateVesselTimeline` the public timeline entrypoint driven
by prior handoffs; the orchestrator path no longer explains timeline primarily
through a parallel `tripApplyResult` / persistence-scoped lifecycle struct on
the *public* API.

Stages A–E established contracts and orchestrator sequencing; Stage F delivered
the **deleting transitional surfaces**, **narrowing exports**, and **timeline
merge collapse** described below.

## Stage F goal

Burn down **long-lived transitional mess** while keeping the four frozen public
`runUpdate...` contracts stable.

Concretely (from the PRD):

1. **Delete obsolete public transitional shapes** that no longer have call sites.
2. **Narrow entry files** so each concern exports only what downstream code should
   import (the PRD calls out barrel-dump `index.ts` re-exports as an
   anti-pattern).
3. **Remove old ports, adapters, and bundle names** that only existed to bridge
   the pre-refactor orchestrator.
4. **Timeline internals (deferred from Stage E):** refactor the internal ML /
   prediction merge so it is **not** centered on **`TripLifecycleApplyOutcome`**.
   Stage E finalized the public **`runUpdateVesselTimeline`** contract first;
   Stage F collapsed the internal bridge from lifecycle-shaped structs to
   handoff-driven structures.

Stage F is **cleanup and consolidation**, not a redesign of business rules or
public pipeline contracts.

## Implementation record (2026-04-19)

### Timeline merge

- **`TimelineProjectionAssembly`** in
  [`buildTimelineTickProjectionInput.ts`](../../convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts)
  — **`BuildTimelineTickProjectionInputArgs`** = assembly + **`tickStartedAt`**.
- **`buildTimelineProjectionAssemblyFromTripComputations`** — builds assembly from
  **`TimelineTripComputation`** rows.
- **`mergePredictedComputationsIntoTimelineProjectionAssembly`** — same ML keying
  as the pre–Stage F merge, typed on **`TimelineProjectionAssembly`**, not
  **`TripLifecycleApplyOutcome`**.
- Removed **`buildOrchestratorTimelineProjectionInput`**,
  **`mergeTripApplyWithPredictedComputationsForTimeline`**, and
  **`mergeTripApplyWithMlForTimeline`**.

### Barrels

- [`updateTimeline/index.ts`](../../convex/domain/vesselOrchestration/updateTimeline/index.ts)
  — **`runUpdateVesselTimeline`**, contracts, **`buildTimelineTickProjectionInput`**,
  assembly types, and handshake types from **`types.ts`** (no
  **`TripLifecycleApplyOutcome`** re-export). **`mergeTickEventWrites`** /
  **`buildTickEventWritesFromCompletedFacts`** are not on the barrel (use
  **`domain/vesselOrchestration/shared`** or in-folder modules).
- [`vesselOrchestration/index.ts`](../../convex/domain/vesselOrchestration/index.ts)
  — dropped **`computeVesselTripsBundle`** / **`VesselTripsComputeBundle`** from
  the root re-export (still exported from
  [`updateVesselTrips/index.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/index.ts)).
- [`updateVesselTrips/index.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/index.ts)
  — removed the old “Transitional Stage A” comment block.

### Tests

- New
  [`orchestratorTimelineProjection.parity.test.ts`](../../convex/domain/vesselOrchestration/updateTimeline/tests/orchestratorTimelineProjection.parity.test.ts)
  — empty handoffs + predictions → stable empty assembly.
- [`processCompletedTripsTimeline.test.ts`](../../convex/domain/vesselOrchestration/updateTimeline/tests/processCompletedTripsTimeline.test.ts)
  — uses **`buildTimelineTripComputationsForRun`**, then assembly + merge.

### Docs and PRD

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)
  — progress line, **§12** Stage F complete, **§15** closure, **§16** entry.
- [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md),
  [`updateTimeline/README.md`](../../convex/domain/vesselOrchestration/updateTimeline/README.md),
  [`functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md).

### Other

- [`shared/tickHandshake/types.ts`](../../convex/domain/vesselOrchestration/shared/tickHandshake/types.ts)
  — documents **`TripLifecycleApplyOutcome`** as persist/handshake, not the
  timeline merge type.

**Validation:** `bun run type-check`, `bun run convex:typecheck`, `bun run check:fix`,
and timeline + **`processVesselTrips.tick`** tests.

## Non-goals for Stage F

Do **not** use Stage F to:

- casually redesign the frozen **`RunUpdateVessel...`** types without strong
  cause and PRD alignment
- change trip, prediction, or timeline **semantics** (only structure and dead
  code paths)
- perform unrelated refactors outside vessel orchestration boundaries
- delete symbols **test-only** consumers still need — update tests first

## Acceptance criteria

These were met as of 2026-04-19:

1. **PRD §12 Stage F** checklist: obsolete transitional public shapes removed
   where appropriate, entry files narrowed, legacy bundle names trimmed from the
   root barrel where verified.
2. **Timeline internal merge** uses **`TimelineProjectionAssembly`** and
   **`mergePredictedComputationsIntoTimelineProjectionAssembly`**, not
   **`TripLifecycleApplyOutcome`** as the merge center (see **§12** / **§16** in
   the PRD).
3. **§15** full refactor criteria satisfied; deprecated timeline entry points
   removed (**`buildOrchestratorTimelineProjectionInput`**, old merge names).
4. Imports follow **§8 / §11** — intentional barrels; **`TripLifecycleApplyOutcome`**
   documented as persist/handshake only.
5. **`bun run type-check`**, **`bun run convex:typecheck`**, and **`bun run check:fix`**
   pass; timeline and orchestrator tick tests updated and passing.

## Revision history

- **2026-04-19:** Mark complete; add implementation record (timeline merge,
  barrels, tests, docs, validation).
- **2026-04-19:** Initial Stage F cleanup handoff drafted from the PRD Stage F
  section, Stage D/E handoffs, and supervising-agent review brief.
