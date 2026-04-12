# VesselTimeline Architecture

`VesselTimeline` is split into two clear responsibilities:

- the backend returns the timeline backbone for the current sailing day
- the client derives the active interval and indicator position

That boundary keeps the timeline query stable and prevents live
`VesselLocation` ticks from forcing a full timeline reread.

## Backend Contract

The public Convex query is:

- `functions/vesselTimeline/queries.getVesselTimelineBackbone`

It returns:

```ts
{
  VesselAbbrev,
  SailingDay,
  events,
}
```

The backend query reads only:

- same-day `eventsScheduled`
- same-day `eventsActual`
- same-day `eventsPredicted`

It does not read:

- `vesselLocations`
- previous-day carry-in rows
- any backend-owned `activeInterval`

## Client Responsibilities

The client already has real-time vessel location through the existing location
data source. `VesselTimeline` combines that with the backbone in two pure steps:

1. derive `activeInterval` from the ordered timeline events
2. compute indicator placement from `activeInterval + VesselLocation`

The active interval is derived with actual-only semantics:

- latest actual `dep-dock` => active sea interval
- latest actual `arv-dock` => active dock interval
- no actuals yet => opening dock interval
- predicted and scheduled times never change ownership

Indicator placement is then:

- at dock: time-based interpolation within the dock row
- at sea: distance-based interpolation within the sea row

## Render Pipeline

The presentation flow is now:

```text
backbone events
  -> derive active interval
  -> derive rows
  -> resolve active row
  -> compute indicator from VesselLocation
```

Terminal card geometry is derived alongside render rows:

- a dock row followed by a matching sea row renders as one merged glass card
- the merged card is anchored by the dock row and spans both rows
- the sea row renders no separate card background, only foreground content
- standalone dock rows still render a single card with a top cap only

This avoids split-card seams while keeping the row timestamps and marker-centered
row boundaries unchanged.

This makes the render pipeline deterministic and easy to reason about. The
timeline structure only changes when the backbone changes:

- schedule reseeds
- actual arrival/departure writes
- prediction writes

Location-only updates stay local to indicator rendering.

## Why This Split Matters

The old architecture mixed:

- structural timeline data
- live vessel state
- indicator presentation

That caused unnecessary query invalidation and made active-segment resolution
harder than it needed to be.

The current model keeps the authoritative data small and stable:

- backend owns structure and overlays
- client owns presentation and motion

Given the same backend inputs, every client derives the same `activeInterval`
because it is a pure function.
