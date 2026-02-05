/**
 * Conversion utilities for scheduled trip segments.
 */

import type { ConvexScheduledTrip } from "convex/functions/scheduledTrips/schemas";
import { optionalEpochMsToDate } from "@/shared/utils/dateConversions";
import type { Segment } from "../types";

/**
 * Converts a raw Convex scheduled trip to a frontend Segment with Date objects.
 *
 * @param trip - The raw scheduled trip from Convex
 * @returns A Segment object with Date timestamps
 */
export const toSegment = (
  trip: ConvexScheduledTrip & { DisplayArrivingTerminalAbbrev?: string }
): Segment => ({
  VesselAbbrev: trip.VesselAbbrev,
  DepartingTerminalAbbrev: trip.DepartingTerminalAbbrev,
  ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
  DisplayArrivingTerminalAbbrev: trip.DisplayArrivingTerminalAbbrev,
  DepartingTime: new Date(trip.DepartingTime),
  ArrivingTime: optionalEpochMsToDate(trip.ArrivingTime),
  SchedArriveNext: optionalEpochMsToDate(trip.SchedArriveNext),
  SchedArriveCurr: optionalEpochMsToDate(trip.SchedArriveCurr),
  NextDepartingTime: optionalEpochMsToDate(trip.NextDepartingTime),
  DirectKey: trip.DirectKey,
  Key: trip.Key,
  SailingDay: trip.SailingDay,
});
