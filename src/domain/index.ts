export * from "./vesselAbbreviations";

/**
 * Domain types re-exported from Convex schemas
 *
 * This file provides a single import point for all domain types (with Date objects)
 * and conversion functions used in the frontend application. Types and functions are
 * re-exported from their respective Convex schema files where they are defined as
 * the single source of truth.
 */

export {
  toDomainVesselLocation,
  type VesselLocation,
} from "../../convex/functions/vesselLocation/schemas";
export {
  toDomainVesselPing,
  type VesselPing,
} from "../../convex/functions/vesselPings/schemas";
export {
  toDomainVesselTrip,
  type VesselTrip,
} from "../../convex/functions/vesselTrips/schemas";
