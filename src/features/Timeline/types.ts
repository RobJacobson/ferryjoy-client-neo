/**
 * Shared types for Timeline components.
 */

export type TimelineSegmentStatus = "Pending" | "InProgress" | "Completed";

/**
 * Represents the temporal state of a timeline segment.
 * Grouping these properties reduces prop drilling and simplifies component interfaces.
 */
export type TimelineSegmentState = {
  /**
   * Start time in milliseconds for progress calculation.
   */
  startTimeMs?: number;
  /**
   * End time in milliseconds for progress calculation.
   */
  endTimeMs?: number;
  /**
   * Optional prediction for the end time of this segment.
   * If provided, progress will be calculated against this instead of endTimeMs
   * when the vessel is delayed.
   */
  predictionEndTimeMs?: number;
  /**
   * Status of the progress bar segment.
   */
  status: TimelineSegmentStatus;
  /**
   * Whether the vessel has arrived at its destination terminal for this segment.
   */
  isArrived?: boolean;
  /**
   * Whether the trip is currently being held in its completed state.
   */
  isHeld?: boolean;
};
