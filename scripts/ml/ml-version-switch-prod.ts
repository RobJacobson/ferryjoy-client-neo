// ============================================================================
// ML VERSION MANAGEMENT - Switch production version tag
// Updates the active production version tag for predictions
// ============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/**
 * Switch the active production version tag.
 *
 * @param versionTag - The production version tag to activate (e.g., "prod-1")
 */
async function switchProductionVersion(versionTag: string) {
  if (!versionTag || versionTag.trim() === "") {
    console.error("Error: Version tag cannot be empty");
    process.exit(1);
  }

  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log(`Switching production version to ${versionTag}...`);
  console.log(`Using Convex deployment: ${convexUrl}`);

  const convex = new ConvexHttpClient(convexUrl);

  try {
    await convex.mutation(
      api.functions.predictions.mutations.setProductionVersionTag,
      { versionTag }
    );

    console.log(
      `✅ Successfully switched production version to ${versionTag}`
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
  console.error("Usage: npm run ml:switch-prod -- <version-tag>");
  console.error('Example: npm run ml:switch-prod -- "prod-1"');
  process.exit(1);
}

const versionTag = args[0];

if (require.main === module) {
  switchProductionVersion(versionTag).catch(console.error);
}
