// ============================================================================
// ML VERSION MANAGEMENT - Switch production version
// Updates the active production version for predictions
// ============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/**
 * Switch the active production version.
 *
 * @param prodVersion - The production version number to activate
 */
async function switchProductionVersion(prodVersion: number) {
  if (prodVersion <= 0 || !Number.isInteger(prodVersion)) {
    console.error("Error: Prod version number must be a positive integer");
    process.exit(1);
  }

  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log(`Switching production version to prod-${prodVersion}...`);
  console.log(`Using Convex deployment: ${convexUrl}`);

  const convex = new ConvexHttpClient(convexUrl);

  try {
    await convex.mutation(
      api.functions.predictions.mutations.setProductionVersion,
      { prodVersion }
    );

    console.log(
      `✅ Successfully switched production version to prod-${prodVersion}`
    );
    console.log("   Predictions will now use this version");
  } catch (error) {
    console.error("Error switching production version:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("Usage: npm run ml:switch-prod -- <prod-version>");
  console.error("Example: npm run ml:switch-prod -- 1");
  process.exit(1);
}

const prodVersion = parseInt(args[0], 10);
if (isNaN(prodVersion)) {
  console.error("Error: Version must be a number");
  process.exit(1);
}

if (require.main === module) {
  switchProductionVersion(prodVersion).catch(console.error);
}
