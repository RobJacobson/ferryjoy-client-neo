/**
 * Stage B vessel-location runner: normalize already-fetched WSF rows into the
 * canonical vessel-location rows for the orchestrator.
 */

import type {
  RunUpdateVesselLocationsInput,
  RunUpdateVesselLocationsOutput,
} from "./contracts";
import { mapWsfVesselLocations } from "./mapWsfVesselLocations";

/**
 * Canonical runner for vessel-location normalization.
 *
 * The functions layer owns the external WSF fetch and persistence. This concern
 * owns normalization, enrichment, and batch validation for raw feed rows.
 *
 * @param input - Raw feed rows plus identity tables for canonical mapping
 * @returns Normalized vessel-location rows ready for persistence
 */
export const updateVesselLocations = (
  input: RunUpdateVesselLocationsInput
): RunUpdateVesselLocationsOutput => {
  const vesselLocations = mapWsfVesselLocations(
    input.rawFeedLocations,
    input.vesselsIdentity,
    input.terminalsIdentity
  );

  return {
    vesselLocations,
  };
};
