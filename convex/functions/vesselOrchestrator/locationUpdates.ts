/**
 * Shared vessel-location update computation for the orchestrator.
 *
 * The production action and focused test helpers both need the same
 * normalize-and-dedupe logic, so this module keeps that work out of the
 * hot-path action file without introducing another persistence boundary.
 */

import type { Id } from "_generated/dataModel";
import { fetchRawWsfVesselLocations } from "adapters";
import type { Infer } from "convex/values";
import { computeVesselLocationRows } from "domain/vesselOrchestration/updateVesselLocations";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  storedVesselLocationSchema,
  VesselLocationUpdates,
} from "functions/vesselOrchestrator/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";

type StoredVesselLocation = Infer<typeof storedVesselLocationSchema>;
export type ChangedLocationWrite = {
  vesselLocation: ConvexVesselLocation;
  existingLocationId?: Id<"vesselLocations">;
};

type LoadVesselLocationUpdatesArgs = {
  pingStartedAt: number;
  storedLocations: ReadonlyArray<StoredVesselLocation>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
};

/**
 * Fetches live vessel locations from WSF and compares them to stored rows.
 *
 * @param args - Ping timestamp, identity tables, and stored location rows
 * @returns Full location rows annotated with change state and existing ids
 */
export const loadVesselLocationUpdates = async ({
  pingStartedAt,
  storedLocations,
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
  const storedLocationsByVessel = new Map(
    storedLocations.map((row) => [row.VesselAbbrev, row] as const)
  );

  return vesselLocations.map((vesselLocation) => {
    const existingLocation = storedLocationsByVessel.get(
      vesselLocation.VesselAbbrev
    );

    return {
      vesselLocation,
      existingLocationId: existingLocation?._id,
      locationChanged: existingLocation?.TimeStamp !== vesselLocation.TimeStamp,
    };
  });
};

/**
 * Extracts changed location writes for the orchestrator persistence mutation.
 *
 * @param locationUpdates - Changed location updates for the ping
 * @returns Changed rows plus optional existing document ids
 */
export const buildChangedLocationWrites = (
  locationUpdates: ReadonlyArray<VesselLocationUpdates>
): ReadonlyArray<ChangedLocationWrite> =>
  locationUpdates.map((update) => ({
    vesselLocation: update.vesselLocation,
    existingLocationId: update.existingLocationId,
  }));
