# Forensic Engineering Report: ISS Timeline / Schedule Identity Anomalies on 2026-04-11

Date prepared: 2026-04-12  
Scope: `ISS` on sailing day `2026-04-11`  
Primary evidence:

- `vesselLocationsHistoric` in Convex dev
- `eventsScheduled` in Convex dev
- `eventsActual` in Convex dev
- `functions/vesselTimeline/queries:getVesselTimelineBackbone`
- [convex/domain/vesselTimeline/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md)

## Executive Summary

The strongest source of truth for vessel movement on this incident is `vesselLocationsHistoric`. For `ISS` on `2026-04-11`, those one-minute snapshots are consistent with physical reality and show a coherent Seattle <-> Bremerton pattern throughout the evening.

The key findings are:

1. `vesselLocationsHistoric` appears directionally correct around the suspect windows, including the 4:00 PM to 5:00 PM period.
2. The current `vesselTimeline` / `eventsScheduled` / `eventsActual` combination still contains directional and completeness anomalies that do not always match the historic vessel-truth.
3. The major early-evening inversion was not caused by a bad key in `vesselLocationsHistoric`; the stored historic key around 4:00 PM was correct.
4. The most likely failure point is downstream of historic capture:
   - either schedule refresh seeded the wrong schedule identity for `ISS` for part of the day
   - or later trip/timeline projection wrote actuals against a mismatched schedule identity
5. The ordinary "dock infill" race does exist, but only as a brief expected pattern:
   - right after arrival, a docked row may briefly have `DepartingTerminalAbbrev` and a next `ScheduledDeparture`
   - `ArrivingTerminalAbbrev` / `Key` may be absent for a short time
   - within about 1-2 minutes, it infills to the next scheduled leg

That ordinary dock infill race does **not** explain the larger direction inversion near 4:15 PM, because the historic rows for that period already carry the correct key.

## Actual Vessel History Versus Timeline / Backend

The table below uses `vesselLocationsHistoric` as "real reality" and compares it to what the current `vesselTimeline` / backend publishes after the recent schedule refresh.

All times below are Pacific time on sailing day `2026-04-11`, except the final overnight arrival prediction which crosses into early `2026-04-12`.

| Approx phase | Historic vessel reality | Current backend / timeline representation | Match? | Notes |
|---|---|---|---|---|
| 4:00 PM | Docked at Seattle, ready for next westbound leg | Timeline shows `P52 -> BRE` departure scheduled `4:15 PM` | Yes | Historic terminals and key are correct here |
| 4:17 PM | Leaves Seattle for Bremerton | `eventsActual` / timeline currently show a departure actual on the `4:15 PM` westbound leg | Yes | Direction is physically correct in historic data |
| 5:12 PM | Arrives Bremerton from Seattle | Timeline row should represent arrival at Bremerton around `5:15 PM` | Partly | Historic data confirms westbound arrival; older UI states misrepresented this |
| 5:13 PM to 6:48 PM | Docked at Bremerton | Timeline shows `5:30 PM` Seattle departure and `6:30 PM` Bremerton arrival with no actuals, then `6:40 PM` Bremerton departure | No | Backend schedule skeleton does not fully reflect physical berth state during this gap |
| 6:49 PM | Leaves Bremerton for Seattle | Timeline shows `BRE 6:40 PM -> P52`, actual `6:49 PM` | Yes | This matches historic snapshots |
| 7:49 PM | Arrives Seattle from Bremerton | Timeline shows `P52 7:40 PM` arrival, actual `7:49 PM` | Yes | Current timeline aligns with historic data |
| 8:06 PM | Leaves Seattle for Bremerton | Timeline shows `P52 7:50 PM -> BRE`, actual `8:06 PM` | Yes | Current timeline aligns with historic data |
| 9:04 PM | Arrives Bremerton from Seattle | Timeline shows `BRE 8:50 PM` arrival, actual `9:04 PM` | Yes | Current timeline aligns with historic data |
| 9:19 PM | Leaves Bremerton for Seattle | Timeline shows `BRE 9:00 PM -> P52`, actual `9:19 PM` | Yes | Current timeline aligns with historic data |
| 10:22 PM | Arrives Seattle from Bremerton | Timeline shows `P52 10:00 PM` arrival, actual `10:22 PM` | Yes | Current timeline aligns with historic data |
| 10:54 PM | Leaves Seattle for Bremerton | Timeline shows `P52 10:30 PM -> BRE`, actual `10:54 PM` | Yes | Current timeline aligns with historic data |
| 11:49 PM | Arrives Bremerton from Seattle | Timeline shows `BRE 11:30 PM` arrival, actual `11:49 PM` | Yes | Current timeline aligns with historic data |
| 12:50 AM | Leaves Seattle or next overnight cycle | Timeline shows `P52 12:50 AM -> BRE`, actual `1:11 AM` | Plausible | Historic data confirms overnight departure later than schedule |
| 1:50 AM arrival | Still underway / predicted toward Bremerton | Timeline shows predicted arrival around `2:05 AM` | Plausible | This is prediction-backed, not yet a completed actual |

## Day Narrative: What ISS Actually Did

Using `vesselLocationsHistoric` as the source of truth, the evening pattern appears to be:

1. `ISS` was at Seattle shortly before 4:15 PM and departed Seattle westbound on the `4:15 PM` style crossing.
2. It arrived Bremerton around `5:12 PM`.
3. It remained physically docked at Bremerton from about `5:13 PM` until about `6:48 PM`.
4. It departed Bremerton at `6:49 PM` and resumed a consistent alternating `BRE -> P52 -> BRE -> P52` pattern for the rest of the evening.
5. From about `6:49 PM` onward, the current refreshed timeline is mostly consistent with physical vessel history.

The main gap is the interval from approximately `5:13 PM` to `6:48 PM`:

- Physical truth: vessel is docked at Bremerton
- Current timeline truth: shows unfulfilled schedule rows around `5:30 PM` and `6:30 PM`, then resumes with `6:40 PM`

This is not teleportation. It is a schedule identity / representation mismatch between physical vessel state and the timeline backbone.

## Focused Analysis: 4:00 PM to 5:00 PM

This hour matters because it distinguishes a raw-data problem from a downstream keying problem.

### Historic Evidence

Around 4:00 PM to 5:00 PM, `vesselLocationsHistoric` shows:

- docked at Seattle before departure
- `DepartingTerminalAbbrev: P52`
- `ArrivingTerminalAbbrev: BRE`
- `Key: ISS--2026-04-11--16:15--P52-BRE` after dock infill
- departure (`LeftDock`) at about `4:17 PM`
- westbound movement across the route
- arrival at Bremerton around `5:12 PM`

That is physically coherent.

### Important Observation

The `vesselLocationsHistoric` key around this period is already correct.

This means:

- the wrong direction seen in prior timeline output was **not** introduced at historic location capture time
- the raw historic location rows do not appear to have been corrupted for this leg
- the later timeline inversion must have been introduced downstream

### Dock Infill Behavior Near Arrival

At Bremerton just after `5:12 PM`, the stored historic rows briefly look like:

- `AtDock: true`
- `DepartingTerminalAbbrev: BRE`
- `ScheduledDeparture: 5:30 PM`-ish next-leg schedule
- no `Key` / no `ArrivingTerminalAbbrev` on the very first dock row

Then, within about 1-2 minutes, the row infills to:

- `ArrivingTerminalAbbrev: P52`
- `Key: ISS--2026-04-11--17:30--BRE-P52`

This behavior is consistent with the intended rule described by the user:

- immediately after arrival, rely on departing terminal only
- infill next-leg trip identity from `eventsScheduled`

That part looks normal and expected.

### Why 4:15 PM Still Matters

The notable anomaly is not that the raw key was wrong. It was correct.

The anomaly is that a later backend representation appears to have treated the `ISS` leg around this period inconsistently with that raw historic key.

So the likely failure is one of:

1. a later schedule refresh seeded `eventsScheduled` rows for `ISS` that no longer corresponded to the original historic trip identity for that leg
2. trip/timeline actualization projected `eventsActual` against whichever segment identity the current trip builder believed, even when that identity no longer matched the historic leg that produced the actual timestamp
3. some combination of both

## What `vesselLocationsHistoric` Tells Us About Keys

For the arrival windows checked, the key behavior in historic storage appears healthy:

| Window | Historic key state | Assessment |
|---|---|---|
| Around Seattle arrival near 4:00 PM | correct `BRE -> P52` key before arrival, then correct `P52 -> BRE` next-leg key after dock infill | healthy |
| Around Bremerton arrival near 5:12 PM | correct `P52 -> BRE` key before arrival, brief dock no-key state, then correct `BRE -> P52` next-leg key | healthy |
| Around Seattle arrival near 7:49 PM | correct `BRE -> P52` key before arrival, brief dock no-key state, then correct `P52 -> BRE` next-leg key | healthy |
| Around Bremerton arrival near 9:04 PM | correct `P52 -> BRE` key before arrival, then correct `BRE -> P52` next-leg key after dock infill | healthy |

Conclusion:

- the observed "race condition" exists only as a brief missing-key / missing-arrival-terminal period right after docking
- this is expected and consistent with the current design
- it does **not** explain a whole-leg directional inversion

## Most Likely Root Cause

Current evidence points to a downstream schedule identity mismatch rather than a raw vessel-location key bug.

The best current hypothesis is:

1. `vesselLocationsHistoric` captured correct physical terminals and correct derived key for the actual crossing.
2. `vesselTrips` / `eventsActual` later projected actual departures/arrivals using the then-current trip identity.
3. After schedule refresh, `eventsScheduled` for `ISS` may have reflected a different service identity than the one that originally produced the raw historic movement.
4. The timeline then merged:
   - structurally refreshed schedule rows
   - with actuals that may have been written under a mismatched or superseded segment identity
5. The result was a timeline that was mostly correct later in the evening, but inconsistent around the early-evening reassignment window.

## Suggestions for Further Investigation

### 1. Audit how `eventsActual` rows were created for the 4:15 PM / 5:15 PM leg

Specifically inspect:

- the trip key used when `buildDepartureActualPatchForTrip(...)` and `buildArrivalActualPatchForTrip(...)` ran
- whether the patch key matched the contemporaneous `vesselLocationsHistoric.Key`
- whether a later upsert overwrote or superseded the earlier row

Relevant code:

- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)
- [convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts)

### 2. Audit schedule refresh impact on same-day `ISS` segment identities

Compare:

- the pre-refresh `eventsScheduled` rows for `ISS`
- the post-refresh `eventsScheduled` rows for `ISS`
- any same-day changes in departure direction or terminal pairing around `4:15 PM` through `6:40 PM`

Goal:

- prove whether the schedule refresh changed the authoritative segment skeleton for that leg after actuals had already been captured

### 3. Add a one-off diagnostic report for key divergence

For a vessel/day, compare at each tick:

- `vesselLocationsHistoric.Key`
- active trip `Key`
- `eventsActual` row key eventually written for that boundary
- `eventsScheduled` row key currently seeded for that scheduled departure

Flag cases where:

- the historic key is stable and physically plausible
- but the actual boundary write lands on a different directional segment

That would make this class of bug much easier to prove.

### 4. Preserve raw historic leg provenance in actual-boundary writes

If the system intends actual rows to be idempotent from vessel-location truth, consider recording provenance such as:

- source historic key
- source timestamp of the leave-dock or arrive-dock tick
- whether schedule identity was inherited from dock infill or active trip continuity

This would not fix the bug by itself, but it would make forensic debugging much easier.

### 5. Treat `vesselLocationsHistoric` as a stronger tie-breaker for same-day anomalies

If schedule refresh and trip continuity disagree about a leg direction, but historic snapshots show:

- continuous movement away from one terminal
- across the route
- into the opposite terminal

then the historic direction should likely win over a later same-day schedule identity rewrite.

## Bottom Line

The current evidence does **not** support the theory that the 4:15 PM anomaly came from a bad raw key in `vesselLocationsHistoric`.

Instead, it supports this narrower conclusion:

- `vesselLocationsHistoric` was correct
- the brief post-arrival dock infill behaved normally
- the bad direction / mismatched timeline state was introduced later, after historic capture, somewhere in the trip-identity / schedule-refresh / actual-boundary projection path

That makes this look less like a raw feed problem and more like a same-day identity reconciliation bug.
