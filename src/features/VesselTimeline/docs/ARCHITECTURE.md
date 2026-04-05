# VesselTimeline Architecture

`VesselTimeline` shows one vessel for one sailing day as alternating dock and
sea rows. The frontend does not infer trip ownership from clocks. It receives
ordered backend events plus one backend-owned `activeInterval`, then projects
that structural model into UI rows and indicator geometry.

This document explains the current client model after the adjacent-interval
refactor.

## Product Boundaries

- scope is one vessel and one sailing day
- the timeline is a service-day view, not a full berth occupancy history
- the service day follows Pacific rules: `3:00 AM` through `2:59 AM`
- the visible structure is bounded by the backend event slice for that day,
  plus one possible prepended carry-in arrival

## Public API

```ts
type VesselTimelineProps = {
  vesselAbbrev: string;
  sailingDay: string;
  now?: Date;
  theme?: TimelineVisualThemeOverrides;
};
```

The feature asks the backend for one query result:

- ordered `events`
- `activeInterval`
- `ObservedAt`
- raw `live` state

The client never asks for rows directly.

## The Client Mental Model

The frontend works in four layers:

1. backend events are the source data
2. feature rows are a local presentation projection
3. renderer rows are layout-ready UI objects
4. the active indicator is positioned from the selected row plus live state

```text
Backend payload
  events + activeInterval + ObservedAt + live
                     |
                     v
           derive feature-owned rows
                     |
                     v
        map activeInterval to one derived row
                     |
                     v
      build renderer rows + row layouts + terminal cards
                     |
                     v
       place active indicator within the chosen row
                     |
                     v
            final VesselTimeline render state
```

## End-To-End Data Flow

This is the full flow from backend query to client rendering:

```text
ConvexVesselTimelineProvider
  |
  |-- getVesselTimelineViewModel(VesselAbbrev, SailingDay)
  |
  v
query result
  |
  |-- events
  |-- activeInterval
  |-- ObservedAt
  |-- live
  |
  v
getVesselTimelineRenderState(...)
  |
  |-- toDerivedRows
  |-- toActiveRow
  |-- toRenderRows
  |-- toActiveIndicator
  |-- toTimelineRenderState
  |
  v
VesselTimelineContent
```

Key boundary:

- backend owns structural truth and active attachment
- client owns row projection, layout, copy, and animation

## Why The Client Derives Rows

The backend returns events because events are the stable product contract.
Rows are a presentation concept:

- dock rows can be compressed visually
- start-of-day rows can have placeholder arrivals
- terminal-tail rows need special terminal stop rendering
- row IDs and row heights are UI concerns

If the backend returned rows directly, the client would inherit presentation
policy as data truth. Keeping rows local avoids that.

## Structural Input On The Client

The client now uses the same adjacent-interval helper concept as the backend.

The shared helper:

- `convex/shared/timelineIntervals.ts`

The render pipeline uses it in:

- `src/features/VesselTimeline/renderPipeline/toDerivedRows.ts`

That means backend and frontend agree on the same structural language:

- opening dock interval
- normal dock interval
- sea interval
- terminal-tail dock interval

## Row Derivation

`toDerivedRows.ts` converts adjacent intervals into feature rows.

### Structural Interval To Row Mapping

```text
Interval kind                     Client row
---------------------------------------------------------
opening at-dock                   at-dock row with
                                  placeholder arrival

normal at-dock                    at-dock row

at-sea                            at-sea row

terminal-tail at-dock             at-dock row with
                                  rowEdge = "terminal-tail"
```

### Examples

```text
Example A: opening dock interval

  interval:
    kind = at-dock
    startEventKey = null
    endEventKey   = trip-2--dep-dock

  row:
    kind = at-dock
    startEvent = synthetic arrival placeholder
    endEvent   = trip-2--dep-dock
    placeholderReason = start-of-day
```

```text
Example B: normal sea interval

  interval:
    kind = at-sea
    startEventKey = trip-2--dep-dock
    endEventKey   = trip-2--arv-dock

  row:
    kind = at-sea
    startEvent = dep-dock event
    endEvent   = arv-dock event
```

```text
Example C: terminal tail

  interval:
    kind = at-dock
    startEventKey = trip-9--arv-dock
    endEventKey   = null

  row:
    kind = at-dock
    rowEdge = terminal-tail
    startEvent = arrival event
    endEvent   = same arrival event
```

### Important Client Rule

The client ignores invalid non-adjacent seams. It does not repair them into
rows. That keeps presentation aligned with the backend structural model.

## Active Row Mapping

`toActiveRow.ts` maps the backend `activeInterval` onto a derived row.

This is intentionally simple:

- at sea: exact `startEventKey` and `endEventKey` match
- at dock: start and end keys match when present; `null` acts as an open edge

```text
Backend activeInterval
         |
         v
scan derived rows in order
         |
         +-- row matches structural keys -> choose it
         |
         +-- no match -> activeRow = null
```

Why this matters:

- the client is not re-solving ambiguity
- the backend has already chosen the structural interval
- the client only finds the corresponding local row projection

## Render-State Pipeline

The pipeline is intentionally linear:

```text
events
  |
  v
toDerivedRows
  |
  |-- build rows from adjacent intervals
  |
  v
toActiveRow
  |
  |-- map activeInterval to one row
  |
  v
toRenderRows
  |
  |-- compute row heights
  |-- compute row layouts
  |-- compute terminal cards
  |-- convert feature rows to shared renderer rows
  |
  v
toActiveIndicator
  |
  |-- compute indicator position and subtitle copy
  |
  v
toTimelineRenderState
```

## Timing Semantics On The Client

The client uses times in two different ways.

### Display Time Precedence

When showing times to the user:

1. `EventActualTime`
2. `EventPredictedTime`
3. `EventScheduledTime`

### Layout Time Precedence

When sizing rows:

1. `EventScheduledTime`
2. `EventActualTime`
3. `EventPredictedTime`
4. `ScheduledDeparture`

This split is deliberate:

- display wants the best user-facing truth
- layout wants stable geometry

Neither one changes interval identity.

## Backend / Client Responsibility Split

### Backend Owns

- loading the event slice
- optional carry-in arrival lookup
- merging actual and predicted overlays onto scheduled events
- structural interval derivation rules
- active attachment from raw live state against the event backbone
- ambiguity handling

### Client Owns

- row derivation from intervals
- placeholder arrival rendering for the opening dock interval
- terminal-tail row presentation
- row heights and card geometry
- terminal name shortening
- indicator position, copy, and animation
- scroll behavior

### Client Does Not Own

- choosing which trip owns a dock stay
- guessing across same-terminal ambiguity
- cross-day schedule continuity beyond the event slice it was given
- reconstructing structure from timestamp proximity

## File Guide

- `src/data/contexts/convex/ConvexVesselTimelineContext.tsx`
  Loads the backend query result.
- `src/features/VesselTimeline/renderPipeline/getVesselTimelineRenderState.ts`
  Public render-pipeline entrypoint.
- `src/features/VesselTimeline/renderPipeline/toDerivedRows.ts`
  Converts structural intervals into feature rows.
- `src/features/VesselTimeline/renderPipeline/toActiveRow.ts`
  Maps the backend active interval to one row.
- `src/features/VesselTimeline/renderPipeline/toRenderRows.ts`
  Computes renderer rows, layouts, and terminal cards.
- `src/features/VesselTimeline/renderPipeline/toActiveIndicator.ts`
  Computes indicator placement and copy.
- `src/features/VesselTimeline/VesselTimelineContent.tsx`
  Renders the final scrollable UI.

## Invariants

- the client query contract remains event-first
- rows are derived locally and are never persisted
- interval identity comes from adjacency, not timestamps
- `activeInterval` must identify one derived adjacent interval from the
  returned event slice
- `activeInterval` may be `null` when backend ownership is ambiguous or
  unsupported by the visible slice
- terminal-tail rows anchor the indicator to the arrival marker line
- start-of-day dock rows are ordinary dock intervals with a placeholder start
  event
