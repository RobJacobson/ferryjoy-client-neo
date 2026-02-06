/**
 * Converts a VesselTrip to a Segment for use with TimelineSegmentLeg.
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { Segment } from "../Timeline/types";

/**
 * Converts a single-leg VesselTrip to a Segment for timeline rendering.
 *
 * Maps trip fields to Segment: DepartingTime from ScheduledDeparture,
 * SchedArriveCurr/SchedArriveNext from ScheduledTrip, terminals from trip.
 *
 * @param trip - VesselTrip (single leg, origin to destination)
 * @returns Segment suitable for TimelineSegmentLeg
 */
export const vesselTripToSegment = (trip: VesselTrip): Segment => ({
  VesselAbbrev: trip.VesselAbbrev,
  DepartingTerminalAbbrev: trip.DepartingTerminalAbbrev,
  ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev ?? "",
  DepartingTime: trip.ScheduledDeparture ?? new Date(0),
  SchedArriveCurr: trip.ScheduledTrip?.SchedArriveCurr,
  SchedArriveNext: trip.ScheduledTrip?.SchedArriveNext,
  Key:
    trip.Key ??
    `${trip.VesselAbbrev}-${trip.ScheduledDeparture?.getTime() ?? "unknown"}`,
  DirectKey: trip.Key,
  SailingDay: trip.SailingDay,
});
