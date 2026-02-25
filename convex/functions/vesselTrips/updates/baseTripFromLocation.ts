/**
 * Base vessel trip from raw location data.
 *
 * Single function that constructs the full ConvexVesselTrip using simple
 * assignment statements per Field Reference 2.6. SailingDay comes from raw
 * data via getSailingDay (prefer ScheduledDeparture). Schedule-derived:
 * Key from raw data; ScheduledTrip from appendFinalSchedule (RouteID/RouteAbbrev
 * live on ScheduledTrip).
 */
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/keys";
import { getSailingDay } from "shared/time";

/**
 * Base complete VesselTrip from raw location data using simple assignments.
 *
 * Handles first trip, trip boundary (new trip), and regular update. Per Field
 * Reference 2.6. SailingDay from getSailingDay (prefer ScheduledDeparture).
 * Key derived from raw data, used for schedule lookup. ScheduledTrip from
 * appendFinalSchedule (RouteID/RouteAbbrev live on ScheduledTrip).
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Current trip (regular update only; undefined for first/boundary)
 * @param isTripStart - True for trip start (vessel just arrived at dock), false for continuing
 * @returns Complete ConvexVesselTrip with location-derived fields
 */
export const baseTripFromLocation = (
  currLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip,
  isTripStart?: boolean
): ConvexVesselTrip =>
  isTripStart
    ? baseTripForStart(currLocation, existingTrip)
    : baseTripForContinuing(currLocation, existingTrip);

// ============================================================================
// baseTripFromLocation
// ============================================================================

/**
 * Base trip for trip start scenario (vessel just arrived at dock after completing
 * previous trip). At this point, `existingTrip` is the trip being completed.
 *
 * Key characteristics:
 * - TripStart is set to current timestamp
 * - Prev* fields are carried from the completing trip
 * - Predictions are cleared (undefined)
 * - ArrivingTerminalAbbrev comes only from currLocation (not existingTrip)
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - The trip being completed (provides Prev* fields)
 * @returns Complete ConvexVesselTrip for new trip start
 */
const baseTripForStart = (
  currLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip
): ConvexVesselTrip => {
  const arrivingTerminalAbbrev = currLocation.ArrivingTerminalAbbrev;

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    RouteAbbrev: currLocation.RouteAbbrev,
    Key: deriveTripKey(
      currLocation.VesselAbbrev,
      currLocation.DepartingTerminalAbbrev,
      arrivingTerminalAbbrev,
      currLocation.ScheduledDeparture
    ),
    SailingDay: deriveSailingDay(currLocation.ScheduledDeparture),
    scheduledTripId: undefined,
    PrevTerminalAbbrev: existingTrip?.DepartingTerminalAbbrev,
    PrevScheduledDeparture: existingTrip?.ScheduledDeparture,
    PrevLeftDock: existingTrip?.LeftDock,
    TripStart: currLocation.TimeStamp,
    AtDock: currLocation.AtDock,
    AtDockDuration: undefined,
    ScheduledDeparture: currLocation.ScheduledDeparture,
    LeftDock: undefined,
    TripDelay: undefined,
    Eta: undefined,
    TripEnd: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
    // Predictions reset for new trip
    AtDockDepartCurr: undefined,
    AtDockArriveNext: undefined,
    AtDockDepartNext: undefined,
    AtSeaArriveNext: undefined,
    AtSeaDepartNext: undefined,
  };
};

/**
 * Base trip for continuing scenario (vessel is on the same trip as existingTrip,
 * or this is the first trip with no existingTrip).
 *
 * Key characteristics:
 * - TripStart is carried from existingTrip
 * - Prev* fields are carried from existingTrip
 * - Predictions are carried from existingTrip
 * - ArrivingTerminalAbbrev: currLocation or fallback to existingTrip
 * - LeftDock: currLocation or inferred when AtDock flips false
 *
 * @param currLocation - Latest vessel location from REST/API
 * @param existingTrip - Current ongoing trip (undefined for first appearance)
 * @returns Complete ConvexVesselTrip for continuing trip
 */
const baseTripForContinuing = (
  currLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip
): ConvexVesselTrip => {
  // LeftDock: infer when AtDock flips false and LeftDock missing
  const justLeftDock = existingTrip?.AtDock && !currLocation.AtDock;

  const leftDockTime =
    currLocation.LeftDock ??
    (!justLeftDock ? undefined : currLocation.TimeStamp);

  const arrivingTerminalAbbrev =
    currLocation.ArrivingTerminalAbbrev ?? existingTrip?.ArrivingTerminalAbbrev;

  const tripStartTime = existingTrip?.TripStart;

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    RouteAbbrev: currLocation.RouteAbbrev,
    Key: deriveTripKey(
      currLocation.VesselAbbrev,
      currLocation.DepartingTerminalAbbrev,
      arrivingTerminalAbbrev,
      currLocation.ScheduledDeparture
    ),
    SailingDay: deriveSailingDay(currLocation.ScheduledDeparture),
    scheduledTripId: existingTrip?.scheduledTripId,
    // Prev* fields carried from existing trip
    PrevTerminalAbbrev: existingTrip?.PrevTerminalAbbrev,
    PrevScheduledDeparture: existingTrip?.PrevScheduledDeparture,
    PrevLeftDock: existingTrip?.PrevLeftDock,
    // TripStart carried from existing trip
    TripStart: tripStartTime,
    AtDock: currLocation.AtDock,
    AtDockDuration: calculateTimeDelta(tripStartTime, leftDockTime),
    ScheduledDeparture: currLocation.ScheduledDeparture,
    LeftDock: leftDockTime,
    TripDelay: calculateTimeDelta(
      currLocation.ScheduledDeparture,
      leftDockTime
    ),
    // Eta: null-overwrite protection
    Eta: currLocation.Eta ?? existingTrip?.Eta,
    TripEnd: undefined,
    AtSeaDuration: existingTrip?.AtSeaDuration,
    TotalDuration: existingTrip?.TotalDuration,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
    // Predictions carried from existing trip
    AtDockDepartCurr: existingTrip?.AtDockDepartCurr,
    AtDockArriveNext: existingTrip?.AtDockArriveNext,
    AtDockDepartNext: existingTrip?.AtDockDepartNext,
    AtSeaArriveNext: existingTrip?.AtSeaArriveNext,
    AtSeaDepartNext: existingTrip?.AtSeaDepartNext,
  };
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Derive trip key from vessel, terminals, and scheduled departure.
 */
const deriveTripKey = (
  vessel: string,
  departing: string,
  arriving: string | undefined,
  scheduledDeparture: number | undefined
): string | undefined =>
  generateTripKey(
    vessel,
    departing,
    arriving,
    scheduledDeparture ? new Date(scheduledDeparture) : undefined
  );

/**
 * Derive sailing day from scheduled departure.
 */
const deriveSailingDay = (scheduledDeparture: number | undefined): string =>
  scheduledDeparture ? getSailingDay(new Date(scheduledDeparture)) : "";
