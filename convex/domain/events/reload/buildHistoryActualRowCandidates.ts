/**
 * Build actual row candidates from WSF vessel history rows.
 *
 * History is durable. Strict vessel and terminal matching runs first,
 * with vessel plus scheduled departure as a recovery path for ambiguous
 * terminal names.
 */

import {
  resolveVesselHistory,
  type TerminalIdentity,
  tryResolveVessel,
  type VesselIdentity,
} from "adapters";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import { isDefined, toBoundaryActualRowCandidate } from "./actualRowCandidates";
import type { WsfVesselHistory } from "./schemas";
import type { ActualRowCandidate, ScheduledBoundary, SeedLeg } from "./types";

type HistorySeedLookup = {
  segmentKeys: Set<string>;
  segmentKeyByVesselDeparture: Map<string, string>;
};

/**
 * Builds actual row candidates from WSF history records.
 *
 * @param options - Seed legs, scheduled boundaries, history rows, TripKey lookup, and identity tables
 * @returns Durable history candidates joined to TripKeys
 */
const buildHistoryActualRowCandidates = ({
  seedLegs,
  boundaries,
  historyRecords,
  tripKeyBySegmentKey,
  vessels,
  terminals,
}: {
  seedLegs: SeedLeg[];
  boundaries: ScheduledBoundary[];
  historyRecords: WsfVesselHistory[];
  tripKeyBySegmentKey: Map<string, string>;
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): ActualRowCandidate[] => {
  const actualTimeByBoundaryKey = mapHistoryActualsToBoundaryKeys(
    seedLegs,
    historyRecords,
    vessels,
    terminals
  );
  const historyCandidates = boundaries
    .map((boundary) =>
      toBoundaryActualRowCandidate(
        boundary,
        tripKeyBySegmentKey.get(boundary.SegmentKey),
        actualTimeByBoundaryKey.get(boundary.Key),
        true
      )
    )
    .filter(isDefined);

  return historyCandidates;
};

/**
 * Indexes WSF history actual times by scheduled boundary key.
 *
 * @param seedLegs - Direct seed legs in scope for this reload
 * @param historyRecords - WSF vessel history rows
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns Actual times keyed by scheduled boundary key
 */
const mapHistoryActualsToBoundaryKeys = (
  seedLegs: SeedLeg[],
  historyRecords: WsfVesselHistory[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): Map<string, number> => {
  const seedLookup = buildHistorySeedLookup(seedLegs);
  const historyActualEntries = historyRecords.flatMap((record) =>
    historyRecordToBoundaryEntries(record, seedLookup, vessels, terminals)
  );
  const actualTimeByBoundaryKey = new Map(historyActualEntries);

  return actualTimeByBoundaryKey;
};

/**
 * Converts one history row to boundary-key actual time entries.
 *
 * @param record - WSF vessel history row
 * @param seedLookup - Seed-leg indexes for strict and recovery matching
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns Boundary-key entries for present actual timestamps
 */
const historyRecordToBoundaryEntries = (
  record: WsfVesselHistory,
  seedLookup: HistorySeedLookup,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): Array<[string, number]> => {
  const segmentKey = canUseHistoryRecord(record)
    ? resolveHistorySegmentKey(record, seedLookup, vessels, terminals)
    : undefined;
  const historyEntries =
    segmentKey === undefined
      ? []
      : [
          toHistoryBoundaryEntry(segmentKey, "dep-dock", record.ActualDepart),
          toHistoryBoundaryEntry(segmentKey, "arv-dock", record.EstArrival),
        ].filter(isDefined);

  return historyEntries;
};

/**
 * Builds one history actual entry when the timestamp is present.
 *
 * @param segmentKey - Resolved seed-leg segment key
 * @param eventType - Dock boundary type
 * @param actualTime - Observed boundary time
 * @returns Boundary-key entry or undefined when the timestamp is absent
 */
const toHistoryBoundaryEntry = (
  segmentKey: string,
  eventType: ActualRowCandidate["eventType"],
  actualTime: number | undefined
): [string, number] | undefined =>
  actualTime === undefined
    ? undefined
    : [buildBoundaryKey(segmentKey, eventType), actualTime];

/**
 * Builds seed-leg indexes for history matching.
 *
 * @param seedLegs - Direct seed legs in scope for this reload
 * @returns Segment-key set plus vessel/departure recovery index
 */
const buildHistorySeedLookup = (seedLegs: SeedLeg[]): HistorySeedLookup => ({
  segmentKeys: new Set(seedLegs.map((leg) => leg.Key)),
  segmentKeyByVesselDeparture: new Map(
    seedLegs.map((leg) => [
      toVesselDepartureKey(leg.VesselAbbrev, leg.DepartingTime),
      leg.Key,
    ])
  ),
});

/**
 * Resolves the seed-leg key for one history row.
 *
 * @param record - WSF vessel history row
 * @param seedLookup - Seed-leg indexes for strict and recovery matching
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns Seed-leg segment key when matched to the reload scope
 */
const resolveHistorySegmentKey = (
  record: WsfVesselHistory,
  seedLookup: HistorySeedLookup,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): string | undefined =>
  resolveStrictHistorySegmentKey(
    record,
    seedLookup.segmentKeys,
    vessels,
    terminals
  ) ?? resolveHistorySegmentKeyByVesselDeparture(record, seedLookup, vessels);

/**
 * Resolves history identity through vessel and terminal names.
 *
 * @param record - WSF vessel history row
 * @param segmentKeys - Seed-leg keys in scope for this reload
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns Seed-leg segment key when strict resolution succeeds
 */
const resolveStrictHistorySegmentKey = (
  record: WsfVesselHistory,
  segmentKeys: Set<string>,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): string | undefined => {
  const resolvedHistory = resolveVesselHistory(
    toAdapterHistoryIdentityRecord(record),
    vessels,
    terminals
  );
  const segmentKey =
    resolvedHistory === null || record.ScheduledDepart === undefined
      ? undefined
      : buildSegmentKey(
          resolvedHistory.vessel.VesselAbbrev,
          resolvedHistory.departingTerminal.TerminalAbbrev,
          resolvedHistory.arrivingTerminal.TerminalAbbrev,
          new Date(record.ScheduledDepart)
        );
  const matchedSegmentKey =
    segmentKey !== undefined && segmentKeys.has(segmentKey)
      ? segmentKey
      : undefined;

  return matchedSegmentKey;
};

/**
 * Resolves history identity by vessel abbrev and scheduled departure.
 *
 * @param record - WSF vessel history row
 * @param seedLookup - Seed-leg indexes for recovery matching
 * @param vessels - Vessel identities used by adapter resolution
 * @returns Seed-leg segment key when recovery matching succeeds
 */
const resolveHistorySegmentKeyByVesselDeparture = (
  record: WsfVesselHistory,
  seedLookup: HistorySeedLookup,
  vessels: ReadonlyArray<VesselIdentity>
): string | undefined => {
  const vessel = tryResolveVessel(String(record.Vessel ?? ""), vessels);
  const segmentKey =
    vessel === null || record.ScheduledDepart === undefined
      ? undefined
      : seedLookup.segmentKeyByVesselDeparture.get(
          toVesselDepartureKey(vessel.VesselAbbrev, record.ScheduledDepart)
        );
  const matchedSegmentKey =
    segmentKey !== undefined && seedLookup.segmentKeys.has(segmentKey)
      ? segmentKey
      : undefined;

  return matchedSegmentKey;
};

/**
 * Narrows a reload history row to fields used by adapter identity resolution.
 *
 * @param row - WSF history row with optional timestamp fields
 * @returns Adapter-compatible history identity row
 */
const toAdapterHistoryIdentityRecord = (row: WsfVesselHistory): VesselHistory =>
  ({
    VesselId: row.VesselId,
    Vessel: row.Vessel,
    Departing: row.Departing,
    Arriving: row.Arriving,
  }) as VesselHistory;

/**
 * Returns whether a history row has enough data to produce an actual row candidate.
 *
 * @param record - WSF history row
 * @returns True when scheduled departure and at least one actual timestamp exist
 */
const canUseHistoryRecord = (record: WsfVesselHistory): boolean =>
  record.ScheduledDepart !== undefined &&
  (record.ActualDepart !== undefined || record.EstArrival !== undefined);

/**
 * Builds the composite vessel and scheduled departure key.
 *
 * @param vesselAbbrev - Vessel abbrev
 * @param scheduledDeparture - Scheduled departure in epoch milliseconds
 * @returns Composite vessel/departure key
 */
const toVesselDepartureKey = (
  vesselAbbrev: string,
  scheduledDeparture: number
) => `${vesselAbbrev}:${scheduledDeparture}`;

export { buildHistoryActualRowCandidates };
