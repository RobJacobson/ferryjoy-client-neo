export * from "./vesselAbbreviations";

/**
 * Domain types re-exported from Convex schemas
 *
 * This file provides a single import point for all domain types (with Date objects)
 * and conversion functions used in the frontend application. Types and functions are
 * re-exported from their respective Convex schema files where they are defined as
 * the single source of truth.
 */

// Domain types (with Date objects)
export type { ActiveVesselTrip } from "../../convex/functions/activeVesselTrips/schemas";
export { toDomainActiveVesselTrip } from "../../convex/functions/activeVesselTrips/schemas";
export type { CompletedVesselTrip } from "../../convex/functions/completedVesselTrips/schemas";
export { toDomainCompletedVesselTrip } from "../../convex/functions/completedVesselTrips/schemas";
export type { CurrentVesselLocation } from "../../convex/functions/currentVesselLocation/schemas";
export type { VesselLocation } from "../../convex/functions/vesselLocation/schemas";
// Domain conversion functions (convert from Convex storage format (numbers) to domain format (Dates))
export { toDomainVesselLocation } from "../../convex/functions/vesselLocation/schemas";
export type {
  VesselPing,
  VesselPingCollection,
} from "../../convex/functions/vesselPings/schemas";
export { toDomainVesselPing } from "../../convex/functions/vesselPings/schemas";
