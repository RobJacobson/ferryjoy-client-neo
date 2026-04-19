/**
 * WSF vessel-location transport adapter.
 *
 * Fetches raw vessel locations from the WSDOT-backed WSF API and returns the
 * feed rows unchanged. Domain normalization and enrichment belong to
 * `updateVesselLocations`.
 */

import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";

/**
 * Fetches raw WSF vessel locations for one tick.
 *
 * @returns Raw vessel-location rows from the WSF feed
 * @throws Error when the WSF API returns no locations
 */
export const fetchRawWsfVesselLocations = async (): Promise<
  ReadonlyArray<DottieVesselLocation>
> => {
  const dottieVesselLocations = await fetchVesselLocations();

  if (dottieVesselLocations.length === 0) {
    throw new Error("No vessel locations received from WSF API");
  }

  return dottieVesselLocations;
};
