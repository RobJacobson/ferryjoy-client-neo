/**
 * Builds the backend-owned event-first VesselTimeline read model.
 */

import type { ConvexActualBoundaryEvent } from "../../functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type { ConvexVesselTimelineViewModel } from "../../functions/vesselTimeline/schemas";
import { resolveActiveInterval } from "./activeInterval";
import { mergeTimelineEvents } from "./timelineEvents";

type BuildVesselTimelineViewModelArgs = {
  VesselAbbrev: string;
  SailingDay: string;
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
  location: ConvexVesselLocation | null;
};

/**
 * Builds the event-first timeline view model for one vessel/day.
 *
 * @param args - Read-model inputs loaded by the query layer
 * @returns Query-ready VesselTimeline view model
 */
export const buildVesselTimelineViewModel = ({
  VesselAbbrev,
  SailingDay,
  scheduledEvents,
  actualEvents,
  predictedEvents,
  location,
}: BuildVesselTimelineViewModelArgs): ConvexVesselTimelineViewModel => {
  const events = mergeTimelineEvents({
    scheduledEvents,
    actualEvents,
    predictedEvents,
  });
  const activeInterval = resolveActiveInterval({
    events,
    location,
  });
  const live = location ? toTimelineLiveState(location) : null;

  return {
    VesselAbbrev,
    SailingDay,
    ObservedAt: location?.TimeStamp ?? null,
    events,
    activeInterval,
    live,
  };
};

const toTimelineLiveState = (
  location: ConvexVesselLocation
): ConvexVesselTimelineViewModel["live"] => ({
  VesselName: location.VesselName,
  AtDock: location.AtDock,
  InService: location.InService,
  Speed: location.Speed,
  DepartingTerminalAbbrev: location.DepartingTerminalAbbrev,
  ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
  DepartingDistance: location.DepartingDistance,
  ArrivingDistance: location.ArrivingDistance,
  LeftDock: location.LeftDock,
  Eta: location.Eta,
  ScheduledDeparture: location.ScheduledDeparture,
  TimeStamp: location.TimeStamp,
});
