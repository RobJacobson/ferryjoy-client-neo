/**
 * Shared timing, error coercion, and structured logging for vessel orchestrator
 * ticks (`executeVesselOrchestratorTick`). Do not import this module from
 * `convex/domain/`.
 */

import type { VesselOrchestratorTickMetrics } from "./types";

/**
 * Monotonic millisecond clock for duration sampling. Prefers `performance.now`
 * when available; falls back to `Date.now` if `performance` is missing.
 *
 * @returns Opaque timestamp — subtract only from values from this same function
 */
export const nowMs = (): number =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/**
 * Writes one JSON line for log aggregation (durations, branch outcomes).
 *
 * @param payload - Success flags, timings, and tick clock
 */
export const logVesselOrchestratorTickLine = (payload: {
  locationsSuccess: boolean;
  tripsSuccess: boolean;
  tickMetrics: VesselOrchestratorTickMetrics;
  tickStartedAt: number;
}): void => {
  console.log(
    `[VesselOrchestratorTick] ${JSON.stringify({
      kind: "VesselOrchestratorTick",
      ...payload,
    })}`
  );
};

/**
 * Elapsed milliseconds since `start` (same clock as `nowMs()`).
 *
 * @param start - Value from `nowMs()`
 * @returns Rounded whole milliseconds
 */
export const elapsedMs = (start: number): number => Math.round(nowMs() - start);

/**
 * Coerce a `catch` binding or `PromiseSettledResult.reason` to `Error` so
 * branch-level logging and the orchestrator result shape stay consistent.
 *
 * @param value - Unknown rejection or throw value
 * @returns Original `Error` when applicable; otherwise `Error` with
 *   `String(value)` as the message
 */
export const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));
