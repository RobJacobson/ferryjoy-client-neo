/**
 * Shared vessel-location update computation for the vessel orchestrator.
 *
 * Fetches and normalizes the WSF feed into `ConvexVesselLocation` rows for one
 * ping. The orchestrator action writes these rows through
 * `bulkUpsertVesselLocations`, which dedupes against DB state in mutation code.
 */

import { fetchRawWsfVesselLocations } from "adapters";
import { mapWsfVesselLocations } from "domain/vesselOrchestration/updateVesselLocations/mapWsfVesselLocations";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";

type LoadVesselLocationUpdatesArgs = {
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
};

/**
 * Fetches live vessel locations from WSF and normalizes them for this ping.
 *
 * @param args - Identity tables for feed resolution
 * @returns One update per normalized vessel location for trip compute and persist
 */
export const loadVesselLocationUpdates = async ({
  terminalsIdentity,
  vesselsIdentity,
}: LoadVesselLocationUpdatesArgs): Promise<
  ReadonlyArray<ConvexVesselLocation>
> => {
  const rawFeedLocations = await fetchRawWsfVesselLocations();
  const vesselLocations = mapWsfVesselLocations(
    rawFeedLocations,
    vesselsIdentity,
    terminalsIdentity
  );

  return vesselLocations;
};
