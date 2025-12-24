// ============================================================================
// TIME UTILITY FUNCTIONS
// Shared time-related functions for ML pipeline
// ============================================================================

// DST periods by year - all times in UTC
// DST starts at 2:00 AM PDT (10:00 AM UTC) on second Sunday in March (spring forward)
// DST ends at 2:00 AM PST (9:00 AM UTC) on first Sunday in November (fall back)
const dstPeriods: Record<number, { dstStart: Date; dstEnd: Date }> = {
  2024: {
    dstStart: new Date("2024-03-10T10:00:00Z"), // March 10, 2024
    dstEnd: new Date("2024-11-03T09:00:00Z"), // November 3, 2024
  },
  2025: {
    dstStart: new Date("2025-03-09T10:00:00Z"), // March 9, 2025
    dstEnd: new Date("2025-11-02T09:00:00Z"), // November 2, 2025
  },
  2026: {
    dstStart: new Date("2026-03-08T10:00:00Z"), // March 8, 2026
    dstEnd: new Date("2026-11-02T09:00:00Z"), // November 2, 2026
  },
  2027: {
    dstStart: new Date("2027-03-14T10:00:00Z"), // March 14, 2027
    dstEnd: new Date("2027-11-07T09:00:00Z"), // November 7, 2027
  },
  2028: {
    dstStart: new Date("2028-03-12T10:00:00Z"), // March 12, 2028
    dstEnd: new Date("2028-11-05T09:00:00Z"), // November 5, 2028
  },
  2029: {
    dstStart: new Date("2029-03-11T10:00:00Z"), // March 11, 2029
    dstEnd: new Date("2029-11-04T09:00:00Z"), // November 4, 2029
  },
  2030: {
    dstStart: new Date("2030-03-10T10:00:00Z"), // March 10, 2030
    dstEnd: new Date("2030-11-03T09:00:00Z"), // November 3, 2030
  },
};

/**
 * Get DST period for a given year
 */
const getDSTPeriod = (year: number): { dstStart: Date; dstEnd: Date } => {
  const period = dstPeriods[year];
  if (period) {
    return period;
  }

  // For years not in our lookup, use 2024 dates as fallback
  console.warn(
    `DST dates not defined for year ${year}, using 2024 dates as fallback`
  );
  return dstPeriods[2024];
};

/**
 * Get Pacific time from UTC
 */
export const getPacificTime = (utcDate: Date): Date => {
  const year = utcDate.getUTCFullYear();
  const { dstStart, dstEnd } = getDSTPeriod(year);
  const isDST = utcDate >= dstStart && utcDate < dstEnd;

  // Pacific offset: -8 hours (PST) or -7 hours (PDT)
  const pacificOffset = isDST ? -7 * 60 * 60 * 1000 : -8 * 60 * 60 * 1000;

  const pacificTime = new Date(utcDate.getTime() + pacificOffset);
  return pacificTime;
};

export const getMinutesDelta = (startTime: Date, endTime: Date): number =>
  (endTime.getTime() - startTime.getTime()) / (1000 * 60);
