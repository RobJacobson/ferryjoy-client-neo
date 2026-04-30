# `buildActiveTrip` field matrix

Source: `convex/domain/vesselOrchestration/updateVesselTrip/buildActiveTrip.ts`

This memo maps each `ConvexVesselTrip` field produced by `buildActiveTrip` across:

- **Cold start**: first-seen vessel (`previousTrip` undefined, `isNewTrip` false)
- **New trip**: rollover start (`isNewTrip` true)
- **In-progress update**: ongoing leg update (`previousTrip` present, `isNewTrip` false)

Abbreviations used in table cells:

- `loc` = current `ConvexVesselLocation` ping
- `prev` = `previousTrip`
- `comp` = `completedTrip`
- `prior` = `comp ?? prev`
- `id` = `deriveTripIdentity(...)`
- `resLeftDock` = `leftDockTimeForUpdate(prev, loc)` [N1]

| Field | Cold start (first trip) | New trip (rollover start) | In-progress update (ongoing leg) |
| --- | --- | --- | --- |
| `VesselAbbrev` | `loc.VesselAbbrev` | same | overwrite from `loc.VesselAbbrev` (on top of `prev`) |
| `DepartingTerminalAbbrev` | `loc.DepartingTerminalAbbrev` | same | overwrite from `loc.DepartingTerminalAbbrev` |
| `ArrivingTerminalAbbrev` | `loc.ArrivingTerminalAbbrev` | same | `loc.ArrivingTerminalAbbrev ?? prev.ArrivingTerminalAbbrev` |
| `RouteAbbrev` | `loc.RouteAbbrev` | same | overwrite from `loc.RouteAbbrev` |
| `TripKey` | generated via `generateTripKey(loc.VesselAbbrev, loc.TimeStamp)` | same | keep `prev.TripKey` (not reassigned) |
| `ScheduleKey` | `loc.ScheduleKey ?? id.ScheduleKey` | same | `loc.ScheduleKey ?? prev.ScheduleKey ?? id.ScheduleKey` |
| `SailingDay` | `id.SailingDay` | same | `id.SailingDay ?? prev.SailingDay` |
| `PrevTerminalAbbrev` | `undefined` | `prior?.DepartingTerminalAbbrev` (connect prior leg) | keep `prev.PrevTerminalAbbrev` |
| `ArriveDest` | `undefined` | same | keep `prev.ArriveDest` |
| `ArrivedCurrActual` | `undefined` | `loc.TimeStamp` (mark arrival into current terminal) | keep `prev.ArrivedCurrActual` |
| `ArrivedNextActual` | `undefined` | same | keep `prev.ArrivedNextActual` |
| `StartTime` | `loc.TimeStamp` | same | keep `prev.StartTime` |
| `EndTime` | `undefined` | same | keep `prev.EndTime` |
| `AtDockActual` | `undefined` | `loc.TimeStamp` (stamp dock-at-start) | keep `prev.AtDockActual` |
| `TripStart` | `loc.TimeStamp` | same | keep `prev.TripStart` |
| `AtDock` | `loc.AtDockObserved` | same | overwrite from `loc.AtDockObserved` |
| `AtDockDuration` | `undefined` | same | recompute as `delta(prev.ArrivedNextActual ?? prev.EndTime ?? prev.StartTime, resLeftDock)` [N2] |
| `ScheduledDeparture` | `loc.ScheduledDeparture` | same | persist `resolvedScheduledDeparture` (`loc.ScheduledDeparture ?? prev.ScheduledDeparture`) so the row matches identity/TripDelay [N4] |
| `LeftDock` | `loc.LeftDock` | forced `undefined` (reset at rollover start) | recompute to `resLeftDock` |
| `LeftDockActual` | `undefined` | same | `prev.LeftDockActual ?? (justLeftDock ? (loc.LeftDock ?? loc.TimeStamp) : undefined)` [N3] |
| `TripDelay` | `delta(loc.ScheduledDeparture, loc.LeftDock)` | forced `undefined` (no departure yet) | recompute as `delta(resolvedScheduledDeparture, resLeftDock)` [N4] |
| `Eta` | `loc.Eta` | same | `loc.Eta ?? prev.Eta` |
| `NextScheduleKey` | `undefined` | `prev?.NextScheduleKey` (carry continuity hint) | keep `prev.NextScheduleKey` |
| `NextScheduledDeparture` | `undefined` | `prev?.NextScheduledDeparture` | keep `prev.NextScheduledDeparture` |
| `TripEnd` | `undefined` | same | keep `prev.TripEnd` |
| `AtSeaDuration` | `undefined` | same | keep `prev.AtSeaDuration` |
| `TotalDuration` | `undefined` | same | keep `prev.TotalDuration` |
| `InService` | `loc.InService` | same | overwrite from `loc.InService` |
| `TimeStamp` | `loc.TimeStamp` | same | overwrite from `loc.TimeStamp` |
| `PrevScheduledDeparture` | `undefined` | `prior?.ScheduledDeparture` | keep `prev.PrevScheduledDeparture` |
| `PrevLeftDock` | `undefined` | `prior?.LeftDockActual ?? prior?.LeftDock ?? undefined` | keep `prev.PrevLeftDock` |

## End notes

- **N1**: `resLeftDock` centralizes left-dock continuity for ongoing trips via `leftDockTimeForUpdate(prev, loc)`.
- **N2**: `delta(a, b)` denotes `calculateTimeDelta(a, b)` from `shared/durationUtils`.
- **N3**: `justLeftDock` is `didLeaveDock(prev, loc)` and only backfills `LeftDockActual` on transition.
- **N4**: `resolvedScheduledDeparture` is `loc.ScheduledDeparture ?? prev.ScheduledDeparture`; continuing trips set `ScheduledDeparture` on the returned row to this value (not only `...prev` spread), matching prior `buildContinuingActiveTrip` behavior.

## Quick interpretation

- Cold start and new trip both begin from `buildNewActiveTrip`; new trip then overlays prior-leg continuity and resets departure-tied fields.
- In-progress updates preserve most lifecycle/history fields from `prev` and only refresh feed-driven or derived continuity fields.
