/**
 * Converts VesselTripWithScheduledTrip + VesselLocation to TripSegment.
 * Enables VesselTripTimeline to use the shared timeline primitives.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTripWithScheduledTrip } from "convex/functions/vesselTrips/schemas";
import type { TimePoint, TripSegment } from "../../shared/types";
import {
  getBestArrivalTime,
  getBestDepartureTime,
  getPredictedArriveNextTime,
} from "../../shared/utils";

/**
 * Converts a single-leg vessel trip to a TripSegment for timeline rendering.
 *
 * @param trip - Vessel trip with optional ScheduledTrip
 * @param vesselLocation - Real-time vessel location
 * @returns TripSegment suitable for TimelineBarAtDock, TimelineBarAtSea, markers
 */
export const vesselTripToTripSegment = (
  trip: VesselTripWithScheduledTrip,
  vesselLocation: VesselLocation
): TripSegment => {
  const isHeld = !!trip.TripEnd;
  const isAtDock = vesselLocation.AtDock && !trip.TripEnd;
  const status: TripSegment["status"] = trip.TripEnd
    ? "past"
    : isAtDock || !vesselLocation.AtDock
      ? "ongoing"
      : "future";
  const phase: TripSegment["phase"] = trip.TripEnd
    ? "completed"
    : isAtDock
      ? "at-dock"
      : "at-sea";

  const schedDeparture = trip.ScheduledDeparture ?? new Date(0);
  const schedArriveCurr = trip.ScheduledTrip?.SchedArriveCurr ?? schedDeparture;
  const schedArriveNext =
    trip.ScheduledTrip?.SchedArriveNext ??
    trip.ScheduledTrip?.ArrivingTime ??
    schedDeparture;

  const predictedArriveNext = getPredictedArriveNextTime(trip, vesselLocation);
  const departurePrediction = getBestDepartureTime(vesselLocation, trip);
  const arrivalPrediction = getBestArrivalTime(vesselLocation, trip);

  const arriveCurr: TimePoint = {
    scheduled: schedArriveCurr,
    actual: trip.TripStart,
    estimated: undefined,
  };

  const leaveCurr: TimePoint = {
    scheduled: schedDeparture,
    actual: trip.LeftDock,
    estimated: vesselLocation.AtDock ? departurePrediction : undefined,
  };

  const arriveNext: TimePoint = {
    scheduled: schedArriveNext,
    actual: trip.TripEnd,
    estimated: !trip.TripEnd
      ? (vesselLocation.Eta ?? predictedArriveNext ?? arrivalPrediction)
      : undefined,
  };

  return {
    id: trip.Key ?? `${trip.VesselAbbrev}-${schedDeparture.getTime()}`,
    vesselAbbrev: trip.VesselAbbrev,
    vesselName: vesselLocation.VesselName,
    currTerminal: { abbrev: trip.DepartingTerminalAbbrev },
    nextTerminal: {
      abbrev: trip.ArrivingTerminalAbbrev ?? trip.DepartingTerminalAbbrev,
    },
    arriveCurr,
    leaveCurr,
    arriveNext,
    status,
    phase,
    isHeld,
    isArrived: !!trip.TripStart,
    isLeft: !!trip.LeftDock,
  };
};
