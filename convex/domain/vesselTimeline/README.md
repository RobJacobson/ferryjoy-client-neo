## VesselTimeline Backend Domain

This folder contains the backend domain logic for the normalized,
boundary-event-based `VesselTimeline` system.

The core simplification is this:

- persistence stores boundary events
- structure is derived from adjacent ordered events
- live attachment chooses one derived interval
- displayed times are overlays and never decide ownership

That last point is the architectural shift. The old failure mode was treating
scheduled, predicted, or actual timestamps as if they identified which dock
stay "belonged" to which trip. They do not. In real operations, those times
can cross, drift, or arrive late. Structural adjacency is much more stable.

## The Mental Model

Think in three layers:

1. Boundary events are persisted facts.
2. Adjacent intervals are derived structural facts.
3. `activeInterval` is the current live attachment to one interval.

```text
Persisted tables
  eventsScheduled   eventsActual   eventsPredicted
         |               |                |
         +---------------+----------------+
                         |
                         v
               merge into ordered events
                         |
                         v
           build adjacent structural intervals
                         |
                         v
          attach live vessel location to one interval
                         |
                         v
      return event-first view model + activeInterval + live
```

## Why Adjacent Intervals

The public timeline is still event-first, but interval identity is now derived
once from event adjacency instead of repeatedly re-inferred from timestamps.

The important distinction is:

- timestamps answer "when should we display this boundary?"
- adjacency answers "which interval exists between these boundaries?"

That means delayed or stale predictions may change a displayed time without
changing interval ownership.

## Persisted Sources Of Truth

There is no snapshot table and no legacy vessel/day timeline table. The
timeline is assembled from normalized sources:

- `eventsScheduled`
- `eventsActual`
- `eventsPredicted`
- `vesselLocations`

### `eventsScheduled`

This is the structural backbone.

Responsibilities:

- define which boundary events exist
- define event type: `dep-dock` or `arv-dock`
- define canonical segment identity
- define canonical terminal identity
- define scheduled times
- mark the final arrival of the sailing day for carry-in lookup

This table answers:

- what boundaries exist for the requested vessel/day?
- in what order do they appear?
- which departure and arrival belong to the same segment?

### `eventsActual`

This is a sparse overlay of observed actual times.

Responsibilities:

- store actual departure times
- store actual arrival times

This table never creates structure. It only annotates scheduled structure.

### `eventsPredicted`

This is a sparse overlay of currently displayable predicted times.

Responsibilities:

- store the best predicted time for an event key
- retain prediction metadata for backend debugging

Like actuals, predictions do not create structure.

### `vesselLocations`

This is the live attachment input.

Responsibilities:

- say whether the vessel is currently at dock or at sea
- expose the observed terminal and live segment key hints
- expose `TimeStamp` for `ObservedAt`

The timeline query uses `vesselLocations` as the only live-state source.

## The Structural Model

The backend derives intervals from one ordered event list.

The shared helper lives at:

- `convex/shared/timelineIntervals.ts`

It converts an ordered list of boundary events into two interval types:

- `at-dock`
- `at-sea`

### Interval Shapes

`at-dock`

- `terminalAbbrev`
- `startEventKey: string | null`
- `endEventKey: string | null`
- `previousSegmentKey: string | null`
- `nextSegmentKey: string | null`

`at-sea`

- `segmentKey`
- `startEventKey: string`
- `endEventKey: string`

The `previousSegmentKey` and `nextSegmentKey` fields are not persisted
neighbors. They are just lightweight structural context used to break ties
when more than one dock interval exists at the same terminal.

### Derivation Rules

Given adjacent ordered events:

```text
null -> dep-dock        => opening dock interval
arv-dock -> dep-dock    => dock interval
dep-dock -> arv-dock    => sea interval
arv-dock -> null        => terminal-tail dock interval
invalid adjacent pair   => ignore
```

Examples:

```text
Example A: opening dock interval

  [null]
     |
     v
  trip-2--dep-dock (CLI)

  => at-dock
     startEventKey = null
     endEventKey   = trip-2--dep-dock
```

```text
Example B: normal dock interval

  trip-1--arv-dock (P52)
           |
           v
  trip-2--dep-dock (P52)

  => at-dock
     startEventKey = trip-1--arv-dock
     endEventKey   = trip-2--dep-dock
```

```text
Example C: sea interval

  trip-2--dep-dock
          |
          v
  trip-2--arv-dock

  => at-sea
     startEventKey = trip-2--dep-dock
     endEventKey   = trip-2--arv-dock
```

```text
Example D: terminal tail

  trip-9--arv-dock (BBI)
           |
           v
         [null]

  => at-dock
     startEventKey = trip-9--arv-dock
     endEventKey   = null
```

Invalid seams are ignored on purpose. We no longer patch them into existence.

## Backend Read Path

The public query is still one vessel and one sailing day. The loader may
prepend one previous-day arrival if the visible day starts with a departure
and that arrival is needed to anchor the first dock interval.

```text
getVesselTimelineViewModel(VesselAbbrev, SailingDay)
  |
  v
loaders.ts
  |
  |-- load same-day scheduled events
  |-- load same-day actual overlays
  |-- load same-day predicted overlays
  |-- load vesselLocations row
  |-- maybe load one previous-day final arrival
  |
  v
viewModel.ts
  |
  |-- mergeTimelineEvents(...)
  |-- resolveActiveInterval(...)
  |-- map live state for UI
  |
  v
{
  VesselAbbrev,
  SailingDay,
  ObservedAt,
  events,
  activeInterval,
  live,
}
```

## Active Interval Resolution

`activeInterval.ts` consumes:

- ordered merged events
- current `vesselLocations` row

It does not scan by time proximity.

### At-Sea Resolution

At sea is simple:

- build adjacent intervals
- find the unique `at-sea` interval whose `segmentKey === location.Key`
- if there is not exactly one match, return `null`

```text
location.AtDock = false
location.Key    = trip-7

intervals:
  at-dock CLI -> trip-7--dep
  at-sea  trip-7--dep -> trip-7--arv   <- match
  at-dock trip-7--arv -> trip-8--dep

activeInterval = { kind: "at-sea", startEventKey, endEventKey }
```

### At-Dock Resolution

At dock is still structural:

1. Build adjacent intervals.
2. Filter to `at-dock` intervals at `location.DepartingTerminalAbbrev`.
3. If exactly one candidate exists, use it.
4. If multiple candidates exist, use `location.Key` only as a structural
   tiebreak against `previousSegmentKey` or `nextSegmentKey`.
5. If still ambiguous, return `null`.

```text
location.AtDock = true
location.DepartingTerminalAbbrev = P52
location.Key = trip-4

candidates at P52:

  Dock A: previousSegmentKey = trip-3, nextSegmentKey = trip-4  <- match
  Dock B: previousSegmentKey = trip-9, nextSegmentKey = trip-10

activeInterval = Dock A
```

No scheduled, predicted, or actual timestamp is used to choose between dock
intervals.

## Carry-In Arrival Behavior

The read path is same-day scoped, but a pure same-day slice can miss the
arrival that structurally owns the first dock stay.

To keep the first dock interval real without loading the entire previous day,
the loader does one indexed lookup:

```text
requested sailing day starts with dep-dock at terminal CLI
and no earlier same-day arv-dock exists at CLI
  |
  v
lookup previous day's flagged final arrival
  |
  +-- same terminal => prepend it
  |
  +-- different terminal or missing => no carry-in
```

That is the only cross-day continuity rule in the public timeline read path.

## Shared Structural Reuse Outside The Timeline Query

The adjacent-interval model is not just for `VesselTimeline`.

`convex/functions/eventsScheduled/segmentResolvers.ts` uses the same shared
interval builder for schedule-side ownership lookups that support
`vesselTrips`.

That means the same structural rule now applies in both places:

- derive dock ownership from adjacent ordered boundary events
- never derive dock ownership from timestamp proximity

## Data Flow

```text
Schedule sync
  |
  |-- transform direct physical schedule segments
  |-- build boundary-event records
  |-- merge WSF history actuals
  |-- replace eventsScheduled
  |-- replace eventsActual

Live location updates
  |
  |-- update vesselLocations
  |-- update active vessel trips
  |-- emit actual boundary effects
  |-- project affected eventsActual rows

Trip / prediction updates
  |
  |-- compute best prediction per boundary key
  |-- emit prediction boundary effects
  |-- project affected eventsPredicted rows

Public timeline query
  |
  |-- load same-day events and live row
  |-- optionally prepend one carry-in arrival
  |-- merge overlays onto scheduled structure
  |-- derive adjacent intervals
  |-- resolve activeInterval structurally
  |
  v
Frontend receives event-first payload
```

## Backend Guarantees

- `eventsScheduled` is the only structural source of truth
- `eventsActual` and `eventsPredicted` are overlays only
- event identity comes from stable boundary keys
- interval identity comes from adjacency, not from timestamps
- the public query stays scoped to one vessel and one sailing day
- the only cross-day carry is one optional previous-day arrival
- `vesselLocations` is the only live-state source for query-time attachment
- dock ambiguity returns `null` instead of guessing
- delayed arrivals do not steal ownership from their structural dock interval
- invalid seams are ignored rather than patched into inferred intervals

## Core Files

- `timelineEvents.ts`
  Merges scheduled, actual, and predicted rows into ordered public events.
- `activeInterval.ts`
  Resolves the backend-owned active interval from live state and intervals.
- `viewModel.ts`
  Assembles the final event-first query payload.
- `convex/shared/timelineIntervals.ts`
  Shared adjacent-interval derivation used by the timeline and schedule
  ownership helpers.
- `convex/functions/vesselTimeline/loaders.ts`
  Loads query inputs and the optional carry-in arrival.
- `convex/functions/eventsScheduled/segmentResolvers.ts`
  Reuses the same interval model for scheduled dock ownership lookups.

## Suggested Reading Order

1. this README
2. `convex/shared/timelineIntervals.ts`
3. `timelineEvents.ts`
4. `activeInterval.ts`
5. `viewModel.ts`
6. `convex/functions/vesselTimeline/loaders.ts`
7. `convex/functions/vesselTimeline/queries.ts`
8. `convex/functions/eventsScheduled/segmentResolvers.ts`
9. `src/features/VesselTimeline/docs/ARCHITECTURE.md`
