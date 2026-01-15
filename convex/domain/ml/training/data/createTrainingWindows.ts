// ============================================================================
// ML - CREATE TRAINING WINDOWS
// Transform raw trip data into ML training windows with temporal context
// ============================================================================

/**
 * ## Training Window Creation Overview
 *
 * This module transforms raw WSF trip data into structured training windows
 * that provide the temporal context needed for ML predictions.
 *
 * ## What is a Training Window?
 *
 * A training window represents a vessel's journey segment with:
 * - **Previous Leg (A→B)**: Context about how vessel arrived at current terminal
 * - **Current Leg (B→C)**: The leg we're making predictions about
 * - **Optional Next Leg (C→D)**: Future context for multi-leg predictions
 *
 * ## Key Concepts
 *
 * ### Regime Classification
 * - **In-service**: Tight schedule, minimal slack (normal operations)
 * - **Layover**: Extended terminal time (>1.5× average turnaround)
 *
 * ### Window Types
 * - **With Depart-C**: Includes next leg context for depart-next predictions
 * - **Without Depart-C**: Basic window without future leg information
 *
 * ## Data Quality Filters
 *
 * - Duration validation (at-sea and at-dock within reasonable bounds)
 * - Terminal continuity (consecutive trips must connect properly)
 * - Timestamp validity (no negative or extreme durations)
 * - Vessel consistency (trips must belong to same vessel)
 *
 * ## Business Logic
 *
 * The window creation logic embodies key business rules:
 * - Vessels operate in continuous chains of trips
 * - Schedule pressure affects operational behavior
 * - Historical patterns inform future predictions
 * - Multi-leg journeys require coordinated predictions
 */

/** biome-ignore-all lint/style/noNonNullAssertion: Narrowed by guards below */

import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import { config, formatTerminalPairKey } from "../../shared/config";
import type {
  TerminalAbbrev,
  TerminalPairKey,
  TrainingWindow,
  TrainingWindowBase,
} from "../../shared/types";

const MINUTES_PER_HOUR = 60;
const MAX_SLACK_MINUTES = 12 * MINUTES_PER_HOUR;

const minutesBetween = (earlierMs: number, laterMs: number): number =>
  (laterMs - earlierMs) / 60000;

const getTerminalAbbrev = (terminalName: string): TerminalAbbrev | null => {
  const abbrev = config.getTerminalAbbrev(terminalName);
  if (!abbrev || abbrev === terminalName) {
    return null;
  }
  return abbrev;
};

type MappedTrip = {
  vesselAbbrev: string;
  departing: TerminalAbbrev;
  arriving: TerminalAbbrev;
  scheduledDepartMs: number;
  actualDepartMs: number;
  estArrivalMs: number;
};

const mapTrip = (trip: VesselHistory): MappedTrip | null => {
  if (
    !trip.Vessel ||
    !trip.Departing ||
    !trip.Arriving ||
    !trip.ScheduledDepart ||
    !trip.ActualDepart ||
    !trip.EstArrival
  ) {
    return null;
  }

  const departing = getTerminalAbbrev(trip.Departing);
  const arriving = getTerminalAbbrev(trip.Arriving);
  if (!departing || !arriving) {
    return null;
  }
  if (!config.isValidTerminal(departing) || !config.isValidTerminal(arriving)) {
    return null;
  }

  return {
    vesselAbbrev: trip.Vessel,
    departing,
    arriving,
    scheduledDepartMs: trip.ScheduledDepart.getTime(),
    actualDepartMs: trip.ActualDepart.getTime(),
    estArrivalMs: trip.EstArrival.getTime(),
  };
};

const groupByVessel = (
  records: VesselHistory[]
): Record<string, VesselHistory[]> =>
  records.reduce(
    (groups, r) => {
      const key = String(r.Vessel ?? "unknown");
      groups[key] ??= [];
      groups[key].push(r);
      return groups;
    },
    {} as Record<string, VesselHistory[]>
  );

type TripCalculationsV1Compatible = {
  AtDockDuration: number;
  AtSeaDuration: number;
};

/**
 * V1-equivalent filtering for B->C legs.
 *
 * NOTE: Do not clamp negatives with Math.max(0, ...). If timestamps produce
 * negative durations, we want to exclude those records (matching v1).
 */
const areDurationsValidV1Compatible = (
  calc: TripCalculationsV1Compatible
): boolean => {
  if (calc.AtSeaDuration < config.getMinAtSeaDuration()) {
    return false;
  }
  if (calc.AtDockDuration < config.getMinAtDockDuration()) {
    return false;
  }
  if (calc.AtDockDuration > config.getMaxAtDockDuration()) {
    return false;
  }
  if (calc.AtSeaDuration > config.getMaxAtSeaDuration()) {
    return false;
  }

  const arriveArriveTotal = calc.AtDockDuration + calc.AtSeaDuration;
  if (arriveArriveTotal > config.getMaxTotalDuration()) {
    return false;
  }

  return true;
};

/**
 * Create training windows from raw vessel trip data.
 *
 * This function processes historical ferry trip data to create structured training examples
 * that capture the temporal dependencies and operational context needed for accurate predictions.
 *
 * ## Processing Logic
 *
 * 1. **Group by Vessel**: Process trips chronologically per vessel to maintain journey continuity
 * 2. **Build Windows**: For each consecutive trip pair (i, i+1), create a training window
 * 3. **Terminal Continuity**: Ensure prev arrival terminal matches curr departure terminal
 * 4. **Duration Validation**: Filter out trips with unrealistic at-dock/at-sea durations
 * 6. **Optional Next Leg**: Include C→D context when available and relevant
 *
 * ## Window Structure
 *
 * Each window contains:
 * - **Core Context**: A→B→C terminal sequence with timing data
 * - **Operational Data**: Actual vs scheduled times, durations, slack calculations
 * - **Optional Extension**: C→D leg for multi-leg prediction training
 *
 * ## Quality Assurance
 *
 * - Invalid data (missing timestamps, impossible durations) is filtered out
 * - Terminal mappings are validated against known WSF terminals
 * - Duration bounds prevent training on anomalous or erroneous data
 * - Vessel continuity ensures logical trip sequences
 *
 * @param records - Raw WSF vessel trip records from historical data
 * @returns Array of validated training windows ready for feature extraction
 */
export const createTrainingWindows = (
  records: VesselHistory[]
): TrainingWindow[] => {
  const vesselGroups = groupByVessel(records);

  const windows: TrainingWindow[] = [];

  // Process each vessel's trips independently to maintain journey continuity
  for (const vesselTrips of Object.values(vesselGroups)) {
    // Sort trips chronologically by scheduled departure time
    // This ensures we process trips in the order they actually occurred
    const sorted = vesselTrips
      .slice()
      .sort(
        (a, b) =>
          (a.ScheduledDepart?.getTime() ?? 0) -
          (b.ScheduledDepart?.getTime() ?? 0)
      );

    // Process consecutive trip pairs (i-1, i) to build training windows
    // Each window needs context from the previous trip to understand arrival conditions
    for (let i = 1; i < sorted.length; i++) {
      const prevRaw = sorted[i - 1]; // Previous trip (A→B)
      const currRaw = sorted[i]; // Current trip (B→C)

      // Transform raw WSF data into structured trip objects
      const prev = mapTrip(prevRaw);
      const curr = mapTrip(currRaw);

      // Skip if either trip has invalid/missing data
      if (!prev || !curr) {
        continue;
      }

      // Ensure terminal continuity: previous trip must arrive where current trip departs
      // This validates that we're looking at a continuous vessel journey
      if (prev.arriving !== curr.departing) {
        continue;
      }

      // Extract terminal abbreviations for clarity
      // A = departure terminal of previous trip
      // B = current terminal (arrival from A, departure to C)
      // C = arrival terminal of current trip
      const A = prev.departing;
      const B = curr.departing;
      const C = curr.arriving;

      // Get route-specific historical averages for regime classification
      const currPairKey = formatTerminalPairKey(B, C) as TerminalPairKey;
      const meanAtDockMinutesForCurrPair =
        config.getMeanAtDockDuration(currPairKey);

      // Calculate actual durations for data quality validation
      const calc: TripCalculationsV1Compatible = {
        AtDockDuration: minutesBetween(prev.estArrivalMs, curr.actualDepartMs), // B→C at-dock time
        AtSeaDuration: minutesBetween(curr.actualDepartMs, curr.estArrivalMs), // B→C at-sea time
      };

      // Filter out anomalous duration data that would contaminate training
      if (!areDurationsValidV1Compatible(calc)) {
        continue;
      }

      // Calculate slack time, clamping very early departures to prevent extreme values
      // This makes layover classification more inclusive for experimental purposes
      const rawSlackMinutes = minutesBetween(
        prev.estArrivalMs,
        curr.scheduledDepartMs
      );
      const clampedSlackMinutes = Math.min(
        Math.max(rawSlackMinutes, 0), // Clamp negatives to 0 (early arrivals)
        meanAtDockMinutesForCurrPair > 0
          ? 1.5 * meanAtDockMinutesForCurrPair
          : 0 // Clamp very early arrivals at 1.5x mean
      );

      const baseWindow: TrainingWindowBase = {
        vesselAbbrev: prev.vesselAbbrev,
        prevTerminalAbbrev: A,
        currTerminalAbbrev: B,
        nextTerminalAbbrev: C,
        prevLeg: {
          fromTerminalAbbrev: A,
          toTerminalAbbrev: B,
          scheduledDepartMs: prev.scheduledDepartMs,
          actualDepartMs: prev.actualDepartMs,
          arrivalProxyMs: prev.estArrivalMs,
          arrivalProxySource: "wsf_est_arrival",
        },
        currLeg: {
          fromTerminalAbbrev: B,
          toTerminalAbbrev: C,
          scheduledDepartMs: curr.scheduledDepartMs,
          actualDepartMs: curr.actualDepartMs,
          arrivalProxyMs: curr.estArrivalMs,
          arrivalProxySource: "wsf_est_arrival",
        },
        currPairKey,
        slackBeforeCurrScheduledDepartMinutes: clampedSlackMinutes,
        meanAtDockMinutesForCurrPair,
        currScheduledDepartMs: curr.scheduledDepartMs,
      };

      // Optional depart-C info (requires the immediate next trip to depart from C).
      const nextRaw = sorted[i + 1];
      const next = nextRaw ? mapTrip(nextRaw) : null;

      if (!next || next.departing !== C) {
        windows.push({ ...baseWindow, kind: "no_depart_c" });
        continue;
      }

      const D = next.arriving;
      const nextPairKey = formatTerminalPairKey(C, D) as TerminalPairKey;
      const meanAtDockMinutesForNextPair =
        config.getMeanAtDockDuration(nextPairKey);
      if (meanAtDockMinutesForNextPair <= 0) {
        windows.push({ ...baseWindow, kind: "no_depart_c" });
        continue;
      }

      // Slack at Next: arrival proxy at Next to next scheduled departure from Next.
      const slackBeforeNextScheduledDepartMinutes = Math.max(
        0,
        minutesBetween(curr.estArrivalMs, next.scheduledDepartMs)
      );

      const isEligibleForDepartC =
        slackBeforeNextScheduledDepartMinutes <=
          1.5 * meanAtDockMinutesForNextPair &&
        slackBeforeNextScheduledDepartMinutes <= MAX_SLACK_MINUTES;

      if (!isEligibleForDepartC) {
        windows.push({ ...baseWindow, kind: "no_depart_c" });
        continue;
      }

      windows.push({
        ...baseWindow,
        kind: "with_depart_c",
        afterTerminalAbbrev: D,
        nextLeg: {
          fromTerminalAbbrev: C,
          toTerminalAbbrev: D,
          scheduledDepartMs: next.scheduledDepartMs,
          actualDepartMs: next.actualDepartMs,
        },
        nextPairKey,
        slackBeforeNextScheduledDepartMinutes,
        meanAtDockMinutesForNextPair,
        isEligibleForDepartC: true,
      });
    }
  }

  return windows;
};
