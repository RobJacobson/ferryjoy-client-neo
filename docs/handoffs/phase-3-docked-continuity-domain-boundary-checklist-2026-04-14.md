# Phase 3 Checklist: Docked Continuity Domain Boundary Cleanup

Date prepared: 2026-04-14  
Audience: implementation agent handling Phase 3 of the functions/domain boundary
reorganization  
Status: **complete** (implementation landed alongside memo updates)  
Scope: move the remaining docked schedule continuity logic out of
`convex/functions/` and leave `vesselTrips` with a small, explicit adapter seam

## Purpose

This document turns Phase 3 of
`docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
into a concrete implementation checklist.

The goal of Phase 3 is:

- move the remaining pure continuity logic into `convex/domain/`
- separate domain decision-making from Convex query wiring and logging
- keep `convex/functions/vesselTrips/updates/` as a thin adapter layer
- preserve current docked identity and schedule continuity semantics

This phase should preserve runtime behavior. It is a boundary cleanup, not a
semantic redesign.

## Read First

Before implementing, read:

- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
- `docs/handoffs/orchestrator-oversight-handoff-2026-04-14.md`
- `convex/domain/README.md`
- `convex/functions/vesselTrips/updates/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `docs/handoffs/vessel-trip-and-timeline-redesign-spec-2026-04-12.md`
- `docs/handoffs/vessel-timeline-module-boundary-handoff-2026-04-13.md`
- `docs/handoffs/vesseltimeline-reconciliation-memo-2026-04-14.md`
- `docs/handoffs/trip-timestamp-semantics-prd-2026-04-14.md`
- `docs/convex_rules.mdc`

## Phase Goal

At the end of this phase:

- `convex/functions/eventsScheduled/dockedScheduleResolver.ts` no longer owns
  pure schedule continuity logic
- `convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts`
  is split into:
  - a thin functions-layer adapter that performs Convex queries
  - a domain-owned continuity decision path
  - optional logging/observability helpers that do not own business logic
- the default `buildTripAdapters` seam remains coherent and as small as
  possible
- deferred tests move with the domain logic where appropriate

Important boundary for this phase:

- do **not** change docked identity semantics unless a bug is discovered and
  explicitly called out
- do **not** fold orchestrator simplification into this PR
- do **not** redesign same-day timeline reconciliation beyond what is needed to
  relocate continuity ownership

## Review Outcome From Stages 1-2

Verified in the landed code:

- Stage 1 is complete:
  - `convex/domain/scheduledTrips/` exists and owns the schedule transform
    pipeline
  - `convex/functions/scheduledTrips/sync/transform/` is gone
  - `convex/functions/scheduledTrips/sync/fetchAndTransform.ts` is a thin
    adapter over `runScheduleTransformPipeline`
  - `convex/domain/timelineReseed/seedScheduledEvents.ts` imports scheduled-trip
    helpers from domain, not from functions
- Stage 2 is complete:
  - `convex/domain/vesselTrips/` owns the lifecycle pipeline, projection
    assembly, test suite, and `stripTripPredictionsForStorage`
  - `convex/functions/vesselTrips/updates/` is mostly re-exports plus the
    default dependency wiring in
    `processTick/processVesselTrips.ts`
  - the deferred continuity seam was preserved on purpose:
    `resolveEffectiveLocation.ts`,
    `dockedScheduleResolver.ts`, and
    `appendSchedule.ts` remain in the functions layer

## Current Source Map

### Primary files to reorganize in Phase 3

- `convex/functions/eventsScheduled/dockedScheduleResolver.ts`
- `convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts`

### Closely related adapter file to reevaluate

- `convex/functions/vesselTrips/updates/tripLifecycle/appendSchedule.ts`

### Current tests still anchored to the deferred seam

- `convex/functions/vesselTrips/updates/tests/resolveEffectiveLocation.test.ts`
- `convex/functions/vesselTrips/updates/tests/appendSchedule.test.ts`

### Current default wiring entrypoint that must keep working

- `convex/functions/vesselTrips/updates/processTick/processVesselTrips.ts`

### Current domain seam already in place

- `convex/domain/vesselTrips/vesselTripsBuildTripAdapters.ts`
- `convex/domain/vesselTrips/tripLifecycle/buildTrip.ts`

## Recommended Target Structure

One reasonable target shape is:

```text
convex/domain/
  vesselTrips/
    continuity/
      resolveDockedScheduledSegment.ts
      resolveEffectiveDockedLocation.ts
      types.ts
      observability.ts?    # only if logging logic stays meaningful on its own

convex/functions/
  vesselTrips/
    updates/
      tripLifecycle/
        resolveEffectiveLocation.ts   # thin query adapter / default wiring
        appendSchedule.ts             # keep only if still a real query adapter
  eventsScheduled/
    queries.ts
    schemas.ts
```

This is illustrative, not mandatory. Reuse `convex/domain/vesselTrips/` if that
keeps the public surface smaller.

## Public API Recommendation

The domain layer should expose a small surface for this phase.

Recommended exports:

- a pure continuity resolver for docked scheduled segment selection
- a domain helper that turns:
  - live location
  - optional existing trip
  - optional scheduled segment resolution
  into effective docked identity / effective location
- any narrow shared types required by the resolver path

Avoid exporting:

- Convex query callers
- logging wrappers that exist only to satisfy one adapter file
- broad continuity barrels

## Key Architectural Constraint For Phase 3

### Split query wiring from continuity decisions

`resolveEffectiveLocation.ts` currently does three jobs:

1. gates whether docked continuity lookup should run
2. performs Convex queries through `ctx.runQuery`
3. decides the effective docked identity and logs suspicious states

Phase 3 should separate these concerns so that:

- query execution stays in `convex/functions/`
- continuity selection and identity derivation live in `convex/domain/`
- logging either becomes:
  - a thin functions-layer concern, or
  - a tiny domain helper that formats facts but does not own decisions

The same rule applies to `dockedScheduleResolver.ts`: the lookup algorithm is
domain logic even when its data source is query-backed.

## Detailed Checklist

### Step 1: Create a domain continuity module

Create a small domain-owned home for the remaining docked continuity logic.

Suggested move mapping:

- `functions/eventsScheduled/dockedScheduleResolver.ts`
  -> `domain/vesselTrips/continuity/resolveDockedScheduledSegment.ts`
- the pure decision parts of
  `functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts`
  -> `domain/vesselTrips/continuity/resolveEffectiveDockedLocation.ts`

Implementation guidance:

- preserve the current lookup order exactly:
  - `completed_trip_next`
  - `rollover_schedule`
- keep `resolveEffectiveDockedTripIdentity(...)` from `shared/effectiveTripIdentity`
  as the semantic owner of final identity resolution unless there is a very
  strong reason to move that too
- avoid mixing query transport details into the new domain module

### Step 2: Introduce an explicit lookup interface at the domain boundary

Replace direct `ctx.runQuery(...)` assumptions in the continuity flow with an
explicit interface or dependency bag.

Recommended shape:

- domain function accepts async lookup callbacks for:
  - `getScheduledDepartureSegmentBySegmentKey`
  - `getNextDepartureSegmentAfterDeparture`

This keeps the continuity algorithm reusable and prevents a new
`domain -> functions` inversion.

### Step 3: Refactor `resolveEffectiveLocation.ts` into a thin adapter

After moving the pure continuity logic, reduce
`functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts`
to:

- action-context query wiring
- invocation of the new domain continuity helper
- targeted observability only

Success criterion for this step:

- the file reads primarily as an adapter, not as the owner of docked identity
  behavior

### Step 4: Decide the long-term role of `appendSchedule.ts`

Review whether `appendSchedule.ts` should:

- remain a functions-layer query adapter used by `buildTripAdapters`, or
- move closer to domain if most of its behavior is now simply schedule
  continuity enrichment

Recommendation:

- only move it if doing so makes the adapter seam smaller and clearer
- if it remains in `convex/functions/`, keep it explicitly documented as a
  narrow query-backed enrichment adapter rather than an unreviewed leftover

### Step 5: Revisit `vesselTripsBuildTripAdapters.ts`

Once continuity logic is extracted, decide whether the adapter type should:

- keep both `resolveEffectiveLocation` and `appendFinalSchedule`, or
- shrink to only true query/effect adapters

Do not make this a broad redesign. The goal is just to keep the seam honest
after Phase 3.

### Step 6: Move or update deferred tests

Re-home tests based on where the logic ends up.

Expected outcomes:

- pure continuity tests move into `convex/domain/vesselTrips/tests/` or a nearby
  continuity test folder
- thin adapter tests stay in the functions layer only if they still verify real
  wiring behavior

Minimum tests to preserve:

- `NextScheduleKey` exact-match continuity
- rollover continuity after known departure
- no-match fallback to raw live identity
- stable docked identity short-circuit
- suspicious/changed-state logging behavior only if that logging remains
  intentional and non-trivial

### Step 7: Refresh docs that would otherwise become misleading

Minimum docs to update after the move:

- `convex/domain/README.md`
- `convex/functions/vesselTrips/updates/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`

Optional if touched:

- any `eventsScheduled` README-level notes that still imply the resolver lives
  in `convex/functions/eventsScheduled/`

## Minimal Safe Implementation Sequence

Recommended order:

1. create the domain continuity module and move `dockedScheduleResolver`
2. introduce explicit lookup interfaces for continuity resolution
3. refactor `resolveEffectiveLocation.ts` into a thin adapter
4. decide whether `appendSchedule.ts` stays put or moves
5. tighten `vesselTripsBuildTripAdapters.ts` only if the seam is clearer
6. move/update deferred tests
7. refresh the minimum necessary docs

This order keeps the adapter seam working throughout and avoids mixing Stage 3
with orchestrator cleanup.

## Acceptance Criteria

Phase 3 is complete when all of the following are true:

- no pure docked continuity-resolution logic remains under `convex/functions/`
- `resolveEffectiveLocation.ts` is primarily query wiring plus optional
  observability
- domain continuity code does not import function-layer implementation modules
- default `processVesselTrips` wiring still works without orchestrator changes
- deferred continuity tests moved with the logic or were intentionally retained
  only for real adapter coverage
- docked identity behavior is unchanged unless a documented bug fix is
  explicitly included

## Validation Checklist

After implementation, run:

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
```

Then run focused suites, at minimum:

```bash
bun test ./convex/domain/vesselTrips/tests/*.test.ts
bun test ./convex/functions/vesselTrips/updates/tests/*.test.ts
bun test ./convex/functions/vesselOrchestrator/tests/*.test.ts
```

If continuity tests move fully into domain, replace the second command with the
new domain path and remove the functions-layer one.

## Risks

### Risk 1: Quiet semantic drift in docked identity resolution

Mitigation:

- preserve current lookup precedence and fallback behavior exactly
- move code first, then simplify names or structure

### Risk 2: Leaving the adapter seam more confusing than before

Mitigation:

- explicitly decide the role of `appendSchedule.ts`
- shrink `vesselTripsBuildTripAdapters.ts` only when it clearly improves the
  public boundary

### Risk 3: Pulling same-day timeline reconciliation into the same refactor

Mitigation:

- keep this phase focused on the trip write path continuity seam
- do not rework `timelineReseed` beyond import or type adjustments required by
  the move

### Risk 4: Over-testing thin wrappers while under-testing the moved logic

Mitigation:

- move behavior tests with the domain code
- keep wrapper tests only where they cover real query wiring or logging

## Out of Scope For Phase 3

Do not include these unless explicitly reopened:

- broad `VesselOrchestrator` pipeline simplification
- timestamp semantics redesign
- same-day `VesselTimeline` reconciliation redesign
- schema changes unrelated to continuity extraction
- broad test pruning beyond the deferred continuity suite
