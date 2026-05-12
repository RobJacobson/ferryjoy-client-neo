/**
 * Manual CLI trigger for reloading scheduled and actual dock-boundary event
 * rows via Convex public actions (`reloadDockEvents*`).
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const reloadDockEvents = async (targetDate?: string) => {
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
      ? `Reloading dock boundary events for sailing day ${targetDate}...`
      : "Reloading dock boundary events for the current sailing day..."
  );
  console.log(`Using Convex deployment: ${convexUrl}`);
  console.log("Ensure Convex dev is running: bun run convex:dev");

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const result = targetDate
      ? await convex.action(
          api.functions.events.sync.actions.reloadDockEventsForSailingDay,
          { targetDate }
        )
      : await convex.action(
          api.functions.events.sync.actions
            .reloadDockEventsForCurrentSailingDay,
          {}
        );

    console.log("Reload result:", result);
    console.log("Dock event reload completed successfully.");
  } catch (error) {
    console.error("Dock event reload failed:", error);
    process.exit(1);
  }
};

const main = () => {
  const args = process.argv.slice(2);

  if (args.length > 1) {
    console.error("Usage: bunx tsx scripts/sync-dock-events.ts [date]");
    console.error("");
    console.error(
      "Arguments: date — optional sailing day YYYY-MM-DD (defaults to current sailing day)"
    );
    process.exit(1);
  }

  void reloadDockEvents(args[0]);
};

if (require.main === module) {
  main();
}
