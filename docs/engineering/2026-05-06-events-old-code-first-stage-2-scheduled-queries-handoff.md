# Events Old-Code-First Stage 2 Scheduled Queries Handoff

## Stage Scope

Reduce `convex/functions/events/eventsScheduled/queries.ts` against
`events-old-reference`, preserving the public vessel-day list query and any
reader required by current live callers.

Default editable files:

- `convex/functions/events/eventsScheduled/queries.ts`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- this handoff note

Inspect callers and focused tests as needed. Do not edit tests or callers unless
the query file cannot be safely simplified without a tiny import or expectation
adjustment; report that need before expanding scope.

## Old-Code Trace Summary

Old `queries.ts` defines:

- `loadScheduledDockEventsForVesselSailingDay`, a direct indexed read by
  `VesselAbbrev` and `SailingDay` followed by `stripConvexMeta`
- `getScheduledDockEventsForSailingDay`, an internal query wrapper around that
  reader
- `getScheduledDepartureEventBySegmentKey`, an internal query that builds a
  departure boundary key, reads by `by_key`, and strips metadata

Old code does not sort rows after collection and does not expose a public app
subscription query.

## Final Current-Code Delta Table

| Current addition beyond old code | Keep/delete | Reason |
| --- | --- | --- |
| Public `listScheduledDockEventsForVesselSailingDay` query | Keep | App `useQuery` subscribes to this generated API path. |
| Exported `readScheduledDockEventsForVesselSailingDay` helper | Keep | `vesselTripScheduleQueries.ts` imports it directly for schedule segment and rollover reads. |
| Deterministic timeline sort | Keep | Focused scheduled query test covers stable chronological rows; vessel-trip rollover pools also consume the ordered reader. |
| Old internal `getScheduledDockEventsForSailingDay` | Delete | Current caller search found no live reference. |
| Old internal `getScheduledDepartureEventBySegmentKey` | Delete | Current schedule segment lookup performs this read in `vesselTripScheduleQueries.ts`. |
| Verbose helper split for sorting | Delete | A single comparator preserves the ordering contract with less local machinery. |

## LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| `convex/functions/events/eventsScheduled/queries.ts` | 74 | 112 | 78 |
| Focused scheduled query tests | 0 | 190 | 190 |

Updated production code is four raw lines longer than old code. The extra code
buys current compatibility: a public app subscription query, a direct reader
imported by vessel-trip schedule queries, and deterministic timeline ordering.
The old internal query wrappers remain deleted because current live callers no
longer use those generated paths.

## Verification Run Or Blocker

Ran the focused scheduled query test:

```sh
bun test convex/functions/events/eventsScheduled/tests/listScheduledDockEventsForVesselSailingDay.test.ts
```

Result: passed, 4 tests / 5 assertions. Tests were not edited.

## Recommendation

Stage 2 is ready for review. Keep the public query, direct reader, and compact
sort comparator. Defer any further query-surface cleanup to Stage 20
barrel/export review unless a future stage removes the app subscription or
vessel-trip direct reader.
