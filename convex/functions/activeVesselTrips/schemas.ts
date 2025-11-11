import type { Doc } from "@convex/_generated/dataModel";
import type { Infer } from "convex/values";
import { v } from "convex/values";

import type { ActiveVesselTrip } from "@/data/types/ActiveVesselTrip";

import {
  toDate,
  toDateOrNull,
  toTimeMs,
  toTimeMsOrUndefined,
  toValOrNull,
  toValOrUndefined,
} from "../utils";

// Schema for database storage (Convex format with undefined for optional fields)
export const activeVesselTripSchema = v.object({
  VesselID: v.number(),
  VesselName: v.string(),
  VesselAbbrev: v.string(),
  DepartingTerminalID: v.number(),
  DepartingTerminalName: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalID: v.optional(v.number()),
  ArrivingTerminalName: v.optional(v.string()),
  ArrivingTerminalAbbrev: v.optional(v.string()),
  ScheduledDeparture: v.optional(v.number()),
  LeftDock: v.optional(v.number()),
  LeftDockActual: v.optional(v.number()),
  LeftDockDelay: v.optional(v.number()),
  Eta: v.optional(v.number()),
  InService: v.boolean(),
  AtDock: v.boolean(),
  OpRouteAbbrev: v.optional(v.string()),
  VesselPositionNum: v.optional(v.number()),
  TimeStamp: v.number(),
  TripStart: v.number(),
});

/**
 * Type for Convex active vessel trip
 */
export type ConvexActiveVesselTrip = Infer<typeof activeVesselTripSchema>;

/**
 * Converts Convex vessel trip to domain format
 * number → Date, undefined → null
 *
 * @param doc - The Convex document to convert
 * @returns Domain format vessel trip
 * @throws Error if conversion fails
 */
export const toActiveVesselTrip = (
  doc: Doc<"activeVesselTrips">
): ActiveVesselTrip => {
  try {
    return {
      VesselID: doc.VesselID,
      VesselName: doc.VesselName,
      VesselAbbrev: doc.VesselAbbrev,
      DepartingTerminalID: doc.DepartingTerminalID,
      DepartingTerminalName: doc.DepartingTerminalName,
      DepartingTerminalAbbrev: doc.DepartingTerminalAbbrev,
      ArrivingTerminalID: toValOrNull(doc.ArrivingTerminalID),
      ArrivingTerminalName: toValOrNull(doc.ArrivingTerminalName),
      ArrivingTerminalAbbrev: toValOrNull(doc.ArrivingTerminalAbbrev),
      InService: doc.InService,
      AtDock: doc.AtDock,
      ScheduledDeparture: toDateOrNull(doc.ScheduledDeparture),
      LeftDock: toDateOrNull(doc.LeftDock),
      LeftDockActual: doc.LeftDockActual ? new Date(doc.LeftDockActual) : null,
      LeftDockDelay: toValOrNull(doc.LeftDockDelay),
      Eta: toDateOrNull(doc.Eta),
      OpRouteAbbrev: toValOrNull(doc.OpRouteAbbrev),
      VesselPositionNum: toValOrNull(doc.VesselPositionNum),
      TimeStamp: toDate(doc.TimeStamp),
      TripStart: toDate(doc.TripStart),
    };
  } catch (error) {
    throw new Error(`Failed to convert active vessel trip: ${error}`);
  }
};

/**
 * Converts raw WSF vessel location data to Convex format
 * Date → number, null → undefined
 *
 * @param trip - The domain format vessel trip to convert
 * @returns Convex format vessel trip
 * @throws Error if conversion fails
 */
export const toConvexActiveVesselTrip = (
  trip: ActiveVesselTrip
): ConvexActiveVesselTrip => {
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
      InService: trip.InService,
      AtDock: trip.AtDock,
      ScheduledDeparture: toTimeMsOrUndefined(trip.ScheduledDeparture),
      LeftDock: toTimeMsOrUndefined(trip.LeftDock),
      LeftDockDelay: toValOrUndefined(trip.LeftDockDelay),
      LeftDockActual: toTimeMsOrUndefined(trip.LeftDockActual),
      Eta: toTimeMsOrUndefined(trip.Eta),
      OpRouteAbbrev: toValOrUndefined(trip.OpRouteAbbrev),
      VesselPositionNum: toValOrUndefined(trip.VesselPositionNum),
      TimeStamp: toTimeMs(trip.TimeStamp),
      TripStart: toTimeMs(trip.TripStart),
    };
  } catch (error) {
    throw new Error(`Failed to convert to Convex active vessel trip: ${error}`);
  }
};
