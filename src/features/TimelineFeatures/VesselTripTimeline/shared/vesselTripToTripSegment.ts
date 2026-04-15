/**
 * Converts VesselTripWithScheduledTrip + VesselLocation to TripSegment.
 * Enables VesselTripTimeline to use the shared timeline primitives.
 */

import type { VesselLocation, VesselTripWithScheduledTrip } from "@/types";
import type { TimePoint, TripSegment } from "../../shared/types";
import {
  getBestArrivalTime,
  getBestDepartureTime,
  getDestinationArrivalOrCoverageClose,
  getOriginArrivalActual,
  hasTripCoverageEnded,
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
  const coverageEnded = hasTripCoverageEnded(trip);
  const isHeld = coverageEnded;
  const isAtDock = vesselLocation.AtDock && !coverageEnded;
  const status: TripSegment["status"] = coverageEnded
    ? "past"
    : isAtDock || !vesselLocation.AtDock
      ? "ongoing"
      : "future";
  const phase: TripSegment["phase"] = coverageEnded
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

  const departurePrediction = getBestDepartureTime(vesselLocation, trip);
  const arrivalPrediction = getBestArrivalTime(vesselLocation, trip);

  const destinationArrivalOrCoverageClose =
    getDestinationArrivalOrCoverageClose(trip);

  const arriveCurr: TimePoint = {
    scheduled: schedArriveCurr,
    actual: getOriginArrivalActual(trip),
    estimated: undefined,
  };

  const leaveCurr: TimePoint = {
    scheduled: schedDeparture,
    actual: trip.DepartOriginActual ?? trip.LeftDock,
    estimated: vesselLocation.AtDock ? departurePrediction : undefined,
  };

  const arriveNext: TimePoint = {
    scheduled: schedArriveNext,
    actual: destinationArrivalOrCoverageClose,
    estimated: !destinationArrivalOrCoverageClose
      ? (vesselLocation.Eta ??
        trip.AtSeaArriveNext?.PredTime ??
        trip.AtDockArriveNext?.PredTime ??
        arrivalPrediction)
      : undefined,
  };

  return {
    id:
      trip.TripKey ??
      trip.ScheduleKey ??
      `${trip.VesselAbbrev}-${schedDeparture.getTime()}`,
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
    isArrived: !!getOriginArrivalActual(trip),
    isLeft: !!(trip.DepartOriginActual ?? trip.LeftDock),
  };
};
