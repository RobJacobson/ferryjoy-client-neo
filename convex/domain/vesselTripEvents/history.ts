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
  actualDeparture: number;
  arrivalProxy: number;
};

type HistoryActualSource = "departure-actual" | "arrival-proxy";

export const mergeSeededEventsWithHistory = ({
  sailingDay,
  seededEvents,
  existingEvents,
  scheduleSegments,
  historyRecords,
}: MergeSeededEventsWithHistoryArgs): ConvexVesselTripEvent[] => {
  const existingByKey = new Map(existingEvents.map((event) => [event.Key, event]));
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
        mergedActualTime === undefined ? existingEvent?.PredictedTime : undefined,
    };
  });
};

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
    getDirectRawSeedSegments(scheduleSegments).map((segment) => [segment.Key, segment])
  );
  const actualsByEventKey = new Map<string, number>();

  for (const record of historyRecords) {
    const normalizedRecord = normalizeHistoryRecord(record, sailingDay);
    if (!normalizedRecord) {
      continue;
    }

    const directSegment = directSegmentsByTripKey.get(normalizedRecord.tripKey);
    if (!directSegment) {
      continue;
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

    actualsByEventKey.set(departureEventKey, normalizedRecord.actualDeparture);
    actualsByEventKey.set(arrivalEventKey, normalizedRecord.arrivalProxy);
  }

  return actualsByEventKey;
};

const normalizeHistoryRecord = (
  record: VesselHistory,
  sailingDay: string
): NormalizedHistoryRecord | null => {
  const scheduledDepart = record.ScheduledDepart;
  const actualDeparture = record.ActualDepart?.getTime();
  const arrivalProxy = record.EstArrival?.getTime();
  const vesselRaw = record.Vessel ? String(record.Vessel).trim() : "";
  const vesselAbbrev = normalizeVesselAbbrev(vesselRaw);
  const departingTerminalAbbrev = normalizeTerminalAbbrev(record.Departing ?? "");
  const arrivingTerminalAbbrev = normalizeTerminalAbbrev(record.Arriving ?? "");

  if (
    !scheduledDepart ||
    actualDeparture === undefined ||
    arrivalProxy === undefined ||
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

const normalizeVesselAbbrev = (vesselRaw: string) => {
  if (/^[A-Z]{2,4}$/.test(vesselRaw)) {
    return vesselRaw;
  }

  return getVesselAbbreviation(vesselRaw);
};

const normalizeTerminalAbbrev = (terminalName: string) =>
  config.getTerminalAbbrev(terminalName) || "";

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
