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
import type { WsfVesselHistory } from "../schemas/validateReloadInput";
import { groupBy } from "../shared";
import type {
  DockStatusEventRecord,
  NormalizedHistoryRecord,
  RawSeedSegment,
} from "../types";

const toAdapterHistoryRecord = (row: WsfVesselHistory): VesselHistory =>
  ({
    ...row,
    ScheduledDepart:
      row.ScheduledDepart !== undefined
        ? new Date(row.ScheduledDepart)
        : undefined,
    ActualDepart:
      row.ActualDepart !== undefined ? new Date(row.ActualDepart) : undefined,
    EstArrival:
      row.EstArrival !== undefined ? new Date(row.EstArrival) : undefined,
  }) as VesselHistory;

/**
 * Builds a resolver from scheduled depart ms to segment key using seeded dep rows.
 *
 * @param seededEvents - Dock boundary records already seeded from schedule
 * @returns Function mapping vessel abbrev + scheduled depart to SegmentKey
 */
const createSeededScheduleSegmentResolver = (
  seededEvents: ReadonlyArray<DockStatusEventRecord>
) => {
  const byVessel = groupBy(
    seededEvents.filter((event) => event.EventType === "dep-dock"),
    (row) => row.VesselAbbrev
  );

  return (vesselAbbrev: string, scheduledDepart: number) =>
    byVessel
      .get(vesselAbbrev)
      ?.find((row) => row.ScheduledDeparture === scheduledDepart)?.SegmentKey;
};

const normalizeHistoryRecordStrict = (
  record: WsfVesselHistory,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): NormalizedHistoryRecord | null => {
  const scheduledDepart = record.ScheduledDepart;
  const actualDeparture = record.ActualDepart;
  const arrivalProxy = record.EstArrival;
  const resolvedHistory = resolveVesselHistory(
    toAdapterHistoryRecord(record),
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

  const tripKey = buildSegmentKey(
    resolvedHistory.vessel.VesselAbbrev,
    resolvedHistory.departingTerminal.TerminalAbbrev,
    resolvedHistory.arrivingTerminal.TerminalAbbrev,
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

/**
 * Indexes history-derived actual depart and arrival-proxy times by event Key.
 *
 * @param args.seededEvents - Schedule-derived boundary rows before history merge
 * @param args.scheduleSegments - Same-day WSF scheduled segments (epoch-ms times)
 * @param args.historyRecords - WSF vessel history rows (epoch-ms times) for the day
 * @param args.vessels - Vessel identities for adapter resolution
 * @param args.terminals - Terminal identities for adapter resolution
 * @returns Map from boundary Key to epoch actual ms from history
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
  const directSegmentsByTripKey = new Map(
    directSeedSegments.map((segment) => [segment.Key, segment])
  );
  const resolveSegmentFromSeededSchedule =
    createSeededScheduleSegmentResolver(seededEvents);

  return historyRecords.reduce((actualsByEventKey, record) => {
    const actualDeparture = record.ActualDepart;
    const arrivalProxy = record.EstArrival;
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
      const scheduledDepart = record.ScheduledDepart;
      const vessel = tryResolveVessel(
        record.Vessel ? String(record.Vessel) : "",
        vessels
      );
      if (
        scheduledDepart !== undefined &&
        vessel !== null &&
        (actualDeparture !== undefined || arrivalProxy !== undefined)
      ) {
        const fallbackKey = resolveSegmentFromSeededSchedule(
          vessel.VesselAbbrev,
          scheduledDepart
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

    if (actualDeparture !== undefined) {
      actualsByEventKey.set(
        buildBoundaryKey(tripKey, "dep-dock"),
        actualDeparture
      );
    }

    if (arrivalProxy !== undefined) {
      actualsByEventKey.set(
        buildBoundaryKey(tripKey, "arv-dock"),
        arrivalProxy
      );
    }

    return actualsByEventKey;
  }, new Map<string, number>());
};

export { mapHistoryActualsToEventKeys };
