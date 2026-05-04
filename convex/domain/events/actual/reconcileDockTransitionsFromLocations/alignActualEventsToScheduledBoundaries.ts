/**
 * Aligns scheduled boundary rows with stored actual rows for one slice.
 *
 * Sorts scheduled rows for deterministic pairing, indexes actual rows by
 * segment plus event type, then layers stale-key arrival matching so arrival
 * confirmations survive boundary-key churn between ingest passes. The output
 * is the neutral boundary-event row that downstream confirmation gates use.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import { groupBy } from "../../../../shared/groupBy";
import {
  getBoundaryTime,
  getSegmentKeyFromBoundaryKey,
  sortScheduledDockEvents,
} from "../../scheduled/scheduledSegmentResolvers";
import type { LocationReconcileBoundaryEvent } from "./types";

/**
 * Aligns scheduled boundaries with stored actual rows for one vessels slice.
 *
 * Sorts scheduled rows for deterministic pairing, indexes actual rows by
 * segment plus event type, then layers stale-key arrival matching so arrival
 * confirmations survive boundary-key churn between ingest passes.
 *
 * @param args.scheduledEvents - Planned dock boundaries for one vessel and sailing day
 * @param args.actualEvents - Existing actual rows considered for matching
 * @returns Boundary rows enriched with current EventOccurred and EventActualTime
 */
const buildLocationReconcileBoundaryEvents = ({
  scheduledEvents,
  actualEvents,
}: {
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
}): LocationReconcileBoundaryEvent[] => {
  const sortedScheduledEvents = [...scheduledEvents].sort(
    sortScheduledDockEvents
  );
  const exactActualByScheduleKey = buildExactActualLookup(actualEvents);
  const arrivalActualByScheduledKey = buildArrivalActualLookup(
    sortedScheduledEvents,
    actualEvents,
    exactActualByScheduleKey
  );

  return sortedScheduledEvents.map((event) => {
    const actualRow =
      exactActualByScheduleKey.get(scheduledActualLookupKey(event)) ??
      arrivalActualByScheduledKey.get(event.Key);

    return {
      SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventType: event.EventType,
      EventScheduledTime: event.EventScheduledTime,
      EventOccurred:
        actualRow?.EventOccurred ??
        (actualRow?.EventActualTime !== undefined ? true : undefined),
      EventActualTime: actualRow?.EventActualTime,
    };
  });
};

/**
 * Indexes actual rows that align cleanly with ScheduleKey plus event type.
 *
 * Keeps the first seen row per composite key so reconcile prefers stable
 * schedule-backed identity before heuristic arrival reassignment runs.
 *
 * @param actualEvents - Persisted actual dock rows for the reload slice
 * @returns Map from segment-plus-type key to representative actual row
 */
const buildExactActualLookup = (actualEvents: ConvexActualDockEvent[]) => {
  const actualByScheduleKeyAndType = new Map<string, ConvexActualDockEvent>();

  for (const actual of actualEvents) {
    if (!actual.ScheduleKey) {
      continue;
    }

    const key = actualLookupKey(actual.ScheduleKey, actual.EventType);
    if (!actualByScheduleKeyAndType.has(key)) {
      actualByScheduleKeyAndType.set(key, actual);
    }
  }

  return actualByScheduleKeyAndType;
};

/**
 * Builds arrival lookups when persisted rows still reference stale boundary Keys.
 *
 * Starts from exact schedule matches, then assigns remaining arrival rows by
 * same departure time at the terminal, then fills gaps in terminal arrival
 * order without double-using one physical actual EventKey.
 *
 * @param scheduledEvents - Ordered scheduled boundaries including arrivals
 * @param actualEvents - All actual rows for the vessel/day scope
 * @param exactActualByScheduleKey - Exact lookup produced by buildExactActualLookup
 * @returns Map from scheduled arrival boundary Key to best matching actual arrival row
 */
const buildArrivalActualLookup = (
  scheduledEvents: ConvexScheduledDockEvent[],
  actualEvents: ConvexActualDockEvent[],
  exactActualByScheduleKey: Map<string, ConvexActualDockEvent>
) => {
  const scheduleKeyedArrivalActuals = actualEvents
    .filter(
      (event): event is ConvexActualDockEvent & { EventActualTime: number } =>
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
    ConvexActualDockEvent
  >();
  const usedActualArrivalEventKeys = new Set<string>();

  for (const event of scheduledEvents) {
    if (event.EventType !== "arv-dock") {
      continue;
    }

    const direct = exactActualByScheduleKey.get(
      scheduledActualLookupKey(event)
    );
    if (!direct) {
      continue;
    }

    assignedArrivalActualByScheduledKey.set(event.Key, direct);
    usedActualArrivalEventKeys.add(direct.EventKey);
  }

  assignSameDepartureArrivalActuals(
    scheduledEvents,
    scheduleKeyedArrivalActuals,
    assignedArrivalActualByScheduledKey,
    usedActualArrivalEventKeys
  );
  assignOrderedArrivalActuals(
    scheduledEvents,
    scheduleKeyedArrivalActuals,
    assignedArrivalActualByScheduledKey,
    usedActualArrivalEventKeys
  );

  return assignedArrivalActualByScheduledKey;
};

/**
 * Assigns arrival actuals that share terminal and scheduled departure with the slot.
 *
 * Handles cases where the stored arrival row still points at an older boundary
 * Key while schedule-shaped scheduled departure stayed aligned with the
 * intended berth.
 *
 * @param scheduledEvents - Ordered scheduled boundaries for the vessel day
 * @param arrivalActuals - Candidate arrival rows with measurable EventActualTime
 * @param assignedArrivalActualByScheduledKey - Mutable map from scheduled Key to actual row
 * @param usedActualArrivalEventKeys - Mutable set of consumed physical EventKey values
 * @returns Nothing; mutates the map and set in place
 */
const assignSameDepartureArrivalActuals = (
  scheduledEvents: ConvexScheduledDockEvent[],
  arrivalActuals: Array<ConvexActualDockEvent & { EventActualTime: number }>,
  assignedArrivalActualByScheduledKey: Map<string, ConvexActualDockEvent>,
  usedActualArrivalEventKeys: Set<string>
) => {
  for (const event of scheduledEvents) {
    if (
      event.EventType !== "arv-dock" ||
      assignedArrivalActualByScheduledKey.has(event.Key)
    ) {
      continue;
    }

    const anchored = arrivalActuals.find(
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
};

/**
 * Assigns leftover arrival actuals by scanning terminal arrival order in time.
 *
 * Chooses the earliest unused arrival after the previous assignment at a pier,
 * and rejects candidates that would arrive after the next scheduled arrival
 * slot at that terminal to avoid crossing legs.
 *
 * @param scheduledEvents - Ordered scheduled boundaries for the vessel day
 * @param arrivalActuals - Candidate arrival rows sorted for deterministic picks
 * @param assignedArrivalActualByScheduledKey - Mutable map from scheduled Key to actual row
 * @param usedActualArrivalEventKeys - Mutable set of consumed physical EventKey values
 * @returns Nothing; mutates the map and set in place
 */
const assignOrderedArrivalActuals = (
  scheduledEvents: ConvexScheduledDockEvent[],
  arrivalActuals: Array<ConvexActualDockEvent & { EventActualTime: number }>,
  assignedArrivalActualByScheduledKey: Map<string, ConvexActualDockEvent>,
  usedActualArrivalEventKeys: Set<string>
) => {
  const scheduledArrivalEventsByTerminal = groupBy(
    scheduledEvents.filter((event) => event.EventType === "arv-dock"),
    (event) => event.TerminalAbbrev
  );

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

      const candidate = arrivalActuals.find(
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
};

/**
 * Builds the segment-plus-type lookup key used for scheduled boundary rows.
 *
 * @param event - Scheduled dock boundary whose Key encodes segment suffix
 * @returns Composite key shared with actualLookupKey for schedule-aligned joins
 */
const scheduledActualLookupKey = (event: ConvexScheduledDockEvent) =>
  actualLookupKey(getSegmentKeyFromBoundaryKey(event.Key), event.EventType);

/**
 * Concatenates segment identity with event type for Map lookups.
 *
 * @param scheduleSegment - Resolved ScheduleKey or segment string from the boundary Key
 * @param eventType - dep-dock or arv-dock discriminator
 * @returns Stable string key for exact actual row indexing
 */
const actualLookupKey = (
  scheduleSegment: string,
  eventType: ConvexScheduledDockEvent["EventType"]
) => `${scheduleSegment}|${eventType}`;

export { buildLocationReconcileBoundaryEvents };
