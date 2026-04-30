/**
 * Schedule enrichment for already-built active trip rows.
 *
 * Resolvers produce a {@link ResolvedTripScheduleFields} snapshot; this module
 * merges that snapshot into a concrete `ConvexVesselTrip` while preserving safe
 * next-leg continuity rules.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import type { ResolvedTripScheduleFields } from "./activeTripSchedule";

type ResolvedCurrentLeg = ResolvedTripScheduleFields["current"];

type ApplyResolvedTripScheduleFieldsInput = {
  activeTrip: ConvexVesselTrip;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleKeyChanged: boolean;
  resolution: ResolvedTripScheduleFields;
};

/**
 * Applies resolved schedule-facing fields to an already-built active trip.
 *
 * Runs a fixed pipeline: merge current-leg fields from the resolution, recompute
 * delay from schedule vs observed departure, optionally strip next-leg hints when
 * the schedule anchor change looks unsafe, then attach next-leg fields from the
 * resolution or from the prior row when the segment key still matches.
 *
 * @param activeTrip - Basic active trip row built for this ping before schedule merge
 * @param existingTrip - Prior stored active row for continuity; may be undefined
 * @param scheduleKeyChanged - Whether the built row's schedule anchor differs from `existingTrip`
 * @param resolution - Resolved current leg and optional explicit next-leg fields from resolvers
 * @returns The same trip identity with schedule and next-leg fields finalized for persistence
 */
export const applyResolvedTripScheduleFields = ({
  activeTrip,
  existingTrip,
  scheduleKeyChanged,
  resolution,
}: ApplyResolvedTripScheduleFieldsInput): ConvexVesselTrip => {
  const mergedCurrent = mergeResolvedCurrentLeg(activeTrip, resolution.current);
  const withDelay = withTripDelayFromSchedule(mergedCurrent);
  const anchorSafe = withNextLegClearedWhenScheduleAnchorRisk(
    withDelay,
    existingTrip,
    scheduleKeyChanged
  );
  return attachNextScheduledTripFields({
    baseTrip: anchorSafe,
    existingTrip,
    next: resolution.next,
  });
};

/**
 * Merges resolver output for the current sailing leg onto the active trip row.
 *
 * Resolver fields are optional; each property falls back to the corresponding
 * value already on `activeTrip` so partial resolutions never wipe stable data.
 *
 * @param activeTrip - Row to copy as the base shape
 * @param current - Current-leg fields from schedule resolution (WSF or inferred)
 * @returns A new trip object with arrival, departure time, schedule key, and sailing day merged
 */
const mergeResolvedCurrentLeg = (
  activeTrip: ConvexVesselTrip,
  current: ResolvedCurrentLeg
): ConvexVesselTrip => ({
  ...activeTrip,
  ArrivingTerminalAbbrev:
    current.ArrivingTerminalAbbrev ?? activeTrip.ArrivingTerminalAbbrev,
  ScheduledDeparture:
    current.ScheduledDeparture ?? activeTrip.ScheduledDeparture,
  ScheduleKey: current.ScheduleKey ?? activeTrip.ScheduleKey,
  SailingDay: current.SailingDay ?? activeTrip.SailingDay,
});

/**
 * Recomputes `TripDelay` from scheduled departure and last observed `LeftDock`.
 *
 * Call this after current-leg schedule fields are merged so delay reflects the
 * latest `ScheduledDeparture` and dock-leave telemetry on the same row snapshot.
 *
 * @param trip - Trip row with `ScheduledDeparture` and `LeftDock` set as known for this tick
 * @returns The same row with `TripDelay` overwritten from duration utilities
 */
const withTripDelayFromSchedule = (
  trip: ConvexVesselTrip
): ConvexVesselTrip => ({
  ...trip,
  TripDelay: calculateTimeDelta(trip.ScheduledDeparture, trip.LeftDock),
});

/**
 * Clears next-leg schedule hints when a schedule-key change coincides with risky drift.
 *
 * Stale `NextScheduleKey` / `NextScheduledDeparture` from a prior segment can
 * mislead downstream logic if the trip key changed or the row lost its schedule
 * attachment; this step removes those hints before {@link attachNextScheduledTripFields}
 * re-applies continuity or resolver-supplied next fields.
 *
 * @param trip - Row after current-leg merge and delay recomputation
 * @param existingTrip - Prior active row used to detect identity and attachment changes
 * @param scheduleKeyChanged - Whether this ping's anchor disagrees with the prior row
 * @returns Either `trip` unchanged, or a copy with next-leg fields explicitly undefined
 */
const withNextLegClearedWhenScheduleAnchorRisk = (
  trip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined,
  scheduleKeyChanged: boolean
): ConvexVesselTrip =>
  shouldClearNextLegForScheduleAnchorChange(
    trip,
    existingTrip,
    scheduleKeyChanged
  )
    ? { ...trip, NextScheduleKey: undefined, NextScheduledDeparture: undefined }
    : trip;

/**
 * Decides whether next-leg hints should be dropped after a schedule-key change.
 *
 * Clearing is conservative: it triggers when the physical trip identity no longer
 * matches the prior row, or when a schedule key existed on the prior row but is
 * missing on the merged row - both cases where carrying forward next-leg hints is unsafe.
 * If `scheduleKeyChanged` is false, this always returns false regardless of other fields.
 *
 * @param trip - Merged row under consideration (post current-leg + delay)
 * @param existingTrip - Prior row for comparison; undefined yields no "risk" signals
 * @param scheduleKeyChanged - Gate: no clear unless the anchor actually changed
 * @returns True when `Next*` should be stripped before the next-leg attachment step
 */
const shouldClearNextLegForScheduleAnchorChange = (
  trip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined,
  scheduleKeyChanged: boolean
): boolean => {
  if (!scheduleKeyChanged) {
    return false;
  }
  const physicalIdentityReplaced =
    existingTrip?.TripKey !== undefined &&
    trip.TripKey !== undefined &&
    existingTrip.TripKey !== trip.TripKey;
  const scheduleAttachmentLost =
    existingTrip?.ScheduleKey !== undefined && trip.ScheduleKey === undefined;
  return physicalIdentityReplaced || scheduleAttachmentLost;
};

/**
 * Attaches next-leg schedule fields from the resolution or prior-row continuity.
 *
 * When the resolver supplies `next`, those values win. Otherwise, if the current
 * `ScheduleKey` still matches the prior row's key, missing `Next*` on the new row
 * is backfilled from `existingTrip`. If there is no segment key or no safe match,
 * next-leg fields are cleared so consumers do not inherit a wrong following leg.
 *
 * @param baseTrip - Row after current-leg merge, delay, and optional next-leg strip
 * @param existingTrip - Prior row for continuity backfill when segment keys align
 * @param next - Optional explicit next-leg payload from schedule resolution
 * @returns `baseTrip` with `NextScheduleKey` and `NextScheduledDeparture` set or cleared
 */
const attachNextScheduledTripFields = ({
  baseTrip,
  existingTrip,
  next,
}: {
  baseTrip: ConvexVesselTrip;
  existingTrip: ConvexVesselTrip | undefined;
  next:
    | {
        NextScheduleKey?: string;
        NextScheduledDeparture?: number;
      }
    | undefined;
}): ConvexVesselTrip => {
  const segmentKey = baseTrip.ScheduleKey;
  if (!segmentKey) {
    return baseTrip;
  }

  const priorMatchesSegment =
    existingTrip !== undefined && existingTrip.ScheduleKey === segmentKey;

  const nextLeg = next
    ? {
        NextScheduleKey: next.NextScheduleKey,
        NextScheduledDeparture: next.NextScheduledDeparture,
      }
    : priorMatchesSegment
      ? {
          NextScheduleKey:
            baseTrip.NextScheduleKey ?? existingTrip.NextScheduleKey,
          NextScheduledDeparture:
            baseTrip.NextScheduledDeparture ??
            existingTrip.NextScheduledDeparture,
        }
      : {
          NextScheduleKey: undefined,
          NextScheduledDeparture: undefined,
        };

  return { ...baseTrip, ...nextLeg };
};
