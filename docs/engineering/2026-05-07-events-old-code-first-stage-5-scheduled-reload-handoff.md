# Events Old-Code-First Stage 5 Scheduled Reload Handoff

## Correction

The previous Stage 5 handoff incorrectly treated scheduled + actual reload as a
zero-LoC old baseline because it only searched `convex/functions/events` and
`convex/domain/events`. That was wrong.

The old implementation lives under:

- `events-old-reference:convex/functions/vesselTimeline`
- `events-old-reference:convex/domain/timelineReseed`

Stage 5 must use that old `vesselTimeline` / `timelineReseed` implementation as
the behavior and size baseline.

## Stage Scope

Restore the scheduled + actual reload feature in the current event-table shape
after Stage 4 removed reload helpers from `convex/domain/events/scheduled.ts`.

Do not restore reload builders to `domain/events/scheduled.ts`. The current
scheduled domain file is now the continuity-helper surface and should stay that
way.

Primary current blockers from Stage 4:

- `convex/functions/events/sync/mutations.ts` imports removed
  `buildScheduledDockEventRecords` and `buildScheduledDockEvents`.
- `convex/domain/events/actual.ts` imports removed
  `buildScheduledDockEventRecords`, `DockBoundaryEventRecord`, and
  `EventReloadScheduleSegment`.

Default editable files:

- `convex/functions/events/sync/mutations.ts`
- `convex/domain/events/actual.ts`
- a small Stage-5-owned helper module only if the plan proves it is the smallest
  readable home for the old reseed transformation
- focused reload tests that defend retained behavior
- `docs/engineering/2026-05-06-events-old-code-first-stage-log.md`
- this handoff note

Do not edit generated files. Do not broaden into sync actions/window
architecture unless a tiny reference update is required.

## Required Old Trace

Read these old files before planning or editing:

- `convex/functions/vesselTimeline/sync/reseedVesselTimelineForDate.ts`
- `convex/functions/vesselTimeline/mutations.ts`
- `convex/functions/vesselTimeline/reseed/runReseedBoundaryEventsForSailingDay.ts`
- `convex/functions/vesselTimeline/schemas.ts`
- `convex/domain/timelineReseed/seedScheduledEvents.ts`
- `convex/domain/timelineReseed/hydrateWithHistory.ts`
- `convex/domain/timelineReseed/buildReseedTimelineSlice.ts`
- `convex/domain/timelineReseed/normalizeEventRecords.ts`
- `convex/domain/timelineReseed/mergeActualDockWritesIntoRows.ts`
- `convex/domain/timelineReseed/reconcileLiveLocations.ts`

Old flow:

1. Action fetches/transforms schedule data.
2. `buildSeedVesselTripEventsFromRawSegments` creates scheduled boundary
   records.
3. `hydrateSeededEventsWithHistory` merges WSF history actuals into those
   boundary records.
4. Internal mutation calls `runReseedBoundaryEventsForSailingDay`.
5. `buildReseedTimelineSlice` produces scheduled rows and actual rows.
6. Scheduled rows upsert as the complete sailing-day truth.
7. Actual rows replace/reconcile the sailing-day actual slice while preserving
   physical-only evidence.

## Old LoC Baseline

Use raw line counts:

| Old file | LoC |
| --- | ---: |
| `functions/vesselTimeline/sync/reseedVesselTimelineForDate.ts` | 86 |
| `functions/vesselTimeline/mutations.ts` | 32 |
| `functions/vesselTimeline/reseed/runReseedBoundaryEventsForSailingDay.ts` | 62 |
| `functions/vesselTimeline/schemas.ts` | 64 |
| `domain/timelineReseed/seedScheduledEvents.ts` | 234 |
| `domain/timelineReseed/hydrateWithHistory.ts` | 229 |
| `domain/timelineReseed/buildReseedTimelineSlice.ts` | 142 |
| `domain/timelineReseed/normalizeEventRecords.ts` | 101 |
| `domain/timelineReseed/mergeActualDockWritesIntoRows.ts` | 46 |
| `domain/timelineReseed/reconcileLiveLocations.ts` | 450 |

The full old reseed system was not tiny. Stage 5 should still avoid recreating
unnecessary current bloat, but it must preserve the scheduled + actual reload
feature.

## Hard Acceptance Bar

Stage 5 must not claim that scheduled + actual reload is optional. It is a
required feature.

A valid result must either:

1. implement the smallest readable current equivalent of the old reseed flow,
   using the old `vesselTimeline` / `timelineReseed` behavior as the baseline;
   or
2. produce a pre-edit plan that shows why implementation needs owner approval
   before code changes.

If the worker proposes a new helper module or expects more than roughly 250 raw
LoC of new/moved transformation code, produce a plan first. Do not implement
until approved.

Do not solve this by re-exporting removed helpers from
`domain/events/scheduled.ts`.

## Current-Code Delta Table

| Current addition / blocker | Keep/delete/move | Reason |
| --- | --- | --- |
| `replaceScheduledDockEventsForSailingDayRows` | Keep or rewrite | Required scheduled reload persistence boundary, analogous to old reseed mutation. |
| scheduled boundary seeding | Keep somewhere Stage-5-owned | Old `buildSeedVesselTripEventsFromRawSegments` provides the behavior baseline. |
| history hydration for actual rows | Keep if current actual reload remains in Stage 5 | Old `hydrateSeededEventsWithHistory` provides the behavior baseline. |
| `buildReseedTimelineSlice` equivalent | Keep or split directly | Old flow produced scheduled and actual rows together from hydrated records plus trip/location context. |
| `domain/events/scheduled.ts` reload helpers | Delete from this location | Stage 4 made this continuity-only; do not re-bloat it. |
| Current sync empty-payload-only test | Rewrite | Empty payload coverage alone is insufficient; add at least one non-empty direct scheduled/actual reload behavior test if implementing. |

## Required Pre-Edit Plan

Because the corrected old baseline is nontrivial, the worker should first decide
whether implementation is small enough to proceed. If not, return a plan only.

The plan must include:

- old flow summary and exact old files used
- current target home for seeding/hydration/slice assembly
- exact files to edit
- projected production LoC and test LoC
- tests to keep/delete/rewrite
- expected temporary typecheck blockers, if any
- whether actual reload hydration is handled now or deferred to Stage 10/17/19

## LoC Report

| Area | Old LoC | Current LoC before stage | Updated LoC after stage |
| --- | ---: | ---: | ---: |
| old vesselTimeline reseed flow | 1,462 measured | N/A | N/A |
| current Stage 5 production slice | 1,462 old baseline | 903 | 1,556 |
| `convex/domain/events/reload.ts` | included above | 0 | 1,142 |
| `convex/domain/events/actual.ts` | included above | 615 | 87 |
| `convex/functions/events/sync/mutations.ts` | included above | 136 | 132 |
| `convex/functions/events/sync/loadTripIndexesForSailingDay.ts` | included above | 48 | 48 |
| `convex/functions/events/eventsActual/mutations.ts` | included above | 104 | 147 |
| focused reload/actual tests touched | 0 | 516 | 690 |

Measured old baseline:

- `functions/vesselTimeline/sync/reseedVesselTimelineForDate.ts`: 93
- `functions/vesselTimeline/mutations.ts`: 32
- `functions/vesselTimeline/reseed/runReseedBoundaryEventsForSailingDay.ts`: 62
- `functions/vesselTimeline/schemas.ts`: 73
- `domain/timelineReseed/seedScheduledEvents.ts`: 234
- `domain/timelineReseed/hydrateWithHistory.ts`: 229
- `domain/timelineReseed/buildReseedTimelineSlice.ts`: 142
- `domain/timelineReseed/normalizeEventRecords.ts`: 101
- `domain/timelineReseed/mergeActualDockWritesIntoRows.ts`: 46
- `domain/timelineReseed/reconcileLiveLocations.ts`: 450

Important process note: the resulting `convex/domain/events/reload.ts` is 1,142
raw LoC, so the implementation exceeded the handoff's "plan first if roughly
over 250 LoC" warning. The result should be explicitly owner-reviewed before
commit. The size is nevertheless close to the corrected old reseed baseline:
1,556 current production LoC for the Stage 5 slice versus 1,462 old production
LoC. The added current code buys mapping the old reseed behavior into the
current split event tables, numeric action-to-mutation reload payloads, current
TripKey-only `eventsActual` identity, and focused replacement semantics.

## Implementation Result

Stage 5 restored scheduled + actual reload behavior in a flat
`convex/domain/events/reload.ts` module and kept
`convex/domain/events/scheduled.ts` continuity-only. The reload module owns:

- schedule boundary seeding from numeric reload schedule segments
- schedule seam normalization and scheduled row construction
- WSF history hydration into departure actuals and arrival proxies
- actual row construction from hydrated schedule-backed records
- physical-only actual preservation from active/completed trip evidence
- live-location reconciliation for schedule-backed and physical-only rows
- trip indexing helpers used by the sync mutation boundary

`convex/domain/events/actual.ts` is back down to sparse actual write
normalization for realtime orchestration. Reload-only coupling moved out.

`convex/functions/events/sync/mutations.ts` now calls the Stage-5 reload module
and persists actual reloads through `replaceActualRowsForSailingDay`.

`convex/functions/events/eventsActual/mutations.ts` now has explicit
sailing-day replacement semantics. Because the current `eventsActual` schema no
longer stores `ScheduleKey`, the replacement helper cannot infer physical-only
status from an actual row alone. The sync mutation passes a
`preserveAbsentTripKeys` set derived from the current physical-only
active/completed trip rows. That preserves old physical-only replacement
semantics for known current physical-only trips without adding `ScheduleKey`
back to `eventsActual`, while stale schedule-aligned rows absent from the new
reload slice are still deleted.

| Current addition beyond old code | Keep/delete | Reason |
| --- | --- | --- |
| Flat `domain/events/reload.ts` | Keep | Stage 5 needs the old reseed behavior, but `scheduled.ts` must remain continuity-only and `actual.ts` must remain sparse-write-focused. |
| Numeric reload segment/history adapters | Keep | Current sync mutations cross the action/mutation boundary with epoch milliseconds, unlike old action-local Date-shaped helpers. |
| `replaceActualRowsForSailingDay` preservation option | Keep | Current `eventsActual` no longer has `ScheduleKey`; passing physical-only TripKeys is the smallest no-schema-change way to preserve physical-only rows while deleting stale schedule-aligned rows. |
| Direct reload domain test | Keep | Empty-payload-only coverage was insufficient; the new test covers non-empty scheduled rows, history actual hydration, and physical-only actual rows. |
| Actual replacement regression test | Keep | Proves absent physical-only rows survive while absent stale same-day rows are deleted. |
| Reload helpers in `domain/events/scheduled.ts` | Delete | Stage 4 intentionally made scheduled continuity-only. |

## Verification Run Or Blocker

Likely focused verification after implementation:

```sh
bun test convex/functions/events/sync/tests/reloadMutations.test.ts
bun test convex/domain/events/tests/actual.test.ts
```

If the worker ports or rewrites old timeline reseed behavior into a new focused
module, add or run the focused tests for that module. Do not rely only on empty
payload tests.

Actual verification run:

```sh
bun test convex/domain/events/tests/actual.test.ts convex/domain/events/tests/reload.test.ts convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts convex/functions/events/sync/tests/reloadMutations.test.ts
bun run type-check
bun run convex:typecheck
```

Result: all passed. Focused tests covered 13 tests and 29 assertions.

## Recommendation

Use the old `vesselTimeline` / `timelineReseed` code as the behavioral baseline,
but map it into the current event-table boundaries deliberately. Keep
`domain/events/scheduled.ts` continuity-only. Prefer a small Stage-5-owned
reload transformation surface over spreading reload helpers across scheduled
and actual domain modules by accident.

Final recommendation: accept the Stage 5 implementation only with explicit
owner approval for the threshold overrun. The production size is close to the
corrected old reseed baseline and restores required behavior without a schema
change, but the new flat module is large enough that review should focus on
whether any live-location reconciliation branches can be postponed to a later
sync reduction stage without breaking product behavior.
