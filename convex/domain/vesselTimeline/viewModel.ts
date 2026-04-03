/**
 * Builds the backend-owned VesselTimeline row and view-model read model.
 */

import type { ConvexActualBoundaryEvent } from "../../functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";
import type { ConvexVesselTimelineViewModel } from "../../functions/vesselTimeline/schemas";
import type { ConvexVesselTrip } from "../../functions/vesselTrips/schemas";
import type { BoundaryEventType } from "../../shared/keys";
import { resolveActiveRowId } from "./activeRow";
import {
  buildVesselTimelineRows,
  type MergedTimelineBoundaryEvent,
} from "./rows";

type BuildVesselTimelineViewModelArgs = {
  VesselAbbrev: string;
  SailingDay: string;
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
  location: ConvexVesselLocation | null;
  activeTrip: ConvexVesselTrip | null;
  inferredDockedTripKey?: string | null;
  terminalTailTripKey?: string | null;
};

/**
 * Builds the full backend-owned timeline view model for one vessel/day.
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
  activeTrip,
  inferredDockedTripKey,
  terminalTailTripKey,
}: BuildVesselTimelineViewModelArgs): ConvexVesselTimelineViewModel => {
  const mergedEvents = mergeBoundaryEvents({
    scheduledEvents,
    actualEvents,
    predictedEvents,
  });
  const rows = buildVesselTimelineRows({
    mergedEvents,
    terminalTailTripKey,
  });
  const activeRowId = resolveActiveRowId({
    rows,
    location,
    activeTrip,
    inferredDockedTripKey,
  });
  const live = location ? toTimelineLiveState(location) : null;

  return {
    VesselAbbrev,
    SailingDay,
    ObservedAt: location?.TimeStamp ?? null,
    rows,
    activeRowId,
    live,
  };
};

/**
 * Merges sparse actual and predicted overlays onto the scheduled backbone.
 *
 * @param args - Boundary-event tables for one vessel/day
 * @returns Ordered merged boundary events
 */
export const mergeBoundaryEvents = ({
  scheduledEvents,
  actualEvents,
  predictedEvents,
}: {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
}): MergedTimelineBoundaryEvent[] => {
  const actualByKey = new Map(actualEvents.map((event) => [event.Key, event]));
  const predictedByKey = new Map(
    predictedEvents.map((event) => [event.Key, event])
  );

  return [...scheduledEvents]
    .sort(sortScheduledBoundaryEvents)
    .map((event) => ({
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventType: event.EventType,
      EventScheduledTime: event.EventScheduledTime,
      EventActualTime: actualByKey.get(event.Key)?.EventActualTime,
      EventPredictedTime: predictedByKey.get(event.Key)?.EventPredictedTime,
    }));
};

/**
 * Converts a live vessel-location row into the compact timeline live state.
 *
 * @param location - Current vessel location row
 * @returns Live-state payload for the timeline view model
 */
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

/**
 * Sorts scheduled boundary events into stable timeline order.
 *
 * @param left - Left boundary event
 * @param right - Right boundary event
 * @returns Stable sort comparison result
 */
const sortScheduledBoundaryEvents = (
  left: ConvexScheduledBoundaryEvent,
  right: ConvexScheduledBoundaryEvent
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Returns the stable sort rank for one boundary-event type.
 *
 * @param eventType - Boundary-event type
 * @returns Sort rank
 */
const getEventTypeOrder = (eventType: BoundaryEventType) =>
  eventType === "dep-dock" ? 0 : 1;
