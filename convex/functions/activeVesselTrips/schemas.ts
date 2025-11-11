import type { Doc } from "@convex/_generated/dataModel";
import {
  type ActiveVesselTrip,
  type StoredActiveVesselTrip,
  toActiveVesselTrip as toDomainActiveVesselTrip,
  toStoredActiveVesselTrip,
} from "@domain";
import type { Infer } from "convex/values";
import { v } from "convex/values";

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
): ActiveVesselTrip => toDomainActiveVesselTrip(doc as StoredActiveVesselTrip);

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
): ConvexActiveVesselTrip =>
  toStoredActiveVesselTrip(trip) as ConvexActiveVesselTrip;
