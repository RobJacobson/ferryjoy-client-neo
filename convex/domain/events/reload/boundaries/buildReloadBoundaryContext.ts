/**
 * Builds the shared reload boundary context for scheduled and actual projections.
 *
 * WSF schedule rows are resolved into direct physical seed segments, then grouped
 * into vessel-day boundary events with history actuals overlaid. Scheduled and
 * actual reload stages consume this boundary context so they agree on segment
 * identity, turnaround policy, and history hydration.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import type { WsfScheduledSegment, WsfVesselHistory } from "../schemas";
import type { DockStatusEventRecord, RawSeedSegment } from "../types";
import { buildReloadBoundaryEvents } from "./buildReloadBoundaryEvents";
import { resolveDirectSeedSegments } from "./resolveDirectSeedSegments";

type ReloadBoundaryContext = {
  seedSegments: RawSeedSegment[];
  boundaryEvents: DockStatusEventRecord[];
};

/**
 * Builds resolved seed segments and hydrated boundary events for one reload.
 *
 * Runs direct-segment resolution first, then boundary construction, so every
 * downstream stage shares the same physical seed set and the same
 * timeline-sorted boundary tape. The boundary list already carries history
 * overlays where WSF history matched a seeded leg, which keeps scheduled-table
 * projection and actual synthesis aligned without duplicating hydration or
 * turnaround rules in each branch.
 *
 * @param args - Schedule, history, and identity inputs from the reload action,
 * including scheduleSegments and historyRecords for the sailing day plus
 * vessels and terminals for adapter resolution
 * @returns Direct seed segments and canonical boundary events
 */
const buildReloadBoundaryContext = ({
  scheduleSegments,
  historyRecords,
  vessels,
  terminals,
}: {
  scheduleSegments: WsfScheduledSegment[];
  historyRecords: WsfVesselHistory[];
  vessels: ReadonlyArray<VesselIdentity>;
  terminals: ReadonlyArray<TerminalIdentity>;
}): ReloadBoundaryContext => {
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

export type { ReloadBoundaryContext };
export { buildReloadBoundaryContext };
