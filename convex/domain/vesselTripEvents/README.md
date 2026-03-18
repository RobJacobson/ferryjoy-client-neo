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

`vesselTripEvents` moves that responsibility to the backend by exposing one
ordered vessel/day event feed with only the fields the timeline needs.

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

### 1. Schedule seeding

The seed comes from the scheduled-trips sync pipeline, not from the
orchestrator.

Upstream flow:

```text
WSF schedule sync
  -> raw schedule rows
  -> classify direct vs indirect marketing trips
  -> keep only direct physical segments
  -> build dep/arv boundary events
  -> merge into vesselTripEvents for that sailing day
```

For each direct physical segment:

- create one `dep-dock` event
- create one `arv-dock` event

Field mapping:

- departure event
  - `TerminalAbbrev = DepartingTerminalAbbrev`
  - `ScheduledTime = DepartingTime`
- arrival event
  - `TerminalAbbrev = ArrivingTerminalAbbrev`
  - `ScheduledTime = ArrivingTime ?? SchedArriveNext`

Seed generation lives in `convex/domain/vesselTripEvents/seed.ts`.

### 2. Live enrichment

The `VesselOrchestrator` fetches vessel locations once and fans the same batch
out to multiple branches, including:

- `functions.vesselTripEvents.mutations.applyLiveUpdates`

This branch updates already-seeded events in place.

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

- departure actual
  - when strong departure evidence appears, set
    `ActualTime = LeftDock ?? TimeStamp`
- arrival actual
  - when strong arrival evidence appears, resolve the most recent eligible
    unresolved arrival event for the current terminal
  - if `PredictedTime` is earlier than `ScheduledTime`, that earlier prediction
    can make the event eligible before the scheduled arrival time

### False departure unwind

If a vessel appears to leave dock and then quickly appears docked again at the
same terminal before the paired arrival actualizes, clear the mistaken
departure `ActualTime`.

This protects the timeline from transient feed noise.

## Time Precedence

For display and state quality, the precedence is:

- `ActualTime` is best truth when present
- `PredictedTime` is mutable live guidance
- `ScheduledTime` is the fallback baseline

## Reseed Behavior

Scheduled-trip sync calls:

- `functions.vesselTripEvents.mutations.reseedForSailingDay`

This is a merge-based reseed, not a destructive delete-and-reinsert. It now:

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
- dirty duplicate rows should not leak back out to timeline consumers

## Query Contract

Frontend timeline consumers read from:

- `functions.vesselTripEvents.queries.getVesselDayTimelineEvents`

The query returns all rows for one:

- `VesselAbbrev`
- `SailingDay`

It returns them already sorted using the shared domain sort and defensively
deduped by `Key`.

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
- schedule/live reconciliation for dock-boundary rows

The two systems run in parallel from the same vessel-location batch, but serve
different product needs.

### Compared with frontend `VesselTimeline`

The backend owns:

- event identity
- source reconciliation
- schedule/live merge rules
- prediction/actual precedence

The frontend owns:

- row building
- dock/sea segmentation
- compression of long dock spans
- active indicator rendering

See:

- `src/features/VesselTimeline/ARCHITECTURE.md`

## File Map

### `convex/functions/vesselTripEvents/`

- `schemas.ts`
  - Convex validator and domain conversion helpers
- `queries.ts`
  - public vessel/day event query with defensive `Key` dedupe
- `mutations.ts`
  - schedule reseed merge + live event persistence
  - includes sailing-day validation for reseeds

### `convex/domain/vesselTripEvents/`

- `seed.ts`
  - build schedule-derived dep/arv boundary rows
- `liveUpdates.ts`
  - apply live vessel-location evidence to seeded rows
- `reseed.ts`
  - merge fresh seed data with existing rows safely
- `tests/`
  - focused domain tests for seed, reseed, key format, and reconciliation rules

## Important Invariants

- `Key` must remain stable for the same logical schedule boundary
- `Key` is the canonical identity for a vessel trip event row
- only direct physical scheduled segments should seed rows
- historical rows must not be destroyed by mid-day schedule churn
- arrival resolution is terminal-based and chooses the most recent eligible
  unresolved arrival
- reseed inputs must all belong to the requested `SailingDay`
- unchanged rows should not be rewritten

## Suggested Reading Order

For future agents, this is the fastest path:

1. this README
2. `convex/domain/vesselTripEvents/reseed.ts`
3. `convex/domain/vesselTripEvents/liveUpdates.ts`
4. `convex/functions/vesselTripEvents/mutations.ts`
5. `src/features/VesselTimeline/ARCHITECTURE.md`
