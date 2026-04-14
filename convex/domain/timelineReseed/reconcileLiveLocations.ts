/**
 * Applies live vessel-location reconciliation for reseed row-slice assembly.
 */

import type {
  ConvexActualBoundaryEvent,
  ConvexActualBoundaryPatch,
  ConvexActualBoundaryPatchPersistable,
} from "../../functions/eventsActual/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type {
  ConvexVesselTimelineEventRecord,
  VesselTimelineEventType,
} from "../../functions/vesselTimeline/schemas";
import { groupBy } from "../../shared/groupBy";
import { buildBoundaryKey, buildSegmentKey } from "../../shared/keys";
import { getSailingDay } from "../../shared/time";
import {
  enrichActualBoundaryPatchesWithTripContext,
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
  vesselScheduledEvents: ConvexScheduledBoundaryEvent[];
};

export type BuildActualBoundaryPatchesForSailingDayArgs = {
  sailingDay: string;
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  vesselLocations: ConvexVesselLocation[];
  tripBySegmentKey?: Map<string, TripContextForActualRow>;
};

/**
 * Builds sparse patches from one live location tick against an ordered
 * vessel/day event list.
 */
export const buildActualBoundaryPatchesFromLocation = (
  events: ConvexVesselTimelineEventRecord[],
  location: ConvexVesselLocation
): ConvexActualBoundaryPatch[] => {
  if (events.length === 0 || location.InService !== true) {
    return [];
  }

  const { departureEvent, resolvedArrivalEvent } =
    resolveLocationBoundaryEvents(events, location);

  return [
    buildDepartureActualPatchFromLocation(location, departureEvent),
    buildArrivalActualPatchFromLocation(location, resolvedArrivalEvent),
  ].filter((patch): patch is ConvexActualBoundaryPatch => patch !== undefined);
};

/**
 * Collects sparse actual-boundary patches for one sailing day from live
 * locations and the candidate scheduled/actual tables.
 */
export const buildActualBoundaryPatchesForSailingDay = ({
  sailingDay,
  scheduledEvents,
  actualEvents,
  vesselLocations,
  tripBySegmentKey = new Map(),
}: BuildActualBoundaryPatchesForSailingDayArgs): ConvexActualBoundaryPatchPersistable[] => {
  const scheduledByVessel = groupBy(scheduledEvents, (e) => e.VesselAbbrev);
  const actualByVessel = groupBy(actualEvents, (e) => e.VesselAbbrev);

  const raw = vesselLocations
    .map(attachScheduledEventsByVessel(scheduledByVessel))
    .filter(locationBundleMatchesSailingDay(sailingDay))
    .filter(hasScheduledEvents)
    .flatMap(actualBoundaryPatchesFromLocationBundle(actualByVessel));

  return enrichActualBoundaryPatchesWithTripContext(raw, tripBySegmentKey);
};

const attachScheduledEventsByVessel =
  (scheduledByVessel: VesselEventsByAbbrev<ConvexScheduledBoundaryEvent>) =>
  (location: ConvexVesselLocation): VesselLocationScheduledEventsBundle => ({
    location,
    vesselScheduledEvents: scheduledByVessel.get(location.VesselAbbrev) ?? [],
  });

const locationBundleMatchesSailingDay =
  (sailingDay: string) =>
  ({ location }: VesselLocationScheduledEventsBundle) =>
    getSailingDay(
      new Date(location.ScheduledDeparture ?? location.TimeStamp)
    ) === sailingDay;

const hasScheduledEvents = ({
  vesselScheduledEvents,
}: VesselLocationScheduledEventsBundle) => vesselScheduledEvents.length > 0;

const actualBoundaryPatchesFromLocationBundle =
  (actualByVessel: VesselEventsByAbbrev<ConvexActualBoundaryEvent>) =>
  ({ location, vesselScheduledEvents }: VesselLocationScheduledEventsBundle) =>
    buildActualBoundaryPatchesFromLocation(
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
    ? sparseActualBoundaryPatchFromEvent(event, location.LeftDock)
    : undefined;

const buildArrivalActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: ConvexVesselTimelineEventRecord | undefined
) =>
  event && canConfirmArrivalFromLocation(location, event)
    ? sparseActualBoundaryPatchFromEvent(event, undefined)
    : undefined;

const sparseActualBoundaryPatchFromEvent = (
  event: ConvexVesselTimelineEventRecord,
  EventActualTime: number | undefined
): ConvexActualBoundaryPatch => ({
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

const arrivalEligibilityTime = (event: ConvexVesselTimelineEventRecord) => {
  return Math.min(
    event.ScheduledDeparture,
    event.EventPredictedTime ?? Number.POSITIVE_INFINITY,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );
};
