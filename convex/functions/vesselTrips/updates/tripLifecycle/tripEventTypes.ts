/**
 * Trip event bundle produced by {@link detectTripEvents} for one vessel tick.
 *
 * Kept in a dedicated module so lifecycle, projection DTOs, and the tick
 * entrypoint can share the shape without importing the detector implementation.
 */

/**
 * Result of trip event detection for a vessel update.
 */
export type TripEvents = {
  isFirstTrip: boolean;
  isTripStartReady: boolean;
  shouldStartTrip: boolean;
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  keyChanged: boolean;
};
