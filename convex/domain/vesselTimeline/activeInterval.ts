/**
 * Resolves the active event interval from live vessel identity.
 */

import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type {
  ConvexVesselTimelineActiveInterval,
  ConvexVesselTimelineEvent,
} from "../../functions/vesselTimeline/schemas";

/**
 * Resolves the currently active timeline interval from live vessel state and
 * same-day events.
 *
 * The server owns identity inference. The returned interval is boundary-first:
 * it tells the client which event-bounded span is active without exposing row
 * concepts.
 *
 * @param args - Ordered same-day events plus live identity inputs
 * @returns Active event interval, or `null` when none can be proven
 */
export const resolveActiveInterval = ({
  events,
  location,
  inferredDockedTripKey,
}: {
  events: ConvexVesselTimelineEvent[];
  location: ConvexVesselLocation | null;
  inferredDockedTripKey?: string | null;
}): ConvexVesselTimelineActiveInterval => {
  if (!location) {
    return null;
  }

  const segmentKey = resolveActiveSegmentKey({
    events,
    location,
    inferredDockedTripKey,
  });

  if (!segmentKey) {
    return null;
  }

  const segmentEvents = events.filter(
    (event) => event.SegmentKey === segmentKey
  );
  const departureEvent = segmentEvents.find(
    (event) => event.EventType === "dep-dock"
  );
  const arrivalEvent = segmentEvents.find(
    (event) => event.EventType === "arv-dock"
  );

  if (location.AtDock) {
    const dockTerminal = location.DepartingTerminalAbbrev;
    if (
      dockTerminal &&
      arrivalEvent &&
      arrivalEvent.TerminalAbbrev === dockTerminal
    ) {
      return {
        kind: "at-dock",
        startEventKey: arrivalEvent.Key,
        endEventKey: null,
      };
    }

    if (!departureEvent) {
      return null;
    }

    const previousEvent = getPreviousEvent(events, departureEvent.Key);
    const startEventKey =
      previousEvent?.EventType === "arv-dock" &&
      previousEvent.TerminalAbbrev === departureEvent.TerminalAbbrev
        ? previousEvent.Key
        : null;

    return {
      kind: "at-dock",
      startEventKey,
      endEventKey: departureEvent.Key,
    };
  }

  if (!departureEvent) {
    return null;
  }

  return {
    kind: "at-sea",
    startEventKey: departureEvent.Key,
    endEventKey: arrivalEvent?.Key ?? null,
  };
};

/**
 * Chooses the segment key used to anchor the active interval.
 *
 * Docked rows are validated against the observed dock terminal before trusting
 * `location.Key`. This avoids transient stale-key cases where actual event
 * overlays have advanced but the live location row still points at the prior
 * trip.
 *
 * @param args - Same-day events plus live identity inputs
 * @returns Segment key to use for active-interval resolution, or `null`
 */
const resolveActiveSegmentKey = ({
  events,
  location,
  inferredDockedTripKey,
}: {
  events: ConvexVesselTimelineEvent[];
  location: ConvexVesselLocation;
  inferredDockedTripKey?: string | null;
}) => {
  if (!location.AtDock) {
    return location.Key ?? null;
  }

  if (!location.Key) {
    return inferredDockedTripKey ?? null;
  }

  const dockTerminal = location.DepartingTerminalAbbrev;
  if (!dockTerminal) {
    return location.Key;
  }

  const keyedEvents = events.filter(
    (event) => event.SegmentKey === location.Key
  );
  const keyedDeparture = keyedEvents.find(
    (event) => event.EventType === "dep-dock"
  );
  const keyedArrival = keyedEvents.find(
    (event) => event.EventType === "arv-dock"
  );

  if (keyedArrival?.TerminalAbbrev === dockTerminal) {
    return location.Key;
  }

  if (inferredDockedTripKey) {
    return inferredDockedTripKey;
  }

  return keyedDeparture?.TerminalAbbrev === dockTerminal ? location.Key : null;
};

/**
 * Returns the previous ordered event for one event key.
 *
 * @param events - Ordered same-day events
 * @param eventKey - Boundary event key to look up
 * @returns Previous ordered event, or `undefined`
 */
const getPreviousEvent = (
  events: ConvexVesselTimelineEvent[],
  eventKey: string
) => {
  const eventIndex = events.findIndex((event) => event.Key === eventKey);

  return eventIndex > 0 ? events[eventIndex - 1] : undefined;
};
