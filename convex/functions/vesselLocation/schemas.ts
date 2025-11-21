import type { Infer } from "convex/values";
import { zodToConvex } from "convex-helpers/server/zod";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { z } from "zod";

import {
  epochMillisToDate,
  optionalEpochMillisToDate,
} from "../../shared/codecs";

/**
 * Zod schema for vessel location (domain representation with Date objects)
 * This is the single source of truth for vessel location structure
 * Exported for use in domain layer conversion functions
 */
export const vesselLocationSchema = z.object({
  VesselID: z.number(),
  VesselName: z.string().optional(),
  DepartingTerminalID: z.number(),
  DepartingTerminalName: z.string().optional(),
  DepartingTerminalAbbrev: z.string().optional(),
  ArrivingTerminalID: z.number().optional(),
  ArrivingTerminalName: z.string().optional(),
  ArrivingTerminalAbbrev: z.string().optional(),
  Latitude: z.number(),
  Longitude: z.number(),
  Speed: z.number(),
  Heading: z.number(),
  InService: z.boolean(),
  AtDock: z.boolean(),
  LeftDock: optionalEpochMillisToDate, // Date in domain, number in Convex
  Eta: optionalEpochMillisToDate, // Date in domain, number in Convex
  ScheduledDeparture: optionalEpochMillisToDate, // Date in domain, number in Convex
  OpRouteAbbrev: z.string().optional(),
  VesselPositionNum: z.number().optional(),
  TimeStamp: epochMillisToDate, // Date in domain, number in Convex
});

/**
 * Convex validator for vessel locations (converted from Zod schema)
 * This is used in defineTable and function argument validation
 */
export const vesselLocationValidationSchema = zodToConvex(vesselLocationSchema);

/**
 * Type for vessel location in domain layer (with Date objects)
 * Inferred from the Zod schema
 */
export type VesselLocation = z.infer<typeof vesselLocationSchema>;

/**
 * Type for vessel location in Convex storage (with numbers)
 * Inferred from the Convex validator - single source of truth!
 */
export type ConvexVesselLocation = Infer<typeof vesselLocationValidationSchema>;

/**
 * Convert a Dottie vessel location to a convex vessel location
 * Uses Zod schema's encode to automatically convert Date to number
 */
export const toConvexVesselLocation = (
  vl: DottieVesselLocation
): ConvexVesselLocation => {
  // Create domain representation with Date objects
  const domainLocation = {
    VesselID: vl.VesselID,
    VesselName: vl.VesselName ?? undefined,
    DepartingTerminalID: vl.DepartingTerminalID,
    DepartingTerminalName: vl.DepartingTerminalName ?? undefined,
    DepartingTerminalAbbrev: vl.DepartingTerminalAbbrev ?? undefined,
    ArrivingTerminalID: vl.ArrivingTerminalID ?? undefined,
    ArrivingTerminalName: vl.ArrivingTerminalName ?? undefined,
    ArrivingTerminalAbbrev: vl.ArrivingTerminalAbbrev ?? undefined,
    Latitude: vl.Latitude,
    Longitude: vl.Longitude,
    Speed: vl.Speed,
    Heading: vl.Heading,
    InService: vl.InService,
    AtDock: vl.AtDock,
    LeftDock: vl.LeftDock ?? undefined, // Already a Date or null
    Eta: vl.Eta ?? undefined, // Already a Date or null
    ScheduledDeparture: vl.ScheduledDeparture ?? undefined, // Already a Date or null
    OpRouteAbbrev: vl.OpRouteAbbrev?.[0] ?? undefined,
    VesselPositionNum: vl.VesselPositionNum ?? undefined,
    TimeStamp: vl.TimeStamp, // Already a Date
  };

  // Encode to Convex format (Date -> number)
  // The encode method returns the input type (numbers), which matches ConvexVesselLocation
  // Using 'unknown' first because TypeScript can't properly infer the encoded type
  return vesselLocationSchema.encode(
    domainLocation
  ) as unknown as ConvexVesselLocation;
};

/**
 * Convert Convex vessel location (numbers) to domain vessel location (Dates)
 * Uses Zod schema's decode to automatically convert numbers to Dates
 */
export const toDomainVesselLocation = (location: ConvexVesselLocation) =>
  vesselLocationSchema.decode(location);
