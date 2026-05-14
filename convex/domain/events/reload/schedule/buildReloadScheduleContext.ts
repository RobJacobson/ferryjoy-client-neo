/**
 * Builds the schedule-derived context shared by reload row projections.
 *
 * WSF schedule rows are resolved into direct physical seed segments, then
 * hydrated with WSF history into the canonical boundary tape used by both
 * scheduled and actual projections.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import type { WsfScheduledSegment, WsfVesselHistory } from "../schemas";
import type { DockStatusEventRecord, RawSeedSegment } from "../types";
import { buildReloadBoundaryEvents } from "./buildReloadBoundaryEvents";
import { resolveDirectSeedSegments } from "./resolveDirectSeedSegments";

type ReloadScheduleContext = {
  seedSegments: RawSeedSegment[];
  boundaryEvents: DockStatusEventRecord[];
};

/**
 * Builds resolved seed segments and hydrated boundary events for one reload.
 *
 * @param args - Schedule, history, and identity inputs from the reload action
 * @returns Direct seed segments and canonical boundary events
 */
const buildReloadScheduleContext = ({
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  scheduleSegments: WsfScheduledSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): ReloadScheduleContext => {
  const seedSegments = resolveDirectSeedSegments(
    scheduleSegments,
    vessels,
    terminals
  );
  const boundaryEvents = buildReloadBoundaryEvents({
    seedSegments,
    historyRecords,
    vessels,
    terminals,
  });

  return {
    seedSegments,
    boundaryEvents,
  };
};

export type { ReloadScheduleContext };
export { buildReloadScheduleContext };
