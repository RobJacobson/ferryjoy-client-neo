/**
 * Shared result shapes for vessel timeline sync actions.
 */

export type TimelineSyncResult = {
  ScheduledCount: number;
  ActualCount: number;
};

export type WindowSyncDayResult = {
  sailingDay: string;
  scheduledCount: number;
  actualCount: number;
};
