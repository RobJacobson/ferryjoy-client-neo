// ============================================================================
// ML VERSION MANAGEMENT - List all versions
// Lists all version tags with model counts and creation timestamps
// ============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { ConvexModelParameters } from "../../convex/functions/predictions/schemas";

type VersionInfo = {
  versionTag: string;
  modelCount: number;
  earliestCreated: number;
  latestCreated: number;
};

/**
 * List all version tags with statistics.
 */
async function listVersions() {
  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.EXPO_PUBLIC_CONVEX_URL ||
    "https://outstanding-caterpillar-504.convex.cloud";

  console.log("Listing ML model versions...");
  console.log(`Using Convex deployment: ${convexUrl}\n`);

  const convex = new ConvexHttpClient(convexUrl);

  try {
    // Get all version tags
    const versionTags = await convex.query(
      api.functions.predictions.queries.getAllVersions
    );

    // Get current production version tag
    const currentProdTag = await convex.query(
      api.functions.predictions.queries.getProductionVersionTag
    );

    // Get all models to calculate statistics
    const allModels = (await convex.query(
      api.functions.predictions.queries.getAllModelParameters
    )) as ConvexModelParameters[];

    // Group models by version tag
    const modelsByTag = new Map<string, ConvexModelParameters[]>();

    for (const model of allModels) {
      const existing = modelsByTag.get(model.versionTag) || [];
      existing.push(model);
      modelsByTag.set(model.versionTag, existing);
    }

    // Format version info
    const formatVersionInfo = (
      versionTag: string,
      models: ConvexModelParameters[]
    ): VersionInfo => {
      const timestamps = models.map((m) => m.createdAt);
      return {
        versionTag,
        modelCount: models.length,
        earliestCreated: Math.min(...timestamps),
        latestCreated: Math.max(...timestamps),
      };
    };

    // Categorize tags (dev-*, prod-*, or other)
    const devTags: VersionInfo[] = [];
    const prodTags: VersionInfo[] = [];
    const otherTags: VersionInfo[] = [];

    for (const tag of versionTags) {
      const models = modelsByTag.get(tag) || [];
      const info = formatVersionInfo(tag, models);
      if (tag.startsWith("dev-")) {
        devTags.push(info);
      } else if (tag.startsWith("prod-")) {
        prodTags.push(info);
      } else {
        otherTags.push(info);
      }
    }

    // Sort dev and prod by tag name
    devTags.sort((a, b) => a.versionTag.localeCompare(b.versionTag));
    prodTags.sort((a, b) => a.versionTag.localeCompare(b.versionTag));

    // Display dev versions
    console.log("📦 Development Versions:");
    if (devTags.length === 0) {
      console.log("  (none)");
    } else {
      for (const info of devTags) {
        const created = new Date(info.earliestCreated).toISOString();
        console.log(
          `  ${info.versionTag.padEnd(12)} ${info.modelCount.toString().padStart(4)} models  created: ${created}`
        );
      }
    }

    console.log();

    // Display prod versions
    console.log("🚀 Production Versions:");
    if (prodTags.length === 0) {
      console.log("  (none)");
    } else {
      for (const info of prodTags) {
        const created = new Date(info.earliestCreated).toISOString();
        const activeMarker =
          currentProdTag === info.versionTag ? " ⭐ ACTIVE" : "";
        console.log(
          `  ${info.versionTag.padEnd(12)} ${info.modelCount.toString().padStart(4)} models  created: ${created}${activeMarker}`
        );
      }
    }

    // Display other tags if any
    if (otherTags.length > 0) {
      console.log();
      console.log("📋 Other Versions:");
      for (const info of otherTags) {
        const created = new Date(info.earliestCreated).toISOString();
        const activeMarker =
          currentProdTag === info.versionTag ? " ⭐ ACTIVE" : "";
        console.log(
          `  ${info.versionTag.padEnd(12)} ${info.modelCount.toString().padStart(4)} models  created: ${created}${activeMarker}`
        );
      }
    }

    console.log();
    if (!currentProdTag) {
      console.log("⚠️  No production version is currently active");
    } else {
      console.log(`✅ Active production version: ${currentProdTag}`);
    }
  } catch (error) {
    console.error("Error listing versions:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  listVersions().catch(console.error);
}
