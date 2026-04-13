# Engineering Memo: CAT Composite Key Anomaly on 2026-04-12

Date prepared: 2026-04-12  
Scope: `CAT` docked identity anomaly observed in Convex debug logs on `2026-04-12`  
Purpose: document the problem and evidence only; no fix is proposed in this memo

## Executive Summary

`CAT` showed a distinct composite-key anomaly in live Convex logs on
`2026-04-12`.

The important point is:

- the bad value was not the terminal pair
- the bad value was the feed-supplied `ScheduledDeparture`
- our code then used that `ScheduledDeparture` to synthesize the wrong composite
  key

The clearest logged example shows a docked `CAT` tick at `SOU` with:

- `AtDock = true`
- `DepartingTerminalAbbrev = "SOU"`
- `ArrivingTerminalAbbrev = "VAI"`
- `Speed = 0`
- `DepartingDistance = 0`
- `ScheduledDeparture = 2026-04-12 06:45 PM PDT`

while the backend active trip at the same moment still held:

- `ScheduledDeparture = 2026-04-12 04:50 PM PDT`
- `Key = CAT--2026-04-12--16:50--SOU-VAI`

Because composite key generation includes scheduled departure minute, the raw
feed-shaped vessel location produced:

- `Key = CAT--2026-04-12--18:45--SOU-VAI`

This memo documents that problem as a separate issue from the earlier `ISS`
timeline investigation.

## Core Finding

The logged `CAT` anomaly is best described as:

- the WSF vessel-location payload appears to have advanced
  `ScheduledDeparture` to a later same-terminal sailing while the vessel was
  still docked in the current interval
- our vessel-location conversion trusted that field and generated a later
  composite key from it
- the trip pipeline then had to reconcile:
  - a feed-shaped live identity on `18:45 SOU -> VAI`
  - against an active-trip identity on `16:50 SOU -> VAI`

This is not merely a logging oddity. It is direct evidence that raw
feed-derived `ScheduledDeparture` can produce an incorrect synthesized key even
when the vessel looks physically stationary and otherwise coherent.

## Primary Log Evidence

### First Captured Incorrect-Key Tick

The first logged `CAT` tick found during this investigation was emitted by:

- `functions/vesselOrchestrator/actions:updateVesselOrchestrator`
- log type: `[VesselTrips][DockedIdentity]`
- log wall-clock time: `2026-04-12 04:47:08 PM PDT`
- tick timestamp inside payload: `2026-04-12T23:46:59.000Z`

Relevant payload fields:

```json
{
  "vesselAbbrev": "CAT",
  "timestamp": "2026-04-12T23:46:59.000Z",
  "stableDockedIdentity": true,
  "effectiveIdentitySource": "active_trip",
  "conflictsLiveFeed": true,
  "live": {
    "atDock": true,
    "departingTerminalAbbrev": "SOU",
    "arrivingTerminalAbbrev": "VAI",
    "scheduledDeparture": 1776044700000,
    "key": "CAT--2026-04-12--18:45--SOU-VAI",
    "speed": 0,
    "departingDistance": 0,
    "arrivingDistance": 1.5
  },
  "existingTrip": {
    "atDock": true,
    "departingTerminalAbbrev": "SOU",
    "arrivingTerminalAbbrev": "VAI",
    "scheduledDeparture": 1776037800000,
    "key": "CAT--2026-04-12--16:50--SOU-VAI",
    "nextKey": "CAT--2026-04-12--17:20--VAI-FAU",
    "nextScheduledDeparture": 1776039600000
  },
  "scheduledResolution": null,
  "effectiveLocation": {
    "atDock": true,
    "departingTerminalAbbrev": "SOU",
    "arrivingTerminalAbbrev": "VAI",
    "scheduledDeparture": 1776037800000,
    "key": "CAT--2026-04-12--16:50--SOU-VAI",
    "speed": 0,
    "departingDistance": 0,
    "arrivingDistance": 1.5
  }
}
```

### Why This Tick Matters

This tick isolates the suspicious field very clearly.

Fields that appear physically plausible:

- `AtDock = true`
- `DepartingTerminalAbbrev = "SOU"`
- `ArrivingTerminalAbbrev = "VAI"`
- `Speed = 0`
- `DepartingDistance = 0`

Field that appears wrong for the current dock interval:

- `live.scheduledDeparture = 1776044700000`
- which is `2026-04-12 06:45 PM PDT`

That later scheduled departure is what caused the generated live composite key:

- `CAT--2026-04-12--18:45--SOU-VAI`

The active trip at the same moment still identified the current dock owner as:

- `CAT--2026-04-12--16:50--SOU-VAI`

So the problem is not a terminal mismatch. The problem is that the live
feed-shaped identity had already jumped to a later departure minute.

## Repetition Pattern

This was not a one-off sample.

The same warning shape repeated across many orchestrator ticks from roughly:

- `04:47 PM PDT`
- through at least `04:52 PM PDT`

Across those repeated logs, the same pattern held:

- `stableDockedIdentity = true`
- `effectiveIdentitySource = "active_trip"`
- `conflictsLiveFeed = true`
- live identity repeatedly implied `18:45 SOU -> VAI`
- active-trip identity repeatedly remained `16:50 SOU -> VAI`

This persistence matters because it suggests:

- the anomaly can survive across multiple polling cycles
- it is not limited to a single noisy sample
- logs are currently the best evidence surface for this issue because the
  feed-shaped state can be transient by the time tables are queried later

## What The Code Confirms

### `ScheduledDeparture` Is Ingested From Raw WSF VesselLocation Data

In [convex/functions/vesselOrchestrator/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/actions.ts),
raw WSF vessel locations are fetched and converted immediately via:

- `toConvexVesselLocation(rawLocation, vessels, terminals)`

In [convex/functions/vesselLocation/schemas.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/schemas.ts),
the conversion does:

```ts
const scheduledDepartureMs = optionalDateToEpochMs(dvl.ScheduledDeparture);
```

and then stores:

```ts
ScheduledDeparture: scheduledDepartureMs
```

It also derives trip identity from that same raw-derived value:

```ts
const tripIdentity = deriveTripIdentity({
  vesselAbbrev: resolvedAbbrev,
  departingTerminalAbbrev: DepartingTerminalAbbrev,
  arrivingTerminalAbbrev: ArrivingTerminalAbbrev,
  scheduledDepartureMs: optionalDateToEpochMs(dvl.ScheduledDeparture),
});
```

### What This Means

At least in the ingest path inspected here:

- we do not compute a replacement `ScheduledDeparture` before storing it in
  `vesselLocations`
- we do not locally mutate the raw WSF `ScheduledDeparture` before using it to
  derive the vessel-location `Key`

So the specific `18:45` value seen on the logged `live` side should be treated
as raw feed-derived input that our code then trusted.

## Why This Is A Problem

Our composite vessel-location key is generated from:

- vessel abbreviation
- departing terminal
- arriving terminal
- scheduled departure minute

That means a premature or incorrect `ScheduledDeparture` can produce a wrong key
even when:

- the vessel is docked
- the terminal pair still looks normal
- the motion fields look calm and physically plausible

For `CAT`, that is exactly what the evidence shows:

- normal-looking dock state
- but later `ScheduledDeparture`
- therefore later synthesized key

## What This Memo Does Not Claim

This memo does **not** claim:

- that the raw WSF feed is always wrong
- that every future composite-key anomaly shares this exact cause
- that `eventsActual` was poisoned for `CAT`
- that this is identical to the earlier `ISS` issue

This memo claims only what the evidence supports:

- on `2026-04-12`, `CAT` produced repeated live log payloads where a raw
  feed-derived `ScheduledDeparture` of `18:45` caused our code to synthesize
  `CAT--2026-04-12--18:45--SOU-VAI`
- at the same moment, backend trip continuity still considered
  `CAT--2026-04-12--16:50--SOU-VAI` to be the current dock owner

## Bottom Line

`CAT` exposes a separate engineering problem:

- a raw WSF vessel-location tick can surface a later `ScheduledDeparture`
  earlier than our trip continuity model expects
- our code currently trusts that field enough to synthesize an incorrect
  composite key for the live location

That is sufficient to justify treating `CAT` as a distinct composite-key
anomaly worth documenting independently from the earlier `ISS` investigation.
