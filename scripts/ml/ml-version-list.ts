// ============================================================================
// ML VERSION MANAGEMENT - List all versions
// Lists all dev and prod versions with model counts and creation timestamps
// ============================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { ConvexModelParameters } from "../../convex/functions/predictions/schemas";

type VersionInfo = {
  versionNumber: number;
  modelCount: number;
  earliestCreated: number;
  latestCreated: number;
};

/**
 * List all dev and prod versions with statistics.
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
    // Get all versions
    const versions = await convex.query(
      api.functions.predictions.queries.getAllVersions
    );

    // Get current production version
    const currentProdVersion = await convex.query(
      api.functions.predictions.queries.getProductionVersion
    );

    // Get all models to calculate statistics
    const allModels = (await convex.query(
      api.functions.predictions.queries.getAllModelParameters
    )) as ConvexModelParameters[];

    // Group models by version
    const devVersions = new Map<number, ConvexModelParameters[]>();
    const prodVersions = new Map<number, ConvexModelParameters[]>();

    for (const model of allModels) {
      if (model.versionType === "dev") {
        const existing = devVersions.get(model.versionNumber) || [];
        existing.push(model);
        devVersions.set(model.versionNumber, existing);
      } else if (model.versionType === "prod") {
        const existing = prodVersions.get(model.versionNumber) || [];
        existing.push(model);
        prodVersions.set(model.versionNumber, existing);
      }
    }

    // Format version info
    const formatVersionInfo = (
      versionNumber: number,
      models: ConvexModelParameters[]
    ): VersionInfo => {
      const timestamps = models.map((m) => m.createdAt);
      return {
        versionNumber,
        modelCount: models.length,
        earliestCreated: Math.min(...timestamps),
        latestCreated: Math.max(...timestamps),
      };
    };

    // Display dev versions
    console.log("📦 Development Versions:");
    if (versions.dev.length === 0) {
      console.log("  (none)");
    } else {
      for (const versionNum of versions.dev) {
        const models = devVersions.get(versionNum) || [];
        const info = formatVersionInfo(versionNum, models);
        const versionLabel =
          versionNum === -1 ? "dev-temp" : `dev-${versionNum}`;
        const created = new Date(info.earliestCreated).toISOString();
        console.log(
          `  ${versionLabel.padEnd(12)} ${info.modelCount.toString().padStart(4)} models  created: ${created}`
        );
      }
    }

    console.log();

    // Display prod versions
    console.log("🚀 Production Versions:");
    if (versions.prod.length === 0) {
      console.log("  (none)");
    } else {
      for (const versionNum of versions.prod) {
        const models = prodVersions.get(versionNum) || [];
        const info = formatVersionInfo(versionNum, models);
        const created = new Date(info.earliestCreated).toISOString();
        const activeMarker =
          currentProdVersion === versionNum ? " ⭐ ACTIVE" : "";
        console.log(
          `  prod-${versionNum.toString().padEnd(8)} ${info.modelCount.toString().padStart(4)} models  created: ${created}${activeMarker}`
        );
      }
    }

    console.log();
    if (currentProdVersion === null) {
      console.log("⚠️  No production version is currently active");
    } else {
      console.log(`✅ Active production version: prod-${currentProdVersion}`);
    }
  } catch (error) {
    console.error("Error listing versions:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  listVersions().catch(console.error);
}
