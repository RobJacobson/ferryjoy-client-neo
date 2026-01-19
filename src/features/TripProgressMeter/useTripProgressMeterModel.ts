/**
 * Model-building hook for TripProgressMeter.
 * Encapsulates time selection, width allocation, and indicator positioning.
 */

import { useEffect, useState } from "react";
import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";
import { clamp } from "@/shared/utils";
import { WIDTH_CONSTRAINTS } from "./config";
import { calculateProgress } from "./TripProgressBar";

// ============================================================================
// Types
// ============================================================================

export type TripProgressIndicatorModel = {
  leftPercent: number;
  minutesRemaining: number;
};

export type TripProgressMeterModel = {
  nowMs: number;
  arriveATimeMs?: number;
  departATimeMs?: number;
  arriveBTimeMs?: number;
  firstWidthPercent: number;
  secondWidthPercent: number;
  indicatorModel: TripProgressIndicatorModel | null;
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Builds the display model for TripProgressMeter.
 *
 * @param trip - VesselTrip object containing actual, predicted, and scheduled timing data
 * @returns Model containing computed times, widths, and indicator positioning
 */
export const useTripProgressMeterModel = (
  trip: VesselTrip
): TripProgressMeterModel => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Extract and prioritize time values: actual > predicted > scheduled
  const arriveATimeMs = trip.TripStart?.getTime();
  const departATimeMs = getBestTimeMs(
    trip.LeftDock,
    trip.AtDockDepartCurr?.PredTime,
    trip.ScheduledDeparture
  );
  const arriveBTimeMs = getBestTimeMs(
    trip.TripEnd,
    trip.AtSeaArriveNext?.PredTime,
    trip.Eta
  );

  // Calculate segment durations, ensuring missing values do not skew ratios
  const firstDurationMs = calculateDurationMs(arriveATimeMs, departATimeMs);
  const secondDurationMs = calculateDurationMs(departATimeMs, arriveBTimeMs);
  const totalDurationMs = firstDurationMs + secondDurationMs;

  // Calculate proportional widths based on duration ratios, with readability constraints
  let firstWidthPercent: number = WIDTH_CONSTRAINTS.defaultPercent;
  if (totalDurationMs > 0) {
    firstWidthPercent = (firstDurationMs / totalDurationMs) * 100;
    firstWidthPercent = clamp(
      firstWidthPercent,
      WIDTH_CONSTRAINTS.minPercent,
      WIDTH_CONSTRAINTS.maxPercent
    );
  }

  const secondWidthPercent = 100 - firstWidthPercent;

  const indicatorModel = calculateIndicatorModel({
    arriveATimeMs,
    departATimeMs,
    arriveBTimeMs,
    nowMs,
    firstWidthPercent,
    secondWidthPercent,
    isAtDock: trip.AtDock,
  });

  return {
    nowMs,
    arriveATimeMs,
    departATimeMs,
    arriveBTimeMs,
    firstWidthPercent,
    secondWidthPercent,
    indicatorModel,
  };
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Picks the best time value (actual > predicted > scheduled) as epoch ms.
 *
 * @param actual - Actual time value
 * @param predicted - Predicted time value
 * @param scheduled - Scheduled time value
 * @returns Epoch milliseconds for the best time, or undefined
 */
const getBestTimeMs = (
  actual?: Date,
  predicted?: Date,
  scheduled?: Date
): number | undefined => {
  if (actual) return actual.getTime();
  if (predicted) return predicted.getTime();
  return scheduled?.getTime();
};

/**
 * Calculates segment duration in ms, ensuring missing values do not skew ratios.
 *
 * @param startMs - Segment start time in epoch ms
 * @param endMs - Segment end time in epoch ms
 * @returns Non-negative segment duration in ms, or 0 if missing data
 */
const calculateDurationMs = (startMs?: number, endMs?: number): number => {
  if (startMs === undefined || endMs === undefined) {
    return 0;
  }

  return Math.max(0, endMs - startMs);
};

/**
 * Calculates minutes remaining until an end time from epoch ms.
 *
 * @param endTimeMs - End time in milliseconds
 * @param nowTimeMs - Current time in milliseconds
 * @returns Minutes remaining, rounded up, or 0 if missing/elapsed
 */
const calculateMinutesRemainingMs = (
  endTimeMs?: number,
  nowTimeMs?: number
): number => {
  if (endTimeMs === undefined || nowTimeMs === undefined) {
    return 0;
  }

  const remainingMs = endTimeMs - nowTimeMs;
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.ceil(remainingMs / (1000 * 60));
};

/**
 * Builds indicator position + minutes remaining for the active segment.
 *
 * @param params - Inputs needed to compute the indicator model
 * @returns A model for rendering the indicator, or null if missing timing inputs
 */
const calculateIndicatorModel = (params: {
  arriveATimeMs?: number;
  departATimeMs?: number;
  arriveBTimeMs?: number;
  nowMs: number;
  firstWidthPercent: number;
  secondWidthPercent: number;
  isAtDock: boolean;
}): TripProgressIndicatorModel | null => {
  const {
    arriveATimeMs,
    departATimeMs,
    arriveBTimeMs,
    nowMs,
    firstWidthPercent,
    secondWidthPercent,
    isAtDock,
  } = params;

  const activeStartMs = isAtDock ? arriveATimeMs : departATimeMs;
  const activeEndMs = isAtDock ? departATimeMs : arriveBTimeMs;
  if (activeStartMs === undefined || activeEndMs === undefined) {
    return null;
  }

  const progress = calculateProgress(activeStartMs, activeEndMs, nowMs);
  const segmentOffsetPercent = isAtDock ? 0 : firstWidthPercent;
  const segmentWidthPercent = isAtDock ? firstWidthPercent : secondWidthPercent;

  return {
    leftPercent: segmentOffsetPercent + progress * segmentWidthPercent,
    minutesRemaining: calculateMinutesRemainingMs(activeEndMs, nowMs),
  };
};
