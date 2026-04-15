# PRD: Vessel Trip Timestamp Semantics Refactor

Date: 2026-04-14
Audience: implementation agent and reviewer for the trip/timeline timestamp
refactor
Status: proposed implementation plan

## Purpose

Turn the timestamp semantics memo into an execution plan that another agent can
implement in stages while a reviewer holds the semantic line.

This document assumes the semantic baseline in:

- [trip-timestamp-semantics-memo-2026-04-14.md](./trip-timestamp-semantics-memo-2026-04-14.md)
- [arrive-dock-actual-semantics-handoff-2026-04-13.md](./arrive-dock-actual-semantics-handoff-2026-04-13.md)
- [vesseltimeline-reconciliation-memo-2026-04-14.md](./vesseltimeline-reconciliation-memo-2026-04-14.md)
- [code-style.mdc](../../.cursor/rules/code-style.mdc)

The implementation agent must follow the project style guide in
[code-style.mdc](../../.cursor/rules/code-style.mdc).

Field names match the semantic memo — **one name per concept**:
`ArrivedCurrActual`, `ArrivedNextActual`, and `LeftDockActual` (physical
departure). No parallel aliases.

## Cutover Assumption

This PRD assumes a clean-slate cutover:

- Convex writes may be paused during the refactor.
- The relevant trip and timeline tables may be cleared before the new model is
  considered live.
- Preserving old trip rows is not a product requirement.
- Dual-write, migration-rescue logic, and backward-compat behavior for old rows
  are out of scope.

Practical consequence:

- the implementation should optimize for the correct end state, not for
  temporary coexistence with pre-refactor trip rows
- temporary adapters inside the branch are acceptable only to keep staged work
  reviewable; they must not become the final design
- operational pause / clear / restart steps are user-owned and out of scope for
  this document

## Problem Statement

The current trip model mixes three different concepts under overlapping field
names:

1. coverage of a trip row in our system
2. trusted physical dock boundaries for this sailing
3. lifecycle bookkeeping used to complete one row and start the next

That ambiguity currently leaks into:

- `activeVesselTrips` and `completedVesselTrips`
- lifecycle builders in
  [convex/functions/vesselTrips/updates/tripLifecycle](../../convex/functions/vesselTrips/updates/tripLifecycle)
- `eventsActual` projection
- same-day `VesselTimeline` reseed/reconciliation
- ML feature extraction and prediction gating
- frontend trip/timeline rendering utilities

The biggest semantic issue is that `AtDockActual` behaves more like dock
occupancy or first-recorded coverage than a trustworthy arrival boundary, while
`TripStart` and `TripEnd` are also carrying multiple meanings.

## Goals

- Separate coverage timestamps from physical boundary timestamps.
- Make the trip lifecycle use one consistent domain clock:
  `ConvexVesselLocation.TimeStamp`.
- Keep departure as a first-class physical boundary next to arrival.
- Make same-tick chaining explicit:
  previous destination arrival == previous coverage end == next coverage start
  == next origin arrival in the happy path.
- Prevent downstream readers from inferring physical boundaries from coverage
  timestamps.
- Give the implementation agent a stage-by-stage plan with clear review gates.

## Non-Goals

- Migrating or rescuing legacy trip rows.
- Supporting old and new timestamp semantics at runtime indefinitely.
- Redesigning the public VesselTimeline product contract beyond what is required
  by the semantic cleanup.
- Reworking unrelated schedule identity or module-boundary concerns outside the
  timestamp refactor.

## Desired End State

The system should expose two timestamp layers.

### Layer A: physical boundary actuals

These are optional and only populated when the pipeline can stand behind the
physical event:

| Field | Meaning |
| --- | --- |
| `ArrivedCurrActual` | Actual arrival at the origin dock for this sailing |
| `ArrivedNextActual` | Actual arrival at the destination dock for this sailing |
| `LeftDockActual` | Actual departure from the origin dock for this sailing |

Notes:

- No coverage timestamp may be used as a substitute for these fields.

### Layer B: coverage timestamps

These describe only the period this trip row represents in our system:

| Field | Meaning |
| --- | --- |
| `StartTime` | When the row enters the recorded window |
| `EndTime` | When the row leaves the recorded window |

Hard rule:

- `StartTime` and `EndTime` are never physical boundary facts by themselves.

## Product and Engineering Requirements

### Required invariants

1. All lifecycle timestamps use feed time, not server wall clock.
2. In the happy path, completion and next-trip start happen on the same tick.
3. `previous.ArrivedNextActual === next.ArrivedCurrActual` when the boundary is
   known for both adjacent trips.
4. Synthetic coverage close is allowed for `EndTime`.
5. Synthetic coverage close must not imply `ArrivedNextActual`.
6. `eventsActual` and ML features must read physical boundary actuals, not
   coverage timestamps, when representing `dep-dock` and `arv-dock`.

Clarification:

- this rule applies to domain lifecycle and boundary semantics only; unrelated
  metadata timestamps such as `UpdatedAt` remain out of scope

### Explicit legacy treatment

The implementation should retire these meanings:

- `AtDockActual` must stop acting as a fuzzy arrival-like field.
- `TripStart` must stop acting as both coverage start and physical arrival.
- `TripEnd` must stop acting as both coverage end and physical destination
  arrival.
- `ArriveDest` must be treated as the legacy predecessor to `ArrivedNextActual`,
  not as a separate long-term concept.

## Execution Model

One implementation agent should own code changes. One reviewer should own
semantic correctness and stage approval.

Recommended workflow:

1. Land work in ordered stages.
2. Keep each stage green with focused tests.
3. Do not start the final cutover until Stage 5 is approved.
4. Treat this PRD as the acceptance contract during review.

## Stage Plan

### Stage 0: Freeze and Bound the Cutover

### Goal

Create a shared operational boundary so implementation is free to optimize for
the target model instead of preserving old data.

### Scope

- Confirm the wipe set for the final cutover.
- Confirm that backward-compat behavior for old trip rows is not required.
- Mark any docs or comments that still imply additive migration as obsolete for
  this effort.

### Suggested cutover tables

- `activeVesselTrips`
- `completedVesselTrips`
- `eventsActual`
- `eventsPredicted`
- same-day `eventsScheduled` rows if a forced rebuild is part of the restart

### Deliverables

- this PRD approved

### Exit Criteria

- no implementation task in later stages depends on preserving old rows
- reviewer and implementation agent agree on the table reset strategy
- reviewer and implementation agent explicitly confirm whether
  `eventsScheduled` is in the wipe set or is rebuilt from a known source
- reviewer and implementation agent explicitly confirm whether
  `eventsPredicted` is always wiped and regenerated, and in what order relative
  to trip rebuilds

### Stage 1: Define Canonical Timestamp Contracts

### Goal

Establish the field vocabulary and type-level contracts that the rest of the
refactor will follow.

### Scope

- Update trip schemas and shared types in:
  [convex/functions/vesselTrips/schemas.ts](../../convex/functions/vesselTrips/schemas.ts)
- Update any shared helper types that still assume `TripStart` / `TripEnd` /
  `AtDockActual` semantics.
- Introduce a single canonical glossary in code comments and docs.

### Requirements

- The storage model must distinguish physical boundary actuals from coverage.
- Avoid temporary alias layers; prefer the final field names in schema and
  types from the start of the refactor branch.
- The schema, validators, and types must strongly prevent future readers from
  mistaking coverage for dock-boundary truth.

### Acceptance Criteria

- reviewer can point to one canonical meaning for each timestamp field
- no new code introduced in this stage depends on `AtDockActual` as an arrival
  boundary
- updated types compile cleanly

### Stage 2: Refactor Write-Side Trip Lifecycle

### Goal

Make trip creation, active updates, completion, and chaining write the new
semantics correctly.

### Primary ownership

- [convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/buildTrip.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/buildTrip.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/buildCompletedTrip.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/buildCompletedTrip.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/processCompletedTrips.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/processCompletedTrips.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/processCurrentTrips.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/processCurrentTrips.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts)

### Requirements

- New trips open with `StartTime`.
- Origin arrival is written only when the pipeline truly asserts it.
- Departure actual uses the physical departure field.
- Completed trips close with `EndTime`.
- Destination arrival is written only when physically asserted.
- Same-tick chaining is explicit in the happy path.
- Synthetic close writes only coverage semantics.
- Prediction-gating behavior currently keyed off `TripStart` must be explicitly
  re-derived rather than blindly renamed.

### Acceptance Criteria

- unit tests cover:
  - cold start
  - happy-path same-tick arrival/complete/start-next using one feed
    `TimeStamp` for the boundary
  - warm resume with synthetic `EndTime`
  - departure before destination arrival
- reviewer can verify that no lifecycle writer uses coverage timestamps as a
  boundary fallback

### Stage 3: Align Actual Projection and Timeline Reseed

### Goal

Ensure `eventsActual` and same-day timeline rebuild logic consume the new trip
semantics without reintroducing the old ambiguity.

### Primary ownership

- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](../../convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)
- [convex/domain/timelineRows/bindActualRowsToTrips.ts](../../convex/domain/timelineRows/bindActualRowsToTrips.ts)
- [convex/domain/timelineReseed/buildReseedTimelineSlice.ts](../../convex/domain/timelineReseed/buildReseedTimelineSlice.ts)
- [convex/domain/timelineReseed/reconcileLiveLocations.ts](../../convex/domain/timelineReseed/reconcileLiveLocations.ts)

### Requirements

- `eventsActual` must represent physical boundary facts only.
- Coverage timestamps must not be projected as actual boundaries.
- Same-day reseed must preserve the physical-first behavior already established
  by the timeline refactor.
- Timeline rebuild logic must still support physical-only actuals when no safe
  scheduled row exists.

### Acceptance Criteria

- tests prove departure projection prefers the physical departure actual
- tests prove destination actuals are sourced from physical arrival semantics,
  not coverage end
- reviewer can trace one same-day rebuild path without seeing `StartTime` or
  `EndTime` used as `dep-dock` / `arv-dock`

### Stage 4: Update ML, Prediction, and Query-Side Readers

### Goal

Move all downstream readers to the new semantics so the write-side cleanup is
not undone by stale interpretation logic.

### Primary ownership

- [convex/domain/ml/shared/unifiedTrip.ts](../../convex/domain/ml/shared/unifiedTrip.ts)
- [convex/domain/ml/shared/features.ts](../../convex/domain/ml/shared/features.ts)
- [convex/domain/ml/prediction/predictTrip.ts](../../convex/domain/ml/prediction/predictTrip.ts)
- [convex/functions/vesselTrips/hydrateTripPredictions.ts](../../convex/functions/vesselTrips/hydrateTripPredictions.ts)
- query and render helpers that still read `TripStart`, `TripEnd`,
  `AtDockActual`, or raw `LeftDock` as the primary semantic source

### Requirements

- ML feature definitions must explicitly decide whether they want coverage or
  physical boundaries.
- Prediction gating must not accidentally regress because a renamed field was
  mechanically substituted without semantic review.
- Query-side mapping may temporarily adapt backend names to existing UI shapes,
  but the adapter must be isolated and documented as temporary.

### Acceptance Criteria

- reviewer can explain each ML feature in terms of either coverage or physical
  semantics
- no query helper silently treats `EndTime` as guaranteed arrival
- frontend-facing shapes remain internally consistent for the duration of the
  branch

### Stage 5: Frontend Alignment, Cleanup, and Final Cutover

### Goal

Remove the old vocabulary from the active code path and make the clean-slate
restart operationally safe.

### Scope

- update frontend timeline and trip render helpers
- remove obsolete compatibility helpers
- update README-level docs that still describe the old timestamp model

### Candidate files

- [src/features/VesselTripTimeline](../../src/features/VesselTripTimeline)
- [src/features/TimelineFeatures/shared](../../src/features/TimelineFeatures/shared)
- [convex/functions/vesselTrips/updates/README.md](../../convex/functions/vesselTrips/updates/README.md)
- ML and timeline docs that still teach `TripStart` / `TripEnd` semantics

### Acceptance Criteria

- no production code path depends on the old overloaded meanings
- obsolete timestamp vocabulary is either removed or clearly marked as legacy
- operational restart steps remain user-owned and are not required as part of
  this PRD deliverable

## Review Checklist

The reviewer should reject a stage if any of these are true:

- a coverage field is used as a physical boundary fact
- `AtDockActual` still carries fuzzy first-seen or dock-occupancy semantics in
  the final design
- `TripEnd` or `EndTime` is treated as guaranteed destination arrival
- `eventsActual` is being written from coverage timestamps
- a rename happened mechanically without a semantics-level test proving the new
  meaning

## Testing Requirements

Each stage should add or update targeted tests near the code it changes.

Minimum final test coverage:

- lifecycle start/leave/arrive/complete happy path
- cold start without asserted origin arrival
- warm resume with synthetic coverage close
- departure projection from physical departure actual
- timeline reseed preserving physical-only actual rows
- ML or prediction readers consuming the intended timestamp layer

Run at minimum:

- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`

## Recommended First PR

The first implementation PR should cover Stage 1 only.

Why:

- it creates the vocabulary that later stages review against
- it prevents the larger lifecycle and timeline edits from smuggling in
  unresolved semantics
- it gives the reviewer a stable contract before the more invasive refactor

## Open Decisions to Resolve During Implementation

- which query boundary should temporarily shield the frontend while backend
  semantics change (if any)

Optimize for correctness and reviewability, not backward compatibility with old
stored rows.
