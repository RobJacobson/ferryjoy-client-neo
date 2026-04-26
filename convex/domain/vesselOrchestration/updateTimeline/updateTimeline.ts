/**
 * Same-ping timeline projection from Stage C/D handoffs.
 */

import type {
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineOutput,
} from "./contracts";
import { updateTimelineFromAssembly } from "./orchestratorTimelineProjection";

/**
 * Canonical timeline concern entrypoint for orchestrator callers.
 *
 * @param input - Ping start time plus persisted trip handoff and ML overlays
 * @returns Actual and predicted timeline event writes for persistence
 */
export const updateTimeline = (
  input: RunUpdateVesselTimelineFromAssemblyInput
): RunUpdateVesselTimelineOutput => updateTimelineFromAssembly(input);
