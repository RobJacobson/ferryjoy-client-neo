import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import type { ResolvedCurrentTripFields } from "./types";

/** Ping used only after the WSF-complete guard (destination + scheduled departure). */
export type WsfCompleteSchedulePing = ConvexVesselLocation & {
  ScheduledDeparture: number;
  ArrivingTerminalAbbrev: string;
};

/**
 * Builds resolved current-trip fields from authoritative WSF feed values.
 *
 * @param location - Ping with `ScheduledDeparture` and `ArrivingTerminalAbbrev`
 *   set (WSF-complete guard); same shape as `ConvexVesselLocation` with those
 *   fields required. Callers must use the WSF-complete schedule branch guard.
 * @returns Schedule-only resolved fields (canonical {@link buildSegmentKey},
 *   {@link getSailingDay}, source). Destination and departure stay on the ping;
 *   callers merge them into `resolution.current` when applying to a trip row.
 */
export const getTripFieldsFromWsf = (
  location: WsfCompleteSchedulePing
): ResolvedCurrentTripFields => {
  const departureDate = new Date(location.ScheduledDeparture);
  return {
    ScheduleKey: buildSegmentKey(
      location.VesselAbbrev,
      location.DepartingTerminalAbbrev,
      location.ArrivingTerminalAbbrev,
      departureDate
    ),
    SailingDay: getSailingDay(departureDate),
    tripFieldResolutionMethod: "wsfRealtimeFields",
  };
};
