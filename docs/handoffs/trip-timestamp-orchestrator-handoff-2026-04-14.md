# Handoff: Trip Timestamp Refactor Orchestrator Reset Point

Date: 2026-04-14
Audience: new orchestrator agent taking over at the start of Stage 3
Status: active handoff after reverting unsupervised later-stage work

## Current Reset Point

The branch has been reset to the last reviewed checkpoint for the trip
timestamp semantics refactor.

Reviewed and kept:

- `11dabcc` `feat(vessel-trips): define canonical timestamp contracts`
- `8466517` `feat(vessel-trips): implement canonical Stage 2 lifecycle writes`

Unsupervised later-stage commits that were reverted:

- `994a103` `feat(ml): align reader-side timestamp semantics with canonical trip fields`
- `8c3f8ea` `feat(timeline): project canonical trip actuals into eventsActual`

Revert commits:

- `ef96413` revert of `994a103`
- `7ac475c` revert of `8c3f8ea`

## What Is Safe To Assume

- Stage 0 is complete.
- Stage 1 is reviewed, implemented, and committed.
- Stage 2 is reviewed, implemented, and committed.
- Stage 3 and Stage 4 must be redone under supervised review.

## Source Documents

Read these first:

- [trip-timestamp-semantics-prd-2026-04-14.md](./trip-timestamp-semantics-prd-2026-04-14.md)
- [trip-timestamp-semantics-memo-2026-04-14.md](./trip-timestamp-semantics-memo-2026-04-14.md)
- [trip-timestamp-stage-1-implementation-spec-2026-04-14.md](./trip-timestamp-stage-1-implementation-spec-2026-04-14.md)
- [trip-timestamp-stage-2-implementation-spec-2026-04-14.md](./trip-timestamp-stage-2-implementation-spec-2026-04-14.md)
- [vesseltimeline-reconciliation-memo-2026-04-14.md](./vesseltimeline-reconciliation-memo-2026-04-14.md)
- [code-style.mdc](../../.cursor/rules/code-style.mdc)

## Verified State

The checked-in reviewed state now includes:

- canonical timestamp fields on trip schema and domain shapes
- Stage 2 lifecycle writes using canonical source-of-truth fields
- same-tick complete-and-start behavior reviewed at the write-side lifecycle
  layer
- Stage 3/4 reader and projection changes removed pending fresh review

## Next Recommended Step

Resume with Stage 3 using the same workflow:

1. use the already-written Stage 3 implementation spec as the starting point
2. have a worker subagent own any needed spec revisions
3. have a worker subagent implement Stage 3 against the approved spec
4. review implementation before moving to Stage 4

## Orchestration Process

The new orchestrator agent should act as the reviewer/supervisor and delegate
bounded work to subagents.

Required workflow going forward:

- the supervisor does not write specs
- the supervisor does not implement stage code
- worker subagents write specs
- worker subagents implement code
- the supervisor reviews both specs and implementation

Stage 3 exception:

- the Stage 3 spec already exists and can be treated as "water over the dam"
- if that spec needs changes, a worker subagent should own those revisions
- after Stage 3, return fully to the standard supervised subagent loop

Use this loop for each stage:

1. assign the next stage to a subagent for spec drafting only
2. have that subagent create a detailed in-repo implementation spec
3. review the spec in the main thread against the PRD, semantic memo, and
   current code
4. send concrete revision comments back to the subagent
5. have the subagent update the spec until it is approved
6. assign implementation to a fresh subagent when practical
7. review the implementation for semantic correctness, regressions, test
   coverage, and scope control
8. send concrete code review comments back to the implementation subagent
9. have the subagent address those comments before marking the stage approved

Supervisor responsibilities:

- keep the PRD and semantic memo as the source of truth
- enforce the worker-subagent / supervisor split even if a direct implementation
  path feels faster
- prevent scope creep into later stages
- independently spot-check tests and key diffs rather than relying only on
  subagent summaries
- prefer reverting unsupervised or unreviewed later-stage work instead of
  building on top of it

Subagent boundary rules:

- spec-writing subagents should be docs-only
- implementation subagents should stay within the approved stage scope
- avoid reusing a subagent that already accumulated too much unrelated context
- if a subagent picks up unrelated formatting churn or later-stage behavior
  changes, send it back for cleanup before approval

## Stage 3 Guardrails

- Do not reintroduce unsupervised ML or reader-side changes while doing Stage 3.
- Keep Stage 3 focused on `eventsActual` projection and timeline reseed readers.
- Do not use coverage timestamps as substitutes for physical boundary facts.
- Preserve the reviewed Stage 2 lifecycle behavior as the source of truth.
