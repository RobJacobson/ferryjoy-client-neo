# Phase 5 Checklist: Test Cleanup and Boundary Enforcement

Date prepared: 2026-04-14  
Audience: implementation agent handling Phase 5 of the functions/domain boundary
reorganization  
Status: actionable cleanup checklist  
Scope: keep high-value tests, remove or consolidate low-value wrapper tests, and
optionally add lightweight boundary-enforcement guidance now that the major
reorganizations are complete

## Purpose

This document turns Phase 5 of
`docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
into a concrete implementation checklist.

The goal of Phase 5 is:

- make the remaining test suite reflect the architecture that now exists
- keep tests that protect business rules and meaningful adapter behavior
- remove or consolidate tests that only justify wrapper placement
- optionally add light import-boundary guidance if it helps keep the new module
  boundaries intact

This phase should preserve semantics. It is cleanup and reinforcement, not a
behavioral refactor.

## Read First

Before implementing, read:

- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
- `convex/domain/README.md`
- `convex/functions/vesselTrips/updates/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `docs/convex_rules.mdc`

For context on what already moved:

- `docs/handoffs/phase-2-vesseltrips-domain-migration-checklist-2026-04-14.md`
- `docs/handoffs/phase-3-docked-continuity-domain-boundary-checklist-2026-04-14.md`
- `docs/handoffs/phase-4-vesselorchestrator-functional-pipeline-checklist-2026-04-14.md`

## Phase Goal

At the end of this phase:

- business-rule tests live next to the substantive domain logic they protect
- thin functions-layer tests remain only where they verify real adapter or
  mutation wiring behavior
- wrapper-only tests are removed or consolidated
- README-level docs and import conventions match the post-Phase-4 architecture
- optional boundary guidance exists only if it is lightweight and clearly useful

Important boundary for this phase:

- do **not** reopen major architecture moves already completed in Stages 1-4
- do **not** change trip, timeline, or orchestrator semantics
- do **not** add heavy tooling or lint complexity unless the payoff is clear

## Review Outcome From Stages 1-4

Verified in the landed code:

- Stage 1 is complete:
  - scheduled-trip transformation logic and tests moved into
    `convex/domain/scheduledTrips/`
- Stage 2 is complete:
  - vessel-trip lifecycle logic and most substantive tests moved into
    `convex/domain/vesselTrips/`
- Stage 3 is complete:
  - docked continuity logic moved into `convex/domain/vesselTrips/continuity/`
  - a minimal adapter test remains in functions for `resolveEffectiveLocation`
- Stage 4 is complete:
  - orchestrator coordination logic moved into `convex/domain/vesselOrchestration/`
  - passenger-terminal helper tests moved into domain
  - only `applyTickEventWrites.test.ts` remains under
    `convex/functions/vesselOrchestrator/tests/`

That leaves mostly cleanup work rather than another structural phase.

## Current Test Surface To Reassess

### Functions-layer tests that likely remain for a reason

- `convex/functions/eventsScheduled/tests/queries.test.ts`
- `convex/functions/vesselLocation/tests/schemas.test.ts`
- `convex/functions/vesselTrips/tests/schemas.test.ts`
- `convex/functions/vesselOrchestrator/tests/applyTickEventWrites.test.ts`

These look like query/schema/mutation wiring tests and are likely still valid.

### Functions-layer tests that should be reassessed explicitly

- `convex/functions/vesselTrips/updates/tests/appendSchedule.test.ts`
- `convex/functions/vesselTrips/updates/tests/resolveEffectiveLocation.adapter.test.ts`

These may still be worth keeping, but only if they protect real `ctx.runQuery`
adapter behavior rather than mere file placement.

### Domain tests still importing thin functions-layer helpers

Current examples worth reviewing:

- `convex/domain/vesselTrips/tests/buildTrip.test.ts`
  - imports `appendFinalSchedule`
  - imports `resolveEffectiveLocation`
- `convex/domain/vesselTrips/tests/processVesselTrips.test.ts`
  - imports `applyTickEventWrites`

These may be acceptable integration-shaped tests, but Phase 5 should decide
whether that coupling is intentional and worth keeping.

## Cleanup Questions Phase 5 Should Answer

For each remaining functions-layer test or domain test that imports a functions
wrapper, decide which of these categories it belongs to:

1. **Keep as-is**
   - the test protects real query/mutation wiring or integration behavior
2. **Move to domain**
   - the test is really protecting business logic, not the wrapper
3. **Collapse or delete**
   - the test only verifies a one-line re-export or trivial adapter no-op

Document those decisions in the PR if they are non-obvious.

## Recommended Target State

After this phase, the general shape should be:

- `convex/domain/**/tests/`
  - business rules
  - pipeline behavior
  - sequencing and decision logic
- `convex/functions/**/tests/`
  - schema validators
  - query/mutation wiring
  - true adapter behavior where Convex effects are the thing being tested

## Detailed Checklist

### Step 1: Audit remaining functions-layer tests

Review each file under `convex/functions/**/tests/` and classify it:

- schema/query/mutation wiring test
- meaningful adapter test
- trivial wrapper test

Implementation guidance:

- keep notes brief but explicit
- do not assume “functions-layer test” automatically means “bad”

### Step 2: Reassess `vesselTrips/updates` adapter tests

Review:

- `appendSchedule.test.ts`
- `resolveEffectiveLocation.adapter.test.ts`

Questions to answer:

- does the test verify real `ctx.runQuery` adapter behavior?
- is the interesting behavior already covered better in domain tests?
- would a smaller smoke test plus stronger domain tests be clearer?

Recommendation:

- keep at most a minimal adapter test where real functions-layer wiring remains
- move or collapse anything that only repeats domain logic outcomes

### Step 3: Review domain tests that still import functions helpers

Specifically inspect:

- `convex/domain/vesselTrips/tests/buildTrip.test.ts`
- `convex/domain/vesselTrips/tests/processVesselTrips.test.ts`

Decide whether to:

- keep those imports because they intentionally exercise the default-wired
  functions adapters, or
- replace them with injected fakes/mocks so the tests stay fully domain-owned

Recommendation:

- prefer domain-owned fakes where the test is about domain logic
- keep a functions helper import only when the integration-shaped coverage is
  truly valuable

### Step 4: Prune trivial wrapper tests and comments

Remove or simplify tests whose only purpose is to justify:

- one-line re-exports
- pass-through wrappers
- empty no-op behavior already covered elsewhere

Also clean up stale comments like “Stage 5” markers that no longer help future
readers once the cleanup is complete.

### Step 5: Refresh docs and test guidance

Update docs where needed so they reflect the final architecture and test
ownership.

Minimum docs to review:

- `convex/domain/README.md`
- `convex/functions/vesselTrips/updates/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`

Optional:

- add one short section to an existing engineering doc if a lightweight import
  convention would prevent future drift

### Step 6: Decide whether boundary enforcement is worth adding

This is optional, not mandatory.

Possible lightweight options:

- README-level import guidance
- a short rule in an existing docs file
- a tiny lint/import-boundary rule only if it is easy to maintain

Avoid:

- large custom tooling
- brittle rules that create maintenance overhead larger than the problem

## Minimal Safe Implementation Sequence

Recommended order:

1. audit remaining functions-layer tests
2. reassess `vesselTrips/updates` adapter tests
3. review domain tests that still import functions wrappers
4. prune or consolidate trivial wrapper tests
5. refresh docs/comments
6. add optional lightweight boundary guidance only if still justified

This order keeps cleanup evidence-driven instead of deleting tests first and
trying to justify it later.

## Acceptance Criteria

Phase 5 is complete when all of the following are true:

- remaining functions-layer tests clearly justify their existence
- business-rule tests live in domain wherever practical
- wrapper-only tests are removed or consolidated
- any remaining domain-to-functions test imports are intentional and documented
- docs reflect the final staged reorganization outcome
- optional boundary guidance, if added, is lightweight and maintainable

## Validation Checklist

After cleanup, run:

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
```

Then run at least:

```bash
bun test ./convex/domain/**/*.test.ts
bun test ./convex/functions/**/*.test.ts
```

If that is too broad for one PR, run the affected subsets and document what was
verified.

## Risks

### Risk 1: Deleting tests that still protect real adapter behavior

Mitigation:

- classify before deleting
- keep tests where the wrapper itself is part of the contract

### Risk 2: Leaving domain tests coupled to functions wrappers by accident

Mitigation:

- review every remaining domain test import from `functions/`
- decide intentionally whether it is domain logic coverage or integration
  coverage

### Risk 3: Over-engineering boundary enforcement

Mitigation:

- prefer docs/guidance first
- add tooling only if the need is clear after the audit

## Out of Scope For Phase 5

Do not include these unless explicitly reopened:

- new domain reorganizations beyond test placement and light cleanup
- trip/timeline/orchestrator behavior changes
- broad schema changes
- heavyweight repository tooling work unrelated to import boundaries
