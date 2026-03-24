/**
 * History-backed enrichment for schedule-seeded vessel trip events.
 */
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import { config } from "../../domain/ml/shared/config";
import { getVesselAbbreviation } from "../../functions/scheduledTrips/schemas";
import type { ConvexVesselTripEvent } from "../../functions/vesselTripEvents/schemas";
import type { RawWsfScheduleSegment } from "../../shared/fetchWsfScheduleData";
import { generateTripKey } from "../../shared/keys";
import { getSailingDay } from "../../shared/time";
import { buildEventKey } from "./liveUpdates";
import { getDirectRawSeedSegments } from "./seed";

const DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS = 3 * 60 * 1000;
const ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS = 2 * 60 * 1000;

type MergeSeededEventsWithHistoryArgs = {
  sailingDay: string;
  seededEvents: ConvexVesselTripEvent[];
  existingEvents: ConvexVesselTripEvent[];
  scheduleSegments: RawWsfScheduleSegment[];
  historyRecords: VesselHistory[];
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
}: MergeSeededEventsWithHistoryArgs): ConvexVesselTripEvent[] => {
  const existingByKey = new Map(
    existingEvents.map((event) => [event.Key, event])
  );
  const historyActualsByEventKey = getHistoryActualsByEventKey({
    sailingDay,
    scheduleSegments,
    historyRecords,
  });

  return seededEvents.map((event) => {
    const existingEvent = existingByKey.get(event.Key);
    const historyActualTime = historyActualsByEventKey.get(event.Key);
    const mergedActualTime = mergeActualTime(
      existingEvent?.ActualTime,
      historyActualTime,
      event.EventType === "dep-dock" ? "departure-actual" : "arrival-proxy"
    );

    return {
      ...event,
      ActualTime: mergedActualTime,
      PredictedTime:
        mergedActualTime === undefined
          ? existingEvent?.PredictedTime
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
}: {
  sailingDay: string;
  scheduleSegments: RawWsfScheduleSegment[];
  historyRecords: VesselHistory[];
}) => {
  const directSegmentsByTripKey = new Map(
    getDirectRawSeedSegments(scheduleSegments).map((segment) => [
      segment.Key,
      segment,
    ])
  );
  return historyRecords.reduce((actualsByEventKey, record) => {
    const normalizedRecord = normalizeHistoryRecord(record, sailingDay);
    if (!normalizedRecord) {
      return actualsByEventKey;
    }

    const directSegment = directSegmentsByTripKey.get(normalizedRecord.tripKey);
    if (!directSegment) {
      return actualsByEventKey;
    }

    const departureEventKey = buildEventKey(
      sailingDay,
      directSegment.VesselAbbrev,
      directSegment.DepartingTime,
      directSegment.DepartingTerminalAbbrev,
      "dep-dock"
    );
    const arrivalEventKey = buildEventKey(
      sailingDay,
      directSegment.VesselAbbrev,
      directSegment.DepartingTime,
      directSegment.DepartingTerminalAbbrev,
      "arv-dock"
    );

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
  sailingDay: string
): NormalizedHistoryRecord | null => {
  const scheduledDepart = record.ScheduledDepart;
  const actualDeparture = record.ActualDepart?.getTime();
  const arrivalProxy = record.EstArrival?.getTime();
  const vesselRaw = record.Vessel ? String(record.Vessel).trim() : "";
  const vesselAbbrev = normalizeVesselAbbrev(vesselRaw);
  const departingTerminalAbbrev = normalizeTerminalAbbrev(
    record.Departing ?? ""
  );
  const arrivingTerminalAbbrev = normalizeTerminalAbbrev(record.Arriving ?? "");

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

  const tripKey = generateTripKey(
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

/**
 * Normalizes a vessel identifier into the abbreviation used by schedule data.
 *
 * @param vesselRaw - Raw vessel identifier or name from WSF history
 * @returns Vessel abbreviation or `undefined` when it cannot be resolved
 */
const normalizeVesselAbbrev = (vesselRaw: string) => {
  if (/^[A-Z]{2,4}$/.test(vesselRaw)) {
    return vesselRaw;
  }

  return getVesselAbbreviation(vesselRaw);
};

/**
 * Normalizes a terminal name into the abbreviation used by schedule data.
 *
 * @param terminalName - Raw terminal name from WSF history
 * @returns Terminal abbreviation or an empty string when unresolved
 */
const normalizeTerminalAbbrev = (terminalName: string) =>
  config.getTerminalAbbrev(terminalName) || "";

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
