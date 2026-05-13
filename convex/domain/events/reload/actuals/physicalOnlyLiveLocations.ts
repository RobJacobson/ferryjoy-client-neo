import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  buildActualDockEventFromWrite,
  type ConvexActualDockWritePersistable,
} from "../../actual";
import type { ActiveTripForPhysicalActualReconcile } from "../types";
import { buildTripBoundaryKey } from "./liveLocationBoundaryKeys";

type PhysicalOnlyTripWithTripKey = ActiveTripForPhysicalActualReconcile & {
  TripKey: string;
};

const buildPhysicalOnlyActualRows = ({
  locations,
  activeTripsByVesselAbbrev,
  representedTripBoundaryKeys,
  updatedAt,
}: {
  locations: ConvexVesselLocation[];
  activeTripsByVesselAbbrev: Map<string, PhysicalOnlyTripWithTripKey>;
  representedTripBoundaryKeys: Set<string>;
  updatedAt: number;
}): ConvexActualDockEvent[] =>
  locations
    .flatMap((location) =>
      buildPhysicalOnlyPatchesFromLocation(
        location,
        activeTripsByVesselAbbrev,
        representedTripBoundaryKeys
      )
    )
    .map((write) => buildActualDockEventFromWrite(write, updatedAt));

const buildPhysicalOnlyPatchesFromLocation = (
  location: ConvexVesselLocation,
  activeTripsByVesselAbbrev: Map<string, PhysicalOnlyTripWithTripKey>,
  representedTripBoundaryKeys: Set<string>
): ConvexActualDockWritePersistable[] => {
  const trip = activeTripsByVesselAbbrev.get(location.VesselAbbrev);

  if (
    location.InService !== true ||
    trip === undefined ||
    trip.ScheduleKey !== undefined
  ) {
    return [];
  }

  return [
    maybeBuildPhysicalOnlyDeparturePatch(
      location,
      trip,
      representedTripBoundaryKeys
    ),
    maybeBuildPhysicalOnlyArrivalPatch(
      location,
      trip,
      representedTripBoundaryKeys
    ),
  ].filter(
    (patch): patch is ConvexActualDockWritePersistable => patch !== undefined
  );
};

const maybeBuildPhysicalOnlyDeparturePatch = (
  location: ConvexVesselLocation,
  trip: PhysicalOnlyTripWithTripKey,
  representedTripBoundaryKeys: Set<string>
): ConvexActualDockWritePersistable | undefined => {
  if (
    location.AtDock !== false ||
    isBoundaryRepresented(trip.TripKey, "dep-dock", representedTripBoundaryKeys)
  ) {
    return undefined;
  }

  return buildPhysicalOnlyTripPatch(
    trip,
    trip.DepartingTerminalAbbrev,
    "dep-dock",
    location.LeftDock ?? location.TimeStamp
  );
};

const maybeBuildPhysicalOnlyArrivalPatch = (
  location: ConvexVesselLocation,
  trip: PhysicalOnlyTripWithTripKey,
  representedTripBoundaryKeys: Set<string>
): ConvexActualDockWritePersistable | undefined => {
  if (
    location.AtDock !== true ||
    trip.ArrivingTerminalAbbrev === undefined ||
    isBoundaryRepresented(trip.TripKey, "arv-dock", representedTripBoundaryKeys)
  ) {
    return undefined;
  }

  return buildPhysicalOnlyTripPatch(
    trip,
    trip.ArrivingTerminalAbbrev,
    "arv-dock",
    location.TimeStamp
  );
};

const isBoundaryRepresented = (
  tripKey: string,
  eventType: DockEventType,
  representedTripBoundaryKeys: Set<string>
) => representedTripBoundaryKeys.has(buildTripBoundaryKey(tripKey, eventType));

const buildPhysicalOnlyTripPatch = (
  trip: PhysicalOnlyTripWithTripKey,
  terminalAbbrev: string,
  eventType: DockEventType,
  eventActualTime: number
): ConvexActualDockWritePersistable => ({
  TripKey: trip.TripKey,
  VesselAbbrev: trip.VesselAbbrev,
  SailingDay: trip.SailingDay,
  ScheduledDeparture: trip.ScheduledDeparture,
  TerminalAbbrev: terminalAbbrev,
  EventType: eventType,
  EventOccurred: true,
  EventActualTime: eventActualTime,
});

export { buildPhysicalOnlyActualRows };
