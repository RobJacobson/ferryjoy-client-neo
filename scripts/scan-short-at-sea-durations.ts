#!/usr/bin/env tsx

/**
 * Scan all training data for at-sea durations less than 2 minutes
 * These are likely data quality issues where the vessel didn't actually leave
 * or timestamps are incorrect
 */

import fs from "node:fs";
import path from "node:path";

interface TrainingDataRecord {
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  prevDelay: number;
  tripStart: string;
  leftDock: string;
  tripEnd: string;
  schedDeparture: string;
  departureDelay: number;
  atSeaDuration: number;
}

interface TerminalPairBucket {
  terminalPair: {
    departingTerminalAbbrev: string;
    arrivingTerminalAbbrev: string;
  };
  records: TrainingDataRecord[];
}

interface ShortDurationRecord {
  terminalPair: string;
  record: TrainingDataRecord;
  atSeaDuration: number;
}

/**
 * Format a date string for display
 */
const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toISOString().replace("T", " ").substring(0, 19);
};

/**
 * Calculate time difference in minutes
 */
const getMinutesDelta = (start: string, end: string): number => {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return (endTime - startTime) / (1000 * 60);
};

/**
 * Main function
 */
const main = (): void => {
  const args = process.argv.slice(2);
  const threshold = args[0] ? parseFloat(args[0]) : 2.0;

  console.log(`🔍 Scanning for At-Sea Durations < ${threshold} minutes`);
  console.log(`${"=".repeat(80)}\n`);

  const trainingDataPath = path.join(__dirname, "..", "ml", "training-data.json");

  if (!fs.existsSync(trainingDataPath)) {
    console.error(`❌ Training data file not found: ${trainingDataPath}`);
    process.exit(1);
  }

  console.log(`📂 Loading training data from: ${trainingDataPath}`);
  const rawData = fs.readFileSync(trainingDataPath, "utf-8");
  const buckets: TerminalPairBucket[] = JSON.parse(rawData);

  console.log(`📊 Scanning ${buckets.length} terminal pairs...\n`);

  // Collect all short duration records
  const shortDurationRecords: ShortDurationRecord[] = [];
  const terminalPairStats = new Map<
    string,
    {
      total: number;
      short: number;
      shortest: number;
      records: ShortDurationRecord[];
    }
  >();

  for (const bucket of buckets) {
    const terminalPair = `${bucket.terminalPair.departingTerminalAbbrev}->${bucket.terminalPair.arrivingTerminalAbbrev}`;
    const totalRecords = bucket.records.length;
    let shortCount = 0;
    let shortest = Infinity;
    const pairShortRecords: ShortDurationRecord[] = [];

    for (const record of bucket.records) {
      if (record.atSeaDuration < threshold) {
        shortCount++;
        shortest = Math.min(shortest, record.atSeaDuration);

        const shortRecord: ShortDurationRecord = {
          terminalPair,
          record,
          atSeaDuration: record.atSeaDuration,
        };

        shortDurationRecords.push(shortRecord);
        pairShortRecords.push(shortRecord);
      }
    }

    if (shortCount > 0) {
      terminalPairStats.set(terminalPair, {
        total: totalRecords,
        short: shortCount,
        shortest,
        records: pairShortRecords,
      });
    }
  }

  // Sort by terminal pair, then by duration
  shortDurationRecords.sort((a, b) => {
    if (a.terminalPair !== b.terminalPair) {
      return a.terminalPair.localeCompare(b.terminalPair);
    }
    return a.atSeaDuration - b.atSeaDuration;
  });

  // Summary by terminal pair
  console.log(`${"=".repeat(80)}`);
  console.log(`📈 Summary by Terminal Pair`);
  console.log(`${"=".repeat(80)}\n`);

  if (terminalPairStats.size === 0) {
    console.log(
      `✅ No records found with at-sea duration < ${threshold} minutes`
    );
  } else {
    const sortedPairs = Array.from(terminalPairStats.entries()).sort(
      (a, b) => b[1].short - a[1].short
    );

    console.log(
      `Found ${shortDurationRecords.length} total records with at-sea duration < ${threshold} minutes\n`
    );
    console.log(
      `Terminal Pair                    | Total | Short | %    | Shortest (min)`
    );
    console.log(`${"-".repeat(80)}`);

    for (const [pair, stats] of sortedPairs) {
      const percentage = ((stats.short / stats.total) * 100).toFixed(1);
      console.log(
        `${pair.padEnd(32)} | ${stats.total.toString().padStart(5)} | ${stats.short.toString().padStart(5)} | ${percentage.padStart(4)}% | ${stats.shortest.toFixed(2)}`
      );
    }
  }

  // Detailed records
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📋 Detailed Records (showing first 50)`);
  console.log(`${"=".repeat(80)}\n`);

  if (shortDurationRecords.length === 0) {
    console.log(`✅ No records to display`);
  } else {
    for (let i = 0; i < Math.min(50, shortDurationRecords.length); i++) {
      const { terminalPair, record, atSeaDuration } = shortDurationRecords[i];

      // Calculate actual time differences for validation
      const actualAtSea = getMinutesDelta(record.leftDock, record.tripEnd);
      const actualDepartureDelay = getMinutesDelta(
        record.schedDeparture,
        record.leftDock
      );

      console.log(
        `\n${i + 1}. ${terminalPair} - At Sea: ${atSeaDuration.toFixed(2)} min`
      );
      console.log(`   Trip Start:    ${formatDate(record.tripStart)}`);
      console.log(`   Scheduled Dep: ${formatDate(record.schedDeparture)}`);
      console.log(`   Left Dock:     ${formatDate(record.leftDock)}`);
      console.log(`   Trip End:      ${formatDate(record.tripEnd)}`);
      console.log(
        `   At Sea Duration: ${atSeaDuration.toFixed(2)} min (calculated: ${actualAtSea.toFixed(2)} min)`
      );
      console.log(
        `   Departure Delay: ${record.departureDelay.toFixed(2)} min (calculated: ${actualDepartureDelay.toFixed(2)} min)`
      );
      console.log(`   Previous Delay:  ${record.prevDelay.toFixed(2)} min`);

      // Flag potential data issues
      if (Math.abs(atSeaDuration - actualAtSea) > 0.1) {
        console.log(
          `   ⚠️  WARNING: Calculated at-sea duration (${actualAtSea.toFixed(2)}) doesn't match stored value (${atSeaDuration.toFixed(2)})`
        );
      }

      if (actualAtSea < 0) {
        console.log(`   ⚠️  WARNING: Trip end is before left dock!`);
      }

      if (atSeaDuration < 0.5) {
        console.log(
          `   ⚠️  CRITICAL: At-sea duration is less than 30 seconds - likely data error`
        );
      }
    }

    if (shortDurationRecords.length > 50) {
      console.log(`\n... and ${shortDurationRecords.length - 50} more records`);
    }
  }

  // Export to CSV
  const csvPath = path.join(__dirname, "..", "short-at-sea-durations.csv");
  const csvLines = [
    "terminal_pair,at_sea_duration,departure_delay,prev_delay,trip_start,scheduled_departure,left_dock,trip_end",
    ...shortDurationRecords.map(({ terminalPair, record, atSeaDuration }) => {
      return [
        terminalPair,
        atSeaDuration.toFixed(2),
        record.departureDelay.toFixed(2),
        record.prevDelay.toFixed(2),
        record.tripStart,
        record.schedDeparture,
        record.leftDock,
        record.tripEnd,
      ].join(",");
    }),
  ];

  fs.writeFileSync(csvPath, csvLines.join("\n"));
  console.log(`\n${"=".repeat(80)}`);
  console.log(`✅ Analysis complete`);
  console.log(
    `📄 Exported ${shortDurationRecords.length} records to: ${csvPath}`
  );
  console.log(`${"=".repeat(80)}\n`);
};

if (require.main === module) {
  main();
}
