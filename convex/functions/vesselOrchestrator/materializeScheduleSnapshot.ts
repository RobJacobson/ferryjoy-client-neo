import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "domain/events/scheduled";
import { getSegmentKeyFromBoundaryKey } from "domain/timelineRows/scheduledSegmentResolvers";
import { groupBy } from "../../shared/groupBy";
import type {
  CompactScheduledDepartureEvent,
  OrchestratorScheduleSnapshot,
} from "./schemas";

/**
 * Builds the compact schedule read model used on the orchestrator hot path.
 *
 * The hot path needs only:
 * - direct segment lookups by `ScheduleKey`
 * - per-vessel ordered departure lists for rollover-based trip-field inference
 *
 * Materializing those once per sailing day avoids reloading the full
 * `eventsScheduled` boundary set on every ping while keeping schedule evidence
 * ready for provisional trip fields when WSF is incomplete.
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

  const departureRowsByVesselAbbrev = groupBy(
    departureRows,
    (row) => row.VesselAbbrev
  );

  const scheduledDeparturesByVesselAbbrev: Record<
    string,
    Array<CompactScheduledDepartureEvent>
  > = Object.fromEntries(
    [...departureRowsByVesselAbbrev.entries()].map(
      ([vesselAbbrev, vesselRows]) => [
        vesselAbbrev,
        vesselRows.map((row) => ({
          Key: row.Key,
          ScheduledDeparture: row.ScheduledDeparture,
          TerminalAbbrev: row.TerminalAbbrev,
        })),
      ]
    )
  );

  const scheduledDepartureBySegmentKey: Record<
    string,
    ConvexInferredScheduledSegment
  > = {};

  for (const [, vesselRows] of departureRowsByVesselAbbrev) {
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
