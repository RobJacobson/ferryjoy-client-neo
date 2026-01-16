// ============================================================================
// ML VERSION MANAGEMENT - Promote dev-x to prod-y
// Copies all models from dev-{devVersion} to prod-{prodVersion}
// ============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/**
 * Promote dev version models to a production version.
 *
 * @param devVersion - The dev version number to promote from
 * @param prodVersion - The prod version number to promote to
 */
async function promoteDevToProd(devVersion: number, prodVersion: number) {
  if (devVersion <= 0 || !Number.isInteger(devVersion)) {
    console.error("Error: Dev version number must be a positive integer");
    process.exit(1);
  }

  if (prodVersion <= 0 || !Number.isInteger(prodVersion)) {
    console.error("Error: Prod version number must be a positive integer");
    process.exit(1);
  }

  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log(
    `Promoting dev-${devVersion} to prod-${prodVersion}...`
  );
  console.log(`Using Convex deployment: ${convexUrl}`);

  const convex = new ConvexHttpClient(convexUrl);

  try {
    const result = await convex.mutation(
      api.functions.predictions.mutations.promoteDevToProd,
      { devVersion, prodVersion }
    );

    console.log(
      `✅ Successfully promoted ${result.promoted} models from dev-${devVersion} to prod-${prodVersion}`
    );
    console.log(
      `✅ Production version ${prodVersion} is now active for predictions`
    );
  } catch (error) {
    console.error("Error promoting to prod:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("Usage: npm run ml:promote-prod -- <dev-version> <prod-version>");
  console.error("Example: npm run ml:promote-prod -- 1 1");
  process.exit(1);
}

const devVersion = parseInt(args[0], 10);
const prodVersion = parseInt(args[1], 10);

if (isNaN(devVersion) || isNaN(prodVersion)) {
  console.error("Error: Both versions must be numbers");
  process.exit(1);
}

if (require.main === module) {
  promoteDevToProd(devVersion, prodVersion).catch(console.error);
}
