/**
 * Builds physical actual-event keys from an existing trip key string.
 *
 * Canonical TripKey strings come from schedule segment identity (see
 * shared/keys buildSegmentKey and assignCanonicalTripKey); this module only
 * appends boundary suffixes for eventsActual row keys.
 */

import type { BoundaryEventType } from "./keys";

/**
 * Builds the physical actual-event identity from a trip key.
 *
 * @param tripKey - Immutable physical trip key
 * @param eventType - Physical boundary type for the actual row
 * @returns Stable physical actual-event key
 */
export const buildPhysicalActualEventKey = (
  tripKey: string,
  eventType: BoundaryEventType
) => `${tripKey}--${eventType}`;
