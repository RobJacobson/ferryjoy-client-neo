#!/usr/bin/env tsx

// ============================================================================
// VALIDATION SCRIPT: Scheduled Trips Data Consistency
// Verifies that Convex database matches WSF API for a specific route/date
// ============================================================================

import * as fs from "node:fs";
import * as path from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { VerificationResult } from "../convex/functions/scheduledTrips/actions/types";

interface ValidationOptions {
  routeId: number;
  sailingDay: string;
  verbose?: boolean;
}

/**
 * Load environment variables from .env file
 */
function loadEnvFile(): void {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim();
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, "");
          process.env[key.trim()] = cleanValue;
        }
      }
    }
  }
}

/**
 * Validates scheduled trips data consistency for a specific route and sailing day
 */
async function validateScheduledTrips(
  options: ValidationOptions
): Promise<void> {
  const { routeId, sailingDay, verbose = false } = options;

  console.log("🚢 Scheduled Trips Data Validation");
  console.log("==================================");
  console.log(`Route ID: ${routeId}`);
  console.log(`Sailing Day: ${sailingDay}`);
  console.log();

  // Load environment variables from .env file
  loadEnvFile();

  // Initialize Convex client
  const convexUrl =
    process.env.CONVEX_URL || process.env.EXPO_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error(
      "CONVEX_URL or EXPO_PUBLIC_CONVEX_URL environment variable is required. Please ensure it's set in your .env file."
    );
  }
  const client = new ConvexHttpClient(convexUrl);

  try {
    console.log("📡 Calling verification action...");

    // Call the verification action
    const result: VerificationResult = await client.action(
      api.functions.scheduledTrips.actions.verifyScheduledTripsForRoute,
      { routeId, sailingDay }
    );

    // Log additional details for debugging
    if (result.wsfTripCount !== result.convexTripCount) {
      console.log(
        `   ⚠️  Count mismatch detected: WSF=${result.wsfTripCount}, Convex=${result.convexTripCount}`
      );
    }

    // Display results
    console.log("📊 Verification Results");
    console.log("=======================");

    const status = result.isValid ? "✅ PASS" : "❌ FAIL";
    console.log(`Status: ${status}`);
    console.log(`WSF Trips: ${result.wsfTripCount}`);
    console.log(`Convex Trips: ${result.convexTripCount}`);
    console.log(`Issues Found: ${result.issues.length}`);
    console.log();

    if (
      result.issues.length > 0 ||
      result.wsfTripCount !== result.convexTripCount
    ) {
      console.log("🚨 Issues Detected:");
      console.log("===================");

      // Always show count mismatch if it exists
      if (result.wsfTripCount !== result.convexTripCount) {
        console.log(
          `1. CRITICAL: Count mismatch - WSF has ${result.wsfTripCount} trips, Convex has ${result.convexTripCount} trips`
        );
      }

      // Show other issues
      result.issues.forEach((issue, index) => {
        const issueNum =
          result.wsfTripCount !== result.convexTripCount
            ? index + 2
            : index + 1;
        console.log(`${issueNum}. ${issue}`);
      });
      console.log();

      if (verbose) {
        console.log("💡 Recommendations:");
        console.log("===================");
        console.log("• Check if the route has recent schedule changes");
        console.log("• Verify WSF API is returning correct data");
        console.log("• Consider running a full sync for this route");
        console.log("• Check Convex logs for any sync errors");
      }
    }

    // Exit with error if count mismatch (even if no other issues)
    if (result.wsfTripCount !== result.convexTripCount) {
      process.exit(1); // Exit with error code for CI/CD
    } else {
      console.log("🎉 Data is consistent!");
      console.log("======================");
      console.log("✓ All trips present and matching");
      console.log("✓ No missing or extra trips");
      console.log("✓ No data inconsistencies detected");
    }
  } catch (error) {
    console.error("❌ Validation failed:");
    console.error(error);
    process.exit(1);
  }
}

// Command line interface
function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      "Usage: npm run validate:scheduled-trips <routeId> <sailingDay> [--verbose]"
    );
    console.error("");
    console.error("Examples:");
    console.error("  npm run validate:scheduled-trips 123 2024-12-27");
    console.error(
      "  npm run validate:scheduled-trips 456 2024-12-27 --verbose"
    );
    console.error("");
    console.error("Arguments:");
    console.error("  routeId     - Route ID to validate (number)");
    console.error(
      "  sailingDay  - Sailing day in YYYY-MM-DD format (WSF operational day)"
    );
    console.error("  --verbose   - Show additional recommendations on failure");
    process.exit(1);
  }

  const routeId = parseInt(args[0], 10);
  const sailingDay = args[1];
  const verbose = args.includes("--verbose");

  if (isNaN(routeId)) {
    console.error("Error: routeId must be a valid number");
    process.exit(1);
  }

  // Validate sailing day format (basic YYYY-MM-DD check)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(sailingDay)) {
    console.error("Error: sailingDay must be in YYYY-MM-DD format");
    process.exit(1);
  }

  validateScheduledTrips({ routeId, sailingDay, verbose });
}

// Run if called directly
if (require.main === module) {
  main();
}
