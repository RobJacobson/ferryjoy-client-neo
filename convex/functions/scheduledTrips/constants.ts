/**
 * Tunables for scheduled-trips sync, purge batching, and cron wiring.
 * Single source of truth for rolling-window day counts and purge behavior.
 */

export const scheduledTripsConfig = {
  /** Consecutive sailing days synced by the daily cron (rolling window). */
  dailySyncDays: 7,
  /** Consecutive sailing days synced by the 15-minute “refresh current day” job. */
  intervalRefreshSyncDays: 1,
  /**
   * Default when `syncScheduledTripsWindowed` is invoked without `daysToSync`
   * (e.g. dashboard or ad-hoc internal runs).
   */
  windowedDefaultDays: 2,
  /** Purge deletes rows with DepartingTime older than now minus this duration. */
  purgeLookbackMs: 24 * 60 * 60 * 1000,
  /** Documents deleted per purge batch mutation; the purge action loops until done. */
  purgeBatchSize: 500,
  /** Upper bound for `deleteScheduledTripsBeforeBatch` `limit` (mutation clamps). */
  purgeBatchLimitMax: 1000,
} as const;
