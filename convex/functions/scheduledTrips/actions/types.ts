/**
 * Type for scheduled trip document as returned from database queries
 * Includes _id and _creationTime fields
 */
export type ScheduledTripDoc = import("../schemas").ConvexScheduledTrip & {
  _id: string;
  _creationTime: number;
};

/**
 * Result type for individual route sync operations
 */
export type RouteSyncResult = {
  routeId: number;
  routeAbbrev: string;
  results: { deleted: number; inserted: number; updated: number };
};

/**
 * Verification result type for data consistency checking
 */
export type VerificationResult = {
  isValid: boolean;
  issues: string[];
  wsfTripCount: number;
  convexTripCount: number;
  routeId: number;
};
