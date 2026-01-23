/**
 * Debug Depart-Next eligibility drops for a route.
 *
 * This script replays the training-window construction logic with counters so we
 * can see why "depart-next" models are missing for a given B->C pair (e.g.
 * FRH->ANA).
 *
 * Usage:
 * - `bun run ml:debug-depart-next -- FRH->ANA`
 * - `bunx tsx scripts/ml/debug-depart-next-eligibility.ts FRH->ANA`
 */

import { config } from "../../convex/domain/ml/shared/config";
import { createFeatureRecords } from "../../convex/domain/ml/shared/featureRecord";
import type {
  TerminalAbbrev,
  TerminalPairKey,
} from "../../convex/domain/ml/shared/types";
import { createTrainingWindows } from "../../convex/domain/ml/training/data/createTrainingWindows";
import { loadWsfTrainingData } from "../../convex/domain/ml/training/data/loadTrainingData";
import type { VesselHistory } from "../../ws-dottie/wsf-vessels/schemas";

// ============================================================================
// Types
// ============================================================================

type DebugCounts = {
  totalRawTrips: number;
  totalMappedTrips: number;

  candidatePrevCurrPairsSeen: number;

  continuityBreakPrevToCurr: number;
  durationInvalidCurrLeg: number;

  // Depart-next context (C->D leg)
  missingNextTrip: number;
  continuityBreakCurrToNext: number;
  unknownNextPairMeanAtDock: number;

  slackOver12Hours: number;
  slackOverThreshold: number;
  eligible: number;

  // Diagnostic: we did find a C->D next trip, but it failed eligibility.
  hasNextTripButIneligible: number;
};

type SlackSample = {
  nextPairKey: TerminalPairKey;
  slackMinutes: number;
  thresholdMinutes: number;
};

type Trip = {
  vesselAbbrev: string;
  departing: TerminalAbbrev;
  arriving: TerminalAbbrev;
  scheduledDepartMs: number;
  actualDepartMs: number;
  estArrivalMs: number;
};

// ============================================================================
// Main
// ============================================================================

const MINUTES_PER_HOUR = 60;
const MAX_SLACK_MINUTES = 12 * MINUTES_PER_HOUR;
const DEPART_NEXT_SLACK_MULTIPLIER = 1.5;

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const pairKeyArg = args[0];
  if (!pairKeyArg) {
    throw new Error(
      'Missing pair key argument. Example: "bun run ml:debug-depart-next -- FRH->ANA".'
    );
  }

  const targetPairKey = pairKeyArg as TerminalPairKey;
  const [targetB, targetC] = parsePairKey(targetPairKey);

  console.log("Loading WSF training data...");
  const wsfRecords = await loadWsfTrainingData();
  console.log("Loaded WSF records.", { records: wsfRecords.length });

  // 1) Quick truth: do we actually end up with eligible feature records?
  console.log("Building training windows and feature records...");
  const windows = createTrainingWindows(wsfRecords);
  const featureRecords = createFeatureRecords(windows);

  const featureStats = summarizeFeatureEligibility(
    featureRecords,
    targetPairKey
  );
  console.log("FeatureRecord eligibility summary", featureStats);
  console.log(
    "Train/test eligible counts (mirrors trainModel split on sampled bucket)",
    computeDepartNextTrainTestCounts(featureRecords, targetPairKey)
  );

  // 2) Reason breakdown: replay the window logic with counters focused on B->C.
  console.log("Replaying window logic for depart-next eligibility...");
  const debug = debugDepartNextEligibility(wsfRecords, targetB, targetC);

  console.log("Depart-next eligibility breakdown", debug.counts);
  console.log(
    "Next-pair distribution (when next trip exists)",
    debug.nextPairCounts
  );
  console.log(
    "Slack stats at Next (C) by nextPairKey",
    debug.slackStatsByNextPair
  );
}

// ============================================================================
// Core debug logic
// ============================================================================

const debugDepartNextEligibility = (
  records: VesselHistory[],
  targetB: TerminalAbbrev,
  targetC: TerminalAbbrev
) => {
  const counts: DebugCounts = {
    totalRawTrips: records.length,
    totalMappedTrips: 0,

    candidatePrevCurrPairsSeen: 0,

    continuityBreakPrevToCurr: 0,
    durationInvalidCurrLeg: 0,

    missingNextTrip: 0,
    continuityBreakCurrToNext: 0,
    unknownNextPairMeanAtDock: 0,

    slackOver12Hours: 0,
    slackOverThreshold: 0,
    eligible: 0,

    hasNextTripButIneligible: 0,
  };

  const slackSamples: SlackSample[] = [];
  const nextPairCounts = new Map<TerminalPairKey, number>();

  const grouped = groupByVessel(records);

  for (const vesselTrips of Object.values(grouped)) {
    const mapped = vesselTrips
      .map(mapTrip)
      .filter((t): t is Trip => t !== null)
      .sort((a, b) => a.scheduledDepartMs - b.scheduledDepartMs);

    counts.totalMappedTrips += mapped.length;

    for (let i = 1; i < mapped.length; i++) {
      const prev = mapped[i - 1];
      const curr = mapped[i];

      // Continuity A->B then B->C
      if (prev.arriving !== curr.departing) {
        continue;
      }

      const B = curr.departing;
      const C = curr.arriving;

      if (B !== targetB || C !== targetC) {
        continue;
      }

      counts.candidatePrevCurrPairsSeen += 1;

      const currPairKey = formatPairKey(B, C);
      const meanAtDockMinutesForCurrPair =
        config.getMeanAtDockDuration(currPairKey);
      if (meanAtDockMinutesForCurrPair <= 0) {
        // Not expected for known routes, but keeps logic honest.
        counts.durationInvalidCurrLeg += 1;
        continue;
      }

      const atDockDuration = minutesBetween(
        prev.estArrivalMs,
        curr.actualDepartMs
      );
      const atSeaDuration = minutesBetween(
        curr.actualDepartMs,
        curr.estArrivalMs
      );
      if (!areDurationsValidV1Compatible(atDockDuration, atSeaDuration)) {
        counts.durationInvalidCurrLeg += 1;
        continue;
      }

      const next = mapped[i + 1];
      if (!next) {
        counts.missingNextTrip += 1;
        continue;
      }

      if (next.departing !== C) {
        counts.continuityBreakCurrToNext += 1;
        continue;
      }

      const D = next.arriving;
      const nextPairKey = formatPairKey(C, D);
      nextPairCounts.set(
        nextPairKey,
        (nextPairCounts.get(nextPairKey) ?? 0) + 1
      );

      const meanAtDockMinutesForNextPair =
        config.getMeanAtDockDuration(nextPairKey);
      if (meanAtDockMinutesForNextPair <= 0) {
        counts.unknownNextPairMeanAtDock += 1;
        continue;
      }

      const slackMinutes = Math.max(
        0,
        minutesBetween(curr.estArrivalMs, next.scheduledDepartMs)
      );
      const thresholdMinutes =
        DEPART_NEXT_SLACK_MULTIPLIER * meanAtDockMinutesForNextPair;

      slackSamples.push({ nextPairKey, slackMinutes, thresholdMinutes });

      const over12h = slackMinutes > MAX_SLACK_MINUTES;
      const overThreshold = slackMinutes > thresholdMinutes;
      const eligible = !over12h && !overThreshold;

      if (!eligible) {
        counts.hasNextTripButIneligible += 1;
      }
      if (over12h) {
        counts.slackOver12Hours += 1;
      }
      if (overThreshold) {
        counts.slackOverThreshold += 1;
      }
      if (eligible) {
        counts.eligible += 1;
      }
    }
  }

  return {
    counts,
    nextPairCounts: Object.fromEntries(
      Array.from(nextPairCounts.entries()).sort((a, b) => b[1] - a[1])
    ),
    slackStatsByNextPair: computeSlackStatsByNextPair(slackSamples),
  };
};

const summarizeFeatureEligibility = (
  featureRecords: Array<TrainingWindowToFeatureRecord>,
  pairKey: TerminalPairKey
) => {
  const recordsForPair = featureRecords.filter(
    (r) => r.currPairKey === pairKey
  );
  const eligible = recordsForPair.filter((r) => r.isEligibleForDepartC);

  return {
    pairKey,
    totalFeatureRecords: recordsForPair.length,
    departNextEligibleFeatureRecords: eligible.length,
    departNextEligibleRate:
      recordsForPair.length > 0 ? eligible.length / recordsForPair.length : 0,
  };
};

type TrainingWindowToFeatureRecord = ReturnType<
  typeof createFeatureRecords
>[number];

// ============================================================================
// Helpers (local re-implementation for diagnostics)
// ============================================================================

const computeDepartNextTrainTestCounts = (
  featureRecords: TrainingWindowToFeatureRecord[],
  pairKey: TerminalPairKey
) => {
  // Mirror `createTrainingBuckets` ordering:
  // 1) take the most recent N records (recency bias)
  // 2) order that subset oldest→newest for a true time split
  const mostRecentFirst = featureRecords
    .filter((r) => r.currPairKey === pairKey)
    .slice()
    .sort((a, b) => b.currScheduledDepartMs - a.currScheduledDepartMs)
    .slice(0, config.getMaxSamplesPerRoute());
  const recordsForPair = mostRecentFirst
    .slice()
    .sort((a, b) => a.currScheduledDepartMs - b.currScheduledDepartMs);

  const splitIndex = Math.floor(recordsForPair.length * 0.8);
  const train = recordsForPair.slice(0, splitIndex);
  const test = recordsForPair.slice(splitIndex);

  const trainEligible = train.filter((r) => r.isEligibleForDepartC).length;
  const testEligible = test.filter((r) => r.isEligibleForDepartC).length;

  return {
    totalRecords: recordsForPair.length,
    trainRecords: train.length,
    testRecords: test.length,
    trainDepartNextTargets: trainEligible,
    testDepartNextTargets: testEligible,
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

const mapTrip = (trip: VesselHistory): Trip | null => {
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

const getTerminalAbbrev = (terminalName: string): TerminalAbbrev | null => {
  const abbrev = config.getTerminalAbbrev(terminalName);
  if (!abbrev || abbrev === terminalName) {
    return null;
  }
  return abbrev;
};

const minutesBetween = (earlierMs: number, laterMs: number): number =>
  (laterMs - earlierMs) / 60000;

const areDurationsValidV1Compatible = (
  atDockMinutes: number,
  atSeaMinutes: number
): boolean => {
  if (atSeaMinutes < config.getMinAtSeaDuration()) {
    return false;
  }
  if (atDockMinutes < config.getMinAtDockDuration()) {
    return false;
  }
  if (atDockMinutes > config.getMaxAtDockDuration()) {
    return false;
  }
  if (atSeaMinutes > config.getMaxAtSeaDuration()) {
    return false;
  }

  const arriveArriveTotal = atDockMinutes + atSeaMinutes;
  if (arriveArriveTotal > config.getMaxTotalDuration()) {
    return false;
  }

  return true;
};

const formatPairKey = (
  from: TerminalAbbrev,
  to: TerminalAbbrev
): TerminalPairKey => `${from}->${to}`;

const parsePairKey = (
  pairKey: TerminalPairKey
): [TerminalAbbrev, TerminalAbbrev] => {
  const parts = pairKey.split("->");
  if (parts.length !== 2) {
    throw new Error(`Invalid pair key: ${pairKey}`);
  }
  return [parts[0] as TerminalAbbrev, parts[1] as TerminalAbbrev];
};

const computeSlackStatsByNextPair = (samples: SlackSample[]) => {
  const grouped = new Map<TerminalPairKey, SlackSample[]>();
  for (const s of samples) {
    const arr = grouped.get(s.nextPairKey);
    if (arr) {
      arr.push(s);
    } else {
      grouped.set(s.nextPairKey, [s]);
    }
  }

  const statsEntries = Array.from(grouped.entries()).map(
    ([nextPairKey, ss]) => {
      const slack = ss.map((x) => x.slackMinutes).sort((a, b) => a - b);
      const thresholds = ss.map((x) => x.thresholdMinutes);
      const thresholdMinutes = thresholds.length ? thresholds[0] : 0;
      const overThreshold = ss.filter(
        (x) => x.slackMinutes > x.thresholdMinutes
      ).length;
      const over12h = ss.filter(
        (x) => x.slackMinutes > MAX_SLACK_MINUTES
      ).length;

      return [
        nextPairKey,
        {
          count: ss.length,
          thresholdMinutes,
          overThreshold,
          over12h,
          slackMinutes: {
            p50: percentile(slack, 0.5),
            p90: percentile(slack, 0.9),
            p99: percentile(slack, 0.99),
            max: slack.length ? slack[slack.length - 1] : 0,
          },
        },
      ] as const;
    }
  );

  statsEntries.sort((a, b) => b[1].count - a[1].count);
  return Object.fromEntries(statsEntries);
};

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.max(
    0,
    Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))
  );
  return sorted[idx] ?? 0;
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
