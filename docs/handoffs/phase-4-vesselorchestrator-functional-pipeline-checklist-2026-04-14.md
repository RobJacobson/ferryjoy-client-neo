# Phase 4 Checklist: VesselOrchestrator Functional Pipeline

Date prepared: 2026-04-14  
Audience: implementation agent handling Phase 4 of the functions/domain boundary
reorganization  
Status: actionable migration checklist  
Scope: move substantive tick orchestration out of
`convex/functions/vesselOrchestrator/` and into a small domain pipeline while
preserving current runtime behavior

**Landed layout (2026-04-14):** `runVesselOrchestratorTick` lives under
`convex/domain/vesselOrchestration/`. Timeline writes are applied by
`applyTickEventWrites`, **defined in** `convex/functions/vesselOrchestrator/actions.ts`
(there is no sibling `applyTickEventWrites.ts`). Orchestrator workflow tests live in
`convex/domain/vesselOrchestration/tests/`; there is no
`convex/functions/vesselOrchestrator/tests/` directory.

## Purpose

This document turns Phase 4 of
`docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
into a concrete implementation checklist.

The goal of Phase 4 is:

- make the orchestrator read like a simple pipeline instead of a large
  function-layer action
- move tick coordination and branch sequencing decisions into `convex/domain/`
- keep fetch, Convex reads/writes, and function registration in
  `convex/functions/`
- preserve tick ordering, branch isolation, and operational behavior

This phase should preserve semantics. It is an architectural cleanup, not a
product behavior change.

## Read First

Before implementing, read:

- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
- `docs/handoffs/convex-domain-boundary-reorg-quality-review-2026-04-14.md`
- `convex/domain/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `convex/functions/vesselTrips/updates/README.md`
- `docs/handoffs/vessel-trip-and-timeline-redesign-spec-2026-04-12.md`
- `docs/handoffs/vesseltimeline-reconciliation-memo-2026-04-14.md`
- `docs/convex_rules.mdc`

## Phase Goal

At the end of this phase:

- `convex/functions/vesselOrchestrator/actions.ts` is primarily:
  - function registration
  - external WSF fetch
  - identity/bootstrap read loading
  - normalized location conversion
  - invocation of a domain pipeline
  - returning the final action result
- the domain layer owns the substantive per-tick coordination flow:
  - passenger-terminal trip gating
  - branch fanout
  - branch-level error isolation and result aggregation
  - lifecycle-before-timeline ordering within the trip branch
- `applyTickEventWrites` remains a thin functions-layer helper (currently defined
  in `actions.ts`), unless splitting it back out is obviously simpler

Important boundary for this phase:

- do **not** change the orchestrator’s branch-level success contract
- do **not** change the rule that lifecycle persistence precedes timeline
  projection
- do **not** redesign vessel-trip or timeline semantics
- do **not** fold broad test pruning into this phase

## Review Outcome From Stages 1-3

Verified in the landed code:

- Stage 1 is complete:
  - scheduled-trip transformation moved into `convex/domain/scheduledTrips/`
- Stage 2 is complete:
  - vessel-trip lifecycle and projection logic moved into
    `convex/domain/vesselTrips/`
- Stage 3 is complete:
  - docked continuity moved into `convex/domain/vesselTrips/continuity/`
  - `resolveEffectiveLocation.ts` and `appendSchedule.ts` now act as thin
    query-backed adapters

That leaves `vesselOrchestrator` as the clearest remaining place where
function-layer code still owns substantive workflow composition.

## Current Source Map

### Primary source area for Phase 4

- `convex/functions/vesselOrchestrator/actions.ts`

### Supporting files that should stay thin or be reevaluated carefully

- `convex/functions/vesselOrchestrator/actions.ts` (includes `applyTickEventWrites`)
- `convex/functions/vesselOrchestrator/queries.ts`

### Current tests tied to the orchestrator pipeline

- `convex/domain/vesselOrchestration/tests/runVesselOrchestratorTick.test.ts`
- `convex/domain/vesselOrchestration/tests/passengerTerminalEligibility.test.ts`

### Existing downstream stable entrypoints

- `convex/functions/vesselTrips/updates/processTick/processVesselTrips.ts`
- `convex/functions/vesselTrips/updates/index.ts`

## What The Current Action Still Owns

Today `updateVesselOrchestrator` in `actions.ts` still owns all of these:

- loading the bundled read model with bootstrap refresh for empty identity
  tables
- converting raw WSF payloads into `ConvexVesselLocation`
- collecting passenger-terminal allow-lists
- filtering trip-eligible locations
- capturing the tick timestamp
- coordinating the two branches:
  - vessel location persistence
  - trip lifecycle processing plus timeline writes
- branch-level error isolation and final success aggregation

Those are the responsibilities this phase should separate into:

- functions-layer effects and adapters
- domain-layer tick orchestration

## Recommended Target Structure

One reasonable target shape is:

```text
convex/domain/
  vesselOrchestration/
    runVesselOrchestratorTick.ts
    types.ts
    passengerTerminalEligibility.ts
    tests/
      runVesselOrchestratorTick.test.ts
      passengerTerminalEligibility.test.ts

convex/functions/
  vesselOrchestrator/
    actions.ts              # updateVesselOrchestrator + applyTickEventWrites
    queries.ts
```

This is illustrative, not mandatory. If a slightly different layout produces a
smaller public surface, prefer that.

## Public API Recommendation

The new domain module should expose a very small surface.

Recommended exports:

- `runVesselOrchestratorTick`
- one result type for the action response envelope
- one input/dependency type for the injected effect adapters
- passenger-terminal eligibility helpers only if they remain meaningful outside
  the main pipeline

Avoid exporting:

- Convex query implementations
- WSF fetchers
- broad barrels of unrelated helpers

## Key Architectural Constraint For Phase 4

### Keep effects injected and keep orchestration pure-ish

The domain orchestrator pipeline should not call:

- `ctx.runQuery(...)`
- `ctx.runMutation(...)`
- `fetchWsfVesselLocations(...)`
- `syncBackendVesselTable(...)`
- `syncBackendTerminalTable(...)`

directly.

Instead:

- `actions.ts` should keep external fetch and bootstrap/read-model loading
- the domain pipeline should accept:
  - normalized locations
  - storage-native active trips
  - passenger-terminal allow-list or terminals snapshot
  - tick timestamp
  - injected effect adapters for:
    - location persistence
    - trip processing
    - timeline write application

This keeps the domain pipeline testable and prevents a new
`domain -> functions` inversion.

## Detailed Checklist

### Step 1: Create a domain orchestrator module

Create a small domain-owned home for the tick pipeline.

Suggested initial file:

- `convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts`

Implementation guidance:

- move orchestration first, rename later
- preserve the current response envelope exactly:
  - `locationsSuccess`
  - `tripsSuccess`
  - optional `errors.fetch`
  - optional `errors.locations`
  - optional `errors.trips`

### Step 2: Extract passenger-terminal gating into domain

Move the pure helpers from `actions.ts` into the new domain area:

- `getPassengerTerminalAbbrevs`
- `isPassengerTerminalAbbrev`
- `isTripEligibleLocation`

These are business-rule gates, not Convex registration concerns.

Keep semantics exactly as today:

- membership is simple set membership
- trip eligibility requires a passenger departing terminal and either:
  - passenger arriving terminal, or
  - no arriving terminal

### Step 3: Extract the tick coordination pipeline

Move the workflow that currently happens after fetch/conversion into the domain
module.

That domain flow should own:

- trip-eligible location filtering
- branch fanout
- per-branch error isolation
- the trip branch sequence:
  - `processVesselTrips`
  - then `applyTickEventWrites`

Success criterion for this step:

- the domain pipeline reads like explicit data flow rather than action-local
  control flow

### Step 4: Keep `actions.ts` focused on effectful outer concerns

After the extraction, `actions.ts` should primarily:

- fetch raw WSF vessel locations
- load the orchestrator read model and bootstrap identity tables if needed
- convert raw locations into `ConvexVesselLocation`
- capture the tick timestamp
- call the domain pipeline with injected adapters
- return the result

Recommendation:

- keep `loadOrchestratorTickReadModelOrThrow(...)` in the functions layer unless
  it becomes an obviously better fit as a thin helper beside `queries.ts`
- do not move WSF fetch or Convex bootstrap logic into domain

### Step 5: Reevaluate `applyTickEventWrites` placement

Decide whether `applyTickEventWrites` should:

- remain colocated with `actions.ts` (current), or
- be split into a sibling module if that improves readability

Recommendation:

- keep it as a small exported helper beside the action if it stays narrow
- do not move mutation calls into domain

### Step 6: Add domain-level orchestration tests

Move real workflow tests closer to the new domain pipeline.

Tests worth adding or moving:

- branch isolation when location persistence fails
- branch isolation when trip processing fails
- trip branch ordering:
  - `processVesselTrips`
  - then `applyTickEventWrites`
- passenger-terminal filtering before trip processing
- success aggregation into the public result envelope

Keep functions-layer tests only for:

- thin action wrappers if they still verify real fetch/bootstrap wiring
- rare cases where a Convex adapter’s effect wiring is the contract under test

### Step 7: Refresh docs made misleading by the extraction

Minimum docs to update after the move:

- `convex/domain/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`

Optional if touched:

- `convex/functions/vesselTrips/updates/README.md`
- `convex/domain/ml/readme-ml.md`

## Minimal Safe Implementation Sequence

Recommended order:

1. create `convex/domain/vesselOrchestration/`
2. move passenger-terminal eligibility helpers
3. extract the main tick coordination pipeline with injected adapters
4. trim `actions.ts` down to fetch/load/convert/invoke/return
5. decide whether `applyTickEventWrites` stays in `actions.ts` or is split out
6. move/add orchestration tests
7. refresh the minimum necessary docs

This order keeps the current action working while the domain pipeline grows
behind it.

## Acceptance Criteria

Phase 4 is complete when all of the following are true:

- `actions.ts` is mostly Convex/action wiring plus fetch/load/convert
- a domain pipeline owns the per-tick orchestration logic
- domain orchestrator code does not import function-layer implementation modules
- lifecycle persistence still precedes timeline projection in the trip branch
- branch-level success/error behavior is unchanged
- orchestrator tests protect workflow behavior in domain rather than only helper
  placement

## Validation Checklist

After implementation, run:

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
```

Then run focused suites, at minimum:

```bash
bun test ./convex/domain/vesselOrchestration/tests/*.test.ts
bun test ./convex/domain/vesselTrips/tests/processVesselTrips.test.ts
```

## Risks

### Risk 1: Accidentally changing tick ordering

Mitigation:

- preserve the current sequence exactly:
  - location branch independent
  - trip branch runs `processVesselTrips`
  - then `applyTickEventWrites`

### Risk 2: Smuggling effects into the domain orchestrator

Mitigation:

- keep `ctx.runQuery`, `ctx.runMutation`, fetches, and bootstrap syncs in
  functions
- use injected adapters for effectful steps

### Risk 3: Losing branch-level error isolation

Mitigation:

- preserve the current `Promise.allSettled(...)` style isolation semantics
- test partial-failure envelopes explicitly

### Risk 4: Leaving too much logic behind in `actions.ts`

Mitigation:

- move the coordination logic, not just helper functions
- treat passenger-terminal gating and result aggregation as part of the domain
  pipeline, not as permanent action glue

## Out of Scope For Phase 4

Do not include these unless explicitly reopened:

- changing vessel-trip or timeline semantics
- redesigning the bundled orchestrator read model in `queries.ts`
- moving external WSF fetch logic into domain
- broad test pruning across unrelated modules
- boundary-enforcement linting or repo-wide import rules
