# VesselTimeline Architecture

This document describes the current architecture for the `VesselTimeline`
feature.

For a detailed investigation of the recurring Cathlamet / triangle-route
missing-segment anomaly and possible backend/frontend remedies, see
`CAT_MISSING_SEGMENT_MEMO.md`.

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
  now?: Date;
  theme?: TimelineVisualThemeOverrides;
};
```

Notes:

- `vesselAbbrev` and `sailingDay` define the vessel/day scope passed into
  `ConvexVesselTimelineProvider`.
- `now` is optional and mainly supports deterministic rendering and tests.
- `theme` is optional; it is merged via `createTimelineVisualTheme` and flows
  through `getVesselTimelineRenderState` into shared timeline components.
  The theme contract is intentionally narrow: it controls palette/material
  tokens for the shared timeline, not typography or layout geometry. Recent
  simplifications intentionally reduced independent color knobs:
  - marker uses a two-color accent/contrast swap for past vs future
  - text uses semantic roles (`terminalNameColor`,
    `indicatorHeadlineColor`, `bodyColor`) instead of per-subtree text tokens
  - glass surfaces share `glassColor` and `glassBorderColor`
  - the active indicator circle has its own emphasized `indicator.borderColor`
  - track glow and ping fill are derived in rendering from a single authored
    color rather than separate theme colors
  `outlines.color` is an explicitly exposed legibility token and should be
  adjusted sparingly. Very dark themes often work best with near-none or no
  outline at all, while moderately dark themes may benefit from a very slight
  outline.
  Current named presets include `Sea Glass` (default), `Harbor Dawn`,
  `Carnival Fizz`, `Taffy Harbor`, `Confetti Tide`,
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
- The frontend still owns row construction, dock/sea segmentation, indicator
  behavior, and visual rendering.

### Long dock periods

Long dock periods are rendered with the same schedule-based sizing rules as all
other rows in the current implementation.

- row heights are based on schedule-first duration math
- a minimum row height still protects readability when events are close
- future nonlinear scaling remains possible, but is not part of the current
  architecture

### Off-schedule / out-of-service behavior

The scheduled/event timeline remains visible even if the vessel is no longer
following the expected path.

Primary signals:

- `VesselLocation.InService === false`
- live vessel state no longer aligns with expected progression

Current UI behavior (see `resolveActiveSegmentIndex.ts`,
`buildActiveIndicator.ts`, and `TimelineContent.tsx`):

- Timeline and active indicator stay on screen when data loads.
- When `InService === false`, the indicator stops speed-based rocking
  (`animate` is gated off); there is not yet a dedicated “unreliable live data”
  banner—treat richer warnings as future work if product requires them.

## Why This Is A Separate Feature

`VesselTripTimeline` is specialized around one current trip and a fixed
three-row model. `VesselTimeline` instead needs:

- a complete vessel-day document
- any number of alternating dock and sea rows
- a vessel-centric data source
- a live indicator driven by current vessel location

The feature therefore has its own backend contract and feature-local pipeline,
while still sharing generic timeline presentation primitives with
`VesselTripTimeline`.

## Data Architecture

### Backend-owned semantic snapshot

The client loads stable timeline structure with:

- `api.functions.vesselTimeline.queries.getVesselDayTimelineSnapshot`
  (Convex: `functions/vesselTimeline/queries.ts`)

The snapshot query returns one persisted vessel/day document built from the
lower-level `vesselTripEvents` read model.

High-level shape:

```ts
type VesselTimelineSnapshot = {
  VesselAbbrev: string;
  SailingDay: string;
  SchemaVersion: number;
  GeneratedAt: Date;
  Segments: VesselTimelineSegment[];
};
```

Each segment is semantic rather than visual:

```ts
type VesselTimelineSegment = {
  id: string;
  segmentIndex: number;
  kind: "dock" | "sea";
  isTerminal?: boolean;
  placeholderReason?: "start-of-day" | "broken-seam";
  startEvent: TimelineBoundaryEvent;
  endEvent: TimelineBoundaryEvent;
  durationMinutes: number;
};
```

Important characteristics:

- snapshots are scoped to one vessel and one sailing day
- they are persisted as one document per vessel/day in
  `vesselTimelineSnapshots`
- they are derived from ordered normalized `vesselTripEvents`
- stable segment identity still traces back to event keys generated by
  `buildEventKey` in `convex/domain/vesselTripEvents/liveUpdates.ts`

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

- `src/data/contexts/convex/ConvexVesselTimelineContext.tsx`

Hook: `useConvexVesselTimeline()`. Typical value shape:

```ts
type ConvexVesselTimelineValue = {
  VesselAbbrev: string;
  SailingDay: string;
  Segments: VesselTimelineSegment[];
  LiveState: VesselTimelineLiveState | null;
  ActiveState: VesselTimelineActiveState | null;
  IsLoading: boolean;
  Error: string | null;
};
```

Data sources:

- `getVesselDayTimelineSnapshot` for `Segments`
- `getVesselDayActiveState` for `LiveState` and `ActiveState`

Responsibilities:

- fetch the backend-owned vessel/day semantic snapshot
- fetch the compact backend-resolved active-state snapshot
- expose both in one vessel/day-scoped context

The context no longer merges raw scheduled, active, and completed trip arrays
client-side.

## Frontend Pipeline

The frontend pipeline is event-based and intentionally small. The orchestration
entry point is `getVesselTimelineRenderState` in
`utils/pipeline/getVesselTimelineRenderState.ts`.

### Stage 1: Server-owned semantic segments

The backend snapshot builder (`convex/domain/vesselTimelineSnapshots/buildSnapshot.ts`)
constructs semantic dock, sea, placeholder, and terminal-tail segments from
ordered normalized `vesselTripEvents`.

Those segments already include:

- `startEvent` / `endEvent`
- `kind`
- `durationMinutes`
- `isTerminal`
- `placeholderReason`

Duration calculations remain **schedule-first** (`ScheduledTime` →
`ActualTime` → `PredictedTime`) so row heights stay stable as live predictions
and actuals arrive.

### Stage 2: Active row, layout, and render state

Still inside `getVesselTimelineRenderState`:

1. **`getAdaptivePixelsPerMinute`**: scales vertical density from event count
   (clamped from segment count), then builds an effective layout
   `{ ...layout, pixelsPerMinute }`.
2. **`resolveActiveSegmentIndex`** (`resolveActiveSegmentIndex.ts`): chooses
   the semantic row that owns the indicator by correlating backend active-state
   keys against the server-owned semantic segments. Paired dock/sea rows use
   `rowMatch`; terminal-tail fallback uses `terminalTailEventKey`. The
   frontend no longer recomputes active-row fallback policy locally.
3. **`getLayoutTimelineRows`**: converts semantic rows to
   `TimelineRenderRow[]`, marker past/future from the active index, a
   deterministic `rowLayouts` map, terminal card geometry, and
   `contentHeightPx`.
4. **`buildActiveIndicator`** (`buildActiveIndicator.ts`): builds
   `TimelineActiveIndicator | null` (badge, banner copy, sea speed / distance
   subtitle, `animate` + `speedKnots`) from the matched segment plus live
   state.

The UI layer (`components/TimelineContent.tsx`) only consumes
`VesselTimelineRenderState`: shared timeline components render rows, track,
terminal glass backgrounds, and `TimelineIndicatorOverlay` directly from the
precomputed row geometry in render state.

Presentation note:

- terminal card backgrounds and indicator glass surfaces now share the same
  `TimelineGlassSurface` primitive
- borders remain caller-owned (for example, terminal backgrounds vs indicator
  banner vs indicator circle), while blur and glass tint are shared
- `TimelineIndicator` is now primarily an orchestrator for positioning and
  motion; banner, circle, and ping each live in separate presentation
  components with their own local layout concerns

`VesselLocation` remains important even though the timeline rows come from the
persisted semantic snapshot:

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
  - the lower-level backend read model for dock-boundary events
- `vesselTimelineSnapshots`
  - the backend-owned semantic read model consumed by `VesselTimeline`
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
  -> rebuild vesselTimelineSnapshots when semantic timeline data changes

Frontend VesselTimeline
  -> getVesselDayTimelineSnapshot + getVesselDayActiveState (via context)
  -> getVesselTimelineRenderState
       -> resolveActiveSegmentIndex + buildActiveIndicator
       -> getLayoutTimelineRows (semantic segments -> rows + rowLayouts + cards)
  -> TimelineContent: shared timeline components + indicator overlay
```
