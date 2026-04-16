/**
 * Applies live vessel-location reconciliation for reseed row-slice assembly.
 */

import type {
  ConvexActualDockEvent,
  ConvexActualDockWrite,
  ConvexActualDockWritePersistable,
} from "../../functions/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "../../functions/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type {
  ConvexVesselTimelineEventRecord,
  VesselTimelineEventType,
} from "../../functions/vesselTimeline/schemas";
import { groupBy } from "../../shared/groupBy";
import { buildBoundaryKey, buildSegmentKey } from "../../shared/keys";
import { getSailingDay } from "../../shared/time";
import {
  type ActiveTripForPhysicalActualReconcile,
  enrichActualDockWritesWithTripContext,
  type TripContextForActualRow,
} from "../timelineRows";
import { mergeTimelineRows } from "../timelineRows/mergeTimelineRows";

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

export type BuildActualDockWritesForSailingDayArgs = {
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

/**
 * Builds sparse patches from one live location tick against an ordered
 * vessel/day event list.
 *
 * @param events - Timeline events already merged for the vessel/day slice
 * @param location - Live vessel-location tick to reconcile against the slice
 * @returns Sparse actual-boundary patches inferred from that live tick
 */
export const buildActualDockWritesFromLocation = (
  events: ConvexVesselTimelineEventRecord[],
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
export const buildActualDockWritesForSailingDay = ({
  sailingDay,
  scheduledEvents,
  actualEvents,
  vesselLocations,
  tripBySegmentKey = new Map(),
  activeTripsByVesselAbbrev = new Map(),
}: BuildActualDockWritesForSailingDayArgs): ConvexActualDockWritePersistable[] => {
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
 * Reconciles one location bundle against scheduled and actual timeline rows.
 *
 * @param actualByVessel - Actual boundary events grouped by vessel
 * @returns Mapper that produces sparse patches for one location bundle
 */
const actualDockWritesFromLocationBundle =
  (actualByVessel: VesselEventsByAbbrev<ConvexActualDockEvent>) =>
  ({ location, vesselScheduledEvents }: VesselLocationScheduledEventsBundle) =>
    buildActualDockWritesFromLocation(
      mergeTimelineRows({
        scheduledEvents: vesselScheduledEvents,
        actualEvents: actualByVessel.get(location.VesselAbbrev) ?? [],
        predictedEvents: [],
      }),
      location
    );

const getEventByKey = (
  events: ConvexVesselTimelineEventRecord[],
  Key: string
) => events.find((event) => event.Key === Key);

const canConfirmDepartureFromLocation = (
  location: ConvexVesselLocation,
  event: ConvexVesselTimelineEventRecord | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  event.EventOccurred !== true &&
  (location.LeftDock !== undefined || strongDeparture(location));

const canConfirmArrivalFromLocation = (
  location: ConvexVesselLocation,
  event: ConvexVesselTimelineEventRecord | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  event.EventOccurred !== true &&
  strongArrival(location);

const buildDepartureActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: ConvexVesselTimelineEventRecord | undefined
) =>
  event && canConfirmDepartureFromLocation(location, event)
    ? sparseActualDockWriteFromEvent(event, location.LeftDock)
    : undefined;

const buildArrivalActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: ConvexVesselTimelineEventRecord | undefined
) =>
  event && canConfirmArrivalFromLocation(location, event)
    ? sparseActualDockWriteFromEvent(event, undefined)
    : undefined;

const sparseActualDockWriteFromEvent = (
  event: ConvexVesselTimelineEventRecord,
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
  events: ConvexVesselTimelineEventRecord[],
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
  events: ConvexVesselTimelineEventRecord[],
  location: ConvexVesselLocation,
  eventType: VesselTimelineEventType
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
  events: ConvexVesselTimelineEventRecord[],
  location: ConvexVesselLocation,
  departureEvent: ConvexVesselTimelineEventRecord | undefined
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
  events: ConvexVesselTimelineEventRecord[],
  location: ConvexVesselLocation,
  departureEvent: ConvexVesselTimelineEventRecord | undefined
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
 * @param event - Candidate arrival event from the vessel timeline
 * @returns Earliest safe timestamp for confirming that arrival
 */
const arrivalEligibilityTime = (event: ConvexVesselTimelineEventRecord) => {
  return Math.min(
    event.ScheduledDeparture,
    event.EventPredictedTime ?? Number.POSITIVE_INFINITY,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );
};
