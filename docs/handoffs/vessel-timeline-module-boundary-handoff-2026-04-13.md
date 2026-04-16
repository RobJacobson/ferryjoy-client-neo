# PRD: VesselTimeline Module Boundary Reorganization

Date: 2026-04-13  
Updated: 2026-04-14  
Audience: implementation agent performing `vesselTimeline` module reorganization  
Status: proposed reorganization plan

## Purpose

This document replaces the earlier cleanup-oriented handoff with a more explicit
reorganization plan.

The goal is to reshape the current `convex/domain/vesselTimeline` area into a
small set of contained pipeline-oriented modules with clear ownership and very
small public APIs.

The main principles are:

- separate concerns by concrete pipeline, not by broad topic grouping
- give each pipeline module one clear entrypoint
- avoid broad barrels that flatten unrelated internals
- avoid exporting helper functions only to satisfy tests
- follow least privilege for imports and module visibility

## Problem Statement

The current `convex/domain/vesselTimeline` folder is too broad to function as a
contained module.

Today it mixes at least three different responsibilities:

1. same-day reseed/rebuild orchestration
2. read-time backbone assembly
3. shared row normalization / projection helpers

That leads to several problems:

- callers import a broad top-level domain barrel instead of a specific pipeline
- helper functions become de facto public API
- tests reflect file layout and helper exports more than true runtime boundaries
- ownership of some functions is unclear because “timeline” is too broad a topic

The current top-level barrel in
[convex/domain/vesselTimeline/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/index.ts)
is the clearest symptom: it re-exports many unrelated functions that belong to
different workflows.

## Design Goal

Reorganize the current `vesselTimeline` domain into **three** modules, each
defined by one concrete job:

1. `timelineBackbone`
2. `timelineReseed`
3. `timelineRows`

Why three instead of two:

- splitting read-side backbone and write-side reseed is necessary
- but that still leaves a third shared concern: row normalization / projection
  helpers used by multiple runtime pipelines

If that shared concern is forced into `reseed`, then `reseed` becomes an
overloaded dumping ground and its internals leak right back out.

## Proposed Target Structure

```text
convex/domain/
  timelineBackbone/
    index.ts
    buildTimelineBackbone.ts
    mergeTimelineRows.ts
    types.ts
    tests/
      buildTimelineBackbone.test.ts

  timelineReseed/
    index.ts
    buildReseedTimelineSlice.ts
    seedScheduledEvents.ts
    hydrateWithHistory.ts
    reconcileLiveLocations.ts
    types.ts
    tests/
      buildReseedTimelineSlice.test.ts

  timelineRows/
    index.ts
    buildScheduledRows.ts
    buildActualRows.ts
    buildPredictedProjectionEffects.ts
    bindActualRowsToTrips.ts
    types.ts
    tests/
      buildActualRows.test.ts
```

## Module Responsibilities

### 1. `timelineBackbone`

This module owns read-time assembly only.

It should own:

- merge of scheduled/actual/predicted rows
- ordering logic
- final query-facing backbone shape

It should **not** own:

- same-day reseed orchestration
- live reconciliation against `vesselLocations`
- shared row normalization used outside the read path

Likely source mapping:

- current `convex/domain/vesselTimeline/timelineEvents.ts`
- current `convex/domain/vesselTimeline/viewModel.ts`

### 2. `timelineReseed`

This module owns the same-day rebuild / reseed workflow.

It should own:

- schedule event seeding
- history hydration
- live-location reconciliation
- final assembly of the replacement slice written by mutation code

It should **not** own:

- query-time backbone assembly
- shared row normalization used by unrelated pipelines

Likely source mapping:

- current `convex/domain/vesselTimeline/events/seed.ts`
- current `convex/domain/vesselTimeline/events/history.ts`
- current `convex/domain/vesselTimeline/events/reconcile.ts`
- the live-reconciliation parts of `convex/domain/vesselTimeline/events/liveUpdates.ts`

### 3. `timelineRows`

This module owns shared normalized row builders and projection helpers.

It exists because some current helpers are not purely “reseed”:

- they are used by reseed
- they are also used by `eventsActual` mutation code
- they are also used by trip projection code

It should own:

- scheduled row builders
- actual row builders
- actual-row-from-patch normalization
- predicted projection effect builders
- trip-context binding from `ScheduleKey` / `SegmentKey` to `TripKey`

Likely source mapping:

- parts of current `convex/domain/vesselTimeline/normalizedEvents.ts`
- current `convex/domain/vesselTimeline/tripContextForActualRows.ts`

## Public API Rules

### Allowed public entrypoints

`convex/domain/timelineBackbone/index.ts`

- exports exactly one function:
  - `buildTimelineBackbone(...)`

`convex/domain/timelineReseed/index.ts`

- exports exactly one function:
  - `buildReseedTimelineSlice(...)`

`convex/domain/timelineRows/index.ts`

- exports a small focused set of shared normalization/projection helpers

Important exception:

- unlike `timelineBackbone` and `timelineReseed`, `timelineRows` is intentionally
  a shared utility boundary, so it may export a few focused helpers
- do not force `timelineRows` into a single giant facade if that only hides
  coherent shared responsibilities behind an awkward API

### Forbidden public patterns

Do not keep or recreate:

- a broad `convex/domain/vesselTimeline/index.ts` barrel
- `events/index.ts` style flattening barrels
- helper exports added only to satisfy tests

## Import Direction Rules

The import graph should be one-way:

```text
timelineBackbone -> timelineRows
timelineReseed   -> timelineRows

functions/vesselTimeline/backbone/* -> timelineBackbone
functions/vesselTimeline/mutations.ts -> timelineReseed + timelineRows
functions/events/eventsActual/mutations.ts -> timelineRows
functions/vesselTrips/updates/projection/* -> timelineRows
```

Forbidden:

- `timelineRows -> timelineReseed`
- `timelineRows -> timelineBackbone`
- `timelineBackbone -> timelineReseed`
- function-layer imports from deep private files in another module

## Current-to-Target Mapping

### Read-side

- `convex/domain/vesselTimeline/timelineEvents.ts`
  -> `convex/domain/timelineBackbone/mergeTimelineRows.ts`

- `convex/domain/vesselTimeline/viewModel.ts`
  -> `convex/domain/timelineBackbone/buildTimelineBackbone.ts`

### Reseed-side

- `convex/domain/vesselTimeline/events/seed.ts`
  -> `convex/domain/timelineReseed/seedScheduledEvents.ts`

- `convex/domain/vesselTimeline/events/history.ts`
  -> `convex/domain/timelineReseed/hydrateWithHistory.ts`

- `convex/domain/vesselTimeline/events/reconcile.ts`
  -> `convex/domain/timelineReseed/reconcileLiveLocations.ts`

### Shared row/projection helpers

- `convex/domain/vesselTimeline/normalizedEvents.ts`
  -> split across:
  - `convex/domain/timelineRows/buildScheduledRows.ts`
  - `convex/domain/timelineRows/buildActualRows.ts`
  - `convex/domain/timelineRows/buildPredictedProjectionEffects.ts`

- `convex/domain/vesselTimeline/tripContextForActualRows.ts`
  -> `convex/domain/timelineRows/bindActualRowsToTrips.ts`

## Runtime Call Sites Expected to Change

### `functions/vesselTimeline`

- [convex/functions/vesselTimeline/backbone/getVesselTimelineBackbone.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/backbone/getVesselTimelineBackbone.ts)
  should import only `buildTimelineBackbone`

- [convex/functions/vesselTimeline/mutations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/mutations.ts)
  should import:
  - `buildReseedTimelineSlice(...)`
  - any necessary shared row helper from `timelineRows` only if the mutation
    still owns persistence-specific merge/replace behavior

### `functions/events/eventsActual`

- [convex/functions/events/eventsActual/mutations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/events/eventsActual/mutations.ts)
  should import only row normalization helpers from `timelineRows`

### `functions/vesselTrips`

- [convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts)
  should import predicted projection effect builders from `timelineRows`, not
  from a broad timeline-domain barrel

## Staged Execution Plan

This reorganization should happen in stages so each layer remains reviewable.

## Stage 1: Extract Read-Side Backbone Module

Goal:

- create the cleanest boundary first
- isolate query-time logic from reseed/write concerns

### Tasks

1. Create:
   - `convex/domain/timelineBackbone/index.ts`
   - `convex/domain/timelineBackbone/buildTimelineBackbone.ts`
   - `convex/domain/timelineBackbone/mergeTimelineRows.ts`
2. Move logic from:
   - `timelineEvents.ts`
   - `viewModel.ts`
3. Update:
   - `convex/functions/vesselTimeline/backbone/getVesselTimelineBackbone.ts`
4. Add or move tests so the module is verified through its primary export.

### Acceptance criteria

- backbone query path no longer imports `domain/vesselTimeline`
- read-side logic has one clear entrypoint
- tests for backbone continue to pass

## Stage 2: Extract Shared Row / Projection Helpers

Goal:

- remove the mixed-responsibility `normalizedEvents.ts`
- establish a reusable shared boundary before reseed is extracted

### Tasks

1. Create:
   - `convex/domain/timelineRows/index.ts`
   - `buildScheduledRows.ts`
   - `buildActualRows.ts`
   - `buildPredictedProjectionEffects.ts`
   - `bindActualRowsToTrips.ts`
2. Move the current row-builder and projection-effect functions out of
   `normalizedEvents.ts`
3. Update imports in:
   - `convex/functions/events/eventsActual/mutations.ts`
   - `convex/functions/vesselTimeline/mutations.ts`
   - `convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts`
4. Remove the old mixed file once all consumers are updated.

### Acceptance criteria

- `normalizedEvents.ts` no longer mixes read, reseed, and projection concerns
- trip projection and `eventsActual` mutation code import only the focused shared module
- no broad domain barrel is needed for row helpers

## Stage 3: Extract Reseed Pipeline Module

Goal:

- make the same-day rebuild flow a single contained pipeline

### Tasks

1. Create:
   - `convex/domain/timelineReseed/index.ts`
   - `buildReseedTimelineSlice.ts`
   - `seedScheduledEvents.ts`
   - `hydrateWithHistory.ts`
   - `reconcileLiveLocations.ts`
2. Move reseed-specific orchestration into this module.
3. Update:
   - `convex/functions/vesselTimeline/actions.ts`
   - `convex/functions/vesselTimeline/mutations.ts`
4. Ensure the mutation layer remains responsible only for:
   - loading data from Convex
   - calling the reseed pipeline
   - applying table replacement semantics

### Acceptance criteria

- reseed/write-side logic has one clear entrypoint
- function-layer mutation code no longer assembles the whole pipeline inline
- reseed tests pass through the module entrypoint

## Stage 4: Remove Legacy Barrels and Finalize Boundaries

Goal:

- remove the old flattened API shape
- enforce least-privilege imports

### Tasks

1. Delete:
   - `convex/domain/vesselTimeline/index.ts`
   - `convex/domain/vesselTimeline/events/index.ts`
2. Update remaining imports away from `domain/vesselTimeline`
3. Move or rewrite old tests under the new module homes
4. Verify no exports exist only for test convenience

### Acceptance criteria

- no remaining production import uses the old broad timeline-domain barrel
- each new module has a small intentional API
- tests align with the new module boundaries

## Testing Guidance

The guiding rule should be:

- test the public module entrypoints by default
- allow internal tests only when they do not widen runtime visibility

### Recommended test shape

- `convex/domain/timelineBackbone/tests/*.test.ts`
  should primarily exercise `buildTimelineBackbone(...)`

- `convex/domain/timelineReseed/tests/*.test.ts`
  should primarily exercise `buildReseedTimelineSlice(...)`

- `convex/domain/timelineRows/tests/*.test.ts`
  may test focused shared builders directly because `timelineRows` is an
  intentional shared utility boundary

### Important clarification

Do not contort the API just to satisfy a “single export per folder” slogan if
that would make coherent shared row helpers harder to reason about. The real
goal is least privilege and clear ownership, not ceremony.

## Open Design Decisions

These should be resolved during implementation, not deferred indefinitely.

### 1. What remains in `functions/vesselTimeline/mutations.ts`?

Recommended:

- keep Convex I/O and replace semantics in the mutation file
- move pure assembly logic into `timelineReseed`

### 2. Does `liveUpdates.ts` split cleanly?

Likely yes, but the current file contains both:

- live reconciliation logic
- generic event list helpers

Split by actual responsibility, not by preserving file boundaries.

### 3. Should `timelineRows` export one function or several?

Recommended:

- several small focused exports are acceptable here
- this is the one place where “one export only” would probably make the API worse

## Verification Expectations

At minimum after the reorganization:

```bash
bun test convex/domain/timelineBackbone
bun test convex/domain/timelineReseed
bun test convex/domain/timelineRows
bun test convex/functions/vesselTimeline
bun test convex/functions/events/eventsActual
bun test convex/functions/vesselTrips/updates/projection
bun run type-check
bun run convex:typecheck
```

## Bottom Line

Do not continue cleaning up `convex/domain/vesselTimeline` with barrels alone.

Instead:

1. extract `timelineBackbone`
2. extract `timelineRows`
3. extract `timelineReseed`
4. delete the broad old barrels

This produces module boundaries that match the actual runtime pipelines and
should make future review, refactoring, and debugging significantly easier.
