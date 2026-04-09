/**
 * VesselTrips updates module.
 *
 * Synchronizes vessel trips with live location data using build-then-compare:
 * constructs full intended state per tick, writes only when different from existing.
 *
 * Stage 5: this file is the public barrel — re-exports the tick entrypoint and types.
 * Implementation modules live under `tripLifecycle/`, `projection/`, and `processTick/`.
 */

export type { ProcessVesselTripsOptions } from "./processTick/processVesselTrips";
export { processVesselTrips } from "./processTick/processVesselTrips";
export type { VesselTripsTickResult } from "./processTick/tickEnvelope";
