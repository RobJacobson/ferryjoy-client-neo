/**
 * History-backed enrichment for schedule-seeded boundary events.
 */

import type { TerminalIdentity } from "adapters/wsf/resolveTerminal";
import { resolveVessel, type VesselIdentity } from "adapters/wsf/resolveVessel";
import { resolveVesselHistory } from "adapters/wsf/resolveVesselHistory";
import type { RawWsfScheduleSegment } from "adapters/wsf/scheduledTrips/types";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type { ConvexVesselTimelineEventRecord } from "../../functions/vesselTimeline/schemas";
import { buildBoundaryKey, buildSegmentKey } from "../../shared/keys";
import { createSeededScheduleSegmentResolver } from "./scheduleDepartureLookup";
import { getDirectRawSeedSegments } from "./seedScheduledEvents";

const DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS = 3 * 60 * 1000;
const ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS = 2 * 60 * 1000;

type HydrateSeededEventsWithHistoryArgs = {
  seededEvents: ConvexVesselTimelineEventRecord[];
  existingEvents: ConvexVesselTimelineEventRecord[];
  scheduleSegments: RawWsfScheduleSegment[];
  historyRecords: VesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
};

type NormalizedHistoryRecord = {
  tripKey: string;
  actualDeparture?: number;
  arrivalProxy?: number;
};

type HistoryActualSource = "departure-actual" | "arrival-proxy";

/**
 * Hydrates schedule-seeded rows with stored/live state and WSF history actuals.
 *
 * @param args - Seeded events for one sailing day plus history and segment context
 * @returns Seeded events with historical actuals folded in
 */
export const hydrateSeededEventsWithHistory = ({
  seededEvents,
  existingEvents,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: HydrateSeededEventsWithHistoryArgs): ConvexVesselTimelineEventRecord[] => {
  const existingByKey = new Map(
    existingEvents.map((event) => [event.Key, event])
  );
  const historyActualsByEventKey = getHistoryActualsByEventKey({
    seededEvents,
    scheduleSegments,
    historyRecords,
    vessels,
    terminals,
  });

  return seededEvents.map((event) => {
    const existingEvent = existingByKey.get(event.Key);
    const historyActualTime = historyActualsByEventKey.get(event.Key);
    const mergedActualTime = mergeActualTime(
      existingEvent?.EventActualTime,
      historyActualTime,
      event.EventType === "dep-dock" ? "departure-actual" : "arrival-proxy"
    );

    return {
      ...event,
      EventOccurred:
        mergedActualTime !== undefined ? true : existingEvent?.EventOccurred,
      EventActualTime: mergedActualTime,
      EventPredictedTime:
        mergedActualTime === undefined
          ? existingEvent?.EventPredictedTime
          : undefined,
    };
  });
};

const getHistoryActualsByEventKey = ({
  seededEvents,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  seededEvents: ConvexVesselTimelineEventRecord[];
  scheduleSegments: RawWsfScheduleSegment[];
  historyRecords: VesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}) => {
  const directSegmentsByTripKey = new Map(
    getDirectRawSeedSegments(scheduleSegments, vessels, terminals).map(
      (segment) => [segment.Key, segment]
    )
  );
  const resolveSegmentFromSeededSchedule =
    createSeededScheduleSegmentResolver(seededEvents);

  return historyRecords.reduce((actualsByEventKey, record) => {
    const actualDeparture = record.ActualDepart?.getTime();
    const arrivalProxy = record.EstArrival?.getTime();
    const vessel = resolveVessel(
      record.Vessel ? String(record.Vessel) : "",
      vessels
    );

    const strictRecord = normalizeHistoryRecordStrict(
      record,
      vessels,
      terminals
    );

    let tripKey: string | undefined;

    if (strictRecord && directSegmentsByTripKey.has(strictRecord.tripKey)) {
      tripKey = strictRecord.tripKey;
    }

    if (tripKey === undefined) {
      const scheduledDepartRaw = record.ScheduledDepart ?? undefined;
      if (
        scheduledDepartRaw &&
        vessel !== null &&
        (actualDeparture !== undefined || arrivalProxy !== undefined)
      ) {
        const fallbackKey = resolveSegmentFromSeededSchedule(
          vessel.VesselAbbrev,
          scheduledDepartRaw
        );
        if (
          fallbackKey !== undefined &&
          directSegmentsByTripKey.has(fallbackKey)
        ) {
          tripKey = fallbackKey;
        }
      }
    }

    if (tripKey === undefined) {
      return actualsByEventKey;
    }

    const departureEventKey = buildBoundaryKey(tripKey, "dep-dock");
    const arrivalEventKey = buildBoundaryKey(tripKey, "arv-dock");

    if (actualDeparture !== undefined) {
      actualsByEventKey.set(departureEventKey, actualDeparture);
    }

    if (arrivalProxy !== undefined) {
      actualsByEventKey.set(arrivalEventKey, arrivalProxy);
    }

    return actualsByEventKey;
  }, new Map<string, number>());
};

const normalizeHistoryRecordStrict = (
  record: VesselHistory,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): NormalizedHistoryRecord | null => {
  const scheduledDepart = record.ScheduledDepart;
  const actualDeparture = record.ActualDepart?.getTime();
  const arrivalProxy = record.EstArrival?.getTime();
  const resolvedHistory = resolveVesselHistory(record, vessels, terminals);

  if (
    !scheduledDepart ||
    (actualDeparture === undefined && arrivalProxy === undefined) ||
    resolvedHistory === null
  ) {
    return null;
  }

  const vesselAbbrev = resolvedHistory.vessel.VesselAbbrev;
  const departingTerminalAbbrev =
    resolvedHistory.departingTerminal.TerminalAbbrev;
  const arrivingTerminalAbbrev =
    resolvedHistory.arrivingTerminal.TerminalAbbrev;

  const tripKey = buildSegmentKey(
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDepart
  );

  if (!tripKey) {
    return null;
  }

  return {
    tripKey,
    actualDeparture,
    arrivalProxy,
  };
};

const mergeActualTime = (
  existingActualTime?: number,
  historyActualTime?: number,
  source?: HistoryActualSource
) => {
  if (existingActualTime === undefined) {
    return historyActualTime;
  }

  if (historyActualTime === undefined) {
    return existingActualTime;
  }

  const replacementThreshold =
    source === "arrival-proxy"
      ? ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS
      : DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS;

  return Math.abs(existingActualTime - historyActualTime) >=
    replacementThreshold
    ? historyActualTime
    : existingActualTime;
};
