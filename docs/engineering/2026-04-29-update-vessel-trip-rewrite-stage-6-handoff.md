# updateVesselTrip Rewrite - Stage 6 Handoff

Date: 2026-04-29

Branch: `rewrite-update-vessel-trips`

## Outcome

Stage 6 uses key-first schedule resolution for new/replacement trips with
incomplete WSF fields.

The domain resolver now tries:

1. `resolveFromNextScheduleKey`
2. `resolveFromScheduleRollover`
3. fallback fields

`NextScheduleKey` continuity is the primary path. Rollover search is a fallback
only and should not run when the key path resolves to the current departing
terminal.

## Runtime Contract

`UpdateVesselTripDbAccess` exposes two reads:

- `getScheduledSegmentByScheduleKey(scheduleKey)`
- `getScheduleRolloverDockEvents({ vesselAbbrev, timestamp })`

Production wires these from
`convex/functions/vesselOrchestrator/pipeline/updateVesselTrip/updateVesselTripDbAccess.ts`
to internal queries in
`convex/functions/vesselOrchestrator/pipeline/updateVesselTrip/queries.ts`.

Do not add terminal identity or passenger-terminal gating to this schedule path.
The schedule-read gate is `location.InService`, plus the existing rule that
continuing trips with incomplete WSF fields do not schedule-read.

## Review Checklist

- Key lookup succeeds: rollover query is not called.
- Key lookup missing or terminal-mismatched: rollover query is called once.
- Continuing incomplete WSF: no schedule reads.
- Out-of-service replacement: no schedule reads.
- Replacement trips do not carry old-leg `ArrivingTerminalAbbrev`,
  `ScheduledDeparture`, `ScheduleKey`, or `SailingDay` into the new active row.
