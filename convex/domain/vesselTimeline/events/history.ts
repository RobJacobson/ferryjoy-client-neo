/**
 * History-backed enrichment for schedule-seeded boundary events.
 */
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type { TerminalIdentity } from "../../../functions/terminals/resolver";
import type { ConvexVesselTimelineEventRecord } from "../../../functions/vesselTimeline/eventRecordSchemas";
import type { RawWsfScheduleSegment } from "../../../shared/fetchWsfScheduleData";
import { buildBoundaryKey, buildSegmentKey } from "../../../shared/keys";
import { resolveHistoryTerminalAbbrev } from "../../../shared/scheduleIdentity";
import { getSailingDay } from "../../../shared/time";
import {
  resolveVesselAbbrev,
  type VesselIdentity,
} from "../../../shared/vessels";
import { getDirectRawSeedSegments } from "./seed";

const DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS = 3 * 60 * 1000;
const ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS = 2 * 60 * 1000;

type MergeSeededEventsWithHistoryArgs = {
  sailingDay: string;
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
 * Merges schedule-seeded rows with stored/live state and WSF history actuals.
 *
 * @param args - Sailing day inputs used to enrich the seeded event set
 * @returns Seeded events with historical actuals folded in
 */
export const mergeSeededEventsWithHistory = ({
  sailingDay,
  seededEvents,
  existingEvents,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: MergeSeededEventsWithHistoryArgs): ConvexVesselTimelineEventRecord[] => {
  const existingByKey = new Map(
    existingEvents.map((event) => [event.Key, event])
  );
  const historyActualsByEventKey = getHistoryActualsByEventKey({
    sailingDay,
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
      EventActualTime: mergedActualTime,
      EventPredictedTime:
        mergedActualTime === undefined
          ? existingEvent?.EventPredictedTime
          : undefined,
    };
  });
};

/**
 * Builds a lookup of historical actual timestamps by stable event key.
 *
 * @param args - Sailing day inputs required to align history rows to events
 * @returns Event-keyed map of actual timestamps from vessel history
 */
const getHistoryActualsByEventKey = ({
  sailingDay,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  sailingDay: string;
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
  return historyRecords.reduce((actualsByEventKey, record) => {
    const normalizedRecord = normalizeHistoryRecord(
      record,
      sailingDay,
      vessels,
      terminals
    );
    if (!normalizedRecord) {
      return actualsByEventKey;
    }

    const directSegment = directSegmentsByTripKey.get(normalizedRecord.tripKey);
    if (!directSegment) {
      return actualsByEventKey;
    }

    const departureEventKey = buildBoundaryKey(directSegment.Key, "dep-dock");
    const arrivalEventKey = buildBoundaryKey(directSegment.Key, "arv-dock");

    if (normalizedRecord.actualDeparture !== undefined) {
      actualsByEventKey.set(
        departureEventKey,
        normalizedRecord.actualDeparture
      );
    }

    if (normalizedRecord.arrivalProxy !== undefined) {
      actualsByEventKey.set(arrivalEventKey, normalizedRecord.arrivalProxy);
    }

    return actualsByEventKey;
  }, new Map<string, number>());
};

/**
 * Normalizes one WSF vessel history row into the trip-keyed merge shape.
 *
 * @param record - Raw vessel history row from WSF
 * @param sailingDay - Sailing day currently being enriched
 * @returns Normalized history record or `null` when it cannot be matched
 */
const normalizeHistoryRecord = (
  record: VesselHistory,
  sailingDay: string,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): NormalizedHistoryRecord | null => {
  const scheduledDepart = record.ScheduledDepart;
  const actualDeparture = record.ActualDepart?.getTime();
  const arrivalProxy = record.EstArrival?.getTime();
  const vesselRaw = record.Vessel ? String(record.Vessel).trim() : "";
  const vesselAbbrev = normalizeVesselAbbrev(vesselRaw, vessels);
  const departingTerminalAbbrev = normalizeTerminalAbbrev(
    record.Departing ?? "",
    terminals
  );
  const arrivingTerminalAbbrev = normalizeTerminalAbbrev(
    record.Arriving ?? "",
    terminals
  );

  if (
    !scheduledDepart ||
    (actualDeparture === undefined && arrivalProxy === undefined) ||
    !vesselAbbrev ||
    !departingTerminalAbbrev ||
    !arrivingTerminalAbbrev ||
    getSailingDay(scheduledDepart) !== sailingDay
  ) {
    return null;
  }

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

const normalizeVesselAbbrev = (
  vesselRaw: string,
  vessels: ReadonlyArray<VesselIdentity>
) => resolveVesselAbbrev(vesselRaw, vessels) || "";

/**
 * Normalizes a terminal name into the abbreviation used by schedule data.
 *
 * @param terminalName - Raw terminal name from WSF history
 * @param terminals - Backend terminal identity rows
 * @returns Terminal abbreviation or an empty string when unresolved
 */
const normalizeTerminalAbbrev = (
  terminalName: string,
  terminals: ReadonlyArray<TerminalIdentity>
) => resolveHistoryTerminalAbbrev(terminalName, terminals) || "";

/**
 * Chooses between an existing stored actual and a history-derived actual.
 *
 * @param existingActualTime - Current stored actual timestamp, if any
 * @param historyActualTime - Candidate actual timestamp from vessel history
 * @param source - Type of history field supplying the candidate timestamp
 * @returns The actual timestamp that should be kept for the event
 */
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
