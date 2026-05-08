# Events Old-Code-First Stage 12 Predicted Public List Query Handoff

## Stage Scope

Reduce or approve the public predicted vessel-day list query in
`convex/functions/events/eventsPredicted/queries.ts` using the old predicted
query flow as the baseline.

This stage covers only:

- `listPredictedDockEventsForVesselSailingDay`
- the local read/sort code required by that public app query
- focused tests for the public list query, if reducing test boilerplate is
  straightforward

Stage 13 owns `loadPredictedRowsGroupedForTrips`. Do not reshape the grouped
trip loader to make Stage 12 look smaller. If the only meaningful reduction for
the public query requires changing the grouped loader, stop and report that as
a Stage 13 coupling note.

Default editable files:

- `convex/functions/events/eventsPredicted/queries.ts`
- `convex/functions/events/eventsPredicted/tests/listPredictedDockEventsForVesselSailingDay.test.ts`
- this handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

Do not edit predicted schemas, predicted mutations, domain projection helpers,
vessel-trip queries, frontend callers, generated files, or barrels unless the
query cannot be safely simplified without a tiny compatibility adjustment. If
that happens, stop and report the exact blocker before expanding scope.

## Required Reading

Read before implementation:

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- `docs/engineering/2026-05-06-events-old-code-first-stage-2-scheduled-queries-handoff.md`
- `docs/engineering/2026-05-07-events-old-code-first-stage-7-actual-queries-handoff.md`
- `docs/engineering/2026-05-08-events-old-code-first-stage-11-predicted-schemas-handoff.md`

Use `events-old-reference` as the implementation baseline. Do not use
`events-current-reference` unless the owner explicitly asks for archaeology.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/functions/events/eventsPredicted/queries.ts`
- current `convex/functions/events/eventsPredicted/queries.ts`
- current public list tests in
  `convex/functions/events/eventsPredicted/tests/listPredictedDockEventsForVesselSailingDay.test.ts`
- app caller at
  `src/data/contexts/convex/ConvexVesselTimelineEventsContext.tsx`

Old comparable public-list flow:

- old code had no public Convex `query` wrapper
- `loadPredictedDockEventsForVesselSailingDay` performed one direct indexed read
  by `VesselAbbrev` and `SailingDay`
- old code returned collected `Doc<"eventsPredicted">[]` directly
- old code did not strip Convex metadata
- old code did not sort rows after collection

The full old predicted query file also contained
`loadPredictedRowsGroupedForTrips`, but that is Stage 13. Do not use the whole
old file as the only justification for Stage 12 results; separate the public
list path from the grouped-trip loader.

Raw LoC:

- old full `eventsPredicted/queries.ts`: 72
- current full `eventsPredicted/queries.ts` before Stage 12: 134
- current focused predicted query test before Stage 12: 276

## Current Public Query Shape

Current code has:

- public `listPredictedDockEventsForVesselSailingDay` app query
- `eventsPredictedSchema` return validator
- local `readPredictedDockEventsForVesselSailingDay` helper shared by the
  public query and Stage 13 grouped loader
- `stripConvexMeta` so public return values match the validator
- deterministic sort by `ScheduledDeparture`, then `Key`

The live app caller is:

```ts
api.functions.events.eventsPredicted.queries
  .listPredictedDockEventsForVesselSailingDay
```

in `src/data/contexts/convex/ConvexVesselTimelineEventsContext.tsx`.

## Current-Code Delta Table

| Delta beyond old public-list flow | Default decision | Reason |
| --- | --- | --- |
| Public Convex `query` wrapper | Keep | Live app subscription uses this generated API path. |
| Return validator using `eventsPredictedSchema` | Keep | Required by current Convex function rules and keeps the public payload schema-shaped. |
| Metadata stripping | Keep | The public query returns `eventsPredictedSchema`, which does not include `_id` or `_creationTime`. |
| Deterministic sort | Keep unless a live reason disproves it | Scheduled and actual public list queries keep stable timeline ordering; current predicted tests cover the same app-facing expectation. |
| Local reader helper shared with Stage 13 | Keep for Stage 12 unless a change also clearly improves Stage 13 | The helper is not local-only. Inlining it into the public query would either duplicate indexed reads or force grouped-loader changes owned by Stage 13. |
| Grouped-trip loader imports and composite-key grouping | Defer | Stage 13 owns `loadPredictedRowsGroupedForTrips`. |
| Public-list test harness volume | Reduce only if easy and behavior stays clear | The test file also covers Stage 13; do not churn it broadly from Stage 12. |

## Hard Acceptance Bar

The current file is not more than 3x the full old predicted query file, but the
public query has additions old code did not need. A valid Stage 12 result must
either:

1. produce a smaller public-list path without worsening the Stage 13 loader;
2. reduce focused public-list test boilerplate while preserving behavior; or
3. return a no-op/blocker report explaining why the public wrapper, return
   validator, metadata stripping, deterministic sort, and shared reader are all
   worth keeping until Stage 13.

Do not delete comments or split helper names just for a token LoC win. Do not
remove the public app query unless the app caller is changed with owner
approval.

## Required Worker Report

The result must include:

1. Old production LoC for the comparable old public-list flow, plus full old
   file LoC for context.
2. Current production LoC before edits.
3. Updated production LoC after edits.
4. Old/current/updated focused test LoC if tests are touched.
5. A complete old-flow trace from indexed read to returned rows.
6. A delta table explaining every meaningful difference from old code.
7. A clear recommendation: approve edits, no-op, or blocker.

If you decide no production change is appropriate, update this handoff with a
Worker Result section and update the stage log only if appropriate.

## Verification

If code or tests change, run:

```sh
bun test convex/functions/events/eventsPredicted/tests/listPredictedDockEventsForVesselSailingDay.test.ts
```

Run broader type checks only if public query signatures or exports change:

```sh
bun run type-check
bun run convex:typecheck
```

If no code or test files change, verification may be a blocker-free review
report plus raw LoC confirmation.

## Recommendation

Start by tracing the old indexed read and checking whether the current
`readPredictedDockEventsForVesselSailingDay` helper should remain shared until
Stage 13. This may be a no-op stage: the obvious additions are live
app-facing behavior or Convex validator requirements, and the helper coupling is
better reviewed with `loadPredictedRowsGroupedForTrips` in Stage 13.

## Worker Result

The Stage 12 worker recommends no production or test changes.

### Old-Flow Trace

Old `eventsPredicted/queries.ts` had no public Convex query for the app-facing
vessel-day list. The comparable public-list flow was the old
`loadPredictedDockEventsForVesselSailingDay` helper:

1. Accept a Convex query context plus `vesselAbbrev` and `sailingDay`.
2. Query `eventsPredicted`.
3. Use the `by_vessel_and_sailing_day` index.
4. Constrain `VesselAbbrev` and `SailingDay`.
5. Collect and return `Doc<"eventsPredicted">[]` directly.

Old code did not strip Convex metadata, did not validate a public return value,
and did not sort after collection.

### Live Current Callers

- `src/data/contexts/convex/ConvexVesselTimelineEventsContext.tsx` subscribes
  to `api.functions.events.eventsPredicted.queries
  .listPredictedDockEventsForVesselSailingDay`.
- `convex/functions/vesselTrips/queries.ts` imports
  `loadPredictedRowsGroupedForTrips`; that grouped loader currently shares the
  same local indexed reader as the public list query.
- The focused test file covers both the public list query and the grouped trip
  loader. Stage 13 owns grouped-loader shape, so broad test harness reduction
  would be premature here.

### LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| Comparable old public-list helper in `eventsPredicted/queries.ts` | 18 | 134 full file | 134 full file |
| Full old `eventsPredicted/queries.ts` context | 72 | 134 | 134 |
| Focused predicted query tests | 0 | 276 | 276 |

Tests were not touched. The test LoC row is included for visibility because the
handoff called out the large focused test file.

### Delta Table

| Current addition beyond old public-list flow | Keep/delete | Reason |
| --- | --- | --- |
| Public `listPredictedDockEventsForVesselSailingDay` query | Keep | The live timeline context subscribes to this generated API path. |
| `eventsPredictedSchema` return validator | Keep | Current Convex rules require return validators, and the public payload should match the schema-shaped event row. |
| Metadata stripping | Keep | The return validator does not include `_id` or `_creationTime`; stripping keeps the public response validator-shaped. |
| Deterministic sort by `ScheduledDeparture`, then `Key` | Keep | Scheduled and actual public list queries preserve stable app-facing ordering, and the focused predicted test protects the same timeline expectation. |
| Shared local indexed reader | Keep for Stage 12 | The reader is used by both the public list query and `loadPredictedRowsGroupedForTrips`; inlining it would either duplicate the same read or reshape Stage 13-owned code. |
| Grouped-trip loader and composite-key grouping | Defer | Stage 13 explicitly owns `loadPredictedRowsGroupedForTrips`. |
| Large combined focused test harness | Defer | The same test file covers Stage 13 behavior, so reducing shared harness volume belongs with grouped-loader review unless a public-query-only edit becomes necessary. |

### Verification

No tests were run because no production code or test code changed. Verification
for this no-op review was old-flow tracing, live-caller search, and raw LoC
confirmation.

### Recommendation

Approve Stage 12 as a no-op. The current public-list path is larger than the old
comparable helper because the current app needs a public Convex query, Convex
requires return validation, and the response is intentionally metadata-free and
deterministically ordered. Revisit the shared reader and test harness during
Stage 13 with the grouped trip loader in scope.
