/**
 * Merges scheduled, actual, and predicted boundary rows into the ordered
 * event-first timeline slice used by read-time backbone assembly and by
 * reseed live-location reconciliation.
 */

import type { ConvexActualBoundaryEvent } from "../../functions/eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../functions/eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../functions/eventsScheduled/schemas";
import {
  getBoundaryTime,
  getSegmentKeyFromBoundaryKey,
  sortScheduledBoundaryEvents,
} from "../../functions/eventsScheduled/segmentResolvers";
import type { ConvexVesselTimelineEvent } from "../../functions/vesselTimeline/schemas";

/**
 * Composite lookup for attaching actuals to scheduled rows (PR3): aligned
 * schedule segment plus boundary type.
 *
 * @param scheduleSegment - Canonical segment key (without `--dep-dock` / `--arv-dock`)
 * @param eventType - Boundary type on the scheduled row
 */
const scheduleAttachmentKey = (
  scheduleSegment: string,
  eventType: ConvexScheduledBoundaryEvent["EventType"]
) => `${scheduleSegment}|${eventType}`;

/**
 * Merges sparse actual and predicted overlays onto the scheduled event
 * backbone for one vessel/day.
 *
 * @param args - Normalized event tables for the current vessel/day scope
 * @returns Ordered timeline events for the public event-first API
 */
export const mergeTimelineRows = ({
  scheduledEvents,
  actualEvents,
  predictedEvents,
}: {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
}): ConvexVesselTimelineEvent[] => {
  const actualByScheduleKeyAndType = new Map<
    string,
    ConvexActualBoundaryEvent
  >();

  for (const actual of actualEvents) {
    if (!actual.ScheduleKey) {
      continue;
    }

    const k = scheduleAttachmentKey(actual.ScheduleKey, actual.EventType);
    if (!actualByScheduleKeyAndType.has(k)) {
      actualByScheduleKeyAndType.set(k, actual);
    }
  }

  const sortedScheduledEvents = [...scheduledEvents].sort(
    sortScheduledBoundaryEvents
  );

  // Heuristic arrival attachment (fallback passes) is only for schedule-aligned
  // actuals (`ScheduleKey` set). Physical-only arrivals stay off the backbone.
  const scheduleKeyedArrivalActuals = actualEvents
    .filter(
      (
        event
      ): event is ConvexActualBoundaryEvent & { EventActualTime: number } =>
        event.EventType === "arv-dock" &&
        event.EventActualTime !== undefined &&
        event.ScheduleKey !== undefined
    )
    .sort(
      (left, right) =>
        left.EventActualTime - right.EventActualTime ||
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.EventKey.localeCompare(right.EventKey)
    );

  const assignedArrivalActualByScheduledKey = new Map<
    string,
    ConvexActualBoundaryEvent
  >();
  const usedActualArrivalEventKeys = new Set<string>();

  /**
   * Exact `ScheduleKey + EventType` for arrivals before heuristics.
   */
  for (const event of sortedScheduledEvents) {
    if (event.EventType !== "arv-dock") {
      continue;
    }

    const segment = getSegmentKeyFromBoundaryKey(event.Key);
    const direct = actualByScheduleKeyAndType.get(
      scheduleAttachmentKey(segment, "arv-dock")
    );

    if (!direct) {
      continue;
    }

    assignedArrivalActualByScheduledKey.set(event.Key, direct);
    usedActualArrivalEventKeys.add(direct.EventKey);
  }

  /**
   * Terminal + scheduled departure alignment for unmatched arrival rows
   * (bounded fallback).
   */
  for (const event of sortedScheduledEvents) {
    if (
      event.EventType !== "arv-dock" ||
      assignedArrivalActualByScheduledKey.has(event.Key)
    ) {
      continue;
    }

    const anchored = scheduleKeyedArrivalActuals.find(
      (actual) =>
        !usedActualArrivalEventKeys.has(actual.EventKey) &&
        actual.TerminalAbbrev === event.TerminalAbbrev &&
        actual.ScheduledDeparture === event.ScheduledDeparture
    );

    if (!anchored) {
      continue;
    }

    assignedArrivalActualByScheduledKey.set(event.Key, anchored);
    usedActualArrivalEventKeys.add(anchored.EventKey);
  }

  const scheduledArrivalEventsByTerminal = new Map<
    string,
    ConvexScheduledBoundaryEvent[]
  >();

  for (const event of sortedScheduledEvents) {
    if (event.EventType !== "arv-dock") {
      continue;
    }

    const terminalEvents =
      scheduledArrivalEventsByTerminal.get(event.TerminalAbbrev) ?? [];
    terminalEvents.push(event);
    scheduledArrivalEventsByTerminal.set(event.TerminalAbbrev, terminalEvents);
  }

  for (const [
    terminalAbbrev,
    terminalArrivalEvents,
  ] of scheduledArrivalEventsByTerminal) {
    let previousAssignedArrivalActualTime: number | undefined;

    for (let index = 0; index < terminalArrivalEvents.length; index += 1) {
      const event = terminalArrivalEvents[index];
      const existing = assignedArrivalActualByScheduledKey.get(event.Key);

      if (existing?.EventActualTime !== undefined) {
        previousAssignedArrivalActualTime = existing.EventActualTime;
        continue;
      }

      const candidate = scheduleKeyedArrivalActuals.find(
        (actual) =>
          !usedActualArrivalEventKeys.has(actual.EventKey) &&
          actual.TerminalAbbrev === terminalAbbrev &&
          (previousAssignedArrivalActualTime === undefined ||
            actual.EventActualTime > previousAssignedArrivalActualTime)
      );

      if (!candidate) {
        continue;
      }

      const nextEquivalentArrival = terminalArrivalEvents[index + 1];

      if (
        nextEquivalentArrival &&
        candidate.EventActualTime > getBoundaryTime(nextEquivalentArrival)
      ) {
        continue;
      }

      assignedArrivalActualByScheduledKey.set(event.Key, candidate);
      usedActualArrivalEventKeys.add(candidate.EventKey);
      previousAssignedArrivalActualTime = candidate.EventActualTime;
    }
  }

  /**
   * Resolves the actual row for one scheduled boundary: exact `ScheduleKey`
   * + `EventType` first, then arrival heuristic map.
   *
   * @param event - Scheduled boundary row
   * @returns Matching actual row when found
   */
  const resolveActualForScheduledEvent = (
    event: ConvexScheduledBoundaryEvent
  ) => {
    const segment = getSegmentKeyFromBoundaryKey(event.Key);
    const exact = actualByScheduleKeyAndType.get(
      scheduleAttachmentKey(segment, event.EventType)
    );

    if (exact) {
      return exact;
    }

    if (event.EventType !== "arv-dock") {
      return undefined;
    }

    return assignedArrivalActualByScheduledKey.get(event.Key);
  };

  /**
   * Multiple `eventsPredicted` rows may share one boundary `Key` (WSF vs ML).
   * Backbone uses WSF when present, else ML with legacy precedence
   * (AtSeaArriveNext before AtDockArriveNext).
   *
   * @param key - Scheduled boundary key
   * @returns Best predicted time for display
   */
  const pickPredictedTimeForKey = (key: string) => {
    const candidates = predictedEvents.filter((e) => e.Key === key);

    if (candidates.length === 0) {
      return undefined;
    }

    const wsf = candidates.find((e) => e.PredictionSource === "wsf_eta");

    if (wsf) {
      return wsf.EventPredictedTime;
    }

    const seaMl = candidates.find(
      (e) =>
        e.PredictionSource === "ml" && e.PredictionType === "AtSeaArriveNext"
    );

    if (seaMl) {
      return seaMl.EventPredictedTime;
    }

    const dockMl = candidates.find(
      (e) =>
        e.PredictionSource === "ml" && e.PredictionType === "AtDockArriveNext"
    );

    return dockMl?.EventPredictedTime ?? candidates[0]?.EventPredictedTime;
  };

  return sortedScheduledEvents.map((event) => {
    const actualRow = resolveActualForScheduledEvent(event);

    return {
      SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventType: event.EventType,
      EventScheduledTime: event.EventScheduledTime,
      EventPredictedTime: pickPredictedTimeForKey(event.Key),
      EventOccurred:
        actualRow?.EventOccurred ??
        (actualRow?.EventActualTime !== undefined ? true : undefined),
      EventActualTime: actualRow?.EventActualTime,
    };
  });
};
