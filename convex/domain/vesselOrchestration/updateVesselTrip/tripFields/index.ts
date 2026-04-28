export {
  attachNextScheduledTripFields,
  resolveTripFieldsForTripRow,
  resolveTripScheduleFields,
} from "./resolveTripFieldsForTripRow";
export type { ResolvedTripScheduleFields } from "./resolveTripFieldsForTripRow";
export type {
  TripFieldInferenceLogContext,
} from "./tripFieldDiagnostics";
export {
  buildTripFieldInferenceMessage,
  getTripFieldInferenceLog,
} from "./tripFieldDiagnostics";
