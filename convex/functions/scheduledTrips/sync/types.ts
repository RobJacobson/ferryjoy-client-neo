/**
 * Shared sync result types for scheduled-trips actions. `VesselSailing` is
 * defined alongside raw schedule download in `convex/shared/fetchWsfScheduleData`.
 */

export type { VesselSailing } from "../../../shared/fetchWsfScheduleData";

/**
 * Result type for tracking individual day synchronization operations.
 * Provides detailed status reporting for each day in the sync window.
 */
export type DaySyncResult = {
  /** Sailing day that was processed in YYYY-MM-DD format */
  sailingDay: string;
  /** Action taken: synced (successful sync) or failed (error) */
  action: "synced" | "failed";
  /** Error message if the sync operation failed */
  error?: string;
};
