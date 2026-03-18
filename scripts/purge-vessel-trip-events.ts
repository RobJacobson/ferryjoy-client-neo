import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function purgeVesselTripEvents() {
  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log("Purging vesselTripEvents...");
  console.log(`Using Convex deployment: ${convexUrl}`);
  console.log(
    "Make sure your Convex dev server is running with: npm run convex:dev"
  );

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const result = await convex.action(
      api.functions.vesselTripEvents.actions.purgeVesselTripEventsManual
    );

    console.log("Purge results:", result);
    console.log("vesselTripEvents purge completed successfully.");
  } catch (error) {
    console.error("vesselTripEvents purge failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  purgeVesselTripEvents().catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}
