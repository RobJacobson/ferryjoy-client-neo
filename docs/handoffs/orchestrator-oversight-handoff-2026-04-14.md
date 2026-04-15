# Handoff: Oversight for Stages 1-3

Date prepared: 2026-04-14  
Audience: new orchestrator / oversight agent  
Status: active handoff  
Scope: review completed Stage 1 and Stage 2 code against the reorganization PRD
and stage checklists, update the PRD, and create the Stage 3 checklist

## What You Are Taking Over

You are taking over architectural oversight for the Convex backend
reorganization project.

Your immediate job is **not** to implement more code. Your job is to:

1. review the completed code for **Stage 1** and **Stage 2**
2. compare the landed code against the main PRD and the Stage 1 / Stage 2
   checklists
3. update the main PRD to reflect what is actually complete and what remains
4. create a concrete checklist for **Stage 3**

Treat this as an independent review. Do not assume prior status summaries are
perfect; verify the code directly.

## Primary Source of Truth

Read these first:

- `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
- `docs/handoffs/phase-1-scheduled-trips-domain-migration-checklist-2026-04-14.md`
- `docs/handoffs/phase-2-vesseltrips-domain-migration-checklist-2026-04-14.md`
- `convex/domain/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `convex/functions/vesselTrips/updates/README.md`
- `docs/handoffs/vessel-trip-and-timeline-redesign-spec-2026-04-12.md`
- `docs/handoffs/vessel-timeline-module-boundary-handoff-2026-04-13.md`
- `docs/handoffs/vesseltimeline-reconciliation-memo-2026-04-14.md`

Also inspect the landed code directly in:

- `convex/domain/scheduledTrips/`
- `convex/domain/vesselTrips/`
- `convex/functions/scheduledTrips/`
- `convex/functions/vesselTrips/`
- `convex/functions/vesselOrchestrator/`
- `convex/functions/eventsScheduled/dockedScheduleResolver.ts`
- `convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts`

## Intended Architecture

The governing architectural rule is:

- `convex/functions/` should contain Convex-facing entrypoints, queries,
  mutations, actions, schemas, and thin adapters
- `convex/domain/` should contain business logic, functional pipelines,
  normalization, classification, projection assembly, and orchestration logic

The project has been progressing by stages:

- **Stage 1**: move scheduled-trip transformation logic into
  `convex/domain/scheduledTrips/`
- **Stage 2**: move vessel-trip lifecycle and projection logic into
  `convex/domain/vesselTrips/`, using adapters for the function-layer behaviors
  explicitly deferred to Stage 3
- **Stage 3**: clean up the remaining docked continuity boundary
  (`resolveEffectiveLocation`, `dockedScheduleResolver`, and related query
  wiring)

## Current Status To Verify

The latest PRD currently states:

- Stage 1 is complete
- Stage 2 is complete
- Stage 3 is next

You should verify that this is actually true from the codebase, not just from
the documents.

### What Stage 1 was supposed to accomplish

Per the Stage 1 checklist, verify that:

- schedule transformation logic is now under `convex/domain/scheduledTrips/`
- `convex/functions/scheduledTrips/sync/transform/` is gone
- `convex/functions/scheduledTrips/sync/fetchAndTransform.ts` is a thin adapter
- `convex/domain/timelineReseed/seedScheduledEvents.ts` no longer imports
  scheduled-trip transform logic from `convex/functions/`

### What Stage 2 was supposed to accomplish

Per the Stage 2 checklist, verify that:

- the vessel-trip lifecycle pipeline is now primarily in
  `convex/domain/vesselTrips/`
- the `vesselTrips/updates` function-layer files are now shims or thin
  compatibility wrappers where appropriate
- `TickEventWrites` shape and merge semantics were preserved
- `stripTripPredictionsForStorage` was moved to a domain-owned home and
  mutations updated accordingly
- the orchestrator still works through stable imports
- the code did **not** prematurely absorb Stage 3 work

### What should still remain for Stage 3

Stage 3 should still own the continuity boundary cleanup around:

- `convex/functions/eventsScheduled/dockedScheduleResolver.ts`
- `convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts`
- the remaining function-layer query wiring and continuity heuristics for docked
  identity resolution

If these were already fully absorbed into domain, note that explicitly.
Otherwise, preserve them as Stage 3 work.

## Things Already Observed

These are not authoritative conclusions, only starting hypotheses you should
verify:

- `convex/domain/scheduledTrips/` exists and appears to own the Stage 1
  transformation logic
- `convex/domain/vesselTrips/` exists and appears to own most Stage 2 lifecycle
  and projection code
- `convex/domain/vesselTrips/vesselTripsBuildTripAdapters.ts` appears to be the
  key adapter seam introduced in Stage 2
- `convex/functions/eventsScheduled/dockedScheduleResolver.ts` and
  `convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts`
  still exist and look like likely Stage 3 targets
- there is likely documentation drift remaining in
  `convex/domain/ml/readme-ml.md` referencing pre-move file paths

Again: verify these directly.

## Your Required Deliverables

Produce all three of these:

1. **Review outcome**
   State whether Stage 1 and Stage 2 are actually complete, or identify any
   incomplete carryover items that should be pushed into Stage 3.

2. **Updated PRD**
   Update:
   `docs/handoffs/convex-functions-domain-boundary-reorg-memo-2026-04-14.md`
   so it accurately reflects:
   - completed stages
   - remaining work
   - any newly discovered carryover or caveats

3. **Stage 3 checklist**
   Create a new concrete checklist document for the next implementation agent.
   It should be at the same level of specificity as the Stage 1 and Stage 2
   checklists.

## What the Stage 3 Checklist Should Likely Cover

Do not assume this list is final, but Stage 3 likely needs to address:

- moving or re-homing `dockedScheduleResolver.ts`
- reevaluating `resolveEffectiveLocation.ts`
- separating:
  - pure continuity / docked identity logic
  - query adapter wiring
  - logging / observability
- deciding the right home for any continuity-related types
- making sure no domain code imports back into function-layer implementation
  modules
- keeping the Phase 2 adapter seam coherent or simplifying it if Stage 3 makes
  that possible

It may also be the right time to decide whether:

- the adapter type currently in `convex/domain/vesselTrips/vesselTripsBuildTripAdapters.ts`
  should shrink, move, or disappear after continuity extraction

## Working Style Expectations

- verify against code, not only docs
- keep semantics unchanged unless a stage explicitly calls for behavior changes
- prefer small public surfaces in domain modules
- do not let compatibility shims quietly become permanent architecture without
  noting that in the PRD
- note any stale documentation that became misleading due to Stage 1 or Stage 2

## Suggested Review Order

1. Read the PRD and Stage 1 / Stage 2 checklists
2. Inspect landed code under `convex/domain/scheduledTrips/`
3. Inspect landed code under `convex/domain/vesselTrips/`
4. Inspect remaining function-layer shims and deferred continuity files
5. Decide:
   - what is complete
   - what is carryover
   - what belongs in Stage 3
6. Update the PRD
7. Write the Stage 3 checklist

## Bottom Line

You are the new oversight pass for this reorganization.

Your next action should be to independently verify whether Stage 1 and Stage 2
actually match the stated PRD and checklists, then bring the documentation back
into sync with the code and hand off a concrete Stage 3 checklist for the next
implementation agent.
