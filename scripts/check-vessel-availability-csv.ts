// ============================================================================
// TEST SCRIPT: Check Vessel Availability in WSF API for 30 Days (CSV Output)
// Fetches and creates CSV with trip counts by vessel for each day
// ============================================================================

import { writeFileSync } from "node:fs";
import { fetchActiveRoutes } from "../convex/adapters/wsf/scheduledTrips/fetchActiveRoutes";
import { fetchRouteSchedule } from "../convex/adapters/wsf/scheduledTrips/fetchRouteSchedule";
import type { VesselSailing } from "../convex/adapters/wsf/scheduledTrips/types";
import { getSailingDay } from "../convex/shared/time";

/**
 * Helper function to add days to a date string.
 */
const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};

/**
 * Check vessel availability for a single day
 */
async function checkVesselAvailabilityForDay(
  tripDate: string
): Promise<Map<string, number>> {
  try {
    const routes = await fetchActiveRoutes(tripDate);

    if (routes.length === 0) {
      return new Map();
    }

    const vesselTripCounts = new Map<string, number>();

    for (const route of routes) {
      const schedule = await fetchRouteSchedule(route.RouteID, tripDate);

      for (const terminalCombo of schedule.TerminalCombos) {
        const times = terminalCombo.Times as VesselSailing[];

        for (const sailing of times) {
          const vesselName = sailing.VesselName;
          const count = vesselTripCounts.get(vesselName) || 0;
          vesselTripCounts.set(vesselName, count + 1);
        }
      }
    }

    return vesselTripCounts;
  } catch (error) {
    console.error(`Error processing ${tripDate}:`, error);
    return new Map();
  }
}

/**
 * Main function to check vessel availability for 30 days and generate CSV
 */
async function checkVesselAvailability30DaysCSV() {
  console.log("=".repeat(80));
  console.log("VESSEL AVAILABILITY CHECK - WSF API (30 DAYS) - CSV OUTPUT");
  console.log("=".repeat(80));

  // Get today's sailing day date
  const today = getSailingDay(new Date());
  console.log(`\n📅 Starting Date: ${today}`);
  console.log(`📅 Current Date (UTC): ${new Date().toISOString()}`);

  const daysToCheck = 30;
  const results: Array<{
    date: string;
    vessels: Map<string, number>;
  }> = [];

  // Track all unique vessels
  const allVessels = new Set<string>();

  console.log(`\n🔄 Checking ${daysToCheck} days...`);
  console.log("This may take a while as we're fetching data for each day...\n");

  for (let i = 0; i < daysToCheck; i++) {
    const currentDate = addDays(today, i);
    const vesselCounts = await checkVesselAvailabilityForDay(currentDate);
    results.push({ date: currentDate, vessels: vesselCounts });

    // Track all vessels
    vesselCounts.forEach((_, vesselName) => {
      allVessels.add(vesselName);
    });

    // Progress indicator
    if ((i + 1) % 5 === 0) {
      console.log(`  ✓ Processed ${i + 1}/${daysToCheck} days...`);
    }
  }

  console.log(`\n✓ Completed processing ${daysToCheck} days`);

  // Sort vessels alphabetically
  const sortedVessels = Array.from(allVessels).sort();

  // Generate CSV content
  const csvRows: string[] = [];

  // Header row
  const header = ["VesselName", ...results.map((r) => r.date)];
  csvRows.push(header.join(","));

  // Data rows
  sortedVessels.forEach((vesselName) => {
    const row = [vesselName];

    results.forEach((result) => {
      const count = result.vessels.get(vesselName) || 0;
      row.push(count.toString());
    });

    csvRows.push(row.join(","));
  });

  // Add totals row
  const totalsRow = ["TOTAL"];
  results.forEach((result) => {
    const total = Array.from(result.vessels.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    totalsRow.push(total.toString());
  });
  csvRows.push(totalsRow.join(","));

  // Write CSV to file
  const csvContent = csvRows.join("\n");
  const csvPath = "vessel-trip-counts-30days.csv";
  writeFileSync(csvPath, csvContent);

  console.log(`\n✅ CSV file created: ${csvPath}`);
  console.log(
    `   Contains ${sortedVessels.length} vessels across ${daysToCheck} days`
  );
  console.log(`   Total data points: ${sortedVessels.length * daysToCheck}`);

  // Print summary to console
  console.log(`\n=${repeatChar("=", 78)}`);
  console.log("VESSEL PRESENCE SUMMARY");
  console.log(`=${repeatChar("=", 78)}`);

  const vesselPresence = new Map<string, number[]>();
  results.forEach((result, dayIndex) => {
    result.vessels.forEach((_, vesselName) => {
      const days = vesselPresence.get(vesselName) || [];
      days.push(dayIndex);
      vesselPresence.set(vesselName, days);
    });
  });

  sortedVessels.forEach((vesselName) => {
    const days = vesselPresence.get(vesselName) || [];
    const dayRanges = formatDayRanges(days);
    console.log(
      `  ${vesselName.padEnd(20)} ${days.length.toString().padStart(2)}/30 days: ${dayRanges}`
    );
  });

  console.log(`\n${"=".repeat(80)}`);
  console.log("CHECK COMPLETE");
  console.log("=".repeat(80));
}

/**
 * Format an array of day indices into ranges for compact display
 */
function formatDayRanges(days: number[]): string {
  if (days.length === 0) return "";

  days.sort((a, b) => a - b);

  const ranges: string[] = [];
  let start = days[0];
  let end = days[0];

  for (let i = 1; i < days.length; i++) {
    if (days[i] === end + 1) {
      end = days[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = days[i];
      end = days[i];
    }
  }

  ranges.push(start === end ? `${start}` : `${start}-${end}`);

  return ranges.join(", ");
}

/**
 * Helper function to repeat a character
 */
function repeatChar(char: string, count: number): string {
  return char.repeat(count);
}

// Run the script
checkVesselAvailability30DaysCSV();
