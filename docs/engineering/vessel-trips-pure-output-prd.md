# Vessel Trips Pure-Output PRD

**Date:** 2026-04-19  
**Audience:** Engineers and coding agents working in `convex/domain/vesselOrchestration/updateVesselTrips`, `convex/functions/vesselOrchestrator`, `updateVesselPredictions`, and `updateVesselTimeline`

## 1. Problem statement

`updateVesselTrips` is currently doing too much.

Instead of being a small domain function that computes trip rows, it has grown
into a confusing mix of:

- trip lifecycle logic
- schedule-oriented scaffolding
- persistence-oriented artifacts
- timeline-oriented handoff structures
- legacy intermediate DTOs

This makes the module difficult to understand and difficult to change. It also
creates the wrong dependency direction: downstream concerns are shaping the trip
pipeline instead of consuming its output.

The current state is not acceptable.

## 2. Goal

Refactor `updateVesselTrips` into a small, pure pipeline whose only job is to:

1. take the current vessel-trip inputs for a tick
2. determine the resulting completed trips
3. determine the resulting active trips
4. return those two arrays

The public output of `updateVesselTrips` must be only:

- `completedTrips`
- `activeTrips`

Nothing else should be returned from this concern.

## 3. Required ownership boundaries

### `updateVesselTrips` owns

- trip lifecycle logic
- the computation of updated active vessel trips
- the computation of newly completed vessel trips
- only the minimum helper logic required to produce those arrays

### `updateVesselTrips` does not own

- prediction generation
- prediction policies
- prediction gates
- timeline assembly
- timeline handoff DTOs
- persistence result objects
- persistence-specific write bundles
- intermediate compatibility artifacts created only for other modules

Those concerns belong elsewhere:

- prediction concerns belong in `updateVesselPredictions`
- timeline concerns belong in `updateVesselTimeline`
- persistence concerns belong in `convex/functions`

## 4. Required contract

The desired public contract is conceptually:

```ts
type RunUpdateVesselTripsInput = {
  existingActiveTrips: ReadonlyArray<...>;
  realtimeInputs: ReadonlyArray<...>;
  // plus only the minimum additional inputs factually required
};

type RunUpdateVesselTripsOutput = {
  completedTrips: ReadonlyArray<...>;
  activeTrips: ReadonlyArray<...>;
};
```

The exact input type may vary depending on the minimum data needed, but the
output must stay this small.

## 5. Explicit non-goals

The trip pipeline must not return or expose any of the following:

- `tripCompute`
- `tripsCompute`
- `tripApplyResult`
- `tripComputations`
- `TripComputation`
- `VesselTripsComputeBundle`
- current-branch or completed-branch message bundles
- fact objects that exist only for timeline or persistence
- prediction-related outputs of any kind

If another module currently depends on one of these, that other module must be
rewritten to depend on the trip arrays or its own locally derived data.

## 6. Design principles

### Principle 1: deletion is the default

When evaluating code in `updateVesselTrips`, assume it should be deleted unless
it is directly necessary to compute:

- completed vessel trips
- active vessel trips

### Principle 2: downstream concerns must adapt

Do not preserve extra outputs from `updateVesselTrips` just because persistence,
predictions, or timeline currently consume them.

Those downstream modules should be refactored to consume the correct trip output
or to derive their own local intermediate data.

### Principle 3: keep the pipeline straightforward

The pipeline should read like:

1. prepare/normalize inputs
2. determine per-vessel lifecycle outcome
3. build completed trip rows where needed
4. build active trip rows where needed
5. return the two arrays

If the folder structure or types obscure this flow, they should be simplified.

### Principle 4: minimize file count

This concern should not require a large tree of files. A handful of files should
be enough.

Prefer a compact module shape over an elaborate abstraction tree.

## 7. Scope guidance for schedules

`updateVesselTrips` should not become a schedule-architecture module.

If some schedule data is truly necessary to build the correct trip rows, keep
only the smallest possible dependency surface:

- a compact schedule input
- a small lookup helper
- no schedule-specific ceremony beyond what is required to build the output rows

Schedule usage is allowed only when it is directly necessary to compute the trip
arrays correctly.

## 8. Proposed implementation plan

### Step 1: lock the boundary

Change `updateVesselTrips` so that its public output type is only:

- `completedTrips`
- `activeTrips`

Remove any public exposure of compute bundles, apply results, or reconstructed
trip computation artifacts.

### Step 2: break invalid dependencies

Allow downstream compile errors to surface. Do not preserve bridge outputs just
to avoid refactoring other modules.

This is desirable because it reveals which modules are incorrectly depending on
trip-internal artifacts.

### Step 3: shrink `updateVesselTrips` aggressively

Delete or move anything in `updateVesselTrips` that is not directly required to
produce the trip arrays.

In particular, look for and remove:

- bridge DTOs
- mapping layers
- persistence-oriented helpers
- timeline-oriented helpers
- prediction-aware helpers
- compatibility wrappers

### Step 4: relocate downstream concerns

Refactor downstream modules to own their own logic:

- `updateVesselPredictions` should consume `activeTrips` and `completedTrips`,
  plus whatever additional prediction-specific data it actually needs
- `updateVesselTimeline` should consume trip rows and prediction outputs, or
  derive its own local projection inputs
- `convex/functions` should own persistence-specific shaping and mutation
  behavior

### Step 5: compress the file tree

Reduce `updateVesselTrips` to a small, legible set of files. The final module
should feel obviously focused on one thing.

### Step 6: prune and rewrite tests

Delete tests that only protect obsolete scaffolding.

Keep a smaller set of behavior-focused tests that validate:

- continuing trips remain active correctly
- changed continuing trips are updated correctly
- completed trips move from active to completed correctly
- replacement active trips are created correctly where applicable
- the public output arrays are correct for representative ticks

## 9. Suggested end-state module shape

The exact filenames may vary, but the concern should trend toward something like:

- one public entrypoint
- one core pipeline file
- one or two small helpers for trip construction or lifecycle classification
- tests

The concern should not need a large collection of internal contract, mapping,
handoff, and bridge files.

## 10. Definition of done

This refactor is complete only when all of the following are true:

- `updateVesselTrips` returns only `completedTrips` and `activeTrips`
- `actions.ts` does not expose trip-internal bundle artifacts as part of the
  trip step output
- `updateVesselTrips` no longer contains prediction-specific logic
- `updateVesselTrips` no longer contains timeline-specific logic
- `updateVesselTrips` no longer contains persistence-specific logic
- the file tree for `updateVesselTrips` is small and easy to follow
- obsolete bridge types and helpers have been deleted
- tests primarily validate trip behavior rather than scaffolding

## 11. Review checklist for the implementing agent

Before considering the work done, verify:

- If I were creating `updateVesselTrips` today from scratch, would I invent each
  remaining file and type?
- Does every surviving file directly help compute completed or active trip rows?
- Have downstream modules been updated instead of forcing the trip concern to
  carry their baggage?
- Does the public contract match the intended end state exactly?

If the answer to any of these is no, continue simplifying.
