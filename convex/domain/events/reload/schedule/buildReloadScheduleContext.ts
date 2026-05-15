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
 * Runs schedule resolution first so every downstream stage shares the same
 * direct physical seed set and the same timeline-sorted boundary tape. The
 * boundary list already carries history overlays where WSF history matched a
 * seeded leg, which keeps scheduled-table projection and actual synthesis
 * aligned without duplicating hydration rules in each branch.
 *
 * @param args - Schedule, history, and identity inputs from the reload action,
 * including scheduleSegments and historyRecords for the sailing day plus
 * vessels and terminals for adapter resolution
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
