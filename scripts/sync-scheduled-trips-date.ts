import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

/**
 * Script to manually trigger scheduled trips synchronization for a specific date
 * Fetches and stores scheduled ferry trips from the WSF API for the given date
 */
async function syncScheduledTripsForDate(targetDate: string) {
  // Validate date format (basic YYYY-MM-DD check)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(targetDate)) {
    console.error("❌ Invalid date format. Please use YYYY-MM-DD format.");
    process.exit(1);
  }

  // Use the production Convex URL or fallback to environment variables
  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log(`🚢 Starting scheduled trips sync for date: ${targetDate}`);
  console.log(`Using Convex deployment: ${convexUrl}`);
  console.log(
    "Make sure your Convex dev server is running with: npm run convex:dev"
  );

  try {
    // Initialize Convex client
    const convex = new ConvexHttpClient(convexUrl);

    // Trigger the scheduled trips sync for specific date
    console.log("📡 Calling scheduledTrips sync action for specific date...");
    const result = await convex.action(
      api.functions.scheduledTrips.actions.syncScheduledTripsForDateManual,
      { targetDate }
    );
    console.log("📊 Sync results:", result);

    console.log(
      `✅ Scheduled trips sync completed successfully for ${targetDate}!`
    );
  } catch (error) {
    console.error(`❌ Scheduled trips sync failed for ${targetDate}:`, error);
    process.exit(1);
  }
}

// Command line interface
function main() {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error("Usage: npm run sync:scheduled-trips:date <date>");
    console.error("");
    console.error("Arguments:");
    console.error("  date    - Target date in YYYY-MM-DD format");
    console.error("");
    console.error("Examples:");
    console.error("  npm run sync:scheduled-trips:date 2026-01-15");
    console.error("  npm run sync:scheduled-trips:date 2026-12-25");
    process.exit(1);
  }

  const targetDate = args[0];
  syncScheduledTripsForDate(targetDate);
}

// Run if called directly
if (require.main === module) {
  main();
}
