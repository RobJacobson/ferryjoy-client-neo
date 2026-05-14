/**
 * Maps WSF vessel history rows onto seeded reload boundary keys for dep/arv
 * actual time hydration.
 */

import {
  resolveVesselHistory,
  type TerminalIdentity,
  tryResolveVessel,
  type VesselIdentity,
} from "adapters";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type { WsfVesselHistory } from "./schemas";
import type { DockStatusEventRecord, RawSeedSegment } from "./types";

/**
 * Indexes history-derived actual depart and arrival-proxy times by event Key.
 *
 * Reload merges WSF vessel history into seeded boundary records to obtain
 * actual times when the live ping stream missed an arrival or departure.
 * Strict adapter resolution is tried first; rows that fail strict resolution
 * fall back to vessel abbrev plus scheduled departure to recover history
 * that names a vessel ambiguously.
 *
 * @param args.seededEvents - Schedule-derived boundary rows before history merge
 * @param args.directSeedSegments - Same-day raw seed segments by TripKey
 * @param args.historyRecords - WSF vessel history rows for the sailing day
 * @param args.vessels - Vessel identities for adapter resolution
 * @param args.terminals - Terminal identities for adapter resolution
 * @returns Map from boundary Key to actual time in epoch milliseconds
 */
const mapHistoryActualsToEventKeys = ({
  seededEvents,
  directSeedSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  seededEvents: DockStatusEventRecord[];
  directSeedSegments: RawSeedSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}) => {
  const directSegmentKeys = new Set(
    directSeedSegments.map((segment) => segment.Key)
  );
  const seededDeparturesByVesselTime = new Map(
    seededEvents
      .filter((event) => event.EventType === "dep-dock")
      .map((event) => [
        toVesselDepartKey(event.VesselAbbrev, event.ScheduledDeparture),
        event.SegmentKey,
      ])
  );
  const actualsByEventKey = new Map<string, number>();

  for (const record of historyRecords) {
    if (
      record.ScheduledDepart === undefined ||
      (record.ActualDepart === undefined && record.EstArrival === undefined)
    ) {
      continue;
    }

    const tripKey =
      resolveStrictHistoryTripKey(
        record,
        directSegmentKeys,
        vessels,
        terminals
      ) ??
      resolveFallbackHistoryTripKey(
        record,
        directSegmentKeys,
        seededDeparturesByVesselTime,
        vessels
      );

    if (tripKey === undefined) {
      continue;
    }

    if (record.ActualDepart !== undefined) {
      actualsByEventKey.set(
        buildBoundaryKey(tripKey, "dep-dock"),
        record.ActualDepart
      );
    }

    if (record.EstArrival !== undefined) {
      actualsByEventKey.set(
        buildBoundaryKey(tripKey, "arv-dock"),
        record.EstArrival
      );
    }
  }

  return actualsByEventKey;
};

/**
 * Resolves a history row by vessel and terminal identities.
 *
 * @param record - WSF vessel history row
 * @param directSegmentKeys - Direct seed segment keys allowed for this reload
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Direct segment key or undefined when strict resolution fails
 */
const resolveStrictHistoryTripKey = (
  record: WsfVesselHistory,
  directSegmentKeys: Set<string>,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
) => {
  const resolvedHistory = resolveVesselHistory(
    toAdapterHistoryRecord(record),
    vessels,
    terminals
  );
  const tripKey =
    resolvedHistory === null || record.ScheduledDepart === undefined
      ? undefined
      : buildSegmentKey(
          resolvedHistory.vessel.VesselAbbrev,
          resolvedHistory.departingTerminal.TerminalAbbrev,
          resolvedHistory.arrivingTerminal.TerminalAbbrev,
          new Date(record.ScheduledDepart)
        );

  return tripKey !== undefined && directSegmentKeys.has(tripKey)
    ? tripKey
    : undefined;
};

/**
 * Resolves a history row by vessel name plus scheduled departure.
 *
 * @param record - WSF vessel history row
 * @param directSegmentKeys - Direct seed segment keys allowed for this reload
 * @param seededDeparturesByVesselTime - Seeded dep rows keyed by vessel and ms
 * @param vessels - Vessel identities for adapter resolution
 * @returns Direct segment key or undefined when fallback resolution fails
 */
const resolveFallbackHistoryTripKey = (
  record: WsfVesselHistory,
  directSegmentKeys: Set<string>,
  seededDeparturesByVesselTime: Map<string, string>,
  vessels: ReadonlyArray<VesselIdentity>
) => {
  const vessel = tryResolveVessel(
    record.Vessel === undefined ? "" : String(record.Vessel),
    vessels
  );
  const tripKey =
    vessel === null || record.ScheduledDepart === undefined
      ? undefined
      : seededDeparturesByVesselTime.get(
          toVesselDepartKey(vessel.VesselAbbrev, record.ScheduledDepart)
        );

  return tripKey !== undefined && directSegmentKeys.has(tripKey)
    ? tripKey
    : undefined;
};

/**
 * Maps a Convex reload history row to the adapter Date-shape used for resolve.
 *
 * @param row - Reload history row with epoch-ms timestamps
 * @returns Adapter-shaped history record with Date-valued timestamps
 */
const toAdapterHistoryRecord = (row: WsfVesselHistory): VesselHistory =>
  ({
    ...row,
    ScheduledDepart:
      row.ScheduledDepart === undefined
        ? undefined
        : new Date(row.ScheduledDepart),
    ActualDepart:
      row.ActualDepart === undefined ? undefined : new Date(row.ActualDepart),
    EstArrival:
      row.EstArrival === undefined ? undefined : new Date(row.EstArrival),
  }) as VesselHistory;

/**
 * Builds a lookup key for seeded departure records.
 *
 * @param vesselAbbrev - Vessel abbrev on the seeded schedule row
 * @param scheduledDepart - Scheduled departure in epoch milliseconds
 * @returns Composite vessel and scheduled-departure key
 */
const toVesselDepartKey = (vesselAbbrev: string, scheduledDepart: number) =>
  `${vesselAbbrev}:${scheduledDepart}`;

export { mapHistoryActualsToEventKeys };
