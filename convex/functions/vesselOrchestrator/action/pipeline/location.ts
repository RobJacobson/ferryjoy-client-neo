/**
 * Shared vessel-location update computation for the vessel orchestrator.
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
 * Fetches and normalizes live WSF vessel locations for the current ping.
 *
 * This helper isolates the external-feed boundary from the orchestrator shell
 * so `action/actions.ts` can focus on sequencing rather than payload shaping.
 * It bridges adapters and domain mapping by taking identity rows from the
 * snapshot stage and producing canonical `ConvexVesselLocation` rows consumed
 * by location dedupe mutation logic. Keeping this step separate makes feed
 * normalization reusable and keeps WSF-specific concerns out of trip/timeline code.
 *
 * @param terminalsIdentity - Backend terminal rows used during normalization
 * @param vesselsIdentity - Backend vessel rows used during normalization
 * @returns Normalized location rows for downstream dedupe and trip staging
 */
export const loadVesselLocationUpdates = async ({
  terminalsIdentity,
  vesselsIdentity,
}: LoadVesselLocationUpdatesArgs): Promise<
  ReadonlyArray<ConvexVesselLocation>
> => {
  const rawFeedLocations = await fetchRawWsfVesselLocations();
  return mapWsfVesselLocations(
    rawFeedLocations,
    vesselsIdentity,
    terminalsIdentity
  );
};
