import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";
import type { ResolvedCurrentTripFields } from "./types";

/**
 * Builds resolved current-trip fields from authoritative WSF feed values.
 *
 * @param location - Location row with complete WSF trip fields
 * @returns Resolved current-trip fields tagged as WSF-sourced
 */
export const getTripFieldsFromWsf = (
  location: Pick<
    ConvexVesselLocation,
    | "VesselAbbrev"
    | "DepartingTerminalAbbrev"
    | "ArrivingTerminalAbbrev"
    | "ScheduledDeparture"
    | "ScheduleKey"
  >
): ResolvedCurrentTripFields => {
  // `tripFieldDataSource: "wsf"` is the durable semantic contract for this
  // row, even if `ScheduleKey` is synthesized locally from the authoritative
  // WSF destination/departure pair.
  const identity = deriveTripIdentity({
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
    scheduledDepartureMs: location.ScheduledDeparture,
  });

  return {
    ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
    ScheduledDeparture: location.ScheduledDeparture,
    ScheduleKey: location.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay,
    tripFieldDataSource: "wsf",
  };
};
