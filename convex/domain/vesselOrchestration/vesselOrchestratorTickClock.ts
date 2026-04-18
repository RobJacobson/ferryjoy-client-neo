/**
 * Wall-clock anchor for vessel orchestrator ticks. Convex entrypoints should not
 * own tick time policy; call sites use this when starting tick processing.
 */

/**
 * Epoch milliseconds when orchestrator tick processing begins (after converted
 * locations are available). Uses wall clock so calendar-based policy (for example
 * prediction-fallback by seconds-of-minute) behaves correctly.
 *
 * @returns Epoch ms for the current tick
 */
export const nowMsForVesselOrchestratorTick = (): number => Date.now();
