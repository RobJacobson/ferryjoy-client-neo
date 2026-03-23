# VesselTimeline Architecture

This document describes the current architecture for the `VesselTimeline`
feature.

`VesselTimeline` renders one continuous day timeline for one vessel on one
requested sailing day. The feature is event-based: the backend assembles a
minimal ordered list of dock boundary events, and the frontend converts adjacent
event pairs into dock and sea rows for display.

## Scope

Public API (see `VesselTimeline.tsx`):

```ts
// `TimelineVisualThemeOverrides` is imported from `@/components/timeline`.
type VesselTimelineProps = {
  vesselAbbrev: string;
  sailingDay: string;
  routeAbbrevs: string[];
  now?: Date;
  theme?: TimelineVisualThemeOverrides;
};
```

Notes:

- `vesselAbbrev` and `sailingDay` define the vessel/day scope passed into
  `ConvexVesselTripEventsProvider`.
- `routeAbbrevs` is kept for callers and screen composition but is **not** read
  by the timeline pipeline today (the data path is vessel-centric only).
- `now` is optional and mainly supports deterministic rendering and tests.
- `theme` is optional; it is merged via `createTimelineVisualTheme` and flows
  through `getVesselTimelineRenderState` into shared timeline components.
  The theme contract is intentionally narrow: it controls palette/material
  tokens for the shared timeline, not typography or layout geometry.
  `outlines.color` is an explicitly exposed legibility token and should be
  adjusted sparingly. Very dark themes often work best with near-none or no
  outline at all, while moderately dark themes may benefit from a very slight
  outline.
  Current named presets include `Sea Glass` (default), `Harbor Dawn`,
  `Carnival Fizz`, `Taffy Harbor`, `Kelp Disco`, `Confetti Tide`,
  `Moon Jelly`, and `Picnic Postcard`.

## Product Decisions

### Timeline window

The visible timeline is a service-day timeline, not a literal 3:00 AM to
2:59 AM berth-occupancy timeline.

Product intent:

- Start at the vessel's first scheduled departure for the requested sailing
  day.
- End at the vessel's last scheduled arrival for the requested sailing day.
- Overnight pre-service and post-service berth occupancy are not rendered as
  full proportional dock periods.

In code, the rendered window is exactly the ordered `Events` returned for that
`VesselAbbrev` + `SailingDay`; bounding the feed to first departure / last
arrival is a **backend seeding** responsibility (`vesselTripEvents`), not
something the React feature recomputes from raw schedule tables.

### Sailing-day boundary

Sailing day for labels, queries, and `getSailingDay` is defined in Pacific time
as **3:00 AM through 2:59 AM** (times before 3:00 AM Pacific belong to the
previous calendar day’s sailing day). See `convex/shared/time.ts`
(`getSailingDay`). Some cron or action comments elsewhere may still mention
4:00 AM; the implemented cutoff is 3:00 AM Pacific.

### Single-vessel v1

Version 1 remains scoped to one vessel at a time.

### Minimal backend contract

The backend owns reconciliation and returns only the minimum event data needed
to render the timeline.

- The frontend does not merge `ScheduledTrip`, `ActiveVesselTrip`, and
  `CompletedVesselTrip` records anymore.
- The frontend receives a sorted array of vessel/day events (via Convex query;
  see below).
- The frontend still owns row construction, dock/sea segmentation, compression,
  indicator behavior, and visual rendering.

### Long dock periods

Long dock periods are still represented as real dock spans, but they are
compressed in the UI. Defaults live in `DEFAULT_VESSEL_TIMELINE_POLICY`
(`getVesselTimelineRenderState.ts`).

- dock segment `< 60 min`: render proportionally
- dock segment `>= 60 min`: render as a compressed break row

Compressed break row layout:

- visible arrival stub: `10 min`
- break marker: explicit visual discontinuity (`compressedBreakMarkerHeightPx`
  in layout config)
- visible departure window: `50 min`

### Off-schedule / out-of-service behavior

The scheduled/event timeline remains visible even if the vessel is no longer
following the expected path.

Primary signals:

- `VesselLocation.InService === false`
- live vessel state no longer aligns with expected progression

Current UI behavior (see `getActiveRowIndex.ts` / `TimelineContent.tsx`):

- Timeline and active indicator stay on screen when data loads.
- When `InService === false`, the indicator stops speed-based rocking
  (`animate` is gated off); there is not yet a dedicated “unreliable live data”
  banner—treat richer warnings as future work if product requires them.

## Why This Is A Separate Feature

`VesselTripTimeline` is specialized around one current trip and a fixed
three-row model. `VesselTimeline` instead needs:

- a complete vessel-day document
- any number of alternating dock and sea rows
- compressed long-dock behavior
- a vessel-centric data source
- a live indicator driven by current vessel location

The feature therefore has its own backend contract and feature-local pipeline,
while still sharing generic timeline presentation primitives with
`VesselTripTimeline`.

## Data Architecture

### Backend-owned event feed

The client loads the vessel/day feed with:

- `api.functions.vesselTripEvents.queries.getVesselDayTimelineEvents`
  (Convex: `functions/vesselTripEvents/queries.ts`)

The query returns `{ VesselAbbrev, SailingDay, Events }`. Each persisted event
uses epoch milliseconds for timestamps; `ConvexVesselTripEventsContext` maps
rows through `toDomainVesselTripEvent` so the React tree sees `Date` fields.

Domain / UI shape (alias: `VesselTimelineEvent` = `VesselTripEvent` in
`ConvexVesselTripEventsContext.tsx`):

```ts
type VesselTimelineEvent = {
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: Date;
  TerminalAbbrev: string;
  EventType: "dep-dock" | "arv-dock";
  ScheduledTime?: Date;
  PredictedTime?: Date;
  ActualTime?: Date;
};
```

Important characteristics:

- events are scoped to one vessel and one sailing day
- the query sorts and **dedupes by `Key`**, then applies
  `normalizeScheduledDockSeams` before returning
- each direct physical scheduled segment contributes two event boundaries:
  - departure from a terminal (`dep-dock`)
  - arrival at a terminal (`arv-dock`)
- stable row identity uses `buildEventKey` in
  `convex/domain/vesselTripEvents/liveUpdates.ts`:

`Key = SailingDay--VesselAbbrev--<ScheduledDeparture ISO with "T" replaced by "--">--DepartingTerminalAbbrev--dep|arv`

  - The fourth segment is always the segment’s **departing** terminal abbrev
    (same for both dep and arrival rows for that segment).
  - The suffix is `dep` or `arv` (not `dep-dock` / `arv-dock`).

### `vesselTripEvents` table

The persistent backend read model is the Convex table:

- `vesselTripEvents`

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

This table exists specifically to support `VesselTimeline`. It is intentionally
smaller than the trip lifecycle tables and is not an audit log. It is a mutable
read model that stores the best current event data for one vessel/day.

### Schedule seeding and historical backfill

The event skeleton is seeded during scheduled-trip sync.

Source of truth for seeding:

- raw WSF schedule data, transformed into direct physical scheduled segments
- WSF vessel history for completed trips on the same sailing day

The schedule pipeline classifies direct vs indirect marketing trips and then
creates seed events only from direct segments. For each direct segment:

- create one `dep-dock` event
- create one `arv-dock` event

Field creation rules (see `convex/domain/vesselTripEvents/seed.ts`):

- `Key`: from `buildEventKey` (see above), not a naive concatenation of fields
- `ScheduledDeparture`: segment departure time (epoch ms in Convex)
- `TerminalAbbrev`: departing terminal for `dep-dock`, arriving terminal for
  `arv-dock`
- `ScheduledTime`: departure event: segment departure; arrival event:
  `ArrivingTime ?? SchedArriveNext` (normalized)
- `PredictedTime`: omitted at seed time
- `ActualTime`: omitted at raw schedule seed time

After the direct schedule skeleton is built, the backend may backfill completed
rows from WSF vessel history:

- departure actual source
  - WSF `ActualDepart`
- arrival actual source
  - WSF `EstArrival` proxy

When a stored `ActualTime` already exists for the same logical event:

- departure rows keep it when the delta from WSF `ActualDepart` is `< 3 minutes`
- departure rows replace it when the delta is `>= 3 minutes`
- arrival rows keep it when the delta from WSF `EstArrival` proxy is `< 2 minutes`
- arrival rows replace it when the delta is `>= 2 minutes`

This creates a stable vessel/day event skeleton before any live data arrives.

### Live enrichment

Live `VesselLocation` updates enrich the seeded event rows in place.

The orchestrator fetches vessel locations once, converts them to the Convex
shape, and passes the same location batch to three error-isolated backend
branches (`convex/functions/vesselOrchestrator/actions.ts`):

1. store the latest `vesselLocations` (`bulkUpsert`)
2. update trip lifecycle tables via `runUpdateVesselTrips`
3. update `vesselTripEvents` via `applyLiveUpdates`

For `VesselTimeline`, live updates use lightweight event rules rather than
the full trip lifecycle model. Their main job is to refine in-progress and
future rows after the daily rebuild has already populated completed rows from
schedule/history sources.

Departure / arrival evidence:

- strong departure:
  - `AtDock === false && Speed >= 0.2`
- strong arrival:
  - `AtDock === true && Speed < 0.2`

Update rules:

- departure event prediction
  - when the vessel is still at dock and the matching departure event has no
    actual time, `PredictedTime` is set from `ScheduledDeparture`
- arrival event prediction
  - when `Eta` is present and the matching arrival event has no actual time,
    `PredictedTime` is updated from `Eta`
  - newer arrival-side predictions overwrite older ones on the same event row
- departure actual
  - when strong departure evidence exists, set `ActualTime` from
    `LeftDock ?? TimeStamp`
- arrival actual
  - when strong arrival evidence exists, resolve the most recent unresolved
    arrival event for the current terminal and set `ActualTime = TimeStamp`
- false departure unwind
  - if the vessel quickly appears docked again at the same terminal before the
    paired arrival has actualized, clear the mistaken departure `ActualTime`

Field precedence:

- display/state quality:
  - `ActualTime` is the best truth when present
  - `PredictedTime` is mutable and may be overwritten by better live data
  - `ScheduledTime` remains the fallback baseline
- layout geometry (frontend `getLayoutTime` in `rowEventTime.ts`):
  - `ScheduledTime` is the stable baseline for row sizing and positioning
  - `ActualTime` is the fallback when schedule time is missing
  - `PredictedTime` is the last-resort fallback when neither scheduled nor
    actual time exists

Presentation rows map `PredictedTime` into the shared type’s `estimated` time
field (`TimelineTimePoint.estimated` in `src/components/timeline/types.ts`).

### Frontend context

`VesselTimeline` consumes a dedicated vessel/day context:

- `src/data/contexts/convex/ConvexVesselTripEventsContext.tsx`

Hook: `useConvexVesselTripEvents()`. Typical value shape:

```ts
type ConvexVesselTripEventsValue = {
  VesselAbbrev: string;
  SailingDay: string;
  Events: VesselTimelineEvent[];
  VesselLocation?: VesselLocation;
  IsLoading: boolean;
  Error: string | null;
};
```

Data sources:

- `getVesselDayTimelineEvents` for `Events`
- `api.functions.vesselLocation.queries.getByVesselAbbrev` for
  `VesselLocation`

Responsibilities:

- fetch the backend-owned vessel/day event feed
- fetch the current `VesselLocation`
- expose both in one vessel/day-scoped context

The context no longer merges raw scheduled, active, and completed trip arrays
client-side.

## Frontend Pipeline

The frontend pipeline is event-based and intentionally small. The orchestration
entry point is `getVesselTimelineRenderState` in
`utils/pipeline/getVesselTimelineRenderState.ts`.

### Stage 1: Row construction

`utils/pipeline/buildTimelineRows.ts` builds **semantic** rows directly from
adjacent `VesselTimelineEvent` pairs.

Rules:

- dock row:
  - current event is `arv-dock`
  - next event is `dep-dock`
  - both share the same terminal
- sea row:
  - current event is `dep-dock`
  - next event is `arv-dock`
- arrival placeholder dock row:
  - when a sea row starts at a `dep-dock` that is **not** immediately preceded
    by an `arv-dock` at the same terminal, insert a zero-duration placeholder
    dock row so the UI still has an “arrival” side for that terminal
- terminal tail row:
  - if the final event is an arrival, append a zero-duration terminal row
    (`isTerminal`)

Each semantic row carries:

- `startEvent` / `endEvent` (`TimelineRowEvent`: backend fields plus display
  name / placeholder flags)
- `kind` (`dock` | `sea`)
- `displayMode` (`proportional` | `compressed-dock-break`)
- `actualDurationMinutes` and `displayDurationMinutes`

Duration calculations use **schedule-first layout precedence** via
`getLayoutTime` (`ScheduledTime` → `ActualTime` → `PredictedTime`). That keeps
row heights stable as live predictions and actuals arrive. Labels and the
active indicator use **display-first** times via `getDisplayTime` (`ActualTime`
→ `PredictedTime` → `ScheduledTime`).

### Stage 2: Active row, layout, and render state

Still inside `getVesselTimelineRenderState`:

1. **`getAdaptivePixelsPerMinute`**: scales vertical density from event count
   (clamped), then builds an effective layout `{ ...layout, pixelsPerMinute }`.
2. **`getActiveRowIndex`** (`getActiveRowIndex.ts`): chooses the semantic row
   that owns the indicator (actual-backed “in progress” row preferred, else
   time window, else edges). `VesselLocation` is reserved for future selection
   rules; indicator **position within** the row uses location heavily.
3. **`getLayoutTimelineRows`**: converts semantic rows to
   `TimelineRenderRow[]`, marker past/future from the active index, terminal
   card geometry, and `contentHeightPx`.
4. **`buildActiveIndicator`**: builds `TimelineActiveIndicator | null` (badge,
   banner copy, sea speed / distance subtitle, `animate` + `speedKnots`).

The UI layer (`components/TimelineContent.tsx`) only consumes
`VesselTimelineRenderState`: shared timeline components render rows, track,
terminal blurs, and `TimelineIndicatorOverlay`.

`VesselLocation` remains important even though the timeline rows come from
events:

- it helps place the active indicator within the current row (especially at
  sea, via distance or time progress)
- it contributes at-dock vs at-sea presentation details
- `InService` gates rocking animation on the indicator

## Source Of Truth Boundaries

The current design intentionally separates concerns:

- `ScheduledTrips`
  - still exists as a richer backend schedule model
  - seeds the `vesselTripEvents` skeleton through direct physical segments
- `vesselTripEvents`
  - the backend-owned read model consumed by `VesselTimeline`
- `VesselLocation`
  - the live operational source used to enrich event rows and drive the active
    indicator
- `activeVesselTrips` / `completedVesselTrips`
  - still power other features and backend logic
  - no longer form the frontend contract for `VesselTimeline`

## Current End-To-End Flow

```text
WSF schedule feed
  -> direct-segment classification
  -> seed vesselTripEvents for each vessel/day

WSF vessel locations
  -> VesselOrchestrator fetch + conversion
  -> store vesselLocations
  -> update vesselTrips lifecycle tables
  -> enrich vesselTripEvents with predicted/actual event times

Frontend VesselTimeline
  -> getVesselDayTimelineEvents + getByVesselAbbrev (via context)
  -> getVesselTimelineRenderState
       -> buildTimelineRows (events -> semantic dock/sea rows)
       -> getActiveRowIndex + buildActiveIndicator
       -> getLayoutTimelineRows (semantic rows -> TimelineRenderRow + cards)
  -> TimelineContent: shared timeline components + indicator overlay
```
