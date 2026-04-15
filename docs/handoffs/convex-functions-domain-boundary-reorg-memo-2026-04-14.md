# Engineering Memo: Convex Functions and Domain Boundary Reorganization

Date prepared: 2026-04-14  
Audience: future backend engineer(s) reorganizing `convex/functions` and
`convex/domain`  
Status: proposed reorganization plan  
Scope: backend code organization for vessel lifecycle, timeline, scheduled-trip
sync, and orchestrator flow

## Purpose

This memo documents the architectural concerns with the current backend
organization and proposes a phased reorganization plan.

The primary goal is to make the backend easier to reason about by enforcing a
clear boundary:

- `convex/functions/` is the Convex-facing data-access and entrypoint layer
- `convex/domain/` is the business-logic and workflow layer

This memo is intentionally organizational, not semantic. It does **not**
propose major changes to trip identity, timeline event semantics, or scheduled
event semantics. Those semantics are already covered elsewhere and should be
preserved unless a later phase explicitly changes them.

## Executive Summary

The current backend contains too much substantive business logic under
`convex/functions/`, especially in:

- `convex/functions/vesselTrips/updates/`
- `convex/functions/scheduledTrips/sync/transform/`
- `convex/functions/eventsScheduled/dockedScheduleResolver.ts`

By contrast, the newer `convex/domain/timelineBackbone`,
`convex/domain/timelineRows`, and `convex/domain/timelineReseed` split is
moving in the right direction and should be treated as the model for future
cleanup.

The desired end state is:

- thin Convex wrappers in `convex/functions/`
- functional pipeline modules in `convex/domain/`
- one-way dependencies from `functions` to `domain`
- schema-derived table row types remaining in `convex/functions/*/schemas.ts`
- no domain imports from function-layer implementation modules
- fewer, more valuable tests concentrated around real business logic rather than
  thin wrappers

## Read First

Any implementation agent should read these documents before making changes:

- `README.md`
- `docs/convex_rules.mdc`
- `convex/domain/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `convex/functions/vesselTrips/updates/README.md`
- `docs/handoffs/vessel-trip-and-timeline-redesign-spec-2026-04-12.md`
- `docs/handoffs/vessel-timeline-module-boundary-handoff-2026-04-13.md`
- `docs/handoffs/vesseltimeline-reconciliation-memo-2026-04-14.md`
- `src/features/VesselTimeline/docs/ARCHITECTURE.md`

These documents provide the key context for:

- trip identity semantics
- timeline event semantics
- same-day reseed and reconciliation behavior
- orchestrator flow and tick ordering
- current domain module boundaries already accepted for `VesselTimeline`

## Problem Statement

The main architectural problem is not primarily type design. It is poor
separation of concerns.

Today, `convex/functions/` acts as both:

1. the Convex registration and persistence layer
2. the home for significant domain and orchestration logic

That makes the codebase harder to understand because the directory structure no
longer communicates responsibility clearly.

Symptoms:

- folders under `convex/functions/` often contain much more than
  `actions.ts`/`queries.ts`/`mutations.ts`/`schemas.ts`
- function-layer modules contain lifecycle logic, classification logic,
  normalization logic, projection logic, and workflow sequencing
- some domain modules import back into `convex/functions/`, which reverses the
  intended dependency direction
- tests in `convex/functions/` are often validating real domain logic that
  should live elsewhere

The result is a backend that works, but whose organization obscures the true
architecture.

## Desired Architectural Rule

The desired rule is simple:

- if code primarily registers a Convex function, reads tables, writes tables, or
  defines table schemas, it belongs in `convex/functions/`
- if code primarily decides, classifies, transforms, normalizes, reconciles, or
  orchestrates, it belongs in `convex/domain/`

This rule is intentionally functional in spirit. The backend should read as a
set of small pipelines and composition steps, not as a collection of
table-centric folders that gradually accumulate unrelated business rules.

## Functional Bias

This reorganization should favor a functional pipeline style.

Desired characteristics:

- small, composable functions
- explicit inputs and outputs
- one public entrypoint per domain workflow when practical
- no hidden coupling through broad barrels
- minimal framework-specific code inside business logic
- data loading and persistence separated from derivation and decision-making

In particular, `VesselOrchestrator` should increasingly read like a simple
pipeline:

1. fetch raw inputs
2. convert and normalize inputs
3. load current persisted state
4. run domain workflows
5. persist results
6. return operational status

The orchestrator will still be effectful, but the substantive work should be
delegated to domain-level pipeline functions.

## What Is Already Working Well

The recent timeline reorganization is a good example to follow.

Current good state:

- `convex/domain/timelineBackbone/` owns read-time backbone assembly
- `convex/domain/timelineRows/` owns shared row builders and projection helpers
- `convex/domain/timelineReseed/` owns same-day reseed logic
- `convex/functions/vesselTimeline/backbone/getVesselTimelineBackbone.ts` is a
  thin wrapper that loads rows and calls domain logic

This split should be preserved and extended, not undone.

## Main Concerns By Area

### 1. `scheduledTrips`

Problem:

- `convex/functions/scheduledTrips/sync/transform/` contains classification and
  estimation logic that is domain logic, not persistence logic
- timeline reseed currently depends on some of that logic indirectly by importing
  from the functions layer

Why it matters:

- direct/indirect classification is a business rule
- trip estimate calculation is a business rule
- official crossing-time lookup behavior is a business rule
- these rules should be reusable without implying anything about Convex
  registration or table ownership

Conclusion:

- move scheduled-trip transformation logic into `convex/domain/`
- keep only schedule fetch/persist wrappers in `convex/functions/scheduledTrips/`

### 2. `vesselTrips`

Problem:

- `convex/functions/vesselTrips/updates/` is explicitly the canonical lifecycle
  pipeline, but it lives in the functions layer
- it currently owns event detection, physical debounce logic, effective docked
  identity resolution, schedule enrichment, prediction enrichment, branch
  sequencing, and projection assembly coordination

Why it matters:

- this is the clearest example of business logic living in the wrong layer
- the folder structure suggests persistence wrappers, but the contents implement
  a rich state machine
- the existing tests under this folder are often validating real domain logic

Conclusion:

- most of `vesselTrips/updates/` should move into a dedicated domain module
- `convex/functions/vesselTrips/` should become a much thinner Convex adapter
  surface around queries, mutations, schemas, and narrow entrypoints

### 3. `eventsScheduled/dockedScheduleResolver.ts`

Problem:

- `dockedScheduleResolver.ts` is pure schedule-backed continuity logic with
  injected lookup functions, but it lives under `convex/functions/`

Why it matters:

- it is exactly the kind of functional domain helper that should not be in the
  functions layer

Conclusion:

- move it into a domain module and keep only the Convex query adapters in the
  functions layer

### 4. `vesselOrchestrator`

Problem:

- the orchestrator README already describes a clean pipeline, but the actual
  implementation still depends on function-layer modules that carry too much
  business logic below them

Nuance:

- actions are allowed to be effectful
- actions are allowed to kick off workflow code
- that does **not** mean actions should own the workflow logic itself

Conclusion:

- preserve `convex/functions/vesselOrchestrator/actions.ts` as an entrypoint
- keep small persistence/application helpers like `applyTickEventWrites.ts`
  only if they remain thin
- move substantive tick workflow composition into the domain layer

### 5. Tests

Problem:

- there are many tests under `convex/functions/`
- some are only there because real domain logic lives under the functions layer

Conclusion:

- do not mass-delete tests up front
- first move domain logic into `convex/domain/`
- then keep tests that protect business rules
- delete tests that only verify trivial wrappers, barrels, or one-line adapter
  behavior

## Non-Goals

This memo does **not** propose:

- changing the core `TripKey` / `ScheduleKey` redesign
- collapsing timeline read models back into trip tables
- removing same-day reseed
- moving schema-derived table row types out of `convex/functions/*/schemas.ts`
- introducing a large new shared DTO framework
- rewriting everything in one pass

The preferred approach is staged reorganization with minimal semantic drift.

## Type and Schema Guidance

Schema-derived table row types should remain in `convex/functions/*/schemas.ts`.
That is compatible with the desired architecture.

The actual rule should be:

- `convex/domain/` may import schema-derived row types when those are the right
  input/output contracts
- `convex/domain/` should **not** import function-layer implementation modules
  that exist only because business logic is currently misplaced

Good:

- domain imports `type ConvexScheduledTrip` from
  `functions/scheduledTrips/schemas`

Bad:

- domain imports `functions/scheduledTrips/sync/transform/directSegments`

This keeps the schema source of truth where it already lives, while still
enforcing a one-way architectural dependency.

## Desired End State

At the end of this work, the backend should look roughly like this:

```text
convex/
  functions/
    scheduledTrips/
      actions.ts
      queries.ts
      mutations.ts
      schemas.ts
    vesselTrips/
      actions.ts            # if still needed
      queries.ts
      mutations.ts
      schemas.ts
    vesselTimeline/
      actions.ts
      queries.ts
      mutations.ts
      schemas.ts
    vesselOrchestrator/
      actions.ts
      queries.ts
      applyTickEventWrites.ts   # only if still thin enough

  domain/
    scheduledTrips/
      index.ts
      classifyDirectSegments.ts
      calculateTripEstimates.ts
      officialCrossingTimes.ts
      runScheduleTransformPipeline.ts
      tests/
    vesselTrips/
      index.ts
      processVesselTick.ts
      detectTripEvents.ts
      resolveEffectiveDockedIdentity.ts
      buildTrip.ts
      buildCompletedTrip.ts
      processCompletedTrips.ts
      processCurrentTrips.ts
      projection/
      tests/
    vesselOrchestration/
      index.ts
      runVesselOrchestratorTick.ts
      tests/
    timelineBackbone/
    timelineRows/
    timelineReseed/
```

This is an illustrative shape, not a mandatory exact file layout.

## Architectural Constraints

The following constraints should hold after the reorganization:

1. `functions -> domain` imports are allowed; `domain -> functions`
   implementation imports are not.
2. Actions, queries, and mutations should stay thin and framework-specific.
3. Domain modules should expose small public APIs.
4. Avoid broad barrels that flatten unrelated helpers.
5. Tests should live next to substantive logic.
6. Moving code should not silently change trip/timeline semantics.
7. The current timeline domain split should remain intact unless a later memo
   deliberately changes it.

## High-Level Implementation Plan

This work should be executed in phases. Each phase should leave the codebase in a
valid, releasable state.

### Phase 0: Baseline and Guardrails

Goal:

- establish clear rules and inventory before moving logic

Tasks:

- document the desired layer rule in a handoff or README-level location
- inventory function-layer modules that are actually domain logic
- identify public entrypoints that other code currently imports
- identify tests that clearly protect business rules vs tests that only protect
  thin wrappers

Expected outputs:

- confirmed source map for current-to-target moves
- agreed list of stable entrypoints that cannot break mid-migration
- updated notes for implementation agents if new discoveries arise

Suggested focus files:

- `convex/functions/vesselTrips/updates/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `convex/domain/README.md`
- `docs/handoffs/vessel-timeline-module-boundary-handoff-2026-04-13.md`

### Phase 1: Move Scheduled-Trip Domain Logic

Goal:

- separate schedule transformation logic from the schedule persistence layer

Tasks:

- move direct/indirect classification logic from
  `convex/functions/scheduledTrips/sync/transform/`
  into `convex/domain/scheduledTrips/`
- move estimate calculation and official crossing-time helpers into the same
  domain area
- keep `fetchAndTransformScheduledTrips` thin by making it call the new domain
  pipeline
- update any timeline reseed imports so they no longer reach into the functions
  layer for schedule transformation logic

Likely current source files:

- `convex/functions/scheduledTrips/sync/transform/directSegments.ts`
- `convex/functions/scheduledTrips/sync/transform/estimates.ts`
- `convex/functions/scheduledTrips/sync/transform/officialCrossingTimes.ts`
- `convex/functions/scheduledTrips/sync/transform/pipeline.ts`
- `convex/functions/scheduledTrips/sync/fetchAndTransform.ts`
- `convex/domain/timelineReseed/seedScheduledEvents.ts`

Success criteria:

- no schedule transformation logic remains under
  `convex/functions/scheduledTrips/sync/transform/`
- timeline reseed no longer imports schedule transform code from
  `convex/functions/`
- all existing semantics and tests remain green

### Phase 2: Move Vessel-Trip Lifecycle Logic

Goal:

- move the vessel lifecycle state machine into the domain layer

Tasks:

- move pure lifecycle logic from `convex/functions/vesselTrips/updates/` into a
  new `convex/domain/vesselTrips/` module
- move event detection, debounce, derivation, builders, and branch processors
  into the domain layer
- move projection assembly logic that is really workflow/domain logic as well
- keep only narrow Convex-facing entrypoints in `convex/functions/vesselTrips/`

Likely current source areas:

- `convex/functions/vesselTrips/updates/processTick/`
- `convex/functions/vesselTrips/updates/tripLifecycle/`
- `convex/functions/vesselTrips/updates/projection/`

Recommended public domain entrypoint:

- one top-level function for one vessel tick, returning a clear result envelope
  that the functions layer can persist and project

Success criteria:

- most of `convex/functions/vesselTrips/updates/` either disappears or becomes a
  tiny adapter surface
- business-rule tests move with the logic into `convex/domain/vesselTrips/tests/`
- function-layer code reads primarily as data loading, persistence, and Convex
  registration

### Phase 3: Normalize Docked Identity and Schedule Continuity Boundaries

Goal:

- remove the obvious remaining pure-domain logic from the functions layer

Tasks:

- move `convex/functions/eventsScheduled/dockedScheduleResolver.ts` into a
  domain module
- reevaluate `resolveEffectiveLocation` and split it into:
  - Convex query adapters
  - domain continuity resolution logic
- keep lookup wiring in the functions layer, but keep the actual decision-making
  in the domain layer

Success criteria:

- no pure continuity-resolution logic remains under `convex/functions/`
- schedule-backed docked identity normalization has a clean domain boundary

### Phase 4: Simplify VesselOrchestrator as a Functional Pipeline

Goal:

- make the top-level tick flow easier to read and reason about

Tasks:

- extract a domain-level orchestrator pipeline function that takes:
  - raw or normalized vessel inputs
  - current persisted state snapshots
  - injected persistence/effect adapters as needed
- keep `actions.ts` focused on:
  - fetching
  - loading snapshots
  - invoking the domain pipeline
  - persisting results
  - returning operational status
- decide whether `applyTickEventWrites.ts` remains as a tiny persistence helper
  or is inlined if that is simpler

Important note:

- this phase should preserve the current tick ordering invariant:
  lifecycle persistence first, timeline projection second

Success criteria:

- orchestrator flow is readable as an explicit pipeline
- most tick decision logic is no longer hidden in function-layer subtrees
- `vesselOrchestrator` remains operationally identical

### Phase 5: Test Cleanup and Boundary Enforcement

Goal:

- keep high-value tests and remove low-value wrapper tests

Tasks:

- move tests that protect real domain rules into the new domain folders
- remove or consolidate tests that only verify trivial wrappers
- ensure README-level docs and import conventions reflect the new boundaries
- optionally add light lint/import-boundary guidance if the team wants stronger
  enforcement

Tests likely worth keeping:

- event detection
- debounce logic
- trip builders
- completed/current branch processing
- schedule classification
- timeline row and backbone assembly
- reseed reconciliation behavior

Tests likely worth deleting or collapsing:

- one-line helper tests for thin wrappers
- tiny adapter-only tests with no meaningful business rules
- tests whose only purpose was to justify helper exports

Success criteria:

- the test suite better reflects architecture
- the remaining tests protect logic, not file placement

## Recommended Move Order

The recommended move order is:

1. scheduled-trip transformation logic
2. docked schedule continuity logic
3. vessel-trip lifecycle logic
4. orchestrator simplification
5. test cleanup and documentation sweep

Why this order:

- it fixes the clearest `domain -> functions` dependency inversion early
- it reduces shared import ambiguity before moving the larger vessel-trip module
- it keeps the heaviest semantic area, `vesselTrips`, for a later, better-scoped
  migration

## Guidance for Future Agents

Implementation agents should follow these rules:

- preserve runtime semantics unless a phase explicitly says otherwise
- preserve existing tick ordering and persistence invariants
- prefer moving code before rewriting code
- avoid broad new barrels
- keep public entrypoints small and explicit
- do not introduce a DTO framework unless a concrete need emerges
- keep schema-derived row types in `convex/functions/*/schemas.ts`
- update imports to follow the new one-way dependency rule

When in doubt, prefer:

- small pure functions
- local types near domain workflows
- narrowly scoped adapters in the functions layer

## Risks and Mitigations

### Risk 1: Semantic drift during moves

Mitigation:

- move code in small slices
- preserve existing tests before deleting any
- compare pre/post public behavior for trip lifecycle and timeline reads

### Risk 2: Public import churn

Mitigation:

- keep stable wrapper entrypoints during transitions
- change internal imports first
- remove compatibility shims only after downstream call sites are updated

### Risk 3: Over-abstraction

Mitigation:

- do not introduce unnecessary generic layers
- keep the reorganization concrete and pipeline-oriented
- prefer direct functional modules over elaborate architectural scaffolding

### Risk 4: Deleting valuable tests too early

Mitigation:

- only prune tests after the logic has moved
- keep tests that encode real business rules

## Definition of Success

This reorganization is successful when:

- a new engineer can infer responsibility from the directory structure
- `convex/functions/` mostly contains schemas, queries, mutations, actions, and
  narrow persistence/application adapters
- `convex/domain/` contains the substantive trip, schedule, and orchestration
  logic
- the import graph is easier to reason about
- tests mostly live with the domain logic they protect
- the orchestrator reads like a functional backend pipeline instead of a layered
  accumulation of table-adjacent code

## Closing Recommendation

This cleanup is worth doing.

The codebase already contains one successful example of the desired direction:
the `timelineBackbone` / `timelineRows` / `timelineReseed` split. The next step
is to apply the same discipline to `scheduledTrips`, `vesselTrips`, and the
orchestrator path.

The best approach is not a full rewrite. It is a staged relocation of misplaced
business logic into `convex/domain/`, while keeping Convex wrappers in
`convex/functions/` intentionally small.
