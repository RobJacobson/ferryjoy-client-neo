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
  /**
   * Legacy surface: `detectTripEvents` currently sets this to `false` every
   * tick; trip start is driven by `isTripStartReady` and related flags. Kept
   * for fixtures and gradual audit (see `architecture.md` §9).
   */
  shouldStartTrip: boolean;
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  scheduleKeyChanged: boolean;
};
