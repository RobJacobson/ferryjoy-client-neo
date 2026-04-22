# Inferred Trip Fields Refactor PRD

**Date:** 2026-04-22  
**Audience:** Engineers and coding agents working in `convex/domain/vesselOrchestration/updateVesselTrips`, `convex/functions/vesselOrchestrator`, `convex/functions/vesselTrips`, and adjacent schedule/trip code.

## 1. Purpose

Replace the current "docked identity" / "effective trip identity" abstraction
with a smaller, clearer, implementation-oriented abstraction:

- **inferred trip fields** in code
- **provisional trip fields** in docs and comments

The refactor should preserve current behavior where useful, simplify the code
shape, and make the schedule inference concern easy to reason about and easy to
change independently from physical trip lifecycle logic.

This PRD is intended to be directly actionable by another coding agent.

## 2. Executive Summary

Today the trip update path uses terminology such as:

- `EffectiveTripIdentity`
- `resolveEffectiveDockedTripIdentity`
- `stableDockedIdentity`
- `resolveEffectiveDockedLocation`
- `DockedIdentity` warnings

That terminology obscures the real business problem:

> When WSF omits `ArrivingTerminalAbbrev` and `ScheduledDeparture`, infer
> provisional trip fields from schedule evidence until WSF provides
> authoritative values.

The current implementation also spreads that behavior across multiple places:

- `convex/shared/effectiveTripIdentity.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/continuity/resolveEffectiveDockedLocation.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/scheduleTripAdapters.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripDerivation.ts`

This refactor should:

1. create a new `tripFields/` subdomain under `updateVesselTrips/`
2. rewrite the schedule inference concern from the top down with small pure
   functions
3. remove the old "docked identity" abstraction entirely
4. keep physical lifecycle detection independent from trip-field inference
5. standardize source semantics around:
   - `tripFieldDataSource: "wsf" | "inferred"`
   - optional `tripFieldInferenceMethod`

## 3. Background

## 3.1 Real-world behavior

In normal service, WSF often omits:

- `ArrivingTerminalAbbrev`
- `ScheduledDeparture`

for a short period near the start of a trip, especially around dock arrival and
trip turnover. This is normal and expected, even though it is operationally
inconvenient.

The product goal is not to create a new truth system. The goal is to avoid
displaying an obviously incomplete state such as "unknown destination" when the
schedule makes the likely next scheduled trip leg clear.

The system should therefore:

- use WSF fields when they are present
- infer provisional trip fields from schedule evidence when WSF is incomplete
- keep those inferred fields stable while WSF remains incomplete
- replace inferred fields immediately when WSF provides authoritative values
- avoid pretending that inference is permanent truth

## 3.2 Known edge cases

There are real-world cases where a vessel may:

- leave dock without destination/departure fields in WSF
- remain in normal service despite the missing fields
- or depart for an unscheduled operational reason such as maintenance

The system must therefore **not** treat "missing WSF trip fields after
departure" as an automatic error. It should continue to use provisional fields
until:

- WSF provides authoritative values
- the inferred fields change due to stronger schedule evidence
- or the trip ends

## 3.3 What should remain separate

Physical lifecycle boundaries are a different concern than provisional trip
field inference.

The current physical dock/sea debounce logic in:

- `convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/physicalDockSeaDebounce.ts`

should remain conceptually separate from schedule inference.

This PRD does **not** change the dock/sea debounce policy.

## 4. Problem Statement

The current code has three major problems:

### 4.1 Terminology problem

The term "docked identity" is misleading. The concern is not fundamentally
about docking. It is about temporary inference of three schedule-related trip
fields:

- `ArrivingTerminalAbbrev`
- `ScheduledDeparture`
- `ScheduleKey`

### 4.2 Concern-splitting problem

The schedule inference concern is spread across multiple folders and multiple
mental models:

- "effective identity"
- "continuity"
- "carry-forward"
- "stable docked identity"

This makes it difficult to understand which function actually decides the final
trip fields for a given ping.

### 4.3 DRY/KISS problem

The same business rule is expressed more than once:

- reuse persisted values when WSF is incomplete
- infer from next scheduled trip when possible
- infer by rolling forward in the vessel's schedule when possible

That duplication increases the chance of behavioral drift and makes future
refactors harder.

## 5. Desired End State

## 5.1 High-level behavioral model

The refactored code should read like this:

1. Detect physical arrival/departure boundaries from raw feed signals.
2. Determine whether WSF has authoritative trip fields.
3. If WSF is incomplete, infer provisional trip fields from schedule evidence.
4. Apply those trip fields to the location used for trip construction.
5. Build the trip row from that prepared location.
6. Attach next scheduled trip fields where needed.

The code should make it obvious that:

- physical lifecycle uses raw feed + debounce
- trip field inference is a separate pure transformation

## 5.2 Terminology

Use these terms consistently:

- **inferred trip fields** in code
- **provisional trip fields** in comments/docs
- **trip fields** means:
  - `ArrivingTerminalAbbrev`
  - `ScheduledDeparture`
  - `ScheduleKey`

Use these metadata names:

```ts
type TripFieldDataSource = "wsf" | "inferred";

type TripFieldInferenceMethod =
  | "next_scheduled_trip"
  | "schedule_rollover";
```

Meaning:

- `wsf`
  WSF provided the authoritative trip fields for this ping
- `inferred`
  The fields are provisional and come from schedule evidence
- `next_scheduled_trip`
  Inference came from a known next scheduled leg
- `schedule_rollover`
  Inference came from rolling forward from prior scheduled departure

## 5.3 Folder layout

Create a new folder:

- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/`

with tests in:

- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/tests/`

This concern should live under `updateVesselTrips`, not under `shared/`, not
under `tripLifecycle/`, and not under `continuity/`.

Rationale:

- this logic is specific to trip update assembly
- it is not physical lifecycle logic
- it is not general orchestrator infrastructure
- it should become the template for similar future subdomain extraction

## 6. Non-Goals

The implementation must **not** do the following in this refactor:

- rewrite physical dock/sea debounce policy
- redesign the schedule snapshot storage model
- migrate runtime schedule reads away from `vesselOrchestratorScheduleSnapshots`
- change the source of schedule truth for the hot path
- change timeline or ML prediction architecture
- introduce per-vessel Convex function fan-out

This is a focused refactor of trip field inference and its immediate call path.

## 7. Current Runtime Data Source

`ScheduledSegmentTables` is currently built in memory from a `ScheduleSnapshot`.

The load path is:

1. `getScheduleSnapshotForPing`
2. reads `vesselOrchestratorScheduleSnapshots`
3. `createScheduledSegmentTablesFromSnapshot(...)`
4. result is consumed by trip update code

The upstream snapshot is currently materialized from `eventsScheduled`, but the
runtime shape is already a schedule-oriented read model:

- `scheduledDepartureBySegmentKey`
- `scheduledDeparturesByVesselAbbrev`

For this refactor, treat that runtime shape as the schedule evidence source.

## 8. Proposed Architecture

## 8.1 New folder contents

Create the following files:

- `tripFields/index.ts`
- `tripFields/types.ts`
- `tripFields/hasWsfTripFields.ts`
- `tripFields/getTripFieldsFromWsf.ts`
- `tripFields/getNextScheduledTripFromExistingTrip.ts`
- `tripFields/getRolledOverScheduledTrip.ts`
- `tripFields/findScheduledTripMatch.ts`
- `tripFields/buildInferredTripFields.ts`
- `tripFields/getFallbackTripFields.ts`
- `tripFields/inferTripFieldsFromSchedule.ts`
- `tripFields/applyInferredTripFields.ts`
- `tripFields/attachNextScheduledTripFields.ts`
- `tripFields/logTripFieldInference.ts` (optional, narrow observability only)

Tests:

- `tripFields/tests/hasWsfTripFields.test.ts`
- `tripFields/tests/getNextScheduledTripFromExistingTrip.test.ts`
- `tripFields/tests/getRolledOverScheduledTrip.test.ts`
- `tripFields/tests/findScheduledTripMatch.test.ts`
- `tripFields/tests/inferTripFieldsFromSchedule.test.ts`
- `tripFields/tests/applyInferredTripFields.test.ts`
- `tripFields/tests/attachNextScheduledTripFields.test.ts`

## 8.2 Core types

Suggested starting point:

```ts
export type TripFieldDataSource = "wsf" | "inferred";

export type TripFieldInferenceMethod =
  | "next_scheduled_trip"
  | "schedule_rollover";

export type InferredTripFields = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  ScheduleKey?: string;
  SailingDay?: string;
  NextScheduleKey?: string;
  NextScheduledDeparture?: number;
  tripFieldDataSource: TripFieldDataSource;
  tripFieldInferenceMethod?: TripFieldInferenceMethod;
};
```

Do not over-model beyond what the call sites actually need.

## 8.3 Functional pipeline

The implementation should emphasize short pure functions and composition.

The intended top-level flow is:

```ts
inferTripFieldsFromSchedule(input)
  -> hasWsfTripFields
  -> getTripFieldsFromWsf
  -> or findScheduledTripMatch
  -> buildInferredTripFields
  -> or getFallbackTripFields
```

Then:

```ts
applyInferredTripFields(location, inferredTripFields)
```

Then:

```ts
attachNextScheduledTripFields(...)
```

Do not hide multiple policies inside one large function.

## 9. File-by-File Responsibilities

## 9.1 `types.ts`

Own only:

- `TripFieldDataSource`
- `TripFieldInferenceMethod`
- `InferredTripFields`
- any small request/response types for the pipeline

Avoid importing half the codebase into this file.

## 9.2 `hasWsfTripFields.ts`

Return whether WSF has authoritative trip fields for this ping.

This should be tiny and explicit.

At minimum, evaluate whether the location has:

- `ArrivingTerminalAbbrev`
- `ScheduledDeparture`
- and either a present `ScheduleKey` or enough direct field data to derive one

Choose one policy and document it in comments.

## 9.3 `getTripFieldsFromWsf.ts`

Normalize the WSF-backed case into the same shape as inferred output.

This prevents the rest of the pipeline from branching on "live vs inferred"
shapes.

## 9.4 `getNextScheduledTripFromExistingTrip.ts`

Use `existingTrip.NextScheduleKey` to look up the next scheduled segment.

Validate compatibility with the current terminal before returning a match.

Return:

- matched segment
- `tripFieldInferenceMethod: "next_scheduled_trip"`

## 9.5 `getRolledOverScheduledTrip.ts`

When `NextScheduleKey` is unavailable or unusable, infer the next scheduled trip
by rolling forward from the previous `ScheduledDeparture`.

Return:

- matched segment
- `tripFieldInferenceMethod: "schedule_rollover"`

This should be the functional replacement for the useful part of
`resolveDockedScheduledSegment.ts`.

## 9.6 `findScheduledTripMatch.ts`

Compose inference paths in priority order:

1. `getNextScheduledTripFromExistingTrip`
2. `getRolledOverScheduledTrip`

This file should contain orchestration only, not detailed logic.

## 9.7 `buildInferredTripFields.ts`

Convert a scheduled match into:

- `ArrivingTerminalAbbrev`
- `ScheduledDeparture`
- `ScheduleKey`
- optional `SailingDay`
- optional `NextScheduleKey`
- optional `NextScheduledDeparture`
- `tripFieldDataSource: "inferred"`
- `tripFieldInferenceMethod`

## 9.8 `getFallbackTripFields.ts`

When no schedule inference is possible, return a minimal normalized result.

This should preserve any partial WSF fields that do exist.

Do not invent data here.

## 9.9 `inferTripFieldsFromSchedule.ts`

This is the public entrypoint for the folder.

It should read more like a policy document than a utility grab bag:

1. if WSF has the fields, use WSF
2. else find schedule evidence
3. if evidence exists, infer fields
4. else return fallback

## 9.10 `applyInferredTripFields.ts`

Overlay inferred fields onto a `ConvexVesselLocation`.

This should set only:

- `ArrivingTerminalAbbrev`
- `ScheduledDeparture`
- `ScheduleKey`

and should avoid clobbering good values with `undefined`.

## 9.11 `attachNextScheduledTripFields.ts`

This replaces `appendFinalScheduleForLookup`.

Its responsibility is separate from inferring current trip fields. It should:

- carry `NextScheduleKey` / `NextScheduledDeparture` when safe
- attach them from schedule tables when derivable

Keep this function focused on next-leg enrichment only.

## 10. Integration Plan

## 10.1 `buildTrip.ts`

Rewrite `buildTripCore(...)` to use the new folder.

New conceptual flow:

1. infer or normalize trip fields
2. apply those fields to the location
3. build base trip from the prepared location
4. attach next scheduled trip fields

Suggested shape:

```ts
const inferredTripFields = inferTripFieldsFromSchedule({
  location: currLocation,
  existingTrip,
  scheduleTables,
});

const locationWithTripFields = applyInferredTripFields(
  currLocation,
  inferredTripFields
);

const baseTrip = baseTripFromLocation(
  locationWithTripFields,
  existingTrip,
  tripStart
);

return attachNextScheduledTripFields({
  baseTrip,
  existingTrip,
  scheduleTables,
  events,
});
```

## 10.2 `tripDerivation.ts`

This file currently duplicates trip-field carry-forward logic.

After the new folder is wired in, simplify `tripDerivation.ts` so it:

- derives trip properties from an already-prepared location
- does **not** implement its own schedule-field fallback policy

Expected deletions or heavy simplification:

- `computeContinuingTripIdentitySlice(...)`
- `deriveContinuingScheduleKey(...)` in current form

If a small helper remains needed for lifecycle comparison, it should be minimal
and align with the new semantics.

## 10.3 `detectTripEvents.ts`

Keep physical lifecycle based on raw feed and debounce.

Do not move schedule inference into this file.

Only simplify as needed after `tripDerivation.ts` and `buildTrip.ts` no longer
depend on the old fallback model.

## 11. Files to Delete

Once the new path is fully wired and tests are green, delete:

- `convex/domain/vesselOrchestration/updateVesselTrips/scheduleTripAdapters.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/continuity/resolveEffectiveDockedLocation.ts`
- `convex/shared/effectiveTripIdentity.ts`

Also remove the old terminology from comments, logs, and type names.

## 12. Tests and Acceptance Criteria

## 12.1 Unit tests

Unit tests in `tripFields/tests/` must cover:

- WSF trip fields win when present
- next scheduled trip inference path works
- schedule rollover inference path works
- no schedule match falls back cleanly
- applying inferred fields overlays only the intended fields
- next scheduled trip attachment works and preserves safe carry-forward behavior

## 12.2 Integration tests

Add or update higher-level tests in `updateVesselTrips/tests/` to verify:

- inferred fields are used when WSF omits trip fields
- inferred fields remain stable while WSF remains incomplete
- WSF replaces inferred fields immediately when authoritative values appear
- trip completion/replacement behavior still works
- no dependency on the old "docked identity" abstraction remains

## 12.3 Logging behavior

The old warning path should not be preserved as-is.

Acceptable observability outcomes:

- no warning for benign stable inferred-field reuse
- optional debug logging for inference path selection
- warning only for truly suspicious conflicts

## 12.4 Behavioral acceptance criteria

The implementation is complete when:

- the codebase no longer uses "docked identity" terminology for this concern
- trip field inference lives under `tripFields/`
- `buildTrip.ts` uses the new pipeline
- duplicated field carry-forward logic is removed from `tripDerivation.ts`
- old files are deleted
- tests pass

## 13. Implementation Sequence

Use this order:

### Phase 1: create new folder and tests

1. add `tripFields/` files and unit test scaffolding
2. implement pure functions in isolation

### Phase 2: wire into trip build

3. rewrite `buildTrip.ts` to use `tripFields/`
4. keep old files temporarily during the transition

### Phase 3: remove duplication

5. simplify `tripDerivation.ts`
6. simplify `detectTripEvents.ts` only as needed

### Phase 4: delete legacy abstraction

7. delete `scheduleTripAdapters.ts`
8. delete `resolveEffectiveDockedLocation.ts`
9. delete `effectiveTripIdentity.ts`

### Phase 5: cleanup docs and comments

10. replace old terminology in nearby docs and READMEs

## 14. Suggested Commit Breakdown

Recommended commit structure:

1. `refactor: add tripFields schedule inference module`
2. `refactor: route trip build through tripFields pipeline`
3. `refactor: remove legacy docked-identity abstraction`
4. `docs: rename docked identity to inferred trip fields`

Follow repo commit guidance:

- one-line Conventional Commit summary
- bullet list of major changes

## 15. Risks

### 15.1 Hidden behavioral coupling

The old field-carry logic is entangled with trip assembly. Replacing it too
aggressively without integration tests may change lifecycle behavior
accidentally.

Mitigation:

- wire in the new folder first
- delete duplication second
- keep tests close to the old behavior before cleanup

### 15.2 Over-modeling

There is a temptation to add too many metadata types and edge-case branches.

Mitigation:

- keep the scope to three trip fields plus optional next-leg fields
- prefer small pure functions over a large abstraction hierarchy

### 15.3 Terminology drift during transition

If the implementation lands partially, the repo could contain both old and new
language.

Mitigation:

- treat terminology cleanup as a required phase, not optional polish

## 16. Final Guidance For Implementing Agent

Optimize for:

- short pure functions
- composition
- explicit data flow
- narrow file responsibilities
- comments that explain policy, not mechanics

Avoid:

- mutating intermediate state
- preserving old abstractions under new names
- spreading trip-field inference logic across multiple unrelated folders

The best final result will feel smaller than the current code, not just renamed.
