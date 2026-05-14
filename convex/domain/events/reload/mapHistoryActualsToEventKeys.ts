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
import type { RawSeedSegment } from "./types";

type HistoryActualEntry = {
  eventKey: string;
  actualTime: number;
};

/**
 * Indexes history-derived actual depart and arrival-proxy times by event Key.
 *
 * Reload merges WSF vessel history into seeded boundary records to obtain
 * actual times when the live ping stream missed an arrival or departure.
 * Strict adapter resolution is tried first; rows that fail strict resolution
 * fall back to vessel abbrev plus scheduled departure to recover history
 * that names a vessel ambiguously.
 *
 * @param args.directSeedSegments - Same-day raw seed segments by TripKey
 * @param args.historyRecords - WSF vessel history rows for the sailing day
 * @param args.vessels - Vessel identities for adapter resolution
 * @param args.terminals - Terminal identities for adapter resolution
 * @returns Map from boundary Key to actual time in epoch milliseconds
 */
const mapHistoryActualsToEventKeys = ({
  directSeedSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  directSeedSegments: RawSeedSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}) => {
  const directSegmentKeys = new Set(
    directSeedSegments.map((segment) => segment.Key)
  );
  const directSegmentKeysByVesselTime = new Map(
    directSeedSegments.map((segment) => [
      toVesselDepartKey(segment.VesselAbbrev, segment.DepartingTime),
      segment.Key,
    ])
  );

  return new Map<string, number>(
    collectEntries(historyRecords, (record) =>
      buildHistoryActualEntries({
        record,
        directSegmentKeys,
        directSegmentKeysByVesselTime,
        vessels,
        terminals,
      })
    ).map((entry): [string, number] => [entry.eventKey, entry.actualTime])
  );
};

const buildHistoryActualEntries = ({
  record,
  directSegmentKeys,
  directSegmentKeysByVesselTime,
  vessels,
  terminals,
}: {
  record: WsfVesselHistory;
  directSegmentKeys: Set<string>;
  directSegmentKeysByVesselTime: Map<string, string>;
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): HistoryActualEntry[] => {
  if (
    record.ScheduledDepart === undefined ||
    (record.ActualDepart === undefined && record.EstArrival === undefined)
  ) {
    return [];
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
      directSegmentKeysByVesselTime,
      vessels
    );

  return tripKey === undefined
    ? []
    : definedEntries([
        toHistoryActualEntry(tripKey, "dep-dock", record.ActualDepart),
        toHistoryActualEntry(tripKey, "arv-dock", record.EstArrival),
      ]);
};

const toHistoryActualEntry = (
  tripKey: string,
  eventType: "dep-dock" | "arv-dock",
  actualTime: number | undefined
): HistoryActualEntry | undefined =>
  actualTime === undefined
    ? undefined
    : {
        eventKey: buildBoundaryKey(tripKey, eventType),
        actualTime,
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
    toAdapterHistoryIdentityRecord(record),
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
 * @param directSegmentKeysByVesselTime - Direct seed rows keyed by vessel and ms
 * @param vessels - Vessel identities for adapter resolution
 * @returns Direct segment key or undefined when fallback resolution fails
 */
const resolveFallbackHistoryTripKey = (
  record: WsfVesselHistory,
  directSegmentKeys: Set<string>,
  directSegmentKeysByVesselTime: Map<string, string>,
  vessels: ReadonlyArray<VesselIdentity>
) => {
  const vessel = tryResolveVessel(
    record.Vessel === undefined ? "" : String(record.Vessel),
    vessels
  );
  const tripKey =
    vessel === null || record.ScheduledDepart === undefined
      ? undefined
      : directSegmentKeysByVesselTime.get(
          toVesselDepartKey(vessel.VesselAbbrev, record.ScheduledDepart)
        );

  return tripKey !== undefined && directSegmentKeys.has(tripKey)
    ? tripKey
    : undefined;
};

/**
 * Maps a Convex reload history row to the identity fields used for resolve.
 *
 * @param row - Reload history row with epoch-ms timestamps
 * @returns Adapter-shaped history record for vessel and terminal resolution
 */
const toAdapterHistoryIdentityRecord = (
  row: WsfVesselHistory
): VesselHistory =>
  ({
    VesselId: row.VesselId,
    Vessel: row.Vessel,
    Departing: row.Departing,
    Arriving: row.Arriving,
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

const definedEntries = <TEntry>(
  entries: Array<TEntry | undefined>
): TEntry[] => entries.filter((entry): entry is TEntry => entry !== undefined);

const collectEntries = <TItem, TEntry>(
  items: TItem[],
  toEntries: (item: TItem) => TEntry[]
): TEntry[] =>
  items.reduce<TEntry[]>(
    (entries, item) => [...entries, ...toEntries(item)],
    []
  );

export { mapHistoryActualsToEventKeys };
