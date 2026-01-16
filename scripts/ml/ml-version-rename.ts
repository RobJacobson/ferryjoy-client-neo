// ============================================================================
// ML VERSION MANAGEMENT - Rename version tag
// Renames a version tag by copying all models to a new tag and deleting the old tag
// ============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/**
 * Rename a version tag.
 *
 * @param fromTag - The source version tag (e.g., "dev-temp", "dev-1")
 * @param toTag - The destination version tag (e.g., "dev-1", "prod-1")
 */
async function renameVersionTag(fromTag: string, toTag: string) {
  if (!fromTag || fromTag.trim() === "") {
    console.error("Error: Source tag cannot be empty");
    process.exit(1);
  }

  if (!toTag || toTag.trim() === "") {
    console.error("Error: Destination tag cannot be empty");
    process.exit(1);
  }

  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log(`Renaming ${fromTag} to ${toTag}...`);
  console.log(`Using Convex deployment: ${convexUrl}`);

  const convex = new ConvexHttpClient(convexUrl);

  try {
    const result = await convex.mutation(
      api.functions.predictions.mutations.renameVersionTag,
      { fromTag, toTag }
    );

    console.log(
      `✅ Successfully renamed ${result.renamed} models from ${fromTag} to ${toTag}`
    );
    console.log(`   Old tag "${fromTag}" has been deleted`);

    // If renaming to a prod tag, remind user to activate it
    if (toTag.startsWith("prod-")) {
      console.log(
        `\n💡 To activate this production version, run: npm run ml:switch-prod -- "${toTag}"`
      );
    }
  } catch (error) {
    console.error("Error renaming version tag:", error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("Usage: npm run ml:rename-tag -- <from-tag> <to-tag>");
  console.error('Example: npm run ml:rename-tag -- "dev-temp" "dev-1"');
  console.error('Example: npm run ml:rename-tag -- "dev-1" "prod-1"');
  process.exit(1);
}

const fromTag = args[0];
const toTag = args[1];

if (require.main === module) {
  renameVersionTag(fromTag, toTag).catch(console.error);
}
