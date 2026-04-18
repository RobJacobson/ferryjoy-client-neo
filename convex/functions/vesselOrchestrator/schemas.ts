/**
 * TypeScript shapes for vessel orchestrator inputs (post-fetch snapshot). The
 * orchestrator borrows other tables; these types document the combined read used
 * by `updateVesselOrchestrator`.
 */

import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { TickActiveTrip } from "functions/vesselTrips/schemas";

/**
 * One WSF batch plus identity rows after adapter conversion, before sequential
 * writes in `updateVesselOrchestrator`.
 */
export type VesselOrchestratorTickSnapshot = {
  convexLocations: ReadonlyArray<ConvexVesselLocation>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReadonlyArray<TickActiveTrip>;
};
