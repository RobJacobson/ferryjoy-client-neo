## VesselTrips `at-dock` / `at-sea` Refactor Handoff

This note is for the next agent implementing the next backend
simplification step after the `vesselLocations.Key` refactor.

The purpose of this task is to simplify the `vesselTrips/updates`
state model so it reflects physical vessel reality more directly and
stops modeling feed latency as its own lifecycle state.

This is not yet the full `VesselTimeline` rewrite.

## Goal

Refactor the active trip lifecycle so the core physical model is only:

- `at-dock`
- `at-sea`

The key design rule is:

- when a vessel arrives at dock, the previous trip is complete
- the next trip begins immediately
- we do not wait for the live API to expose the next trip's
  `ScheduledDeparture` / `ArrivingTerminalAbbrev` before rolling forward

The user wants to move away from the current extra boundary/waiting
state that exists mainly because the live API can lag by one or two
minutes before exposing the next trip.

## Architectural Decision Summary

The user explicitly wants this design direction:

1. Physical state should be binary:
   - `at-dock`
   - `at-sea`
2. Arrival at dock starts the next trip immediately
3. The next trip key should be inferred from the schedule backbone when
   the feed lags
4. We should not preserve a separate “in between” trip state just to
   wait for feed confirmation
5. We should not add extra explicit status fields for now, such as:
   - `provisional`
   - `unknown`
   - `isConfirmed`
6. Confirmation logic may exist internally later if needed, but it is
   not part of this task’s user-facing or schema-level goals

The user is fundamentally uncomfortable with heuristic matching. The
intent of this refactor is to make key assignment more deterministic and
reduce ambiguity, not to invent new fallback heuristics.

## Helpful Docs To Read First

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/.cursor/rules/code-style.mdc`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/vessel-location-key-refactor-handoff.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/vessel-timeline-resolver-handoff.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md`

Why these matter:

- `vessel-location-key-refactor-handoff.md` documents the newly aligned
  `Key` strategy and recent identity changes
- `vessel-timeline-resolver-handoff.md` explains why late service and
  same-terminal ambiguity exposed the current model’s weaknesses
- `vesselTrips/updates/README.md` describes the current tri-state-like
  lifecycle and where it grew complex
- `vesselTimeline` docs explain the downstream system this refactor is
  meant to support

## Current Problem

The current trip lifecycle has effectively grown a third operational
condition:

- still on the old trip
- physically at dock
- waiting for the next trip to become “start-ready” in the feed

This is represented today through combinations of:

- delayed `isCompletedTrip`
- `dock_hold`
- `shouldStartTrip`
- explicit dependence on current-tick
  `ScheduledDeparture + ArrivingTerminalAbbrev`

That design makes the code harder to reason about and likely contributes
to missed or delayed timeline actuals during late service.

The current docs still describe:

- `start`
- `dock_hold`
- `continue`

in
[baseTripFromLocation.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/baseTripFromLocation.ts)
and
[README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/README.md).

The user wants to remove the conceptual need for that feed-latency
holding pattern.

## Desired Mental Model

Separate these two questions:

1. Where is the vessel physically right now?
   - `at-dock`
   - `at-sea`

2. Which trip key does that physical state belong to?

The intended answer is:

- while `at-sea`, the vessel belongs to the current trip key
- on arrival at dock, the old trip ends immediately
- the vessel is immediately attached to the next scheduled trip key
- when the vessel departs again, it is still on that same next trip key

In short:

- arrival rolls the trip forward
- departure changes phase

Feed lag should not block that rollover.

## Key Inference Rule

This is the central rule to implement:

- on arrival at dock, assign the next trip key from the schedule
  backbone for that vessel / terminal / day

This is a deliberate, reasonable inference, not a generic heuristic.

The user’s framing was:

- if the vessel has arrived in service at dock, why would it be anything
  other than the next scheduled trip?

That rule should be explicit and narrow.

If there are true exceptions such as:

- out-of-service movement
- relief moves
- route swaps
- removed sailings

handle them only if the current code or data already proves they matter
for this task. Do not over-engineer speculative exception frameworks.

## Scope Of This Task

This task is backend-focused.

Primary goal:

- simplify `vesselTrips/updates`

Secondary goal:

- make the resulting trip identity model easier for future
  `VesselTimeline` work to consume

This task does **not** need to complete the frontend contract rewrite.

## Likely Files To Touch

Primary state-machine files:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripDerivation.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/eventDetection.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/baseTripFromLocation.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/buildTrip.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/buildCompletedTrip.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/processVesselTrips/processVesselTrips.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/processVesselTrips/processCurrentTrips.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/processVesselTrips/processCompletedTrips.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/appendSchedule.ts`

Shared identity helpers:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/tripIdentity.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/keys.ts`

Likely schedule lookup dependencies:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/scheduledTrips/queries.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/scheduledTrips/schemas.ts`

Potential persistence touchpoints:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/mutations.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/schemas.ts`

Downstream projection files to verify, not necessarily rewrite:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/mutations.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/normalizedEvents.ts`

## Recommended Implementation Direction

### 1. Make physical phase primary

The trip update logic should be organized around physical transitions:

- vessel departs dock -> `at-sea`
- vessel arrives at dock -> `at-dock`

Avoid using “trip start readiness” as the controlling lifecycle axis.

The code may still need `ScheduledDeparture` and
`ArrivingTerminalAbbrev` for identity confirmation or enrichment, but
those fields should no longer determine whether the system is allowed to
roll from one trip to the next.

### 2. Replace `dock_hold` as a core concept

Current `dock_hold` exists to preserve the old trip after arrival while
waiting for the next trip to become start-ready.

That should be the first concept to remove or collapse.

The desired behavior is:

- arrival at dock completes the old trip
- the next trip is created immediately

If some helper still needs a temporary internal distinction during the
rewrite, keep it implementation-local and do not preserve `dock_hold` as
the domain model.

### 3. Infer next trip key from schedule on arrival

The agent will likely need one deterministic schedule lookup such as:

- given vessel
- current terminal
- current service day / time
- current just-arrived moment

find the next scheduled trip for that vessel leaving that terminal

That inferred trip should become the active trip immediately on arrival.

Do not wait for live feed readiness.

### 4. Keep departure as a phase change, not a trip rollover

Once the next trip is assigned at dock, departure should simply move
that same trip from `at-dock` to `at-sea`.

This should reduce the current coupling where trip identity and dock
departure detection are too tightly interleaved.

### 5. Preserve prediction/event projection behavior as much as possible

Do not rewrite the full prediction system unless the new lifecycle model
forces local changes.

Preferred approach:

- keep prediction APIs and projection plumbing stable where possible
- adapt them to the simpler trip lifecycle

The goal is to simplify state ownership without exploding scope.

## Suggested Concrete Questions To Resolve

The next agent should answer these in code and/or a short follow-up
note:

1. What exact schedule lookup should determine the “next trip” on
   arrival at dock?
2. What happens for first-seen vessels already at dock if the live feed
   has not exposed the next trip yet?
3. Should `TripStart` still mean observed start event only, or should it
   be redefined around dock arrival / inferred trip start?
4. How should `Prev*` fields behave when the next trip begins at arrival
   instead of after delayed feed readiness?
5. Are current prediction triggers still sensible once arrival becomes
   the rollover point?

The user has not answered all of these yet, so do not silently invent
far-reaching semantics unless needed. If you must choose, prefer the
simplest option that preserves current downstream behavior.

## Recommended Invariants

The rewrite should aim to enforce these invariants:

1. A vessel is always modeled physically as either `at-dock` or
   `at-sea`
2. Arrival at dock completes the old trip immediately
3. Arrival at dock starts the next trip immediately
4. Departure does not create the next trip; it advances the current trip
   from `at-dock` to `at-sea`
5. A trip key should be assigned as soon as the system can
   deterministically infer it from schedule
6. Feed lag should not create a third domain state
7. Predictions may refine timing, but should not control trip identity

## Tests To Add Or Rewrite

This refactor needs scenario tests, not just helper tests.

At minimum add coverage for:

### Case 1: Late arrival, feed lags on next-trip fields

- vessel arrives at dock
- `ScheduledDeparture` / `ArrivingTerminalAbbrev` for the next trip are
  still absent in the live feed
- system should still complete the old trip and assign the next trip key

### Case 2: Departure after inferred next trip already exists

- vessel arrived previously
- next trip was inferred at dock
- vessel departs before feed confirmation
- trip should remain the same key and transition to `at-sea`

### Case 3: Feed later catches up

- same vessel/trip later receives `ScheduledDeparture` /
  `ArrivingTerminalAbbrev`
- no wrong extra rollover should occur

### Case 4: First-seen vessel at dock

- first observed row is already `at-dock`
- system should assign the most reasonable current/next trip key
  deterministically

### Case 5: End-of-day seam

- arrival near the service-day boundary
- inferred next trip key and `SailingDay` should remain coherent

### Case 6: Missing `LeftDock`

- ensure the simplified model degrades gracefully when departure feed
  evidence is sparse

Likely test locations:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tests/processVesselTrips.test.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tests/processCurrentTrips.test.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tests/processCompletedTrips.test.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tests/eventDetection.test.ts`
- add new scenario tests if current files become too helper-oriented

## Documentation Expectations

If the refactor lands, update at least:

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/README.md`

The current README still describes the existing start/dock_hold/continue
model and delayed boundary behavior. That will become misleading after
this change.

Also update any comments that still imply:

- next trip starts only when feed fields appear
- `dock_hold` is a first-class domain concept

## Non-Goals

Do not silently bundle these into the same PR unless truly required:

- full frontend resolver rewrite
- backend `rowId` / `activeRowId` contract for `VesselTimeline`
- large prediction-system redesign
- introducing explicit confirmation/provisional state fields
- rewriting `vesselLocationsHistoric`
- broad schema redesign outside `vesselTrips`

Those are likely future steps, not this one.

## Recommended Verification

After implementation, run the repo-standard checks relevant to the
backend:

- `bun test convex/functions/vesselTrips/updates/tests/*.test.ts`
- `bun run convex:typecheck`

Also run any new targeted tests added for inferred-next-trip behavior.

If repo-wide typecheck still fails for unrelated frontend reasons,
document that clearly rather than treating it as part of this task.

## Bottom Line

Implement a deliberate backend simplification:

- model vessel phase as only `at-dock` / `at-sea`
- roll the trip forward on arrival, not when feed latency clears
- infer the next trip key from schedule immediately
- remove the conceptual need for `dock_hold` as a domain state

This task is about making the trip lifecycle reflect physical reality
and deterministic schedule identity more directly.
