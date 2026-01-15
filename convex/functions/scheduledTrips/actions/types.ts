import type { TerminalCombo } from "ws-dottie/wsf-schedule";
import type { ConvexScheduledTrip } from "../schemas";

/**
 * Type for scheduled trip document as returned from database queries
 * Includes _id and _creationTime fields
 */
export type ScheduledTripDoc = ConvexScheduledTrip & {
  _id: string;
  _creationTime: number;
};

/**
 * Internal type representing a scheduled vessel sailing from WSF API terminal combinations.
 * Contains vessel details and timing information for a specific departure/arrival.
 */
export type VesselSailing = {
  /** Scheduled departure time as Date object */
  DepartingTime: Date;
  /** Scheduled arrival time, null for one-way trips */
  ArrivingTime: Date | null;
  /** WSF loading rule classification (1-3) */
  LoadingRule: 1 | 2 | 3;
  /** Unique vessel identifier */
  VesselID: number;
  /** Full vessel name for abbreviation lookup */
  VesselName: string;
  /** Whether vessel is handicap accessible */
  VesselHandicapAccessible: boolean;
  /** Vessel position number in terminal */
  VesselPositionNum: number;
  /** Array of route IDs this vessel serves */
  Routes: number[];
  /** Indexes into terminal combo annotations array, null if no annotations */
  AnnotationIndexes: number[] | null;
};


/**
 * Result type for tracking individual day synchronization operations.
 * Provides detailed status reporting for each day in the sync window.
 */
export type DaySyncResult = {
  /** Sailing day that was processed in YYYY-MM-DD format */
  sailingDay: string;
  /** Action taken: downloaded (new data), updated (existing data), or failed (error) */
  action: "downloaded" | "updated" | "failed";
  /** Error message if the sync operation failed */
  error?: string;
};
