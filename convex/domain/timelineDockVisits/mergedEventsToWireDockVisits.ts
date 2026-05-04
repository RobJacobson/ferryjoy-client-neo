/**
 * Builds wire-format timeline dock visits from merged vessel timeline events
 * (epoch ms timestamps). Shared by client-facing domain helpers.
 */

import type { ConvexVesselTimelineEvent } from "functions/vesselTimeline/schemas";
import type {
  ConvexRouteTimelineBoundary,
  ConvexRouteTimelineDockVisit,
} from "./schemas";

/**
 * Maps one merged vessel timeline event into a route timeline boundary wire
 * row (epoch ms on time fields).
 *
 * @param event - Merged backbone event for one vessel/day
 * @returns Boundary row for `ConvexRouteTimelineDockVisit` assembly
 */
const toRouteTimelineBoundaryWire = (
  event: ConvexVesselTimelineEvent
): ConvexRouteTimelineBoundary => ({
  Key: event.Key,
  SegmentKey: event.SegmentKey,
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
  EventScheduledTime: event.EventScheduledTime,
  EventPredictedTime: event.EventPredictedTime,
  EventOccurred: event.EventOccurred,
  EventActualTime: event.EventActualTime,
});

/**
 * Builds ordered wire dock visits from merged boundary events using strict
 * adjacent boundary pairing. Does not merge across terminals or repair invalid
 * seams.
 *
 * @param merged - Ordered merged events for one vessel/day
 * @param vesselAbbrev - Vessel owning these visits
 * @param sailingDay - Operational sailing day string
 * @returns Dock visits in merge order (epoch ms on boundaries); empty when
 * `merged` is empty
 */
const mergedEventsToWireDockVisits = (
  merged: ConvexVesselTimelineEvent[],
  vesselAbbrev: string,
  sailingDay: string
): ConvexRouteTimelineDockVisit[] => {
  const visits: ConvexRouteTimelineDockVisit[] = [];
  const dockVisitKey = (
    arrival: ConvexRouteTimelineBoundary | undefined,
    departure: ConvexRouteTimelineBoundary | undefined
  ) => `${arrival?.Key ?? "none"}::${departure?.Key ?? "none"}`;

  for (let index = 0; index < merged.length; index += 1) {
    const event = merged[index];
    if (!event) {
      continue;
    }

    const terminalAbbrev = event.TerminalAbbrev;
    const boundary = toRouteTimelineBoundaryWire(event);
    const previousEvent = index > 0 ? merged[index - 1] : undefined;
    const nextEvent = merged[index + 1];
    const hasPreviousArrivalPair =
      previousEvent?.EventType === "arv-dock" &&
      previousEvent.TerminalAbbrev === terminalAbbrev;

    if (event.EventType === "arv-dock") {
      if (
        nextEvent?.EventType === "dep-dock" &&
        nextEvent.TerminalAbbrev === terminalAbbrev
      ) {
        const departure = toRouteTimelineBoundaryWire(nextEvent);
        visits.push({
          Key: dockVisitKey(boundary, departure),
          VesselAbbrev: vesselAbbrev,
          SailingDay: sailingDay,
          TerminalAbbrev: terminalAbbrev,
          Arrival: boundary,
          Departure: departure,
        });
        index += 1;
        continue;
      }

      visits.push({
        Key: dockVisitKey(boundary, undefined),
        VesselAbbrev: vesselAbbrev,
        SailingDay: sailingDay,
        TerminalAbbrev: terminalAbbrev,
        Arrival: boundary,
        Departure: undefined,
      });
      continue;
    }

    if (hasPreviousArrivalPair) {
      continue;
    }

    visits.push({
      Key: dockVisitKey(undefined, boundary),
      VesselAbbrev: vesselAbbrev,
      SailingDay: sailingDay,
      TerminalAbbrev: terminalAbbrev,
      Arrival: undefined,
      Departure: boundary,
    });
  }

  return visits;
};

export { mergedEventsToWireDockVisits };
