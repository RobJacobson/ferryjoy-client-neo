/**
 * Stage A vessel-location runner: normalize already-fetched WSF rows into the
 * canonical vessel-location rows for the orchestrator.
 */

import {
  assertAtLeastOneVesselLocationConverted,
  mapDottieVesselLocationsToConvex,
} from "adapters";
import type {
  RunUpdateVesselLocationsInput,
  RunUpdateVesselLocationsOutput,
} from "./contracts";

/**
 * Stage A canonical runner for vessel-location normalization.
 *
 * The functions layer still owns the external WSF fetch and persistence. This
 * concern freezes the domain-facing normalization contract only.
 */
export const runUpdateVesselLocations = async (
  input: RunUpdateVesselLocationsInput
): Promise<RunUpdateVesselLocationsOutput> => {
  const vesselLocations = mapDottieVesselLocationsToConvex(
    input.rawFeedLocations,
    input.vesselsIdentity,
    input.terminalsIdentity
  );

  assertAtLeastOneVesselLocationConverted(
    input.rawFeedLocations.length,
    vesselLocations
  );

  return {
    vesselLocations,
  };
};
