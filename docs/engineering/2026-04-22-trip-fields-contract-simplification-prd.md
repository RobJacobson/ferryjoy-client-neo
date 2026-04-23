# Trip Fields Contract Simplification PRD

**Date:** 2026-04-22  
**Audience:** The next coding agent implementing cleanup in `convex/domain/vesselOrchestration/updateVesselTrips` and adjacent orchestrator code.

## Purpose

Simplify the `tripFields` refactor so the code expresses one narrow idea clearly:

> Resolve the current trip's schedule-facing fields once, then build the trip row from that resolved contract.

The implementation should preserve current behavior while trimming contract surface area, removing redundant transform steps, and making the main flow easier to read.

## Executive Summary

The current refactor is broadly correct, but it still carries extra shape and extra steps:

1. `inferTripFieldsFromSchedule(...)` returns more fields than the next step actually uses.
2. The code resolves trip fields, partially applies them onto a location, then re-derives some of the same identity fields during trip construction.
3. Next-leg schedule enrichment is split awkwardly across the inferred contract and a later enrichment step.
4. A single-vessel seam still uses a one-entry map-shaped input.

This PRD asks the implementing agent to keep behavior, but reduce the moving parts.

## Goals

- Favor the narrowest possible interface between `tripFields` and `tripLifecycle`.
- Remove contract fields that are not actually consumed at that seam.
- Avoid "resolve, apply, re-derive, patch back" flows where one resolved object could suffice.
- Keep physical lifecycle detection separate from schedule inference.
- Preserve all current tests or replace them with tighter equivalents.

## Non-Goals

- Do not change dock/sea debounce policy.
- Do not redesign schedule snapshot infrastructure.
- Do not change persistence semantics for active/completed trips.
- Do not change user-visible behavior unless required to fix a concrete bug.
- Do not broaden the public `computeVesselTripsRows` contract.

## Current Problems

### 1. The `InferredTripFields` contract is wider than the seam needs

Today `InferredTripFields` includes:

- current-trip fields:
  - `ArrivingTerminalAbbrev`
  - `ScheduledDeparture`
  - `ScheduleKey`
  - `SailingDay`
- next-leg fields:
  - `NextScheduleKey`
  - `NextScheduledDeparture`
- metadata:
  - `tripFieldDataSource`
  - `tripFieldInferenceMethod`

But the main seam only directly applies:

- `ArrivingTerminalAbbrev`
- `ScheduledDeparture`
- `ScheduleKey`

`SailingDay` is patched in later.  
`NextScheduleKey` and `NextScheduledDeparture` are not applied there at all.

Result: the returned object suggests a single resolved contract, but the caller really consumes it in fragments.

### 2. Current-trip identity is resolved twice

The flow today is effectively:

1. resolve trip fields
2. overlay a subset onto the location
3. build the base trip from that prepared location
4. re-derive `ScheduleKey` / `SailingDay` from the prepared location
5. patch `SailingDay` back onto the built trip

That is extra mental load and extra code surface.

### 3. Next-leg enrichment ownership is blurry

`buildInferredTripFields` and fallback logic both produce next-leg fields, but `attachNextScheduledTripFields` also owns next-leg enrichment.

This makes it unclear which module is authoritative for:

- preserving carried next-leg fields
- looking up next-leg fields from the current segment
- deciding whether next-leg fields belong in the current-trip resolution contract at all

### 4. One-vessel helper still uses a fake batch contract

`computeVesselTripUpdates` creates a one-entry object to call `calculateTripUpdateForVessel`, which immediately indexes it back by `VesselAbbrev`.

That seam should be narrowed to direct values.

## Desired End State

The hot path should read conceptually like this:

```text
raw location + existing trip + schedule tables
  -> resolve current trip fields
  -> build trip row from raw location + resolved current trip fields
  -> attach next scheduled trip fields
```

The target design has two important boundaries:

### Boundary A: Current-trip resolution

This boundary should answer only:

- What are this row's current trip fields?
- Did they come from WSF or schedule inference?
- If inferred, which inference method produced them?

### Boundary B: Next-leg enrichment

This boundary should answer only:

- What optional next-leg fields should be carried or attached to the built trip row?

These should be separate concerns unless there is a compelling simplification from combining them. If combined, the new interface must still be narrower and easier to reason about than the current one.

## Recommended Contract Changes

### Option A: Preferred

Keep current-trip resolution and next-leg enrichment separate.

Replace `InferredTripFields` with a narrower current-trip contract such as:

```ts
type ResolvedCurrentTripFields = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  ScheduleKey?: string;
  SailingDay?: string;
  tripFieldDataSource: "wsf" | "inferred";
  tripFieldInferenceMethod?: "next_scheduled_trip" | "schedule_rollover";
};
```

Then:

- `resolveCurrentTripFields(...) -> ResolvedCurrentTripFields`
- `buildTripCore(...)` consumes `ResolvedCurrentTripFields` directly
- `attachNextScheduledTripFields(...)` remains the sole owner of:
  - `NextScheduleKey`
  - `NextScheduledDeparture`

This is the preferred option because it produces the narrowest honest seam.

### Option B: Acceptable if cleaner in code

If the implementing agent finds a meaningfully simpler flow, a combined contract is acceptable, but only if:

- the next-leg fields are actually consumed directly from that object
- the later enrichment helper is removed or reduced to a tiny pass-through
- the resulting ownership is clearer than it is today

Do not keep both:

- next-leg fields on the resolved current-trip object
- a second helper that independently re-owns next-leg enrichment

Pick one owner.

## Required Refactors

### 1. Narrow the current-trip resolution type

The implementing agent should:

- replace or rename `InferredTripFields` so the type name matches what it really is
- remove `NextScheduleKey` and `NextScheduledDeparture` from that type if using the preferred split
- update tests and comments to reflect the smaller contract

Naming suggestions:

- `ResolvedCurrentTripFields`
- `ResolvedTripFields`

Avoid names that imply the object always represents inferred values.

### 2. Remove the partial apply-and-rederive flow

The implementing agent should simplify `buildTripCore` so it does not:

- resolve trip fields
- partially overlay them onto a location
- then re-derive the same identity later

Preferred direction:

- keep the raw `ConvexVesselLocation`
- pass `resolvedCurrentTripFields` alongside it into trip derivation or base-trip building

Possible shapes:

```ts
baseTripFromLocation({
  location,
  existingTrip,
  tripStart,
  resolvedTripFields,
})
```

or

```ts
deriveTripInputs(existingTrip, location, resolvedTripFields)
```

The choice is up to the implementing agent, but the result should remove the current "overlay then derive again" pattern.

### 3. Make next-leg ownership explicit

Under the preferred design:

- remove next-leg fields from current-trip resolution helpers
- keep `attachNextScheduledTripFields` as the only place that:
  - preserves next-leg fields when `ScheduleKey` is unchanged
  - looks up next-leg fields from `scheduleTables`

If that helper survives, its contract should remain small and obvious.

### 4. Narrow the one-vessel helper seam

Change:

```ts
calculateTripUpdateForVessel(vesselLocation, activesByVessel)
```

to something like:

```ts
calculateTripUpdateForVessel(vesselLocation, existingActiveTrip)
```

This is a minor cleanup, but it trims needless shape conversion and improves readability.

## Suggested File-Level Plan

### Primary files to update

- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/types.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/inferTripFieldsFromSchedule.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/buildInferredTripFields.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/getTripFieldsFromWsf.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/getFallbackTripFields.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/applyInferredTripFields.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/attachNextScheduledTripFields.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripDerivation.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/calculatedTripUpdate.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/computeVesselTripUpdates.ts`

### Likely cleanup opportunities

- delete `applyInferredTripFields.ts` entirely if the new seam no longer needs location overlay
- shrink `buildInferredTripFields.ts` to current-trip fields only
- simplify `tripDerivation.ts` by removing duplicate "current vs continuing" resolved fields when they are identical

## Detailed Guidance For The Implementing Agent

### Favor data flow over mutation-shaped staging

Prefer:

- one resolved object
- passed directly into the next step

Avoid:

- synthesizing a location-shaped object just to satisfy a downstream signature

### Favor semantic names over historical names

If the value represents the final resolved fields for the current row, call it that.

Avoid names like:

- `inferredTripFields` when the object can also be WSF-authored
- `applyInferredTripFields` if the function really applies resolved current-trip fields

### Favor fewer representations of the same concept

There should ideally be only one authoritative representation of "resolved current trip fields" in the hot path.

Avoid having all three of these at once:

- raw location fields
- partially overlaid location fields
- separately resolved trip-field object

If two are necessary, keep them justified and obvious.

## Acceptance Criteria

### Functional

- Existing behavior remains covered by tests.
- WSF-authoritative trip fields still take precedence immediately.
- Schedule-backed inference still works for:
  - next scheduled trip
  - schedule rollover
  - safe fallback reuse
- Next-leg fields still behave exactly as before unless intentionally simplified with equivalent behavior.

### Structural

- The current-trip resolution contract is narrower than today.
- There is no extra contract field that is created but not consumed at the main seam.
- The code no longer resolves current-trip identity and then re-derives the same identity from an overlaid location.
- `calculateTripUpdateForVessel` or equivalent one-vessel helper no longer requires a one-entry map input.

### Clarity

- A new reader can identify, in one pass, where:
  - current trip fields are resolved
  - the trip row is built
  - next-leg fields are attached
- Comments and README text match the actual ownership boundaries.

## Testing Requirements

The implementing agent should run at least:

```bash
bun test convex/domain/vesselOrchestration/updateVesselTrips/tripFields/tests \
  convex/domain/vesselOrchestration/updateVesselTrips/tests/buildTripCore.test.ts \
  convex/domain/vesselOrchestration/updateVesselTrips/tests/computeVesselTripUpdates.test.ts \
  convex/domain/vesselOrchestration/updateVesselTrips/tests/computeVesselTripsRows.test.ts \
  convex/functions/vesselOrchestrator/tests/persistVesselTripWriteSet.test.ts
```

Add or update tests for:

- the narrowed resolved current-trip contract
- removal of unused next-leg fields from that contract, if using the preferred split
- the simplified one-vessel seam

## Deliverables

The implementing agent should produce:

1. code changes implementing the narrowed contract
2. updated tests
3. a short summary of:
   - which transform step(s) were removed
   - which interface was narrowed
   - whether `applyInferredTripFields` survived or was deleted
   - who owns next-leg enrichment after the refactor

## Decision Rule

When choosing between two designs, pick the one that:

1. has the smaller interface
2. has fewer representations of resolved trip fields
3. makes ownership of next-leg enrichment more obvious
4. removes a transform step instead of merely renaming it
