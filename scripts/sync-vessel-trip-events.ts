import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function syncVesselTripEvents(targetDate?: string) {
  if (targetDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDate)) {
      console.error("Invalid date format. Please use YYYY-MM-DD format.");
      process.exit(1);
    }
  }

  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log(
    targetDate
      ? `Replacing vesselTripEvents for ${targetDate}...`
      : "Replacing vesselTripEvents for the current sailing day..."
  );
  console.log(`Using Convex deployment: ${convexUrl}`);
  console.log(
    "Make sure your Convex dev server is running with: npm run convex:dev"
  );

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const result = targetDate
      ? await convex.action(
          api.functions.vesselTripEvents.actions
            .syncVesselTripEventsForDateManual,
          { targetDate }
        )
      : await convex.action(
          api.functions.vesselTripEvents.actions.syncVesselTripEventsManual
        );

    console.log("Replace results:", result);
    console.log("vesselTripEvents replace completed successfully.");
  } catch (error) {
    console.error("vesselTripEvents replace failed:", error);
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length > 1) {
    console.error("Usage: npm run sync:vessel-trip-events [date]");
    console.error("");
    console.error("Arguments:");
    console.error(
      "  date    - Optional target date in YYYY-MM-DD format (defaults to current sailing day)"
    );
    process.exit(1);
  }

  syncVesselTripEvents(args[0]);
}

if (require.main === module) {
  main();
}
