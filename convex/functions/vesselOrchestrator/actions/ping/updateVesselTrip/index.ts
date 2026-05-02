/**
 * Barrel for `updateVesselTrip` schedule access wiring.
 *
 * Exposes `createUpdateVesselTripDbAccess`, built once per ping for the
 * per-vessel loop.
 */

export { createUpdateVesselTripDbAccess } from "./updateVesselTripDbAccess";
