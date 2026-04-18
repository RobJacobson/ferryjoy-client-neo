/**
 * Convex-facing input and result types for the vessel orchestrator tick pipeline
 * (`executeVesselOrchestratorTick`, `updateVesselOrchestrator`).
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";

/**
 * Normalized inputs for one orchestrator tick after fetch and conversion.
 */
export type VesselOrchestratorTickInput = {
  convexLocations: ReadonlyArray<ConvexVesselLocation>;
  passengerTerminalAbbrevs: ReadonlySet<string>;
  tickStartedAt: number;
  activeTrips: ReadonlyArray<TickActiveTrip>;
};

/**
 * Per-branch wall times (milliseconds) for one tick, for ops / structured logs.
 * Missing fields mean that step did not complete (e.g. earlier throw).
 */
export type VesselOrchestratorTickMetrics = {
  /** `persistLocations` / updateVesselLocations */
  persistLocationsMs?: number;
  /** `processVesselTrips` / updateVesselTrips */
  processVesselTripsMs?: number;
  /** `applyTickEventWrites` / updateTimeline */
  applyTickEventWritesMs?: number;
};

/**
 * Public action result envelope for `updateVesselOrchestrator`.
 */
export type VesselOrchestratorTickResult = {
  locationsSuccess: boolean;
  tripsSuccess: boolean;
  /**
   * Per-branch wall times; populated by {@link executeVesselOrchestratorTick} for
   * completed branches.
   */
  tickMetrics: VesselOrchestratorTickMetrics;
  errors?: {
    fetch?: { message: string; stack?: string };
    locations?: { message: string; stack?: string };
    trips?: { message: string; stack?: string };
  };
};

/**
 * Return type for `updateVesselOrchestrator` when the tick completes. Read-model
 * or WSF failures **throw** (same as other actions).
 */
export type UpdateVesselOrchestratorResult = VesselOrchestratorTickResult;
