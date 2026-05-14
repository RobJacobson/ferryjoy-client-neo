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

type HistorySeedLookup = {
  directSegmentKeys: Set<string>;
  directSegmentKeysByVesselTime: Map<string, string>;
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
  const seedLookup = buildHistorySeedLookup(directSeedSegments);

  const historyActualEntries = historyRecords.flatMap((record) =>
    buildHistoryActualEntries({
      record,
      seedLookup,
      vessels,
      terminals,
    })
  );
  const eventKeyToActualTimePairs = historyActualEntries.map(
    (entry): [string, number] => [entry.eventKey, entry.actualTime]
  );
  const actualTimesByEventKey = new Map<string, number>(
    eventKeyToActualTimePairs
  );

  return actualTimesByEventKey;
};

const buildHistoryActualEntries = ({
  record,
  seedLookup,
  vessels,
  terminals,
}: {
  record: WsfVesselHistory;
  seedLookup: HistorySeedLookup;
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): HistoryActualEntry[] => {
  if (!canHydrateHistoryActuals(record)) {
    return [];
  }

  const tripKey = resolveHistoryTripKey(record, seedLookup, vessels, terminals);

  if (tripKey === undefined) {
    return [];
  }

  const historyActualEntriesForRecord = definedEntries([
    toHistoryActualEntry(tripKey, "dep-dock", record.ActualDepart),
    toHistoryActualEntry(tripKey, "arv-dock", record.EstArrival),
  ]);

  return historyActualEntriesForRecord;
};

const buildHistorySeedLookup = (
  directSeedSegments: RawSeedSegment[]
): HistorySeedLookup => ({
  directSegmentKeys: new Set(directSeedSegments.map((segment) => segment.Key)),
  directSegmentKeysByVesselTime: new Map(
    directSeedSegments.map((segment) => [
      toVesselDepartKey(segment.VesselAbbrev, segment.DepartingTime),
      segment.Key,
    ])
  ),
});

const canHydrateHistoryActuals = (record: WsfVesselHistory) =>
  record.ScheduledDepart !== undefined &&
  (record.ActualDepart !== undefined || record.EstArrival !== undefined);

const toHistoryActualEntry = (
  tripKey: string,
  eventType: "dep-dock" | "arv-dock",
  actualTime: number | undefined
): HistoryActualEntry | undefined => {
  if (actualTime === undefined) {
    return undefined;
  }

  const boundaryEventKey = buildBoundaryKey(tripKey, eventType);
  const historyActualEntry: HistoryActualEntry = {
    eventKey: boundaryEventKey,
    actualTime,
  };

  return historyActualEntry;
};

const resolveHistoryTripKey = (
  record: WsfVesselHistory,
  seedLookup: HistorySeedLookup,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
) =>
  resolveStrictHistoryTripKey(
    record,
    seedLookup.directSegmentKeys,
    vessels,
    terminals
  ) ??
  resolveFallbackHistoryTripKey(
    record,
    seedLookup.directSegmentKeys,
    seedLookup.directSegmentKeysByVesselTime,
    vessels
  );

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
const toAdapterHistoryIdentityRecord = (row: WsfVesselHistory): VesselHistory =>
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

const definedEntries = <TEntry>(entries: Array<TEntry | undefined>): TEntry[] =>
  entries.filter((entry): entry is TEntry => entry !== undefined);

export { mapHistoryActualsToEventKeys };
