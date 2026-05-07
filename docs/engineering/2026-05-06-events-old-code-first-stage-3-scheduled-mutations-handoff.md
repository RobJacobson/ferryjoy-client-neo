# Events Old-Code-First Stage 3 Scheduled Mutations Handoff

## Stage Scope

Reduce `convex/functions/events/eventsScheduled/mutations.ts` against
`events-old-reference`, focusing on `upsertScheduledRowsForSailingDay`.

Default editable files:

- `convex/functions/events/eventsScheduled/mutations.ts`
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- this handoff note

Inspect current sync callers and focused tests as needed. Do not edit tests or
callers unless the mutation file cannot be safely simplified without a tiny
scope adjustment; report that need before expanding scope.

## Old-Code Trace Summary

Old `upsertScheduledRowsForSailingDay`:

- loads existing `eventsScheduled` rows by `by_sailing_day`
- maps existing rows by `Key`
- deletes rows missing from the replacement slice
- inserts rows with no existing key
- replaces changed rows
- skips unchanged rows using `scheduledRowsEqual`

The old comparison ignores Convex metadata and `UpdatedAt`. It compares
`IsLastArrivalOfSailingDay` with `?? false`, making omitted and false equivalent.

## Current-Code Delta Table

| Current addition beyond old code | Keep/delete | Reason |
| --- | --- | --- |
| Final export block instead of inline `export const` | Keep | Current style guide prefers final export blocks; this does not add architecture or another surface. |
| Renamed comparator `areScheduledRowsEqual` | Delete | Restored the old `scheduledRowsEqual` helper name because it is clear and matches the old direct flow. |
| Strict optional comparison for `IsLastArrivalOfSailingDay` | Keep | Focused test covers omitted versus false as a visible stored shape. |
| Documentation for table-local reconciliation, skip behavior, `UpdatedAt`, and optional fields | Keep | These comments explain persistence semantics and are required for maintainability under the local style guide. |

## LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| `convex/functions/events/eventsScheduled/mutations.ts` | 81 | 84 | 86 |
| Focused scheduled mutation tests | 0 | 262 | 262 |

The updated implementation is not substantially different from either the old
flow or the current pre-stage flow. This entrypoint was already tight: it still
loads the sailing-day slice, deletes stale rows, inserts missing rows, replaces
changed rows, and skips unchanged rows. Stage 3 does not claim a meaningful LoC
reduction here; the only code-shape change is restoring the old
`scheduledRowsEqual` helper name while preserving current documentation and the
strict optional `IsLastArrivalOfSailingDay` comparison.

## Verification Run Or Blocker

```sh
bun test convex/functions/events/eventsScheduled/tests/upsertScheduledRowsForSailingDay.test.ts
```

Passed: 4 tests, 8 assertions.

## Recommendation

Keep the mutation as a direct table-local reconciliation loop. Further size
reduction should come from larger sync/domain paths, not by thinning useful
scheduled mutation documentation. Stage 3 is ready for review; no caller or
test scope expansion was needed.
