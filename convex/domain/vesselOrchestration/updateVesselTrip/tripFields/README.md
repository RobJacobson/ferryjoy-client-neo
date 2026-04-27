# tripFields

`tripFields/` owns one concern:

> Given one vessel-location ping plus schedule evidence, decide which
> schedule-facing fields should be attached to the trip row.

This folder stays isolated because WSF schedule identity and physical lifecycle
are related but not the same problem.

## Public seam

The subfolder intentionally exposes one outward entrypoint:

- `resolveTripFieldsForTripRow(...)`

That function owns:

1. Resolving current-trip fields from WSF, schedule evidence, or safe fallback
2. Emitting transient inference observability
3. Attaching or clearing next-leg schedule fields on the built trip row

The helper files in this folder support that policy, but they are not the
intended external seams.

## Resolution order

Current-trip field precedence is:

1. Authoritative WSF destination + scheduled departure
2. Existing trip `NextScheduleKey`
3. Schedule rollover from the prior scheduled departure
4. Safe fallback / same-dock reuse

That produces these durable fields for the current trip row:

- `ArrivingTerminalAbbrev`
- `ScheduledDeparture`
- `ScheduleKey`
- `SailingDay`
- `tripFieldDataSource: "wsf" | "inferred"`

The inference method remains transient:

- `tripFieldInferenceMethod: "next_scheduled_trip" | "schedule_rollover"`

## Relationship to row building

`tripFields/` does not own lifecycle detection or trip completion. Instead,
`tripBuilders.ts` delegates schedule policy to `resolveTripFieldsForTripRow`,
then keeps ownership of:

- base row shaping
- completion shaping
- stale next-leg clearing when identity changes

That keeps the boundary simple:

```text
tripBuilders.ts
  -> resolveTripFieldsForTripRow(...)
  -> receive fully schedule-enriched trip row
```

## Internal helpers

The private helper files in this folder fall into three buckets:

- WSF authority checks
- schedule lookup strategies
- safe fallback reuse

They exist to keep the policy readable, not to create a second public API.
