# Events Reset Stage 1 Inventory Handoff

## Assignment

Complete Stage 1 of the events tables blank-slate refactor: required API
inventory only.

This is reconnaissance, not repair. The current branch intentionally deleted
`convex/functions/events` and `convex/domain/events`, so the repo is expected
to be partially non-compiling during this stage. Do not create replacement
files, placeholders, compatibility barrels, or implementation scaffolding.

## Required Reading

- `docs/engineering/2026-05-05-events-tables-blank-slate-refactor-prd.md`
- `docs/engineering/2026-05-05-events-tables-engineering-memo.md`
- `.cursor/rules/code-style.mdc`

Treat the PRD and style guide as binding. If they conflict, prefer the stricter
rule that produces less code and a clearer table-local implementation.

## Inventory Sources

Use all three sources below, with different authority levels:

- Current branch `events-reset-stage-1-inventory`: mandatory source for callers
  that still import or reference the missing event modules.
- Reference branch `events-current-reference`: behavior and API reference.
- Reference branch `events-old-reference`: design and simplicity baseline.

Behavior rule:

- Required behavior: prefer `events-current-reference`.
- Architecture and style: prefer the PRD and `events-old-reference`.
- Ambiguous behavior: flag it for owner review if it exists only because of the
  current reference architecture and is not backed by a requirement, caller,
  test, or product need.

Useful commands:

```sh
rg -n "functions/events|domain/events|eventsScheduled|eventsActual|eventsPredicted|reloadDockEvents|replaceDockEvents|patchDepartNextMlRows|upsertPredictedDockBatches|upsertActualDockRows|upsertScheduledRowsForSailingDay" convex src docs --glob '!convex/_generated/**'
git grep -n "functions/events\\|domain/events\\|eventsScheduled\\|eventsActual\\|eventsPredicted\\|reloadDockEvents\\|replaceDockEvents\\|patchDepartNextMlRows\\|upsertPredictedDockBatches\\|upsertActualDockRows\\|upsertScheduledRowsForSailingDay" events-current-reference -- convex src docs
git grep -n "functions/events\\|domain/events\\|eventsScheduled\\|eventsActual\\|eventsPredicted\\|reloadDockEvents\\|replaceDockEvents\\|patchDepartNextMlRows\\|upsertPredictedDockBatches\\|upsertActualDockRows\\|upsertScheduledRowsForSailingDay" events-old-reference -- convex src docs
git ls-tree -r --name-only events-current-reference -- convex/functions/events convex/domain/events
git ls-tree -r --name-only events-old-reference -- convex/functions/events convex/domain/events
```

Use `git show branch:path` to inspect reference files without checking them
out. Do not port files wholesale from either reference branch.

## Scope

Inventory these surfaces:

- `convex/functions/events/eventsScheduled`
- `convex/functions/events/eventsActual`
- `convex/functions/events/eventsPredicted`
- `convex/functions/events/sync`
- `convex/domain/events`, only where current callers or reference behavior make
  it relevant

Include all evidence categories, separated clearly:

- Production callers.
- Convex generated API references or expected public/internal function names.
- Tests that express behavior worth preserving.
- App-layer imports or subscriptions.
- Docs only when they describe intended behavior not otherwise captured.

Tests and docs are evidence; they do not automatically create API
requirements.

## Required Deliverable

Update `docs/engineering/2026-05-05-events-tables-engineering-memo.md` with a
confirmed API inventory table.

Use this shape unless you find a clearer equivalent:

```md
| Export | Kind | Required? | Production callers | App callers | Tests | Reference branch notes | Implementation notes |
```

The table must distinguish `must implement` from `reference only`.

Also add a concise test classification section that groups current/reference
tests into:

- Behavioral: preserve or rewrite.
- Structural: do not preserve unless needed by behavior.
- Obsolete: delete or ignore during rebuild.

Keep the engineering memo durable. Put stable facts, confirmed caller/API
requirements, and behavior notes there. Do not turn it into a transcript of
search commands.

## Expected Findings To Confirm

Confirm rather than assume these expected minimum surfaces:

- `listScheduledDockEventsForVesselSailingDay`
- `readScheduledDockEventsForVesselSailingDay`, if current callers require it
- `upsertScheduledRowsForSailingDay`
- `listActualDockEventsForVesselSailingDay`
- `readActualDockEventsForVesselSailingDay`, if current callers require it
- `upsertActualDockRows`
- `listPredictedDockEventsForVesselSailingDay`
- `readPredictedDockEventsForVesselSailingDay`, if current callers require it
- `loadPredictedRowsGroupedForTrips`, if current callers require it
- `upsertPredictedDockBatches`
- `patchDepartNextMlRowsForDepBoundary`
- `reloadDockEventsForCurrentSailingDay`
- `reloadDockEventsForSailingDay`
- `reloadDockEventsWindow`
- `reloadDockEventsAtSailingDayBoundary`
- `replaceDockEventsForSailingDay`
- `replaceScheduledDockEventsForSailingDay`
- `reloadActualDockEventsForSailingDay`

Pay special attention to schema/type imports from app code and
`VesselOrchestrator`, because those imports may force a schema/type surface even
when no runtime function is called directly.

## Verification Gate

Stage 1 is docs only.

- Do not run typecheck as a gate.
- Do not create implementation files.
- Do not edit generated Convex files.
- Do not edit `convex/functions/events` or `convex/domain/events`.

Before finishing, report:

- The memo sections updated.
- Any ambiguous behavior that needs owner review.
- Any current branch callers that are still unresolved by the expected minimum
  surface.
- Commands used for inventory.
