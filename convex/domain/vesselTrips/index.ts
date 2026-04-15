/**
 * Vessel-trip lifecycle domain: tick orchestration, trip building, and projection.
 *
 * Prefer `functions/vesselTrips/updates` for the default-wired `processVesselTrips`
 * entrypoint. Use `processVesselTripsWithDeps` from `./processTick/processVesselTrips`
 * in tests when injecting dependencies.
 */

export type { ProcessVesselTripsOptions } from "./processTick/processVesselTrips";
export type { VesselTripsTickResult } from "./processTick/tickEnvelope";
export type { TickEventWrites } from "./processTick/tickEventWrites";
export { computeShouldRunPredictionFallback } from "./processTick/tickPredictionPolicy";
export { stripTripPredictionsForStorage } from "./tripLifecycle/stripTripPredictionsForStorage";
export type { VesselTripsBuildTripAdapters } from "./vesselTripsBuildTripAdapters";
