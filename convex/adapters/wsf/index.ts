/**
 * Public WSF adapter surface for backend consumers outside this folder.
 */

export type { TerminalIdentity } from "functions/terminalIdentities/schemas";
export type { VesselIdentity } from "functions/vesselIdentities/schemas";
export {
  buildTerminalTopologyRows,
  buildWsfTerminalsTopology,
} from "./buildTerminalsTopologyFromSchedule";
export {
  fetchWsfTerminalIdentities,
  mergeKnownMarineLocations,
} from "./fetchTerminalIdentities";
export {
  fetchWsfTerminalsAndMates,
  type WsfTerminalMatePair,
} from "./fetchTerminalsAndMates";
export { fetchWsfVesselIdentities } from "./fetchVesselIdentities";
export {
  fetchWsfVesselLocations,
  toConvexVesselLocation,
} from "./fetchVesselLocations";
export { fetchInServiceWsfVesselPings } from "./fetchVesselPings";
export { resolveScheduleSegment } from "./resolveScheduleSegment";
export {
  resolveTerminalByAbbrev,
  resolveTerminalById,
  resolveTerminalByName,
} from "./resolveTerminal";
export { resolveVessel, tryResolveVessel } from "./resolveVessel";
export { resolveVesselHistory } from "./resolveVesselHistory";
