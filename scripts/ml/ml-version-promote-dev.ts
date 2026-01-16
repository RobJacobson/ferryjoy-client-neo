// ============================================================================
// ML VERSION MANAGEMENT - Promote dev-temp to dev-x
// Promotes all dev-temp models to a named dev version and deletes dev-temp
// ============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/**
 * Promote dev-temp models to a named dev version.
 *
 * @param versionNumber - The dev version number (must be positive integer)
 */
async function promoteDevTempToDev(versionNumber: number) {
  if (versionNumber <= 0 || !Number.isInteger(versionNumber)) {
    console.error("Error: Version number must be a positive integer");
    process.exit(1);
  }

  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log("Promoting dev-temp to dev-" + versionNumber + "...");
  console.log(`Using Convex deployment: ${convexUrl}`);

  const convex = new ConvexHttpClient(convexUrl);

  try {
    const result = await convex.mutation(
      api.functions.predictions.mutations.promoteDevTempToDev,
      { versionNumber }
    );

    console.log(
      `✅ Successfully promoted ${result.promoted} models to dev-${versionNumber}`
    );
  } catch (error) {
    console.error("Error promoting dev-temp:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: npm run ml:promote-dev -- <version>");
  console.error("Example: npm run ml:promote-dev -- 1");
  process.exit(1);
}

const versionNumber = parseInt(args[0], 10);
if (isNaN(versionNumber)) {
  console.error("Error: Version must be a number");
  process.exit(1);
}

if (require.main === module) {
  promoteDevTempToDev(versionNumber).catch(console.error);
}
