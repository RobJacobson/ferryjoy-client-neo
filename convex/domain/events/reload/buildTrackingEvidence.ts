/**
 * Build actual evidence from current vessel tracking rows.
 *
 * Tracking is a current-state evidence source that fills scheduled and
 * physical-only trip boundaries after durable history and trip fields have had
 * first chance to represent those boundaries.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import {
  isDefined,
  toBoundaryEvidence,
  toTripEvidence,
} from "./buildActualRows";
import type {
  ActualEvidence,
  ReloadTripWithTripKey,
  ScheduledBoundary,
} from "./types";

/**
 * Builds actual evidence from tracking rows aligned to scheduled boundaries.
 *
 * @param locations - Current tracking rows scoped to the reload sailing day
 * @param boundariesByVessel - Scheduled boundaries grouped by vessel abbrev
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @returns Tracking evidence for scheduled TripKeys
 */
const buildScheduleAlignedTrackingEvidence = (
  locations: ConvexVesselLocation[],
  boundariesByVessel: Map<string, ScheduledBoundary[]>,
  tripKeyBySegmentKey: Map<string, string>
): ActualEvidence[] =>
  locations.flatMap((location) =>
    buildTrackingEvidenceForScheduledBoundaries(
      location,
      boundariesByVessel.get(location.VesselAbbrev) ?? [],
      tripKeyBySegmentKey
    )
  );

/**
 * Builds actual evidence from tracking rows for active physical-only trips.
 *
 * @param locations - Current tracking rows scoped to the reload sailing day
 * @param activePhysicalOnlyTripsByVessel - Active physical-only trips keyed by vessel
 * @returns Tracking evidence for physical-only TripKeys
 */
const buildPhysicalOnlyTrackingEvidence = (
  locations: ConvexVesselLocation[],
  activePhysicalOnlyTripsByVessel: Map<string, ReloadTripWithTripKey>
): ActualEvidence[] =>
  locations.flatMap((location) => {
    const trip = activePhysicalOnlyTripsByVessel.get(location.VesselAbbrev);
    const trackingEvidence =
      location.InService !== true || trip === undefined
        ? []
        : [
            location.AtDock === false
              ? toTripEvidence(
                  trip,
                  trip.DepartingTerminalAbbrev,
                  "dep-dock",
                  location.LeftDock ?? location.TimeStamp,
                  "tracking"
                )
              : undefined,
            location.AtDock === true &&
            trip.ArrivingTerminalAbbrev !== undefined
              ? toTripEvidence(
                  trip,
                  trip.ArrivingTerminalAbbrev,
                  "arv-dock",
                  location.TimeStamp,
                  "tracking"
                )
              : undefined,
          ].filter(isDefined);

    return trackingEvidence;
  });

/**
 * Builds schedule-aligned tracking evidence for one location row.
 *
 * @param location - Current tracking row
 * @param boundaries - Same-vessel scheduled boundaries
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @returns Zero or more scheduled tracking evidence rows
 */
const buildTrackingEvidenceForScheduledBoundaries = (
  location: ConvexVesselLocation,
  boundaries: ScheduledBoundary[],
  tripKeyBySegmentKey: Map<string, string>
): ActualEvidence[] => {
  const departureBoundary = getTrackingAnchoredBoundary(
    boundaries,
    location,
    "dep-dock"
  );
  const arrivalBoundary = findArrivalBoundaryForTracking(
    boundaries,
    location,
    departureBoundary
  );
  const trackingEvidence =
    boundaries.length === 0 || location.InService !== true
      ? []
      : [
          toTrackingBoundaryEvidence(
            departureBoundary,
            location,
            tripKeyBySegmentKey,
            location.LeftDock
          ),
          toTrackingBoundaryEvidence(
            arrivalBoundary,
            location,
            tripKeyBySegmentKey,
            undefined
          ),
        ].filter(isDefined);

  return trackingEvidence;
};

/**
 * Builds one scheduled tracking evidence row when tracking state supports it.
 *
 * @param boundary - Matched scheduled boundary
 * @param location - Current tracking row
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @param actualTime - Observed boundary time when known
 * @returns Actual evidence or undefined when guards fail
 */
const toTrackingBoundaryEvidence = (
  boundary: ScheduledBoundary | undefined,
  location: ConvexVesselLocation,
  tripKeyBySegmentKey: Map<string, string>,
  actualTime: number | undefined
): ActualEvidence | undefined => {
  const tripKey =
    boundary === undefined
      ? undefined
      : tripKeyBySegmentKey.get(boundary.SegmentKey);
  const trackingEvidence =
    boundary === undefined ||
    tripKey === undefined ||
    !trackingStateSupportsBoundary(location, boundary)
      ? undefined
      : toBoundaryEvidence(boundary, tripKey, actualTime, "tracking");

  return trackingEvidence;
};

/**
 * Finds a scheduled boundary anchored by tracking schedule fields.
 *
 * @param boundaries - Same-vessel scheduled boundaries
 * @param location - Current tracking row
 * @param eventType - Dock boundary type to match
 * @returns Matched scheduled boundary when found
 */
const getTrackingAnchoredBoundary = (
  boundaries: ScheduledBoundary[],
  location: ConvexVesselLocation,
  eventType: ActualEvidence["eventType"]
): ScheduledBoundary | undefined => {
  const keyedBoundary = getTrackingKeyedBoundary(
    boundaries,
    location,
    eventType
  );
  const scheduleBoundary = getTrackingScheduleBoundary(
    boundaries,
    location,
    eventType
  );
  const trackingBoundary = keyedBoundary ?? scheduleBoundary;

  return trackingBoundary;
};

/**
 * Finds a scheduled boundary by rebuilding the tracking segment key.
 *
 * @param boundaries - Same-vessel scheduled boundaries
 * @param location - Current tracking row
 * @param eventType - Dock boundary type to match
 * @returns Matched scheduled boundary when the tracking row has full segment identity
 */
const getTrackingKeyedBoundary = (
  boundaries: ScheduledBoundary[],
  location: ConvexVesselLocation,
  eventType: ActualEvidence["eventType"]
): ScheduledBoundary | undefined => {
  const segmentKey =
    location.ScheduledDeparture === undefined ||
    location.ArrivingTerminalAbbrev === undefined
      ? undefined
      : buildSegmentKey(
          location.VesselAbbrev,
          location.DepartingTerminalAbbrev,
          location.ArrivingTerminalAbbrev,
          new Date(location.ScheduledDeparture)
        );
  const trackingBoundary =
    segmentKey === undefined
      ? undefined
      : boundaries.find(
          (boundary) => boundary.Key === buildBoundaryKey(segmentKey, eventType)
        );

  return trackingBoundary;
};

/**
 * Finds a scheduled boundary by scheduled departure and dock terminal.
 *
 * @param boundaries - Same-vessel scheduled boundaries
 * @param location - Current tracking row
 * @param eventType - Dock boundary type to match
 * @returns Matched scheduled boundary when schedule fields are sufficient
 */
const getTrackingScheduleBoundary = (
  boundaries: ScheduledBoundary[],
  location: ConvexVesselLocation,
  eventType: ActualEvidence["eventType"]
): ScheduledBoundary | undefined =>
  location.ScheduledDeparture === undefined
    ? undefined
    : boundaries.find(
        (boundary) =>
          boundary.EventType === eventType &&
          boundary.ScheduledDeparture === location.ScheduledDeparture &&
          (eventType === "arv-dock" ||
            boundary.TerminalAbbrev === location.DepartingTerminalAbbrev)
      );

/**
 * Finds the most recent prior scheduled arrival supported by tracking.
 *
 * @param boundaries - Same-vessel scheduled boundaries
 * @param location - Current tracking row
 * @param departureBoundary - Matched departure boundary used as the upper bound
 * @returns Prior arrival boundary when tracking is late enough to support it
 */
const findArrivalBoundaryForTracking = (
  boundaries: ScheduledBoundary[],
  location: ConvexVesselLocation,
  departureBoundary: ScheduledBoundary | undefined
): ScheduledBoundary | undefined => {
  const scheduledDepartureUpperBound =
    departureBoundary?.ScheduledDeparture ?? location.ScheduledDeparture;
  const arrivalBoundary =
    scheduledDepartureUpperBound === undefined
      ? undefined
      : boundaries
          .filter((boundary) =>
            isEligibleTrackingArrival(
              boundary,
              location,
              scheduledDepartureUpperBound
            )
          )
          .reduce(pickLaterScheduledDeparture, undefined);

  return arrivalBoundary;
};

/**
 * Returns whether tracking state supports the matched boundary type.
 *
 * @param location - Current tracking row
 * @param boundary - Matched scheduled boundary
 * @returns True when the tracking row can produce evidence for the boundary
 */
const trackingStateSupportsBoundary = (
  location: ConvexVesselLocation,
  boundary: ScheduledBoundary
): boolean =>
  boundary.EventType === "dep-dock"
    ? location.LeftDock !== undefined || location.AtDock === false
    : location.AtDock === true;

/**
 * Returns whether a boundary is an eligible prior arrival for tracking.
 *
 * @param boundary - Candidate scheduled boundary
 * @param location - Current tracking row
 * @param scheduledDepartureUpperBound - Exclusive upper bound for prior arrivals
 * @returns True when the boundary is a prior arrival at the current dock and can have occurred
 */
const isEligibleTrackingArrival = (
  boundary: ScheduledBoundary,
  location: ConvexVesselLocation,
  scheduledDepartureUpperBound: number
): boolean =>
  boundary.EventType === "arv-dock" &&
  boundary.TerminalAbbrev === location.DepartingTerminalAbbrev &&
  boundary.ScheduledDeparture < scheduledDepartureUpperBound &&
  getArrivalEligibilityTime(boundary) <= location.TimeStamp;

/**
 * Resolves when tracking may infer an arrival boundary.
 *
 * @param boundary - Candidate arrival boundary
 * @returns Arrival boundary time, falling back to scheduled departure
 */
const getArrivalEligibilityTime = (boundary: ScheduledBoundary): number =>
  boundary.EventScheduledTime ?? boundary.ScheduledDeparture;

/**
 * Picks the later scheduled departure between arrival candidates.
 *
 * @param latest - Current latest arrival candidate
 * @param candidate - Newly eligible arrival candidate
 * @returns Candidate with the later scheduled departure
 */
const pickLaterScheduledDeparture = (
  latest: ScheduledBoundary | undefined,
  candidate: ScheduledBoundary
): ScheduledBoundary =>
  latest === undefined ||
  candidate.ScheduledDeparture > latest.ScheduledDeparture
    ? candidate
    : latest;

/**
 * Returns whether a tracking row belongs to the requested sailing day.
 *
 * @param location - Current tracking row
 * @param sailingDay - Reload sailing day
 * @returns True when scheduled departure or ping time lands on the sailing day
 */
const trackingLocationMatchesSailingDay = (
  location: ConvexVesselLocation,
  sailingDay: string
): boolean =>
  getSailingDay(new Date(location.ScheduledDeparture ?? location.TimeStamp)) ===
  sailingDay;

export {
  buildPhysicalOnlyTrackingEvidence,
  buildScheduleAlignedTrackingEvidence,
  trackingLocationMatchesSailingDay,
};
