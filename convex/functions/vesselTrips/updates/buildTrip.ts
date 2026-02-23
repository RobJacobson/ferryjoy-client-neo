/**
 * Build vessel trip from raw location data.
 *
 * Single function that constructs the full ConvexVesselTrip using simple
 * assignment statements per Field Reference 2.6. SailingDay comes from raw
 * data via getSailingDay (prefer ScheduledDeparture). Schedule-derived
 * fields (Key, RouteID, RouteAbbrev, ScheduledTrip) are left default;
 * lookupScheduledTrip fills those.
 */
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import type { ArrivalLookupResult } from "./lookupScheduledTrip";

// ============================================================================
// buildTripFromRawData
// ============================================================================

/**
 * Build complete VesselTrip from raw location data using simple assignments.
 *
 * Handles first trip, trip boundary (new trip), and regular update. Per Field
 * Reference 2.6. SailingDay from getSailingDay (prefer ScheduledDeparture).
 * Key derived from raw data, used for schedule lookup. RouteID, RouteAbbrev,
 * ScheduledTrip left default; filled by lookupScheduledTrip.
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Current trip (regular update only; undefined for first/boundary)
 * @param completedTrip - Completed trip at boundary (provides Prev* for new trip)
 * @param arrivalLookup - Optional result from lookupArrivalTerminalFromSchedule
 * @returns Complete ConvexVesselTrip with location-derived fields
 */
export const buildTripFromRawData = (
  currLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip,
  completedTrip?: ConvexVesselTrip,
  arrivalLookup?: ArrivalLookupResult
): ConvexVesselTrip => {
  const isBoundary = completedTrip !== undefined;
  const isRegularUpdate = existingTrip !== undefined && !isBoundary;

  // LeftDock: infer when AtDock flips false and LeftDock missing
  const atDockFlippedToFalse =
    isRegularUpdate &&
    currLocation.AtDock !== existingTrip?.AtDock &&
    !currLocation.AtDock &&
    existingTrip?.AtDock;

  const leftDock =
    atDockFlippedToFalse && !existingTrip?.LeftDock
      ? (currLocation.LeftDock ?? currLocation.TimeStamp)
      : (currLocation.LeftDock ?? existingTrip?.LeftDock);

  const scheduledDeparture =
    currLocation.ScheduledDeparture ?? existingTrip?.ScheduledDeparture;
  const eta = currLocation.Eta ?? existingTrip?.Eta;

  // TripStart: boundary = currLocation.TimeStamp; regular = carry from existing
  const tripStart = isBoundary
    ? currLocation.TimeStamp
    : existingTrip?.TripStart;

  // SailingDay: prefer ScheduledDeparture (core business logic from raw data)
  const sailingDayTimestamp =
    scheduledDeparture ?? tripStart ?? currLocation.TimeStamp;
  const sailingDay = sailingDayTimestamp
    ? getSailingDay(new Date(sailingDayTimestamp))
    : "";

  // Computed durations
  const tripDelay = calculateTimeDelta(scheduledDeparture, leftDock);
  const atDockDuration = calculateTimeDelta(tripStart, leftDock);

  // ArrivingTerminalAbbrev: never use existingTrip at boundary (wrong terminal)
  const arrivingTerminalAbbrev = currLocation.ArrivingTerminalAbbrev
    ? currLocation.ArrivingTerminalAbbrev
    : arrivalLookup?.arrivalTerminal
      ? arrivalLookup.arrivalTerminal
      : isRegularUpdate
        ? existingTrip?.ArrivingTerminalAbbrev
        : undefined;

  // Key: derived from raw data, used for schedule lookup (independent of ScheduledTrip)
  const key =
    generateTripKey(
      currLocation.VesselAbbrev,
      currLocation.DepartingTerminalAbbrev,
      arrivingTerminalAbbrev,
      scheduledDeparture ? new Date(scheduledDeparture) : undefined
    ) ?? undefined;

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    RouteID: 0,
    RouteAbbrev: "",
    Key: key,
    SailingDay: sailingDay,
    ScheduledTrip: undefined,
    PrevTerminalAbbrev:
      completedTrip?.DepartingTerminalAbbrev ??
      existingTrip?.PrevTerminalAbbrev,
    TripStart: tripStart,
    AtDock: currLocation.AtDock,
    AtDockDuration: atDockDuration ?? existingTrip?.AtDockDuration,
    ScheduledDeparture: scheduledDeparture,
    LeftDock: leftDock,
    TripDelay: tripDelay ?? existingTrip?.TripDelay,
    Eta: eta,
    TripEnd: undefined,
    AtSeaDuration: existingTrip?.AtSeaDuration,
    TotalDuration: existingTrip?.TotalDuration,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
    PrevScheduledDeparture:
      completedTrip?.ScheduledDeparture ?? existingTrip?.PrevScheduledDeparture,
    PrevLeftDock: completedTrip?.LeftDock ?? existingTrip?.PrevLeftDock,
    // Carry predictions from existing trip; addPredictionsToTrip merges new ones
    AtDockDepartCurr: existingTrip?.AtDockDepartCurr,
    AtDockArriveNext: existingTrip?.AtDockArriveNext,
    AtDockDepartNext: existingTrip?.AtDockDepartNext,
    AtSeaArriveNext: existingTrip?.AtSeaArriveNext,
    AtSeaDepartNext: existingTrip?.AtSeaDepartNext,
  };
};
