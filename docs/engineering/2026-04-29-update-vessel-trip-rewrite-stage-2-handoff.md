# updateVesselTrip Rewrite - Stage 2 Handoff

Date: 2026-04-29

Branch: `rewrite-update-vessel-trips`

## Read First

- `docs/engineering/2026-04-29-update-vessel-trip-rewrite-prd.md`
- `docs/engineering/2026-04-29-update-vessel-trip-rewrite-stage-1-handoff.md`
- `convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/updateVesselTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/types.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripComparison.ts`

Stage 1 is approved with one intentional failing test:

- `stamps LeftDockActual from LeftDock on dock-to-sea transition`

That failure is a rewrite target. The desired rule is:

```ts
LeftDockActual = location.LeftDock ?? location.TimeStamp
```

## Goal

Add the new functional pipeline modules for `updateVesselTrip`, but do not yet
wire `updateVesselTrip.ts` to the new path unless doing so is unavoidable for
basic compilation. Stage 3 will own the public entrypoint rewrite.

This stage should create small, testable building blocks that express the new
mental model:

```text
previous active trip + current location
  -> small lifecycle signal helpers
  -> completed row, if terminal changed
  -> base active row
  -> schedule-ready active row
```

## Files You May Edit

Preferred new files:

- `convex/domain/vesselOrchestration/updateVesselTrip/lifecycleSignals.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/completeTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/buildActiveTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/scheduleForActiveTrip.ts`

Allowed if needed:

- `convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts`
- New focused tests under `convex/domain/vesselOrchestration/updateVesselTrip/tests/`

Avoid in Stage 2:

- Do not delete old modules yet.
- Do not rewrite `updateVesselTrip.ts` into the new public path unless required
  to compile.
- Do not edit prediction, timeline, actualization, or orchestrator persistence
  modules.

## Required New Modules

### `lifecycleSignals.ts`

Add small standalone helpers. Do not introduce a pass-around event bundle.

Expected exports:

```ts
export const isNewTrip = (
  previousTrip: ConvexVesselTrip | undefined,
  location: ConvexVesselLocation
): boolean => ...

export const didLeaveDock = (
  previousTrip: ConvexVesselTrip | undefined,
  location: ConvexVesselLocation
): boolean => ...

export const leftDockTimeForUpdate = (
  previousTrip: ConvexVesselTrip | undefined,
  location: ConvexVesselLocation
): number | undefined => ...
```

Rules:

- `isNewTrip` is true only when a previous trip exists and
  `previousTrip.DepartingTerminalAbbrev !== location.DepartingTerminalAbbrev`.
- `didLeaveDock` should use the stabilized phase transition:
  `previousTrip?.AtDock === true && location.AtDockObserved === false`.
- `leftDockTimeForUpdate` should preserve an existing departure first, then use
  `location.LeftDock`, then fall back to `location.TimeStamp` only on a
  just-left-dock transition.
- Prefer `LeftDockActual ?? LeftDock` when preserving existing departure.

### `completeTrip.ts`

Add:

```ts
export const completeTrip = (
  previousTrip: ConvexVesselTrip,
  location: ConvexVesselLocation
): ConvexVesselTrip => ...
```

Rules:

- Completion is triggered by terminal abbreviation transition, not dock phase.
- Set `TripEnd` and `TripEnd` to `location.TimeStamp`.
- Set `TripEnd` and `TripEnd` to `location.TimeStamp`.
- Backfill `ArrivingTerminalAbbrev` from `location.DepartingTerminalAbbrev`
  when missing.
- Preserve origin/start fields from `previousTrip`.
- Compute `AtSeaDuration` from departure actual/fallback to arrival time.
- Compute `TotalDuration` from start time to completion time.
- Keep compatibility mirrors aligned:
  - `TripStart = previousTrip.TripStart ?? previousTrip.TripStart`
  - `LeftDockActual = previousTrip.LeftDockActual ?? previousTrip.LeftDock`

Do not actualize predictions here. Prediction actualization is outside
`updateVesselTrip`.

### `buildActiveTrip.ts`

Add:

```ts
export const buildActiveTrip = (input: {
  previousTrip: ConvexVesselTrip | undefined;
  completedTrip: ConvexVesselTrip | undefined;
  location: ConvexVesselLocation;
  isNewTrip: boolean;
}): ConvexVesselTrip => ...
```

Rules:

- Persist `AtDock` from `location.AtDockObserved`.
- For replacement trips:
  - generate a new `TripKey` from vessel abbrev + `location.TimeStamp`
  - set `TripStart` / `TripStart` / `TripStart` / `TripStart` to
    `location.TimeStamp`
  - set previous-leg metadata from `completedTrip` when available:
    - `PrevTerminalAbbrev`
    - `PrevScheduledDeparture`
    - `PrevLeftDock`
  - clear end/destination/departure/duration fields for the new active row
- For first-seen trips:
  - generate a new `TripKey`
  - set `TripStart` / `TripStart` to `location.TimeStamp`
  - do **not** stamp `TripStart`
  - do **not** stamp `TripStart`
- For continuing trips:
  - preserve `TripKey`, `TripStart`, `TripStart`, previous-leg metadata, and
    existing physical boundary facts
  - update location-owned fields from the current location
  - set departure fields using `leftDockTimeForUpdate`
  - set `LeftDockActual` from `location.LeftDock ?? location.TimeStamp` only on
    a just-left-dock transition
  - preserve existing `LeftDockActual` when already set
- Carry `Eta` from `location.Eta ?? previousTrip?.Eta`.
- Carry `NextScheduleKey` / `NextScheduledDeparture` initially; schedule module
  can clear or replace them later.

### `scheduleForActiveTrip.ts`

Add:

```ts
export const applyScheduleForActiveTrip = async (input: {
  activeTrip: ConvexVesselTrip;
  previousTrip: ConvexVesselTrip | undefined;
  completedTrip: ConvexVesselTrip | undefined;
  location: ConvexVesselLocation;
  isNewTrip: boolean;
  dbAccess: UpdateVesselTripDbAccess;
}): Promise<ConvexVesselTrip> => ...
```

Rules:

- Complete WSF fields win when both `location.ArrivingTerminalAbbrev` and
  `location.ScheduledDeparture` are present.
- Continuing trips with incomplete WSF must not call any DB access method.
- Continuing trips with incomplete WSF should carry existing schedule fields.
- Replacement/new trips with incomplete WSF may use schedule lookup only when:
  - `location.InService` is true
  - departing terminal identity exists and is passenger-terminal eligible
- Out-of-service replacement trips must call no DB methods.
- Non-passenger replacement trips may call `getTerminalIdentity`, but must not
  call scheduled-event methods.
- Prefer `previousTrip.NextScheduleKey` for replacement inference when present.
- If no schedule inference is available, return the active trip with its basic
  fields; do not throw.

Implementation may reuse logic from current `tripFields/resolveScheduleFromTripArrival.ts`,
but avoid recreating the same public subfolder/API unless it genuinely makes the
new pipeline simpler.

## Tests To Add Or Run

At minimum, add focused unit tests for the new pure modules if they help keep
Stage 3 small. Prioritize tests for:

- `isNewTrip` true/false
- `completeTrip` closeout fields
- first-seen active trip does not stamp `TripStart`
- continuing dock-to-sea uses `location.LeftDock` for `LeftDockActual`
- continuing incomplete WSF does not read DB access
- replacement incomplete WSF can infer schedule

Then run:

```sh
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests
```

Expected status during Stage 2:

- Public `computeVesselTripUpdates.test.ts` may still have the one
  `LeftDockActual from LeftDock` failure until Stage 3 wires the new path.
- New focused module tests should pass.

## Return To Supervisor

Report:

- New files created
- Any existing files changed
- Tests added
- Tests run and pass/fail output
- Whether the public Stage 1 failure still remains
- Any uncertainty about schedule inference boundaries

Do not proceed to Stage 3 wiring without review.
