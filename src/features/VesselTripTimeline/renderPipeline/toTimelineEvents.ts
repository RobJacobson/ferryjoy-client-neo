/**
 * Pipeline stage: convert the current trip item into ordered boundary events.
 */

import {
  getDestinationArrivalOrCoverageClose,
  getOriginArrivalActual,
} from "@/features/TimelineFeatures/shared/utils";
import type {
  TimelineEvent,
  TimelinePipelineInput,
  TimelinePipelineWithEvents,
  TimePoint,
} from "../types";

/**
 * Adds ordered trip-boundary events to the pipeline context.
 *
 * @param input - Pipeline input containing the trip item
 * @returns Pipeline context enriched with ordered boundary events
 */
export const toTimelineEvents = (
  input: TimelinePipelineInput
): TimelinePipelineWithEvents => {
  const { trip, vesselLocation } = input.item;

  const destinationArrivalOrCoverageClose =
    getDestinationArrivalOrCoverageClose(trip);

  return {
    ...input,
    events: [
      {
        eventType: "arrive",
        terminalAbbrev: trip.DepartingTerminalAbbrev,
        timePoint: {
          scheduled: trip.ScheduledTrip?.SchedArriveCurr,
          actual: getOriginArrivalActual(trip),
        } satisfies TimePoint,
      },
      {
        eventType: "depart",
        terminalAbbrev: trip.DepartingTerminalAbbrev,
        timePoint: {
          actual:
            trip.LeftDockActual ?? vesselLocation.LeftDock ?? trip.LeftDock,
          estimated: trip.AtDockDepartCurr?.PredTime,
          scheduled:
            trip.ScheduledTrip?.DepartingTime ??
            trip.ScheduledDeparture ??
            vesselLocation.ScheduledDeparture,
        } satisfies TimePoint,
      },
      {
        eventType: "arrive",
        terminalAbbrev: trip.ArrivingTerminalAbbrev,
        timePoint: {
          actual: destinationArrivalOrCoverageClose,
          estimated:
            vesselLocation.Eta ??
            trip.AtSeaArriveNext?.PredTime ??
            trip.AtDockArriveNext?.PredTime,
          scheduled:
            trip.ScheduledTrip?.SchedArriveNext ??
            trip.ScheduledTrip?.ArrivingTime,
        } satisfies TimePoint,
      },
      {
        eventType: "depart",
        terminalAbbrev: trip.ArrivingTerminalAbbrev,
        timePoint: {
          actual: trip.AtDockDepartNext?.Actual,
          estimated:
            trip.AtDockDepartNext?.PredTime ?? trip.AtSeaDepartNext?.PredTime,
          scheduled: trip.ScheduledTrip?.NextDepartingTime,
        } satisfies TimePoint,
      },
    ] satisfies TimelineEvent[],
  };
};
