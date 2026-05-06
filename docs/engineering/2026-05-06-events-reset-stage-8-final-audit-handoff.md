# Events Reset Stage 8 Final Audit Handoff

## Assignment

Complete Stage 8 of the events tables blank-slate refactor: produce the final
audit comparing the event implementation across three code sets.

This is an audit and synthesis stage, not another implementation stage. The
goal is to document what changed, prove the reset met the PRD goals, and call
out any remaining risks or deliberate behavior changes with enough precision
for owner review.

## Required Three-Way Comparison

Compare these three code sets:

1. `events-old-reference` — outdated but simpler historical implementation.
2. `events-current-reference` — implementation immediately before this reset,
   including the overgrown helper/planner structure.
3. Current branch/worktree — the post-refactor implementation.

Do not collapse this into a simple before/after. The audit should explicitly
show where the current branch is closer to the old simpler shape, where it
preserves required behavior from `events-current-reference`, and where it
intentionally diverges from both.

## Required Reading

- `docs/engineering/2026-05-05-events-tables-blank-slate-refactor-prd.md`
- `docs/engineering/2026-05-05-events-tables-engineering-memo.md`
- `docs/engineering/2026-05-05-events-reset-stage-1-inventory-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-2-queries-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-3-scheduled-mutations-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-4-predicted-mutations-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-5-actual-mutations-handoff.md`
- `docs/engineering/2026-05-05-events-reset-stage-6-sync-handoff.md`
- `docs/engineering/2026-05-06-events-reset-predicted-projection-handoff.md`
- `.cursor/rules/code-style.mdc`

Pay special attention to the PRD Stage 8 requirements, Stage 7 obsolete
structure bullets, and the engineering memo sections about compatibility
surfaces, generated API references, and tests that should not force old helper
paths back into existence.

## Scope

Create:

- `docs/engineering/2026-05-06-events-reset-stage-8-final-audit.md`

Audit primary implementation scope:

- `convex/functions/events`
- `convex/domain/events`

Audit supporting live wiring and callers where relevant:

- `convex/functions/index.ts`
- `convex/schema.ts`
- `convex/crons.ts`
- `convex/functions/vesselOrchestrator`
- `convex/functions/vesselTrips`
- `convex/domain/vesselOrchestration/updateEvents`
- App Convex event subscriptions and timeline event consumers under `src/`

Do not implement broad code changes. If you discover a correctness defect,
scope violation, missing live caller, or broken export, document it with exact
file paths and recommended next action. Only make a code or doc cleanup if it
is tiny, clearly part of the audit, and smaller than sending the finding back
for implementation.

## Deliverable Shape

The final audit document should include these sections.

### Executive Summary

Briefly answer:

- Did the reset meet the PRD goal of a smaller, flatter event-table
  implementation?
- Which required behaviors from `events-current-reference` were preserved?
- Which old/current compatibility surfaces were intentionally not restored?
- Are there any remaining blockers before PR/merge?

### Three-Way Metrics

Record metrics for all three code sets using the same method for each:

- File count.
- Nonblank, non-comment lines of code if practical; otherwise raw `wc -l` line
  count with that caveat stated.
- Max directory depth.
- Notable folder shape.

At minimum, calculate metrics for:

- `convex/functions/events`
- `convex/domain/events`
- Combined event implementation total for both paths.

If a path does not exist in one reference, record it as `0` or `absent`, and
explain the absence.

### Three-Way Structure Comparison

Include a table or concise bullets comparing:

- Query modules.
- Scheduled mutation surface.
- Predicted mutation surface.
- Actual mutation surface.
- Sync actions and reload mutations.
- Domain helpers.
- Tests.
- Barrels/export wiring.
- Compatibility surfaces.

For each area, compare:

- `events-old-reference`.
- `events-current-reference`.
- Current branch.
- Audit judgment.

### Required Behavior Preservation

Document whether the current branch preserves the required behavior for:

- Scheduled vessel/day queries and ordering.
- Actual vessel/day queries and ordering.
- Predicted vessel/day queries and grouping.
- Scheduled full-day replacement mutation.
- Actual sparse `EventKey` upsert mutation.
- Predicted sparse targeted reconciliation.
- Depart-next ML actualization.
- Scheduled segment inference used by live callers.
- Actual event projection from orchestrator writes.
- Predicted event projection from ML/ETA trip fields.
- Static scheduled and actual reload actions/mutations.
- Boundary cron reload skip behavior outside Pacific 3 AM.

Use file links and short descriptions. Do not paste large code excerpts.

### Removed Or Unrestored Surfaces

List surfaces intentionally not restored, with rationale. At minimum, check:

- Top-level `eventsActual`, `eventsPredicted`, and `eventsScheduled` aliases
  from `convex/functions/index.ts`.
- Combined `replaceDockEventsForSailingDay`.
- Nested `convex/domain/events/*/*` helper trees.
- Planner/reconciliation modules whose only purpose was simple mutation loops.
- App DTO converter files under event table folders.
- Generated-path placeholders for stale reference modules.
- Internal readers with no live production caller.

Separate "intentionally removed" from "not present in either required path" so
the owner can see the decision clearly.

### Remaining Shared Code Justification

For every shared helper that remains under `convex/domain/events`, explain why
it is justified:

- `actual.ts`
- `scheduled.ts`
- `predicted.ts`
- Any domain event tests that remain.

Tie each helper to live callers or true shared event inference/projection
behavior. Flag anything that looks helper-shaped but lacks a live caller.

### Verification

Run and record results for:

- Focused event query/mutation/domain/sync tests.
- Relevant vessel-orchestrator and vessel-trip tests that exercise event
  surfaces.
- Relevant app timeline/render tests if practical.
- `bun run convex:typecheck`.
- `bun run type-check`.
- `bun run check` or `bun run check:fix` as appropriate.

If a command is too broad or slow to run, state that explicitly and run the
highest-signal focused substitute.

### Known Behavior Changes And Risks

Record any behavior change from `events-current-reference`, including intended
removals of compatibility surfaces. For each item, state:

- What changed.
- Why it is acceptable or who needs to approve it.
- Whether there is test coverage.
- Whether follow-up work is recommended.

If there are no known behavior changes beyond intentional compatibility
surface removals, say that clearly.

### Final Recommendation

End with a concise recommendation:

- Ready for final PR/merge.
- Ready after named small fixes.
- Not ready because named blockers remain.

## Suggested Metric Method

Use one repeatable method across all three code sets. It is fine to use temporary
directories under `/tmp` or `git ls-tree` plus `git show`. Whatever method you
choose, record enough detail in the audit for another engineer to reproduce the
numbers.

Suggested refs:

```text
events-old-reference
events-current-reference
HEAD
```

Suggested primary paths:

```text
convex/functions/events
convex/domain/events
```

Suggested checks:

```text
git ls-tree -r --name-only <ref> -- convex/functions/events convex/domain/events
git ls-tree -r --name-only <ref> -- convex/functions/events convex/domain/events | wc -l
git show <ref>:<path>
```

For max directory depth, define the formula you use. A simple acceptable method
is to count path segments below `convex/functions/events` and
`convex/domain/events`, then report the maximum for each root.

For LoC, prefer counting tracked `.ts` files under the primary paths. If you use
raw `wc -l`, label the metric as raw lines rather than semantic LoC.

## Useful Inspection Commands

Use these as starting points, adjusting as needed:

```text
git ls-tree -r --name-only events-old-reference -- convex/functions/events convex/domain/events
git ls-tree -r --name-only events-current-reference -- convex/functions/events convex/domain/events
find convex/functions/events convex/domain/events -type f | sort
```

```text
rg -n "replaceDockEventsForSailingDay|projectActualDockWrites|projectPredictedDock|plan[A-Z]|Planner|compat|eventsActual|eventsPredicted|eventsScheduled" convex src --glob "*.ts" --glob "*.tsx" --glob "!convex/_generated/**"
```

```text
rg -n "domain/events/.+/" convex src --glob "*.ts" --glob "*.tsx" --glob "!convex/_generated/**"
find convex/domain/events -type d | sort
find convex/functions/events -type f -iname "*plan*" -o -iname "*planner*"
```

Generated files can be inspected for smoke signal after codegen/typecheck, but
do not treat stale generated references as requirements unless backed by a live
caller or explicit product need.

## Verification Guidance

At minimum, run focused tests covering the restored event surface:

```text
bun test convex/functions/events/eventsScheduled/tests
bun test convex/functions/events/eventsActual/tests
bun test convex/functions/events/eventsPredicted/tests
bun test convex/functions/events/sync/tests
bun test convex/domain/events/tests
```

Also run likely live-caller checks:

```text
bun test convex/functions/vesselOrchestrator/tests
bun test convex/functions/vesselTrips/tests
bun test convex/domain/vesselOrchestration/updateEvents/tests
bun run convex:typecheck
bun run type-check
```

Run `bun run check` if feasible. If `bun run check` is too broad for the audit
turn, run it on the touched audit doc plus the event implementation paths and
record the narrower command.

## Guardrails

- Do not port files wholesale from either reference branch.
- Do not add compatibility barrels.
- Do not add nested `domain/events/*/*` directories.
- Do not add planner modules for simple row reconciliation.
- Do not refactor VesselOrchestrator.
- Do not add future-stage stubs or generated-path placeholders.
- Do not preserve a surface because tests/docs/generated references mention it;
  require a live production caller or explicit owner decision.
- Prefer findings and recommendations over implementation during this stage.

## Final Worker Report

Before finishing, report:

- Audit document path.
- Metrics method used.
- Commands run and results.
- Any code/doc changes beyond the audit document.
- Any blockers or recommended follow-ups.
