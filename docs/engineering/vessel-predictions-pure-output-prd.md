# Vessel Predictions Pure-Output PRD

**Date:** 2026-04-19  
**Audience:** Engineers and coding agents working in `convex/domain/vesselOrchestration/updateVesselPredictions`, `convex/functions/vesselOrchestrator`, `updateVesselTrips`, and `updateVesselTimeline`

## 1. Problem statement

`updateVesselPredictions` is currently carrying too much architectural baggage.

Instead of being a small domain function that computes prediction rows for a
tick, it has grown into a confusing mix of:

- prediction logic
- trip-shaped compatibility wrappers
- persistence-aware shaping
- event-driven gating assumptions
- downstream-oriented handoff artifacts
- legacy intermediate DTOs created to preserve older orchestration flows

This makes the module difficult to understand and difficult to change. It also
preserves the wrong dependency direction: downstream persistence and historical
event-driven assumptions are shaping the prediction pipeline instead of simply
consuming its output.

The current state is not acceptable.

## 2. Goal

Refactor `updateVesselPredictions` into a small, pure pipeline whose only job
is to:

1. take the current prediction-relevant inputs for a tick
2. compute the resulting prediction table rows for that tick
3. return those rows as plain DTOs suitable for dedupe and upsert in
   `actions.ts`

The public output of `updateVesselPredictions` must be prediction-row DTOs,
not enhanced `VesselTrip` objects and not persistence result objects.

This concern should run on every tick.

It must no longer be designed around “only produce predictions when a special
event occurred” as its primary architecture.

## 3. Required ownership boundaries

### `updateVesselPredictions` owns

- prediction generation logic
- per-tick prediction-row computation
- prediction-specific policy and gates
- only the minimum helper logic required to produce prediction upsert DTOs

### `updateVesselPredictions` does not own

- trip lifecycle logic
- mutation execution
- dedupe/write suppression implementation
- direct DB writes
- trip persistence result objects
- timeline assembly
- event-table writes
- enhanced trip objects created only to serve downstream compatibility layers

Those concerns belong elsewhere:

- trip concerns belong in `updateVesselTrips`
- persistence and dedupe belong in `convex/functions`
- timeline concerns belong in `updateVesselTimeline`

## 4. Required contract

The desired public contract is conceptually:

```ts
type RunUpdateVesselPredictionsInput = {
  activeVesselTrips: ReadonlyArray<...>;
  completedVesselTrips?: ReadonlyArray<...>;
  // plus only the minimum additional prediction-specific inputs factually required
};

type RunUpdateVesselPredictionsOutput = {
  predictionRows: ReadonlyArray<...>;
};
```

The exact input type may vary depending on the minimum prediction-specific data
needed, but the output must stay prediction-row oriented and small.

The output should be suitable for:

- dedupe in `actions.ts`
- upsert into `vesselTripPredictions`
- downstream consumption by other modules that need prediction rows rather than
  trip-shaped overlays

## 5. Explicit non-goals

The prediction pipeline must not return or expose any of the following unless
they are still directly necessary as true prediction-domain concepts:

- enhanced trip objects whose main purpose is to carry joined predictions
- mutation result objects
- persistence bundles
- orchestrator-specific apply artifacts
- compatibility wrappers created only for timeline or persistence
- event-driven “only on arrival/leave” orchestration assumptions as the primary
  public model

If another module currently depends on one of these, that other module must be
rewritten to depend on prediction-row DTOs or its own locally derived data.

## 6. Design principles

### Principle 1: deletion is the default

When evaluating code in `updateVesselPredictions`, assume it should be deleted
unless it is directly necessary to compute prediction rows for the current tick.

### Principle 2: downstream concerns must adapt

Do not preserve extra outputs from `updateVesselPredictions` just because
`actions.ts`, timeline code, or older persistence code currently consume them.

Those downstream modules should be refactored to consume the correct row output
or to derive their own local intermediate data.

### Principle 3: keep the pipeline straightforward

The pipeline should read like:

1. prepare/normalize prediction inputs
2. determine which prediction work applies this tick
3. compute prediction rows
4. return the row DTOs

If the folder structure or types obscure this flow, they should be simplified.

### Principle 4: make this a tick pipeline, not an event-architecture module

The core mental model should be:

- every tick, compute the prediction rows that should exist for the current
  trip state
- let `actions.ts` dedupe and upsert them

Do not preserve an architecture whose main story is “predictions happen only
when special trip events fire.”

### Principle 5: minimize file count

This concern should not require a large tree of files. A handful of files
should be enough.

Prefer a compact module shape over an elaborate abstraction tree.

## 7. Scope guidance for the trip/prediction seam

The seam between `updateVesselTrips` and `updateVesselPredictions` should be
simple and explicit.

`updateVesselTrips` now owns authoritative trip rows.

`updateVesselPredictions` should consume those trip rows and produce prediction
row DTOs.

Do not reintroduce coupling by making `updateVesselPredictions` depend on
trip-internal artifacts, reconstructed bundle types, or mutation-oriented
handoff objects.

The rough seams in `actions.ts` should be cleaned up so the orchestration reads
like:

1. update vessel locations
2. compute trip rows
3. compute prediction rows
4. dedupe/upsert in functions
5. continue to downstream consumers as needed

## 8. Proposed implementation direction

### Step 1: lock the boundary

Change `updateVesselPredictions` so that its public output is prediction-row
DTOs only.

Remove public exposure of enhanced trip wrappers, apply results, and other
compatibility artifacts that are not the true output of this concern.

### Step 2: break invalid dependencies

Allow downstream compile errors to surface.

Do not preserve bridge outputs just to avoid refactoring other modules.

This is desirable because it reveals which modules are incorrectly depending on
prediction-internal artifacts.

### Step 3: shrink `updateVesselPredictions` aggressively

Delete or move anything in `updateVesselPredictions` that is not directly
required to produce prediction rows for a tick.

In particular, look for and remove:

- trip-shaped overlay wrappers
- persistence-oriented helpers
- timeline-oriented helpers
- event-driven compatibility scaffolding
- bridge DTOs
- compatibility wrappers

### Step 4: move persistence ownership back to functions

`actions.ts` should own:

- dedupe
- compare-then-write behavior
- mutation execution

`updateVesselPredictions` should own only the computation of what rows should
exist for this tick.

### Step 5: compress the file tree

Reduce `updateVesselPredictions` to a small, legible set of files. The final
module should feel obviously focused on one thing.

### Step 6: prune and rewrite tests

Delete tests that only protect obsolete scaffolding.

Keep a smaller set of behavior-focused tests that validate:

- the pipeline accepts trip rows for a normal tick
- predictions are computed on ordinary ticks, not only special trip events
- the returned DTO rows are appropriate for dedupe/upsert
- representative trips produce the expected prediction rows
- the public output contains only the intended row DTOs

## 9. Suggested end-state module shape

The exact filenames may vary, but the concern should trend toward something like:

- one public entrypoint
- one core pipeline file
- one or two small helpers for policy/row construction
- tests

The concern should not need a large collection of internal contract, mapping,
handoff, and bridge files.

## 10. Definition of done

This refactor is complete only when all of the following are true:

- `updateVesselPredictions` returns prediction-row DTOs only
- `updateVesselPredictions` no longer returns enhanced trip objects as its main
  public output
- `updateVesselPredictions` no longer owns direct DB writes
- `actions.ts` owns dedupe and upsert behavior for prediction rows
- the trip/prediction seam in `actions.ts` is simple and easy to follow
- prediction computation runs as a per-tick pipeline rather than being
  architecturally centered on special event occurrences
- the file tree for `updateVesselPredictions` is small and easy to follow
- obsolete bridge types and helpers have been deleted
- tests primarily validate prediction behavior rather than scaffolding

## 11. Guidance for the next implementing agent

This PRD is intentionally high-level.

The next agent should work with the user to determine the exact row shapes,
policy details, and any legitimate prediction-specific inputs that still belong
in this concern.

The important architectural direction is:

- make the concern pure
- make the output row-oriented
- make the orchestration seam simple
- let downstream code adapt

High-level advice from the `updateVesselTrips` refactor:

- If a public output exists only to help persistence, timeline, or compatibility
  code, delete it instead of preserving it.
- Prefer a top-level pipeline whose files match the business flow.
- Treat temporary downstream breakage as a useful signal, not as something to
  paper over with bridge types.
- Keep input types minimal in terms of concerns owned, not by aggressively
  pre-filtering records before the function runs.
- Avoid “just in case” compatibility layers; they tend to become permanent.
- Ask whether each surviving file or type would still be invented if this
  concern were created from scratch today.
