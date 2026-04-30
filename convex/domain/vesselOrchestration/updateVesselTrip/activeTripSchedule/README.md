# activeTripSchedule

`activeTripSchedule/` owns schedule resolution behind `scheduleForActiveTrip.ts`:

> Given one vessel-location ping plus schedule evidence, decide which
> schedule-facing fields should be merged onto the active trip row.

WSF realtime completeness is handled in `scheduleForActiveTrip.ts` (Path A).
This folder holds Path B helpers: next-trip-key continuity, schedule-table
lookup, the optional coordinator for tests, WSF segment key helpers, types,
and optional inference diagnostics.

This folder is private to `updateVesselTrip/`. Production callers should use
`scheduleForActiveTrip.ts`, not deep imports from here, except tests (which may
import implementation files directly).

## Resolution order (Path B)

On new in-service trips, when WSF destination + scheduled departure are missing:

1. Prior-row `NextScheduleKey` → keyed segment (`nextTripKey`).
2. Schedule tables → current/next service-day dock events (`scheduleLookup`).
3. If neither resolves, the orchestration layer may warn and leave the built row
   unchanged (no synthetic fallback).

Path A (authoritative WSF fields on the ping) is applied in
`scheduleForActiveTrip.ts` before this folder’s strategies run.

## Fields and transient metadata

Resolved shapes feed `applyResolvedTripScheduleFields` / `scheduleEnrichment.ts`.
Durable trip fields include `ArrivingTerminalAbbrev`, `ScheduledDeparture`,
`ScheduleKey`, `SailingDay`, and next-leg hints (`NextScheduleKey`,
`NextScheduledDeparture`).

Transient observability on resolved payloads (not stored on `ConvexVesselTrip`):

- `tripFieldResolutionMethod`: `wsfRealtimeFields` | `nextTripKey` |
  `scheduleLookup`

## Non-ownership

`activeTripSchedule/` does not own lifecycle detection, completed-row shaping,
base active-row construction, or merge policy. It only supplies resolution
evidence and small adapters consumed by `scheduleForActiveTrip.ts`.
