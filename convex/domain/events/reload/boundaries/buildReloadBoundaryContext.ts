/**
 * Builds the shared scheduled boundary context for reload projections.
 *
 * WSF schedule rows are resolved into direct physical seed segments, then grouped
 * into vessel-day scheduled boundaries. Scheduled and actual reload stages use
 * this context to agree on segment identity and turnaround policy without
 * carrying actual evidence on the boundary objects.
 */

import type { TerminalIdentity, VesselIdentity } from "adapters";
import type { WsfScheduledSegment } from "../schemas";
import type { RawSeedSegment, ReloadScheduledBoundary } from "../types";
import { buildReloadBoundaryEvents } from "./buildReloadBoundaryEvents";
import { resolveDirectSeedSegments } from "./resolveDirectSeedSegments";

type ReloadBoundaryContext = {
  seedSegments: RawSeedSegment[];
  boundaryEvents: ReloadScheduledBoundary[];
};

/**
 * Builds resolved seed segments and scheduled boundaries for one reload.
 *
 * Runs direct-segment resolution first, then boundary construction, so every
 * downstream stage shares the same physical seed set and the same
 * timeline-sorted boundary set. Actual evidence is resolved later by actual-row
 * assembly so the boundary context remains a schedule-only contract.
 *
 * @param args - Schedule and identity inputs from the reload action, including scheduleSegments for the sailing day plus vessels and terminals for adapter resolution
 * @returns Direct seed segments and canonical scheduled boundaries
 */
const buildReloadBoundaryContext = ({
  scheduleSegments,
  vessels,
  terminals,
}: {
  scheduleSegments: WsfScheduledSegment[];
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
  });

  return {
    seedSegments,
    boundaryEvents,
  };
};

export type { ReloadBoundaryContext };
export { buildReloadBoundaryContext };
