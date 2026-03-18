import type { TimelineRowEvent } from "../../types";

export const getLayoutTime = (event: TimelineRowEvent) =>
  event.ScheduledTime ?? event.ActualTime ?? event.PredictedTime;

export const getDisplayTime = (event: TimelineRowEvent) =>
  event.ActualTime ?? event.PredictedTime ?? event.ScheduledTime;
