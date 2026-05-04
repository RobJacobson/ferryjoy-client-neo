/**
 * Reconciles live vessel locations into actual dock-event writes.
 *
 * The helpers in this module use scheduled boundary rows only as stable anchors
 * for actual-event persistence. They do not build presentation timeline state.
 */

import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import { groupBy } from "../../../shared/groupBy";
import { buildBoundaryKey, buildSegmentKey } from "../../../shared/keys";
import { getSailingDay } from "../../../shared/time";
import type { DockEventType } from "../scheduled";
import {
  getBoundaryTime,
  getSegmentKeyFromBoundaryKey,
  sortScheduledDockEvents,
} from "../scheduled/scheduledSegmentResolvers";
import type { ConvexScheduledDockEvent } from "../scheduled/schemas";
import {
  type ActiveTripForPhysicalActualReconcile,
  enrichActualDockWritesWithTripContext,
  type TripContextForActualRow,
} from "./bindActualRowsToTrips";
import type {
  ConvexActualDockEvent,
  ConvexActualDockWrite,
  ConvexActualDockWritePersistable,
} from "./schemas";

const MOVING_SPEED_THRESHOLD = 0.2;
const DOCKED_SPEED_THRESHOLD = 0.2;

type VesselEventsByAbbrev<T extends { VesselAbbrev: string }> = Map<
  string,
  T[]
>;

type VesselLocationScheduledEventsBundle = {
  location: ConvexVesselLocation;
  vesselScheduledEvents: ConvexScheduledDockEvent[];
};

export type ReconcileActualDockWritesFromLocationsArgs = {
  sailingDay: string;
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  vesselLocations: ConvexVesselLocation[];
  tripBySegmentKey?: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev?: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
};

export type LocationReconcileBoundaryEvent = {
  SegmentKey: string;
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
  EventOccurred?: true;
  EventActualTime?: number;
};

/**
 * Builds the ordered boundary rows needed for live-location
 * reconciliation.
 *
 * @param args.scheduledEvents - Scheduled boundary rows for one vessel/day
 * @param args.actualEvents - Existing actual boundary rows for that vessel/day
 * @returns Scheduled boundaries with matching occurrence state attached
 */
export const buildLocationReconcileBoundaryEvents = ({
  scheduledEvents,
  actualEvents,
}: {
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
}): LocationReconcileBoundaryEvent[] => {
  const sortedScheduledEvents = [...scheduledEvents].sort(
    sortScheduledDockEvents
  );
  const exactActualByScheduleKey = buildExactActualLookup(actualEvents);
  const arrivalActualByScheduledKey = buildArrivalActualLookup(
    sortedScheduledEvents,
    actualEvents,
    exactActualByScheduleKey
  );

  return sortedScheduledEvents.map((event) => {
    const actualRow =
      exactActualByScheduleKey.get(scheduledActualLookupKey(event)) ??
      arrivalActualByScheduledKey.get(event.Key);

    return {
      SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventType: event.EventType,
      EventScheduledTime: event.EventScheduledTime,
      EventOccurred:
        actualRow?.EventOccurred ??
        (actualRow?.EventActualTime !== undefined ? true : undefined),
      EventActualTime: actualRow?.EventActualTime,
    };
  });
};

/**
 * Builds a lookup for exact schedule-aligned actual rows.
 *
 * @param actualEvents - Existing actual boundary rows
 * @returns First actual row for each schedule segment and event type
 */
const buildExactActualLookup = (actualEvents: ConvexActualDockEvent[]) => {
  const actualByScheduleKeyAndType = new Map<string, ConvexActualDockEvent>();

  for (const actual of actualEvents) {
    if (!actual.ScheduleKey) {
      continue;
    }

    const key = actualLookupKey(actual.ScheduleKey, actual.EventType);
    if (!actualByScheduleKeyAndType.has(key)) {
      actualByScheduleKeyAndType.set(key, actual);
    }
  }

  return actualByScheduleKeyAndType;
};

/**
 * Builds fallback arrival matches for schedule-aligned actual rows that were
 * stored under a stale boundary key.
 *
 * @param scheduledEvents - Ordered scheduled boundary rows
 * @param actualEvents - Existing actual boundary rows
 * @param exactActualByScheduleKey - Exact actual lookup
 * @returns Arrival actual rows keyed by scheduled boundary key
 */
const buildArrivalActualLookup = (
  scheduledEvents: ConvexScheduledDockEvent[],
  actualEvents: ConvexActualDockEvent[],
  exactActualByScheduleKey: Map<string, ConvexActualDockEvent>
) => {
  const scheduleKeyedArrivalActuals = actualEvents
    .filter(
      (event): event is ConvexActualDockEvent & { EventActualTime: number } =>
        event.EventType === "arv-dock" &&
        event.EventActualTime !== undefined &&
        event.ScheduleKey !== undefined
    )
    .sort(
      (left, right) =>
        left.EventActualTime - right.EventActualTime ||
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.EventKey.localeCompare(right.EventKey)
    );

  const assignedArrivalActualByScheduledKey = new Map<
    string,
    ConvexActualDockEvent
  >();
  const usedActualArrivalEventKeys = new Set<string>();

  for (const event of scheduledEvents) {
    if (event.EventType !== "arv-dock") {
      continue;
    }

    const direct = exactActualByScheduleKey.get(
      scheduledActualLookupKey(event)
    );
    if (!direct) {
      continue;
    }

    assignedArrivalActualByScheduledKey.set(event.Key, direct);
    usedActualArrivalEventKeys.add(direct.EventKey);
  }

  assignSameDepartureArrivalActuals(
    scheduledEvents,
    scheduleKeyedArrivalActuals,
    assignedArrivalActualByScheduledKey,
    usedActualArrivalEventKeys
  );
  assignOrderedArrivalActuals(
    scheduledEvents,
    scheduleKeyedArrivalActuals,
    assignedArrivalActualByScheduledKey,
    usedActualArrivalEventKeys
  );

  return assignedArrivalActualByScheduledKey;
};

/**
 * Attaches stale-key arrival actuals that still share terminal and scheduled
 * departure with a scheduled arrival.
 *
 * @param scheduledEvents - Ordered scheduled boundary rows
 * @param arrivalActuals - Schedule-aligned arrival actual rows
 * @param assignedArrivalActualByScheduledKey - Mutable assigned-arrival map
 * @param usedActualArrivalEventKeys - Mutable consumed actual-key set
 * @returns Nothing
 */
const assignSameDepartureArrivalActuals = (
  scheduledEvents: ConvexScheduledDockEvent[],
  arrivalActuals: Array<ConvexActualDockEvent & { EventActualTime: number }>,
  assignedArrivalActualByScheduledKey: Map<string, ConvexActualDockEvent>,
  usedActualArrivalEventKeys: Set<string>
) => {
  for (const event of scheduledEvents) {
    if (
      event.EventType !== "arv-dock" ||
      assignedArrivalActualByScheduledKey.has(event.Key)
    ) {
      continue;
    }

    const anchored = arrivalActuals.find(
      (actual) =>
        !usedActualArrivalEventKeys.has(actual.EventKey) &&
        actual.TerminalAbbrev === event.TerminalAbbrev &&
        actual.ScheduledDeparture === event.ScheduledDeparture
    );

    if (!anchored) {
      continue;
    }

    assignedArrivalActualByScheduledKey.set(event.Key, anchored);
    usedActualArrivalEventKeys.add(anchored.EventKey);
  }
};

/**
 * Attaches remaining stale-key arrival actuals in terminal order.
 *
 * @param scheduledEvents - Ordered scheduled boundary rows
 * @param arrivalActuals - Schedule-aligned arrival actual rows
 * @param assignedArrivalActualByScheduledKey - Mutable assigned-arrival map
 * @param usedActualArrivalEventKeys - Mutable consumed actual-key set
 * @returns Nothing
 */
const assignOrderedArrivalActuals = (
  scheduledEvents: ConvexScheduledDockEvent[],
  arrivalActuals: Array<ConvexActualDockEvent & { EventActualTime: number }>,
  assignedArrivalActualByScheduledKey: Map<string, ConvexActualDockEvent>,
  usedActualArrivalEventKeys: Set<string>
) => {
  const scheduledArrivalEventsByTerminal = groupBy(
    scheduledEvents.filter((event) => event.EventType === "arv-dock"),
    (event) => event.TerminalAbbrev
  );

  for (const [
    terminalAbbrev,
    terminalArrivalEvents,
  ] of scheduledArrivalEventsByTerminal) {
    let previousAssignedArrivalActualTime: number | undefined;

    for (let index = 0; index < terminalArrivalEvents.length; index += 1) {
      const event = terminalArrivalEvents[index];
      const existing = assignedArrivalActualByScheduledKey.get(event.Key);

      if (existing?.EventActualTime !== undefined) {
        previousAssignedArrivalActualTime = existing.EventActualTime;
        continue;
      }

      const candidate = arrivalActuals.find(
        (actual) =>
          !usedActualArrivalEventKeys.has(actual.EventKey) &&
          actual.TerminalAbbrev === terminalAbbrev &&
          (previousAssignedArrivalActualTime === undefined ||
            actual.EventActualTime > previousAssignedArrivalActualTime)
      );

      if (!candidate) {
        continue;
      }

      const nextEquivalentArrival = terminalArrivalEvents[index + 1];
      if (
        nextEquivalentArrival &&
        candidate.EventActualTime > getBoundaryTime(nextEquivalentArrival)
      ) {
        continue;
      }

      assignedArrivalActualByScheduledKey.set(event.Key, candidate);
      usedActualArrivalEventKeys.add(candidate.EventKey);
      previousAssignedArrivalActualTime = candidate.EventActualTime;
    }
  }
};

const scheduledActualLookupKey = (event: ConvexScheduledDockEvent) =>
  actualLookupKey(getSegmentKeyFromBoundaryKey(event.Key), event.EventType);

const actualLookupKey = (
  scheduleSegment: string,
  eventType: ConvexScheduledDockEvent["EventType"]
) => `${scheduleSegment}|${eventType}`;

/**
 * Builds sparse patches from one live location tick against an ordered
 * vessel/day event list.
 *
 * @param events - Timeline events already merged for the vessel/day slice
 * @param location - Live vessel-location tick to reconcile against the slice
 * @returns Sparse actual-boundary patches inferred from that live tick
 */
export const buildActualDockWritesFromLocation = (
  events: LocationReconcileBoundaryEvent[],
  location: ConvexVesselLocation
): ConvexActualDockWrite[] => {
  if (events.length === 0 || location.InService !== true) {
    return [];
  }

  const { departureEvent, resolvedArrivalEvent } =
    resolveLocationBoundaryEvents(events, location);

  return [
    buildDepartureActualPatchFromLocation(location, departureEvent),
    buildArrivalActualPatchFromLocation(location, resolvedArrivalEvent),
  ].filter((patch): patch is ConvexActualDockWrite => patch !== undefined);
};

/**
 * Collects sparse actual-boundary patches for one sailing day from live
 * locations and the candidate scheduled/actual tables.
 *
 * @param args - Scheduled, actual, live-location, and trip-context inputs for
 * one sailing day
 * @returns Persistable actual-boundary patches for schedule-aligned and
 * physical-only reconciliation
 */
export const reconcileActualDockWritesFromLocations = ({
  sailingDay,
  scheduledEvents,
  actualEvents,
  vesselLocations,
  tripBySegmentKey = new Map(),
  activeTripsByVesselAbbrev = new Map(),
}: ReconcileActualDockWritesFromLocationsArgs): ConvexActualDockWritePersistable[] => {
  const scheduledByVessel = groupBy(scheduledEvents, (e) => e.VesselAbbrev);
  const actualByVessel = groupBy(actualEvents, (e) => e.VesselAbbrev);

  const scheduleAligned = vesselLocations
    .map(attachScheduledEventsByVessel(scheduledByVessel))
    .filter(locationBundleMatchesSailingDay(sailingDay))
    .filter(hasScheduledEvents)
    .flatMap(actualDockWritesFromLocationBundle(actualByVessel));

  const scheduleAlignedWithTripContext = enrichActualDockWritesWithTripContext(
    scheduleAligned,
    tripBySegmentKey
  );
  const representedTripBoundaryKeys = new Set(
    [
      ...actualEvents,
      ...scheduleAlignedWithTripContext.map((patch) => ({
        TripKey: patch.TripKey,
        EventType: patch.EventType,
      })),
    ].map((row) => `${row.TripKey}|${row.EventType}`)
  );

  const scheduleless = vesselLocations
    .filter(locationMatchesSailingDay(sailingDay))
    .flatMap((location) =>
      buildPhysicalOnlyPatchesFromLocation(
        location,
        activeTripsByVesselAbbrev,
        representedTripBoundaryKeys
      )
    );

  return [...scheduleAlignedWithTripContext, ...scheduleless];
};

/**
 * Attaches the scheduled events for a vessel to one live location row.
 *
 * @param scheduledByVessel - Scheduled boundary events grouped by vessel
 * @returns Mapper that pairs a location with its candidate scheduled events
 */
const attachScheduledEventsByVessel =
  (scheduledByVessel: VesselEventsByAbbrev<ConvexScheduledDockEvent>) =>
  (location: ConvexVesselLocation): VesselLocationScheduledEventsBundle => ({
    location,
    vesselScheduledEvents: scheduledByVessel.get(location.VesselAbbrev) ?? [],
  });

/**
 * Narrows a location-and-events bundle to the requested sailing day.
 *
 * @param sailingDay - Sailing day being reconciled
 * @returns Predicate for bundle-level sailing-day filtering
 */
const locationBundleMatchesSailingDay =
  (sailingDay: string) =>
  ({ location }: VesselLocationScheduledEventsBundle) =>
    locationMatchesSailingDay(sailingDay)(location);

/**
 * Checks whether a live location belongs to the requested sailing day.
 *
 * @param sailingDay - Sailing day being reconciled
 * @returns Predicate for location-level sailing-day filtering
 */
const locationMatchesSailingDay =
  (sailingDay: string) => (location: ConvexVesselLocation) =>
    getSailingDay(
      new Date(location.ScheduledDeparture ?? location.TimeStamp)
    ) === sailingDay;

/**
 * Checks whether a location bundle has any scheduled events to reconcile.
 *
 * @param bundle - Location plus attached scheduled events
 * @returns `true` when the bundle has at least one scheduled event
 */
const hasScheduledEvents = ({
  vesselScheduledEvents,
}: VesselLocationScheduledEventsBundle) => vesselScheduledEvents.length > 0;

/**
 * Reconciles one location bundle against scheduled and actual event rows.
 *
 * @param actualByVessel - Actual boundary events grouped by vessel
 * @returns Mapper that produces sparse patches for one location bundle
 */
const actualDockWritesFromLocationBundle =
  (actualByVessel: VesselEventsByAbbrev<ConvexActualDockEvent>) =>
  ({ location, vesselScheduledEvents }: VesselLocationScheduledEventsBundle) =>
    buildActualDockWritesFromLocation(
      buildLocationReconcileBoundaryEvents({
        scheduledEvents: vesselScheduledEvents,
        actualEvents: actualByVessel.get(location.VesselAbbrev) ?? [],
      }),
      location
    );

const getEventByKey = (events: LocationReconcileBoundaryEvent[], Key: string) =>
  events.find((event) => event.Key === Key);

const canConfirmDepartureFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  event.EventOccurred !== true &&
  (location.LeftDock !== undefined || strongDeparture(location));

const canConfirmArrivalFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  event.EventOccurred !== true &&
  strongArrival(location);

const buildDepartureActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  event && canConfirmDepartureFromLocation(location, event)
    ? sparseActualDockWriteFromEvent(event, location.LeftDock)
    : undefined;

const buildArrivalActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  event && canConfirmArrivalFromLocation(location, event)
    ? sparseActualDockWriteFromEvent(event, undefined)
    : undefined;

const sparseActualDockWriteFromEvent = (
  event: LocationReconcileBoundaryEvent,
  EventActualTime: number | undefined
): ConvexActualDockWrite => ({
  SegmentKey: event.SegmentKey,
  VesselAbbrev: event.VesselAbbrev,
  SailingDay: event.SailingDay,
  ScheduledDeparture: event.ScheduledDeparture,
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
  EventOccurred: true,
  EventActualTime,
});

const resolveLocationBoundaryEvents = (
  events: LocationReconcileBoundaryEvent[],
  location: ConvexVesselLocation
) => {
  const departureEvent = getLocationAnchoredEvent(events, location, "dep-dock");
  const anchoredArrivalEvent = getLocationAnchoredEvent(
    events,
    location,
    "arv-dock"
  );

  return {
    departureEvent,
    anchoredArrivalEvent,
    resolvedArrivalEvent: findArrivalEventForLocation(
      events,
      location,
      departureEvent
    ),
  };
};

const getLocationAnchoredEvent = (
  events: LocationReconcileBoundaryEvent[],
  location: ConvexVesselLocation,
  eventType: DockEventType
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
      const keyedEvent = getEventByKey(
        events,
        buildBoundaryKey(segmentKey, eventType)
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

const strongDeparture = (location: ConvexVesselLocation) =>
  location.AtDock === false && location.Speed >= MOVING_SPEED_THRESHOLD;

const strongArrival = (location: ConvexVesselLocation) =>
  location.AtDock === true && location.Speed < DOCKED_SPEED_THRESHOLD;

const buildPhysicalOnlyPatchesFromLocation = (
  location: ConvexVesselLocation,
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >,
  representedTripBoundaryKeys: Set<string>
): ConvexActualDockWritePersistable[] => {
  if (location.InService !== true) {
    return [];
  }

  const trip = activeTripsByVesselAbbrev.get(location.VesselAbbrev);
  if (!trip || trip.ScheduleKey !== undefined) {
    return [];
  }

  const patches: ConvexActualDockWritePersistable[] = [];

  if (
    !representedTripBoundaryKeys.has(`${trip.TripKey}|dep-dock`) &&
    strongDeparture(location)
  ) {
    patches.push({
      TripKey: trip.TripKey,
      ScheduleKey: undefined,
      VesselAbbrev: trip.VesselAbbrev,
      ...(trip.SailingDay !== undefined ? { SailingDay: trip.SailingDay } : {}),
      ...(trip.ScheduledDeparture !== undefined
        ? { ScheduledDeparture: trip.ScheduledDeparture }
        : {}),
      TerminalAbbrev: trip.DepartingTerminalAbbrev,
      EventType: "dep-dock",
      EventOccurred: true,
      EventActualTime: location.LeftDock ?? location.TimeStamp,
    });
  }

  if (
    !representedTripBoundaryKeys.has(`${trip.TripKey}|arv-dock`) &&
    strongArrival(location) &&
    trip.ArrivingTerminalAbbrev !== undefined
  ) {
    patches.push({
      TripKey: trip.TripKey,
      ScheduleKey: undefined,
      VesselAbbrev: trip.VesselAbbrev,
      ...(trip.SailingDay !== undefined ? { SailingDay: trip.SailingDay } : {}),
      ...(trip.ScheduledDeparture !== undefined
        ? { ScheduledDeparture: trip.ScheduledDeparture }
        : {}),
      TerminalAbbrev: trip.ArrivingTerminalAbbrev,
      EventType: "arv-dock",
      EventOccurred: true,
      EventActualTime: location.TimeStamp,
    });
  }

  return patches;
};

const findArrivalEventForLocation = (
  events: LocationReconcileBoundaryEvent[],
  location: ConvexVesselLocation,
  departureEvent: LocationReconcileBoundaryEvent | undefined
) => {
  const anchoredArrivalEvent = findAnchoredArrivalEvent(
    events,
    location,
    departureEvent
  );

  if (location.ScheduledDeparture !== undefined) {
    return anchoredArrivalEvent &&
      anchoredArrivalEvent.EventOccurred !== true &&
      arrivalEligibilityTime(anchoredArrivalEvent) <= location.TimeStamp
      ? anchoredArrivalEvent
      : undefined;
  }

  if (anchoredArrivalEvent) {
    return anchoredArrivalEvent.EventOccurred !== true &&
      arrivalEligibilityTime(anchoredArrivalEvent) <= location.TimeStamp
      ? anchoredArrivalEvent
      : undefined;
  }

  return [...events]
    .filter(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        event.EventOccurred !== true &&
        arrivalEligibilityTime(event) <= location.TimeStamp
    )
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];
};

const findAnchoredArrivalEvent = (
  events: LocationReconcileBoundaryEvent[],
  location: ConvexVesselLocation,
  departureEvent: LocationReconcileBoundaryEvent | undefined
) => {
  const scheduledDepartureUpperBound =
    departureEvent?.ScheduledDeparture ?? location.ScheduledDeparture;

  if (scheduledDepartureUpperBound === undefined) {
    return undefined;
  }

  return [...events]
    .filter(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        event.ScheduledDeparture < scheduledDepartureUpperBound
    )
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];
};

/**
 * Computes the earliest timestamp when a scheduled arrival may be treated as
 * eligible for live confirmation.
 *
 * @param event - Candidate arrival boundary
 * @returns Earliest safe timestamp for confirming that arrival
 */
const arrivalEligibilityTime = (event: LocationReconcileBoundaryEvent) =>
  Math.min(
    event.ScheduledDeparture,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );
