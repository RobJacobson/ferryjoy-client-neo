/**
 * Pipeline stage 1: derive boundary points for each vessel-day event.
 *
 * This stage converts ordered event records into boundary-oriented data so the
 * later stages can build dock and sea rows from adjacent boundaries.
 */

import type { VesselTimelineEvent } from "@/data/contexts";
import type {
  VesselTimelineBoundary,
  VesselTimelineTimePoint,
} from "../../types";

/**
 * Boundary-oriented timeline input for one event.
 */
export type EventBoundaryData = {
  Key: string;
  EventType: VesselTimelineEvent["EventType"];
  TerminalAbbrev: string;
  ScheduledDeparture: Date;
  boundary: VesselTimelineBoundary;
};

/**
 * Converts ordered vessel timeline events into boundary-oriented data.
 *
 * @param Events - Ordered normalized vessel timeline events
 * @returns Boundary-oriented representation of each event
 */
export const getBoundaryData = (
  Events: VesselTimelineEvent[]
): EventBoundaryData[] =>
  Events.map((event) => ({
    Key: event.Key,
    EventType: event.EventType,
    TerminalAbbrev: event.TerminalAbbrev,
    ScheduledDeparture: event.ScheduledDeparture,
    boundary: {
      terminalAbbrev: event.TerminalAbbrev,
      timePoint: {
        scheduled: event.ScheduledTime,
        actual: event.ActualTime,
        estimated: event.PredictedTime,
      } satisfies VesselTimelineTimePoint,
    },
  }));
