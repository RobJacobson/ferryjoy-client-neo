import type { ConvexActiveVesselTrip } from "../../../convex/functions/activeVesselTrips/schemas";
import type { DateFieldsToDate } from "../transformers";

// Re-export the inferred type from convex with domain-appropriate naming

// Define date fields as a const array - TypeScript will infer the union type
const DATE_FIELDS = [
  "ScheduledDeparture",
  "LeftDock",
  "LeftDockActual",
  "Eta",
  "TimeStamp",
  "TripStart",
] as const;

/**
 * Domain type generated from storage type with proper null handling and Date objects
 */
export type ActiveVesselTrip = DateFieldsToDate<
  ConvexActiveVesselTrip,
  (typeof DATE_FIELDS)[number]
>;

/**
 * Convert storage representation (Convex) to domain representation.
 */
// export const fromConvexActiveVesselTrip = (
//   convexActiveVesselTrip: ConvexActiveVesselTrip
// ): ActiveVesselTrip =>
//   toDomain(convexActiveVesselTrip, DATE_FIELDS) as unknown as ActiveVesselTrip;

// /**
//  * Convert domain representation to storage representation (Convex).
//  */
// export const toConvexActiveVesselTrip = (
//   activeVesselTrip: ActiveVesselTrip
// ): ConvexActiveVesselTrip =>
//   toStorage(activeVesselTrip, DATE_FIELDS) as unknown as ConvexActiveVesselTrip;
