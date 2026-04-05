/**
 * Builds the backend-owned event-first VesselTimeline backbone.
 */

import type { ConvexActualBoundaryEvent } from "../../functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import type { ConvexVesselTimelineBackbone } from "../../functions/vesselTimeline/schemas";
import { mergeTimelineEvents } from "./timelineEvents";

type BuildVesselTimelineBackboneArgs = {
  VesselAbbrev: string;
  SailingDay: string;
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
};

/**
 * Builds the event-first timeline backbone for one vessel/day.
 *
 * @param args - Read-model inputs loaded by the query layer
 * @returns Query-ready VesselTimeline backbone
 */
export const buildVesselTimelineBackbone = ({
  VesselAbbrev,
  SailingDay,
  scheduledEvents,
  actualEvents,
  predictedEvents,
}: BuildVesselTimelineBackboneArgs): ConvexVesselTimelineBackbone => {
  const events = mergeTimelineEvents({
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
