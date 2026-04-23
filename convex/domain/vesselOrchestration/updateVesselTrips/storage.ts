/**
 * Logs a structured trip-pipeline failure for debugging and alerting.
 *
 * @param vesselAbbrev - Vessel abbreviation associated with the failed update
 * @param phase - Human-readable pipeline phase where the error occurred
 * @param error - Thrown error or unknown failure value from the pipeline
 * @returns No return value; emits to stderr via console.error
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
