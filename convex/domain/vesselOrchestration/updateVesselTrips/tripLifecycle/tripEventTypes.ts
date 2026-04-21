/**
 * Trip event bundle for one vessel ping (from {@link detectTripEvents}).
 *
 * Kept in a dedicated module so builders import the shape without coupling to
 * the detector implementation.
 */

/** Result of trip event detection for a vessel update. */
export type TripEvents = {
  isFirstTrip: boolean;
  isTripStartReady: boolean;
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  scheduleKeyChanged: boolean;
};
