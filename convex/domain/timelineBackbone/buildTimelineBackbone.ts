/**
 * Builds the backend-owned event-first VesselTimeline backbone.
 */

import type { ConvexActualDockEvent } from "../../functions/eventsActual/schemas";
import type { ConvexPredictedDockEvent } from "../../functions/eventsPredicted/schemas";
import type { ConvexScheduledDockEvent } from "../../functions/eventsScheduled/schemas";
import type { ConvexVesselTimelineBackbone } from "../../functions/vesselTimeline/schemas";
import { mergeTimelineRows } from "../timelineRows/mergeTimelineRows";

type BuildTimelineBackboneArgs = {
  VesselAbbrev: string;
  SailingDay: string;
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  predictedEvents: ConvexPredictedDockEvent[];
};

/**
 * Builds the event-first timeline backbone for one vessel/day.
 *
 * @param args - Read-model inputs loaded by the query layer
 * @returns Query-ready VesselTimeline backbone
 */
export const buildTimelineBackbone = ({
  VesselAbbrev,
  SailingDay,
  scheduledEvents,
  actualEvents,
  predictedEvents,
}: BuildTimelineBackboneArgs): ConvexVesselTimelineBackbone => {
  const events = mergeTimelineRows({
    scheduledEvents,
    actualEvents,
    predictedEvents,
  });

  return {
    VesselAbbrev,
    SailingDay,
    events,
  };
};
