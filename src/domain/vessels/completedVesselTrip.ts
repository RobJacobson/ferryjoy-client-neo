import type { ConvexCompletedVesselTrip } from "../../../convex/functions/completedVesselTrips/schemas";
import type { DateFieldsToDate } from "../transformers";
import { toDomain } from "../transformers";

// Re-export the inferred type from convex with domain-appropriate naming

// Define date fields as a const array - TypeScript will infer the union type
const DATE_FIELDS = [
  "ScheduledDeparture",
  "LeftDock",
  "LeftDockActual",
  "Eta",
  "TimeStamp",
  "TripStart",
  "TripEnd",
] as const;

// Extract the union type from the const array
type CompletedVesselTripDateFields = (typeof DATE_FIELDS)[number];

/**
 * Completed trip domain model with guaranteed values for completion metrics.
 * Generated from storage type with proper null handling and Date objects
 */
export type CompletedVesselTrip = DateFieldsToDate<
  ConvexCompletedVesselTrip,
  CompletedVesselTripDateFields
> & {
  Key: string;
  TripStart: Date;
  TripEnd: Date;
  LeftDockActual: Date;
  LeftDockDelay: number | null;
  AtDockDuration: number;
  AtSeaDuration: number;
  TotalDuration: number;
};

/**
 * Convert storage representation (Convex) to domain representation.
 */
export const fromConvexCompletedVesselTrip = (
  convexCompletedVesselTrip: ConvexCompletedVesselTrip
): CompletedVesselTrip =>
  toDomain(
    convexCompletedVesselTrip,
    DATE_FIELDS
  ) as unknown as CompletedVesselTrip;
