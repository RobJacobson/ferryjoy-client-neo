import { zodToConvex } from "convex-helpers/server/zod";
import { getVesselAbbreviation } from "src/domain/vesselAbbreviations";
import { z } from "zod";
import {
  epochMillisToDate,
  optionalEpochMillisToDate,
} from "../../shared/codecs";
import type { ConvexVesselLocation } from "../vesselLocation/schemas";

/**
 * Zod schema for active vessel trip (domain representation with Date objects)
 * This is the single source of truth for active vessel trip structure
 */
export const activeVesselTripZodSchema = z.object({
  VesselID: z.number(),
  VesselName: z.string(),
  VesselAbbrev: z.string(),
  DepartingTerminalID: z.number(),
  DepartingTerminalName: z.string(),
  DepartingTerminalAbbrev: z.string(),
  ArrivingTerminalID: z.number().optional(),
  ArrivingTerminalName: z.string().optional(),
  ArrivingTerminalAbbrev: z.string().optional(),
  ScheduledDeparture: optionalEpochMillisToDate, // Date in domain, number in Convex
  LeftDock: optionalEpochMillisToDate, // Date in domain, number in Convex
  LeftDockActual: optionalEpochMillisToDate, // Date in domain, number in Convex
  LeftDockDelay: z.number().optional(),
  Eta: optionalEpochMillisToDate, // Date in domain, number in Convex
  InService: z.boolean(),
  AtDock: z.boolean(),
  OpRouteAbbrev: z.string().optional(),
  VesselPositionNum: z.number().optional(),
  TimeStamp: epochMillisToDate, // Date in domain, number in Convex
  TripStart: epochMillisToDate, // Date in domain, number in Convex
});

/**
 * Convex validator for active vessel trips (converted from Zod schema)
 * This is used in defineTable and function argument validation
 * Exported as activeVesselTripSchema for backward compatibility
 */
export const activeVesselTripSchema = zodToConvex(activeVesselTripZodSchema);

/**
 * Type for active vessel trip in domain layer (with Date objects)
 * Inferred from the Zod schema
 */
export type ActiveVesselTrip = z.infer<typeof activeVesselTripZodSchema>;

/**
 * Type for active vessel trip in Convex storage (with numbers)
 * Uses z.input to get the input type of the codec (numbers), not the output type (Dates)
 */
export type ConvexActiveVesselTrip = z.input<typeof activeVesselTripZodSchema>;

/**
 * Converts vessel location to active trip format
 * Note: location is already in Convex format (numbers), returns Convex format
 */
export const toConvexActiveVesselTrip = (
  location: ConvexVesselLocation,
  tripStart: number
): ConvexActiveVesselTrip => {
  // TypeScript can't properly infer ConvexActiveVesselTrip from Infer<typeof validator>
  // when the validator comes from a Zod schema with codecs, so we use a type assertion
  const result = {
    VesselID: location.VesselID,
    VesselName: location.VesselName ?? "",
    VesselAbbrev: getVesselAbbreviation(location.VesselName ?? ""),
    DepartingTerminalID: location.DepartingTerminalID,
    DepartingTerminalName: location.DepartingTerminalName ?? "",
    DepartingTerminalAbbrev: location.DepartingTerminalAbbrev ?? "",
    ArrivingTerminalID: location.ArrivingTerminalID,
    ArrivingTerminalName: location.ArrivingTerminalName,
    ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
    ScheduledDeparture: location.ScheduledDeparture,
    LeftDock: location.LeftDock,
    LeftDockActual: undefined,
    LeftDockDelay: undefined,
    Eta: location.Eta,
    InService: location.InService,
    AtDock: location.AtDock,
    OpRouteAbbrev: location.OpRouteAbbrev,
    VesselPositionNum: location.VesselPositionNum,
    TimeStamp: location.TimeStamp,
    TripStart: tripStart,
  } as unknown as ConvexActiveVesselTrip;
  return result;
};

/**
 * Convert Convex active vessel trip (numbers) to domain active vessel trip (Dates)
 * Uses Zod schema's decode to automatically convert numbers to Dates
 */
export const toDomainActiveVesselTrip = (trip: ConvexActiveVesselTrip) =>
  activeVesselTripZodSchema.decode(trip);
