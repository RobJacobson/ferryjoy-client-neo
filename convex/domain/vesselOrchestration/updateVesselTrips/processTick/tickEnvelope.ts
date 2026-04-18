/**
 * Typed result of one `processVesselTrips` run for orchestrator peers.
 */

import type { TimelineTickProjectionInput } from "domain/vesselOrchestration/updateTimeline/tickEventWrites";

/**
 * Full output of lifecycle processing for one tick. `tickEventWrites` is the
 * **updateTimeline** handoff: input to timeline projection mutations after
 * **updateVesselTrips** (and embedded predictions) for this tick. See
 * {@link TimelineTickProjectionInput}.
 */
export type VesselTripsTickResult = {
  tickStartedAt: number;
  tickEventWrites: TimelineTickProjectionInput;
};
