import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

/**
 * Script to manually trigger scheduled trips synchronization
 * Fetches and stores scheduled ferry trips from the WSF API
 */
async function syncScheduledTrips() {
  // Use the production Convex URL or fallback to environment variables
  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log("🚢 Starting scheduled trips sync...");
  console.log(`Using Convex deployment: ${convexUrl}`);
  console.log(
    "Make sure your Convex dev server is running with: npm run convex:dev"
  );

  try {
    // Initialize Convex client
    const convex = new ConvexHttpClient(convexUrl);

    // Trigger the scheduled trips sync
    console.log("📡 Calling scheduledTrips sync action...");
    await convex.action(
      api.functions.scheduledTrips.actions.syncScheduledTripsManual
    );

    console.log("✅ Scheduled trips sync completed successfully!");
  } catch (error) {
    console.error("❌ Scheduled trips sync failed:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  syncScheduledTrips().catch((error) => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });
}
