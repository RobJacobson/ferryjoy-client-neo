# VesselTimeline Root Cause Memo: KIT Timeline Crossed Signals on 2026-04-12

Date prepared: 2026-04-12  
Prepared in response to: `KIT` / VesselTimeline incorrect active interval and future actual event on the morning of `2026-04-12`

Related documents:

- [docs/handoffs/iss-forensic-report-2026-04-11.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/handoffs/iss-forensic-report-2026-04-11.md)
- [convex/domain/vesselTimeline/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md)
- [docs/convex-mcp-cheat-sheet.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/convex-mcp-cheat-sheet.md)
- [src/features/VesselTimeline/docs/ARCHITECTURE.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md)
- [convex/functions/vesselOrchestrator/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/README.md)
- [convex/functions/vesselTrips/updates/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/README.md)

Relevant code:

- [convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts)
- [convex/shared/effectiveTripIdentity.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/effectiveTripIdentity.ts)
- [convex/functions/eventsScheduled/dockedScheduleResolver.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsScheduled/dockedScheduleResolver.ts)
- [convex/functions/eventsScheduled/queries.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsScheduled/queries.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts)
- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)
- [convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts)
- [convex/functions/eventsActual/mutations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsActual/mutations.ts)
- [convex/domain/vesselTimeline/timelineEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/timelineEvents.ts)
- [convex/shared/activeTimelineInterval.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/activeTimelineInterval.ts)
- [convex/functions/vesselTimeline/mutations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/mutations.ts)
- [convex/domain/vesselTimeline/events/history.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/events/history.ts)
- [convex/domain/vesselTimeline/events/reconcile.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/events/reconcile.ts)
- [convex/domain/vesselTimeline/events/liveUpdates.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/events/liveUpdates.ts)
- [convex/shared/tripIdentity.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/tripIdentity.ts)

## Executive Summary

The `KIT` VesselTimeline problem observed around `11:12 AM` to `11:13 AM PDT` on `2026-04-12` was caused by a bad persisted backend actual event, not by the frontend inventing the wrong state.

The core bad fact was:

- `eventsActual.Key = KIT--2026-04-12--11:40--FAU-SOU--dep-dock`
- `eventsActual.EventActualTime = 2026-04-12 09:58:32 AM PDT`

That future departure actual should not exist. Once it existed, the rest of the system behaved consistently with poisoned data:

- the `11:40 AM To: SOU` row displayed `9:58 AM actual`
- the active-interval logic treated that future departure as already completed
- the client derived the wrong current interval and therefore misplaced the indicator

The raw vessel feed and `vesselLocationsHistoric` do not support that future event. Around `09:58 AM`, the vessel was correctly on `09:55 FAU -> VAI`, and around `11:12 AM`, the vessel correctly departed on `11:10 VAI -> FAU`.

The strongest current hypothesis is that a transient noisy dock-state tick caused the trip lifecycle pipeline to lose trust in the current docked trip owner, then the heuristic schedule resolver selected the wrong same-terminal future sailing (`11:40 FAU -> SOU`), and the real departure actual was later projected onto that wrong future key.

## What The User Saw

At approximately `11:12 AM` to `11:13 AM PDT`, the timeline UI showed two incorrect things:

1. The vessel indicator should have been just after the `11:10 AM VAI -> FAU` departure, but the active interval appeared inconsistent.
2. The `11:40 AM FAU -> SOU` row showed `9:58 AM actual`, even though that departure had not happened.

The screenshots showed:

- `11:10 AM To: FAU` with an approximate/current state around `11:13 AM`
- `11:40 AM To: SOU` incorrectly showing `9:58 AM actual`

This created crossed signals: the live vessel card/position implied the vessel was on the `11:10` sailing, while the timeline backbone implied the `11:40` departure had already occurred.

## Architecture Context

Per [convex/domain/vesselTimeline/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md) and [src/features/VesselTimeline/docs/ARCHITECTURE.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md):

- the backend timeline backbone is built from:
  - `eventsScheduled`
  - `eventsActual`
  - `eventsPredicted`
- the client derives the active interval from that backbone using actual-only semantics
- the client then combines that interval with live `VesselLocation`

That means the client can only be as correct as the merged event backbone. If a future `dep-dock` event gets an `EventActualTime`, the client will legitimately believe that future boundary already occurred.

## Convex Data Collected

Convex was inspected using the MCP workflow described in [docs/convex-mcp-cheat-sheet.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/convex-mcp-cheat-sheet.md), against the dev deployment on `2026-04-12`.

### Current Live `KIT` Location Around 11:13 AM PDT

At the time of investigation, `functions/vesselLocation/queries.getByVesselAbbrev("KIT")` returned a live row equivalent to:

| Field | Value |
| --- | --- |
| `VesselAbbrev` | `KIT` |
| `AtDock` | `false` |
| `DepartingTerminalAbbrev` | `VAI` |
| `ArrivingTerminalAbbrev` | `FAU` |
| `ScheduledDeparture` | `2026-04-12 11:10:00 AM PDT` |
| `LeftDock` | `2026-04-12 11:12:09 AM PDT` |
| `Key` | `KIT--2026-04-12--11:10--VAI-FAU` |
| `Speed` | `17.3` |
| `DepartingDistance` | `1.8 mi` |
| `ArrivingDistance` | `1.4 mi` |
| `Eta` | `2026-04-12 11:27:00 AM PDT` |

This is physically consistent with the user’s expectation that the indicator should be just after departure on the `11:10 AM` sailing.

### Bad Timeline Backbone Rows

`functions/vesselTimeline/queries.getVesselTimelineBackbone({ VesselAbbrev: "KIT", SailingDay: "2026-04-12" })` returned these key rows around the incident window:

| Boundary Key | Scheduled | Actual | Predicted | Notes |
| --- | --- | --- | --- | --- |
| `KIT--2026-04-12--10:45--SOU-VAI--arv-dock` | `10:55 AM` | `11:03:45 AM` | none | correct prior arrival |
| `KIT--2026-04-12--11:10--VAI-FAU--dep-dock` | `11:10 AM` | `11:12:09 AM` | none | correct current departure |
| `KIT--2026-04-12--11:10--VAI-FAU--arv-dock` | `11:30 AM` | none | `11:27:00 AM` (`wsf_eta`) | plausible ETA |
| `KIT--2026-04-12--11:40--FAU-SOU--dep-dock` | `11:40 AM` | `09:58:32 AM` | `11:41:00 AM` (`ml`) | impossible future actual |
| `KIT--2026-04-12--11:40--FAU-SOU--arv-dock` | `12:10 PM` | none | none | future row |

The bad persisted fact was therefore already present in the backend backbone.

### Persisted `eventsActual` Rows

Querying `eventsActual` directly confirmed:

| Key | Scheduled Departure | `EventActualTime` | Meaning |
| --- | --- | --- | --- |
| `KIT--2026-04-12--09:55--FAU-VAI--dep-dock` | `09:55 AM` | `09:58:32 AM` | correct, but backfilled later |
| `KIT--2026-04-12--10:45--SOU-VAI--dep-dock` | `10:45 AM` | `10:56:28 AM` | plausible |
| `KIT--2026-04-12--10:45--SOU-VAI--arv-dock` | `10:45 AM` | `11:03:45 AM` | plausible |
| `KIT--2026-04-12--11:10--VAI-FAU--dep-dock` | `11:10 AM` | `11:12:09 AM` | correct |
| `KIT--2026-04-12--11:40--FAU-SOU--dep-dock` | `11:40 AM` | `09:58:32 AM` | impossible |

Later investigation showed that the wrong `11:40` row was not permanent in its original form:

| Key | `_creationTime` / `UpdatedAt` | `EventActualTime` |
| --- | --- | --- |
| `KIT--2026-04-12--11:40--FAU-SOU--dep-dock` | around `11:42 PM`? no, corrected later during investigation window to the real `11:42 PM`-ish departure context | at the time of first investigation it was still `09:58:32 AM`; later data reads showed it eventually held a corrected near-scheduled actual |
| `KIT--2026-04-12--09:55--FAU-VAI--dep-dock` | written later around `11:03 AM` lifecycle/sync catch-up window | `09:58:32 AM` |

The important point is not which later process repaired or replaced the row. The important point is that a bad `11:40 -> 09:58` actual did exist in `eventsActual` and was visible in the timeline backbone at the time of the user report.

### Raw `vesselLocationsHistoric` Around 09:58 AM PDT

`vesselLocationsHistoric` is the rawest reliable evidence available in Convex for minute-level truth.

The `KIT` rows around `09:44 AM` through `09:58 AM` were coherent:

| Approx Time | `AtDock` | `DepartingTerminalAbbrev` | `ArrivingTerminalAbbrev` | `ScheduledDeparture` | `Key` | `LeftDock` | `Speed` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `09:44` to `09:58` | `true` | `FAU` | `VAI` | `09:55 AM` | `KIT--2026-04-12--09:55--FAU-VAI` | none | `0` |
| `09:58:32 AM` departure tick | `false` | `FAU` | `VAI` | `09:55 AM` | `KIT--2026-04-12--09:55--FAU-VAI` | `09:58:32 AM` | `6.8` |

This proves:

- the raw vessel history did not say `11:40 FAU -> SOU` at `09:58`
- the raw vessel history did not justify a future departure actual
- the bad keying was introduced downstream

### Raw `vesselLocationsHistoric` Around 11:10 AM PDT

The rows around `11:10 AM` were also coherent:

| Approx Time | `AtDock` | `DepartingTerminalAbbrev` | `ArrivingTerminalAbbrev` | `ScheduledDeparture` | `Key` | `LeftDock` | `Speed` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `11:06` to `11:12` pre-departure | `true` | `VAI` | `FAU` | `11:10 AM` | `KIT--2026-04-12--11:10--VAI-FAU` | none | `0` |
| `11:12:09 AM` departure tick | `false` | `VAI` | `FAU` | `11:10 AM` | `KIT--2026-04-12--11:10--VAI-FAU` | `11:12:09 AM` | `11.8+` |

Again, raw data was correct.

### Completed Trips Support The Current Hypothesis

Recent `completedVesselTrips` for `KIT` included:

| Trip | `LeftDock` | `ArriveDest` | `NextKey` |
| --- | --- | --- | --- |
| `09:25 VAI -> FAU` | `09:30:54 AM` | `09:44:31 AM` | `09:55 FAU -> VAI` |
| `09:55 FAU -> VAI` | `09:58:32 AM` | `10:13:39 AM` | `10:20 VAI -> SOU` |
| `10:20 VAI -> SOU` | `10:22:08 AM` | `10:32:18 AM` | `10:45 SOU -> VAI` |
| `10:45 SOU -> VAI` | `10:56:28 AM` | `11:03:45 AM` | `11:10 VAI -> FAU` |

This matters because the correct continuity after the `09:25 VAI -> FAU` arrival is `09:55 FAU -> VAI`, not `11:40 FAU -> SOU`.

## Determining Which Writer Likely Produced The Bad Row

Two candidate writers were discussed:

1. the normal `vesselTrips/updates` orchestrator loop
2. the 15-minute `sync:vessel-timeline` script / full-day replace path

The evidence points more strongly to the normal `vesselTrips/updates` path:

- `vesselTrips` actual projection can write an actual directly from `trip.Key + trip.LeftDock`
- the bad row exactly matched the real `09:58:32` departure timestamp
- raw history and live location reconcile logic do not naturally point `09:58` to `11:40 FAU -> SOU`

The full-day replace path in [convex/functions/vesselTimeline/mutations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/mutations.ts), [convex/domain/vesselTimeline/events/history.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/events/history.ts), and [convex/domain/vesselTimeline/events/reconcile.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/events/reconcile.ts) is still relevant because it may later preserve, repair, or overwrite bad data. But the bad `11:40 -> 09:58` actual has the signature of being projected from an already-wrong trip key during a normal departure tick.

## Root Cause Hypothesis

### Short Version

The current best hypothesis is:

1. `KIT` docked at `FAU` after completing `09:25 VAI -> FAU`
2. the active trip was initially or should have been set to `09:55 FAU -> VAI`
3. a transient contradictory WSF dock-state tick caused the system to stop trusting that docked trip owner
4. the heuristic fallback schedule resolver then chose the next same-terminal departure after `09:55`, which is `11:40 FAU -> SOU`
5. the real `09:58:32` departure was then written onto that wrong future key

### Specific Timing Sequence That Could Generate The Bad Row

The following sequence is the most plausible explanation consistent with the code and the data:

#### Step A: Arrival completes, new dock owner should be `09:55 FAU -> VAI`

When `KIT` arrives at `FAU`, [processCompletedTrips.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripLifecycle/processCompletedTrips.ts) completes the old trip and starts a new one using [buildTrip.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripLifecycle/buildTrip.ts).

Inside [resolveEffectiveLocation.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts):

- if the existing dock owner is stable, reuse it
- otherwise call [dockedScheduleResolver.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsScheduled/dockedScheduleResolver.ts)

The expected correct outcome at this point is:

- active trip key = `KIT--2026-04-12--09:55--FAU-VAI`

#### Step B: Contradictory dock-state tick destabilizes the active trip

The system currently treats stable dock ownership as a boolean in [effectiveTripIdentity.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/effectiveTripIdentity.ts):

- `activeTrip.AtDock === true`
- `activeTrip.LeftDock === undefined`
- `location.AtDock === true`
- `location.LeftDock === undefined`
- same departing terminal

If a transient tick violates those assumptions, for example:

- `AtDock = false`, `LeftDock = undefined`, or
- `AtDock = true`, `LeftDock` still present

then `hasStableDockedTripIdentity(...)` becomes false and the current dock owner is no longer trusted.

This is likely where the warnings the team has seen for other vessels become relevant. A 5-second contradictory tick is enough to destabilize trip ownership even if the 1-minute historic snapshot later looks clean.

#### Step C: Fallback schedule lookup asks the wrong question

Once stable dock ownership is lost, [dockedScheduleResolver.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsScheduled/dockedScheduleResolver.ts) does:

1. try `existingTrip.NextKey`
2. if that does not match the current departing terminal, call
   `getNextDepartureSegmentAfterDeparture(vessel, terminal, previousScheduledDeparture)`

For the `09:55 FAU -> VAI` trip:

- `existingTrip.NextKey` would be `10:20 VAI -> SOU`
- but that departs from `VAI`, not current terminal `FAU`
- so that path is rejected

Then `getNextDepartureSegmentAfterDeparture(...)` in [eventsScheduled/queries.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsScheduled/queries.ts) asks:

- next departure for vessel `KIT`
- at terminal `FAU`
- after scheduled departure `09:55`

The answer is:

- `11:40 FAU -> SOU`

That is the crucial wrong heuristic.

#### Step D: Real departure actual is projected onto the wrong future key

On the true departure tick at `09:58:32 AM`, [tripDerivation.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts) intentionally preserves the dock-owned identity on the leave-dock tick so future-feed jumps do not steal the current departure.

That rule is good in principle. But if the current dock owner is already wrong, it faithfully preserves the wrong owner.

Then:

- [actualBoundaryPatchesFromTrip.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts) builds the departure patch from `trip.Key + trip.LeftDock`
- [timelineEventAssembler.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts) includes it in `tickEventWrites`
- [eventsActual/mutations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsActual/mutations.ts) persists it

If `trip.Key` is already `KIT--2026-04-12--11:40--FAU-SOU`, the emitted patch is effectively:

```ts
{
  SegmentKey: "KIT--2026-04-12--11:40--FAU-SOU",
  EventType: "dep-dock",
  EventActualTime: 1776013112000, // 2026-04-12 09:58:32 AM PDT
}
```

That exactly explains the bad row.

## Why The Timeline Misbehaved At 11:12 AM

Once the backend contained:

- correct `11:10 VAI -> FAU dep-dock actual = 11:12:09`
- incorrect `11:40 FAU -> SOU dep-dock actual = 09:58:32`

the client’s active-interval derivation became vulnerable to crossed signals.

Per [convex/shared/activeTimelineInterval.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/activeTimelineInterval.ts):

- it finds the latest event in timeline order with `EventActualTime`
- it does not ask whether that actual time is plausible relative to the scheduled departure

So if a future boundary row already has an actual, timeline ownership can jump ahead even when the live vessel location still says the vessel is physically on the earlier leg.

That is exactly what the screenshots reflected.

## Broader Pattern Seen In `eventsActual`

A sweep over `eventsActual` for `2026-04-12` found multiple rows where `EventActualTime` was far earlier than `ScheduledDeparture`, for example:

| Vessel | Key | Delta From Scheduled |
| --- | --- | --- |
| `KIT` | `11:40 FAU-SOU dep-dock` | about `-101 min` |
| `SPO` | `11:55 KIN-EDM dep-dock` | about `-92 min` |
| `WAL` | `12:45 KIN-EDM dep-dock` | about `-97 min` |
| `TAC` | `13:15 P52-BBI dep-dock` | about `-108 min` |

Some outliers were much larger. This suggests the bug class is not limited to `KIT`.

This does not prove every row has the same exact cause, but it does suggest a broader pattern:

- noisy physical-state transitions
- schedule identity rollover
- actual projection lacks a plausibility guard

## Problems Identified In The Current Code / Design

### 1. Stable dock ownership is a brittle boolean

`hasStableDockedTripIdentity(...)` is currently all-or-nothing. One contradictory tick can throw away the correct dock owner.

### 2. Fallback rollover can skip the current dock interval

The “next departure after previous scheduled departure at the same terminal” heuristic can jump to a later same-terminal trip when the true current dock owner is lost.

### 3. Key generation depends on noisy transition inputs

[convex/shared/tripIdentity.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/tripIdentity.ts) builds keys from:

- departing terminal
- arriving terminal
- scheduled departure

Those are exactly the fields that can be missing or jumpy during dock/undock transitions.

### 4. Actual projection has no plausibility guard

The normal flow can write:

- a departure actual far earlier than the scheduled departure, or
- an arrival actual on an impossible future boundary

There is currently no guard in [eventsActual/mutations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsActual/mutations.ts) or the trip projection path to reject impossible future writes.

### 5. Some tests are too clean

Relevant tests currently validate useful invariants, but mostly on clean single-tick transitions:

- [convex/functions/vesselTrips/updates/tests/buildTrip.test.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tests/buildTrip.test.ts)
- [convex/functions/vesselTrips/updates/tests/resolveEffectiveLocation.test.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tests/resolveEffectiveLocation.test.ts)
- [convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts)
- [convex/shared/tests/tripIdentity.test.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/tests/tripIdentity.test.ts)

What is missing are adversarial tests such as:

- docked vessel gets a single contradictory `AtDock=false, LeftDock=undefined` tick
- docked vessel gets `AtDock=true` while old `LeftDock` is still present
- repeated same-terminal departures where rollover can skip a leg
- one bad transition tick followed by a real departure tick

## Current Debug Instrumentation Added In This Thread

To make the next occurrence directly diagnosable, new structured logging was added.

### Files Modified

- [convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/processCurrentTrips.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripLifecycle/processCurrentTrips.ts)

### What Was Removed

The previous generic warnings were removed from `processCurrentTrips`, including:

- `AtDock true while LeftDock is present`
- `AtDock false without LeftDock`
- `AtDock reset before LeftDock appeared`

These were low-signal and did not include enough context to explain a key change.

### New Logs: `[VesselTrips][DockedIdentity]`

Logged in `resolveEffectiveLocation` when:

- docked identity resolution changed something, or
- the effective identity conflicts with the live feed, or
- rollover schedule resolution was used

Payload includes:

- vessel
- timestamp
- whether docked identity was considered stable
- resolver source:
  - `active_trip`
  - `completed_trip_next`
  - `rollover_schedule`
- live tick identity fields
- existing trip identity fields
- resolved scheduled segment when used
- final effective location identity
- `speed`
- `departingDistance`
- `arrivingDistance`

### New Logs: `[VesselTrips][KeyTransition]`

Logged in `processCurrentTrips` whenever a tick results in:

- a new key, or
- a changed scheduled departure

Payload includes:

- `events`
- live tick fields
- existing trip fields
- final proposed trip fields
- `speed`
- `departingDistance`
- `arrivingDistance`

### New Logs: `[VesselTrips][BoundaryProjection]`

Logged in `processCurrentTrips` whenever a tick is about to project:

- a departure actual, or
- an arrival actual

Payload includes:

- whether the tick will persist and/or refresh
- event flags
- live tick
- existing trip
- final proposed trip
- the exact projected boundary:
  - `segmentKey`
  - `actualTime`
- `speed`
- `departingDistance`
- `arrivingDistance`

### What To Look For In The Debug Logs

When the bug happens again, look for this sequence:

1. A `[VesselTrips][DockedIdentity]` log for a docked vessel where:
   - `effectiveIdentitySource = "rollover_schedule"`
   - live tick is still docked
   - existing trip key is the expected current dock owner
   - effective location key jumps to a later same-terminal future segment

2. A `[VesselTrips][KeyTransition]` log showing:
   - `existingTrip.key = current expected sailing`
   - `finalProposed.key = later future same-terminal sailing`

3. A `[VesselTrips][BoundaryProjection]` log shortly after showing:
   - `events.didJustLeaveDock = true`
   - `projectedDeparture.segmentKey = wrong future key`
   - `projectedDeparture.actualTime = real leave-dock timestamp`

4. In motion terms, look for suspicious contradictions such as:
   - docked with `speed = 0`, then sudden identity jump
   - `AtDock=true` with nonzero `LeftDock`
   - `AtDock=false` with missing `LeftDock`
   - very small `departingDistance` / `arrivingDistance` while key jumps to a different later sailing

These logs should turn the current hypothesis into a directly observable causal chain.

## Log Review Update On 2026-04-12 Afternoon

After the memo above was prepared, Convex MCP logs were reviewed again on
`2026-04-12` in the late afternoon Pacific time with the instruction to ignore
the earlier `ISS` investigation and focus on the live log stream itself.

### What The Current Log Stream Actually Shows

The currently visible log stream is dominated by repeated
`[VesselTrips][DockedIdentity]` warnings from
`functions/vesselOrchestrator/actions:updateVesselOrchestrator`.

Two vessels stood out:

1. `CAT`
2. `CHZ`

Representative `CAT` warning shape:

- timestamp around `2026-04-12 04:47 PM` to `04:50 PM PDT`
- `stableDockedIdentity = true`
- `effectiveIdentitySource = "active_trip"`
- `scheduledResolution = null`
- `conflictsLiveFeed = true`
- live feed says:
  - docked
  - `key = CAT--2026-04-12--18:45--SOU-VAI`
  - `scheduledDeparture = 6:45 PM`
- existing active trip says:
  - docked
  - `key = CAT--2026-04-12--16:50--SOU-VAI`
  - `scheduledDeparture = 4:50 PM`
- effective location stays with the existing active-trip identity:
  - `key = CAT--2026-04-12--16:50--SOU-VAI`

Representative `CHZ` warning shape:

- timestamp around the same window
- `stableDockedIdentity = true`
- `effectiveIdentitySource = "active_trip"`
- `scheduledResolution = null`
- `conflictsLiveFeed = false`
- live payload is comparatively sparse and omits arriving-terminal identity
- effective location still stays on the active trip

### What This Means

The current logs provide direct evidence of a recurring mismatch class even
without a full bad-write reproduction:

1. The instrumentation is firing in real traffic, not just in theory.
2. The most common live anomaly in the sampled window is **not**
   `rollover_schedule`; it is a conflict between the live feed identity and the
   already-owned active trip while the resolver still chooses `active_trip`.
3. For `CAT`, the disagreement is large:
   - same departing terminal
   - same route direction
   - but a nearly two-hour scheduled-departure jump in the live feed
4. The system is currently preferring trip continuity over the live feed in
   these cases, which may be correct defensively, but it proves that identity
   disagreement is happening in production-like traffic right now.

This is important because it narrows the operational picture:

- the new logs are already catching identity conflicts before any future-actual
  write is proven
- the bad `KIT` event may be one downstream consequence of this broader class of
  identity disagreement
- the disagreement can persist across many orchestrator ticks, not just a
  single one-off sample

### What The Current Logs Did Not Show

In the MCP-accessible log window during this review, we did **not** capture the
full predicted causal chain from the memo for the original `KIT` incident:

- no sampled `effectiveIdentitySource = "rollover_schedule"`
- no sampled `[VesselTrips][KeyTransition]` jumping onto a later future sailing
- no sampled `[VesselTrips][BoundaryProjection]` writing an actual onto an
  obviously wrong future key

One `BoundaryProjection` entry was seen earlier in the session for `PUY`, but
it appeared physically plausible and not part of the `KIT`-style anomaly.

So the current log review does **not** yet prove the specific rollover path for
the original morning bug. What it **does** prove is that the resolver is
encountering real, repeated live-feed-versus-active-trip identity conflicts on
other vessels in the wild.

### Additional Operational Note From The Same Log Window

The same log window also showed
`functions/scheduledTrips/actions:syncScheduledTripsWindowed` running at about
`04:50 PM PDT` on `2026-04-12`, deleting and reinserting `477` scheduled trips
for the day while the orchestrator warnings were still being emitted.

That does **not** by itself prove causation, but it is worth recording because
same-day schedule refresh and active trip reconciliation are happening in close
temporal proximity:

- schedule sync began around `04:50:00 PM PDT`
- existing trips for `2026-04-12` were deleted and reinserted by about
  `04:50:14 PM PDT`
- `DockedIdentity` warnings for `CAT` and `CHZ` continued across that same
  interval

This strengthens the case for treating schedule refresh plus trip continuity as
a combined forensic surface, not two isolated systems.

### Updated Takeaway From Logs Alone

If we ignore the earlier `ISS` data entirely and focus only on logs, the best
current statement is:

- the new debug instrumentation is working
- the live system is presently experiencing repeated docked-identity conflicts
- at least one live vessel (`CAT`) is repeatedly presenting a future-ish live
  feed identity while the resolver retains an older active-trip identity
- we still need a captured `KeyTransition` plus `BoundaryProjection` pair to
  prove that one of these conflicts directly poisoned an `eventsActual` row

## Investigation Continuation On 2026-04-12 Evening

The investigation was continued after the log-only addendum above, still using
Convex MCP and still prioritizing live warnings over older `ISS` evidence.

### Fresh Correlation Check: Live Logs Versus Current Tables

#### `CAT`

The repeated `CAT` warnings remained the clearest active anomaly:

- repeated `[VesselTrips][DockedIdentity]`
- `stableDockedIdentity = true`
- `effectiveIdentitySource = "active_trip"`
- `scheduledResolution = null`
- `conflictsLiveFeed = true`

The warning payload consistently showed:

- live docked identity:
  - `CAT--2026-04-12--18:45--SOU-VAI`
- existing active-trip identity:
  - `CAT--2026-04-12--16:50--SOU-VAI`
- effective location chosen:
  - still `CAT--2026-04-12--16:50--SOU-VAI`

That is a strong sign the live feed is repeatedly surfacing a later
same-terminal identity while the trip resolver is deliberately holding onto
continuity.

By the time tables were re-queried a few minutes later, `CAT` had already moved
forward into an underway state:

- current `activeVesselTrips` row had:
  - `AtDock = false`
  - `Key = CAT--2026-04-12--16:50--SOU-VAI`
- current `vesselLocations` row no longer carried the bad future key from the
  warning payload; it showed normal underway motion and did not expose a key
  override in the same way

Interpretation:

- the suspicious state is transient at the live-tick/log layer
- it may not persist long enough to be easy to capture later from tables alone
- the structured warnings are therefore more valuable than the steady-state
  tables for this class of bug

#### `CHZ`

`CHZ` remained noisy in logs but looked much less suspicious on correlation:

- `conflictsLiveFeed = false`
- current `activeVesselTrips` and current `vesselLocations` both pointed to the
  same `17:00 TAH -> PTD` identity family
- the warning appears to be triggered mostly because the live payload omits some
  fields while the active trip retains fuller identity context

Operationally, `CHZ` currently looks like a lower-priority false-positive-ish
warning source compared with `CAT`.

#### `KIT`

A fresh `[VesselTrips][BoundaryProjection]` warning for `KIT` was also captured
later in the afternoon.

That one looked healthy:

- `didJustLeaveDock = true`
- live tick key:
  - `KIT--2026-04-12--16:50--VAI-FAU`
- existing trip key:
  - `KIT--2026-04-12--16:50--VAI-FAU`
- projected departure key:
  - `KIT--2026-04-12--16:50--VAI-FAU`

So the instrumentation is not merely noisy. It is capable of producing normal,
physically coherent projection logs as well.

### Sweep For Impossible Persisted Actuals

A fresh Convex sweep over `eventsActual` for sailing day `2026-04-12` filtered
for rows where:

- `EventActualTime` exists, and
- `EventActualTime < ScheduledDeparture - 15 minutes`

returned **no rows** during this follow-up review.

That does not invalidate the original morning `KIT` incident. It means only:

- the currently persisted `eventsActual` table is not, at this moment,
  exhibiting the same obvious impossible-future pattern
- the bad row class may be intermittent and self-healing, overwritten later, or
  rare enough that logs are the better detection surface than table sweeps

### Updated Prioritization

Based on the continued investigation, the most actionable live lead is now:

1. `CAT` repeated docked-identity conflicts
2. capture the eventual transition from those repeated conflicts into either:
   - a normal `BoundaryProjection`, or
   - a bad `KeyTransition` / bad `BoundaryProjection`

The practical reason is simple:

- `CAT` is already producing repeated structured evidence of unstable identity
  reconciliation
- `CHZ` currently looks comparatively benign
- `KIT` currently appears healthy in the sampled live logs, so it is more useful
  now as a control case than as the best active repro target

### Tightened Near-Term Recommendation

For the next recurrence, the most valuable capture bundle is no longer "any bad
vessel." It should preferentially be a `CAT`-style case where:

- repeated `[VesselTrips][DockedIdentity]` logs show
  `conflictsLiveFeed = true`
- the live key is materially later than the active-trip key
- and then the same vessel produces either:
  - `[VesselTrips][KeyTransition]`, or
  - `[VesselTrips][BoundaryProjection]`

That would connect the currently observed mismatch surface to an eventual write
surface and either confirm or falsify the hypothesis that these conflicts are
the precursor state to poisoned `eventsActual` rows.

## Future Concerns Raised In This Thread

These were discussed but intentionally not implemented yet:

1. Add provenance to `eventsActual`
   - identify whether each row came from:
     - trip projection
     - history merge
     - live-location reconcile
     - schedule sync repair

2. In the refresh/sync path, consider nuking impossible future actuals
   - not implemented yet because the team wants to preserve forensic evidence while debugging

3. In the normal flow, add impossible-actual guards
   - do not allow writes where actual time is wildly before the scheduled departure unless explicitly justified

4. Revisit physical-state classification under noisy WSF data
   - the current boolean stability logic is likely too brittle
   - the team discussed an agreement-based classifier using:
     - `AtDock`
     - `LeftDock`
     - speed
     - terminal distance as a sanity check

## Current Best Conclusion

The `KIT` glitch on `2026-04-12` was caused by a bad backend actual event keyed to the wrong future sailing.

The most likely real root cause is:

- a transient contradictory WSF transition tick destabilized the active dock owner
- heuristic same-terminal schedule rollover advanced the trip to `11:40 FAU -> SOU`
- the real `09:58:32` departure was then written onto that wrong future key

The raw `vesselLocationsHistoric` data does not support the bad event. The bug lies downstream in trip identity continuity and actual projection, not in the basic recorded vessel movement.

The newly added structured logs should make the next occurrence directly explainable.

## Next Actions

1. Watch the new structured logs for the first recurrence.
   Specifically look for:
   - `[VesselTrips][DockedIdentity]` with `effectiveIdentitySource = "rollover_schedule"`
   - followed by `[VesselTrips][KeyTransition]` jumping from the expected dock owner to a later same-terminal sailing
   - followed by `[VesselTrips][BoundaryProjection]` writing a departure actual onto that jumped key

2. When the next case appears, capture a narrow forensic bundle immediately.
   Save:
   - the three structured log lines above
   - the affected vessel’s live `vesselLocation`
   - the surrounding `activeVesselTrips` row
   - the relevant `eventsActual`, `eventsPredicted`, and `eventsScheduled` rows
   - the nearest `vesselLocationsHistoric` minute samples before and after the bad write

3. Add adversarial tests before changing logic.
   The most valuable new tests would simulate:
   - one contradictory dock-state tick while physically still docked
   - a same-terminal rollover opportunity after losing stable ownership
   - a real leave-dock tick immediately after that unstable period
   - assertion that the departure actual remains on the current sailing, not a later one

4. After one more captured occurrence, tighten dock-owner continuity logic.
   Candidate changes to evaluate:
   - do not allow same-terminal rollover to skip the immediate current dock owner
   - require additional agreement before replacing an existing docked owner
   - prevent actual projection when the candidate key is implausibly far ahead of the actual timestamp

5. Add provenance and plausibility guardrails once the forensic trail is sufficient.
   Future improvements discussed in this thread:
   - store provenance on `eventsActual`
   - reject or quarantine impossible future actuals in the normal flow
   - optionally let the refresh path clean up impossible actual rows after the bug is understood
