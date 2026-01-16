import { internalAction } from "_generated/server";
import { runUpdateVesselTrips } from "functions/vesselTrips/updates";

/**
 * Update (upsert) active vessel trips from the latest vessel locations.
 *
 * This action is the "realtime synchronizer" between:
 * - **WSF vessel locations** (frequent updates, sometimes incomplete)
 * - **Active vessel trips** (our canonical, enriched, prediction-ready view)
 *
 * It handles three primary cases per vessel:
 * - **First sighting**: no active trip exists yet → create one from the location.
 * - **New trip**: departing terminal changed → complete existing trip and start a
 *   new one.
 * - **Update**: same trip → apply field diffs and perform enrichments.
 *
 * Scheduled trip enrichment is *lazy* and keyed: we compute a composite trip key
 * (vessel + date/time + terminals) and periodically look up the corresponding
 * `ScheduledTrip` doc to copy a snapshot onto the trip.
 *
 * @returns Promise that resolves once all vessels have been processed.
 */
export const updateVesselTrips = internalAction({
  args: {},
  handler: runUpdateVesselTrips,
});
