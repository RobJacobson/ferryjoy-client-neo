/**
 * Trip event bundle for one vessel ping; produced by {@link detectTripEvents}.
 *
 * Lives in its own module so lifecycle code and callers share one shape without
 * depending on the detector implementation.
 */

/**
 * Result of trip event detection for a vessel update.
 */
export type TripEvents = {
  isFirstTrip: boolean;
  isTripStartReady: boolean;
  /**
   * Legacy surface: `detectTripEvents` currently sets this to `false` every
   * ping; trip start is driven by `isTripStartReady` and related flags. Kept
   * for fixtures and gradual audit (see `architecture.md` section 9).
   */
  shouldStartTrip: boolean;
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  scheduleKeyChanged: boolean;
};
