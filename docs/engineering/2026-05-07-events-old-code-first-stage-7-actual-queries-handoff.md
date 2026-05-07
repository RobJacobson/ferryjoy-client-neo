# Events Old-Code-First Stage 7 Actual Queries Handoff

## Stage Scope

Reduce `convex/functions/events/eventsActual/queries.ts` using the old actual
query as the baseline while preserving the current public timeline query used
by the app.

Default editable files:

- `convex/functions/events/eventsActual/queries.ts`
- `convex/functions/events/eventsActual/tests/listActualDockEventsForVesselSailingDay.test.ts`
- this handoff note
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`

Do not edit actual schemas, mutations, reload helpers, generated files, or
frontend callers unless the query cannot be safely simplified without a tiny
compatibility adjustment. If that happens, report it first.

## Old-Code Trace Summary

Read:

- `events-old-reference:convex/functions/events/eventsActual/queries.ts`
- current `convex/functions/events/eventsActual/queries.ts`
- current actual query tests
- app caller at
  `src/data/contexts/convex/ConvexVesselTimelineEventsContext.tsx`

Old query shape:

- one internal async reader
- uses `by_vessel_and_sailing_day`
- returns collected docs directly
- no public Convex `query` wrapper
- no metadata stripping
- no deterministic sort
- raw LoC: 25

Current query shape:

- public `listActualDockEventsForVesselSailingDay` app query
- private `readActualDockEventsForVesselSailingDay`
- strips Convex metadata to match `eventsActualSchema` return validator
- sorts by `ScheduledDeparture`, then `EventKey`
- raw LoC before Stage 7: 75
- focused tests before Stage 7: 207

## Current-Code Delta Table

| Delta | Default decision | Reason |
| --- | --- | --- |
| Public query wrapper | Keep | Live app caller uses `api.functions.events.eventsActual.queries.listActualDockEventsForVesselSailingDay`. |
| Private reader helper | Delete or inline unless a live caller needs it | Old code had only one reader; current helper is local-only. |
| Metadata stripping | Keep if return validator requires it | Public query returns `v.array(eventsActualSchema)`, so Convex metadata should not leak. |
| Deterministic sort | Keep if timeline merge/render depends on stable ordering | Stage 2 kept deterministic scheduled ordering; actual query should remain predictable unless tests prove it is unnecessary. |
| Verbose test harness | Reduce if possible | Keep behavior coverage, but the test file should not be 8x the old query without a reason. |

## Hard Acceptance Bar

Current query code is 3x old LoC. A valid result should either:

1. reduce query/test boilerplate while preserving the live public app query; or
2. produce a no-op/blocker report explaining why the current public wrapper,
   metadata strip, and ordering each force the extra size.

Do not delete useful style-guide comments just to report a LoC win. Do not
remove the public app query unless the app caller is changed with owner
approval.

## LoC Report

| Area | Old LoC | Current LoC before stage | Target |
| --- | ---: | ---: | --- |
| `eventsActual/queries.ts` | 25 | 75 | Prefer closer to Stage 2 actual need, likely 45-60 if helper/docs can collapse |
| focused query test | 0 | 207 | Keep behavior coverage; reduce harness duplication only if straightforward |

Stage 7 worker result:

| Area | Old LoC | Before Stage 7 | After Stage 7 | Decision |
| --- | ---: | ---: | ---: | --- |
| `eventsActual/queries.ts` | 25 | 75 | 55 | Inlined the local-only reader into the public query; kept the live app query, metadata stripping, and deterministic sort. |
| focused query test | 0 | 207 | 154 | Kept the same four behavior checks while reducing local harness comments and repeated registered-query invocation boilerplate. |

## Verification Run Or Blocker

Run focused verification if code or tests change:

```sh
bun test convex/functions/events/eventsActual/tests/listActualDockEventsForVesselSailingDay.test.ts
```

Run broader typecheck only if the public query signature or exports change.

Stage 7 worker verification:

```sh
bun test convex/functions/events/eventsActual/tests/listActualDockEventsForVesselSailingDay.test.ts
```

Passed: 4 tests, 0 failures.

## Recommendation

Start by inlining the local-only reader into the public query unless doing so
hurts readability. Keep the app-facing query, metadata stripping, and stable
ordering if they remain live requirements. It is acceptable for the final query
to be larger than old code because old code had no public app wrapper or return
validator, but every extra helper/export should be justified.

Stage 7 worker recommendation: approve. The remaining 30-LoC delta above old
code is accounted for by the live public Convex query wrapper, return validator
metadata stripping, and stable app-facing ordering.
