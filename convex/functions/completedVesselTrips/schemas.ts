import type { Doc } from "@convex/_generated/dataModel";
import { type Infer, v } from "convex/values";

import type { CompletedVesselTrip } from "@/data/types/CompletedVesselTrip";

import { activeVesselTripSchema } from "../activeVesselTrips/schemas";
import {
  toDate,
  toDateOrNull,
  toTimeMs,
  toTimeMsOrUndefined,
  toValOrNull,
  toValOrUndefined,
} from "../utils";

export const completedVesselTripSchema = v.object({
  ...activeVesselTripSchema.fields,
  // Extended fields
  Key: v.string(),
  TripStart: v.number(),
  TripEnd: v.number(),
  LeftDock: v.optional(v.number()),
  LeftDockActual: v.number(),
  LeftDockDelay: v.optional(v.number()),
  AtDockDuration: v.number(),
  AtSeaDuration: v.number(),
  TotalDuration: v.number(),
});

/**
 * Type for Convex completed vessel trip
 */
export type ConvexCompletedVesselTrip = Infer<typeof completedVesselTripSchema>;

/**
 * Converts Convex vessel trip to domain format
 * number → Date, undefined → null
 *
 * @param cvt - The Convex document to convert
 * @returns Domain format completed vessel trip
 * @throws Error if conversion fails
 */
export const toCompletedTrip = (
  cvt: Doc<"completedVesselTrips">
): CompletedVesselTrip => {
  try {
    return {
      VesselID: cvt.VesselID,
      VesselName: cvt.VesselName,
      VesselAbbrev: cvt.VesselAbbrev,
      DepartingTerminalID: cvt.DepartingTerminalID,
      DepartingTerminalName: cvt.DepartingTerminalName,
      DepartingTerminalAbbrev: cvt.DepartingTerminalAbbrev,
      ArrivingTerminalID: toValOrNull(cvt.ArrivingTerminalID),
      ArrivingTerminalName: toValOrNull(cvt.ArrivingTerminalName),
      ArrivingTerminalAbbrev: toValOrNull(cvt.ArrivingTerminalAbbrev),
      ScheduledDeparture: toDateOrNull(cvt.ScheduledDeparture),
      LeftDock: toDateOrNull(cvt.LeftDock),
      LeftDockActual: toDate(cvt.LeftDockActual),
      Eta: toDateOrNull(cvt.Eta),
      InService: cvt.InService,
      AtDock: cvt.AtDock,
      OpRouteAbbrev: toValOrNull(cvt.OpRouteAbbrev),
      VesselPositionNum: toValOrNull(cvt.VesselPositionNum),
      TimeStamp: toDate(cvt.TimeStamp),
      TripStart: toDate(cvt.TripStart),
      Key: cvt.Key,
      TripEnd: toDate(cvt.TripEnd),
      LeftDockDelay: toValOrNull(cvt.LeftDockDelay),
      AtDockDuration: cvt.AtDockDuration,
      AtSeaDuration: cvt.AtSeaDuration,
      TotalDuration: cvt.TotalDuration,
    };
  } catch (error) {
    throw new Error(`Failed to convert completed vessel trip: ${error}`);
  }
};

/**
 * Converts raw WSF vessel location data to Convex format
 * Date → number, null → undefined
 *
 * @param trip - The domain format completed vessel trip to convert
 * @returns Convex format completed vessel trip
 * @throws Error if conversion fails
 */
export const toConvexCompletedVesselTrip = (
  trip: CompletedVesselTrip
): ConvexCompletedVesselTrip => {
  try {
    return {
      VesselID: trip.VesselID,
      VesselName: trip.VesselName,
      VesselAbbrev: trip.VesselAbbrev,
      DepartingTerminalID: trip.DepartingTerminalID,
      DepartingTerminalName: trip.DepartingTerminalName,
      DepartingTerminalAbbrev: trip.DepartingTerminalAbbrev,
      ArrivingTerminalID: toValOrUndefined(trip.ArrivingTerminalID),
      ArrivingTerminalName: toValOrUndefined(trip.ArrivingTerminalName),
      ArrivingTerminalAbbrev: toValOrUndefined(trip.ArrivingTerminalAbbrev),
      ScheduledDeparture: toTimeMsOrUndefined(trip.ScheduledDeparture),
      LeftDock: toTimeMsOrUndefined(trip.LeftDock),
      LeftDockActual: toTimeMs(trip.LeftDockActual),
      Eta: toTimeMsOrUndefined(trip.Eta),
      InService: trip.InService,
      AtDock: trip.AtDock,
      OpRouteAbbrev: toValOrUndefined(trip.OpRouteAbbrev),
      VesselPositionNum: toValOrUndefined(trip.VesselPositionNum),
      TimeStamp: toTimeMs(trip.TimeStamp),
      TripStart: toTimeMs(trip.TripStart),
      Key: trip.Key,
      TripEnd: toTimeMs(trip.TripEnd),
      LeftDockDelay: toValOrUndefined(trip.LeftDockDelay),
      AtDockDuration: trip.AtDockDuration,
      AtSeaDuration: trip.AtSeaDuration,
      TotalDuration: trip.TotalDuration,
    };
  } catch (error) {
    throw new Error(
      `Failed to convert to Convex completed vessel trip: ${error}`
    );
  }
};
