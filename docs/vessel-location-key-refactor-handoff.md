## Vessel Location `Key` Refactor Handoff

This note is for the next agent implementing the `vesselLocations`
table refactor discussed in the architecture review.

This is not a request to redesign the whole `VesselTimeline` system in
one pass. The scope here is narrower:

- add `Key` to `vesselLocations`
- keep the meaning of `Key` consistent across tables
- move toward a simpler `at-dock` / `at-sea` model
- avoid wasting time re-litigating naming or provisional-state ideas

## Decision Summary

The user decided the following:

1. Use `Key` as the field name on `vesselLocations`
2. Keep the same composite-key meaning already used elsewhere
3. Do not introduce a separate `DerivedTripKey` or
   `InferredTripKey` field name
4. Do not add new explicit state fields such as:
   - `provisional`
   - `unknown`
   - `isConfirmed`
5. Standardize future domain language on:
   - `at-dock`
   - `at-sea`

Important context:

- The user is the sole developer and prefers one canonical field name
  for the same identity across tables, even if that field is derived.
- The user is intentionally not optimizing for strict raw-data purity in
  `vesselLocations`.
- The user is trying to simplify the system by leaning harder on key
  identity and removing heuristic matching later.

## Core Architectural Intent

The broader design direction is:

- `vesselLocations` should carry the same trip identity field as other
  trip- and timeline-related tables
- trip identity should be easier to trace across:
  - `vesselLocations`
  - `activeVesselTrips`
  - `completedVesselTrips`
  - `eventsScheduled`
  - `eventsActual`
  - `eventsPredicted`
- this refactor is meant to support a future simplification where the
  vessel is modeled physically as only:
  - `at-dock`
  - `at-sea`

The long-term idea is that arrival at dock starts the next trip
immediately, with the key inferred from the schedule backbone rather than
waiting for feed latency to clear.

That larger state-machine simplification is not necessarily part of this
task, but this `Key` refactor should not work against it.

## Current Relevant Files

Helpful architecture/context docs to read first:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/.cursor/rules/code-style.mdc`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md`

Why these matter:

- `vesselOrchestrator/README.md` explains where live location rows are
  produced and how they fan out into storage and trip updates
- `vesselTrips/updates/README.md` explains how `Key` is currently
  derived and used operationally
- `vesselTimeline/README.md` and frontend `ARCHITECTURE.md` explain the
  larger direction this refactor is meant to support
- `code-style.mdc` contains repo-specific style, comments, and
  verification expectations

Primary implementation files:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/schemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/mutations.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/queries.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/schema.ts`

Relevant key-derivation helpers:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripEquality.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripDerivation.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/keys.ts`

Relevant ingestion/orchestration path:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/actions.ts`

Potential downstream consumers:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselLocationsContext.tsx`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/*.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/TimelineFeatures/shared/hooks/useUnifiedTripsPageData.ts`

Tests likely needing updates or additions:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/tests/schemas.test.ts`

## Existing Shape Of `vesselLocations`

Right now `vesselLocations` stores:

- vessel identity
- terminal fields
- live movement fields
- timing fields such as:
  - `LeftDock`
  - `Eta`
  - `ScheduledDeparture`
  - `TimeStamp`
- derived distances:
  - `DepartingDistance`
  - `ArrivingDistance`

It does not currently store `Key`.

The main schema source is:

- [schemas.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/schemas.ts)

The main conversion point is:

- `toConvexVesselLocation(...)`

That is the likely best place to compute and stamp `Key`, because that is
already where raw feed payloads are normalized into backend storage
shape.

## What `Key` Should Mean Here

`Key` on `vesselLocations` should mean exactly what it means elsewhere:

- vessel abbreviation
- departing terminal abbreviation
- arriving terminal abbreviation
- scheduled departure

In other words, do not invent a new flavor of key for live locations.

Use the same canonical generator already used in the trip pipeline.

Likely helper candidates:

- `computeTripKey(...)` from
  [tripEquality.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripEquality.ts)
- or the lower-level helper from
  [keys.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/keys.ts)

Prefer one shared implementation path so that:

- `vesselLocations.Key`
- `activeVesselTrips.Key`
- timeline event segment keys

all remain consistent.

## Important Constraint

Only compute `Key` when it is safely derivable from the component fields.

That means:

- if `ScheduledDeparture` is absent, `Key` should be `undefined`
- if `ArrivingTerminalAbbrev` is absent, `Key` should be `undefined`

Do not invent fallback key formats for partial live rows.

This keeps the field honest and deterministic.

## What Not To Add

The user explicitly does not want this task to introduce new state
surface unless there is a concrete need.

Do not add:

- `DerivedTripKey`
- `InferredTripKey`
- `isConfirmed`
- `provisional`
- `unknown`

If you think one of these is required, stop and re-check whether that is
truly needed for this refactor. Current guidance is that it is not.

## Recommended Implementation Shape

### 1. Extend `vesselLocation` schema

Add optional `Key` to:

- base/storage validation fields
- inferred `ConvexVesselLocation` type
- downstream domain conversion as needed

Primary file:

- [schemas.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/schemas.ts)

### 2. Stamp `Key` during live-location normalization

Update `toConvexVesselLocation(...)` so the returned
`ResolvedVesselLocation` includes `Key`.

Use the same composite-key derivation logic already used by trips.

Important:

- do not duplicate key-format logic inline if a shared helper can be
  imported safely
- preserve current behavior for all existing raw fields

### 3. Let bulk upsert persist the new field naturally

`bulkUpsert` currently does whole-document replace/insert, so once the
schema shape includes `Key`, the mutation path should carry it through
without special logic.

Primary file:

- [mutations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/mutations.ts)

### 4. Verify public queries expose `Key`

Because queries return `vesselLocationValidationSchema`, this should
mostly happen automatically once the schema is updated.

Primary file:

- [queries.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocation/queries.ts)

### 5. Update Convex table schema

Ensure table definition reflects the updated validator.

Primary file:

- [schema.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/schema.ts)

### 6. Decide whether to add an index

This is optional and should be justified by use, not habit.

Possible future index:

- `by_key`

But do not add it reflexively unless the implementation or nearby
consumers truly need direct querying by `Key`.

Current minimum scope does not require it.

## Scope Guidance About Historic Rows

There is a separate `vesselLocationsHistoric` pipeline.

Do not automatically expand scope to historic rows unless there is a
clear reason during implementation.

This handoff is specifically about live `vesselLocations`.

If the agent sees obvious value in adding `Key` to historic rows too,
that should be treated as a follow-up decision, not silently bundled
into this work.

Historic files:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocationsHistoric/schemas.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocationsHistoric/actions.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocationsHistoric/mutations.ts`

## Expected Behavioral Outcome

After the refactor:

- current vessel location rows can be directly compared to current trip
  rows by `Key`
- debugging late-service cases should be easier because one can inspect
  `vesselLocations.Key` alongside `activeVesselTrips.Key`
- future backend and frontend simplification work can rely more heavily
  on key identity and less on terminal/time heuristics

This refactor alone is not the full architecture change. It is a
supporting step.

## Tests / Verification Expectations

At minimum, verify:

1. a live row with:
   - `VesselAbbrev`
   - `DepartingTerminalAbbrev`
   - `ArrivingTerminalAbbrev`
   - `ScheduledDeparture`
   produces the expected `Key`
2. a live row missing `ArrivingTerminalAbbrev` produces no `Key`
3. a live row missing `ScheduledDeparture` produces no `Key`
4. existing query consumers continue to deserialize the location shape
5. no existing code assumes `vesselLocations` lacks `Key`

If there are schema snapshots or type tests around vessel locations,
update them.

Recommended commands after edits, per repo guidance:

- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`

## Non-Goals

Do not fold these into the same change unless explicitly requested:

- rewriting the trip state machine
- introducing `at-dock` / `at-sea` fields on trips or locations
- rewriting timeline resolver logic
- adding confirmation/provisional UX state
- changing prediction logic
- reworking historic reconstruction tooling

## If The Agent Has Extra Time

Useful follow-up notes, but not required for this refactor:

- identify the best future place to centralize key derivation shared by:
  - location ingest
  - trip derivation
  - timeline projection
- note whether `ResolvedVesselLocation` should become the canonical
  carrier of `Key` throughout the trip-update pipeline
- identify any current frontend or debug views that could start using
  `vesselLocations.Key` immediately

## Bottom Line

Implement a narrow refactor:

- add optional `Key` to `vesselLocations`
- derive it using the existing canonical composite-key logic
- keep naming consistent with the rest of the system
- do not introduce extra state concepts

This is a consistency and architecture-alignment change, not a full
timeline rewrite.
