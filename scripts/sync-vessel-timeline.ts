import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function syncVesselTimeline(targetDate?: string) {
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
      ? `Replacing VesselTimeline boundary events for ${targetDate}...`
      : "Replacing VesselTimeline boundary events for the current sailing day..."
  );
  console.log(`Using Convex deployment: ${convexUrl}`);
  console.log(
    "Make sure your Convex dev server is running with: npm run convex:dev"
  );

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const result = targetDate
      ? await convex.action(
          api.functions.vesselTimeline.index.syncVesselTimelineForDateManual,
          { targetDate }
        )
      : await convex.action(
          api.functions.vesselTimeline.index.syncVesselTimelineManual
        );

    console.log("Replace results:", result);
    console.log("VesselTimeline sync completed successfully.");
  } catch (error) {
    console.error("VesselTimeline sync failed:", error);
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length > 1) {
    console.error("Usage: npm run sync:vessel-timeline [date]");
    console.error("");
    console.error(
      "Arguments: date - Optional target date in YYYY-MM-DD format (defaults to current sailing day)"
    );
    process.exit(1);
  }

  syncVesselTimeline(args[0]);
}

if (require.main === module) {
  main();
}
