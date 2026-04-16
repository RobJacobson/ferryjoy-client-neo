/**
 * Vessel-trip lifecycle domain: tick orchestration, trip building, and projection.
 *
 * Production callers pair `processVesselTripsWithDeps` with boundary adapters
 * from `adapters/vesselTrips/processTick`. Tests can inject their own
 * dependencies directly.
 */

export type { ProcessVesselTripsOptions } from "./processTick/processVesselTrips";
export type { VesselTripsTickResult } from "./processTick/tickEnvelope";
export type { TickEventWrites } from "./processTick/tickEventWrites";
export { computeShouldRunPredictionFallback } from "./processTick/tickPredictionPolicy";
export { stripTripPredictionsForStorage } from "./tripLifecycle/stripTripPredictionsForStorage";
export type { VesselTripsBuildTripAdapters } from "./vesselTripsBuildTripAdapters";
