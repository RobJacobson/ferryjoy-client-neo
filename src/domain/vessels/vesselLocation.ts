import type { VesselLocation as VesselLocationDottie } from "ws-dottie/wsf-vessels";
import type { ConvexVesselLocation } from "../../../convex/functions/vesselLocation/schemas";
import type { DateFieldsToDate } from "../transformers";
import { toDomain, toStorage } from "../transformers";

// Re-export the inferred type from convex with domain-appropriate naming

// Define date fields as a const array - TypeScript will infer the union type
const DATE_FIELDS = [
  "LeftDock",
  "Eta",
  "ScheduledDeparture",
  "TimeStamp",
] as const;

// Extract the union type from the const array
type VesselLocationDateFields = (typeof DATE_FIELDS)[number];

/**
 * Domain model for vessel location with Dates and nullable fields.
 * Generated from storage type with proper null handling and Date objects
 */
export type VesselLocation = DateFieldsToDate<
  ConvexVesselLocation,
  VesselLocationDateFields
>;

/**
 * Converts a raw ws-dottie VesselLocation into the domain shape.
 * Drops unused metadata fields and flattens OpRouteAbbrev to a single value.
 */
// export const toVesselLocation = (vl: VesselLocationDottie): VesselLocation => {
//   const {
//     VesselWatchShutID,
//     VesselWatchShutMsg,
//     VesselWatchShutFlag,
//     VesselWatchStatus,
//     VesselWatchMsg,
//     ...rest
//   } = vl;

//   // Convert to domain type using the toDomain helper with date fields
//   const domainVesselLocation = toDomain(
//     rest,
//     DATE_FIELDS
//   ) as unknown as VesselLocation;

//   // Override OpRouteAbbrev to flatten the array
//   return {
//     ...domainVesselLocation,
//     OpRouteAbbrev: vl.OpRouteAbbrev?.[0] ?? null,
//   };
// };

/**
 * Convert storage representation (Convex) to domain representation.
 */
export const fromConvexVesselLocation = (
  convexVesselLocation: ConvexVesselLocation
): VesselLocation =>
  toDomain(convexVesselLocation, DATE_FIELDS) as unknown as VesselLocation;

/**
 * Convert domain representation to storage representation (Convex).
 */
// export const toConvexVesselLocation = (
//   vesselLocation: VesselLocation
// ): ConvexVesselLocation =>
//   toStorage(vesselLocation, DATE_FIELDS) as unknown as ConvexVesselLocation;
