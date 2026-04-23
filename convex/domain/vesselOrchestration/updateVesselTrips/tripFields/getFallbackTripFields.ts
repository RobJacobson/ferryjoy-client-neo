import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";
import type { ResolvedCurrentTripFields } from "./types";

/**
 * Preserve any direct WSF values that exist. When WSF remains incomplete for
 * the same dock interval, reuse already-known trip fields so the provisional
 * state stays stable without claiming a fresh schedule match.
 *
 * The durable source contract is semantic, not storage-location-based:
 * reusing persisted provisional fields still yields `tripFieldDataSource:
 * "inferred"`, while deriving a `ScheduleKey` from direct WSF destination +
 * departure fields remains `tripFieldDataSource: "wsf"`.
 *
 * Next-leg schedule fields are not part of this contract; they are attached
 * later in `attachNextScheduledTripFields`.
 *
 * @param location - Raw location for this ping
 * @param existingTrip - Prior trip row for same-dock reuse, when present
 * @returns Resolved current-trip fields for incomplete-feed cases
 */
export const getFallbackTripFields = ({
  location,
  existingTrip,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
}): ResolvedCurrentTripFields => {
  const shouldReuseExistingTripFields = isSameDockWindowReuseCandidate(
    location,
    existingTrip
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
    // `resolveCurrentTripFields` only reaches this helper after confirming
    // the feed is incomplete, so the resolved row remains non-authoritative
    // even when we preserve partial WSF values instead of reusing persisted
    // provisional ones.
    tripFieldDataSource: "inferred",
  };
};

const isSameDockWindowReuseCandidate = (
  location: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): boolean =>
  Boolean(
    location.AtDock &&
      location.LeftDock === undefined &&
      existingTrip?.AtDock &&
      existingTrip.LeftDock === undefined &&
      existingTrip.DepartingTerminalAbbrev === location.DepartingTerminalAbbrev
  );
