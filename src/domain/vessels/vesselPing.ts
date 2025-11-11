import type {
  ConvexVesselPing,
  ConvexVesselPingCollection,
} from "../../../convex/functions/vesselPings/schemas";
import type { DateFieldsToDate } from "../transformers";

// Re-export the inferred types from convex with domain-appropriate naming
export type VesselPingCollection = ConvexVesselPingCollection;

// Define date fields as a const array - TypeScript will infer the union type
const DATE_FIELDS = ["TimeStamp"] as const;

// Extract the union type from the const array
type VesselPingDateFields = (typeof DATE_FIELDS)[number];

/**
 * Domain model for simplified vessel position snapshot.
 * Generated from storage type with proper null handling and Date objects
 */
export type VesselPing = DateFieldsToDate<
  ConvexVesselPing,
  VesselPingDateFields
>;

/**
 * Reduce a vessel location to a ping domain model.
 */
// export const vesselLocationToVesselPing = (
//   vl: WsDottieVesselLocation
// ): VesselPing => ({
//   VesselID: vl.VesselID,
//   Latitude: Math.round(vl.Latitude * 100000) / 100000,
//   Longitude: Math.round(vl.Longitude * 100000) / 100000,
//   Speed: vl.Speed,
//   Heading: vl.Heading,
//   AtDock: vl.AtDock,
//   TimeStamp: vl.TimeStamp,
// });

/**
 * Convert storage representation (Convex) to domain representation.
 */
// export const fromConvexVesselPing = (
//   convexVesselPing: ConvexVesselPing
// ): VesselPing =>
//   toDomain(convexVesselPing, DATE_FIELDS) as unknown as VesselPing;

/**
 * Convert Convex collection shape → array of domain vessel pings
 */
// export const fromConvexVesselPingCollection = (
//   collection: VesselPingCollection
// ): VesselPing[] => collection.pings.map(fromConvexVesselPing);
