// ============================================================================
// TIME UTILITY FUNCTIONS
// Shared time-related functions for ML pipeline
// ============================================================================

// DST periods for 2025
// DST starts March 9, 2025 at 2:00 AM PDT = 10:00 AM UTC (spring forward)
// DST ends November 2, 2025 at 2:00 AM PST = 9:00 AM UTC (fall back)
export const dstStart = new Date("2025-03-09T10:00:00Z");
export const dstEnd = new Date("2025-11-02T09:00:00Z");

/**
 * Get Pacific time from UTC
 */
export const getPacificTime = (utcDate: Date): Date => {
  const isDST = utcDate >= dstStart && utcDate < dstEnd;

  // Pacific offset: -8 hours (PST) or -7 hours (PDT)
  const pacificOffset = isDST ? -7 * 60 * 60 * 1000 : -8 * 60 * 60 * 1000;

  const pacificTime = new Date(utcDate.getTime() + pacificOffset);
  return pacificTime;
};
