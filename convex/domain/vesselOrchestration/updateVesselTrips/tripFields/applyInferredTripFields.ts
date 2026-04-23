import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { InferredTripFields } from "./types";

export const applyInferredTripFields = <
  TLocation extends Pick<
    ConvexVesselLocation,
    | "ArrivingTerminalAbbrev"
    | "ScheduledDeparture"
    | "ScheduleKey"
  >,
>(
  location: TLocation,
  inferredTripFields: Pick<
    InferredTripFields,
    "ArrivingTerminalAbbrev" | "ScheduledDeparture" | "ScheduleKey"
  >
): TLocation => ({
  ...location,
  ArrivingTerminalAbbrev:
    inferredTripFields.ArrivingTerminalAbbrev ??
    location.ArrivingTerminalAbbrev,
  ScheduledDeparture:
    inferredTripFields.ScheduledDeparture ?? location.ScheduledDeparture,
  ScheduleKey: inferredTripFields.ScheduleKey ?? location.ScheduleKey,
});
