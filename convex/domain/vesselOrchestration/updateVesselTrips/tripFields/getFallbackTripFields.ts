import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";
import type { InferredTripFields } from "./types";

/**
 * Preserve any direct WSF values that exist. When WSF remains incomplete for
 * the same dock interval, reuse already-known trip fields so the provisional
 * state stays stable without claiming a fresh schedule match.
 *
 * The durable source contract is semantic, not storage-location-based:
 * reusing persisted provisional fields still yields `tripFieldDataSource:
 * "inferred"`, while deriving a `ScheduleKey` from direct WSF destination +
 * departure fields remains `tripFieldDataSource: "wsf"`.
 */
export const getFallbackTripFields = ({
  location,
  existingTrip,
}: {
  location: Pick<
    ConvexVesselLocation,
    | "AtDock"
    | "LeftDock"
    | "VesselAbbrev"
    | "DepartingTerminalAbbrev"
    | "ArrivingTerminalAbbrev"
    | "ScheduledDeparture"
    | "ScheduleKey"
  >;
  existingTrip:
    | Pick<
        ConvexVesselTrip,
        | "AtDock"
        | "LeftDock"
        | "DepartingTerminalAbbrev"
        | "ArrivingTerminalAbbrev"
        | "ScheduledDeparture"
        | "ScheduleKey"
        | "SailingDay"
        | "NextScheduleKey"
        | "NextScheduledDeparture"
      >
    | undefined;
}): InferredTripFields => {
  const shouldReuseExistingTripFields = Boolean(
    location.AtDock &&
      location.LeftDock === undefined &&
      existingTrip?.AtDock &&
      existingTrip.LeftDock === undefined &&
      existingTrip.DepartingTerminalAbbrev === location.DepartingTerminalAbbrev
  );
  const arrivingTerminalAbbrev =
    location.ArrivingTerminalAbbrev ??
    (shouldReuseExistingTripFields
      ? existingTrip?.ArrivingTerminalAbbrev
      : undefined);
  const scheduledDeparture =
    location.ScheduledDeparture ??
    (shouldReuseExistingTripFields
      ? existingTrip?.ScheduledDeparture
      : undefined);
  const identity = deriveTripIdentity({
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDepartureMs: scheduledDeparture,
  });

  return {
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    ScheduledDeparture: scheduledDeparture,
    ScheduleKey:
      location.ScheduleKey ??
      (shouldReuseExistingTripFields ? existingTrip?.ScheduleKey : undefined) ??
      identity.ScheduleKey,
    SailingDay:
      identity.SailingDay ??
      (shouldReuseExistingTripFields ? existingTrip?.SailingDay : undefined),
    NextScheduleKey: shouldReuseExistingTripFields
      ? existingTrip?.NextScheduleKey
      : undefined,
    NextScheduledDeparture: shouldReuseExistingTripFields
      ? existingTrip?.NextScheduledDeparture
      : undefined,
    // `inferTripFieldsFromSchedule` only reaches this helper after confirming
    // the feed is incomplete, so the resolved row remains non-authoritative
    // even when we preserve partial WSF values instead of reusing persisted
    // provisional ones.
    tripFieldDataSource: "inferred",
  };
};
