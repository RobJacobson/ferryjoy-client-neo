/**
 * Canonical Stage A public contracts for the vessel-location concern.
 */

import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocationIncoming } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { VesselLocation as WsfVesselLocation } from "ws-dottie/wsf-vessels/core";

/**
 * Canonical Stage A contract for the vessel-location normalization pipeline.
 *
 * This boundary is intentionally plain-data only. It freezes the public surface
 * without forcing the fetch adapter split in Stage A.
 */
export type RunUpdateVesselLocationsInput = {
  rawFeedLocations: ReadonlyArray<WsfVesselLocation>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
};

/**
 * Canonical normalized row emitted by `updateVesselLocations`.
 */
export type VesselLocationRow = ConvexVesselLocationIncoming;

export type RunUpdateVesselLocationsOutput = {
  vesselLocations: VesselLocationRow[];
};
