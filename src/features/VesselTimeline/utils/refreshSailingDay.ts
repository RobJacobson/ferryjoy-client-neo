/**
 * Sailing-day refresh helpers for VesselTimeline host screens.
 */

import { getSailingDay } from "@/shared/utils/getSailingDay";

/**
 * Returns the current WSF sailing day using the 3:00 AM Pacific rollover.
 *
 * @param now - Current instant, defaulting to the wall clock
 * @returns Current sailing day in YYYY-MM-DD format
 */
export const getCurrentSailingDay = (now: Date = new Date()) =>
  getSailingDay(now);

/**
 * Recomputes the sailing day and preserves the existing value when no rollover
 * has occurred.
 *
 * @param currentSailingDay - Current screen-level sailing day state
 * @param now - Current instant, defaulting to the wall clock
 * @returns Unchanged sailing day when still current, otherwise the next one
 */
export const getRefreshedSailingDay = (
  currentSailingDay: string,
  now: Date = new Date()
) => {
  const nextSailingDay = getCurrentSailingDay(now);
  return currentSailingDay === nextSailingDay
    ? currentSailingDay
    : nextSailingDay;
};
