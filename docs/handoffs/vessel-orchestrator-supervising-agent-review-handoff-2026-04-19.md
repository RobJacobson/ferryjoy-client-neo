# Handoff: supervising agent review for vessel orchestrator refactor

**Date:** 2026-04-19  
**Audience:** supervising engineer or agent reviewing the ongoing
vessel-orchestrator refactor  
**Status:** actionable review brief

## Purpose

You are stepping into a supervisory role for the next phase of the
vessel-orchestrator refactor.

Your job is to:

1. Read the canonical PRD.
2. Read the latest stage handoff note.
3. Review the implementation agent's proposed plan.
4. Review the implementation agent's code after it lands.
5. Keep the work aligned with the intended architecture, especially the public
   contracts and layer boundaries.

This note is meant to give you the minimum context needed to supervise without
dragging you through the full historical memo trail.

## Read in this order

### 1. Canonical PRD

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)

This is the source of truth for the target architecture:

- four sequential pipelines
- black-box public domain contracts
- functions-layer ownership of I/O, dedupe, and persistence
- domain-layer ownership of computation and handoff DTOs

### 2. Latest stage handoff

At the time of this note, the latest handoff is:

- [`vessel-orchestrator-stage-c-trips-handoff-2026-04-19.md`](./vessel-orchestrator-stage-c-trips-handoff-2026-04-19.md)

If a later stage handoff exists when you read this, use the latest one instead.

### 3. Supporting constraints

- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- [`/.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)

## Current refactor state

The refactor is being done in stages:

- Stage A: contract freeze
- Stage B: locations concern ownership
- Stage C: trips concern ownership
- Stage D: predictions concern ownership
- Stage E: timeline concern ownership
- Stage F: cleanup

What has already landed:

- Stage A public contracts for all four pipelines
- Stage B locations concern ownership move
- Stage C handoff note prepared for the next implementation pass

The main public contracts now exist and should be treated as intentionally
frozen unless there is a strong reason to revise them.

## What you should look for in the implementation agent's plan

When reviewing the plan, focus on architectural alignment rather than code
style details.

### Approve plans that do this

- preserve the frozen public contract for the current stage
- use thin wrappers or transitional adapters when needed
- keep persistence in `convex/functions`
- keep business logic in `convex/domain`
- respect module-boundary rules and concern-owned entrypoints
- keep the current stage scoped to its intended concern

### Push back on plans that do this

- redesign public contracts casually
- expose `Deps`, query ports, mutation ports, or `ActionCtx` through public
  domain APIs
- move dedupe or persistence semantics into domain code
- blend multiple stages together without a strong reason
- leave the repo in a long-lived incoherent state

## What you should look for in the implementation agent's code

### Contract integrity

Check that:

- the public `runUpdate...` contract for the current stage remains intact
- the concern still owns the public handoff types defined in the PRD
- no new public legacy surface becomes the default story

### Layer ownership

Check that:

- `convex/functions` owns fetch/query/mutation/dedupe/persist behavior
- `convex/domain` owns computation and plain-data transforms
- domain code does not gain new Convex-specific dependencies

### Scope control

Check that:

- the code solves the current stage
- cleanup work is opportunistic rather than sprawling
- later stages are not pre-implemented in a half-finished way

### Comments and readability

This codebase values:

- module-level comments
- TSDoc on exported and internal functions
- meaningful inline comments for non-obvious logic
- `const` arrow functions
- functional style where practical

If new modules or important helpers lack comments, it is appropriate to request
or add them.

### Tests and verification

Expect the implementation agent to run the usual checks for touched code:

- `bun run type-check`
- `bun run convex:typecheck`
- `bun run check:fix`

Targeted tests should be added or updated for the concern being changed.

## Main architectural guardrails

These are the most important review rules to enforce:

1. Public domain APIs are black boxes:
   - `input -> Promise<output>`
2. Domain does not own persistence.
3. Functions does not own business rules.
4. Each pipeline should emit the computed data needed by the next pipeline.
5. "Always compute; dedupe before persist" is the desired direction.
6. Transitional shims are acceptable.
7. Leaky public interfaces are not acceptable.

## Practical review style

If the implementation agent's plan is mostly correct, prefer "approved with
notes" feedback over forcing unnecessary redesign.

If the code lands with the right public contract and ownership story, favor
small corrective patches over broad critique.

The main thing to protect is the architecture, not aesthetic perfection.

## Useful files to keep open while reviewing

- [convex/domain/vesselOrchestration/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/index.ts)
- [convex/functions/vesselOrchestrator/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/actions.ts)
- [docs/engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)
- [docs/handoffs/vessel-orchestrator-stage-c-trips-handoff-2026-04-19.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/handoffs/vessel-orchestrator-stage-c-trips-handoff-2026-04-19.md)

If Stage D or later is underway when you read this, swap in the latest stage
handoff note.

## Recommended response pattern to the implementation agent

When replying to the implementation agent, a good structure is:

1. Quick alignment statement:
   - approved
   - approved with notes
   - needs revision
2. Two or three architectural notes
3. One scope-control note if needed
4. Clear permission to proceed

That keeps the implementation agent moving while maintaining architectural
discipline.

## Revision history

- **2026-04-19:** Initial supervising-agent review handoff created to support
  plan review and code review against the PRD and latest stage handoff.
