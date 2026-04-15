/**
 * Functions-layer wrapper: wires default `buildTripAdapters` for vessel-trip processing.
 */

import type { ActionCtx } from "_generated/server";
import {
  type ProcessVesselTripsDeps,
  type ProcessVesselTripsOptions,
  processVesselTripsWithDeps,
} from "domain/vesselTrips/processTick/processVesselTrips";
import { buildCompletedTrip } from "domain/vesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTrip } from "domain/vesselTrips/tripLifecycle/buildTrip";
import { detectTripEvents } from "domain/vesselTrips/tripLifecycle/detectTripEvents";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";
import { appendFinalSchedule } from "../tripLifecycle/appendSchedule";
import { resolveEffectiveLocation } from "../tripLifecycle/resolveEffectiveLocation";

const DEFAULT_PROCESS_VESSEL_TRIPS_DEPS: ProcessVesselTripsDeps = {
  buildCompletedTrip,
  buildTrip,
  detectTripEvents,
  buildTripAdapters: {
    resolveEffectiveLocation,
    appendFinalSchedule,
  },
};

export type { ProcessVesselTripsDeps, ProcessVesselTripsOptions };

/**
 * Process vessel trips for one orchestrator tick.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process after orchestrator conversion
 * @param tickStartedAt - Tick timestamp owned by VesselOrchestrator
 * @param activeTrips - When **defined** (including an empty array), skips
 *   `getActiveTrips` and uses that snapshot—`[]` means “no active trips loaded
 *   this tick,” not “fall back to the query.” When `undefined`, loads via
 *   `getActiveTrips` (hydrated). Minimum element shape is storage-native
 *   {@link TickActiveTrip}; {@link ConvexVesselTrip} (hydrated) remains accepted
 *   for transitional callers.
 * @param options - Optional; `shouldRunPredictionFallback` defaults from tick time
 * @returns Lifecycle result plus tick event writes for `applyTickEventWrites`
 */
export const processVesselTrips = async (
  ctx: ActionCtx,
  locations: ConvexVesselLocation[],
  tickStartedAt: number,
  activeTrips?: ReadonlyArray<TickActiveTrip>,
  options?: ProcessVesselTripsOptions
) =>
  processVesselTripsWithDeps(
    ctx,
    locations,
    tickStartedAt,
    DEFAULT_PROCESS_VESSEL_TRIPS_DEPS,
    activeTrips,
    options
  );

export { processVesselTripsWithDeps };
