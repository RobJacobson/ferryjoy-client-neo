/**
 * Reconciles live vessel locations into sparse actual dock writes during reload.
 */

import type { DockEventType } from "functions/events/common/schemas";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import {
  buildActualDockEventFromWrite,
  type ConvexActualDockWritePersistable,
} from "../actual";
import { groupBy } from "./collections";
import type {
  ActiveTripForPhysicalActualReconcile,
  DockStatusEventRecord,
  ReloadActualDockWrite,
  TripContextForActualRow,
} from "./types";

/**
 * Builds persisted actual rows from locations when history missed schedule rows.
 *
 * Runs two sibling builders in sequence over the same sailing-day-filtered
 * locations: first schedule-aligned rows that match a known boundary record,
 * then physical-only rows for boundaries that neither schedule alignment nor
 * the caller's base rows already cover.
 *
 * @param args.sailingDay - Target sailing day string
 * @param args.events - Normalized boundary records for correlation
 * @param args.actualRows - Base actual rows from schedule and physical trips
 * @param args.updatedAt - UpdatedAt stamp for new Convex rows
 * @param args.vesselLocations - Latest pings for matching
 * @param args.tripBySegmentKey - TripKey lookup by segment key
 * @param args.activeTripsByVesselAbbrev - Physical-only active trips
 * @returns Extra actual rows to merge into the sailing day reload payload
 */
const buildLiveLocationActualRows = ({
  sailingDay,
  events,
  actualRows,
  updatedAt,
  vesselLocations,
  tripBySegmentKey,
  activeTripsByVesselAbbrev,
}: {
  sailingDay: string;
  events: DockStatusEventRecord[];
  actualRows: ConvexActualDockEvent[];
  updatedAt: number;
  vesselLocations: ConvexVesselLocation[];
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
}): ConvexActualDockEvent[] => {
  // Share one pre-filtered slice so both builders read the same input.
  const sailingDayLocations = vesselLocations.filter(
    locationMatchesSailingDay(sailingDay)
  );

  // Run schedule alignment first so its rows anchor the fallback's dedupe set.
  const scheduleAligned = buildScheduleAlignedActualRows({
    locations: sailingDayLocations,
    events,
    tripBySegmentKey,
    updatedAt,
  });

  // Build the dedupe horizon so the fallback skips already-covered boundaries.
  const representedTripBoundaryKeys = buildTripBoundaryKeySet([
    ...actualRows,
    ...scheduleAligned,
  ]);

  // Backfill from physical-only trips for boundaries schedule alignment missed.
  const physicalOnly = buildPhysicalOnlyActualRows({
    locations: sailingDayLocations,
    activeTripsByVesselAbbrev,
    representedTripBoundaryKeys,
    updatedAt,
  });

  // Return both sources; the represented-set guard keeps them non-overlapping.
  return [...scheduleAligned, ...physicalOnly];
};

/**
 * Builds actual rows for locations whose dep or arv evidence aligns with a
 * known boundary record and resolves through the segment trip index.
 *
 * For each sailing-day location, emits zero, one, or two writes per matched
 * boundary record, drops writes whose SegmentKey does not resolve to a TripKey,
 * then materializes the survivors as Convex actual rows.
 *
 * @param args.locations - Locations pre-filtered to the target sailing day
 * @param args.events - Normalized boundary records for correlation
 * @param args.tripBySegmentKey - TripKey lookup by segment key
 * @param args.updatedAt - UpdatedAt stamp for new Convex rows
 * @returns Materialized actual rows for schedule-aligned boundaries
 */
const buildScheduleAlignedActualRows = ({
  locations,
  events,
  tripBySegmentKey,
  updatedAt,
}: {
  locations: ConvexVesselLocation[];
  events: DockStatusEventRecord[];
  tripBySegmentKey: Map<string, TripContextForActualRow>;
  updatedAt: number;
}): ConvexActualDockEvent[] => {
  const eventsByVessel = groupBy(events, (event) => event.VesselAbbrev);

  return locations
    .flatMap((location) =>
      buildActualDockWritesFromLocation(
        eventsByVessel.get(location.VesselAbbrev) ?? [],
        location
      )
    )
    .map((write) => attachTripKeyFromSegment(write, tripBySegmentKey))
    .filter(
      (write): write is ConvexActualDockWritePersistable => write !== null
    )
    .map((write) => buildActualDockEventFromWrite(write, updatedAt));
};

/**
 * Builds actual rows for physical-only trips whose dep or arv boundaries are
 * not yet represented by schedule-aligned or base rows.
 *
 * @param args.locations - Locations pre-filtered to the target sailing day
 * @param args.activeTripsByVesselAbbrev - Physical-only active trips by vessel
 * @param args.representedTripBoundaryKeys - TripKey|EventType pairs already covered
 * @param args.updatedAt - UpdatedAt stamp for new Convex rows
 * @returns Materialized actual rows for unrepresented physical-only boundaries
 */
const buildPhysicalOnlyActualRows = ({
  locations,
  activeTripsByVesselAbbrev,
  representedTripBoundaryKeys,
  updatedAt,
}: {
  locations: ConvexVesselLocation[];
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
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
 * Resolves a write's SegmentKey to a TripKey, enriching the write when found.
 *
 * @param write - Sparse actual dock write from schedule-aligned matching
 * @param tripBySegmentKey - TripKey lookup by segment key
 * @returns Persistable write with TripKey attached, or null when unresolved
 */
const attachTripKeyFromSegment = (
  write: ReloadActualDockWrite,
  tripBySegmentKey: Map<string, TripContextForActualRow>
): ConvexActualDockWritePersistable | null => {
  const trip = write.SegmentKey
    ? tripBySegmentKey.get(write.SegmentKey)
    : undefined;

  if (!trip?.TripKey) {
    return null;
  }

  return { ...write, TripKey: trip.TripKey };
};

/**
 * Builds the dedupe set of TripKey|EventType pairs already represented by the
 * given rows, used to suppress duplicate physical-only emissions.
 *
 * @param rows - Rows whose TripKey and EventType define the represented set
 * @returns Set of compound TripKey|EventType keys
 */
const buildTripBoundaryKeySet = (
  rows: ReadonlyArray<{ TripKey: string; EventType: DockEventType }>
): Set<string> =>
  new Set(rows.map((row) => buildTripBoundaryKey(row.TripKey, row.EventType)));

const locationMatchesSailingDay =
  (sailingDay: string) => (location: ConvexVesselLocation) =>
    getSailingDay(
      new Date(location.ScheduledDeparture ?? location.TimeStamp)
    ) === sailingDay;

const arrivalEligibilityTime = (event: DockStatusEventRecord) =>
  Math.min(
    event.ScheduledDeparture,
    event.EventPredictedTime ?? Number.POSITIVE_INFINITY,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );

const getLocationAnchoredEvent = (
  events: DockStatusEventRecord[],
  location: ConvexVesselLocation,
  eventType: DockStatusEventRecord["EventType"]
) => {
  if (location.ScheduledDeparture === undefined) {
    return undefined;
  }

  if (location.ArrivingTerminalAbbrev) {
    const segmentKey = buildSegmentKey(
      location.VesselAbbrev,
      location.DepartingTerminalAbbrev,
      location.ArrivingTerminalAbbrev,
      new Date(location.ScheduledDeparture)
    );

    if (segmentKey) {
      const keyedEvent = events.find(
        (event) => event.Key === buildBoundaryKey(segmentKey, eventType)
      );

      if (keyedEvent) {
        return keyedEvent;
      }
    }
  }

  return events.find(
    (event) =>
      event.VesselAbbrev === location.VesselAbbrev &&
      event.EventType === eventType &&
      event.ScheduledDeparture === location.ScheduledDeparture &&
      (eventType === "arv-dock" ||
        event.TerminalAbbrev === location.DepartingTerminalAbbrev)
  );
};

const findArrivalEventForLocation = (
  events: DockStatusEventRecord[],
  location: ConvexVesselLocation,
  departureEvent: DockStatusEventRecord | undefined
) => {
  const scheduledDepartureUpperBound =
    departureEvent?.ScheduledDeparture ?? location.ScheduledDeparture;

  if (scheduledDepartureUpperBound === undefined) {
    return undefined;
  }

  const candidate = [...events]
    .filter(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        event.ScheduledDeparture < scheduledDepartureUpperBound &&
        event.EventOccurred !== true &&
        arrivalEligibilityTime(event) <= location.TimeStamp
    )
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];

  return candidate;
};

const buildActualWriteFromLocation = (
  location: ConvexVesselLocation,
  event: DockStatusEventRecord | undefined,
  EventActualTime: number | undefined
): ReloadActualDockWrite | undefined => {
  if (
    event === undefined ||
    event.EventOccurred === true ||
    (event.EventType === "dep-dock" &&
      location.LeftDock === undefined &&
      location.AtDock !== false) ||
    (event.EventType === "arv-dock" && location.AtDock !== true)
  ) {
    return undefined;
  }

  return {
    SegmentKey: event.SegmentKey,
    VesselAbbrev: event.VesselAbbrev,
    SailingDay: event.SailingDay,
    ScheduledDeparture: event.ScheduledDeparture,
    TerminalAbbrev: event.TerminalAbbrev,
    EventType: event.EventType,
    EventOccurred: true,
    EventActualTime,
  };
};

const buildActualDockWritesFromLocation = (
  events: DockStatusEventRecord[],
  location: ConvexVesselLocation
): ReloadActualDockWrite[] => {
  if (events.length === 0 || location.InService !== true) {
    return [];
  }

  const departureEvent = getLocationAnchoredEvent(events, location, "dep-dock");
  const arrivalEvent = findArrivalEventForLocation(
    events,
    location,
    departureEvent
  );

  return [
    buildActualWriteFromLocation(location, departureEvent, location.LeftDock),
    buildActualWriteFromLocation(location, arrivalEvent, undefined),
  ].filter((write): write is ReloadActualDockWrite => write !== undefined);
};

/**
 * Builds dep and arv patches for one physical-only trip from a live location.
 *
 * Skips boundaries that already appear in the represented set, and only emits
 * a boundary when the location's AtDock state matches that boundary direction.
 *
 * @param location - Latest vessel ping for one vessel
 * @param activeTripsByVesselAbbrev - Physical-only active trips by vessel
 * @param representedTripBoundaryKeys - TripKey|EventType pairs already covered
 * @returns Zero to two persistable actual dock writes
 */
const buildPhysicalOnlyPatchesFromLocation = (
  location: ConvexVesselLocation,
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >,
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

  const isBoundaryUnrepresented = (eventType: DockEventType) =>
    !representedTripBoundaryKeys.has(
      buildTripBoundaryKey(trip.TripKey, eventType)
    );

  return [
    isBoundaryUnrepresented("dep-dock") && location.AtDock === false
      ? buildPhysicalOnlyTripPatch(
          trip,
          trip.DepartingTerminalAbbrev,
          "dep-dock",
          location.LeftDock ?? location.TimeStamp
        )
      : null,
    isBoundaryUnrepresented("arv-dock") &&
    location.AtDock === true &&
    trip.ArrivingTerminalAbbrev !== undefined
      ? buildPhysicalOnlyTripPatch(
          trip,
          trip.ArrivingTerminalAbbrev,
          "arv-dock",
          location.TimeStamp
        )
      : null,
  ].filter(
    (patch): patch is ConvexActualDockWritePersistable => patch !== null
  );
};

/**
 * Builds the dedupe key that pairs a TripKey with one boundary event type.
 *
 * Live reconciliation uses this to recognize which dep or arv boundaries are
 * already represented by schedule-aligned or history rows so it does not emit
 * duplicate physical-only patches. Pipe separator avoids collisions with the
 * dash separator used by buildBoundaryKey for SegmentKey-based event keys.
 *
 * @param tripKey - Stable trip identity from active or completed trip rows
 * @param eventType - dep-dock or arv-dock discriminator
 * @returns Compound dedupe key in TripKey|EventType form
 */
const buildTripBoundaryKey = (tripKey: string, eventType: DockEventType) =>
  `${tripKey}|${eventType}`;

/**
 * Builds one physical-only trip patch for a dep or arv boundary.
 *
 * @param trip - Physical-only active trip with TripKey
 * @param terminalAbbrev - Terminal for this dep or arv row
 * @param eventType - dep-dock or arv-dock
 * @param eventActualTime - Observed time in epoch ms
 * @returns Persistable actual dock write carrying shared trip identity
 */
const buildPhysicalOnlyTripPatch = (
  trip: ActiveTripForPhysicalActualReconcile & { TripKey: string },
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

export { buildLiveLocationActualRows };
