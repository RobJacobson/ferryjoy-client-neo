# tripFields

`tripFields/` owns one concern behind `scheduleForActiveTrip.ts`:

> Given one vessel-location ping plus schedule evidence, decide which
> schedule-facing fields should be attached to the trip row.

This folder stays isolated because WSF schedule identity and physical lifecycle
are related but not the same problem.

This folder is private schedule-resolution support. The intended integration
point for trip updates is `scheduleForActiveTrip.ts`, not direct imports from
outside `updateVesselTrip/`.

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

`tripFields/` does not own lifecycle detection, completed-row shaping, or base
active-row construction. It only provides schedule-resolution helpers consumed
by `scheduleForActiveTrip.ts`.

## Internal helpers

The private helper files in this folder fall into three buckets:

- WSF authority checks
- schedule lookup strategies
- safe fallback resolution

They exist to keep the policy readable, not to create a second public API.
