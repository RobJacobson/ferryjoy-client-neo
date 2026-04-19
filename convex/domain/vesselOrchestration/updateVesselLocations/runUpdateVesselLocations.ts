/**
 * Stage B vessel-location runner: normalize already-fetched WSF rows into the
 * canonical vessel-location rows for the orchestrator.
 */

import type {
  RunUpdateVesselLocationsInput,
  RunUpdateVesselLocationsOutput,
} from "./contracts";
import {
  assertUsableVesselLocationBatch,
  mapWsfVesselLocations,
} from "./mapWsfVesselLocations";

/**
 * Canonical runner for vessel-location normalization.
 *
 * The functions layer owns the external WSF fetch and persistence. This concern
 * owns normalization, enrichment, and batch validation for raw feed rows.
 */
export const runUpdateVesselLocations = async (
  input: RunUpdateVesselLocationsInput
): Promise<RunUpdateVesselLocationsOutput> => {
  const vesselLocations = mapWsfVesselLocations(
    input.rawFeedLocations,
    input.vesselsIdentity,
    input.terminalsIdentity
  );

  assertUsableVesselLocationBatch(
    input.rawFeedLocations.length,
    vesselLocations
  );

  return {
    vesselLocations,
  };
};
