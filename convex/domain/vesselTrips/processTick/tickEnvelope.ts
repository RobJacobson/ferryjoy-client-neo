/**
 * Typed result of one `processVesselTrips` run for orchestrator peers.
 */

import type { TickEventWrites } from "./tickEventWrites";

/**
 * How active trips were loaded for this tick.
 *
 * - `preloaded` — caller passed `activeTrips` (e.g. orchestrator bundled read).
 * - `query` — loaded via `getActiveTrips` (hydrated for API parity).
 */
export type ActiveTripsLoadKind = "preloaded" | "query";

/**
 * Full output of lifecycle processing for one tick; timeline writes are applied
 * separately by the orchestrator (`applyTickEventWrites`).
 */
export type VesselTripsTickResult = {
  tickStartedAt: number;
  activeTripsSource: ActiveTripsLoadKind;
  tickEventWrites: TickEventWrites;
};
