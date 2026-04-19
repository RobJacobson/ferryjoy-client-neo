# Handoff: Vessel orchestrator Stage B locations pipeline

**Date:** 2026-04-19  
**Audience:** engineer or agent implementing Stage B of the idempotent
four-pipeline refactor  
**Status:** actionable handoff for the next implementation pass

## Primary reference

Read this PRD first and treat it as the source of truth for Stage B:

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)

Read these as active constraints:

- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- [`/.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)

Optional background, only if needed:

- [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)

## What Stage A already landed

Stage A froze the public contracts and created a dedicated locations concern:

- [updateVesselLocations/contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselLocations/contracts.ts)
- [updateVesselLocations/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselLocations/index.ts)
- [updateVesselLocations/runUpdateVesselLocations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselLocations/runUpdateVesselLocations.ts)

Right now, `runUpdateVesselLocations` is intentionally a thin Stage A wrapper
over the existing adapter mapping helpers. That was the right compromise for
contract freeze, but Stage B is where the actual concern boundary should become
real.

## Stage B goal

Make `updateVesselLocations` a real domain concern with this ownership split:

- **functions layer**
  - fetch raw WSF vessel-location rows
  - load identity rows
  - call the domain runner
  - dedupe and persist `vesselLocations`
- **domain locations concern**
  - normalize and enrich raw WSF rows into canonical `VesselLocationRow`
  - own vessel-abbreviation enrichment
  - own terminal normalization
  - own trip identity derivation and distance calculations

Stage B is successful when the locations concern no longer relies on the
adapter layer for its business logic story, even if some low-level helpers are
still reused under the hood.

## Current state

The key mixed-concern file today is:

- [fetchWsfVesselLocations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/adapters/fetch/fetchWsfVesselLocations.ts)

It currently does both:

- external fetch from WSF
- row mapping into `ConvexVesselLocation`

That file still contains most of the logic that should ultimately belong to the
locations domain concern:

- `mapDottieVesselLocationsToConvex`
- `assertAtLeastOneVesselLocationConverted`
- `toConvexVesselLocation`
- terminal and vessel resolution
- trip identity derivation
- distance calculations

Stage B should separate those responsibilities without turning this into a
broader orchestrator rewrite.

## Desired Stage B end state

### Public domain story

The locations concern should present this clear story:

- `runUpdateVesselLocations(input) -> { vesselLocations }`

The public contract from Stage A should remain intact.

### Functions-layer story

`convex/functions/vesselOrchestrator/actions.ts` should fetch raw WSF rows, then
pass them into `runUpdateVesselLocations`.

It should no longer treat the adapter fetch as already returning final
`ConvexVesselLocation` rows.

### Adapter story

The adapters layer should own external transport only.

Preferred target:

- raw WSF fetch stays in adapters
- domain mapping moves into `updateVesselLocations`

If you need a transitional helper split, the cleanest decomposition is:

- `fetchRawWsfVesselLocations`
- domain mapping in `runUpdateVesselLocations` or a same-concern helper

## Likely files to touch

### Main Stage B files

- [convex/domain/vesselOrchestration/updateVesselLocations/runUpdateVesselLocations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselLocations/runUpdateVesselLocations.ts)
- [convex/domain/vesselOrchestration/updateVesselLocations/contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselLocations/contracts.ts)
- [convex/domain/vesselOrchestration/updateVesselLocations/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselLocations/index.ts)
- [convex/adapters/fetch/fetchWsfVesselLocations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/adapters/fetch/fetchWsfVesselLocations.ts)
- [convex/adapters/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/adapters/index.ts)
- [convex/functions/vesselOrchestrator/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/actions.ts)

### Other likely callers

Check these too, since they currently use the adapter-level fetch:

- [convex/functions/vesselLocationsHistoric/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocationsHistoric/actions.ts)

If Stage B changes the fetch surface, update these callers coherently in the
same pass.

## Recommended implementation approach

### 1. Keep the public contract stable

Do not change the Stage A public `runUpdateVesselLocations` contract.

That means:

- same input shape
- same output shape
- same public import path

### 2. Move mapping logic under the domain concern

Preferred shape:

- keep a small fetch function in adapters that returns raw WSF rows
- move row conversion logic under `updateVesselLocations`

This logic can be split into same-concern helpers if helpful, for example:

- `normalizeWsfVesselLocationRow`
- `mapWsfVesselLocations`
- `assertUsableVesselLocationBatch`

All of those should stay internal to the concern unless there is a clear
production caller outside the concern that truly needs them.

### 3. Preserve behavior before polishing

It is okay for Stage B to reuse existing low-level helpers during the move.

For example, if `toConvexVesselLocation` is temporarily imported into the new
concern and then later inlined or relocated, that is acceptable. The important
thing is that the **public ownership story** shifts to the domain concern.

### 4. Update functions callers to consume raw rows

After the split:

- adapters should return raw rows
- functions callers should pass those raw rows into `runUpdateVesselLocations`

This is likely the most visible caller change in Stage B.

## Non-goals for Stage B

Do **not** let this stage expand into:

- a trips refactor
- a predictions refactor
- a timeline refactor
- a full historic-ingestion redesign
- a broad adapter cleanup unrelated to vessel locations

Stage B is about making the locations concern real, not about finishing the
entire orchestrator architecture.

## Acceptance criteria

Stage B is complete when all of the following are true:

1. `runUpdateVesselLocations` remains the canonical public entrypoint.
2. The locations concern owns the normalization and enrichment story.
3. The adapters layer owns external fetch only, or is clearly transitioning to
that state in the same coherent pass.
4. `convex/functions/vesselOrchestrator/actions.ts` fetches raw location rows
and passes them into the domain locations concern.
5. Functions code still owns persistence and dedupe.
6. No new deep-import consumers are introduced across module boundaries.

## Validation

After implementing Stage B, run the usual checks for touched files:

- `bun run type-check`
- `bun run convex:typecheck`
- `bun run check:fix`

The existing `ios/Pods` broken symlink warnings from Biome are known and not
specific to this work.

## Risks and pitfalls

1. Leaving the adapter as the real owner of the mapping logic.
   - That would preserve the old architecture under a new wrapper.
2. Moving too much code at once.
   - Prefer a coherent concern split over a sweeping cleanup.
3. Forgetting secondary callers such as historic ingestion.
   - Search for `fetchWsfVesselLocations` and update affected callers together.
4. Widening the public surface unnecessarily.
   - Keep helper exports private unless a production caller truly needs them.

## Practical recommendation

If you need a simple decision rule for Stage B, use this:

- external transport belongs in adapters
- business normalization belongs in `updateVesselLocations`

That is the architectural move this stage should accomplish.

## Follow-on stages

After Stage B, the next stages are:

- Stage C: trips
- Stage D: predictions
- Stage E: timeline
- Stage F: cleanup

See the PRD for details:

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)

## Revision history

- **2026-04-19:** Initial Stage B handoff created after Stage A contract freeze
  landed. Focused on turning `updateVesselLocations` into a real domain concern
  without expanding scope into the other pipelines.
