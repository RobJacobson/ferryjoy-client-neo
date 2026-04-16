/**
 * Typed result of one `processVesselTrips` run for orchestrator peers.
 */

import type { TickEventWrites } from "./tickEventWrites";

/**
 * Full output of lifecycle processing for one tick; timeline writes are applied
 * separately by the orchestrator (`applyTickEventWrites`).
 */
export type VesselTripsTickResult = {
  tickStartedAt: number;
  tickEventWrites: TickEventWrites;
};
