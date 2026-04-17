/**
 * Input, dependency, and result types for the vessel orchestrator tick pipeline.
 */

import type {
  ProcessVesselTripsOptions,
  VesselTripsTickResult,
} from "domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";
import type { TimelineTickProjectionInput } from "./updateTimeline";

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
 * Injected effect adapters for persistence and trip/timeline processing.
 * Implementations live in the functions layer and close over `ActionCtx`.
 *
 * Four concerns (`architecture.md` §10): **updateVesselLocations**,
 * **updateVesselTrips** (includes **updateVesselPredictions** / `applyVesselPredictions`
 * on the build path), **updateTimeline**.
 */
export type VesselOrchestratorTickDeps = {
  /**
   * **updateVesselLocations** — persist the live vessel location snapshot for
   * this tick.
   */
  persistLocations: (
    locations: ReadonlyArray<ConvexVesselLocation>
  ) => Promise<void>;
  /**
   * **updateVesselTrips** — active/completed trip mutations, event detection, and
   * `buildTrip` / `applyVesselPredictions` (not a separate orchestrator branch).
   */
  processVesselTrips: (
    locations: ReadonlyArray<ConvexVesselLocation>,
    tickStartedAt: number,
    activeTrips: ReadonlyArray<TickActiveTrip>,
    options: ProcessVesselTripsOptions
  ) => Promise<VesselTripsTickResult>;
  /**
   * **updateTimeline** — apply `eventsActual` / `eventsPredicted` writes from
   * `tripResult.tickEventWrites` after the trip step.
   */
  applyTickEventWrites: (writes: TimelineTickProjectionInput) => Promise<void>;
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
  /** Per-branch wall times; always populated by `runVesselOrchestratorTick`. */
  tickMetrics: VesselOrchestratorTickMetrics;
  errors?: {
    fetch?: { message: string; stack?: string };
    locations?: { message: string; stack?: string };
    trips?: { message: string; stack?: string };
  };
};

/**
 * Return type for the `updateVesselOrchestrator` internal action. Reuses
 * {@link VesselOrchestratorTickResult} after a successful fetch; fetch failures
 * omit `tickMetrics` because the domain tick never runs.
 */
export type UpdateVesselOrchestratorResult =
  | VesselOrchestratorTickResult
  | {
      locationsSuccess: false;
      tripsSuccess: false;
      errors: {
        fetch: { message: string; stack?: string };
      };
    };
