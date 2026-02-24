/**
 * Build vessel trip from raw location data.
 *
 * Single function that constructs the full ConvexVesselTrip using simple
 * assignment statements per Field Reference 2.6. SailingDay comes from raw
 * data via getSailingDay (prefer ScheduledDeparture). Schedule-derived:
 * Key from raw data; ScheduledTrip from buildTripWithFinalSchedule (RouteID/RouteAbbrev
 * live on ScheduledTrip).
 */
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/keys";
import { getSailingDay } from "shared/time";

// ============================================================================
// buildTripFromVesselLocation
// ============================================================================

/**
 * Build complete VesselTrip from raw location data using simple assignments.
 *
 * Handles first trip, trip boundary (new trip), and regular update. Per Field
 * Reference 2.6. SailingDay from getSailingDay (prefer ScheduledDeparture).
 * Key derived from raw data, used for schedule lookup. ScheduledTrip from
 * buildTripWithSchedule (RouteID/RouteAbbrev live on ScheduledTrip).
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Current trip (regular update only; undefined for first/boundary)
 * @param completedTrip - Completed trip at boundary (provides Prev* for new trip)
 * @returns Complete ConvexVesselTrip with location-derived fields
 */
export const buildTripFromVesselLocation = (
  currLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip,
  completedTrip?: ConvexVesselTrip
): ConvexVesselTrip => {
  const isNewTrip = completedTrip !== undefined;
  const isRegularUpdate = existingTrip !== undefined && !isNewTrip;

  // LeftDock: infer when AtDock flips false and LeftDock missing
  const justLeftDock =
    isRegularUpdate &&
    currLocation.AtDock !== existingTrip?.AtDock &&
    !currLocation.AtDock &&
    existingTrip?.AtDock;

  const leftDock =
    existingTrip?.LeftDock ??
    currLocation.LeftDock ??
    (justLeftDock ? currLocation.TimeStamp : undefined);

  // TripStart: boundary = currLocation.TimeStamp; regular = carry from existing
  const tripStart = isNewTrip
    ? currLocation.TimeStamp
    : existingTrip?.TripStart;

  // ArrivingTerminalAbbrev: never use existingTrip at boundary (wrong terminal)
  const arrivingTerminalAbbrev =
    currLocation.ArrivingTerminalAbbrev ??
    (isRegularUpdate ? existingTrip?.ArrivingTerminalAbbrev : undefined);

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    Key:
      generateTripKey(
        currLocation.VesselAbbrev,
        currLocation.DepartingTerminalAbbrev,
        arrivingTerminalAbbrev,
        currLocation.ScheduledDeparture
          ? new Date(currLocation.ScheduledDeparture)
          : undefined
      ) ?? undefined,
    SailingDay: currLocation.ScheduledDeparture
      ? getSailingDay(new Date(currLocation.ScheduledDeparture))
      : "",
    scheduledTripId: undefined,
    PrevTerminalAbbrev:
      completedTrip?.DepartingTerminalAbbrev ??
      existingTrip?.PrevTerminalAbbrev,
    TripStart: tripStart,
    AtDock: currLocation.AtDock,
    AtDockDuration: calculateTimeDelta(tripStart, leftDock),
    ScheduledDeparture: currLocation.ScheduledDeparture,
    LeftDock: leftDock,
    TripDelay: calculateTimeDelta(currLocation.ScheduledDeparture, leftDock),
    Eta: currLocation.Eta ?? existingTrip?.Eta,
    TripEnd: undefined,
    AtSeaDuration: existingTrip?.AtSeaDuration,
    TotalDuration: existingTrip?.TotalDuration,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
    PrevScheduledDeparture:
      completedTrip?.ScheduledDeparture ?? existingTrip?.PrevScheduledDeparture,
    PrevLeftDock: completedTrip?.LeftDock ?? existingTrip?.PrevLeftDock,
    // Carry predictions from existing trip; buildTripWithPredictions merges new ones
    AtDockDepartCurr: existingTrip?.AtDockDepartCurr,
    AtDockArriveNext: existingTrip?.AtDockArriveNext,
    AtDockDepartNext: existingTrip?.AtDockDepartNext,
    AtSeaArriveNext: existingTrip?.AtSeaArriveNext,
    AtSeaDepartNext: existingTrip?.AtSeaDepartNext,
  };
};
