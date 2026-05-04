export {
  type ActualDockEvent,
  toDomainActualDockEvent,
} from "convex/functions/events/eventsActual/schemas";
export {
  type PredictedDockEvent,
  toDomainPredictedDockEvent,
} from "convex/functions/events/eventsPredicted/schemas";
export {
  type ScheduledDockEvent,
  toDomainScheduledDockEvent,
} from "convex/functions/events/eventsScheduled/schemas";
export {
  type ScheduledTrip,
  toDomainScheduledTrip,
} from "convex/functions/scheduledTrips/schemas";
export {
  toDomainVesselLocation,
  type VesselLocation,
} from "convex/functions/vesselLocation/schemas";
export {
  type ConvexVesselPing,
  toDomainVesselPing,
  type VesselPing,
} from "convex/functions/vesselPings/schemas";
export {
  toDomainVesselTrip,
  toDomainVesselTripWithScheduledTrip,
  type VesselTrip,
  type VesselTripWithScheduledTrip,
} from "convex/functions/vesselTrips/schemas";
export type { TerminalIdentity as Terminal } from "functions/terminals/schemas";
export type { TerminalTopology } from "functions/terminalsTopology/schemas";
export type { VesselIdentity as Vessel } from "functions/vessels/schemas";
