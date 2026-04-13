# Design Spec: Vessel Trip Identity and Timeline Actuals Redesign

Date prepared: 2026-04-12  
Status: proposed design, not yet implemented  
Primary audience: a new agent or engineer who has not previously worked on this backend  
Scope: `activeVesselTrips`, `completedVesselTrips`, `eventsActual`, and the `VesselTimeline` backbone merge

## Purpose

This document proposes a backend redesign for vessel-trip identity and timeline actuals.

The goal is to keep the system operationally simple while removing the most brittle assumption in the current model:

- that one composite schedule-shaped key can safely act as both:
  - the durable identity of a physical vessel trip, and
  - the join key used to align timeline actuals with the published schedule

That assumption is not holding in production-like dev data because WSF regularly emits contradictory or incomplete trip fields.

This redesign keeps the existing architectural split:

- `activeVesselTrips` / `completedVesselTrips` remain the write-side lifecycle tables
- `eventsScheduled`, `eventsActual`, and `eventsPredicted` remain the normalized timeline inputs
- `getVesselTimelineBackbone` remains the backend-owned query for the public `VesselTimeline` feature

The main change is to decouple:

- physical vessel-trip identity
from
- optional schedule alignment

## Read First

This design builds directly on the current backend architecture and recent incident reports. A new agent should read these documents first:

- [README.md](../../README.md)
- [convex/functions/vesselOrchestrator/README.md](../../convex/functions/vesselOrchestrator/README.md)
- [convex/functions/vesselTrips/updates/README.md](../../convex/functions/vesselTrips/updates/README.md)
- [convex/domain/vesselTimeline/README.md](../../convex/domain/vesselTimeline/README.md)
- [src/features/VesselTimeline/docs/ARCHITECTURE.md](../../src/features/VesselTimeline/docs/ARCHITECTURE.md)
- [docs/convex-mcp-cheat-sheet.md](../convex-mcp-cheat-sheet.md)

Recent incident and forensic context:

- [docs/handoffs/iss-forensic-report-2026-04-11.md](./iss-forensic-report-2026-04-11.md)
- [docs/handoffs/vessel-timeline-iss-cancelled-sailings-2026-04-11.md](./vessel-timeline-iss-cancelled-sailings-2026-04-11.md)
- [docs/handoffs/cat-composite-key-anomaly-memo-2026-04-12.md](./cat-composite-key-anomaly-memo-2026-04-12.md)
- [docs/handoffs/vesseltimeline-root-cause-memo-2026-04-12.md](./vesseltimeline-root-cause-memo-2026-04-12.md)

## Source Map and Architectural Context

This section is meant to save a new agent time. It explains what each readme-level document contributes to the current mental model.

### Repo root `README.md`

Source: [README.md](../../README.md)

Important takeaways:

- the orchestrator runs roughly every 5 seconds
- the project already thinks in terms of:
  - vessel update pipeline
  - trip enrichment pipeline
  - event detection
- current event detection still includes `Key changed` as a first-class lifecycle trigger

Why it matters here:

- the redesign should preserve the existing high-level backend shape
- but `Key changed` should stop being a primary physical-trip boundary signal

### Vessel orchestrator README

Source: [convex/functions/vesselOrchestrator/README.md](../../convex/functions/vesselOrchestrator/README.md)

Important takeaways:

- the orchestrator is the top-level real-time coordination layer
- it fans one WSF fetch out to:
  - `vesselLocations`
  - `vesselTrips/updates`
  - then timeline write effects
- timeline event tables were explicitly introduced to avoid rebuilding structure from live ticks on the client

Why it matters here:

- this redesign should not move primary lifecycle ownership away from the orchestrator path
- it should preserve the normalized timeline tables rather than collapsing everything back into trip rows

### VesselTrips updates README

Source: [convex/functions/vesselTrips/updates/README.md](../../convex/functions/vesselTrips/updates/README.md)

Important takeaways:

- this module is the canonical write pipeline for lifecycle state
- `activeVesselTrips` and `completedVesselTrips` are the write-side source for trip lifecycle
- `eventsActual` and `eventsPredicted` are projection outputs
- current invariants intentionally keep docked identity normalization schedule-assisted

Why it matters here:

- the redesign should change trip identity semantics without discarding the existing write-side lifecycle pipeline
- `eventsActual` should remain a projection table, but with better semantics

### VesselTimeline backend README

Source: [convex/domain/vesselTimeline/README.md](../../convex/domain/vesselTimeline/README.md)

Important takeaways:

- timeline backbone is intentionally same-day only
- backend timeline query reads:
  - `eventsScheduled`
  - `eventsActual`
  - `eventsPredicted`
- client derives active interval from the merged backbone
- backend no longer reads `vesselLocations` at query time

Why it matters here:

- this split is good and should be preserved
- the redesign should improve event semantics, not re-centralize live vessel state into the timeline query

### VesselTimeline client architecture doc

Source: [src/features/VesselTimeline/docs/ARCHITECTURE.md](../../src/features/VesselTimeline/docs/ARCHITECTURE.md)

Important takeaways:

- the client expects:
  - a stable backbone
  - local derivation of active interval
  - local indicator placement from `VesselLocation`
- timeline rendering is already treated as a deterministic pipeline from ordered events

Why it matters here:

- the redesign should preserve the client contract if possible
- timeline correctness should be improved by better input modeling, not by introducing a new client-side lifecycle model

### Convex MCP cheat sheet

Source: [docs/convex-mcp-cheat-sheet.md](../convex-mcp-cheat-sheet.md)

Important takeaways:

- documents the approved workflow for inspecting tables, logs, and function outputs in dev
- confirms that forensic work in the linked handoffs was based on direct Convex reads rather than guesswork

Why it matters here:

- this redesign is motivated by actual table and log evidence, not just architectural preference

## Executive Summary

### Problem in one sentence

The backend currently treats a schedule-derived composite key as the durable identity of a physical trip, even though the feed fields used to build that key are frequently wrong, missing, contradictory, or prematurely advanced.

### Proposed fix in one sentence

Make physical trip identity independent from schedule identity by introducing an immutable `TripKey` for vessel-trip instances, making `ScheduleKey` optional, and redefining `eventsActual` as physical boundary facts with optional schedule alignment.

### Desired end state

At the end of this redesign:

- a vessel trip has a stable physical identity even when schedule alignment is missing or wrong
- schedule alignment becomes an optional attachment, not the trip's identity
- physical arrivals and departures can still be represented even when no safe schedule match exists
- `VesselTimeline` remains a pure derived view from:
  - `eventsScheduled`
  - `eventsActual`
  - `eventsPredicted`
- the official merge remains server-owned, but the merge function is pure and shareable

## Current Architecture Summary

This section is intentionally brief. The details live in the readme-style docs listed above.

### Current vessel update pipeline

Per [convex/functions/vesselOrchestrator/README.md](../../convex/functions/vesselOrchestrator/README.md):

1. fetch vessel locations from WSF
2. convert them into `ConvexVesselLocation`
3. store live locations in `vesselLocations`
4. process trip lifecycle in `vesselTrips/updates`
5. project timeline writes via `applyTickEventWrites`

### Current trip lifecycle responsibilities

Per [convex/functions/vesselTrips/updates/README.md](../../convex/functions/vesselTrips/updates/README.md):

- `activeVesselTrips` and `completedVesselTrips` are the canonical write-side lifecycle tables
- the lifecycle pipeline detects events like:
  - leave dock
  - arrive at dock
  - key changes
- `eventsActual` and `eventsPredicted` are written as deferred projection effects

### Current timeline responsibilities

Per [convex/domain/vesselTimeline/README.md](../../convex/domain/vesselTimeline/README.md) and [src/features/VesselTimeline/docs/ARCHITECTURE.md](../../src/features/VesselTimeline/docs/ARCHITECTURE.md):

- the backend timeline query is same-day only
- it reads:
  - `eventsScheduled`
  - `eventsActual`
  - `eventsPredicted`
- it merges them into one ordered backbone
- the client derives the active interval from that backbone

This split is good and should be preserved.

## Problem Statement

The system is receiving conflicting signals from WSF, especially in docked and transition states.

The current composite-key model assumes the feed can safely supply:

- departing terminal
- arriving terminal
- scheduled departure

at exactly the moments when the system needs identity stability most:

- just after arrival
- while docked before departure
- on the exact leave-dock tick
- when a vessel goes out of service
- when the published schedule is refreshed mid-day

That assumption is false often enough that the model is structurally brittle.

### The main failure mode

Today the code derives `Key` directly from live feed identity fields in [convex/functions/vesselLocation/schemas.ts](../../convex/functions/vesselLocation/schemas.ts), using [convex/shared/tripIdentity.ts](../../convex/shared/tripIdentity.ts). Later, trip projections write `eventsActual` using the trip's current key in [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](../../convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts).

That means:

- a bad identity tick is not just a transient display problem
- it can become a persisted actual event under the wrong scheduled segment
- once persisted, the timeline merge treats it as truth

### Specific WSF conflict patterns motivating this change

The following are recurring categories of bad or incomplete feed data:

1. contradictions between `AtDock` and `LeftDock`
2. flaky or prematurely advanced `ScheduledDeparture`
3. `RouteAbbrev` or `ArrivingTerminalAbbrev` missing even while the vessel is actively serving
4. out-of-service transitions that invalidate schedule continuity
5. schedule refreshes that mutate the published skeleton after physical movement has already occurred

### Concrete examples

#### Example A: `CAT` advanced to a later departure while still docked

Per [cat-composite-key-anomaly-memo-2026-04-12.md](./cat-composite-key-anomaly-memo-2026-04-12.md):

- Date: 2026-04-12
- Approx wall-clock: 4:47 PM PDT
- Vessel: `CAT`
- Physical state looked coherent:
  - `AtDock = true`
  - `DepartingTerminalAbbrev = "SOU"`
  - `ArrivingTerminalAbbrev = "VAI"`
  - `Speed = 0`
  - `DepartingDistance = 0`
- But feed-derived `ScheduledDeparture` had already jumped to `6:45 PM PDT`

Result:

- live key became `CAT--2026-04-12--18:45--SOU-VAI`
- existing active-trip identity remained `CAT--2026-04-12--16:50--SOU-VAI`

This is the clearest example that the current composite key trusts a field that WSF can advance too early.

#### Example B: `KIT` got a future departure actual at `09:58 AM`

Per [vesseltimeline-root-cause-memo-2026-04-12.md](./vesseltimeline-root-cause-memo-2026-04-12.md):

- Date: 2026-04-12
- Vessel: `KIT`
- Bad persisted row:
  - `eventsActual.Key = KIT--2026-04-12--11:40--FAU-SOU--dep-dock`
  - `EventActualTime = 09:58:32 AM PDT`

The raw history did not support that future event. The likely sequence was:

1. dock identity became unstable
2. fallback schedule resolution chose the wrong same-terminal future departure
3. the real departure timestamp was then written onto the wrong future key

This shows that the problem is not just bad live display data. It is bad persisted actual attribution.

#### Example C: `ISS` physical movement and schedule alignment diverged

Per [iss-forensic-report-2026-04-11.md](./iss-forensic-report-2026-04-11.md) and [vessel-timeline-iss-cancelled-sailings-2026-04-11.md](./vessel-timeline-iss-cancelled-sailings-2026-04-11.md):

- raw `vesselLocationsHistoric` was often physically coherent
- later timeline representations still diverged from the published schedule skeleton
- replacement-service sailings did not align cleanly with stale `eventsScheduled` rows

This is an example where physical movement is still meaningful even when schedule alignment is ambiguous or stale.

#### Example D: `SAL` has repeated dock windows with no assignable identity

Convex dev data on 2026-04-12 shows repeated dock windows for `SAL` where the vessel is physically docked and in service, but raw history lacks:

- `Key`
- `ScheduledDeparture`
- `ArrivingTerminalAbbrev`

Examples include approximately:

- 5:21 PM to 5:31 PM PDT at `SOU`
- 5:45 PM to 6:02 PM PDT at `VAI`
- 6:21 PM to 6:36 PM PDT at `FAU`

At the same time, the current `scheduledTrips` table for route `f-v-s` contains only `CAT` and `KIT`, with no rows for `SAL`.

This is important because it proves that there are moments when the vessel's physical state is real and actionable, while safe schedule alignment simply does not exist.

#### Example E: `ISS` can leave schedule service entirely

Convex dev data on 2026-04-12 shows `ISS` later docked at `EAH` with:

- `InService = false`
- no meaningful passenger schedule attachment

This is a valid physical state and should remain representable even though it no longer belongs to the published sailing schedule.

## Root Cause

The core design problem is not that WSF is imperfect. The system already knows that.

The real problem is that current modeling conflates two different concepts:

1. a physical vessel-trip instance
2. a published schedule segment

Those are often related, but they are not the same thing.

### What a physical trip instance is

A physical trip instance is the lifecycle of a real vessel between one dock arrival and the next dock arrival.

It can be observed from physical evidence like:

- docked vs underway
- terminal position
- departure tick
- arrival tick
- speed

### What a schedule segment is

A schedule segment is a published service slot:

- vessel
- scheduled departure time
- departing terminal
- arriving terminal

This is a useful view of service, but it is not the vessel's ground truth identity.

### Why the current composite key is wrong as primary identity

The current key includes:

- vessel
- scheduled departure minute
- departing terminal
- arriving terminal

When any of those change spuriously, the identity of the physical trip appears to change.

That causes:

- trip churn
- wrong actual attribution
- broken joins
- stale or misleading timeline ownership

## Design Goals

1. Preserve the existing backend architecture wherever it is already sound.
2. Keep `activeVesselTrips` and `completedVesselTrips`.
3. Preserve the three-table timeline model:
   - `eventsScheduled`
   - `eventsActual`
   - `eventsPredicted`
4. Remove schedule-derived composite keys as the primary identity of physical trips.
5. Allow physical actuals to exist even when no safe schedule match exists.
6. Keep the public UI contract simple:
   - one best current destination when available
   - no user-facing confidence system
7. Avoid overengineering:
   - no large audit subsystem in this phase
   - no large workflow/state-machine framework
   - use a practical dock/sea debounce

## Non-Goals

These are explicitly out of scope for this phase:

- a full audit-trail or discrepancy-event subsystem
- a user-facing confidence or provenance UI
- a GPS-only inference engine
- replacing `VesselTimeline` with client-side reconstruction as the official source
- redesigning ML prediction logic

## Proposed Model

## Part 1: Vessel Trip Identity

### New primary identity: `TripKey`

Each physical trip instance gets an immutable `TripKey`.

Format:

```text
[VesselAbbrev] [DateTime]
```

Where:

- `DateTime` comes from the triggering `VesselLocation.TimeStamp` field
- encoded in ISO format
- truncated to whole seconds if needed
- with `T` replaced by a space

Example:

```text
CAT 2026-04-12 18:21:55Z
```

This value must be assigned once when the trip instance is created and never recomputed.

It should be tied to the vessel-location tick that caused the lifecycle transition, not the backend wall-clock time when the server happened to process that tick.

### Optional schedule identity: `ScheduleKey`

Trips may also carry:

- `ScheduleKey?`

This is an optional attachment to a published schedule segment. It is not the trip's identity.

If schedule alignment is unavailable or unsafe:

- `TripKey` still exists
- `ScheduleKey` remains undefined

### Physical trip boundaries

A physical trip is defined as:

- from dock arrival/start at terminal A
- through optional dock dwell
- through departure from terminal A
- until arrival at terminal B

This is consistent with the user's intended simplification:

- there is one current trip instance
- `AtDockActual` marks when the vessel entered the dock portion of the current trip
- if `LeftDockActual` is null, the vessel has not yet left the dock portion of the current trip
- arrival at the next dock ends the current trip and begins a new one

### Trip fields in end state

Desired end-state core fields for `activeVesselTrips` and `completedVesselTrips`:

- `TripKey`
- `ScheduleKey?`
- `VesselAbbrev`
- `DepartingTerminalAbbrev`
- `ArrivingTerminalAbbrev?`
- `TripStart`
- `AtDockActual`
- `LeftDockActual?`
- `TripEnd?`
- `InService`
- `TimeStamp`

Existing optional prediction and helper fields may remain if still needed.

### Field semantics

#### `TripStart`

- the beginning of the current physical trip instance
- practically: when the vessel enters the docked phase at the terminal where this trip starts
- for a replacement trip created immediately after an arrival, this is the arrival/start boundary of the new dock interval

#### `AtDockActual`

- the observed timestamp when the vessel entered the dock portion of the current trip
- this is the positive physical marker that the vessel is at dock for the current trip
- preferred field for testing whether the current trip is in its dock phase
- unlike `LeftDockActual`, this does not rely on checking for undefined as the primary at-dock signal

#### `LeftDockActual?`

- the observed departure timestamp from the starting terminal
- null means the vessel has not yet left the dock portion of the current trip

#### `TripEnd?`

- the observed arrival timestamp at the next dock
- set when the current trip completes

#### `DepartingTerminalAbbrev`

- the physical terminal where the current trip began

#### `ArrivingTerminalAbbrev?`

- the backend-best single destination to show to the client
- may come from feed or a safe schedule-derived assumption
- may remain undefined when no safe destination is known

#### `ScheduleKey?`

- optional attachment to a row or segment in the published schedule
- used for joins and timeline projection when available
- absence does not invalidate the trip

## Part 2: Physical Dock/Sea Debounce

### Why a debounce is needed

Current feed transitions are noisy. The system should not flip trip phase or create actual events from a single contradictory field.

### Inputs

Use physical evidence only:

- `AtDock`
- `LeftDock`
- `Speed > 1`

These inputs should be treated as independent noisy signals.

### Debounce rule

The implementation does not need a complicated named state machine, but it does need deterministic hysteresis.

Recommended behavior:

- derive whether the vessel is physically docked or at sea from the combined signals
- require at least one confirming signal before changing phase
- allow a single contradictory signal without immediately flipping phase

This logic should be centralized in one helper module and reused by:

- trip lifecycle
- physical actual-event creation

### Important constraint

Departure and arrival facts should be created from the debounced physical transition, not from schedule identity changes.

## Part 3: Destination Handling

### Keep one user-facing destination field

Do not create four terminal fields like:

- departing scheduled
- departing actual
- arriving scheduled
- arriving actual

That adds too much complexity for little benefit.

### Proposed rule

Keep only:

- `DepartingTerminalAbbrev`
- `ArrivingTerminalAbbrev?`

And, if scheduled terminals are needed, derive them by looking up `ScheduleKey`.

### How `ArrivingTerminalAbbrev?` is assigned

Use this priority:

1. feed-provided arriving terminal when present and plausible
2. safe assumption from known schedule continuity
3. otherwise undefined

This remains a single source of truth for the client while keeping the backend flexible enough to survive bad feed intervals.

## Part 4: `eventsActual` Redesign

### Why `eventsActual` must change

`eventsActual` should remain a first-class table and should not collapse into `activeVesselTrips`.

However, it should no longer mean:

- "schedule row with actual time attached"

Instead it should mean:

- "observed physical boundary fact, with optional schedule alignment"

### Desired end-state schema

Proposed end-state fields:

- `EventKey`
- `TripKey`
- `ScheduleKey?`
- `VesselAbbrev`
- `TerminalAbbrev`
- `EventType`
- `EventActualTime`

Optional compatibility fields may remain temporarily during migration.

### Semantics

#### `EventKey`

Stable primary identity for the actual event row.

Example shape:

```text
[TripKey]--dep-dock
[TripKey]--arv-dock
```

#### `TripKey`

Links the actual event back to the physical trip instance.

#### `ScheduleKey?`

Optional schedule alignment. If a safe schedule match exists, store it. If not, leave it empty.

This is the crucial change that lets physical actuals exist even when the vessel is off schedule, reassigned, missing from the schedule, or temporarily not alignable.

### Required behavior

`eventsActual` must be able to represent:

- a real departure without a safe schedule match
- a real arrival without a safe schedule match
- a docked/off-service state that invalidates prior schedule continuity

### Why this still preserves compartmentalization

This keeps the original normalized-table intent intact:

- trip lifecycle tables are not the timeline query contract
- `eventsActual` remains its own timeline input
- physical facts remain separately queryable

## Part 5: `VesselTimeline` Merge

### Keep official merge on the server

The official `VesselTimeline` backbone should remain backend-owned.

Reasons:

- one authoritative behavior
- easier debugging
- no client version skew
- existing architecture already assumes a backend-owned backbone

### But make the merge function pure and shareable

The actual merge should live in a shared pure function:

```ts
createTimeline(eventsActual, eventsScheduled, eventsPredicted)
```

The backend query will remain the official caller, but the function should be pure enough that:

- it can be tested directly
- it can be reused in debugging tools
- it could be run on the client later if product needs change

### New merge semantics

The merge should attach actuals to scheduled rows in this order:

1. exact `ScheduleKey` match
2. carefully bounded fallback rules
3. no match if no safe rule applies

Fallback rules should be much more conservative than current key-based assumptions.

### What unmatched physical actuals mean

An unmatched physical actual should not disappear from storage.

For the initial implementation, the timeline backbone may simply omit unmatched actuals from the schedule rows when there is no safe alignment.

That is acceptable because:

- the physical fact still exists in `eventsActual`
- it can later support improved timeline rendering or diagnostics

### Compatibility with current client model

The client can still consume the same style of backbone:

- ordered same-day timeline events
- actual overlays when aligned
- predictions when present

No immediate client rewrite is required.

## Desired End State

At the end of all stages:

- `TripKey` is the durable identity of a physical trip
- `ScheduleKey` is optional
- `eventsActual` stores physical facts first
- `VesselTimeline` is derived from the three event tables, not from trip rows
- the backend remains authoritative for the public timeline backbone
- missing or unsafe schedule alignment no longer forces false identity

## Implementation Strategy

The changes naturally split into two mostly independent workstreams:

1. vessel-trip identity and lifecycle
2. timeline actual-event semantics and merge behavior

That separation should be preserved in implementation.

## Stage 0: Documentation and Test Fixtures

Before code changes:

1. land this design doc
2. add explicit fixture cases to tests for:
   - premature `ScheduledDeparture`
   - contradictory dock signals
   - docked vessel with missing arrival terminal
   - off-service transition to maintenance facility
   - schedule rows missing entirely for an in-service vessel like `SAL`

Recommended test areas:

- `convex/functions/vesselTrips/updates/tests/`
- `convex/domain/vesselTimeline/tests/`

## Stage 1: VesselTrips Identity Redesign

This stage intentionally does not require timeline changes yet.

### Stage 1 goals

- introduce `TripKey`
- introduce `ScheduleKey?`
- introduce `AtDockActual`
- introduce `LeftDockActual?`
- stop using the composite key as the durable trip identity
- make trip transitions physical-first

### Stage 1 schema changes

Additive changes to `activeVesselTrips` and `completedVesselTrips`:

- `TripKey: string`
- `ScheduleKey?: string`
- `AtDockActual: number`
- `LeftDockActual?: number`

Existing legacy fields may temporarily remain:

- `Key`
- `ScheduledDeparture`
- other schedule-derived helpers

These legacy fields should be treated as transitional compatibility fields only.

### Stage 1 code changes

Likely file areas:

- [convex/functions/vesselTrips/schemas.ts](../../convex/functions/vesselTrips/schemas.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/detectTripEvents.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/detectTripEvents.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/processCompletedTrips.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/processCompletedTrips.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts)

### Stage 1 new behavior

#### Trip creation

When a new trip starts:

- assign immutable `TripKey`
- set `DepartingTerminalAbbrev` from physical location
- set `TripStart`
- set `AtDockActual`
- set `LeftDockActual` to undefined
- attach `ScheduleKey` only if safely resolvable

#### While docked

- if vessel remains in the dock phase, keep the same `TripKey`
- update `ArrivingTerminalAbbrev?` only when better information becomes available
- do not churn trip identity because of raw schedule-field changes
- determine dock-phase status from `AtDockActual` / `LeftDockActual` semantics rather than treating `LeftDockActual === undefined` as the sole source of truth

#### On departure

- set `LeftDockActual`
- do not create a new trip
- departure belongs to the current trip instance

#### On next arrival

- close the current trip with `TripEnd`
- create the next trip instance with a new `TripKey`

### Stage 1 transition policy

During migration, dual-write legacy fields:

- keep populating old `Key` temporarily if required by existing queries
- populate new `TripKey` and `ScheduleKey`

Do not remove old fields until Stage 3 cutover is complete.

## Stage 2: `eventsActual` Redesign

This stage can proceed largely independently after Stage 1 starts dual-writing `TripKey`.

### Stage 2 goals

- redefine `eventsActual` as physical boundary facts
- preserve optional schedule alignment
- stop treating actuals as schedule rows with timestamps

### Stage 2 schema changes

Additive first:

- `EventKey`
- `TripKey`
- `ScheduleKey?`

Retain legacy fields temporarily:

- `Key`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `EventType`
- `EventActualTime`

### Stage 2 writer changes

Likely file areas:

- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](../../convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)
- [convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts](../../convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts)
- [convex/functions/eventsActual/mutations.ts](../../convex/functions/eventsActual/mutations.ts)

### Stage 2 new behavior

When a departure or arrival is observed:

1. create or upsert a physical actual event using:
   - `TripKey`
   - `TerminalAbbrev`
   - `EventType`
   - `EventActualTime`
2. attach `ScheduleKey` only if a safe alignment exists
3. do not force a schedule key just to keep old joins working

### Stage 2 compatibility behavior

During this stage, it may be useful to dual-write:

- legacy schedule-keyed identity fields
- new physical-event identity fields

This allows comparison between:

- old actual attribution
- new physical actual storage

## Stage 3: Timeline Merge Refactor

This stage consumes the new `eventsActual` semantics.

### Stage 3 goals

- keep `getVesselTimelineBackbone`
- extract a pure shared merge function
- switch actual-attachment logic to prefer `ScheduleKey`

### Stage 3 code areas

Likely file areas:

- [convex/domain/vesselTimeline/timelineEvents.ts](../../convex/domain/vesselTimeline/timelineEvents.ts)
- [convex/domain/vesselTimeline/viewModel.ts](../../convex/domain/vesselTimeline/viewModel.ts)
- [convex/functions/vesselTimeline/backbone/getVesselTimelineBackbone.ts](../../convex/functions/vesselTimeline/backbone/getVesselTimelineBackbone.ts)
- [convex/functions/vesselTimeline/queries.ts](../../convex/functions/vesselTimeline/queries.ts)

### Stage 3 merge behavior

`createTimeline(eventsActual, eventsScheduled, eventsPredicted)` should:

1. sort scheduled rows into backbone order
2. attach actuals by exact `ScheduleKey`
3. optionally use bounded fallback matching for known-safe cases
4. leave scheduled rows without actuals if no safe match exists
5. preserve the current predicted overlay rules unless specifically changed

### Stage 3 client impact

Client-facing impact should be minimal:

- keep `getVesselTimelineBackbone` as the main API
- keep active-interval derivation on the client as today
- avoid any required client rewrite in this phase

## Stage 4: Cutover and Cleanup

Only after Stages 1 through 3 are stable:

1. remove old assumptions that `trip.Key` is the physical trip identity
2. remove old assumptions that `eventsActual.Key` must equal a scheduled boundary key
3. simplify fallback logic that was only necessary because of composite-key coupling

This stage should be done conservatively and only after behavior is validated.

## Migration Notes

### Why additive migration is preferred

This is a serverless Convex backend with real-time subscribers. Additive migration reduces risk by allowing:

- dual-write comparisons
- selective query cutover
- easier rollback during development

### Suggested migration order

1. add new fields
2. dual-write new fields
3. update queries to prefer new fields
4. remove old write dependencies
5. remove old read dependencies

## Testing Plan

The redesign should ship with explicit regression coverage for the motivating failures.

### Required vessel-trip tests

- docked trip remains stable when `ScheduledDeparture` jumps forward
- departure is attributed to the existing physical trip even if raw feed identity changes on the same tick
- arrival starts a new trip with a new `TripKey`
- dock windows with missing arrival terminal do not destroy trip identity
- off-service transition preserves physical truth without forcing schedule alignment

### Required timeline tests

- exact `ScheduleKey` actual attachment
- unmatched actual event remains stored even when no schedule match exists
- stale schedule rows do not absorb unrelated actuals
- replacement-service actuals attach only when safely matched
- future departure rows cannot claim old actual timestamps through key churn

### Required integration-style tests

At least one end-to-end fixture each for:

- `CAT` premature scheduled-departure jump
- `KIT` wrong future dep-dock attribution
- `ISS` cancelled or reassigned sailings
- `SAL` missing dock identity windows

## Open Questions

These should be resolved during implementation planning before code changes start:

1. Should `TripStart` remain "arrival/start of dock interval" or be renamed later for clarity?
2. How conservative should fallback schedule alignment be in Stage 3?
3. Do any current subscribers require legacy `Key` semantics during migration?
4. Should unmatched physical actuals remain invisible to the public backbone in Phase 1, or should they appear in a separate diagnostics query only?

## Recommendation

Proceed with this redesign in two main engineering tracks:

1. `VesselTrips` identity and physical-boundary refactor
2. `VesselTimeline` actual-event and merge refactor

Treat them as staged but intentionally separate. The trip lifecycle should stop depending on schedule-shaped identity first. Then timeline actuals should stop depending on schedule-shaped storage semantics second.

That sequence minimizes risk and makes the system easier to reason about for both backend and timeline work.

## Bottom Line

The current system already has the right high-level shape:

- lifecycle tables for ongoing/completed trips
- normalized event tables for timeline structure and overlays
- backend-owned timeline query

The redesign does not replace that architecture.

It corrects the faulty assumption inside it:

- a physical trip is not the same thing as a scheduled segment

Once that distinction is modeled explicitly, the backend can remain simple, the client can keep a single clear truth to render, and WSF's conflicting signals stop having the power to redefine physical reality through one bad composite key.

## Execution Checklist

This section turns the design into an implementation sequence. It is intentionally mechanical and file-oriented so a new agent can execute it in order.

## Stage A: Prep and Safety Rails

Goal:

- make the redesign easy to land incrementally
- create fixtures for the known failure classes before changing write semantics

### Checklist

1. Add regression fixtures and tests for the motivating incidents.
2. Identify every place that currently assumes `trip.Key` is the primary trip identity.
3. Identify every place that currently assumes `eventsActual.Key` is a scheduled boundary key.
4. Add a temporary migration note to affected readmes if useful.

### Files to inspect or update

- [convex/functions/vesselTrips/updates/tests/resolveEffectiveLocation.test.ts](../../convex/functions/vesselTrips/updates/tests/resolveEffectiveLocation.test.ts)
- [convex/functions/vesselTrips/updates/tests/buildTrip.test.ts](../../convex/functions/vesselTrips/updates/tests/buildTrip.test.ts)
- [convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts](../../convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts)
- [convex/functions/vesselTrips/updates/tests/processVesselTrips.test.ts](../../convex/functions/vesselTrips/updates/tests/processVesselTrips.test.ts)
- [convex/domain/vesselTimeline/tests/reconcile.test.ts](../../convex/domain/vesselTimeline/tests/reconcile.test.ts)
- [convex/domain/vesselTimeline/tests/viewModel.test.ts](../../convex/domain/vesselTimeline/tests/viewModel.test.ts)
- [convex/domain/vesselTimeline/tests/history.test.ts](../../convex/domain/vesselTimeline/tests/history.test.ts)

### Acceptance criteria

- tests exist for:
  - premature `ScheduledDeparture` jumps
  - contradictory `AtDock` and `LeftDock`
  - missing `ArrivingTerminalAbbrev` while docked
  - off-service / maintenance-terminal transition
  - replacement-service or cancelled-sailing timeline mismatch

## Stage B: Additive Schema Changes for VesselTrips

Goal:

- introduce new trip identity fields without breaking existing readers

### Checklist

1. Add `TripKey` to stored trip schemas.
2. Add `ScheduleKey?` to stored trip schemas.
3. Add `AtDockActual` to stored trip schemas.
4. Add `LeftDockActual?` to stored trip schemas.
5. Keep legacy fields such as `Key` and `ScheduledDeparture` for compatibility during migration.
6. Update query/domain conversion helpers so the new fields are available to the rest of the codebase.

### Files to update

- [convex/functions/vesselTrips/schemas.ts](../../convex/functions/vesselTrips/schemas.ts)
- any generated Convex schema definitions if needed after running type generation
- any frontend/domain trip types if they mirror backend shapes directly

### Suggested implementation notes

- `TripKey` should be required on newly written rows
- existing rows may need transitional optional handling until backfilled or naturally replaced
- `ScheduleKey` should stay optional
- `AtDockActual` should become the preferred positive physical marker for "this trip is at dock"
- `LeftDockActual` should become the preferred physical departure field; legacy `LeftDock` can remain during migration

### Acceptance criteria

- backend types compile
- existing queries still work
- new trip fields are available to write-path code

## Stage C: Introduce `TripKey` Generation

Goal:

- stop treating composite schedule key as primary trip identity

### Checklist

1. Create a helper to generate `TripKey` in the required format:
   - `[VesselAbbrev] [DateTime]`
   - ISO timestamp rounded to seconds
   - `T` replaced by a space
2. Ensure this helper is called only when a new trip instance is created.
3. Ensure trip continuation never regenerates `TripKey`.
4. Add tests proving retries and continuing ticks preserve the same `TripKey`.

### Files to create or update

- likely a new shared helper under `convex/shared/` or `convex/functions/vesselTrips/updates/tripLifecycle/`
- [convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/buildTrip.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/buildTrip.ts)
- [convex/functions/vesselTrips/updates/tests/buildTrip.test.ts](../../convex/functions/vesselTrips/updates/tests/buildTrip.test.ts)

### Acceptance criteria

- new trips receive immutable `TripKey`
- continuing ticks preserve the same `TripKey`
- legacy `Key` may still update during migration without affecting physical identity

## Stage D: Physical Dock/Sea Debounce

Goal:

- base lifecycle transitions on physical evidence rather than schedule identity churn

### Checklist

1. Centralize debounce logic in one helper.
2. Use only physical inputs:
   - `AtDock`
   - `LeftDock`
   - `Speed > 1`
3. Define transition rules that tolerate one contradictory signal.
4. Update trip event detection to use the debounced physical phase.
5. Add regression tests for contradictory-tick scenarios.

### Files to create or update

- likely a new helper in `convex/functions/vesselTrips/updates/tripLifecycle/`
- [convex/functions/vesselTrips/updates/tripLifecycle/detectTripEvents.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/detectTripEvents.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts)
- [convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts](../../convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts)

### Important implementation note

Do not let a schedule-key change remain a first-class physical boundary trigger.

Schedule attachment may still update, but:

- trip start
- leave dock
- arrive dock

should all be driven by physical transition logic.

### Acceptance criteria

- a single bad tick does not churn physical trip identity
- dock arrival creates the next trip instance
- leave-dock updates the current trip rather than replacing it

## Stage E: VesselTrips Lifecycle Refactor

Goal:

- fully adopt the new physical-trip semantics in write-side lifecycle tables

### Checklist

1. Treat one physical trip as dock-arrival to next dock-arrival.
2. On arrival:
   - complete current trip
   - create next trip immediately
   - stamp the new trip's `AtDockActual`
3. On departure:
   - set `LeftDockActual`
   - do not create a new trip
4. Make `ArrivingTerminalAbbrev` the single user-facing destination field.
5. Attach `ScheduleKey` only when safely resolvable.
6. Keep legacy `Key` and `ScheduledDeparture` writes only as transitional compatibility if still needed.

### Files to update

- [convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/buildTrip.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/buildTrip.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/buildCompletedTrip.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/buildCompletedTrip.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/processCompletedTrips.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/processCompletedTrips.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/processCurrentTrips.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/processCurrentTrips.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/resolveEffectiveLocation.ts)

### Design guardrails

- `TripKey` is physical identity
- `ScheduleKey` is attachment only
- `ArrivingTerminalAbbrev` may be undefined
- no parallel sets of "actual" and "scheduled" terminals on the trip row

### Acceptance criteria

- `activeVesselTrips` remains useful for debugging and lifecycle tracking
- schedule alignment can disappear without destroying trip continuity
- vessels like `SAL` can remain physically represented even if no schedule rows exist

## Stage F: Additive Schema Changes for `eventsActual`

Goal:

- prepare `eventsActual` to store physical facts with optional schedule alignment

### Checklist

1. Add `EventKey`.
2. Add `TripKey`.
3. Add `ScheduleKey?`.
4. Keep legacy fields temporarily so existing timeline readers do not break immediately.

### Files to update

- schema file for `eventsActual` under `convex/functions/eventsActual/`
- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](../../convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)
- [convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts](../../convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts)
- any tests covering actual projection

### Acceptance criteria

- `eventsActual` can store a physical boundary even when no `ScheduleKey` is present
- backend types compile with both legacy and new fields

## Stage G: Redefine `eventsActual` Writers

Goal:

- write physical actual events first, schedule alignment second

### Checklist

1. Change actual patch builders so they produce physical-event identity.
2. Use:
   - `TripKey`
   - `TerminalAbbrev`
   - `EventType`
   - `EventActualTime`
   as the minimal physical fact set.
3. Attach `ScheduleKey` only when safe.
4. Do not force schedule alignment to keep old joins alive.
5. Keep dual-write compatibility fields only as long as needed for cutover.

### Files to update

- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](../../convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)
- [convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts](../../convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts)
- [convex/functions/eventsActual/mutations.ts](../../convex/functions/eventsActual/mutations.ts)
- tests under `convex/functions/vesselTrips/updates/tests/`

### Suggested implementation note

`EventKey` can be deterministic from:

- `TripKey`
- event type

Example:

```text
[TripKey]--dep-dock
[TripKey]--arv-dock
```

### Acceptance criteria

- `eventsActual` can represent real movement even when schedule alignment is blank
- wrong schedule identity can no longer directly rewrite physical event identity

## Stage H: Extract Shared Pure Timeline Merge

Goal:

- keep official merge on the server while making it pure, explicit, and reusable

### Checklist

1. Extract current merge logic into a pure helper, conceptually:
   - `createTimeline(eventsActual, eventsScheduled, eventsPredicted)`
2. Keep backend query ownership unchanged.
3. Update tests to target the pure function directly.
4. Ensure no query-time reads of live `vesselLocations` are introduced.

### Files to update

- [convex/domain/vesselTimeline/timelineEvents.ts](../../convex/domain/vesselTimeline/timelineEvents.ts)
- [convex/domain/vesselTimeline/viewModel.ts](../../convex/domain/vesselTimeline/viewModel.ts)
- [convex/functions/vesselTimeline/backbone/getVesselTimelineBackbone.ts](../../convex/functions/vesselTimeline/backbone/getVesselTimelineBackbone.ts)
- [convex/functions/vesselTimeline/queries.ts](../../convex/functions/vesselTimeline/queries.ts)
- [convex/domain/vesselTimeline/tests/viewModel.test.ts](../../convex/domain/vesselTimeline/tests/viewModel.test.ts)

### Acceptance criteria

- merge behavior is deterministic and tested independently
- official public backbone remains server-owned

## Stage I: Update Timeline Actual Attachment Rules

Goal:

- make timeline actual attachment prefer optional schedule alignment instead of assuming actual rows are already schedule-keyed

### Checklist

1. Attach actuals by exact `ScheduleKey` first.
2. Preserve only cautious fallback matching where still justified.
3. Do not let unrelated actuals attach merely because they share a terminal and roughly plausible order.
4. Leave scheduled rows blank when no safe match exists.
5. Keep unmatched physical events in storage even if the public backbone does not yet expose them.

### Files to update

- [convex/domain/vesselTimeline/timelineEvents.ts](../../convex/domain/vesselTimeline/timelineEvents.ts)
- [convex/domain/vesselTimeline/tests/reconcile.test.ts](../../convex/domain/vesselTimeline/tests/reconcile.test.ts)
- [convex/domain/vesselTimeline/tests/history.test.ts](../../convex/domain/vesselTimeline/tests/history.test.ts)

### Acceptance criteria

- `KIT`-style future dep-dock misattribution is no longer possible through key churn alone
- `ISS`-style off-schedule movement can remain real without forcing a false scheduled row match

## Stage J: Query Cutover

Goal:

- shift read paths to prefer new identity semantics

### Checklist

1. Update backend query code to prefer:
   - `TripKey` over legacy `Key` for physical trip identity
   - `ScheduleKey` when joining to schedule
2. Review frontend contexts and types that currently assume `Key` is the main trip identity.
3. Keep client contract stable where possible.

### Files to inspect or update

- [src/data/contexts/convex/ConvexUnifiedTripsContext.tsx](../../src/data/contexts/convex/ConvexUnifiedTripsContext.tsx)
- any trip or timeline hooks that currently equate trip identity with scheduled segment key
- `vesselTrips` query handlers if they expose old identity assumptions

### Acceptance criteria

- schedule joins still work when `ScheduleKey` is present
- trip identity remains stable even when schedule attachment changes

## Stage K: Cleanup and Removal of Legacy Assumptions

Goal:

- remove the old composite-key dependency once the new path is proven

### Checklist

1. Remove code paths that treat trip `Key` as physical identity.
2. Remove code paths that require `eventsActual` identity to be a scheduled boundary key.
3. Remove transitional dual-write logic.
4. Simplify fallback schedule resolution where it only existed to preserve old key semantics.
5. Update readmes if their lifecycle descriptions changed materially.

### Files likely affected

- [convex/shared/tripIdentity.ts](../../convex/shared/tripIdentity.ts)
- [convex/shared/effectiveTripIdentity.ts](../../convex/shared/effectiveTripIdentity.ts)
- [convex/functions/eventsScheduled/dockedScheduleResolver.ts](../../convex/functions/eventsScheduled/dockedScheduleResolver.ts)
- [convex/functions/eventsScheduled/queries.ts](../../convex/functions/eventsScheduled/queries.ts)
- [convex/functions/vesselTrips/updates/README.md](../../convex/functions/vesselTrips/updates/README.md)
- [convex/domain/vesselTimeline/README.md](../../convex/domain/vesselTimeline/README.md)

### Acceptance criteria

- no critical write path depends on schedule-derived composite key as physical truth
- the new system can represent:
  - aligned scheduled trips
  - temporarily unaligned but real physical trips
  - off-schedule or out-of-service vessel movement

## Suggested Work Breakdown

If this work is split across agents or PRs, the cleanest partition is:

1. PR 1: tests and additive schemas
2. PR 2: `TripKey` + debounce + lifecycle refactor
3. PR 3: `eventsActual` schema and writer refactor
4. PR 4: timeline merge extraction and attachment updates
5. PR 5: cleanup and legacy removal

This keeps the trip-lifecycle work mostly independent from the timeline merge work, which matches the design intent of this spec.

## First PR Plan

This section defines the recommended first implementation PR.

The purpose of PR 1 is to create safety rails and additive schema support only.

PR 1 should not change the official runtime semantics of:

- trip lifecycle identity
- schedule attachment rules
- timeline merge behavior

It should make later PRs safer and easier to review.

### PR 1 goals

1. Add regression tests for the incident classes motivating the redesign.
2. Additive-only schema changes for `TripKey`, `ScheduleKey`, `AtDockActual`, and `LeftDockActual` on trip tables.
3. Additive-only schema changes for `EventKey`, `TripKey`, and `ScheduleKey` on `eventsActual`.
4. Add helper scaffolding where needed, but do not switch write paths to use it yet.
5. Preserve all existing read and write behavior by default.

### PR 1 non-goals

Do not do these in PR 1:

- no dock/sea debounce cutover
- no trip lifecycle behavior changes
- no replacement of legacy `Key` semantics
- no `eventsActual` writer cutover
- no `VesselTimeline` merge changes
- no client query contract changes

## PR 1 Checklist

### 1. Add regression tests first

Add or expand tests so future behavioral PRs have incident coverage.

Minimum cases:

- `CAT`: docked vessel receives later `ScheduledDeparture` while otherwise stationary
- `KIT`: future scheduled segment should not receive an old departure actual
- `ISS`: off-schedule or cancelled-sailing actuals should remain representable
- `SAL`: docked in-service windows may exist with missing destination or schedule identity

Suggested files:

- [convex/functions/vesselTrips/updates/tests/resolveEffectiveLocation.test.ts](../../convex/functions/vesselTrips/updates/tests/resolveEffectiveLocation.test.ts)
- [convex/functions/vesselTrips/updates/tests/buildTrip.test.ts](../../convex/functions/vesselTrips/updates/tests/buildTrip.test.ts)
- [convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts](../../convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts)
- [convex/domain/vesselTimeline/tests/viewModel.test.ts](../../convex/domain/vesselTimeline/tests/viewModel.test.ts)
- [convex/domain/vesselTimeline/tests/reconcile.test.ts](../../convex/domain/vesselTimeline/tests/reconcile.test.ts)

Expected output of this step:

- test names explicitly mention the incident class they protect against
- fixture data is readable enough that a new agent can understand why the test exists

### 2. Add new trip fields to schemas

Make additive changes only.

Add to trip schemas:

- `TripKey`
- `ScheduleKey?`
- `AtDockActual`
- `LeftDockActual?`

Suggested files:

- [convex/functions/vesselTrips/schemas.ts](../../convex/functions/vesselTrips/schemas.ts)

Implementation guidance:

- `TripKey` may need to be optional temporarily if old rows still exist in dev data and queries would otherwise fail
- if made optional in schema for migration safety, document that new writes are expected to populate it once PR 2 lands
- `ScheduleKey` should be optional
- `AtDockActual` may need to be optional in PR 1 for migration safety, even though the target design expects it on new writes
- `LeftDockActual` should be optional

Expected output of this step:

- backend types compile
- the fields are visible to all later write-path code

### 3. Add new `eventsActual` fields to schemas

Make additive changes only.

Add to actual-event schemas:

- `EventKey`
- `TripKey`
- `ScheduleKey?`

Suggested files:

- the schema module under `convex/functions/eventsActual/`
- any shared actual-patch types referenced by projection code

Implementation guidance:

- do not remove legacy fields yet
- do not require immediate writer cutover
- keep existing query compatibility

Expected output of this step:

- `eventsActual` can support the future model without changing current behavior

### 4. Add helper scaffolding for later PRs

It is acceptable in PR 1 to add small helpers that are not yet wired into the full write path.

Recommended helpers:

- `generateTripKey(...)`
- `buildPhysicalActualEventKey(...)`

Suggested locations:

- `convex/shared/`
- or `convex/functions/vesselTrips/updates/tripLifecycle/`
- or `convex/functions/vesselTrips/updates/projection/`

Implementation guidance:

- keep helpers pure
- add direct unit tests for formatting behavior
- do not switch runtime callers unless the switch is fully no-op

Expected output of this step:

- later PRs can import approved helpers instead of inventing local variants

### 5. Thread new fields through type conversion only where safe

If there are domain conversion helpers that can carry the new fields without behavioral risk, update them now.

Suggested files:

- [convex/functions/vesselTrips/schemas.ts](../../convex/functions/vesselTrips/schemas.ts)
- any frontend or shared trip types that should eventually know about the new fields

Implementation guidance:

- do not make frontend features depend on the new fields yet
- it is enough for the fields to survive serialization/deserialization cleanly

### 6. Leave current runtime semantics intact

At the end of PR 1:

- current `Key`-based logic should still operate
- current timeline merge should still operate
- current write paths should still pass existing tests

The new fields are present but largely unused.

## PR 1 Suggested File List

This is the most likely minimal file set for the first PR.

### Tests

- [convex/functions/vesselTrips/updates/tests/resolveEffectiveLocation.test.ts](../../convex/functions/vesselTrips/updates/tests/resolveEffectiveLocation.test.ts)
- [convex/functions/vesselTrips/updates/tests/buildTrip.test.ts](../../convex/functions/vesselTrips/updates/tests/buildTrip.test.ts)
- [convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts](../../convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts)
- [convex/domain/vesselTimeline/tests/viewModel.test.ts](../../convex/domain/vesselTimeline/tests/viewModel.test.ts)
- [convex/domain/vesselTimeline/tests/reconcile.test.ts](../../convex/domain/vesselTimeline/tests/reconcile.test.ts)

### Schema and types

- [convex/functions/vesselTrips/schemas.ts](../../convex/functions/vesselTrips/schemas.ts)
- `convex/functions/eventsActual/*`

### Optional helpers

- new helper file for `TripKey`
- new helper file for physical actual `EventKey`

### Docs

- this design spec only, if PR 1 wants to update status notes after landing

## PR 1 Acceptance Criteria

PR 1 is successful if all of the following are true:

1. The repo has explicit automated coverage for the known incident classes.
2. Trip schemas support:
   - `TripKey`
   - `ScheduleKey?`
   - `AtDockActual`
   - `LeftDockActual?`
3. `eventsActual` schemas support:
   - `EventKey`
   - `TripKey`
   - `ScheduleKey?`
4. No production behavior has intentionally changed yet.
5. The follow-up PR can start directly on lifecycle behavior without first revisiting schema groundwork.

## PR 1 Review Guidance

Reviewers should evaluate PR 1 with this lens:

- Are the tests capturing the motivating failures clearly?
- Are the schema additions additive and low-risk?
- Has the PR avoided sneaking in behavior changes under the cover of "prep work"?
- Will PR 2 be able to use these fields without another schema churn round?

If the answer to those questions is yes, PR 1 has done its job.
