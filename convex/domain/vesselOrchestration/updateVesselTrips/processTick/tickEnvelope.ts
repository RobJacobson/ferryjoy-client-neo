/**
 * Typed result of one `processVesselTrips` run for orchestrator peers.
 */

import type { TimelineTickProjectionInput } from "domain/vesselOrchestration/shared";

/**
 * Full output of lifecycle processing for one tick. `tickEventWrites` is the
 * projection wire shape (see {@link TimelineTickProjectionInput}): input to
 * timeline projection mutations after **updateVesselTrips** (and embedded
 * predictions) for this tick.
 */
export type VesselTripsTickResult = {
  tickStartedAt: number;
  tickEventWrites: TimelineTickProjectionInput;
};
