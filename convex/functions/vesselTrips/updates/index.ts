/**
 * VesselTrips updates module.
 *
 * Synchronizes vessel trips with live location data using build-then-compare:
 * constructs full intended state per tick, writes only when different from existing.
 *
 * Stage 5: this file is the public barrel — re-exports the tick entrypoint only.
 * Implementation modules live under `tripLifecycle/`, `projection/`, and `processTick/`.
 */

export { processVesselTrips } from "./processTick/processVesselTrips";
