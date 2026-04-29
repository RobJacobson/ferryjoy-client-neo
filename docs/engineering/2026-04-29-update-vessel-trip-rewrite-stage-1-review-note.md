# updateVesselTrip Rewrite - Stage 1 Review Note

Date: 2026-04-29

Reviewer: Deep Thought / supervising agent

## Summary

This Stage 1 test pass is directionally good. It moved
`computeVesselTripUpdates.test.ts` away from spying on internal modules and
toward the public `updateVesselTrip(...) -> VesselTripUpdate | null` contract.
That is exactly the right test posture for the rewrite.

Before we treat Stage 1 as approved, please make the small corrections below.

## Requested Changes

### 1. Make the timestamp-only churn fixture truly timestamp-only

Current failing test:

- `returns null for continuing timestamp-only churn`

The test currently expects `null`, but the existing fixture has additional
durable field differences beyond `TimeStamp`: the active candidate computes
`AtDockDuration` and `TripDelay`, while the `existingTrip` fixture leaves those
fields undefined.

That makes the scenario ambiguous. The PRD rule is:

> If nothing has changed except `TimeStamp`, return `null`.

Please adjust this fixture so the existing trip already has the duration/delay
values the candidate would derive, or otherwise choose a state where the
candidate row is identical except for `TimeStamp`.

Suggested fixture adjustment:

```ts
const existingTrip = makeTrip({
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  AtDockDuration: 56.6,
  TripDelay: -0.4,
});
```

If those values feel too tied to the current implementation, compute them in the
test from the fixture timestamps with the same shared `calculateTimeDelta`
helper used by production. The important thing is that this test should prove
timestamp-only suppression, not decide whether missing derived duration fields
are durable changes.

### 2. Keep the LeftDockActual failure as an intentional rewrite target

Current failing test:

- `stamps LeftDockActual from LeftDock on dock-to-sea transition`

This failure is useful and should remain. The intended contract is:

```ts
LeftDockActual = location.LeftDock ?? location.TimeStamp
```

The current implementation uses `TimeStamp` even when `LeftDock` is present.
That should be fixed in the Stage 2/3 implementation, not weakened in the test.

### 3. Remove or explain generated API churn

The current diff includes:

- `convex/_generated/api.d.ts`

This appears to be generated churn caused by adding
`convex/domain/vesselOrchestration/updateVesselTrip/tests/testHelpers.ts`.

Please either:

- revert the generated-file change if it is not required for the test pass, or
- explicitly mention in the Stage 1 return note that codegen picked up the new
  test helper and the generated API update is intentional.

No production schema/API surface changed in Stage 1, so avoiding generated churn
is preferred if practical.

## Notes On Reported Ambiguities

### Duration-like fields and timestamp-only churn

Treat this as a test-fixture issue for Stage 1. If `AtDockDuration` or
`TripDelay` truly changes, the update is no longer timestamp-only churn. The
rewrite can still decide when to compute those fields, but the test name should
match the row comparison it asserts.

### Continuing incomplete WSF and DB reads

The strict zero-read test is appropriate for Stage 1. Continuing trips with
incomplete WSF fields should not call terminal or schedule DB access. New-trip
schedule enrichment is the only permitted lookup path.

### Replacement trips that skip schedule lookup

Do not add assertions yet for whether skipped replacement trips preserve or
clear `NextScheduleKey` / `NextScheduledDeparture`. That belongs in Stage 2/3
once the active-row builder and schedule-enrichment boundary are explicit.

## Re-run After Changes

Please re-run:

```sh
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests
```

Expected result after the timestamp-only fixture correction:

- The timestamp-only test should pass.
- The `LeftDockActual from LeftDock` test may still fail until the rewrite
  implementation stage.
