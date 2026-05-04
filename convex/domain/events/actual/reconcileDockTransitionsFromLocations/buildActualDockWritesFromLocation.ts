/**
 * Builds sparse actual dock writes from one live vessel-location sample.
 *
 * Anchors departure and arrival boundaries against the vessels reconcile
 * slice, applies confirmation gates from GPS-derived motion and dock state,
 * and emits at most one write per boundary. Arrival eligibility falls back to
 * the latest unanchored arrival when the feed lacks a tight schedule key,
 * keeping reconcile resilient to late or stale schedule data.
 */

import type { ConvexVesselLocation } from "../../../../functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "../../../../shared/keys";
import type { DockEventType } from "../../scheduled";
import type { ConvexActualDockWrite } from "../schemas";
import { strongArrival, strongDeparture } from "./locationMotionGates";
import type { LocationReconcileBoundaryEvent } from "./types";

/**
 * Derives zero to two sparse writes from one live tick against a reconciled slice.
 *
 * Anchors departures and arrivals using resolveLocationBoundaryEvents, applies
 * confirmation gates from GPS-derived motion and dock sensors, and drops rows
 * when InService is false or the vessel cannot yet confirm the boundary
 * legally. Schedule-key absence triggers an arrival fallback search.
 *
 * @param events - buildLocationReconcileBoundaryEvents output for one vessel slice
 * @param location - Latest Convex vessel location sample for that vessel
 * @returns ConvexActualDockWrite patches carrying SegmentKey for downstream enrichment
 */
const buildActualDockWritesFromLocation = (
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
 * Selects departure and arrival reconcile targets for one location tick.
 *
 * Departure and anchored arrival lookups prefer segment-keyed boundaries when
 * the feed carries an arriving terminal; arrival confirmation uses
 * findArrivalEventForLocation so eligibility respects scheduled ordering when
 * GPS lacks a tight anchor.
 *
 * @param events - Ordered reconcile rows for one vessel day slice
 * @param location - Live sample driving confirmation decisions
 * @returns Departure row, intermediate anchored arrival, and resolved arrival candidate
 */
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

/**
 * Finds the reconcile row matching the vessels current leg or scheduled instant.
 *
 * Prefers explicit segment-key lookup via buildBoundaryKey when arriving
 * terminal metadata exists; otherwise scans for vessel, event type, and
 * scheduled departure equality consistent with feed snapshots that omit
 * segment reconstruction.
 *
 * @param events - Reconcile slice for one vessel and sailing day
 * @param location - Live sample whose terminals and schedule anchor matching
 * @param eventType - dep-dock or arv-dock boundary being resolved
 * @returns Matching LocationReconcileBoundaryEvent when found
 */
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

/**
 * Finds the first boundary row matching a canonical Key string.
 *
 * @param events - Candidate reconcile boundary rows for one vessel slice
 * @param Key - Stable boundary Key from scheduled or derived rows
 * @returns Matching row when present
 */
const getEventByKey = (events: LocationReconcileBoundaryEvent[], Key: string) =>
  events.find((event) => event.Key === Key);

/**
 * Chooses which arrival boundary may be confirmed at the current feed timestamp.
 *
 * Prefers anchored arrivals scheduled before the active departure upper bound
 * when eligibility passes; otherwise searches remaining open arrivals at the
 * departing terminal that are already chronologically eligible under
 * arrivalEligibilityTime.
 *
 * @param events - Full reconcile slice for the vessel day
 * @param location - Live sample providing TimeStamp and terminal context
 * @param departureEvent - Current departure anchor when known
 * @returns Arrival boundary eligible for confirmation, if any
 */
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

/**
 * Picks the latest scheduled arrival before the upper bound departure instant.
 *
 * Filters arrivals at the departing terminal with scheduled departure strictly
 * before the bound, then sorts descending so the nearest upcoming arrival wins.
 *
 * @param events - Reconcile slice for the vessel day
 * @param location - Provides DepartingTerminalAbbrev context for terminal filtering
 * @param departureEvent - Optional departure row establishing the upper bound instant
 * @returns Candidate anchored arrival row when one exists
 */
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
 * Computes the earliest wall-clock instant where confirmation is considered safe.
 *
 * Uses the minimum of scheduled departure and explicit EventScheduledTime so
 * feeds that publish tighter berth windows gate confirmation earlier than
 * coarse depart times.
 *
 * @param event - Arrival reconcile row under evaluation
 * @returns Millisecond timestamp threshold for eligibility comparisons
 */
const arrivalEligibilityTime = (event: LocationReconcileBoundaryEvent) =>
  Math.min(
    event.ScheduledDeparture,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );

/**
 * True when GPS and timing evidence supports confirming a departure boundary.
 *
 * @param location - Live vessel sample including motion and dock sensors
 * @param event - Candidate departure reconcile row, when defined
 * @returns True when service is active, boundary not yet occurred, and sensors show leaving dock
 */
const canConfirmDepartureFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  event.EventOccurred !== true &&
  (location.LeftDock !== undefined || strongDeparture(location));

/**
 * True when GPS and timing evidence supports confirming an arrival boundary.
 *
 * @param location - Live vessel sample including motion and dock sensors
 * @param event - Candidate arrival reconcile row, when defined
 * @returns True when service is active, boundary open, and sensors show docking
 */
const canConfirmArrivalFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  event.EventOccurred !== true &&
  strongArrival(location);

/**
 * Builds a departure sparse write when confirmation gates pass.
 *
 * @param location - Live sample supplying LeftDock timestamps when present
 * @param event - Target departure boundary row from reconcile slice
 * @returns Sparse write or undefined when confirmation fails
 */
const buildDepartureActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  event && canConfirmDepartureFromLocation(location, event)
    ? sparseActualDockWriteFromEvent(event, location.LeftDock)
    : undefined;

/**
 * Builds an arrival sparse write when confirmation gates pass.
 *
 * EventActualTime for arrivals is resolved downstream from feed timing rules
 * rather than LeftDock alone, so this passes undefined into
 * sparseActualDockWriteFromEvent.
 *
 * @param location - Live sample evaluated at confirmation time
 * @param event - Target arrival boundary row from reconcile slice
 * @returns Sparse write or undefined when confirmation fails
 */
const buildArrivalActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  event && canConfirmArrivalFromLocation(location, event)
    ? sparseActualDockWriteFromEvent(event, undefined)
    : undefined;

/**
 * Converts a reconcile boundary row into the sparse write shape for ingestion.
 *
 * @param event - Neutral boundary row including SegmentKey for enrichment
 * @param EventActualTime - Confirmed instant from sensors when known
 * @returns ConvexActualDockWrite always marked occurred true with sparse anchors
 */
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

export { buildActualDockWritesFromLocation };
