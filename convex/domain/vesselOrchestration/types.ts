/**
 * Input, dependency, and result types for the vessel orchestrator tick pipeline.
 */

import type {
  ProcessVesselTripsOptions,
  TickEventWrites,
  VesselTripsTickResult,
} from "domain/vesselTrips";
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
 * Injected effect adapters for persistence and trip/timeline processing.
 * Implementations live in the functions layer and close over `ActionCtx`.
 */
export type VesselOrchestratorTickDeps = {
  persistLocations: (
    locations: ReadonlyArray<ConvexVesselLocation>
  ) => Promise<void>;
  processVesselTrips: (
    locations: ReadonlyArray<ConvexVesselLocation>,
    tickStartedAt: number,
    activeTrips: ReadonlyArray<TickActiveTrip>,
    options: ProcessVesselTripsOptions
  ) => Promise<VesselTripsTickResult>;
  applyTickEventWrites: (writes: TickEventWrites) => Promise<void>;
};

/**
 * Public action result envelope for `updateVesselOrchestrator`.
 */
export type VesselOrchestratorTickResult = {
  locationsSuccess: boolean;
  tripsSuccess: boolean;
  errors?: {
    fetch?: { message: string; stack?: string };
    locations?: { message: string; stack?: string };
    trips?: { message: string; stack?: string };
  };
};
