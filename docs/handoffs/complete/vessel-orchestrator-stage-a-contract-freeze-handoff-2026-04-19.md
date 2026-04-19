# Handoff: Vessel orchestrator Stage A contract freeze

**Date:** 2026-04-19  
**Audience:** engineer or agent implementing Stage A of the idempotent
four-pipeline refactor  
**Status:** actionable handoff for the next implementation pass

## Primary reference

Read this PRD first and treat it as the source of truth for Stage A:

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)

Read these only as supporting constraints:

- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- [`/.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)

Optional background, only if needed:

- [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)
- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)

## Stage A goal

Freeze the **public contracts** for the four orchestrator pipelines so later
agents can work in parallel without inventing their own interfaces.

The four target pipelines are:

- `runUpdateVesselLocations`
- `runUpdateVesselTrips`
- `runUpdateVesselPredictions`
- `runUpdateVesselTimeline`

Stage A is about **public interfaces and module boundaries**, not about
cleaning up the internal implementations.

## Why this stage matters

Current code still exposes legacy public shapes such as:

- `computeVesselTripsWithClock`
- `VesselTripsComputeBundle`
- `VesselTripPredictionModelAccess`
- timeline/prediction helper exports that reflect old internal decomposition

Those shapes are not the intended end-state API for this refactor. If Stage A
does not establish the canonical interfaces first, later agents will make local
choices that drift apart.

## Required outcome

At the end of Stage A, the repo should have one obvious, documented, public
contract for each pipeline, even if the internals still use messy legacy code
behind the scenes.

The expected target contracts are defined in the PRD. Stage A should implement
their **public type surfaces** and **entrypoint exports**.

## Important constraint

Backwards compatibility is **not** required during this refactor, but each
checkpoint should still be coherent and compilable.

For Stage A, prefer this rule:

- establish the canonical public contracts now
- preserve legacy exports only when necessary to keep the repo coherent during
the transition
- if legacy exports remain temporarily, mark them as transitional in comments
and do not add new consumers of them

Do **not** let temporary compatibility become a reason to avoid freezing the new
API.

## What Stage A should deliver

### 1. Canonical type contracts for all four pipelines

Create or expose the canonical input and output types described in the PRD for:

- `runUpdateVesselLocations`
- `runUpdateVesselTrips`
- `runUpdateVesselPredictions`
- `runUpdateVesselTimeline`

These contracts should be plain data only:

- no `ActionCtx`
- no `Deps`
- no adapter ports
- no function-valued fields

### 2. Canonical public entrypoints

Each pipeline folder should expose one public runner with the target name,
either as a real implementation or as a thin wrapper over legacy internals.

The preferred exported names are:

- `runUpdateVesselLocations`
- `runUpdateVesselTrips`
- `runUpdateVesselPredictions`
- `runUpdateVesselTimeline`

### 3. Clear ownership of handoff types

The Stage A agent should lock down type ownership so later agents know where to
import from.

Recommended ownership:

- `updateVesselTrips` owns `TripComputation`
- `updateVesselPredictions` owns `PredictedTripComputation`
- downstream stages import these through the owning folder's public entry file

Avoid creating a giant cross-pipeline barrel just to share these types.

### 4. Entry files aligned with module-boundary policy

Make the relevant `index.ts` files reflect the intended public surface.

Outside callers should be able to import only from the folder entry file, not
deep internal paths.

### 5. Minimal doc sync

Update any module comments or README notes that would mislead other agents about
the current public API, but keep this lightweight. The PRD is now the canonical
design document.

## Recommended file targets

These are the most likely files to touch.

### Existing public entry files

- [convex/domain/vesselOrchestration/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/index.ts)
- [convex/domain/vesselOrchestration/updateVesselTrips/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/index.ts)
- [convex/domain/vesselOrchestration/updateVesselPredictions/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/index.ts)
- [convex/domain/vesselOrchestration/updateTimeline/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateTimeline/index.ts)

### Likely new concern folder

There is currently no dedicated `updateVesselLocations` domain folder under
`convex/domain/vesselOrchestration/`. Stage A should strongly consider creating
one, even if it initially contains only contracts and a thin wrapper.

Suggested path:

- `convex/domain/vesselOrchestration/updateVesselLocations/`

### Current functions-layer caller

- [convex/functions/vesselOrchestrator/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/actions.ts)

This file does not need its full refactor in Stage A, but the agent should
understand how current public exports are consumed before narrowing or
introducing new ones.

## Recommended implementation approach

### Option A: strict contract freeze with temporary wrappers

This is the recommended approach.

1. Add canonical public types and runner exports now.
2. Implement those runners as thin wrappers over existing logic where needed.
3. Keep internals ugly if necessary.
4. Mark legacy exports as transitional if they must remain temporarily.

This gives downstream agents stable targets without forcing a deep rewrite in
Stage A.

### Option B: type-only freeze without runner exports

This is weaker and should only be used if Option A becomes unexpectedly
disruptive.

1. Add canonical public types.
2. Defer canonical runner exports to the owning pipeline stages.

Use this only if a clean wrapper cannot be introduced without disproportionate
breakage. If this fallback is used, document it clearly in code comments.

## Specific guidance by pipeline

### `updateVesselLocations`

Current state:

- No dedicated domain concern folder is visible today.
- WSF fetch plus normalization currently lives in
  [fetchWsfVesselLocations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/adapters/fetch/fetchWsfVesselLocations.ts).

Stage A goal:

- create a public contract for `runUpdateVesselLocations`
- if practical, create the new domain folder and export surface now

Do not fully migrate normalization logic yet unless it is easy.

### `updateVesselTrips`

Current state:

- public API is still centered around `computeVesselTripsWithClock`,
  `computeVesselTripsBundle`, and related legacy types
- the public entry file is wider than the target architecture

Stage A goal:

- introduce the canonical public input/output types
- introduce or reserve the `runUpdateVesselTrips` export
- do not let `VesselTripsComputeBundle` remain the only public contract

### `updateVesselPredictions`

Current state:

- public API still exposes prediction helpers that reflect old internal seams
- current contract is tied to `VesselTripsComputeBundle`
- current implementation uses query-backed prediction access

Stage A goal:

- define the canonical public contract that consumes `tripComputations`
- define the plain-data `predictionContext` input type at the public boundary,
even if implementation still uses legacy access internally for now

### `updateVesselTimeline`

Current state:

- public API still reflects legacy handshake types and orchestration helpers

Stage A goal:

- define the canonical timeline input/output contract
- preserve any necessary transitional types internally, but do not let them be
the only public story

## Non-goals for Stage A

Do **not** spend Stage A on these unless they are trivial side effects of the
contract freeze:

- rewriting trip lifecycle internals
- moving prediction lookup to a large preloaded blob
- fully relocating WSF normalization out of the adapter
- changing database persistence semantics
- cleaning up every legacy type or helper immediately
- fully narrowing every root barrel if doing so would force cross-pipeline
implementation work now

Stage A is successful if the contracts are frozen, even if some implementation
code remains messy.

## Acceptance criteria

Stage A is complete when all of the following are true:

1. Each of the four pipelines has one canonical public input type.
2. Each of the four pipelines has one canonical public output type.
3. Canonical public contracts do not expose `ActionCtx`, `Deps`, or database
ports.
4. There is one obvious public import path per pipeline folder.
5. Later agents can implement Stage B through Stage E against these interfaces
without inventing new public shapes.
6. Any legacy exports that remain are clearly transitional and are not expanded.

## Suggested validation

If Stage A changes code rather than docs only, run the usual repo checks that
are appropriate for the touched files:

- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`

If the Stage A agent chooses a narrower scope and only lands contracts plus
comments, still ensure the repo stays type-safe.

## Risks and pitfalls

1. Freezing types without freezing ownership.
   - Avoid this by explicitly deciding which pipeline owns which handoff types.
2. Preserving too much legacy surface "for now."
   - If a legacy export remains, comment it as transitional.
3. Creating a giant shared contracts barrel.
   - Prefer concern ownership and peer entry imports.
4. Turning Stage A into a stealth implementation of Stage C or D.
   - Resist cleanup temptation. Freeze contracts first.

## Practical recommendation

If forced to choose between:

- a beautiful internal implementation
- a stable public contract with ugly wrappers

choose the stable public contract.

That is the whole point of Stage A.

## Follow-on stages

After Stage A, later agents should take these stages in order:

- Stage B: locations
- Stage C: trips
- Stage D: predictions
- Stage E: timeline
- Stage F: cleanup

Those stages are defined in the PRD:

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)

## Revision history

- **2026-04-19:** Initial Stage A handoff created after the canonical PRD was
  added. Designed to let multiple agents work in parallel with a shared public
  interface target.
