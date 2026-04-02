#!/usr/bin/env tsx

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { ConvexHistoricVesselLocation } from "../convex/functions/vesselLocationsHistoric/schemas";

type CliArgs = {
  vesselAbbrev: string;
  sailingDay: string;
  arrivalThresholdMiles: number;
  departureThresholdMiles: number;
};

type TerminalDistanceSample = {
  terminalAbbrev: string;
  terminalName?: string;
  distanceMiles: number;
  source: "departing" | "arriving";
};

type TerminalVisit = {
  terminalAbbrev: string;
  terminalName?: string;
  arrivedAt: number;
  departedAt?: number;
  arrivalSource: TerminalDistanceSample["source"];
  departureReason?: string;
  minObservedDistanceMiles: number;
  samplesWhileDocked: number;
};

const DEFAULT_ARRIVAL_THRESHOLD_MILES = 0.2;
const DEFAULT_DEPARTURE_THRESHOLD_MILES = 0.3;
const DEFAULT_MERGE_GAP_MINUTES = 12;
const DEFAULT_BLIP_VISIT_MINUTES = 4;

/**
 * Parse CLI arguments.
 */
const parseArgs = (argv: string[]): CliArgs => {
  const positionals = argv.filter((arg) => !arg.startsWith("--"));
  const arrivalThresholdMiles = readNumericFlag(
    argv,
    "--arrival-threshold",
    DEFAULT_ARRIVAL_THRESHOLD_MILES
  );
  const departureThresholdMiles = readNumericFlag(
    argv,
    "--departure-threshold",
    DEFAULT_DEPARTURE_THRESHOLD_MILES
  );

  if (positionals.length < 2) {
    console.error(
      "Usage: npm run analyze:vessel-terminal-chronology -- <VESSEL_ABBREV> <SAILING_DAY YYYY-MM-DD> [--arrival-threshold 0.2] [--departure-threshold 0.3]"
    );
    process.exit(1);
  }

  const vesselAbbrev = (positionals[0] ?? "").trim().toUpperCase();
  const sailingDay = (positionals[1] ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(sailingDay)) {
    console.error("Sailing day must use YYYY-MM-DD format.", { sailingDay });
    process.exit(1);
  }

  if (arrivalThresholdMiles <= 0 || departureThresholdMiles <= 0) {
    console.error("Thresholds must be positive numbers.", {
      arrivalThresholdMiles,
      departureThresholdMiles,
    });
    process.exit(1);
  }

  if (departureThresholdMiles < arrivalThresholdMiles) {
    console.error(
      "Departure threshold should be greater than or equal to the arrival threshold."
    );
    process.exit(1);
  }

  return {
    vesselAbbrev,
    sailingDay,
    arrivalThresholdMiles,
    departureThresholdMiles,
  };
};

/**
 * Read one numeric CLI flag with a fallback.
 */
const readNumericFlag = (
  argv: string[],
  flagName: string,
  fallback: number
): number => {
  const flagIndex = argv.indexOf(flagName);
  if (flagIndex < 0) {
    return fallback;
  }

  const rawValue = argv[flagIndex + 1];
  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue)) {
    console.error(`Flag ${flagName} requires a numeric value.`, { rawValue });
    process.exit(1);
  }

  return parsedValue;
};

/**
 * Fetch historic location rows for the requested vessel/day.
 */
const fetchHistoricRows = async ({
  vesselAbbrev,
  sailingDay,
}: Pick<CliArgs, "vesselAbbrev" | "sailingDay">) => {
  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  const convex = new ConvexHttpClient(convexUrl);

  const rows = (await convex.query(
    api.functions.vesselLocationsHistoric.queries.getByVesselAndSailingDay,
    {
      vesselAbbrev,
      sailingDay,
    }
  )) as ConvexHistoricVesselLocation[];

  return rows;
};

/**
 * Build a coarse terminal chronology from historic vessel-location rows.
 */
const reconstructTerminalVisits = (
  rows: ConvexHistoricVesselLocation[],
  arrivalThresholdMiles: number,
  departureThresholdMiles: number
) => {
  const visits: TerminalVisit[] = [];
  let openVisit: TerminalVisit | null = null;

  for (const row of rows) {
    const nearbySamples = getNearbyTerminalSamples(row);
    const arrivalCandidate = pickNearestSampleWithin(
      nearbySamples,
      arrivalThresholdMiles
    );
    const currentTerminalSample = openVisit
      ? getSampleForTerminal(nearbySamples, openVisit.terminalAbbrev)
      : undefined;

    if (
      openVisit &&
      shouldCloseVisit(row, openVisit, currentTerminalSample, departureThresholdMiles)
    ) {
      openVisit.departedAt = row.TimeStamp;
      openVisit.departureReason = describeDepartureReason(
        row,
        currentTerminalSample,
        departureThresholdMiles
      );
      visits.push(openVisit);
      openVisit = null;
    }

    if (!openVisit && arrivalCandidate) {
      openVisit = {
        terminalAbbrev: arrivalCandidate.terminalAbbrev,
        terminalName: arrivalCandidate.terminalName,
        arrivedAt: row.TimeStamp,
        arrivalSource: arrivalCandidate.source,
        minObservedDistanceMiles: arrivalCandidate.distanceMiles,
        samplesWhileDocked: 1,
      };
      continue;
    }

    if (
      openVisit &&
      arrivalCandidate &&
      arrivalCandidate.terminalAbbrev !== openVisit.terminalAbbrev
    ) {
      openVisit.departedAt ??= row.TimeStamp;
      openVisit.departureReason ??= "terminal_switch";
      visits.push(openVisit);
      openVisit = {
        terminalAbbrev: arrivalCandidate.terminalAbbrev,
        terminalName: arrivalCandidate.terminalName,
        arrivedAt: row.TimeStamp,
        arrivalSource: arrivalCandidate.source,
        minObservedDistanceMiles: arrivalCandidate.distanceMiles,
        samplesWhileDocked: 1,
      };
      continue;
    }

    if (openVisit && currentTerminalSample) {
      openVisit.minObservedDistanceMiles = Math.min(
        openVisit.minObservedDistanceMiles,
        currentTerminalSample.distanceMiles
      );
      openVisit.samplesWhileDocked += 1;
      openVisit.terminalName ||= currentTerminalSample.terminalName;
    }
  }

  if (openVisit) {
    visits.push(openVisit);
  }

  return smoothVisits(visits);
};

/**
 * Collect proximity samples from a single historic row.
 */
const getNearbyTerminalSamples = (
  row: ConvexHistoricVesselLocation
): TerminalDistanceSample[] => {
  const samples: TerminalDistanceSample[] = [];

  if (
    row.DepartingTerminalAbbrev &&
    typeof row.DepartingDistance === "number" &&
    Number.isFinite(row.DepartingDistance)
  ) {
    samples.push({
      terminalAbbrev: row.DepartingTerminalAbbrev,
      terminalName: row.DepartingTerminalName,
      distanceMiles: row.DepartingDistance,
      source: "departing",
    });
  }

  if (
    row.ArrivingTerminalAbbrev &&
    typeof row.ArrivingDistance === "number" &&
    Number.isFinite(row.ArrivingDistance)
  ) {
    samples.push({
      terminalAbbrev: row.ArrivingTerminalAbbrev,
      terminalName: row.ArrivingTerminalName,
      distanceMiles: row.ArrivingDistance,
      source: "arriving",
    });
  }

  return dedupeTerminalSamples(samples);
};

/**
 * Keep the shortest distance per terminal when both arriving/departing samples exist.
 */
const dedupeTerminalSamples = (samples: TerminalDistanceSample[]) => {
  const bestByTerminal = new Map<string, TerminalDistanceSample>();

  for (const sample of samples) {
    const existing = bestByTerminal.get(sample.terminalAbbrev);
    if (!existing || sample.distanceMiles < existing.distanceMiles) {
      bestByTerminal.set(sample.terminalAbbrev, sample);
    }
  }

  return Array.from(bestByTerminal.values()).sort(
    (left, right) => left.distanceMiles - right.distanceMiles
  );
};

/**
 * Pick the closest terminal within the provided threshold.
 */
const pickNearestSampleWithin = (
  samples: TerminalDistanceSample[],
  thresholdMiles: number
) => samples.find((sample) => sample.distanceMiles <= thresholdMiles);

/**
 * Find the sample for one terminal in the current row, if present.
 */
const getSampleForTerminal = (
  samples: TerminalDistanceSample[],
  terminalAbbrev: string
) => samples.find((sample) => sample.terminalAbbrev === terminalAbbrev);

/**
 * Decide whether an open terminal visit should be closed on this row.
 */
const shouldCloseVisit = (
  row: ConvexHistoricVesselLocation,
  openVisit: TerminalVisit,
  currentTerminalSample: TerminalDistanceSample | undefined,
  departureThresholdMiles: number
) => {
  if (
    currentTerminalSample &&
    currentTerminalSample.distanceMiles > departureThresholdMiles
  ) {
    return true;
  }

  if (!row.AtDock && !currentTerminalSample) {
    return true;
  }

  if (
    !row.AtDock &&
    currentTerminalSample &&
    currentTerminalSample.distanceMiles > departureThresholdMiles
  ) {
    return true;
  }

  return false;
};

/**
 * Merge obvious terminal jitter into a cleaner chronology.
 */
const smoothVisits = (visits: TerminalVisit[]) => {
  const mergedVisits = mergeAdjacentSameTerminalVisits(visits);
  return collapseTerminalBlips(mergedVisits);
};

/**
 * Merge consecutive visits to the same terminal when the gap is short.
 */
const mergeAdjacentSameTerminalVisits = (visits: TerminalVisit[]) => {
  const merged: TerminalVisit[] = [];

  for (const visit of visits) {
    const previous = merged.at(-1);
    const gapMinutes =
      previous?.departedAt === undefined
        ? Number.POSITIVE_INFINITY
        : (visit.arrivedAt - previous.departedAt) / 60000;

    if (
      previous &&
      previous.terminalAbbrev === visit.terminalAbbrev &&
      gapMinutes <= DEFAULT_MERGE_GAP_MINUTES
    ) {
      previous.departedAt = visit.departedAt;
      previous.departureReason = visit.departureReason;
      previous.minObservedDistanceMiles = Math.min(
        previous.minObservedDistanceMiles,
        visit.minObservedDistanceMiles
      );
      previous.samplesWhileDocked += visit.samplesWhileDocked;
      previous.terminalName ||= visit.terminalName;
      continue;
    }

    merged.push({ ...visit });
  }

  return merged;
};

/**
 * Remove short middle visits when the vessel immediately returns to the same terminal.
 */
const collapseTerminalBlips = (visits: TerminalVisit[]) => {
  const collapsed: TerminalVisit[] = [];

  for (let index = 0; index < visits.length; index += 1) {
    const current = visits[index];
    const previous = collapsed.at(-1);
    const next = visits[index + 1];
    const dwellMinutes =
      current?.departedAt === undefined
        ? Number.POSITIVE_INFINITY
        : (current.departedAt - current.arrivedAt) / 60000;

    if (
      previous &&
      current &&
      next &&
      dwellMinutes <= DEFAULT_BLIP_VISIT_MINUTES &&
      previous.terminalAbbrev === next.terminalAbbrev &&
      current.terminalAbbrev !== previous.terminalAbbrev
    ) {
      previous.departedAt = next.departedAt;
      previous.departureReason = next.departureReason;
      previous.minObservedDistanceMiles = Math.min(
        previous.minObservedDistanceMiles,
        next.minObservedDistanceMiles
      );
      previous.samplesWhileDocked += next.samplesWhileDocked;
      previous.terminalName ||= next.terminalName;
      index += 1;
      continue;
    }

    if (current) {
      collapsed.push({ ...current });
    }
  }

  return collapsed;
};

/**
 * Summarize why a visit was considered departed.
 */
const describeDepartureReason = (
  row: ConvexHistoricVesselLocation,
  currentTerminalSample: TerminalDistanceSample | undefined,
  departureThresholdMiles: number
) => {
  if (
    currentTerminalSample &&
    currentTerminalSample.distanceMiles > departureThresholdMiles
  ) {
    return `distance>${departureThresholdMiles.toFixed(2)}mi`;
  }

  if (!row.AtDock) {
    return "at_dock_false";
  }

  return "sample_missing";
};

/**
 * Format one epoch timestamp in Pacific time.
 */
const formatPacificTime = (timestampMs: number | undefined) =>
  timestampMs === undefined
    ? "open"
    : new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(new Date(timestampMs));

/**
 * Print a simple chronology report.
 */
const printReport = (
  args: CliArgs,
  rows: ConvexHistoricVesselLocation[],
  visits: TerminalVisit[]
) => {
  console.log(
    `Terminal chronology for ${args.vesselAbbrev} on sailing day ${args.sailingDay}`
  );
  console.log(
    `Rows: ${rows.length} | Arrival threshold: ${args.arrivalThresholdMiles.toFixed(2)} mi | Departure threshold: ${args.departureThresholdMiles.toFixed(2)} mi`
  );

  if (rows.length === 0) {
    console.log("No historic rows found.");
    return;
  }

  const firstRow = rows[0];
  const lastRow = rows.at(-1);

  console.log(
    `Observed range: ${formatPacificTime(firstRow?.TimeStamp)} -> ${formatPacificTime(lastRow?.TimeStamp)}`
  );
  console.log("");

  if (visits.length === 0) {
    console.log("No terminal visits were inferred from the supplied thresholds.");
    return;
  }

  console.log("Visits:");
  for (const [index, visit] of visits.entries()) {
    const label = `${visit.terminalAbbrev}${visit.terminalName ? ` (${visit.terminalName})` : ""}`;
    const durationMinutes =
      visit.departedAt === undefined
        ? undefined
        : Math.round((visit.departedAt - visit.arrivedAt) / 60000);

    console.log(
      `${String(index + 1).padStart(2, "0")}. ${label} | arrive ${formatPacificTime(visit.arrivedAt)} | depart ${formatPacificTime(visit.departedAt)} | minDist ${visit.minObservedDistanceMiles.toFixed(2)} mi | samples ${visit.samplesWhileDocked}${durationMinutes !== undefined ? ` | dwell ${durationMinutes} min` : ""}${visit.departureReason ? ` | ${visit.departureReason}` : ""}`
    );
  }

  console.log("");
  console.log("Legs:");
  for (let index = 0; index < visits.length - 1; index += 1) {
    const currentVisit = visits[index];
    const nextVisit = visits[index + 1];
    if (!currentVisit || !nextVisit) {
      continue;
    }

    console.log(
      `${String(index + 1).padStart(2, "0")}. ${currentVisit.terminalAbbrev} -> ${nextVisit.terminalAbbrev} | depart ${formatPacificTime(currentVisit.departedAt)} | arrive ${formatPacificTime(nextVisit.arrivedAt)}`
    );
  }
};

/**
 * Script entrypoint.
 */
const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const rows = await fetchHistoricRows(args);
  const visits = reconstructTerminalVisits(
    rows,
    args.arrivalThresholdMiles,
    args.departureThresholdMiles
  );

  printReport(args, rows, visits);
};

await main().catch((error) => {
  console.error("Failed to reconstruct vessel terminal chronology:", error);
  process.exit(1);
});
