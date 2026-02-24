/**
 * VesselTrips updates module.
 *
 * Synchronizes vessel trips with live location data using build-then-compare:
 * constructs full intended state per tick, writes only when different from existing.
 */

export { runUpdateVesselTrips } from "./updateVesselTrips";
