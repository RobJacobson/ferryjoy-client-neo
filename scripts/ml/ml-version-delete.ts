// ============================================================================
// ML VERSION MANAGEMENT - Delete version
// Deletes all models for a specific dev or prod version
// ============================================================================

import * as readline from "node:readline";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/**
 * Prompt for user confirmation.
 */
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

/**
 * Delete a version (dev or prod).
 *
 * @param versionType - "dev" or "prod"
 * @param versionNumber - The version number to delete
 */
async function deleteVersion(
  versionType: "dev" | "prod",
  versionNumber: number
) {
  // Allow -1 for dev-temp, but require positive integers for other versions
  if (versionType === "dev") {
    if (versionNumber !== -1 && (versionNumber <= 0 || !Number.isInteger(versionNumber))) {
      console.error("Error: Dev version number must be -1 (dev-temp) or a positive integer");
      process.exit(1);
    }
  } else {
    if (versionNumber <= 0 || !Number.isInteger(versionNumber)) {
      console.error("Error: Prod version number must be a positive integer");
      process.exit(1);
    }
  }

  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  const versionLabel =
    versionType === "dev"
      ? versionNumber === -1
        ? "dev-temp"
        : `dev-${versionNumber}`
      : `prod-${versionNumber}`;

  console.log(`Deleting ${versionLabel}...`);
  console.log(`Using Convex deployment: ${convexUrl}`);

  // Require confirmation for prod versions
  if (versionType === "prod") {
    const answer = await askQuestion(
      `⚠️  Are you sure you want to delete ${versionLabel}? (yes/no): `
    );
    if (answer.toLowerCase() !== "yes") {
      console.log("Cancelled");
      process.exit(0);
    }
  }

  const convex = new ConvexHttpClient(convexUrl);

  try {
    const result = await convex.mutation(
      api.functions.predictions.mutations.deleteVersion,
      { versionType, versionNumber }
    );

    console.log(
      `✅ Successfully deleted ${result.deleted} models from ${versionLabel}`
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Cannot delete active production version")) {
      console.error(`❌ ${errorMessage}`);
      console.error(
        "   Use 'npm run ml:switch-prod' to switch to a different version first"
      );
    } else {
      console.error("Error deleting version:", error);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("Usage: npm run ml:delete-version -- <type> <version>");
  console.error("Example: npm run ml:delete-version -- dev 1");
  console.error("Example: npm run ml:delete-version -- prod 1");
  process.exit(1);
}

const versionType = args[0] as "dev" | "prod";
if (versionType !== "dev" && versionType !== "prod") {
  console.error("Error: Type must be 'dev' or 'prod'");
  process.exit(1);
}

const versionNumber = parseInt(args[1], 10);
if (isNaN(versionNumber)) {
  console.error("Error: Version must be a number");
  process.exit(1);
}

if (require.main === module) {
  deleteVersion(versionType, versionNumber).catch(console.error);
}
