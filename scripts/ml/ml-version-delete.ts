// ============================================================================
// ML VERSION MANAGEMENT - Delete version tag
// Deletes all models for a specific version tag
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
 * Delete a version tag.
 *
 * @param versionTag - The version tag to delete (e.g., "dev-1", "prod-1")
 */
async function deleteVersion(versionTag: string) {
  if (!versionTag || versionTag.trim() === "") {
    console.error("Error: Version tag cannot be empty");
    process.exit(1);
  }

  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log(`Deleting ${versionTag}...`);
  console.log(`Using Convex deployment: ${convexUrl}`);

  // Require confirmation for prod versions
  if (versionTag.startsWith("prod-")) {
    const answer = await askQuestion(
      `⚠️  Are you sure you want to delete ${versionTag}? (yes/no): `
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
      { versionTag }
    );

    console.log(
      `✅ Successfully deleted ${result.deleted} models from ${versionTag}`
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
if (args.length !== 1) {
  console.error("Usage: npm run ml:delete-version -- <version-tag>");
  console.error('Example: npm run ml:delete-version -- "dev-1"');
  console.error('Example: npm run ml:delete-version -- "prod-1"');
  process.exit(1);
}

const versionTag = args[0];

if (require.main === module) {
  deleteVersion(versionTag).catch(console.error);
}
