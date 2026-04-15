/**
 * Orchestrator-owned policy for ML prediction fallback retries (first seconds
 * of each minute). Passed into trip builders; computed once per tick.
 */

// Restrict time-based retries to the first few seconds of each minute.
const PREDICTION_FALLBACK_WINDOW_SECONDS = 5;

/**
 * Whether this tick should attempt missing ML predictions via time-based fallback.
 *
 * @param tickStartedAt - Epoch ms for the orchestrator tick
 * @returns True when seconds-of-minute are within the fallback window
 */
export const computeShouldRunPredictionFallback = (
  tickStartedAt: number
): boolean =>
  new Date(tickStartedAt).getSeconds() < PREDICTION_FALLBACK_WINDOW_SECONDS;
