#!/usr/bin/env tsx

// ============================================================================
// VALIDATION SCRIPT: All Scheduled Trips Data Consistency
// Validates data consistency across all routes for a given date
// ============================================================================

import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";
import type { Route } from "ws-dottie/wsf-schedule";
import { fetchRoutesByTripDate } from "ws-dottie/wsf-schedule";
import { api } from "../convex/_generated/api";
import type { VerificationResult } from "../convex/functions/scheduledTrips/actions/types";

interface ValidationSummary {
  totalRoutes: number;
  passedRoutes: number;
  failedRoutes: number;
  totalIssues: number;
  routeResults: Array<{
    routeId: number;
    routeAbbrev: string;
    result: VerificationResult;
  }>;
}

interface ValidationOptions {
  dateString?: string;
  verbose?: boolean;
  parallel?: boolean;
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
 * Validate all routes for a given date
 */
async function validateAllRoutes(
  options: ValidationOptions
): Promise<ValidationSummary> {
  const {
    dateString = new Date().toISOString().split("T")[0],
    verbose = false,
    parallel = false,
  } = options;

  console.log("🚢 Scheduled Trips Data Validation - All Routes");
  console.log("================================================");
  console.log(`Date: ${dateString}`);
  console.log(`Mode: ${parallel ? "Parallel" : "Sequential"}`);
  console.log();

  // Load environment variables
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

  console.log(`📅 Fetching routes for ${dateString}...`);

  // Fetch all routes for the date
  let routes: Route[];
  try {
    routes = await fetchRoutesByTripDate({ params: { TripDate: dateString } });
  } catch (error) {
    console.error("❌ Failed to fetch routes:", error);
    throw new Error(`Could not fetch routes for ${dateString}`);
  }

  console.log(`📋 Found ${routes.length} routes to validate`);
  console.log();

  if (routes.length === 0) {
    console.log("⚠️  No routes found for the specified date");
    return {
      totalRoutes: 0,
      passedRoutes: 0,
      failedRoutes: 0,
      totalIssues: 0,
      routeResults: [],
    };
  }

  // Validate each route
  const routeResults: Array<{
    routeId: number;
    routeAbbrev: string;
    result: VerificationResult;
  }> = [];

  const validateRoute = async (route: Route): Promise<void> => {
    try {
      console.log(
        `🔍 Validating route ${route.RouteID} (${route.RouteAbbrev || "no abbrev"})...`
      );

      const result: VerificationResult = await client.action(
        api.functions.scheduledTrips.actions.verifyScheduledTripsForRoute,
        {
          routeId: route.RouteID,
          dateString,
        }
      );

      routeResults.push({
        routeId: route.RouteID,
        routeAbbrev: route.RouteAbbrev || "",
        result,
      });

      const status = result.isValid ? "✅ PASS" : "❌ FAIL";
      console.log(
        `   ${status} - WSF: ${result.wsfTripCount}, Convex: ${result.convexTripCount}, Issues: ${result.issues.length}`
      );

      if (!result.isValid && verbose) {
        console.log("   Issues:");
        result.issues.forEach((issue, index) => {
          console.log(`     ${index + 1}. ${issue}`);
        });
      }
    } catch (error) {
      console.error(`   ❌ Error validating route ${route.RouteID}:`, error);
      // Add failed result
      routeResults.push({
        routeId: route.RouteID,
        routeAbbrev: route.RouteAbbrev || "",
        result: {
          isValid: false,
          issues: [
            `Validation error: ${error instanceof Error ? error.message : String(error)}`,
          ],
          wsfTripCount: 0,
          convexTripCount: 0,
          routeId: route.RouteID,
        },
      });
    }
  };

  // Run validations
  if (parallel) {
    await Promise.all(routes.map(validateRoute));
  } else {
    for (const route of routes) {
      await validateRoute(route);
    }
  }

  // Calculate summary
  const summary: ValidationSummary = {
    totalRoutes: routes.length,
    passedRoutes: routeResults.filter((r) => r.result.isValid).length,
    failedRoutes: routeResults.filter((r) => !r.result.isValid).length,
    totalIssues: routeResults.reduce(
      (sum, r) => sum + r.result.issues.length,
      0
    ),
    routeResults,
  };

  // Display summary
  console.log();
  console.log("📊 Validation Summary");
  console.log("====================");
  console.log(`Total Routes: ${summary.totalRoutes}`);
  console.log(`Passed: ${summary.passedRoutes}`);
  console.log(`Failed: ${summary.failedRoutes}`);
  console.log(`Total Issues: ${summary.totalIssues}`);
  console.log();

  if (summary.failedRoutes > 0) {
    console.log("❌ Failed Routes:");
    console.log("================");
    summary.routeResults
      .filter((r) => !r.result.isValid)
      .forEach((r) => {
        console.log(
          `• Route ${r.routeId} (${r.routeAbbrev}): ${r.result.issues.length} issues`
        );
        if (verbose) {
          r.result.issues.forEach((issue) => {
            console.log(`  - ${issue}`);
          });
        }
      });
  }

  const overallStatus =
    summary.failedRoutes === 0
      ? "🎉 ALL ROUTES PASSED!"
      : "⚠️  SOME ROUTES FAILED";
  console.log();
  console.log(overallStatus);

  return summary;
}

// Command line interface
function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let dateString: string | undefined;
  let verbose = false;
  let parallel = false;

  for (const arg of args) {
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg === "--parallel" || arg === "-p") {
      parallel = true;
    } else if (!dateString) {
      dateString = arg;
    } else {
      console.error("Unexpected argument:", arg);
      process.exit(1);
    }
  }

  if (!dateString) {
    // Default to today
    dateString = new Date().toISOString().split("T")[0];
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    console.error("Error: dateString must be in YYYY-MM-DD format");
    process.exit(1);
  }

  validateAllRoutes({ dateString, verbose, parallel })
    .then((summary) => {
      // Exit with error code if any routes failed
      if (summary.failedRoutes > 0) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("Validation failed:", error);
      process.exit(1);
    });
}

// Run if called directly
if (require.main === module) {
  main();
}
