/**
 * Shared logging for per-vessel failures inside the trip update pipeline.
 */

/**
 * Logs a structured error for one vessel and lifecycle phase.
 *
 * @param vesselAbbrev - Vessel code for the row that failed
 * @param phase - Short label (e.g. `"updating active trip"`)
 * @param error - Thrown value or non-Error (coerced for the message)
 */
export const logTripPipelineFailure = (
  vesselAbbrev: string,
  phase: string,
  error: unknown
): void => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(
    `[VesselTrips] Failed ${phase} for ${vesselAbbrev}: ${err.message}`,
    err
  );
};
