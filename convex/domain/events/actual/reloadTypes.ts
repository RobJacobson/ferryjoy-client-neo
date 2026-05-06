/**
 * Actual event reload input types.
 *
 * These numeric history rows are validated at the Convex mutation boundary and
 * then consumed by actual-domain hydration without carrying adapter Date shapes.
 */

/**
 * Numeric vessel-history row used to actualize scheduled dock boundaries.
 */
type EventReloadHistoryRecord = {
  VesselId: number;
  Vessel?: string;
  Departing?: string;
  Arriving?: string;
  ScheduledDepart?: number;
  ActualDepart?: number;
  EstArrival?: number;
};

export type { EventReloadHistoryRecord };
