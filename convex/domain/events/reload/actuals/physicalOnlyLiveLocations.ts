/**
 * Builds actual dock rows for physical-only active trips from live locations.
 *
 * Some active trips lack a schedule alignment, so the reload pipeline cannot
 * find their boundaries among hydrated schedule events. This module patches
 * dep and arv actuals straight from the latest vessel location ping when the
 * boundary is not already covered by another source.
 */

import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import {
  buildActualDockEventFromWrite,
  type ConvexActualDockWritePersistable,
} from "../../actual";
import type { ReloadTripForActuals } from "../types";
import { buildPhysicalOnlyTripPatch } from "./utils";

type PhysicalOnlyTripWithTripKey = ReloadTripForActuals & {
  TripKey: string;
};

/**
 * Builds physical-only actual dock rows from in-service vessel locations.
 *
 * Iterates each location, looks up the active physical-only trip for that
 * vessel, and emits dep or arv patches whose boundary is not yet represented
 * by the caller's existing row set. Persistable writes are normalized through
 * buildActualDockEventFromWrite so downstream upsert and dedupe see the same
 * eventsActual row shape as the rest of the reload payload.
 *
 * @param args.locations - Vessel locations pre-filtered to the sailing day
 * @param args.activeTripsByVesselAbbrev - Physical-only active trip index
 * @param args.representedTripBoundaryKeys - Boundaries already covered elsewhere
 * @param args.updatedAt - UpdatedAt stamp for the produced Convex rows
 * @returns Actual dock rows for physical-only boundaries from live evidence
 */
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

/**
 * Builds zero to two persistable patches for one vessel location.
 *
 * @param location - Latest vessel location ping
 * @param activeTripsByVesselAbbrev - Physical-only active trip index
 * @param representedTripBoundaryKeys - Boundaries already covered elsewhere
 * @returns Persistable dep and arv writes when the location supports them
 */
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

/**
 * Builds a dep-dock patch when the location shows the vessel left the dock.
 *
 * @param location - Latest vessel location ping
 * @param trip - Physical-only active trip with TripKey
 * @param representedTripBoundaryKeys - Boundaries already covered elsewhere
 * @returns Departure write or undefined when no patch is warranted
 */
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

/**
 * Builds an arv-dock patch when the location shows the vessel reached the dock.
 *
 * @param location - Latest vessel location ping
 * @param trip - Physical-only active trip with TripKey
 * @param representedTripBoundaryKeys - Boundaries already covered elsewhere
 * @returns Arrival write or undefined when no patch is warranted
 */
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

/**
 * Checks whether a trip boundary is already covered by some other actual row.
 *
 * @param tripKey - Physical trip identifier
 * @param eventType - Dock boundary discriminator
 * @param representedTripBoundaryKeys - Boundary set built from prior actuals
 * @returns True when the boundary is already represented
 */
const isBoundaryRepresented = (
  tripKey: string,
  eventType: DockEventType,
  representedTripBoundaryKeys: Set<string>
) => representedTripBoundaryKeys.has(`${tripKey}|${eventType}`);

export { buildPhysicalOnlyActualRows };
