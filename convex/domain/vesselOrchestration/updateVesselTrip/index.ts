/**
 * Public entry for **updateVesselTrip**.
 */

export { stripVesselTripPredictions } from "./stripTripPredictionsForStorage";
export {
  buildCompletionTripEvents,
  currentTripEvents,
  type TripLifecycleEventFlags,
} from "./tripLifecycle";
export type { UpdateVesselTripDbAccess, VesselTripUpdate } from "./types";
export { updateVesselTrip } from "./updateVesselTrip";
