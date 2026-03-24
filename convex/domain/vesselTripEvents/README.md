# VesselTripEvents Read Model

`vesselTripEvents` is a backend-owned read model for
`VesselTimeline`.

It exists to answer one question cleanly:

- for one vessel on one sailing day, what are the ordered dock-boundary events
  we should render right now?

This table is intentionally smaller and simpler than
`activeVesselTrips` / `completedVesselTrips`. It is not an audit log and it is
not the source of truth for the richer trip lifecycle pipeline. It is a mutable
read model that stores the best current boundary data for timeline rendering.

## Why This Exists

`VesselTimeline` used to require frontend-side merging of:

- scheduled trips
- active trips
- completed trips
- current vessel location

That made the UI responsible for source reconciliation and event precedence.

`vesselTripEvents` moves that responsibility to the backend by exposing:

- one ordered vessel/day event feed for timeline row construction
- one compact active-state snapshot for fast-changing live indicator state

This keeps the stable day feed separate from the frequently changing live
state. The event feed only invalidates when event rows change, while the active
state can update every vessel-location tick without forcing the client to
refetch the full day event payload.

## Table Shape

Stored fields:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `EventType`
- `ScheduledTime?`
- `PredictedTime?`
- `ActualTime?`

`EventType` is one of:

- `dep-dock`
- `arv-dock`

Stable identity:

- `Key = SailingDay--VesselAbbrev--ScheduledDepartureIsoUtc--DepartingTerminalAbbrev--EventKind`
- `ScheduledDepartureIsoUtc` is `toISOString()` with `T` replaced by `--`
- `EventKind` is `dep` or `arv`
- example:
  `2026-03-17--WEN--2026-03-18--04:35:00.000Z--P52--arv`

That identity is the anchor that lets schedule reseeds and live updates keep
touching the same logical boundary row over time.

## Ownership Model

The key policy is:

- future events are schedule-owned
- present and historical events are history-owned

That rule keeps schedule reseeds simple and safe.

Practical consequences:

- schedule sync may freely update future event schedule fields
- schedule sync must not overwrite historical `ActualTime`
- schedule sync must preserve present/historical rows even if WSDOT later
  changes the schedule
- future-only rows that disappear from schedule data may be deleted
- newly seeded past events are ignored, because the timeline should be driven
  by historical/live truth, not retroactive schedule edits

The merge policy lives in `convex/domain/vesselTripEvents/reseed.ts`.

## Data Sources

### 1. Schedule seeding and history enrichment

The day rebuild is backend-owned and independent from `scheduledTrips`
persistence.

Upstream flow:

```text
shared schedule fetch/transform
  -> raw WSF schedule rows
  -> classify direct vs indirect physical segments
  -> keep only direct physical segments
  -> build dep/arv boundary events
  -> fetch WSF vessel history for the same vessel/day set
  -> merge schedule seed + stored actuals + WSF history actuals
  -> write vesselTripEvents for that sailing day
```

For each direct physical segment:

- create one `dep-dock` event
- create one `arv-dock` event

Base schedule field mapping:

- departure event
  - `TerminalAbbrev = DepartingTerminalAbbrev`
  - `ScheduledTime = DepartingTime`
- arrival event
  - `TerminalAbbrev = ArrivingTerminalAbbrev`
  - `ScheduledTime = ArrivingTime ?? official crossing-time fallback`
  - if the scheduled arrival exactly equals the scheduled departure, subtract
    five minutes from the reported arrival time before seeding the feed

Seed generation lives in `convex/domain/vesselTripEvents/seed.ts`.

History-backed actual enrichment lives in:

- `convex/domain/vesselTripEvents/history.ts`

History source rules:

- departure actual source
  - WSF `ActualDepart`
- arrival actual source
  - WSF `EstArrival` proxy

Current matching policy is intentionally conservative:

- exact trip identity only
- vessel
- departing terminal
- arriving terminal
- scheduled departure timestamp

When a history-backed actual matches a seeded row:

- if the stored row has no `ActualTime`, backfill from WSF history
- departure rows keep the stored value when the delta from WSF `ActualDepart`
  is `< 3 minutes`, and replace it when the delta is `>= 3 minutes`
- arrival rows keep the stored value when the delta from WSF `EstArrival`
  is `< 2 minutes`, and replace it when the delta is `>= 2 minutes`

This keeps visible actual times stable across small WSF ETA drift while still
repairing polluted historical rows from prior bugs or feed noise.

The current seeding action lives in:

- `functions.vesselTripEvents.actions.syncVesselTripEventsManual`
- `functions.vesselTripEvents.actions.syncVesselTripEventsForDateManual`
- `functions.vesselTripEvents.actions.syncVesselTripEventsWindowed`
- `functions.vesselTripEvents.actions.syncVesselTripEventsAtSailingDayBoundary`
- explicit hard resets are available separately through:
  - `functions.vesselTripEvents.actions.resetVesselTripEventsManual`
  - `functions.vesselTripEvents.actions.resetVesselTripEventsForDateManual`

Those actions share the common schedule fetch path through:

- `convex/domain/scheduledTrips/fetchAndTransform.ts`

The sailing-day-boundary action is used by cron and is guarded by Pacific local
time because Convex cron expressions are UTC-only. Two UTC cron entries fire
daily, but only the invocation that lands in the Pacific `3 AM` hour performs
the rebuild.

### 2. Live enrichment

The `VesselOrchestrator` fetches vessel locations once and fans the same batch
out to multiple branches, including:

- `functions.vesselTripEvents.mutations.applyLiveUpdates`

This branch updates already-seeded events in place, mainly for in-progress and
future events after the daily rebuild has already backfilled completed rows
from WSF vessel history.

Live rules are intentionally lightweight:

- strong departure:
  - `AtDock === false && Speed >= 0.2`
- strong arrival:
  - `AtDock === true && Speed < 0.2`

Live update logic lives in `convex/domain/vesselTripEvents/liveUpdates.ts`.

## Update Rules

### Predictions

- departure prediction
  - while still docked, the matching departure event may carry
    `PredictedTime = ScheduledDeparture`
- arrival prediction
  - if `Eta` is present, the matching arrival event gets
    `PredictedTime = Eta`
  - fresher ETA data overwrites older arrival predictions

### Actuals

- historical rebuild actual
  - during the day seed, completed departures may be backfilled from WSF
    `ActualDepart`
  - completed arrivals may be backfilled from WSF `EstArrival` proxy
  - when both stored and WSF-history actuals exist:
    - departures use the `< 3 min keep / >= 3 min replace` rule
    - arrivals use the `< 2 min keep / >= 2 min replace` rule
- departure actual
  - when strong departure evidence appears, set
    `ActualTime = LeftDock ?? TimeStamp`
- arrival actual
  - when strong arrival evidence appears, first anchor by
    `ScheduledDeparture`
  - if the live location includes `ScheduledDeparture`, only the arrival row
    associated with that scheduled departure context is eligible
  - if no `ScheduledDeparture` is available, the fallback is the most recent
    eligible unresolved arrival event for the current terminal
  - if `PredictedTime` is earlier than `ScheduledTime`, that earlier prediction
    can make the event eligible before the scheduled arrival time

### False departure unwind

If a vessel appears to leave dock and then quickly appears docked again at the
same terminal before the paired arrival actualizes, clear the mistaken
departure `ActualTime`.

This protects the timeline from transient feed noise.

## Time Precedence

For display and state quality, the backend precedence is:

- `ActualTime` is best truth when present
- `PredictedTime` is mutable live guidance
- `ScheduledTime` is the fallback baseline

For `VesselTimeline` frontend layout geometry, the consumer now intentionally
uses a separate schedule-first precedence:

- `ScheduledTime`
- `ActualTime`
- `PredictedTime`

That keeps the rendered timeline stable while still exposing live truth for
labels and indicator behavior.

## Active State Contract

`VesselTimeline` consumes two backend queries:

- `functions.vesselTripEvents.queries.getVesselDayActiveState`

The first query is the stable vessel/day boundary feed used to build dock and
sea rows. The second query is a compact, fast-changing snapshot that resolves
which of those rows should currently be treated as active.

### Why the contract is split

Convex subscriptions rerun when their dependencies change. Current vessel
location changes roughly every five seconds, while `vesselTripEvents` rows only
change when a prediction or actual boundary field changes.

If the full event feed and live active state were combined into one query, the
entire event list for the vessel/day would become eligible to invalidate every
live vessel-location tick. Keeping them separate preserves the efficient update
cadence of the day feed while still allowing the active indicator to react to
live state.

### `getVesselDayActiveState` shape

The compact active-state query returns:

- `VesselAbbrev`
- `SailingDay`
- `ObservedAt?`
- `Live`
- `ActiveState`

`Live` includes only the minimal current vessel fields the timeline needs:

- `VesselName?`
- `AtDock?`
- `InService?`
- `Speed?`
- `DepartingTerminalAbbrev?`
- `ArrivingTerminalAbbrev?`
- `DepartingDistance?`
- `ArrivingDistance?`
- `ScheduledDeparture?`
- `TimeStamp?`

`ActiveState` includes:

- `kind`
  - `dock`
  - `sea`
  - `scheduled-fallback`
  - `unknown`
- `rowMatch`
  - `{ kind, startEventKey, endEventKey }`
  - these are existing `vesselTripEvents.Key` values, not a second identity
    scheme
- `terminalTailEventKey?`
  - set only when the active indicator should target the frontend terminal-tail
    row created from the final arrival event
- `subtitle?`
- `animate`
- `speedKnots`
- `reason`
  - `location_anchor`
  - `open_actual_row`
  - `scheduled_window`
  - `fallback`
  - `unknown`

### Why `rowMatch` uses event keys

Frontend semantic rows are pair-derived from adjacent event rows:

- dock row: `arv-dock` + `dep-dock`
- sea row: `dep-dock` + `arv-dock`

Because most semantic row identity is derived from existing event pairs, the
backend resolves the active row by returning the exact `startEventKey` /
`endEventKey` pair. This lets the client match the correct semantic row
without introducing array-index coupling or a parallel identity scheme.

The one exception is the frontend terminal-tail row, which is synthesized from
the final arrival event. For that case the backend returns
`terminalTailEventKey` instead of inventing a second row-id format.

### Active-state resolution order

The backend resolver lives in:

- `convex/domain/vesselTripEvents/activeState.ts`

Resolution order:

1. location anchor
   - if `AtDock === true`, resolve the dock row for
     `DepartingTerminalAbbrev`, preferring the current
     `ScheduledDeparture` anchor when available
   - if `AtDock === false`, resolve the sea row for the current scheduled
     departure, falling back to terminal-pair matching when the live location
     omits `ScheduledDeparture`
2. open actual row fallback
   - use the most recent row whose start has actualized and whose end has not
3. scheduled-window fallback
   - use the row whose display-time window currently contains `ObservedAt`
4. terminal-tail fallback
   - when the feed ends in an eligible arrival and `ObservedAt` is at or past
     that final arrival, return `terminalTailEventKey` for that final event
5. edge fallback
   - before the first row, use the first row
6. unknown
   - when no rows exist or nothing can be matched safely

### What moved out of the frontend

The backend active-state query now owns:

- dock-vs-sea reconciliation when live vessel location and event actuals briefly
  disagree
- subtitle generation for the active indicator
- animation gating and speed payload
- exact row-pair resolution using event keys

The frontend still owns:

- semantic row construction from the stable day event feed
- matching `rowMatch` / `terminalTailEventKey` to a semantic row

This split keeps the product-critical “what row is active right now?” decision
backend-owned and debuggable, while preserving the existing row-building
pipeline on the client.

## Reseed Behavior

Two write modes exist:

### 1. Full replacement for backfills and reset-style seeds

Explicit hard resets currently call:

- `functions.vesselTripEvents.mutations.replaceForSailingDay`

This is a destructive replace for one `SailingDay`. It is intended for:

- full backfills
- purge-and-seed workflows
- resetting the complete scheduled skeleton for a day, including past rows

It now:

1. loads the existing sailing-day rows
2. validates that all new events belong to that sailing day
3. deletes existing rows for the day
4. dedupes incoming rows by `Key`
5. inserts the fresh sorted event set

Important implication:

- past rows are rebuilt from the latest schedule + history inputs during a full
  day seed
- existing stored `ActualTime` may still survive the rebuild when it stays
  within the history-drift threshold

### 2. Merge reseed for live-safe schedule refreshes

Normal syncs call:

- `functions.vesselTripEvents.mutations.reseedForSailingDay`

This is a merge-based reseed, not a destructive delete-and-reinsert. It:

1. loads the existing sailing-day rows
2. builds a fresh schedule seed
3. merges seed rows with existing rows using the ownership rules above
4. deletes obsolete future-only rows
5. inserts missing future rows
6. replaces changed rows only when the event payload actually differs
7. defensively collapses duplicate stored rows by `Key` while writing

Important implications:

- historical actuals survive mid-day schedule refreshes
- future schedule changes can still update the timeline
- obsolete future rows can be removed without destroying history
- newly seeded past rows are intentionally ignored in merge mode
- dirty duplicate rows should not leak back out to timeline consumers

## Query Contract

Frontend timeline consumers read stable semantic segments from
`functions.vesselTimeline.queries.getVesselDayTimelineSnapshot` and live
indicator state from `functions.vesselTripEvents.queries.getVesselDayActiveState`.

The day-feed query returns all rows for one:

- `VesselAbbrev`
- `SailingDay`

It returns them already sorted using the shared domain sort and defensively
deduped by `Key`.

The active-state query returns the compact live snapshot for the same vessel/day
scope. It reads the current vessel-location row plus the already-seeded
`vesselTripEvents` rows and resolves the active row against those existing
event identities.

## Relationship To Other Systems

### Compared with `vesselTrips/updates`

`vesselTrips/updates` is the richer trip lifecycle state machine.

It owns:

- active/completed trip state
- prediction lifecycle
- trip boundary transitions
- trip-level history and durations

`vesselTripEvents` owns:

- the minimal vessel/day event feed for `VesselTimeline`
- schedule/history/live reconciliation for dock-boundary rows

The two systems run in parallel from the same vessel-location batch, but serve
different product needs.

### Compared with frontend `VesselTimeline`

The backend owns:

- event identity
- source reconciliation
- schedule/history/live merge rules
- prediction/actual precedence
- active-row resolution for the live indicator
- active-indicator subtitle / animation / speed payload

The frontend owns:

- row building
- dock/sea segmentation
- active indicator rendering
- exact `rowMatch` to semantic-row lookup
- last-resort local fallback when a backend row match cannot be found

See:

- `src/features/VesselTimeline/ARCHITECTURE.md`

## File Map

### `convex/functions/vesselTripEvents/`

- `actions.ts`
  - manual/windowed seed and purge entrypoints for the read model
- `activeStateSchemas.ts`
  - validators and conversion helpers for the compact active-state query
- `schemas.ts`
  - Convex validator and domain conversion helpers
- `queries.ts`
  - public vessel/day event query with defensive `Key` dedupe
  - public compact active-state query for live indicator state
- `mutations.ts`
  - full replace, merge reseed, purge batching, and live event persistence
  - includes sailing-day validation for schedule writes

### `convex/domain/vesselTripEvents/`

- `activeState.ts`
  - backend resolver that maps current vessel location plus event feed to an
    exact active semantic-row pair and compact live indicator payload
- `seed.ts`
  - build schedule-derived dep/arv boundary rows from either scheduled-trip
    rows or raw WSF schedule segments
- `history.ts`
  - match WSF vessel history to seeded rows and merge actual times with the
    source-specific replacement rules for departures and arrivals
- `liveUpdates.ts`
  - apply live vessel-location evidence to seeded rows
- `reseed.ts`
  - merge fresh seed data with existing rows safely
- `tests/`
  - focused domain tests for seed, reseed, key format, reconciliation rules,
    and active-state resolution

## Important Invariants

- `Key` must remain stable for the same logical schedule boundary
- `Key` is the canonical identity for a vessel trip event row
- active-state row matching must use existing event keys, not array indices
- only direct physical scheduled segments should seed rows
- only exact schedule/history matches should backfill actuals in the current
  implementation
- full replacement is allowed for explicit backfill/reset workflows
- historical rows must not be destroyed by mid-day schedule churn
- when `ScheduledDeparture` is present in live data, arrival resolution must be
  anchored to that scheduled departure context
- terminal-only arrival fallback is allowed only when `ScheduledDeparture` is
  absent
- reseed inputs must all belong to the requested `SailingDay`
- unchanged rows should not be rewritten

## Suggested Reading Order

For future agents, this is the fastest path:

1. this README
2. `convex/domain/vesselTripEvents/reseed.ts`
3. `convex/domain/vesselTripEvents/liveUpdates.ts`
4. `convex/domain/vesselTripEvents/activeState.ts`
5. `convex/functions/vesselTripEvents/mutations.ts`
6. `convex/functions/vesselTripEvents/queries.ts`
7. `src/features/VesselTimeline/ARCHITECTURE.md`
