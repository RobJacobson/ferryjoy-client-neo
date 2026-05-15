/**
 * Build actual row candidates from current vessel tracking rows.
 *
 * Tracking is a current-state source that fills scheduled and physical-only
 * trip boundaries after durable history and trip fields have had
 * first chance to represent those boundaries.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import {
  isDefined,
  toBoundaryActualRowCandidate,
  toTripActualRowCandidate,
} from "./actualRowCandidates";
import type {
  ActualRowCandidate,
  ReloadTripWithTripKey,
  ScheduledBoundary,
} from "./types";

/**
 * Builds actual row candidates from tracking rows aligned to scheduled boundaries.
 *
 * @param locations - Current tracking rows scoped to the reload sailing day
 * @param boundariesByVessel - Scheduled boundaries grouped by vessel abbrev
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @returns Tracking candidates for scheduled TripKeys
 */
const buildScheduleAlignedTrackingActualRowCandidates = (
  locations: ConvexVesselLocation[],
  boundariesByVessel: Map<string, ScheduledBoundary[]>,
  tripKeyBySegmentKey: Map<string, string>
): ActualRowCandidate[] =>
  locations.flatMap((location) =>
    buildTrackingActualRowCandidatesForScheduledBoundaries(
      location,
      boundariesByVessel.get(location.VesselAbbrev) ?? [],
      tripKeyBySegmentKey
    )
  );

/**
 * Builds actual row candidates from tracking rows for active physical-only trips.
 *
 * @param locations - Current tracking rows scoped to the reload sailing day
 * @param activePhysicalOnlyTripsByVessel - Active physical-only trips keyed by vessel
 * @returns Tracking candidates for physical-only TripKeys
 */
const buildPhysicalOnlyTrackingActualRowCandidates = (
  locations: ConvexVesselLocation[],
  activePhysicalOnlyTripsByVessel: Map<string, ReloadTripWithTripKey>
): ActualRowCandidate[] =>
  locations.flatMap((location) => {
    const trip = activePhysicalOnlyTripsByVessel.get(location.VesselAbbrev);
    const trackingCandidates =
      location.InService !== true || trip === undefined
        ? []
        : [
            location.AtDock === false
              ? toTripActualRowCandidate(
                  trip,
                  trip.DepartingTerminalAbbrev,
                  "dep-dock",
                  location.LeftDock ?? location.TimeStamp
                )
              : undefined,
            location.AtDock === true &&
            trip.ArrivingTerminalAbbrev !== undefined
              ? toTripActualRowCandidate(
                  trip,
                  trip.ArrivingTerminalAbbrev,
                  "arv-dock",
                  location.TimeStamp
                )
              : undefined,
          ].filter(isDefined);

    return trackingCandidates;
  });

/**
 * Builds schedule-aligned tracking candidates for one location row.
 *
 * @param location - Current tracking row
 * @param boundaries - Same-vessel scheduled boundaries
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @returns Zero or more scheduled tracking candidates
 */
const buildTrackingActualRowCandidatesForScheduledBoundaries = (
  location: ConvexVesselLocation,
  boundaries: ScheduledBoundary[],
  tripKeyBySegmentKey: Map<string, string>
): ActualRowCandidate[] => {
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
  const trackingCandidates =
    boundaries.length === 0 || location.InService !== true
      ? []
      : [
          toTrackingBoundaryActualRowCandidate(
            departureBoundary,
            location,
            tripKeyBySegmentKey,
            location.LeftDock
          ),
          toTrackingBoundaryActualRowCandidate(
            arrivalBoundary,
            location,
            tripKeyBySegmentKey,
            undefined
          ),
        ].filter(isDefined);

  return trackingCandidates;
};

/**
 * Builds one scheduled tracking candidate when tracking state supports it.
 *
 * @param boundary - Matched scheduled boundary
 * @param location - Current tracking row
 * @param tripKeyBySegmentKey - TripKey lookup by schedule segment key
 * @param actualTime - Observed boundary time when known
 * @returns Actual row candidate or undefined when guards fail
 */
const toTrackingBoundaryActualRowCandidate = (
  boundary: ScheduledBoundary | undefined,
  location: ConvexVesselLocation,
  tripKeyBySegmentKey: Map<string, string>,
  actualTime: number | undefined
): ActualRowCandidate | undefined => {
  const tripKey =
    boundary === undefined
      ? undefined
      : tripKeyBySegmentKey.get(boundary.SegmentKey);
  const trackingCandidate =
    boundary === undefined ||
    tripKey === undefined ||
    !trackingStateSupportsBoundary(location, boundary)
      ? undefined
      : toBoundaryActualRowCandidate(boundary, tripKey, actualTime);

  return trackingCandidate;
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
  eventType: ActualRowCandidate["eventType"]
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
  eventType: ActualRowCandidate["eventType"]
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
  eventType: ActualRowCandidate["eventType"]
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
 * @returns True when the tracking row can produce a candidate for the boundary
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
  buildPhysicalOnlyTrackingActualRowCandidates,
  buildScheduleAlignedTrackingActualRowCandidates,
  trackingLocationMatchesSailingDay,
};
