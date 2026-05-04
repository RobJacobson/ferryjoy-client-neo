/**
 * Shared result shapes for dock-event reload actions.
 *
 * Action helpers return these compact summaries for operator dashboards and
 * cron logs without exposing the row payloads that were written.
 */

export type EventReloadResult = {
  ScheduledCount: number;
  ActualCount: number;
};

export type WindowReloadDayResult = {
  sailingDay: string;
  scheduledCount: number;
  actualCount: number;
};
