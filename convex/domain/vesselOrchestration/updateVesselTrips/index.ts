/**
 * Public entry for **updateVesselTrips**.
 *
 * The supported public surface is intentionally small: one pure runner and its
 * input/output contract. Bundle/timeline types live on `shared/tickHandshake` and
 * are re-exported here for orchestrator imports that resolve through this module.
 */

export type {
  ActiveTripsBranch,
  PendingLeaveDockEffect,
  TripComputation,
  VesselTripsComputeBundle,
} from "domain/vesselOrchestration/shared";
export type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./contracts";
export type { TripEvents } from "./tripLifecycle/tripEventTypes";
export { runUpdateVesselTrips } from "./runUpdateVesselTrips";
