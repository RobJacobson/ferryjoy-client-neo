/**
 * Builds the event-first VesselTimeline read backbone from normalized tables.
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
 * Merges sparse actual and predicted overlays onto the scheduled event
 * backbone for one vessel/day.
 *
 * @param args - Normalized event tables for the current vessel/day scope
 * @returns Ordered timeline events for the public event-first API
 */
export const mergeTimelineEvents = ({
  scheduledEvents,
  actualEvents,
  predictedEvents,
}: {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
}): ConvexVesselTimelineEvent[] => {
  const actualByKey = new Map(actualEvents.map((event) => [event.Key, event]));
  const sortedScheduledEvents = [...scheduledEvents].sort(sortScheduledBoundaryEvents);
  const actualArrivalEvents = actualEvents
    .filter(
      (event): event is ConvexActualBoundaryEvent & { EventActualTime: number } =>
        event.Key.endsWith("--arv-dock") && event.EventActualTime !== undefined
    )
    .sort(
      (left, right) =>
        left.EventActualTime - right.EventActualTime ||
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.Key.localeCompare(right.Key)
    );
  const assignedArrivalActualByScheduledKey = new Map<
    string,
    ConvexActualBoundaryEvent
  >();
  const usedActualArrivalKeys = new Set<string>();

  /**
   * Preserve exact-key arrival overlays first so heuristic matching never steals
   * a fact from its canonical row.
   */
  for (const event of sortedScheduledEvents) {
    if (event.EventType !== "arv-dock") {
      continue;
    }
    const direct = actualByKey.get(event.Key);
    if (!direct) {
      continue;
    }
    assignedArrivalActualByScheduledKey.set(event.Key, direct);
    usedActualArrivalKeys.add(direct.Key);
  }

  /**
   * Preserve the legacy stale-key arrival lookup before broader terminal-order
   * matching.
   */
  for (const event of sortedScheduledEvents) {
    if (
      event.EventType !== "arv-dock" ||
      assignedArrivalActualByScheduledKey.has(event.Key)
    ) {
      continue;
    }
    const anchored = actualArrivalEvents.find(
      (actual) =>
        !usedActualArrivalKeys.has(actual.Key) &&
        actual.TerminalAbbrev === event.TerminalAbbrev &&
        actual.ScheduledDeparture === event.ScheduledDeparture
    );
    if (!anchored) {
      continue;
    }
    assignedArrivalActualByScheduledKey.set(event.Key, anchored);
    usedActualArrivalKeys.add(anchored.Key);
  }

  /**
   * For stale schedule skeletons, fill blank arrival rows by terminal-order
   * matching without crossing the next scheduled arrival at that terminal.
   */
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

  for (const [terminalAbbrev, terminalArrivalEvents] of scheduledArrivalEventsByTerminal) {
    let previousAssignedArrivalActualTime: number | undefined;

    for (let index = 0; index < terminalArrivalEvents.length; index += 1) {
      const event = terminalArrivalEvents[index];
      const existing = assignedArrivalActualByScheduledKey.get(event.Key);
      if (existing?.EventActualTime !== undefined) {
        previousAssignedArrivalActualTime = existing.EventActualTime;
        continue;
      }

      const candidate = actualArrivalEvents.find(
        (actual) =>
          !usedActualArrivalKeys.has(actual.Key) &&
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
      usedActualArrivalKeys.add(candidate.Key);
      previousAssignedArrivalActualTime = candidate.EventActualTime;
    }
  }

  /**
   * When an actual row was stored under a stale/orphan boundary `Key`, match it
   * to the scheduled arrival using the arrival assignment pass above.
   */
  const resolveActualForScheduledEvent = (
    event: ConvexScheduledBoundaryEvent
  ) => {
    const direct = actualByKey.get(event.Key);
    if (direct) {
      return direct;
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
