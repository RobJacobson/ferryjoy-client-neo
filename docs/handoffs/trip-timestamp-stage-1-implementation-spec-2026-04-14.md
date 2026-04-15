# Stage 1 Implementation Spec: Canonical Timestamp Contracts

Date: 2026-04-14
Parent PRD: [trip-timestamp-semantics-prd-2026-04-14.md](./trip-timestamp-semantics-prd-2026-04-14.md)
Semantic baseline: [trip-timestamp-semantics-memo-2026-04-14.md](./trip-timestamp-semantics-memo-2026-04-14.md)
Status: implementation-ready spec for Stage 1 only

## Purpose

Define the canonical timestamp vocabulary and the minimum type/schema contract
needed for the later lifecycle and projection refactor.

Stage 1 does not change runtime lifecycle behavior yet. Its job is to make the
new contract explicit in schema, shared types, and doc comments so later stages
can implement the write-path split without inventing another naming scheme.

## Scope

In scope for Stage 1:

- canonical timestamp names and alias policy
- schema/type updates for trip rows and shared trip shapes
- a minimal, one-way adapter strategy for transition code
- tests and verification that prove the contract is typed and documented

Out of scope for Stage 1:

- lifecycle behavior changes
- `eventsActual` projection behavior changes
- ML feature rewrites
- frontend render changes
- backward compatibility for old persisted rows beyond what is needed to keep
  the branch compiling

## Canonical Contract

### Canonical fields

These are the only names that should be treated as the long-term semantic
vocabulary for the refactor.

| Field | Meaning | Notes |
| --- | --- | --- |
| `ArriveOriginDockActual` | Asserted arrival at the origin dock for this sailing | Canonical arrival-side boundary for the current leg |
| `ArriveDestDockActual` | Asserted arrival at the destination dock for this sailing | Canonical destination-side boundary for the current leg |
| `DepartOriginActual` | Asserted departure from the origin dock for this sailing | Canonical departure boundary; legacy storage may still use `LeftDockActual` temporarily |
| `StartTime` | Coverage start for the row | Recording-window semantic only |
| `EndTime` | Coverage end for the row | Recording-window semantic only |

### Alias policy

- `ArriveCurrActual` and `ArriveNextActual` are acceptable short aliases in
  code where the surrounding glossary makes the mapping obvious.
- `LeftDockActual` may remain as transitional storage for
  `DepartOriginActual`, but it is not a new semantic concept.
- `LeftDock` remains raw WSF input and must not be elevated to canonical
  boundary status.
- `TripStart`, `TripEnd`, `AtDockActual`, and `ArriveDest` are legacy fields.
  They are not new canonical names and must not be expanded into a third naming
  scheme.

### Legacy mapping rules

The Stage 1 contract should treat old names as follows:

- `TripStart` is legacy coverage/boundary-overlap state and must be read only as
  compatibility data until later stages remove the ambiguity.
- `TripEnd` is legacy coverage close and not guaranteed destination arrival.
- `AtDockActual` is legacy dock-phase recording state and must not be used as a
  canonical physical arrival field.
- `ArriveDest` is the legacy predecessor to `ArriveDestDockActual`.

## Required Type and Schema Changes

### `convex/functions/vesselTrips/schemas.ts`

This is the primary schema contract file for Stage 1.

Required updates:

- add schema fields for `ArriveOriginDockActual`, `ArriveDestDockActual`,
  `DepartOriginActual`, `StartTime`, and `EndTime`
- keep legacy fields present long enough for later stages to migrate behavior
- add doc comments that distinguish coverage from physical boundary actuals
- keep storage-field names unambiguous and avoid introducing any new alternate
  boundary labels

Recommended shape:

- canonical fields are optional numeric epoch milliseconds on stored trip rows
- canonical fields should be the fields later stages write to and read from
- legacy fields stay available only as temporary compatibility data

### Shared trip shapes

Update the shared trip types that model persisted rows and query payloads:

- [convex/domain/ml/shared/unifiedTrip.ts](../../convex/domain/ml/shared/unifiedTrip.ts)
- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](../../convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts)
- [convex/shared/tripIdentity.ts](../../convex/shared/tripIdentity.ts)
- [convex/shared/effectiveTripIdentity.ts](../../convex/shared/effectiveTripIdentity.ts)

Stage 1 should not rewrite their behavior yet. It should align their type
references and comments with the canonical vocabulary so later stages can make
the write-path switch cleanly.

### Query and domain exposure choice

During Stage 1, public/domain trip shapes should expose the canonical timestamp
fields alongside the legacy fields that still exist in storage. The goal is to
make the new contract visible without introducing a second public mapping
layer.

Rules:

- canonical fields are added to the exposed trip shapes in this stage
- legacy fields remain present only as compatibility data for later stages
- no new public/domain layer should invent fresh aliases beyond the memo-listed
  short forms
- the branch must not introduce a separate compatibility DTO that hides the
  canonical names from downstream code

### Domain conversion helpers

Update the conversion helpers in `convex/functions/vesselTrips/schemas.ts` so
the domain layer can round-trip the new fields without inventing extra aliases.
That includes:

- domain conversion for the canonical timestamp fields
- keeping legacy timestamp fields readable where the branch still needs them
- ensuring Date conversion code does not blur coverage and physical semantics

## Temporary Adapter Strategy

Stage 1 uses one default adapter boundary only:

- schema/domain conversion helpers in `convex/functions/vesselTrips/schemas.ts`
  are the sole place where legacy field names may be translated into canonical
  names for Stage 1
- a dedicated shared helper may be introduced if the conversion logic needs to
  be reused, but it must live behind the same single boundary

Ad hoc mapping in lifecycle, projection, ML, or render behavior files is
forbidden during Stage 1.

Rules:

- adapters may translate legacy field names into canonical names for internal
  use
- adapters must never create a new persisted naming scheme
- adapters must never become the long-term public contract
- adapters must preserve the semantic split between coverage and physical
  boundary actuals

Practical examples:

- if a helper still needs to read `LeftDockActual`, it should map that value to
  `DepartOriginActual` in memory
- if a helper still needs a coverage start for a legacy trip, it should not
  infer that `TripStart` is an asserted origin arrival

## Implementation Order

1. Add the canonical field definitions and doc comments in
   `convex/functions/vesselTrips/schemas.ts`.
2. Update shared trip types so canonical fields are visible to all downstream
   consumers.
3. Add one-way transition helpers only where compile-time alignment requires
   them.
4. Update comments and type-level guidance in any helper that still mentions
   `TripStart`, `TripEnd`, or `AtDockActual` as a semantic source.
5. Keep runtime logic unchanged unless a type update is required to express the
   new contract.

## File Ownership

### Must update

- [convex/functions/vesselTrips/schemas.ts](../../convex/functions/vesselTrips/schemas.ts)
- [convex/domain/ml/shared/unifiedTrip.ts](../../convex/domain/ml/shared/unifiedTrip.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts)
- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](../../convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)
- [convex/domain/ml/shared/features.ts](../../convex/domain/ml/shared/features.ts)
- [convex/shared/tripIdentity.ts](../../convex/shared/tripIdentity.ts)
- [convex/shared/effectiveTripIdentity.ts](../../convex/shared/effectiveTripIdentity.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts)

These files should only change if they need direct contract alignment for the
new timestamp vocabulary. Pure schedule-identity behavior changes are out of
scope for Stage 1.

Why the schedule-identity helpers are included:

- `convex/shared/tripIdentity.ts` documents `isTripStartReady`, which currently
  depends on legacy trip-start semantics and needs contract-level comment
  alignment so Stage 2 can rework it without reinterpreting the old field names
- `convex/shared/effectiveTripIdentity.ts` carries helper types and comments
  that consume the trip shape directly; it only needs alignment if the exposed
  canonical timestamp contract changes what those comments claim the trip shape
  means

## Acceptance Criteria

Stage 1 is complete when all of the following are true:

- the canonical timestamp vocabulary is explicit in schema and shared types
- no new code path introduces a third naming scheme for trip timestamps
- `StartTime` and `EndTime` are clearly documented as coverage-only fields
- `ArriveOriginDockActual`, `ArriveDestDockActual`, and `DepartOriginActual`
  are clearly documented as the physical boundary layer
- legacy fields are clearly labeled as compatibility data or legacy mapping
- the repository type-checks after the schema and type updates

## Review Checklist

Reject the Stage 1 spec or implementation if any of these are true:

- a legacy field is renamed without explaining the semantic split
- a helper treats `TripStart` or `TripEnd` as canonical physical boundary truth
- `AtDockActual` is described as the long-term arrival field
- a new alias is introduced that is not present in the memo or PRD
- the spec implies a migration requirement that conflicts with the clean-slate
  cutover assumption

## Suggested Tests and Verification

Stage 1 verification should focus on contract correctness, not behavior
changes.

Suggested checks:

- schema/type compilation after adding the canonical fields
- a focused unit test for `toDomainVesselTrip` proving canonical timestamp
  fields round-trip as Dates
- a focused unit test or type assertion proving legacy fields remain readable
  but are not promoted to canonical status
- grep-based verification that `ArriveCurrActual` / `ArriveNextActual` only
  appear where the memo and this spec allow them
- `bun run convex:typecheck`
- `bun run check:fix`
- `bun run type-check`

## Notes for the Next Stage

This stage should leave lifecycle logic untouched on purpose. Stage 2 will use
the explicit contract here to update trip creation, completion, and chaining
without rediscovering field meaning from scratch.
