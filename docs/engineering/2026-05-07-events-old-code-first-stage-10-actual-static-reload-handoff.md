# Events Old-Code-First Stage 10 Actual Static Reload Handoff

## Status

Stage 10 is ready for a plan-first implementation.

## Assignment

Stage 10 covers the actual static reload path.

The worker must produce a plan first. No production code edits are allowed until
the orchestrator or owner approves that plan.

The plan must start from `events-old-reference`, trace the old actual reload
behavior, and then decide whether to implement a reduction now or report a
blocker for the later sync/reload stages.

## Required Reading

- `docs/engineering/2026-05-06-events-old-code-first-size-reduction-prd.md`
- `.cursor/rules/code-style.mdc`
- `docs/convex_rules.mdc`
- this handoff

Do not use `events-current-reference` unless the owner explicitly requests
archaeology.

## Scope

Allowed implementation paths after plan approval:

- `convex/domain/events/reload.ts`
- `convex/functions/events/sync/mutations.ts`, actual reload path only
- focused tests for actual reload behavior
- stage log and this handoff

Out of scope:

- sync actions, cron window runners, operator actions, fetch slice builders, and
  broad reload schema reshaping
- predicted event projection
- realtime `updateEvents`
- Stage 8 `replaceActualRowsForSailingDay` behavior, except tests that protect
  it

If actual reload cannot be simplified without touching out-of-scope sync/reload
architecture, stop and report that as the Stage 10 result.

## Old-Code-First Requirement

The plan must trace the old actual reload flow from `events-old-reference`.
That old flow is the baseline. The worker is not simplifying the current code
by shaving it down; the worker is rebuilding from the old behavior and adding
only what current requirements force. Any code beyond the old baseline needs a
damn good reason, and that reason must be specific enough for the orchestrator
or owner to reject.

Use old paths such as:

- `convex/domain/timelineReseed/hydrateWithHistory.ts`
- `convex/domain/timelineReseed/buildReseedTimelineSlice.ts`
- `convex/domain/timelineReseed/reconcileLiveLocations.ts`
- `convex/domain/timelineReseed/mergeActualDockWritesIntoRows.ts`
- related old tests under `convex/domain/timelineReseed/tests`

Do not use a broad summed LoC total as permission to keep the current
`reload.ts` shape. The old files are behavior references. The worker must
identify which pieces of that old behavior are still required and which current
code exists only because of the newer architecture.

## Plan Required Before Code

The worker must return a pre-edit plan with:

1. Old actual reload flow summary.
2. Old files and raw LoC per file.
3. Current actual reload call graph.
4. Current raw LoC for `reload.ts` and touched tests.
5. Functions and types proposed to keep, with reasons.
6. Functions and types proposed to delete, merge, inline, or defer.
7. Imports expected to break.
8. Whether the right outcome is implementation now or a blocker for Stages
   17-19.
9. Projected final raw LoC, but only as a consequence of the plan, not as the
   plan's purpose.

The orchestrator or owner must approve the plan before implementation starts.

## Rejected Success Criteria

The following are not valid Stage 10 success arguments:

- `reload.ts` is below a local cap.
- production LoC decreased by a small amount.
- tests pass.
- an option flag avoids some wasted work but leaves the oversized architecture
  intact.
- a second actual-only path or mode was added and described as clearer.
- old multi-file LoC was summed to make the current mega-file look reasonable.

If the result is still substantially larger than the old actual reload flow,
the worker must explain exactly which current requirements justify the extra
code.

## Acceptance Criteria

Stage 10 may be accepted only if one of these is true:

1. The worker produces a blocker report and no production edits, explaining why
   actual static reload should wait for holistic sync/reload reduction.
2. The worker implements an approved plan that removes or merges meaningful
   reload code and keeps behavior.
3. The owner explicitly approves a correctness or measured performance trade
   that is not claimed as size reduction.

Adding an `includeScheduledRows` option, a parallel actual-only builder, or a
new exported reload mode is presumed wrong unless it deletes more code than it
adds and is required by a live caller.

## Live Behavior To Preserve

- Actual reload rows must still flow through `buildActualDockEventFromWrite`.
- `replaceActualRowsForSailingDay` must still preserve absent physical-only rows
  through `preserveAbsentTripKeys`.
- Static reload must not rebuild predicted rows.
- Scheduled vs actual sync mutation behavior should not be changed unless the
  approved plan explicitly owns that change.

## Verification After Approved Implementation

Run focused tests relevant to the approved changes. Expected commands usually
include:

```sh
bun test convex/domain/events/tests/reload.test.ts
bun test convex/functions/events/sync/tests/reloadMutations.test.ts
bun test convex/functions/events/eventsActual/tests/upsertActualDockRows.test.ts
```

If implementation proceeds and the branch is otherwise typecheckable, run:

```sh
bun run convex:typecheck
bun run type-check
bun run check
```

If no implementation proceeds because the correct result is a blocker report,
state that clearly and do not run broad checks merely to create noise.

## Stage Result

### Plan

Stage 10 result: Acceptance Criteria #1 from this handoff — a plan-only
blocker report. No production edits to `convex/domain/events/reload.ts`,
`convex/functions/events/sync/mutations.ts`, or focused tests. Defer
meaningful actual static reload reduction to Stages 17-19, where sync action
wiring, fetch slice builders, and reload payload schemas can be considered
together.

#### Why this is the right outcome

Within Stage 10's allowed scope, the current static reload domain code is not
meaningfully larger than the old comparable reseed baseline. Inlining trivial
helpers (`strongDeparture`, `strongArrival`, `locationMatchesSailingDay`,
`arrivalEligibilityTime`, `dedupeActualRowsByEventKey`, `groupBy`) would yield
roughly 30-50 LoC at best with no behavior change. This handoff and the PRD
both reject that as success:

- "Adding an `includeScheduledRows` option, a parallel actual-only builder, or
  a new exported reload mode is presumed wrong unless it deletes more code
  than it adds and is required by a live caller."
- "Tiny reductions to a still-overgrown file are failures."
- "If actual reload cannot be simplified without touching out-of-scope
  sync/reload architecture, stop and report that as the Stage 10 result."

Real reduction levers are all out of scope:

- collapse the numeric `ConvexReloadDockScheduleSegment` /
  `ConvexReloadDockHistoryRecord` payloads (would touch reload schemas + sync
  actions).
- move history hydration back to the action layer like the old flow (sync
  actions / fetch slice builders, Stages 17-19).
- delete the scheduled-only `replaceScheduledDockEventsForSailingDay` path and
  its `buildReloadScheduledDockRows` (Stage 19 sync internal mutation work).
- collapse `buildReloadDockEventRows` and `buildReloadScheduledDockRows` into
  a single shared seed/normalize core (touches scheduled reload, out of
  scope).

#### Old actual reload flow (events-old-reference)

Sequence used by the old static reseed for one sailing day:

1. Sync action `reseedVesselTimelineForDate` fetches and transforms schedule
   plus history.
2. `buildSeedVesselTripEventsFromRawSegments` creates scheduled boundary
   records.
3. `hydrateSeededEventsWithHistory` merges WSF history actuals into those
   boundary records.
4. Internal mutation `reseedBoundaryEventsForSailingDay` runs
   `runReseedBoundaryEventsForSailingDay`.
5. `buildReseedTimelineSlice` produces scheduled rows and actual rows
   together, given trip indexes and live locations.
6. Scheduled rows upsert as the complete sailing-day truth; actual rows
   replace the actual slice while preserving physical-only evidence.

Key property: schedule fetch, seed, and history hydration happen in the
action layer; only normalized event records cross the action-to-mutation
boundary. Schedule and actual rows are produced together by one slice
builder.

Old raw LoC for the comparable static reseed slice:

| Old file | LoC |
| --- | ---: |
| `domain/timelineReseed/seedScheduledEvents.ts` | 234 |
| `domain/timelineReseed/hydrateWithHistory.ts` | 229 |
| `domain/timelineReseed/buildReseedTimelineSlice.ts` | 142 |
| `domain/timelineReseed/normalizeEventRecords.ts` | 101 |
| `domain/timelineReseed/reconcileLiveLocations.ts` | 450 |
| `domain/timelineReseed/scheduleDepartureLookup.ts` | 30 |
| `domain/timelineReseed/mergeActualDockWritesIntoRows.ts` | 46 |
| Old reseed slice total | 1,232 |

Action and mutation glue files such as
`runReseedBoundaryEventsForSailingDay.ts` are excluded here because they live
in current sync mutation/action wiring, not in `domain/events/reload.ts`.

#### Current actual reload call graph

Sequence used by the current static actual reload:

1. Sync action `runReloadDockEventsForSailingDay` fetches schedule and
   history, then calls the actual-reload internal mutation.
2. `reloadActualDockEventsForSailingDay` in
   `convex/functions/events/sync/mutations.ts` queries `vesselsIdentity`,
   `terminalsIdentity`, `loadTripIndexesForSailingDay`, and `vesselLocations`.
3. `buildReloadDockEventRows` in `convex/domain/events/reload.ts` runs
   `buildScheduledDockEventRecords`, `hydrateDockEventRecordsWithHistory`,
   `normalizeScheduledDockSeams`, then both
   `buildScheduledDockEvents` (unused by the actual path) and
   `buildActualDockEvents` plus `buildPhysicalOnlyActualRowsFromTrips`,
   followed by `buildLiveLocationActualRows` and
   `dedupeActualRowsByEventKey`.
4. `replaceActualRowsForSailingDay` persists actual rows with the
   `preserveAbsentTripKeys` set derived from physical-only trip TripKeys.

Current raw LoC (Stage 10 scope):

| Current file | LoC |
| --- | ---: |
| `convex/domain/events/reload.ts` | 1,142 |
| `convex/functions/events/sync/mutations.ts` | 132 |
| `convex/domain/events/tests/reload.test.ts` | 127 |
| `convex/functions/events/sync/tests/reloadMutations.test.ts` | 102 |

Conclusion: 1,142 vs 1,232 — within roughly 7% of old comparable code, even
though the current implementation also performs schedule seeding, history
hydration, and segment-key resolution from numeric payloads inside the
mutation layer that the old flow handled in the action layer.

#### Live behavior to preserve

Confirmed already preserved; this blocker outcome does not change any of the
following:

- Actual reload rows flow through `buildActualDockEventFromWrite` in
  `convex/domain/events/actual.ts`.
- `replaceActualRowsForSailingDay` in
  `convex/functions/events/eventsActual/mutations.ts` preserves absent
  physical-only rows via `preserveAbsentTripKeys` (Stage 5/8 contract).
- Static reload does not rebuild predicted rows.
- Scheduled vs actual sync mutation behavior unchanged.

#### Keep / delete / defer table

Within Stage 10 scope, all current code maps to live behavior; no
Stage-10-local deletions clear the PRD bar.

| Function or type in `domain/events/reload.ts` | Decision | Reason |
| --- | --- | --- |
| `buildReloadDockEventRows` (entrypoint) | Keep | Sole live caller is the actual-reload mutation. |
| `buildReloadScheduledDockRows` | Keep, defer | Used by Stage-3 scheduled reload mutation, out of scope here. Belongs to a later sync/reload reduction. |
| `buildScheduledDockEventRecords` | Keep | Required seed step matching old `buildSeedVesselTripEventsFromRawSegments`. |
| `hydrateDockEventRecordsWithHistory` plus `getHistoryActualsByEventKey`, `normalizeHistoryRecordStrict`, `createSeededScheduleSegmentResolver` | Keep | Required hydration matching old `hydrateSeededEventsWithHistory`; lives here only because hydration moved into the mutation layer when payloads became numeric. Returning hydration to the action layer is a Stages 17-19 change. |
| `buildScheduledDockEvents` called from `buildReloadDockEventRows` | In-scope candidate, deferred | Production actual-reload caller does not consume `scheduledRows`/`scheduledCount`, but removing the call requires either splitting the function (presumed wrong by handoff) or changing the result shape (still requires test rewrite for marginal LoC). Note as future cleanup, do not act on it as Stage 10 success. |
| `buildActualDockEvents`, `buildPhysicalOnlyActualRowsFromTrips`, `buildLiveLocationActualRows`, `buildActualDockWritesFromLocation`, `buildActualWriteFromLocation`, `buildPhysicalOnlyPatchesFromLocation` | Keep | Direct mappings of old `reconcileLiveLocations.ts` and `buildReseedTimelineSlice.ts` actual-row construction onto current `eventsActual` schema (TripKey-only, no `ScheduleKey`). |
| `indexTripsBySegmentKey`, `indexActiveTripsByVesselAbbrev` | Keep | Required by `convex/functions/events/sync/loadTripIndexesForSailingDay.ts` physical-only TripKey context. |
| `normalizeScheduledDockSeams`, `sortDockBoundaryEventRecords`, `getEventTypeOrder`, `isIdenticalScheduledDockSeam`, `getNextTerminalAbbrev`, `getLastArrivalKey`, `dedupeActualRowsByEventKey`, `groupBy`, `mergeActualTime`, `arrivalEligibilityTime`, `strongDeparture`, `strongArrival`, `locationMatchesSailingDay`, `getLocationAnchoredEvent`, `findArrivalEventForLocation`, `normalizeScheduledArrivalTime`, `getOfficialScheduledArrivalTime`, `toAdapterScheduleSegment`, `toAdapterHistoryRecord` | Keep | All have direct old-flow analogues. Inlining the small predicates would save ~30-50 LoC with style-rule TSDoc cost roughly equal — not a meaningful reduction. |

#### Imports expected to break

None. No production edits.

#### Projected final raw LoC

`convex/domain/events/reload.ts`: 1,142 → 1,142 (no change). Reported only as
a consequence of the plan, not the plan's purpose.

#### In-scope future-cleanup observation (do not action in Stage 10)

`buildReloadDockEventRows` builds and returns `scheduledRows` and
`scheduledCount` (via `buildScheduledDockEvents` over normalized events plus
`lastArrivalKey` computation), but the only production caller —
`reloadActualDockEventsForSailingDayRows` in
`convex/functions/events/sync/mutations.ts` — destructures only `actualRows`
and `actualCount`. The unused work is small (roughly 25 LoC of execution
path) and removing it cleanly probably requires either a new mode (presumed
wrong) or coordinated changes with `buildReloadScheduledDockRows` and the
scheduled mutation (out of scope). Recorded for later Stages 17-19 work; not
claimed as Stage 10 success.

### Outcome

Blocker reported. No production edits made. The current
`convex/domain/events/reload.ts` is roughly 7% smaller than the comparable
old `vesselTimeline` / `timelineReseed` reseed slice (1,142 vs 1,232 raw
LoC), and the remaining levers for meaningful reduction are all explicitly
out of Stage 10 scope: numeric reload payload collapse, returning hydration
to the action layer, deletion of the scheduled-only reload entrypoint, and
unification of the scheduled and actual reload builders. Stage 10
documentation deliverables are this filled-in handoff plus the matching
Stage 10 row update in
`docs/engineering/2026-05-06-events-old-code-first-stage-log.md`.

Verification not run, per the handoff guidance against running broad checks
to create noise when the result is a blocker report.
