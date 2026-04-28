# tripFields

`tripFields/` owns one concern:

> Given one vessel-location ping plus schedule evidence, decide which
> schedule-facing fields should be attached to the trip row.

This folder stays isolated because WSF schedule identity and physical lifecycle
are related but not the same problem.

## Public seam

The subfolder intentionally exposes data-first schedule resolution helpers:

- `resolveTripScheduleFields(...)`
- `attachNextScheduledTripFields(...)`

Those helpers own:

1. Resolving current-trip fields from WSF, schedule evidence, or safe fallback
2. Emitting transient inference observability
3. Attaching or clearing next-leg schedule fields on an already-built trip row

The helper files in this folder support that policy, but they are not the
intended external seams.

## Resolution order

Current-trip field precedence is:

1. Authoritative WSF destination + scheduled departure
2. Existing trip fields when they already provide enough identity
3. Existing trip `NextScheduleKey`
4. Schedule rollover from the prior scheduled departure
5. Safe fallback / same-dock reuse

That produces these durable fields for the current trip row:

- `ArrivingTerminalAbbrev`
- `ScheduledDeparture`
- `ScheduleKey`
- `SailingDay`
- `tripFieldDataSource: "wsf" | "inferred"`

The inference method remains transient:

- `tripFieldInferenceMethod: "next_scheduled_trip" | "schedule_rollover"`

## Relationship to row building

`tripFields/` does not own lifecycle detection, row construction, or trip
completion. Instead, `basicTripRows.ts` builds rows first, `tripBuilders.ts`
delegates schedule policy to `scheduleEnrichment.ts`, and the enrichment step
applies the resulting fields while keeping ownership of:

- stale next-leg clearing when identity changes

That keeps the boundary simple:

```text
tripBuilders.ts
  -> basicTripRows.ts
  -> scheduleEnrichment.ts
     -> resolveTripScheduleFields(...)
     -> apply resolved fields to the active row
```

## Internal helpers

The private helper files in this folder fall into three buckets:

- WSF authority checks
- schedule lookup strategies
- safe fallback reuse

They exist to keep the policy readable, not to create a second public API.
