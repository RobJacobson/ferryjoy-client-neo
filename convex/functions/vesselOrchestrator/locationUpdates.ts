/**
 * Shared vessel-location update computation for the vessel orchestrator.
 *
 * Fetches and normalizes the WSF feed into `ConvexVesselLocation` rows for one
 * ping. Persistence compares against DB inside `performBulkUpsertVesselLocations`.
 */

import { fetchRawWsfVesselLocations } from "adapters";
import { computeVesselLocationRows } from "domain/vesselOrchestration/updateVesselLocations";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselLocationUpdates } from "functions/vesselOrchestrator/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";

type LoadVesselLocationUpdatesArgs = {
  pingStartedAt: number;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
};

/**
 * Fetches live vessel locations from WSF and normalizes them for this ping.
 *
 * @param args - Ping timestamp and identity tables for feed resolution
 * @returns One update per normalized vessel location for trip compute and persist
 */
export const loadVesselLocationUpdates = async ({
  pingStartedAt,
  terminalsIdentity,
  vesselsIdentity,
}: LoadVesselLocationUpdatesArgs): Promise<
  ReadonlyArray<VesselLocationUpdates>
> => {
  const rawFeedLocations = await fetchRawWsfVesselLocations();
  const { vesselLocations } = await computeVesselLocationRows({
    pingStartedAt,
    rawFeedLocations,
    vesselsIdentity,
    terminalsIdentity,
  });

  return vesselLocations.map((vesselLocation) => ({ vesselLocation }));
};

export const feedLocationsFromUpdates = (
  locationUpdates: ReadonlyArray<VesselLocationUpdates>
): ReadonlyArray<ConvexVesselLocation> =>
  locationUpdates.map((u) => u.vesselLocation);
