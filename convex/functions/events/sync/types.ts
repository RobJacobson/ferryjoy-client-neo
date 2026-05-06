/**
 * Shared sync result types for dock-event reload actions.
 *
 * These types keep action helpers explicit without introducing a broader sync
 * framework around the small Stage 6 reload surface.
 */

type EventReloadResult = {
  ScheduledCount: number;
  ActualCount: number;
};

type WindowReloadDayResult = {
  sailingDay: string;
  scheduledCount: number;
  actualCount: number;
};

type WindowReloadResult = {
  totalScheduled: number;
  totalActual: number;
  daysProcessed: WindowReloadDayResult[];
};

export type { EventReloadResult, WindowReloadDayResult, WindowReloadResult };
