/**
 * Public entry for **updateVesselTrip**.
 */

export { stripVesselTripPredictions } from "./stripTripPredictionsForStorage";
export {
  type CurrentTripDockEvents,
  currentTripDockEvents,
} from "./tripLifecycle";
export type {
  GetScheduleRolloverDockEventsArgs,
  ScheduleRolloverDockEvents,
  UpdateVesselTripDbAccess,
  VesselTripUpdate,
} from "./types";
export { updateVesselTrip } from "./updateVesselTrip";
