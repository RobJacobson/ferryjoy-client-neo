# Handoff Note: PR3 Type Tightening for `eventsActual` Patches

Date prepared: 2026-04-13  
Audience: next agent touching PR3 cleanup / refinement  
Context: PR3 is functionally in the right place, but a few remaining type contracts are still too permissive and rely on runtime throws where TypeScript should enforce the invariant

## Goal

Tighten the `eventsActual` patch types so the write pipeline expresses the real invariants in TypeScript:

- `TripKey` is required for persistence
- persistence also requires an anchor timestamp
- broad patch shapes should exist only at ingestion / pre-enrichment boundaries
- deep write helpers should not accept overly broad types and then throw

## Design intent

We already agreed on this model:

- persisted `eventsActual` rows require `TripKey`
- persistence-ready patches require `TripKey`
- pre-enrichment / ingestion patches may still omit `TripKey`
- if `TripKey` cannot be resolved at persistence time, skip persistence

This note tightens the next layer as well:

- persistence-ready patches should also guarantee at least one anchor timestamp:
  - `EventActualTime`
  - or `ScheduledDeparture`

That should remove the current smell where `buildActualBoundaryEventFromPatch(...)` accepts a type that may be invalid and then throws at runtime.

## Requested changes

### 1. Make comments and docs say `TripKey` is required for persistence

Update comments/TSDoc so they describe the actual invariant precisely:

- `TripKey` may be absent only on broad ingestion/pre-enrichment patch shapes
- `TripKey` is required for any patch that can be persisted or normalized into a row

Avoid wording that makes `TripKey` sound generally optional in the write path.

### 2. Keep `hasTripKey(...)` only at ingestion / enrichment boundaries

The broad patch type and the `hasTripKey(...)` type guard are still useful, but only near the edge of the system.

Use them in places like:

- live-location reconciliation output
- patch enrichment from trip context
- mutation entrypoints receiving broad validated arrays

Do not keep reusing the broad patch type deeper in the write pipeline once `TripKey` has been resolved.

### 3. Avoid broad patch types deeper in the pipeline

Once a path has been enriched, narrow it and keep it narrowed.

Examples of code that should accept narrowed types only:

- `buildActualBoundaryEventFromPatch(...)`
- `mergeActualBoundaryPatchesIntoRows(...)`
- `eventsActual` mutation upsert helpers
- trip-driven actual patch builders

The goal is that deep helpers never have to ask, “does this patch have `TripKey`?”

## Additional tightening requested

### 4. Add a final persistable patch type

On top of the existing broad and `WithTripKey` patch shapes, add one final narrowed type for persistence/normalization.

Suggested idea:

- `ConvexActualBoundaryPatch`
  - broad ingestion/pre-enrichment type
- `ConvexActualBoundaryPatchWithTripKey`
  - narrowed after physical identity resolution
- `ConvexActualBoundaryPatchPersistable`
  - narrowed for persistence, with:
    - `TripKey: string`
    - and at least one of:
      - `EventActualTime: number`
      - `ScheduledDeparture: number`

This can be modeled with a union or helper type so TypeScript enforces the anchor invariant.

### 5. Restrict `buildActualBoundaryEventFromPatch(...)` to the persistable type

`buildActualBoundaryEventFromPatch(...)` should accept only the final persistable type.

That lets the function assume:

- `TripKey` exists
- at least one anchor timestamp exists

and remove the runtime throw that currently checks for:

- missing `EventActualTime`
- missing `ScheduledDeparture`

The function should be a pure normalization step, not a late validator.

## Practical guidance

### Suggested type shape

Something conceptually like:

```ts
type PatchAnchor =
  | { EventActualTime: number; ScheduledDeparture?: number }
  | { EventActualTime?: number; ScheduledDeparture: number };

type ConvexActualBoundaryPatchPersistable =
  ConvexActualBoundaryPatchBase & {
    TripKey: string;
  } & PatchAnchor;
```

Exact naming can vary, but the important part is:

- `TripKey` required
- anchor timestamp guaranteed

### Where to push fallback filling

If a patch enters the pipeline missing one of the anchor fields, fill it earlier:

- merge helpers can inherit `ScheduledDeparture` / `EventActualTime` from an existing row
- trip-driven builders can populate what they know directly
- enrichment steps can produce a persistable patch before normalization

By the time `buildActualBoundaryEventFromPatch(...)` is called, the patch should already be safe.

## Expected code areas

- [convex/functions/eventsActual/schemas.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsActual/schemas.ts)
- [convex/domain/vesselTimeline/normalizedEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/normalizedEvents.ts)
- [convex/functions/eventsActual/mutations.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/eventsActual/mutations.ts)
- [convex/functions/vesselTimeline/mergeActualBoundaryPatchesIntoRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/mergeActualBoundaryPatchesIntoRows.ts)
- [convex/domain/vesselTimeline/tripContextForActualRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/tripContextForActualRows.ts)
- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)

## Acceptance criteria

This tightening pass is done when:

- comments/docs clearly say `TripKey` is required for persistence
- `hasTripKey(...)` is used only at ingestion/enrichment boundaries
- deep write helpers no longer accept broad patch types
- a final persistable patch type exists and guarantees an anchor timestamp
- `buildActualBoundaryEventFromPatch(...)` no longer throws for missing anchor data because the type already prevents that state
