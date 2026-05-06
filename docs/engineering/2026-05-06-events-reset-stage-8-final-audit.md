# Events Reset Stage 8 Final Audit

## Executive Summary

The reset met the PRD goal of a smaller, flatter event-table implementation.
Compared with `events-current-reference`, the current worktree removes nested
domain helper trees, planner modules, app DTO converter files, compatibility
aliases, and generated-path placeholders. It lands at 40 scoped files and 4,022
semantic TypeScript lines, versus 90 files and 6,676 semantic TypeScript lines
in `events-current-reference`.

The current branch is intentionally closer to `events-old-reference` in shape:
direct table-local query/mutation modules, flat domain helpers, and grouped
event exports. It is larger than the old reference because it preserves current
required behavior that the old implementation did not cover: public list
queries, split sync reload actions/mutations, physical-only actual reload
preservation, depart-next ML actualization, predicted trip joins, and focused
behavior tests.

Required behaviors from `events-current-reference` are preserved through direct
table modules and flat shared domain helpers. Compatibility surfaces from the
overgrown reference were intentionally not restored unless a live caller or PRD
requirement justified them.

Final recommendation: ready for final PR/merge. No blockers were found.

## Three-Way Metrics

Method:

- References used: `events-old-reference`, `events-current-reference`, and the
  current worktree.
- File count includes all files under `convex/functions/events` and
  `convex/domain/events`.
- LoC counts tracked `.ts` / `.tsx` files only, using a repeatable heuristic:
  count nonblank lines whose trimmed text does not start with `//`, `/*`, `*`,
  or `*/`. This is semantic-ish LoC, not raw `wc -l`.
- Max depth is the maximum number of path segments below the measured root,
  including the filename. Example:
  `eventsScheduled/tests/foo.test.ts` has depth `3` below
  `convex/functions/events`.

Command shape used:

```sh
git ls-tree -r --name-only <ref> -- convex/functions/events convex/domain/events
find convex/functions/events convex/domain/events -type f | sort
node -e '<same counter for refs and worktree>'
```

| Code set | Root | Files | TS files | Semantic TS LoC | Max file depth | Notable folder shape |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `events-old-reference` | `convex/functions/events` | 15 | 14 | 485 | 2 | Flat table folders; no sync folder; one shared helper file. |
| `events-old-reference` | `convex/domain/events` | 7 | 7 | 100 | 2 | Mostly flat files plus schema mirrors. |
| `events-old-reference` | Combined | 22 | 21 | 585 | 2 | Simple baseline, but missing later required behavior/tests. |
| `events-current-reference` | `convex/functions/events` | 44 | 42 | 2,073 | 3 | Table folders, planner files, DTO converters, sync helper tree, tests. |
| `events-current-reference` | `convex/domain/events` | 46 | 46 | 4,603 | 4 | Deep actual/predicted/scheduled helper trees and structural tests. |
| `events-current-reference` | Combined | 90 | 88 | 6,676 | 4 | Overgrown reference; behavior truth but not architecture template. |
| Current worktree | `convex/functions/events` | 34 | 34 | 2,575 | 3 | Flat table modules, sync helpers, focused tests; no planners. |
| Current worktree | `convex/domain/events` | 6 | 6 | 1,447 | 2 | Three flat helpers plus tests. |
| Current worktree | Combined | 40 | 40 | 4,022 | 3 | Smaller than current-reference; larger than old because behavior is retained. |

## Three-Way Structure Comparison

| Area | `events-old-reference` | `events-current-reference` | Current worktree | Audit judgment |
| --- | --- | --- | --- | --- |
| Query modules | Minimal table reads; older names and less public query coverage. | Public vessel/day list queries plus internal/helper readers. | Direct list queries in each table; scheduled reader and predicted grouped loader retained for live callers. | Preserves current behavior with old-style flatness. |
| Scheduled mutation | Direct full-day replacement. | Full-day behavior via planner file and tests. | Direct `upsertScheduledRowsForSailingDay` in `eventsScheduled/mutations.ts`. | Behavior preserved; planner intentionally removed. |
| Predicted mutation | Directer table helper shape. | Targeted reconciliation, depart-next preservation, actualization helper, nested domain planner. | Direct `upsertPredictedDockBatches` and `patchDepartNextMlRowsForDepBoundary` in table module. | Current behavior preserved without planner tree. |
| Actual mutation | Direct sparse upsert and shared equality helper. | Planner-based sparse upsert plus nested actual domain helpers. | Direct `upsertActualDockRows`; flat actual-domain write/reload helpers where justified. | Current behavior preserved; no wrapper mutation restored. |
| Sync actions/reload mutations | Absent under scoped event paths. | Full sync tree, combined mutation, split helpers, reload tests. | Static scheduled/actual reload actions and split internal mutations restored; no predicted static reload. | Required sync behavior preserved; combined compatibility mutation removed. |
| Domain helpers | Flat `actual.ts`, `predicted.ts`, `scheduled.ts`, plus schema mirrors. | Deep nested helper trees for actual, predicted, scheduled, common, reload. | Flat `actual.ts`, `predicted.ts`, `scheduled.ts` plus focused tests. | Domain code pays rent through live callers and shared inference/projection. |
| Tests | No event-table tests in scoped old reference. | Many behavior tests plus structural/helper-boundary tests. | Focused behavior tests next to table/domain/sync modules. | Keeps behavior coverage, drops structural lock-in. |
| Barrels/export wiring | Fewer generated paths. | Grouped `events` plus top-level table aliases and nested barrels. | Grouped `events` only from `convex/functions/index.ts`; table/sync indexes remain. | Live API paths preserved; redundant aliases removed. |
| Compatibility surfaces | Some old-only wrappers/helpers. | Multiple compatibility aliases, DTO converters, planner paths, generated-reference tests. | No top-level table aliases, no combined sync mutation, no DTO converters, no planner placeholders. | Intentional PRD-aligned removal. |

## Required Behavior Preservation

- Scheduled vessel/day queries and ordering:
  `convex/functions/events/eventsScheduled/queries.ts` reads
  `by_vessel_and_sailing_day`, strips Convex metadata, sorts by boundary time,
  and keeps arrivals before departures at equal times.
- Actual vessel/day queries and ordering:
  `convex/functions/events/eventsActual/queries.ts` reads
  `by_vessel_and_sailing_day`, strips metadata, and sorts by
  `ScheduledDeparture` then `EventKey`.
- Predicted vessel/day queries and grouping:
  `convex/functions/events/eventsPredicted/queries.ts` preserves the public list
  query and `loadPredictedRowsGroupedForTrips` for
  `convex/functions/vesselTrips/queries.ts`.
- Scheduled full-day replacement mutation:
  `convex/functions/events/eventsScheduled/mutations.ts` loads by
  `by_sailing_day`, deletes stale keys, inserts missing rows, replaces changed
  rows, and skips unchanged rows.
- Actual sparse `EventKey` upsert mutation:
  `convex/functions/events/eventsActual/mutations.ts` dedupes incoming rows by
  `EventKey`, queries `by_event_key` with `unique`, and ignores metadata plus
  `UpdatedAt` churn.
- Predicted sparse targeted reconciliation:
  `convex/functions/events/eventsPredicted/mutations.ts` merges scopes, unions
  target keys, reconciles only targeted keys, preserves omitted depart-next ML
  rows when appropriate, and stamps `UpdatedAt` on inserts/replacements.
- Depart-next ML actualization:
  `patchDepartNextMlRowsForDepBoundary` queries `by_key_type_and_source` for
  both depart-next ML types, skips already actualized rows, patches `Actual` and
  rounded `DeltaTotal`, and returns whether it patched anything.
- Scheduled segment inference used by live callers:
  `convex/domain/events/scheduled.ts` exports
  `inferScheduledSegmentFromDepartureEvent`, `findNextDepartureEvent`, and
  `ConvexInferredScheduledSegment`; live imports use the flat module.
- Actual event projection from orchestrator writes:
  `convex/domain/events/actual.ts` keeps `buildActualDockEventFromWrite`, and
  `convex/functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`
  persists rows through `upsertActualDockRows`.
- Predicted event projection from ML/ETA trip fields:
  `convex/domain/events/predicted.ts` keeps
  `buildPredictedDockWriteBatch` and `buildPredictedDockClearBatch`; projection
  flows through `convex/domain/vesselOrchestration/updateEvents`.
- Static scheduled and actual reload actions/mutations:
  `convex/functions/events/sync/actions.ts` and
  `convex/functions/events/sync/mutations.ts` restore public manual reload,
  window reload, boundary reload, split scheduled replacement, and actual reload.
- Boundary cron reload skip behavior outside Pacific 3 AM:
  `reloadDockEventsAtSailingDayBoundary` returns structured skip metadata
  outside Pacific hour `3`; `convex/crons.ts` calls the grouped
  `internal.functions.events.sync.index` path for both DST candidates.

## Removed Or Unrestored Surfaces

Intentionally removed:

- Top-level `eventsActual`, `eventsPredicted`, and `eventsScheduled` aliases
  from `convex/functions/index.ts`. The app and crons use grouped
  `api.functions.events.*` / `internal.functions.events.*` paths.
- Combined `replaceDockEventsForSailingDay`. The split
  `replaceScheduledDockEventsForSailingDay` and
  `reloadActualDockEventsForSailingDay` surfaces cover live reload behavior
  without preserving a compatibility mutation.
- Nested `convex/domain/events/*/*` helper trees. Live callers now use flat
  `convex/domain/events/{actual,predicted,scheduled}.ts` modules.
- Planner/reconciliation modules whose only purpose was simple mutation loops:
  no `planActualRows`, `planScheduledRowsForSailingDay`, or predicted planner
  modules exist in the current worktree.
- App DTO converter files under event table folders, such as table-local
  `types.ts` converter files. Current app code imports Convex schema row types
  directly where needed.
- Generated-path placeholders for stale reference modules. Typecheck and codegen
  signal were not used to recreate deleted helper paths.

Not present in either required current path:

- Old-only internal mutation wrappers such as `projectActualDockWrites` and
  `projectPredictedDockWriteBatches` have no live current caller and were not
  restored.
- Internal `readActualDockEventsForVesselSailingDay` and
  `readPredictedDockEventsForVesselSailingDay` are implementation-local only;
  they are not exported as compatibility API because no live production caller
  requires them.

## Remaining Shared Code Justification

- `convex/domain/events/actual.ts`: justified. It normalizes sparse actual writes
  used by `convex/domain/vesselOrchestration/updateEvents`, and it contains the
  static actual reload construction needed by `sync/mutations.ts`, including
  physical-only trip observations and live-location patches. Tests:
  `convex/domain/events/tests/actual.test.ts`.
- `convex/domain/events/scheduled.ts`: justified. It builds scheduled boundary
  records/rows for static reload and supplies scheduled segment inference for
  vessel-trip/orchestrator schedule continuity. Tests:
  `convex/domain/events/tests/scheduled.test.ts`.
- `convex/domain/events/predicted.ts`: justified. It provides the shared
  composite prediction identity used by table mutations and trip joins, plus the
  ML/ETA projection helpers required by live event assembly. Tests:
  `convex/domain/events/tests/predicted.test.ts`.

No remaining helper under `convex/domain/events` looked helper-shaped without a
live caller or shared event inference/projection responsibility.

## Verification

Commands run and results:

- `bun test convex/functions/events/eventsScheduled/tests`: passed, 8 tests.
- `bun test convex/functions/events/eventsActual/tests`: passed, 9 tests.
- `bun test convex/functions/events/eventsPredicted/tests`: passed, 12 tests.
- `bun test convex/functions/events/sync/tests`: passed, 5 tests.
- `bun test convex/domain/events/tests`: passed, 19 tests.
- `bun test convex/functions/vesselOrchestrator/tests`: passed, 15 tests.
- `bun test convex/functions/vesselTrips/tests`: passed, 1 test.
- `bun test convex/domain/vesselOrchestration/updateEvents/tests`: passed, 10
  tests.
- `bun test src/data/contexts/convex/tests src/features/VesselTimeline/renderPipeline/tests`:
  passed, 12 tests.
- `bun run convex:typecheck`: passed.
- `bun run type-check`: passed.
- `bun run check`: passed; Biome checked 1,411 files with no fixes.

I did not run the full `bun test` suite because the handoff asked for focused
event, live-caller, and timeline/render checks, and those plus both typechecks
and Biome passed.

## Known Behavior Changes And Risks

- Top-level table aliases were removed from `convex/functions/index.ts`.
  Acceptable because no live repo caller uses them and the required grouped API
  path remains. Covered by typecheck and cron/app imports.
- `replaceDockEventsForSailingDay` was not restored. Acceptable because the PRD
  and memo classify it as compatibility/owner decision, and split scheduled and
  actual reload mutations are the live surfaces. Covered by sync reload tests.
- Static reload does not rebuild `eventsPredicted`. This is an intentional PRD
  behavior, not a regression. Realtime prediction projection remains covered by
  domain/updateEvents and orchestrator tests.
- Structural tests and generated-reference tests from `events-current-reference`
  were not preserved when they only protected helper paths. Acceptable because
  focused behavior tests now cover the table, sync, domain, and live-caller
  contracts.

Residual risk is limited to external/manual users outside this repo who might
have invoked removed internal compatibility paths. No in-repo production caller,
app subscription, cron, or typecheck requires those paths.

## Final Recommendation

Ready for final PR/merge. No blockers found. Recommended follow-up is owner
acknowledgment that the deliberate compatibility removals above are acceptable
for any out-of-repo operational tooling.
