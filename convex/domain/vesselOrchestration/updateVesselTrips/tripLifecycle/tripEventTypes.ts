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
  /**
   * Legacy surface: `detectTripEvents` currently sets this to `false` every
   * ping; trip start is driven by `isTripStartReady` and related flags. Kept
   * for fixtures and gradual audit (see `architecture.md` section 9). Do not use
   * for new logic until the audit removes or repurposes this field.
   */
  shouldStartTrip: boolean;
  isCompletedTrip: boolean;
  didJustArriveAtDock: boolean;
  didJustLeaveDock: boolean;
  scheduleKeyChanged: boolean;
};
