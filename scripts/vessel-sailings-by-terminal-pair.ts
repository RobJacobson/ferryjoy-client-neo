#!/usr/bin/env tsx

/**
 * Vessel Sailings by Terminal Pair Report
 *
 * Fetches WSF vessel histories via `ws-dottie`, applies ML-style validation and
 * terminal normalization, then produces a markdown grid:
 * - One row per directed terminal pair (e.g. `P52->BBI`)
 * - One column per vessel abbreviation (full fleet, even if zero)
 * - Cells contain sailing counts for the given date range
 *
 * Usage:
 *   bunx tsx scripts/vessel-sailings-by-terminal-pair.ts 2026-01-01 2026-01-31 [--out ml/report.md]
 */

import * as fs from "node:fs";
import type { WriteStream } from "node:fs";
import { writeFileSync } from "node:fs";
import * as path from "node:path";

import {
  fetchVesselBasics,
  fetchVesselHistoriesByVesselAndDates,
} from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

import type {
  WsfNormalizationReject,
  WsfNormalizationRejectReason,
} from "../convex/domain/ml/shared/normalizeWsfVesselHistories";
import { normalizeWsfVesselHistories } from "../convex/domain/ml/shared/normalizeWsfVesselHistories";
import { getVesselAbbreviation } from "../src/domain/vesselAbbreviations";

// ============================================================================
// Types
// ============================================================================

type VesselAbbrev = string;
type TerminalPairKey = string;

type CliArgs = {
  dateStart: string;
  dateEnd: string;
  outPath: string;
  rejectsPath?: string;
};

type CountGrid = Map<TerminalPairKey, Map<VesselAbbrev, number>>;

type FetchStats = {
  vesselsProcessed: number;
  fetchedRecords: number;
  validRecords: number;
  skippedInvalidRecords: number;
  unknownVesselRecords: number;
};

type RejectLogEntry = {
  reason: WsfNormalizationRejectReason | "unknown_vessel";
  vesselName: string;
  details: Record<string, unknown>;
  record: unknown;
};

// ============================================================================
// CLI
// ============================================================================

/**
 * Parse CLI args for date range and output path.
 *
 * @param argv - CLI args (excluding `node` and script path)
 * @returns Parsed args with validated date strings
 */
const parseArgs = (argv: string[]): CliArgs => {
  const dateArgs = argv.filter((a) => !a.startsWith("--"));
  const outIdx = argv.indexOf("--out");
  const rejectsIdx = argv.indexOf("--rejects");

  if (dateArgs.length < 2) {
    console.error(
      "Usage: bunx tsx scripts/vessel-sailings-by-terminal-pair.ts <DateStart YYYY-MM-DD> <DateEnd YYYY-MM-DD> [--out <path>] [--rejects <path>]"
    );
    process.exit(1);
  }

  const dateStart = dateArgs[0] ?? "";
  const dateEnd = dateArgs[1] ?? "";

  if (!isValidDateString(dateStart) || !isValidDateString(dateEnd)) {
    console.error("Dates must be in YYYY-MM-DD format.", {
      dateStart,
      dateEnd,
    });
    process.exit(1);
  }

  const outArg = outIdx >= 0 ? argv[outIdx + 1] : undefined;
  const outPath =
    outArg && outArg.trim().length > 0
      ? outArg
      : path.join(
        process.cwd(),
        "ml",
        `vessel-sailings-${dateStart}_to_${dateEnd}.md`
      );

  const rejectsArg = rejectsIdx >= 0 ? argv[rejectsIdx + 1] : undefined;
  const rejectsPath =
    rejectsIdx >= 0
      ? rejectsArg && !rejectsArg.startsWith("--") && rejectsArg.trim().length > 0
        ? rejectsArg
        : path.join(
          process.cwd(),
          "ml",
          `vessel-sailings-rejects-${dateStart}_to_${dateEnd}.ndjson`
        )
      : undefined;

  return { dateStart, dateEnd, outPath, rejectsPath };
};

/**
 * Validate `YYYY-MM-DD` date strings.
 *
 * @param value - Candidate date string
 * @returns True if string matches the required date format
 */
const isValidDateString = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);

// ============================================================================
// Data normalization
// ============================================================================

/**
 * Normalize vessel abbreviations for reporting columns.
 *
 * WSF history records often provide abbreviations (e.g. `KIS`). If a full name
 * is present instead, map to abbreviation using `src/domain/vesselAbbreviations`.
 *
 * @param vesselRaw - Raw vessel identifier from history record
 * @returns Abbreviation suitable for grid columns (or empty string)
 */
const normalizeVesselAbbrev = (vesselRaw: string): string => {
  const trimmed = vesselRaw.trim();
  if (!trimmed) {
    return "";
  }

  // Likely already an abbrev.
  if (/^[A-Z]{2,4}$/.test(trimmed)) {
    return trimmed;
  }

  return getVesselAbbreviation(trimmed);
};

/**
 * Derive full-fleet vessel abbreviations from vessel basics list.
 *
 * @param vessels - Fleet returned from `fetchVesselBasics()`
 * @returns Sorted unique abbreviations
 */
const getFleetVesselAbbrevs = (
  vessels: Awaited<ReturnType<typeof fetchVesselBasics>>
): string[] => {
  const abbrevs = new Set<string>();
  for (const v of vessels) {
    const vesselName = v.VesselName ?? "";
    const abbrev = getVesselAbbreviation(vesselName);
    if (abbrev) {
      abbrevs.add(abbrev);
    }
  }

  return Array.from(abbrevs).sort((a, b) => a.localeCompare(b));
};

/**
 * Build report vessel columns with stable ordering.
 *
 * @param input - Fleet and discovered abbreviations
 * @returns Fleet abbreviations plus any discovered extras
 */
const buildVesselColumns = (input: {
  fleetAbbrevs: string[];
  discoveredAbbrevs: string[];
}): string[] => {
  const fleetSet = new Set(input.fleetAbbrevs);
  const extras = input.discoveredAbbrevs
    .filter((a) => a && !fleetSet.has(a))
    .sort((a, b) => a.localeCompare(b));

  return [...input.fleetAbbrevs, ...extras];
};

// ============================================================================
// Markdown generation
// ============================================================================

type ReportInput = {
  dateStart: string;
  dateEnd: string;
  grid: CountGrid;
  vesselColumns: string[];
  stats: FetchStats;
};

/**
 * Build the markdown grid report.
 *
 * @param input - Report input data
 * @returns Markdown report contents
 */
const buildMarkdownReport = (input: ReportInput): string => {
  const rowKeys = Array.from(input.grid.keys()).sort((a, b) =>
    a.localeCompare(b)
  );

  const pairTotals = new Map<string, number>();
  const vesselTotals = new Map<string, number>();
  let grandTotal = 0;

  for (const pairKey of rowKeys) {
    const pairMap = input.grid.get(pairKey) ?? new Map<string, number>();
    let rowTotal = 0;
    for (const vesselAbbrev of input.vesselColumns) {
      const count = pairMap.get(vesselAbbrev) ?? 0;
      rowTotal += count;
      if (count > 0) {
        vesselTotals.set(
          vesselAbbrev,
          (vesselTotals.get(vesselAbbrev) ?? 0) + count
        );
      }
    }
    pairTotals.set(pairKey, rowTotal);
    grandTotal += rowTotal;
  }

  const headerLines = [
    "# Vessel Sailings by Terminal Pair",
    "",
    `Date range: **${input.dateStart}** to **${input.dateEnd}**`,
    "",
    "## Overview",
    "",
    `- **Fleet vessels processed**: ${input.stats.vesselsProcessed}`,
    `- **Fetched history records**: ${input.stats.fetchedRecords}`,
    `- **Valid sailings counted**: ${input.stats.validRecords}`,
    `- **Skipped invalid records**: ${input.stats.skippedInvalidRecords}`,
    `- **Skipped unknown-vessel records**: ${input.stats.unknownVesselRecords}`,
    `- **Total sailings (counted)**: ${grandTotal}`,
    "",
    "## Sailings Grid",
    "",
  ];

  const cols = computeColumnWidths({
    pairKeys: [...rowKeys, "**TOTAL**"],
    vesselColumns: input.vesselColumns,
    pairTotals,
    vesselTotals,
    grandTotal,
    grid: input.grid,
  });

  const pad = (value: string, width: number, align: "left" | "right") =>
    align === "right" ? value.padStart(width) : value.padEnd(width);
  const dashed = (width: number) => "-".repeat(width);

  const colHeaders = ["Pair", "Total", ...input.vesselColumns];

  const mdLines: string[] = [...headerLines];

  mdLines.push(
    `| ${[
      pad(colHeaders[0] ?? "", cols.pair, "left"),
      pad(colHeaders[1] ?? "", cols.total, "right"),
      ...input.vesselColumns.map((v) => pad(v, cols.vessel, "right")),
    ].join(" | ")} |`
  );

  mdLines.push(
    `| ${[
      dashed(cols.pair),
      dashed(cols.total),
      ...input.vesselColumns.map(() => dashed(cols.vessel)),
    ].join(" | ")} |`
  );

  for (const pairKey of rowKeys) {
    const pairMap = input.grid.get(pairKey) ?? new Map<string, number>();
    const row = [
      pad(pairKey, cols.pair, "left"),
      pad(String(pairTotals.get(pairKey) ?? 0), cols.total, "right"),
      ...input.vesselColumns.map((v) =>
        pad(String(pairMap.get(v) ?? 0), cols.vessel, "right")
      ),
    ];
    mdLines.push(`| ${row.join(" | ")} |`);
  }

  const totalRow = [
    pad("**TOTAL**", cols.pair, "left"),
    pad(String(grandTotal), cols.total, "right"),
    ...input.vesselColumns.map((v) =>
      pad(String(vesselTotals.get(v) ?? 0), cols.vessel, "right")
    ),
  ];
  mdLines.push(`| ${totalRow.join(" | ")} |`);

  mdLines.push("", "---", `*Generated on ${new Date().toISOString()}*`, "");

  return mdLines.join("\n");
};

type ColumnWidths = {
  pair: number;
  total: number;
  vessel: number;
};

/**
 * Compute stable widths for padded markdown columns.
 *
 * @param input - Column width inputs
 * @returns Computed widths
 */
const computeColumnWidths = (input: {
  pairKeys: string[];
  vesselColumns: string[];
  pairTotals: Map<string, number>;
  vesselTotals: Map<string, number>;
  grandTotal: number;
  grid: CountGrid;
}): ColumnWidths => {
  const pairWidth = Math.max(
    "Pair".length,
    ...input.pairKeys.map((k) => k.length)
  );

  const totalWidth = Math.max(
    "Total".length,
    String(input.grandTotal).length,
    ...Array.from(input.pairTotals.values()).map((n) => String(n).length)
  );

  const vesselWidth = Math.max(
    ...["0", ...input.vesselColumns].map((v) => v.length),
    ...Array.from(input.vesselTotals.values()).map((n) => String(n).length),
    ...Array.from(input.grid.values()).flatMap((m) =>
      Array.from(m.values()).map((n) => String(n).length)
    )
  );

  return {
    pair: pairWidth,
    total: totalWidth,
    vessel: vesselWidth,
  };
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Sleep for a specified duration.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after `ms`
 */
const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ensure a directory exists.
 *
 * @param dirPath - Directory path to create if needed
 */
const ensureDirectoryExists = (dirPath: string): void => {
  if (fs.existsSync(dirPath)) {
    return;
  }
  fs.mkdirSync(dirPath, { recursive: true });
};

/**
 * Write a single rejected record as NDJSON.
 *
 * @param stream - Output stream for reject log
 * @param entry - Reject log entry
 */
const writeRejectLogLine = (stream: WriteStream, entry: RejectLogEntry): void => {
  stream.write(`${safeJsonStringify(entry)}\n`);
};

/**
 * Safely stringify values (handles bigint, Error).
 *
 * @param value - Value to stringify
 * @returns JSON string
 */
const safeJsonStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "bigint") {
        return String(v);
      }
      if (v instanceof Date) {
        return v.toISOString();
      }
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) {
          return "[Circular]";
        }
        seen.add(v);
      }
      if (v instanceof Error) {
        return { name: v.name, message: v.message, stack: v.stack };
      }
      return v;
    },
    0
  );
};

// ============================================================================
// Main (defined last to avoid hoisting issues)
// ============================================================================

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));

  console.log("Vessel sailings report", {
    dateStart: args.dateStart,
    dateEnd: args.dateEnd,
    outPath: args.outPath,
    rejectsPath: args.rejectsPath,
  });

  const vessels = await fetchVesselBasics();
  const fleetAbbrevs = getFleetVesselAbbrevs(vessels);

  console.log(
    `Found ${vessels.length} vessels in fleet (${fleetAbbrevs.length} abbreviations)`
  );

  const grid: CountGrid = new Map();
  const stats: FetchStats = {
    vesselsProcessed: 0,
    fetchedRecords: 0,
    validRecords: 0,
    skippedInvalidRecords: 0,
    unknownVesselRecords: 0,
  };

  const rejectCounts: Partial<
    Record<WsfNormalizationRejectReason | "unknown_vessel", number>
  > = {};
  const rejectsStream =
    args.rejectsPath != null
      ? (ensureDirectoryExists(path.dirname(args.rejectsPath)),
        fs.createWriteStream(args.rejectsPath, { flags: "w" }))
      : null;

  const discoveredVesselAbbrevs = new Set<string>();

  for (const vessel of vessels) {
    const vesselName = vessel.VesselName ?? "";
    console.log(`Fetching histories for ${vesselName}`);

    const historyRecords = await fetchVesselHistoriesByVesselAndDates({
      params: {
        VesselName: vesselName,
        DateStart: args.dateStart,
        DateEnd: args.dateEnd,
      },
    });

    stats.vesselsProcessed += 1;
    stats.fetchedRecords += historyRecords.length;

    const normalized = normalizeWsfVesselHistories(historyRecords, {
      vesselNameFallback: vesselName,
    });

    stats.validRecords += normalized.trips.length;
    stats.skippedInvalidRecords += normalized.rejects.length;

    if (normalized.rejects.length > 0) {
      for (const reject of normalized.rejects) {
        rejectCounts[reject.reason] = (rejectCounts[reject.reason] ?? 0) + 1;
        if (rejectsStream) {
          writeRejectLogLine(rejectsStream, toRejectLogEntry(vesselName, reject));
        }
      }
    }

    for (const trip of normalized.trips) {
      const vesselAbbrev = normalizeVesselAbbrev(trip.vesselRaw);
      if (!vesselAbbrev) {
        stats.unknownVesselRecords += 1;
        rejectCounts.unknown_vessel = (rejectCounts.unknown_vessel ?? 0) + 1;
        if (rejectsStream) {
          writeRejectLogLine(rejectsStream, {
            reason: "unknown_vessel",
            vesselName,
            details: { vesselRaw: trip.vesselRaw },
            record: {
              departingName: trip.departingName,
              arrivingName: trip.arrivingName,
              pairKey: trip.pairKey,
              scheduledDepartMs: trip.scheduledDepartMs,
            },
          });
        }
        continue;
      }

      discoveredVesselAbbrevs.add(vesselAbbrev);

      const pairMap =
        grid.get(trip.pairKey) ?? new Map<VesselAbbrev, number>();
      pairMap.set(vesselAbbrev, (pairMap.get(vesselAbbrev) ?? 0) + 1);
      grid.set(trip.pairKey, pairMap);
    }

    // Be polite to upstream.
    await sleep(100);
  }

  const vesselColumns = buildVesselColumns({
    fleetAbbrevs,
    discoveredAbbrevs: Array.from(discoveredVesselAbbrevs),
  });

  const report = buildMarkdownReport({
    dateStart: args.dateStart,
    dateEnd: args.dateEnd,
    grid,
    vesselColumns,
    stats,
  });

  ensureDirectoryExists(path.dirname(args.outPath));
  writeFileSync(args.outPath, report);

  console.log(`✅ Report written: ${args.outPath}`);
  if (args.rejectsPath) {
    console.log(`✅ Reject log written: ${args.rejectsPath}`);
  }
  console.log("Stats", stats);
  if (Object.keys(rejectCounts).length > 0) {
    console.log("Reject counts", rejectCounts);
  }

  rejectsStream?.end();
};

/**
 * Convert a normalizer reject into the report reject log entry shape.
 *
 * @param vesselName - Vessel name queried from WSF
 * @param reject - Normalizer reject
 * @returns Reject log entry
 */
const toRejectLogEntry = (
  vesselName: string,
  reject: WsfNormalizationReject
): RejectLogEntry => {
  return {
    reason: reject.reason,
    vesselName,
    details: reject.details,
    record: reject.record,
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error("Failed to generate vessel sailings report", error);
    process.exit(1);
  });
}

