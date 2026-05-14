/**
 * Maps WSF vessel history onto reload boundary event keys for actual-time hydration.
 *
 * Consumed by the dock-events reload pipeline so scheduled boundaries can pick up
 * observed departures and arrival proxies when only history captured them. Pure;
 * callers merge the returned map into seeded boundary rows.
 */

import {
  resolveVesselHistory,
  type TerminalIdentity,
  tryResolveVessel,
  type VesselIdentity,
} from "adapters";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type { WsfVesselHistory } from "../schemas";
import type { RawSeedSegment } from "../types";

type HistoryActualEntry = {
  eventKey: string;
  actualTime: number;
};

type HistorySeedLookup = {
  directSegmentKeys: Set<string>;
  directSegmentKeysByVesselTime: Map<string, string>;
};

/**
 * Indexes history-derived actual depart and arrival-proxy times by boundary event key.
 *
 * Reload merges WSF vessel history into seeded boundary records to obtain
 * actual times when the live ping stream missed an arrival or departure.
 * Strict adapter resolution is tried first; rows that fail strict resolution
 * fall back to vessel abbrev plus scheduled departure to recover history
 * that names a vessel ambiguously.
 *
 * @param directSeedSegments - Same-day raw seed segments for the reload batch
 * @param historyRecords - WSF vessel history rows for the sailing day
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Map from boundary event key to actual time in epoch milliseconds
 */
const mapHistoryActualsToEventKeys = (
  directSeedSegments: RawSeedSegment[],
  historyRecords: WsfVesselHistory[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
) => {
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

/**
 * Derives zero or more boundary actual entries from one history row.
 *
 * @param record - WSF vessel history row with timestamps and identity hints
 * @param seedLookup - Direct seed segment keys and vessel-time fallback index
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Boundary entries for depart and arrival-proxy times when resolvable
 */
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

/**
 * Indexes direct seed segments for strict and fallback history matching.
 *
 * @param directSeedSegments - Same-day raw seed segments from the reload batch
 * @returns Segment key set plus vessel-and-scheduled-departure to segment map
 */
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

/**
 * Returns whether a history row carries enough timestamps to hydrate actuals.
 *
 * @param record - WSF vessel history row
 * @returns True when scheduled departure exists and at least one actual time exists
 */
const canHydrateHistoryActuals = (record: WsfVesselHistory) =>
  record.ScheduledDepart !== undefined &&
  (record.ActualDepart !== undefined || record.EstArrival !== undefined);

/**
 * Builds one boundary actual entry when a timestamp exists for that boundary kind.
 *
 * @param tripKey - Resolved direct seed segment key for the leg
 * @param eventType - Departure dock or arrival dock discriminator
 * @param actualTime - Epoch milliseconds for the observed boundary when present
 * @returns Entry pairing boundary key and time, or undefined when time is absent
 */
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

/**
 * Resolves the direct seed segment key for a history row using strict then fallback rules.
 *
 * @param record - WSF vessel history row
 * @param seedLookup - Direct segment keys and vessel-time index from seeds
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Segment key when matched against allowed seeds, otherwise undefined
 */
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
 * Resolves a history row to a seed segment key using vessel and terminal identities.
 *
 * Uses the adapter resolver so ambiguous vessel strings still map when terminals
 * disambiguate the leg. The built segment key must appear in directSegmentKeys
 * or the row is rejected so history cannot attach to out-of-scope schedules.
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
 * Resolves a history row by vessel abbrev plus scheduled departure instant.
 *
 * Picks up rows where strict terminal resolution failed but the vessel abbrev
 * and scheduled departure still match a seeded leg. Confirms membership in
 * directSegmentKeys so only in-batch segments hydrate.
 *
 * @param record - WSF vessel history row
 * @param directSegmentKeys - Direct seed segment keys allowed for this reload
 * @param directSegmentKeysByVesselTime - Segment keys keyed by vessel abbrev and departure ms
 * @param vessels - Vessel identities for vessel abbrev resolution
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
 * Narrows a reload history row to the identity fields the vessel-history resolver reads.
 *
 * Drops timestamp fields so adapter resolution focuses on vessel and terminal ids
 * and names only. The cast matches the adapter schema shape expected upstream.
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

/**
 * Drops undefined slots after pairing optional actual entries per history row.
 *
 * @param entries - Candidate entries where some boundary kinds lack timestamps
 * @returns Only defined entries, preserving caller order
 */
const definedEntries = <TEntry>(entries: Array<TEntry | undefined>): TEntry[] =>
  entries.filter((entry): entry is TEntry => entry !== undefined);

export { mapHistoryActualsToEventKeys };
