// ============================================================================
// TEST SCRIPT: Check Vessel Availability in WSF API (Parameterized Days)
// Fetches and counts scheduled trips by vessel for specified number of sailing days
// ============================================================================

import {
  fetchActiveRoutes,
  fetchRouteSchedule,
  type VesselSailing,
} from "../convex/adapters/wsf/scheduledTrips";
import { getSailingDay } from "../convex/shared/time";

/**
 * Helper function to add days to a date string.
 * @param dateString - Date string in YYYY-MM-DD format
 * @param days - Number of days to add (can be negative)
 * @returns New date string in YYYY-MM-DD format
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
async function checkVesselAvailabilityForDay(tripDate: string): Promise<{
  date: string;
  vessels: Map<string, number>;
  totalTrips: number;
  routesProcessed: number;
}> {
  try {
    const routes = await fetchActiveRoutes(tripDate);

    if (routes.length === 0) {
      return {
        date: tripDate,
        vessels: new Map(),
        totalTrips: 0,
        routesProcessed: 0,
      };
    }

    const vesselTripCounts = new Map<string, number>();
    let totalTrips = 0;

    for (const route of routes) {
      const schedule = await fetchRouteSchedule(route.RouteID, tripDate);

      for (const terminalCombo of schedule.TerminalCombos) {
        const times = terminalCombo.Times as VesselSailing[];
        totalTrips += times.length;

        for (const sailing of times) {
          const vesselName = sailing.VesselName;
          const count = vesselTripCounts.get(vesselName) || 0;
          vesselTripCounts.set(vesselName, count + 1);
        }
      }
    }

    return {
      date: tripDate,
      vessels: vesselTripCounts,
      totalTrips,
      routesProcessed: routes.length,
    };
  } catch (error) {
    console.error(`Error processing ${tripDate}:`, error);
    return {
      date: tripDate,
      vessels: new Map(),
      totalTrips: 0,
      routesProcessed: 0,
    };
  }
}

/**
 * Main function to check vessel availability for specified number of days
 */
async function checkVesselAvailability(daysToCheck: number) {
  console.log("=".repeat(80));
  console.log(`VESSEL AVAILABILITY CHECK - WSF API (${daysToCheck} DAYS)`);
  console.log("=".repeat(80));

  // Get today's sailing day date
  const today = getSailingDay(new Date());
  console.log(`\n📅 Starting Date: ${today}`);
  console.log(`📅 Current Date (UTC): ${new Date().toISOString()}`);

  const results: Array<{
    date: string;
    vessels: Map<string, number>;
    totalTrips: number;
    routesProcessed: number;
  }> = [];

  // Track vessel presence across all days
  const vesselPresence = new Map<string, number[]>(); // vessel -> array of days (indices)

  console.log(`\n🔄 Checking ${daysToCheck} days...`);
  console.log("This may take a while as we're fetching data for each day...\n");

  for (let i = 0; i < daysToCheck; i++) {
    const currentDate = addDays(today, i);
    const result = await checkVesselAvailabilityForDay(currentDate);
    results.push(result);

    // Track which vessels appear on this day
    result.vessels.forEach((_count, vesselName) => {
      const days = vesselPresence.get(vesselName) || [];
      days.push(i);
      vesselPresence.set(vesselName, days);
    });

    // Progress indicator
    if ((i + 1) % 5 === 0 || i === daysToCheck - 1) {
      const progress = Math.min(i + 1, daysToCheck);
      console.log(`  ✓ Processed ${progress}/${daysToCheck} days...`);
    }
  }

  console.log(`\n✓ Completed processing ${daysToCheck} days`);

  // Display summary by day
  console.log(`\n=${repeatChar("=", 78)}`);
  console.log("SUMMARY BY DAY");
  console.log(`=${repeatChar("=", 78)}`);

  results.forEach((result) => {
    const salishCount = result.vessels.get("Salish") || 0;
    const salishMarker =
      salishCount > 0 ? `🔍 SAL: ${salishCount}` : "   (no SAL)";

    console.log(
      `\n${result.date}: ${result.routesProcessed} routes, ${result.totalTrips} trips, ${result.vessels.size} vessels ${salishMarker}`
    );
  });

  // Display vessel presence summary
  console.log(`\n=${repeatChar("=", 78)}`);
  console.log(`VESSEL PRESENCE ACROSS ${daysToCheck} DAYS`);
  console.log(`=${repeatChar("=", 78)}`);

  const sortedVessels = Array.from(vesselPresence.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  console.log(`\n📊 Total unique vessels found: ${sortedVessels.length}`);
  console.log("");
  console.log(
    `Vessels found on which days (0 = today, ${daysToCheck - 1} = ${daysToCheck} days from now):`
  );
  console.log("-".repeat(80));

  sortedVessels.forEach(([vesselName, days]) => {
    const isSalish = vesselName.toLowerCase().includes("salish");
    const prefix = isSalish ? "🔍 " : "   ";
    const dayRanges = formatDayRanges(days);
    const daysCount = days.length;

    console.log(
      `${prefix}${vesselName.padEnd(20)} ${daysCount.toString().padStart(2)}/${daysToCheck} days: ${dayRanges}`
    );
  });

  console.log("-".repeat(80));

  // Check for SAL specifically
  const salishPresence = vesselPresence.get("Salish");

  if (salishPresence && salishPresence.length > 0) {
    console.log("\n✅ Salish (SAL) FOUND on the following days:");
    salishPresence.forEach((dayIndex) => {
      const result = results[dayIndex];
      const count = result.vessels.get("Salish") || 0;
      console.log(`  - Day ${dayIndex} (${result.date}): ${count} trips`);
    });
  } else {
    console.log(
      `\n❌ Salish (SAL) NOT FOUND on any of the ${daysToCheck} days!`
    );
  }

  // Find vessels that are NOT present every day
  console.log(`\n=${repeatChar("=", 78)}`);
  console.log(
    `VESSELS WITH LIMITED AVAILABILITY (not on all ${daysToCheck} days)`
  );
  console.log(`=${repeatChar("=", 78)}`);

  sortedVessels
    .filter(([_, days]) => days.length < daysToCheck)
    .sort((a, b) => a[1].length - b[1].length)
    .forEach(([vesselName, days]) => {
      const dayRanges = formatDayRanges(days);
      console.log(
        `  ${vesselName.padEnd(20)} ${days.length.toString().padStart(2)}/${daysToCheck} days: ${dayRanges}`
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

// Command line interface
function main() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error(
      "Usage: bun run check:vessel-availability:days <number_of_days>"
    );
    console.error("");
    console.error("Arguments:");
    console.error(
      "  number_of_days - Number of days to check (e.g., 7, 14, 30, 60)"
    );
    console.error("");
    console.error("Examples:");
    console.error("  bun run check:vessel-availability:days 7");
    console.error("  bun run check:vessel-availability:days 14");
    console.error("  bun run check:vessel-availability:days 30");
    console.error("  bun run check:vessel-availability:days 60");
    process.exit(1);
  }

  const daysToCheck = parseInt(args[0], 10);

  if (Number.isNaN(daysToCheck) || daysToCheck <= 0) {
    console.error(
      "❌ Invalid number of days. Please provide a positive integer."
    );
    process.exit(1);
  }

  if (daysToCheck > 365) {
    console.error(
      "⚠️  Warning: Checking more than 365 days may take a very long time."
    );
  }

  checkVesselAvailability(daysToCheck);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { checkVesselAvailability };
