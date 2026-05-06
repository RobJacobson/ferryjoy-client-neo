/**
 * History-backed enrichment for schedule-seeded boundary events.
 *
 * Merges prior slice state, WSF vessel history, and strict segment resolution
 * into DockBoundaryEventRecord actual times before reload persists scheduled and
 * actual tables.
 */

import {
  resolveTerminalByAbbrev,
  resolveTerminalByName,
  type TerminalIdentity,
  tryResolveVessel,
  type VesselIdentity,
} from "adapters";
import { buildBoundaryKey, buildSegmentKey } from "../../../shared/keys";
import { getDirectRawSeedSegments } from "../scheduled/buildScheduledDockEventRecords";
import { createSeededScheduleSegmentResolver } from "../scheduled/scheduleDepartureLookup";
import type {
  DockBoundaryEventRecord,
  EventReloadScheduleSegment,
} from "../scheduled/types";
import type { EventReloadHistoryRecord } from "./reloadTypes";

// History can disagree slightly with live or prior seed data; only replace the
// stored actual when the delta exceeds this window (stricter for proxy arrivals).
const DEPARTURE_ACTUAL_REPLACEMENT_THRESHOLD_MS = 3 * 60 * 1000;
const ARRIVAL_PROXY_REPLACEMENT_THRESHOLD_MS = 2 * 60 * 1000;

type HydrateSeededEventsWithHistoryArgs = {
  seededEvents: DockBoundaryEventRecord[];
  existingEvents: DockBoundaryEventRecord[];
  scheduleSegments: EventReloadScheduleSegment[];
  historyRecords: EventReloadHistoryRecord[];
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
 * Enriches seeded boundary rows with existing slice state and external history.
 *
 * For each seeded Key, merges EventActualTime from existingEvents when present,
 * then blends WSF history actuals that align to the same direct segments.
 * Departure uses measured ActualDepart; arrival uses EstArrival as a proxy when
 * needed. Clears EventPredictedTime once a merged actual exists so downstream
 * reload does not treat the row as prediction-driven.
 *
 * @param args.seededEvents - Schedule-built boundary records for the sailing day
 * @param args.existingEvents - Prior hydrated rows for the same keys, if any
 * @param args.scheduleSegments - Raw segments used to restrict history to direct legs
 * @param args.historyRecords - Vessel history rows fetched for those vessels and day
 * @param args.vessels - Vessel identity table for strict resolution
 * @param args.terminals - Terminal identity table for strict resolution
 * @returns Seeded events with EventOccurred and EventActualTime updated in place per key
 */
const hydrateActualDockEvents = ({
  seededEvents,
  existingEvents,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: HydrateSeededEventsWithHistoryArgs): DockBoundaryEventRecord[] => {
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

/**
 * Projects external history onto canonical dep-dock and arv-dock boundary keys.
 *
 * Strict resolution maps each history row to a segment Key when terminals and
 * vessel resolve; otherwise a seeded-schedule resolver aligns ScheduledDepart
 * to SegmentKey when the segment exists in the direct-seed set. Each contributor
 * row may set departure actual and arrival proxy independently for later blending.
 *
 * @param args.seededEvents - Hydrated seeds used for fallback segment alignment
 * @param args.scheduleSegments - Raw segments feeding direct segment classification
 * @param args.historyRecords - External history rows for the reload window
 * @param args.vessels - Vessel identities for resolveVesselHistory and tryResolveVessel
 * @param args.terminals - Terminal identities for resolveVesselHistory
 * @returns Map from boundary Key string to latest contributing timestamp from history
 */
const getHistoryActualsByEventKey = ({
  seededEvents,
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  seededEvents: DockBoundaryEventRecord[];
  scheduleSegments: EventReloadScheduleSegment[];
  historyRecords: EventReloadHistoryRecord[];
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
    const actualDeparture = record.ActualDepart;
    const arrivalProxy = record.EstArrival;
    const vessel = tryResolveVessel(
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
      const scheduledDepartRaw = record.ScheduledDepart;
      if (
        scheduledDepartRaw !== undefined &&
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

/**
 * Attempts strict vessel-terminal resolution for one history row.
 *
 * Requires ScheduledDepart plus at least one of ActualDepart or EstArrival so
 * there is something to contribute. Builds the canonical segment key through
 * buildSegmentKey when resolveVesselHistory succeeds.
 *
 * @param record - Raw WSF vessel history row
 * @param vessels - Known vessel identities
 * @param terminals - Known terminal identities
 * @returns TripKey plus departure and arrival-proxy milliseconds when resolution succeeds
 */
const normalizeHistoryRecordStrict = (
  record: EventReloadHistoryRecord,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): NormalizedHistoryRecord | null => {
  const scheduledDepart = record.ScheduledDepart;
  const actualDeparture = record.ActualDepart;
  const arrivalProxy = record.EstArrival;
  const resolvedHistory = resolveReloadHistoryRecord(
    record,
    vessels,
    terminals
  );

  if (
    scheduledDepart === undefined ||
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
    new Date(scheduledDepart)
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

const HISTORY_TERMINAL_ABBREV_ALIASES: Record<string, string> = {
  Colman: "P52",
  Keystone: "COU",
  Vashon: "VAI",
};

/**
 * Resolves vessel and terminal identities for a numeric reload history row.
 *
 * This mirrors WSF history identity resolution without requiring the domain
 * reload path to reconstruct adapter Date-shaped history objects.
 *
 * @param record - Numeric reload history row
 * @param vessels - Backend vessel identity rows
 * @param terminals - Backend terminal identity rows
 * @returns Resolved identities, or null when any lookup fails
 */
const resolveReloadHistoryRecord = (
  record: EventReloadHistoryRecord,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
) => {
  const vessel = tryResolveVessel(
    record.Vessel ? String(record.Vessel) : "",
    vessels
  );
  const departingTerminal = resolveHistoryTerminal(
    record.Departing ?? "",
    terminals
  );
  const arrivingTerminal = resolveHistoryTerminal(
    record.Arriving ?? "",
    terminals
  );

  return vessel && departingTerminal && arrivingTerminal
    ? { vessel, departingTerminal, arrivingTerminal }
    : null;
};

/**
 * Resolves a terminal row from a WSF history terminal label.
 *
 * History rows can use canonical terminal names or a small set of legacy labels.
 * This keeps reload hydration aligned with adapter history resolution.
 *
 * @param terminalName - Raw terminal label from a history row
 * @param terminals - Backend terminal identity rows
 * @returns Matching terminal row, or null when the label is unknown
 */
const resolveHistoryTerminal = (
  terminalName: string,
  terminals: ReadonlyArray<TerminalIdentity>
): TerminalIdentity | null => {
  const normalized = terminalName.trim();

  if (!normalized) {
    return null;
  }

  const exactMatch = resolveTerminalByName(normalized, terminals);

  if (exactMatch) {
    return exactMatch;
  }

  const aliasAbbrev = HISTORY_TERMINAL_ABBREV_ALIASES[normalized];

  return aliasAbbrev ? resolveTerminalByAbbrev(aliasAbbrev, terminals) : null;
};

/**
 * Chooses between existing slice times and history when both supply an instant.
 *
 * Tiny drift between sources is treated as noise and keeps the existing value.
 * Larger deltas imply the history feed is materially newer (for example a late
 * correction), so history wins. Thresholds differ: arrival-proxy uses a tighter
 * window because EstArrival is less authoritative than measured departure.
 *
 * @param existingActualTime - Milliseconds already chosen for this boundary, if any
 * @param historyActualTime - Milliseconds contributed from WSF history, if any
 * @param source - Whether this boundary behaves like departure actual or arrival proxy
 * @returns Single merged millisecond instant, or undefined when neither side provides one
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

export { hydrateActualDockEvents };
