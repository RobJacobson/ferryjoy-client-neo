## ScheduledTrips handoff (missing vessels investigation)

This note is for a fresh agent to investigate the recurring issue:

- some ScheduledTrips pages only show journeys for **one vessel** on a route/day even
  when companion vessels should appear (e.g. route schedules that alternate vessels).

### Current state of the code (high-signal summary)

- **Schedule data source**: `api.functions.scheduledTrips.queries.getScheduledTripsForTerminal`
  (Convex) returns reconstructed journeys for a terminal/day.
- **Rendering path**:
  - `ScheduledTripList.tsx` builds `journeys[]` (client `Segment[]`) and a unified
    `vesselTripMap`, then calls `resolveScheduledTripsPageResolution()` which produces
    one card resolution per journey id.
  - `ScheduledTripTimeline.tsx` is mostly a renderer; it also attaches “next trip”
    predictions using strict `displayTrip.ScheduledTrip.NextKey === firstSegment.Key`.
- **Hold window**:
  - `useDelayedVesselTrips()` holds a disappearing active trip for ~30s and freezes its
    location snapshot to avoid flicker.

### What is known / not resolved

- The missing-vessels symptom is **not** explained yet.
- It is likely upstream of the UI:
  - either the schedule query is not returning journeys for some vessels, or
  - journey reconstruction is filtering them out, or
  - schedule sync is skipping those rows during ingest.

### Where to look first (fastest path to truth)

#### 1) Confirm whether the journeys are missing at the Convex query boundary

- Add temporary logging (or use an ad-hoc debug query) around:
  - `convex/functions/scheduledTrips/queries.ts:getScheduledTripsForTerminal`
- Specifically log:
  - `startingTrips.length`
  - unique `VesselAbbrev`s in `startingTrips`
  - unique `VesselAbbrev`s in the returned reconstructed journeys

If a vessel abbrev is missing already in `startingTrips`, the issue is in schedule sync
or the scheduledTrips table contents for that sailing day.

#### 2) If rows are missing in scheduledTrips, inspect schedule sync ingest skips

The sync pipeline constructs scheduled trips using:

- `convex/functions/scheduledTrips/sync/fetching/mapping.ts:createScheduledTrip()`

This returns `null` (skips the trip) when abbreviation resolution fails:

- vessel abbreviation lookup (`getVesselAbbreviation`)
- terminal abbreviation lookup (`getTerminalAbbreviation`)

Client-side we added conservative normalization for vessel names, but schedule sync runs
server-side; confirm what `getVesselAbbreviation` implementation is used at sync runtime
and whether upstream vessel names include prefixes like `M/V ...` or other formatting
that prevents abbreviation matching.

High-signal debug: log the raw `sailing.VesselName` values that fail abbreviation lookup.

#### 3) If scheduledTrips rows exist, inspect journey reconstruction filters

Reconstruction lives in:

- `convex/domain/scheduledTrips/journeys.ts`

Check for:

- destination filtering (`destinationAbbrev`) excluding journeys unexpectedly
- group selection logic in `findTargetTrip()` (indirect vs direct preference)
- chain building break conditions in `buildPhysicalChain()`

### Recommended minimal repro path

1. Pick a single problematic page: `(terminalAbbrev, destinationAbbrev?, sailingDay)`.
2. In Convex, query scheduledTrips with index `by_terminal_and_sailing_day` for that
   terminal/day and list the distinct `VesselAbbrev` values.
3. Compare to:
   - `getScheduledTripsForTerminal` return payload (journeys list of vesselAbbrev)
4. If the vessel exists in table but not in returned journeys, step through
   `reconstructJourneys()` for that vessel.

### Do not change (until root cause confirmed)

- Do not add additional inference heuristics in the UI to “guess missing vessels”.
  The schedule should be authoritative; if a vessel is missing, the fix belongs in
  schedule data ingest or journey reconstruction.

