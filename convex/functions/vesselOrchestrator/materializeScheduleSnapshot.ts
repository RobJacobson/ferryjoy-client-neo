import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "domain/events/scheduled";
import { getSegmentKeyFromBoundaryKey } from "domain/timelineRows/scheduledSegmentResolvers";
import type {
  CompactScheduledDepartureEvent,
  OrchestratorScheduleSnapshot,
} from "./schemas";

/**
 * Builds the compact schedule read model used on the orchestrator hot path.
 *
 * The hot path needs only:
 * - direct segment lookups by `ScheduleKey`
 * - per-vessel ordered departure lists for rollover continuity
 *
 * Materializing those once per sailing day avoids reloading the full
 * `eventsScheduled` boundary set on every ping.
 */
export const materializeOrchestratorScheduleSnapshot = (
  sailingDay: string,
  scheduledRows: ReadonlyArray<ConvexScheduledDockEvent>
): OrchestratorScheduleSnapshot => {
  const departureRows = scheduledRows
    .filter((row) => row.EventType === "dep-dock")
    .sort(
      (left, right) =>
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.TerminalAbbrev.localeCompare(right.TerminalAbbrev)
    );

  const scheduledDeparturesByVesselAbbrev: Record<
    string,
    Array<CompactScheduledDepartureEvent>
  > = {};
  const departureRowsByVesselAbbrev = new Map<
    string,
    Array<ConvexScheduledDockEvent>
  >();

  for (const row of departureRows) {
    const vesselRows = departureRowsByVesselAbbrev.get(row.VesselAbbrev) ?? [];
    vesselRows.push(row);
    departureRowsByVesselAbbrev.set(row.VesselAbbrev, vesselRows);

    const vesselDepartures =
      scheduledDeparturesByVesselAbbrev[row.VesselAbbrev] ?? [];
    vesselDepartures.push({
      Key: row.Key,
      ScheduledDeparture: row.ScheduledDeparture,
      TerminalAbbrev: row.TerminalAbbrev,
    });
    scheduledDeparturesByVesselAbbrev[row.VesselAbbrev] = vesselDepartures;
  }

  const scheduledDepartureBySegmentKey: Record<
    string,
    ConvexInferredScheduledSegment
  > = {};

  for (const [vesselAbbrev, vesselRows] of departureRowsByVesselAbbrev) {
    for (const [index, row] of vesselRows.entries()) {
      const nextRow = vesselRows[index + 1];
      const segmentKey = getSegmentKeyFromBoundaryKey(row.Key);
      scheduledDepartureBySegmentKey[segmentKey] = {
        Key: segmentKey,
        SailingDay: row.SailingDay,
        DepartingTerminalAbbrev: row.TerminalAbbrev,
        ArrivingTerminalAbbrev: row.NextTerminalAbbrev,
        DepartingTime: row.ScheduledDeparture,
        NextKey: nextRow ? getSegmentKeyFromBoundaryKey(nextRow.Key) : undefined,
        NextDepartingTime: nextRow?.ScheduledDeparture,
      };
    }

    if (!scheduledDeparturesByVesselAbbrev[vesselAbbrev]) {
      scheduledDeparturesByVesselAbbrev[vesselAbbrev] = [];
    }
  }

  return {
    SailingDay: sailingDay,
    UpdatedAt:
      departureRows.reduce(
        (maxUpdatedAt, row) => Math.max(maxUpdatedAt, row.UpdatedAt),
        0
      ) || Date.now(),
    scheduledDepartureBySegmentKey,
    scheduledDeparturesByVesselAbbrev,
  };
};
