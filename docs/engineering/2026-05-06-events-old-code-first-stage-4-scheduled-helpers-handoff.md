# Events Old-Code-First Stage 4 Scheduled Helpers Handoff

## Result

Stage 4 reduced `convex/domain/events/scheduled.ts` from the 500-line current
file to the old scheduled type contract plus only the live continuity helpers:

- `DockEventType`
- `ConvexScheduledDockEvent`
- `ConvexInferredScheduledSegment`
- `inferScheduledSegmentFromDepartureEvent`
- `findNextDepartureEvent`

Private support is limited to segment-key extraction, boundary-time fallback,
and a deterministic scheduled-row comparator. Reload row construction was
removed/deferred as required.

## LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| `convex/domain/events/scheduled.ts` | 37 | 500 | 139 |
| Focused scheduled domain tests | 0 | 121 | 107 |

The updated production file is substantially longer than the old 37-line
contract because live vessel-trip callers require two continuity helpers that
did not exist in the old baseline. The extra 102 lines buy typed helper inputs,
the inferred segment return shape, deterministic departure selection, and the
project-required TSDoc/module documentation around the kept behavior. The file
lands inside the approved 80-140 line target.

## Delta Table

| Current addition beyond old code | Keep/delete/defer | Reason |
| --- | --- | --- |
| `DockEventType` | Keep | Old baseline had this type contract. |
| `ConvexScheduledDockEvent` | Keep | Old baseline had this persisted row contract; helpers and tests use the same shape structurally as the table schema. |
| `ConvexInferredScheduledSegment` | Keep | Old baseline had this type, and vessel-trip schedule resolution imports it. |
| `inferScheduledSegmentFromDepartureEvent` | Keep | Live callers infer trip continuity from a known departure row in `vesselTripScheduleQueries.ts` and schedule fallback logic. |
| `findNextDepartureEvent` | Keep | Live fallback path selects the next departure from current and next sailing-day pools. |
| `getSegmentKeyFromBoundaryKey` | Keep private | Required to map dep-dock boundary keys back to segment keys for inferred continuity. |
| `getBoundaryTime` | Keep private | Preserves current behavior of preferring boundary-specific scheduled time and falling back to scheduled departure. |
| Deterministic scheduled-row comparator | Keep private | Required so `findNextDepartureEvent` chooses the earliest matching departure independent of input ordering. |
| `buildScheduledDockEventRecords` | Defer to Stage 5 | Reload row-construction seed logic, not Stage 4 continuity helper logic. Current sync and actual reload imports are blockers. |
| `buildScheduledDockEvents` | Defer to Stage 5 | Builds persisted reload rows and belongs to scheduled reload row construction. |
| `DockBoundaryEventRecord` and `EventReloadScheduleSegment` | Defer to Stage 5 | Current use is reload construction and actual reload hydration, not continuity helpers. |
| Raw seed segment builders | Delete/defer | Implementation details of reload construction. |
| Seam normalization | Delete/defer | Implementation detail of reload construction. |
| Official arrival-time fallback logic | Delete/defer | Implementation detail of reload construction and explicitly out of Stage 4. |
| Reload-builder test | Delete/defer | The `buildScheduledDockEvents` test defended the removed Stage 5 surface. |
| Continuity helper test | Keep/rewrite | Protects the live segment inference behavior. |
| `findNextDepartureEvent` behavior test | Keep | Small focused test for terminal filtering, departure-only filtering, and earliest-match selection. |

## Verification

Focused verification passed:

```sh
bun test convex/domain/events/tests/scheduled.test.ts
```

Result: 2 tests passed.

Broad typecheck was intentionally not run because the removed reload exports are
known Stage 5 blockers.

## Expected Blockers

Removing the deferred reload exports leaves these expected unresolved imports:

- `convex/functions/events/sync/mutations.ts` imports
  `buildScheduledDockEventRecords` and `buildScheduledDockEvents`.
- `convex/domain/events/actual.ts` imports `buildScheduledDockEventRecords`,
  `DockBoundaryEventRecord`, and `EventReloadScheduleSegment`.
- `convex/_generated/api.d.ts` still references older generated modules under
  `domain/events/scheduled/...`; generated files were not edited.

The scheduled domain test no longer imports reload builders.

## Recommendation

Treat Stage 4 as complete. Stage 5 should resolve scheduled reload row
construction explicitly instead of restoring it to the continuity-helper module
for compatibility. The actual reload path should either receive its own minimal
Stage 5-owned schedule-boundary contract or be deferred until the sync/actual
reload stages decide whether that code still belongs in the reduced event
surface.
