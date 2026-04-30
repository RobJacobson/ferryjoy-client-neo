# updateVesselTrip Rewrite - Stage 2 Review Note

Date: 2026-04-29

Reviewer: Deep Thought / supervising agent

## Summary

Stage 2 is close. The new modules are small and readable, and the public
`updateVesselTrip` entrypoint was not rewired prematurely. The focused Stage 2
suite passes, and the public suite still has only the expected
`LeftDockActual from LeftDock` failure.

Before Stage 2 is approved, please make the changes below.

## Requested Changes

### 1. Skip schedule inference when terminal identity is missing

File:

- `convex/domain/vesselOrchestration/updateVesselTrip/scheduleForActiveTrip.ts`

Current behavior:

```ts
const terminalIdentity = await dbAccess.getTerminalIdentity(
  location.DepartingTerminalAbbrev
);
if (terminalIdentity?.IsPassengerTerminal === false) {
  return activeTrip;
}
```

This allows schedule-event reads when `getTerminalIdentity(...)` returns
`null`, because `terminalIdentity?.IsPassengerTerminal === false` is false for
`null`.

The Stage 2 handoff said replacement/new schedule lookup is allowed only when:

- `location.InService` is true
- departing terminal identity exists
- departing terminal is passenger-terminal eligible

Please change the guard to skip when identity is missing:

```ts
if (
  terminalIdentity === null ||
  terminalIdentity.IsPassengerTerminal === false
) {
  return activeTrip;
}
```

Also add a focused test in `stage2PipelineModules.test.ts` proving that a
replacement trip with incomplete WSF and `getTerminalIdentity(...) -> null` does
not call scheduled-event lookup methods.

### 2. Do not couple Stage 2 tests to `activeTripSchedule/tests/testHelpers`

File:

- `convex/domain/vesselOrchestration/updateVesselTrip/tests/stage2PipelineModules.test.ts`

Current import:

```ts
import { makeLocation, makeTrip, ms } from "../activeTripSchedule/tests/testHelpers";
```

This makes the new pipeline-module tests depend on the old `activeTripSchedule/` test
fixture folder, which we may delete in Stage 5. Please inline the small fixture
helpers in this test file, or otherwise define local helpers that do not import
from `activeTripSchedule/`.

This is a little tedious, but it keeps the new tests from anchoring the old
folder in place.

## Acceptable As-Is

- The generated `convex/_generated/api.d.ts` update is acceptable here because
  Stage 2 added new domain modules under `convex/`, so codegen naturally picked
  them up. This is different from the prior test-helper generated churn.
- `scheduleForActiveTrip.ts` temporarily reuses `applyResolvedTripScheduleFields`
  and `resolveScheduleFromTripArrival`. That is fine for Stage 2. Stage 3/5 can
  decide whether to keep, inline, or replace that schedule helper boundary.

## Verification

Please re-run:

```sh
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests/stage2PipelineModules.test.ts
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests
```

Expected:

- Stage 2 module tests pass.
- Public `computeVesselTripUpdates.test.ts` still has only the known
  `LeftDockActual from LeftDock` failure until Stage 3 wiring.
