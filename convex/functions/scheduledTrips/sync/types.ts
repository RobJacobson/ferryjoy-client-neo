/**
 * Shared sync result types for scheduled-trips actions. Raw WSF vessel-sailing
 * rows are defined in the WSF adapter layer.
 */

export type { VesselSailing } from "adapters/wsf/scheduledTrips/types";

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
