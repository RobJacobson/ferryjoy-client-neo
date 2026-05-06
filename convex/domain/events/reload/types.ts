/**
 * Compatibility re-exports for legacy event reload type imports.
 *
 * New code should import schedule reload segments from the scheduled domain and
 * history reload rows from the actual domain.
 */

export type { EventReloadHistoryRecord } from "../actual/reloadTypes";
export type { EventReloadScheduleSegment } from "../scheduled/types";
