/**
 * Barrel for the orchestrator location ingestion pipeline.
 *
 * `runUpdateVesselLocations` performs the WSF fetch, normalization, and
 * `bulkUpsertVesselLocations` call for one ping.
 */

export type { RunUpdateVesselLocationsResult } from "./run";
export { runUpdateVesselLocations } from "./run";
