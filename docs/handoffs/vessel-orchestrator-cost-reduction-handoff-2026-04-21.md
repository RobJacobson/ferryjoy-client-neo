# Vessel Orchestrator Cost-Reduction Handoff

**Date:** 2026-04-21  
**Primary reference:** [`docs/engineering/vessel-orchestrator-cost-reduction-memo-2026-04-21.md`](../engineering/vessel-orchestrator-cost-reduction-memo-2026-04-21.md)

## 1. Purpose

This handoff is for the next agent or engineer implementing the immediate
Vessel Orchestrator cost-reduction refactor inside the current Convex backend.

Read the engineering memo first. This handoff intentionally avoids repeating
its full rationale.

## 2. Scope

The scope is **only** the near-term Convex cleanup path.

Do:

- reduce hot-path Convex function calls
- reduce hot-path database I/O
- preserve current product behavior as closely as possible
- keep the refactor inside the current Convex architecture

Do not:

- redesign the system around another platform
- evaluate Cloudflare, Redis, Railway, self-hosting, or other backend swaps
- introduce speculative infra changes unrelated to the immediate hot path

## 3. Required outcome

By the end of this refactor, the orchestrator hot path should be materially
closer to:

1. one action
2. one small orchestrator-owned read query
3. one targeted secondary read query if still necessary
4. one persistence mutation

Absolute perfection is not required in the first pass, but the refactor should
clearly move toward that shape.

## 4. Priorities

Implement in this order:

1. replace `getScheduleSnapshotForPing`
2. collapse write-path mutations
3. restrict predictions and timeline persistence to changed vessels
4. add a safety refresh path for live vessel rows
5. narrow `getOrchestratorModelData` only after the above are done

## 5. Implementation tasks

## Task 1: replace `getScheduleSnapshotForPing` with a compact schedule read model

Current problem:

- `getScheduleSnapshotForPing` returns a grouped blob of full `eventsScheduled`
  rows for the sailing day.
- In dev inspection this was about `233 KB` for `772` rows on one day.

Required direction:

- stop reading grouped raw schedule rows on every ping
- materialize a compact lookup-oriented read model when schedule data changes
- have the orchestrator read that compact structure instead

Likely implementation shape:

- add a new schedule snapshot table or compact schedule-state table
- populate it from schedule sync / schedule replacement flows
- store only what trip continuity needs, such as:
  - `scheduledDepartureBySegmentKey`
  - compact per-vessel ordered boundary metadata

Acceptance criteria:

- orchestrator no longer loads full grouped `eventsScheduled` rows on every ping
- schedule read payload is dramatically smaller than current snapshot size

## Task 2: collapse the hot write path into one internal mutation

Current problem:

- the action fans out into multiple child mutations for locations, trips,
  predictions, and timeline projection
- trip persistence also fans out inside `persistVesselTripWriteSet`

Required direction:

- build one orchestrator-owned persistence mutation that accepts one write set
- keep helper logic in plain TypeScript, but minimize Convex mutation
  boundaries

The new mutation should own, or directly orchestrate, persistence for:

- changed `vesselLocations`
- `vesselLocationsUpdates`
- trip completions
- active trip upserts
- depart-next actualization
- `vesselTripPredictions` proposals
- `eventsActual`
- `eventsPredicted`

Suggested name:

- `persistOrchestratorPing`
- or equivalent

Acceptance criteria:

- the top-level orchestrator action calls one primary persistence mutation
- separate hot-path calls to trip/event/prediction mutations are eliminated or
  materially reduced

## Task 3: only run prediction work for changed vessels

Current problem:

- predictions currently run against `trips.activeTrips`, not just changed rows
- compare-and-skip reduces writes but still pays read/compute/function costs

Required direction:

- identify the subset of vessels that materially changed in the current ping
- run prediction preload and prediction compute only for:
  - completed handoff replacement trips
  - materially changed active trips

Acceptance criteria:

- when trip state did not materially change for a vessel, that vessel is not
  included in prediction work
- if nothing changed, the prediction query and prediction persistence path are
  skipped entirely

## Task 4: gate timeline persistence on actual changes

Current problem:

- actual/predicted event projection mutations are separate hot-path calls
- they should not run when there is no useful work

Required direction:

- only build timeline persistence inputs for changed vessels / changed trip
  facts
- skip timeline persistence entirely when there are no actual or predicted
  event writes to persist

Acceptance criteria:

- unchanged pings do not call event projection mutations
- timeline write counts drop on steady-state pings

## Task 5: harden `vesselLocationsUpdates` with a periodic safety refresh

Current problem:

- the helper table is useful and should stay
- but we want a lightweight healing path if helper rows drift or get stale

Required direction:

- keep `vesselLocationsUpdates`
- add a simple fallback policy such as:
  - refresh all live vessel rows at least once per minute
  - or equivalent bounded full refresh

Acceptance criteria:

- helper-table dedupe remains the primary path
- a bounded periodic refresh exists so stale helper state cannot persist
  indefinitely

## 6. Optional follow-up after the main wins land

Only do this after Tasks 1-5 are complete and verified:

- narrow `getOrchestratorModelData` into a more purpose-built projection

This is explicitly lower priority than the schedule and write-path changes.

## 7. Files likely to change

Expected primary files:

- `convex/functions/vesselOrchestrator/actions.ts`
- `convex/functions/vesselOrchestrator/queries.ts`
- `convex/functions/vesselOrchestrator/persistVesselTripWriteSet.ts`
- `convex/functions/vesselLocationsUpdates/mutations.ts`
- `convex/functions/vesselTrips/mutations.ts`
- `convex/functions/events/eventsActual/mutations.ts`
- `convex/functions/events/eventsPredicted/mutations.ts`
- `convex/functions/predictions/queries.ts`
- `convex/schema.ts`

Likely additional files:

- schedule sync or schedule persistence files that currently own
  `eventsScheduled` population
- new compact schedule snapshot module(s)

## 8. Constraints

- preserve current functional behavior as closely as possible
- do not reintroduce many child `runQuery` calls from the action
- do not solve this by pushing reads back down into many child concerns
- prefer a few orchestrator-owned projections over both extremes:
  - not one giant blob
  - not many tiny hook-like reads

## 9. Testing expectations

At minimum, verify:

- unchanged pings skip more work than before
- changed location pings still update live rows correctly
- trip rollover behavior is unchanged
- prediction outputs remain correct for changed trips
- actual/predicted event projections remain correct
- schedule continuity remains correct for docked vessels

Measure after refactor if possible:

- per-ping payload size for the schedule read model
- number of Convex function calls triggered by one orchestrator ping
- number of downstream mutation invocations on steady-state pings

## 10. Definition of done

This work is done when all of the following are true:

- `getScheduleSnapshotForPing` is replaced or materially narrowed
- hot-path write fan-out is substantially collapsed
- prediction work runs only for changed vessels
- timeline persistence is skipped on unchanged pings
- `vesselLocationsUpdates` remains in place with a simple safety refresh path
- the code clearly trends toward the intended hot-path shape described in the
  engineering memo

## 11. Reference

- [`docs/engineering/vessel-orchestrator-cost-reduction-memo-2026-04-21.md`](../engineering/vessel-orchestrator-cost-reduction-memo-2026-04-21.md)
