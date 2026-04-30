# updateVesselTrip Rewrite - Stage 1 Handoff

Date: 2026-04-29

Branch: `rewrite-update-vessel-trips`

## Read First

- `docs/engineering/2026-04-29-update-vessel-trip-rewrite-prd.md`
- `convex/domain/vesselOrchestration/updateVesselTrip/README.md`
- `convex/domain/vesselOrchestration/updateVesselTrip/updateVesselTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/types.ts`
- Current tests under `convex/domain/vesselOrchestration/updateVesselTrip/tests/`
- `convex/functions/vesselOrchestrator/tests/tripStagePolicy.test.ts`

## Goal

Create a behavior-level test net for the future `updateVesselTrip` rewrite.

This stage should focus on the public contract:

```ts
updateVesselTrip(
  vesselLocation,
  existingActiveTrip,
  dbAccess
) -> VesselTripUpdate | null
```

Do not rewrite production modules in this stage unless a tiny test-helper export
is absolutely necessary. The point is to describe the desired behavior before
the implementation is changed.

## Files You May Edit

Preferred:

- `convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts`
- New test helper file under
  `convex/domain/vesselOrchestration/updateVesselTrip/tests/`, if it reduces
  duplication

Allowed if needed:

- `convex/functions/vesselOrchestrator/tests/tripStagePolicy.test.ts`

Avoid in Stage 1:

- `convex/domain/vesselOrchestration/updateVesselTrip/updateVesselTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripEvents.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripBuilders.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/basicTripRows.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/scheduleEnrichment.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripFields/`

## Current Test Problem

Several existing tests preserve the current implementation shape:

- `computeVesselTripUpdates.test.ts` spies on `detectTripEvents` and
  `buildUpdatedVesselRows`.
- `detectTripEvents.test.ts` tests a soon-to-be-obsolete event bundle.
- `buildTripCore.test.ts` and `buildCompletedTrip.test.ts` directly exercise
  builder seams that are likely to be deleted or renamed.

For Stage 1, do not spend energy preserving these internal seams. Add or rewrite
tests so they call `updateVesselTrip` directly and assert durable output rows.

## Required Behavior Tests

Cover these cases through the public `updateVesselTrip` function.

### 1. First-Seen Vessel

Input:

- `existingActiveTrip` is `undefined`
- location is docked with `AtDockObserved: true`

Expected:

- returns an active trip update
- does not return a completed trip
- active row has a generated `TripKey`
- active row has `TripStart` / `TripStart` from `location.TimeStamp`
- active row does **not** stamp `TripStart`

Why:

- We do not know when the vessel arrived before we first saw it.

### 2. Timestamp-Only Churn

Input:

- existing active trip already matches the new candidate except for
  `TimeStamp`

Expected:

- returns `null`

Why:

- The orchestrator should not persist trip rows for timestamp-only churn.

### 3. ETA-Only Change

Input:

- continuing trip
- location has a changed `Eta`

Expected:

- returns an active trip update
- no completed trip
- active row carries the new `Eta`

Why:

- ETA is a durable trip-field change, unlike `TimeStamp`.

### 4. Continuing Departure From Dock

Input:

- previous trip has `AtDock: true`
- current location has `AtDockObserved: false`
- current location has `LeftDock` defined, or leaves it undefined in a second
  variant

Expected:

- no completed trip
- active row has `AtDock: false`
- active row has `LeftDockActual`
- `LeftDockActual` equals `location.LeftDock` when present
- `LeftDockActual` falls back to `location.TimeStamp` when `LeftDock` is absent

Why:

- Departure can be detected from the stabilized phase transition.

### 5. Terminal Change Completes Trip

Input:

- previous trip departs terminal `ANA`
- current location departs terminal `ORI`

Expected:

- returns both `completedVesselTripUpdate` and `activeVesselTripUpdate`
- completed row has `TripEnd` and `TripEnd` equal to `location.TimeStamp`
- completed row has `TripEnd` and `TripEnd` equal to
  `location.TimeStamp`
- completed row backfills `ArrivingTerminalAbbrev` to `ORI` if missing
- replacement active row departs `ORI`
- replacement active row has a new `TripKey`
- replacement active row stamps `TripStart` from `location.TimeStamp`

Why:

- Terminal abbreviation transition is the authoritative new-trip signal.

### 6. Terminal Change Wins Over AtDockObserved Lag

Input:

- same as terminal-change case
- current location has `AtDockObserved: false`

Expected:

- still completes previous trip and starts replacement active trip

Why:

- WSF dock state can lag the terminal handoff.

### 7. Continuing Incomplete WSF Does Not Read Schedule

Input:

- continuing trip
- current location omits `ArrivingTerminalAbbrev`, `ScheduledDeparture`, and
  `ScheduleKey`
- existing trip may also lack those fields

Expected:

- no schedule DB access method is called
- active trip update is built or suppressed according to durable field changes
- no repeated schedule polling behavior is encoded

Implementation note:

- Use a `dbAccess` stub whose methods increment counters or throw with clear
  messages. For this case, the test should fail if any schedule method is
  invoked.

### 8. Replacement Incomplete WSF May Infer Schedule

Input:

- terminal-change replacement
- current location omits WSF trip fields
- previous trip has `NextScheduleKey`
- `dbAccess` can return matching scheduled departure/dock rows

Expected:

- schedule access is used
- replacement active row gets inferred:
  - `ArrivingTerminalAbbrev`
  - `ScheduledDeparture`
  - `ScheduleKey`
  - `SailingDay`
  - `NextScheduleKey`
  - `NextScheduledDeparture`, when available

Why:

- New/replacement trip schedule inference is allowed and bounded.

### 9. Out-Of-Service Replacement Skips Schedule

Input:

- terminal-change replacement
- current location has `InService: false`
- current location omits WSF trip fields

Expected:

- returns completed + replacement active rows
- no schedule lookup occurs

### 10. Non-Passenger Replacement Skips Schedule

Input:

- terminal-change replacement
- current departing terminal identity exists but has
  `IsPassengerTerminal: false`
- current location omits WSF trip fields

Expected:

- may call `getTerminalIdentity`
- must not call scheduled-event lookup methods
- returns completed + replacement active rows

## Helper Guidance

Prefer simple local factories:

- `ms(iso: string): number`
- `makeLocation(overrides?: Partial<ConvexVesselLocation>)`
- `makeTrip(overrides?: Partial<ConvexVesselTrip>)`
- `makeDbAccess(options?)`

The existing helper in
`convex/domain/vesselOrchestration/updateVesselTrip/tripFields/tests/testHelpers.ts`
can be copied or reused, but avoid coupling the new public tests to the
`tripFields/` folder if it makes Stage 5 deletion harder.

Recommended approach:

- Create a new `tests/testHelpers.ts` in `updateVesselTrip/tests/`.
- Keep fixture values boring and explicit.
- Count schedule calls in the helper so tests can assert which reads happened.

## What Not To Assert

Do not assert:

- `detectTripEvents` output
- `buildUpdatedVesselRows` output
- `TripLifecycleEventFlags` during the main update flow
- private helper call order
- exact internal module names

Do assert:

- returned active/completed row fields
- `null` vs update result
- schedule DB access call counts for continuing vs replacement cases

## Expected Test Status

Some Stage 1 tests may fail against the current implementation because they
encode the intended rewrite behavior. In particular, these are likely to expose
current-design mismatch:

- first-seen docked trip should not stamp `TripStart`
- terminal change should complete even if `AtDockObserved` is false

If tests fail, leave them in place and report the exact failures. Do not contort
the tests to fit the current implementation.

## Verification

Run focused tests:

```sh
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts
```

If a new helper or new file is added, run all updateVesselTrip tests:

```sh
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests
```

If practical, also run downstream contract tests:

```sh
bun test convex/domain/vesselOrchestration/updateTimeline/tests/timelineHandoffFromTripUpdate.test.ts
bun test convex/domain/vesselOrchestration/updateVesselPredictions/tests/predictionInputsFromTripUpdate.test.ts
bun test convex/domain/vesselOrchestration/updateVesselActualizations/tests/deriveDepartNextActualizationIntent.test.ts
```

## Return To Supervisor

Report:

- Files changed
- Tests added or rewritten
- Tests run and pass/fail output
- Any intentionally failing behavior tests
- Any ambiguity in the PRD discovered while writing tests

Do not proceed to implementation modules. Phase 2 starts only after review.
