/**
 * Public adapter surface for WSF integration: fetch, resolve, and pipelines.
 */

export type { TerminalIdentity } from "functions/terminalIdentities/schemas";
export type { VesselIdentity } from "functions/vesselIdentities/schemas";
export {
  downloadRawWsfScheduleData,
  fetchActiveRoutes,
  fetchRouteSchedule,
} from "./fetch/fetchWsfScheduledTripsData";
export type {
  RawWsfRouteScheduleData,
  RawWsfScheduleSegment,
  VesselSailing,
} from "./fetch/fetchWsfScheduledTripsTypes";
export {
  fetchWsfTerminalIdentities,
  mergeKnownMarineLocations,
} from "./fetch/fetchWsfTerminalIdentities";
export {
  fetchWsfTerminalsAndMates,
  type WsfTerminalMatePair,
} from "./fetch/fetchWsfTerminalsAndMates";
export { fetchWsfVesselIdentities } from "./fetch/fetchWsfVesselIdentities";
export {
  fetchWsfVesselLocations,
  toConvexVesselLocation,
} from "./fetch/fetchWsfVesselLocations";
export { fetchInServiceWsfVesselPings } from "./fetch/fetchWsfVesselPings";
export {
  buildTerminalTopologyRows,
  buildWsfTerminalsTopology,
} from "./pipelines/buildWsfTerminalsTopology";
export { fetchAndTransformScheduledTrips } from "./pipelines/fetchWsfScheduledTrips";
export { resolveScheduleSegment } from "./resolve/resolveWsfScheduleSegment";
export {
  resolveTerminalByAbbrev,
  resolveTerminalById,
  resolveTerminalByName,
} from "./resolve/resolveWsfTerminal";
export { resolveVessel, tryResolveVessel } from "./resolve/resolveWsfVessel";
export { resolveVesselHistory } from "./resolve/resolveWsfVesselHistory";
