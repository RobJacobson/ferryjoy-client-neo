/**
 * Pure identity helpers for the future physical trip and actual-event model.
 */

import type { BoundaryEventType } from "./keys";

/**
 * Generates the immutable physical trip key for one vessel trip instance.
 *
 * The timestamp should come from the triggering `VesselLocation.TimeStamp`
 * field, not wall-clock time. That value is already second-granular in the
 * current pipeline and gives the trip a stable identity tied to the actual tick
 * that caused the lifecycle transition.
 *
 * If a caller passes sub-second input anyway, this helper normalizes by
 * truncating to the containing whole second before encoding as UTC ISO and
 * replacing `T` with a space while preserving the trailing `Z`.
 *
 * @param vesselAbbrev - Vessel abbreviation for the physical trip instance
 * @param tickTimestamp - Triggering vessel-location timestamp for the trip
 * @returns Stable physical trip key
 */
export const generateTripKey = (
  vesselAbbrev: string,
  tickTimestamp: Date | number
): string => {
  const tickTimestampMs =
    tickTimestamp instanceof Date ? tickTimestamp.getTime() : tickTimestamp;
  const truncatedToWholeSecondMs = Math.trunc(tickTimestampMs / 1000) * 1000;
  const iso = new Date(truncatedToWholeSecondMs).toISOString();

  return `${vesselAbbrev} ${iso.replace("T", " ").replace(".000Z", "Z")}`;
};

/**
 * Builds the future physical actual-event identity from a trip key.
 *
 * @param tripKey - Immutable physical trip key
 * @param eventType - Physical boundary type for the actual row
 * @returns Stable physical actual-event key
 */
export const buildPhysicalActualEventKey = (
  tripKey: string,
  eventType: BoundaryEventType
) => `${tripKey}--${eventType}`;

/**
 * Assigns a stable `TripKey` for legacy active rows that predate physical
 * identity, using trip start semantics when possible.
 *
 * @param vesselAbbrev - Vessel abbreviation
 * @param tripStartMs - Persisted trip start epoch ms, when known
 * @param fallbackTickMs - Current or row timestamp when trip start is unknown
 * @returns One-time physical trip key to persist
 */
export const backfillTripKeyFromLegacyRow = (
  vesselAbbrev: string,
  tripStartMs: number | undefined,
  fallbackTickMs: number
): string =>
  generateTripKey(
    vesselAbbrev,
    tripStartMs !== undefined ? tripStartMs : fallbackTickMs
  );
