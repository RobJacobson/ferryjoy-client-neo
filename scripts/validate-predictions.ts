// ============================================================================
// VALIDATION SCRIPT: ML Prediction Accuracy
// Validates prediction models against historical trip data
// ============================================================================

import { api } from "../convex/_generated/api";
import type { ConvexVesselTrip } from "../convex/functions/vesselTrips/schemas";

interface PredictionAccuracyMetrics {
  totalPredictions: number;
  accuratePredictions: number;
  skippedPredictions: number;
  totalErrorMinutes: number;
  averageErrorMinutes: number;
  accuracyPercentage: number;
}

interface TerminalPairMetrics {
  terminalPair: string;
  totalTrips: number;
  predictionsWithMae: number;
  averageErrorMinutes: number;
  accuracyWithinMae: number;
}

/**
 * Validates prediction accuracy against historical trip data
 * Compares actual trip times against stored predictions (if available)
 */
async function validatePredictionAccuracy(): Promise<void> {
  console.log("🔍 Starting prediction validation...\n");

  // Fetch completed trips with predictions
  const completedTrips = (await fetchCompletedTrips()).filter(
    (trip) => trip.DelayPred !== undefined || trip.EtaPred !== undefined
  );

  if (completedTrips.length === 0) {
    console.log("⚠️  No completed trips with predictions found.");
    console.log(
      "   Run the prediction system first to generate predictions for trips."
    );
    return;
  }

  console.log(
    `📊 Analyzing ${completedTrips.length} trips with predictions...\n`
  );

  // Calculate overall metrics
  const overallMetrics = calculateOverallMetrics(completedTrips);

  // Calculate metrics by terminal pair
  const terminalPairMetrics = calculateTerminalPairMetrics(completedTrips);

  // Print results
  printOverallResults(overallMetrics);
  printTerminalPairResults(terminalPairMetrics);

  // Print recommendations
  printRecommendations(overallMetrics, terminalPairMetrics);
}

/**
 * Fetches completed trips from Convex
 */
async function fetchCompletedTrips(): Promise<ConvexVesselTrip[]> {
  // Note: This would need to be run as a Convex action or using the Convex client
  // For now, this is a placeholder implementation
  console.log(
    "⚠️  Note: This script needs to be run as a Convex action or use the Convex client."
  );
  console.log("   Example usage: npx convex run scripts/validate-predictions");
  return [];
}

/**
 * Calculates overall prediction accuracy metrics
 */
function calculateOverallMetrics(
  trips: ConvexVesselTrip[]
): PredictionAccuracyMetrics {
  let totalPredictions = 0;
  let accuratePredictions = 0;
  let skippedPredictions = 0;
  let totalErrorMinutes = 0;

  for (const trip of trips) {
    // Validate delay predictions (DelayPred is in minutes, not timestamp)
    if (
      trip.DelayPred !== undefined &&
      trip.LeftDock !== undefined &&
      trip.ScheduledDeparture !== undefined
    ) {
      totalPredictions++;
      // Calculate actual delay in minutes
      const actualDelayMinutes =
        (trip.LeftDock - trip.ScheduledDeparture) / 60000;
      // Compare predicted delay to actual delay
      const errorMinutes = Math.abs(trip.DelayPred - actualDelayMinutes);
      totalErrorMinutes += errorMinutes;

      if (trip.DelayPredMae && errorMinutes <= trip.DelayPredMae) {
        accuratePredictions++;
      }
    }

    // Validate Eta predictions
    if (trip.EtaPred && trip.TripEnd) {
      totalPredictions++;
      const errorMinutes = Math.abs(trip.EtaPred - trip.TripEnd) / 60000;
      totalErrorMinutes += errorMinutes;

      if (trip.EtaPredMae && errorMinutes <= trip.EtaPredMae) {
        accuratePredictions++;
      }
    }

    // Count skipped predictions (no prediction made)
    if (trip.DelayPred === undefined && trip.EtaPred === undefined) {
      skippedPredictions++;
    }
  }

  const averageErrorMinutes =
    totalPredictions > 0 ? totalErrorMinutes / totalPredictions : 0;
  const accuracyPercentage =
    totalPredictions > 0 ? (accuratePredictions / totalPredictions) * 100 : 0;

  return {
    totalPredictions,
    accuratePredictions,
    skippedPredictions,
    totalErrorMinutes,
    averageErrorMinutes,
    accuracyPercentage,
  };
}

/**
 * Calculates prediction metrics grouped by terminal pair
 */
function calculateTerminalPairMetrics(
  trips: ConvexVesselTrip[]
): TerminalPairMetrics[] {
  const metricsByTerminalPair = new Map<
    string,
    {
      totalTrips: number;
      predictionsWithMae: number;
      totalErrorMinutes: number;
      accurateWithinMae: number;
    }
  >();

  for (const trip of trips) {
    const terminalPair = `${trip.DepartingTerminalAbbrev}-${trip.ArrivingTerminalAbbrev || "UNK"}`;

    const existing = metricsByTerminalPair.get(terminalPair) || {
      totalTrips: 0,
      predictionsWithMae: 0,
      totalErrorMinutes: 0,
      accurateWithinMae: 0,
    };

    existing.totalTrips++;

    // Track delay predictions (DelayPred is in minutes, not timestamp)
    if (
      trip.DelayPred !== undefined &&
      trip.LeftDock !== undefined &&
      trip.ScheduledDeparture !== undefined &&
      trip.DelayPredMae !== undefined
    ) {
      existing.predictionsWithMae++;
      // Calculate actual delay in minutes
      const actualDelayMinutes =
        (trip.LeftDock - trip.ScheduledDeparture) / 60000;
      // Compare predicted delay to actual delay
      const errorMinutes = Math.abs(trip.DelayPred - actualDelayMinutes);
      existing.totalErrorMinutes += errorMinutes;

      if (errorMinutes <= trip.DelayPredMae) {
        existing.accurateWithinMae++;
      }
    }

    // Track Eta predictions
    if (trip.EtaPred && trip.TripEnd && trip.EtaPredMae) {
      existing.predictionsWithMae++;
      const errorMinutes = Math.abs(trip.EtaPred - trip.TripEnd) / 60000;
      existing.totalErrorMinutes += errorMinutes;

      if (errorMinutes <= trip.EtaPredMae) {
        existing.accurateWithinMae++;
      }
    }

    metricsByTerminalPair.set(terminalPair, existing);
  }

  // Convert to array and calculate averages
  return Array.from(metricsByTerminalPair.entries())
    .map(([terminalPair, metrics]) => ({
      terminalPair,
      totalTrips: metrics.totalTrips,
      predictionsWithMae: metrics.predictionsWithMae,
      averageErrorMinutes:
        metrics.predictionsWithMae > 0
          ? metrics.totalErrorMinutes / metrics.predictionsWithMae
          : 0,
      accuracyWithinMae:
        metrics.predictionsWithMae > 0
          ? (metrics.accurateWithinMae / metrics.predictionsWithMae) * 100
          : 0,
    }))
    .sort((a, b) => b.totalTrips - a.totalTrips);
}

/**
 * Prints overall validation results
 */
function printOverallResults(metrics: PredictionAccuracyMetrics): void {
  console.log("📈 OVERALL ACCURACY:");
  console.log("─".repeat(60));
  console.log(`   Total Predictions:    ${metrics.totalPredictions}`);
  console.log(
    `   Accurate (within MAE): ${metrics.accuratePredictions} (${metrics.accuracyPercentage.toFixed(1)}%)`
  );
  console.log(`   Skipped:              ${metrics.skippedPredictions}`);
  console.log(
    `   Average Error:        ${metrics.averageErrorMinutes.toFixed(2)} minutes`
  );
  console.log(
    `   Total Error:          ${metrics.totalErrorMinutes.toFixed(2)} minutes\n`
  );
}

/**
 * Prints terminal pair specific results
 */
function printTerminalPairResults(metrics: TerminalPairMetrics[]): void {
  console.log("📍 ACCURACY BY TERMINAL PAIR:");
  console.log("─".repeat(80));
  console.log(
    "   Terminal Pair    | Trips | Predictions | Avg Error | Accurate | % Within MAE"
  );
  console.log("─".repeat(80));

  for (const m of metrics) {
    const terminalPair = m.terminalPair.padEnd(16);
    const trips = String(m.totalTrips).padStart(6);
    const predictions = String(m.predictionsWithMae).padStart(11);
    const avgError = `${m.averageErrorMinutes.toFixed(2)}m`.padStart(10);
    const accurate = String(m.accurateWithinMae).padStart(9);
    const accuracy = `${m.accuracyWithinMae.toFixed(1)}%`.padStart(13);

    console.log(
      `   ${terminalPair} | ${trips} | ${predictions} | ${avgError} | ${accurate} | ${accuracy}`
    );
  }
  console.log();
}

/**
 * Prints recommendations based on validation results
 */
function printRecommendations(
  overall: PredictionAccuracyMetrics,
  terminalPairMetrics: TerminalPairMetrics[]
): void {
  console.log("💡 RECOMMENDATIONS:");
  console.log("─".repeat(60));

  if (overall.accuracyPercentage < 50) {
    console.log(
      "   ⚠️  LOW ACCURACY: Consider retraining models with more recent data."
    );
  } else if (overall.accuracyPercentage < 70) {
    console.log(
      "   ⚡ MODERATE ACCURACY: Model performance could be improved with additional features."
    );
  } else {
    console.log(
      `   ✅ GOOD ACCURACY: ${overall.accuracyPercentage.toFixed(1)}% of predictions within MAE.`
    );
  }

  if (overall.averageErrorMinutes > 10) {
    console.log(
      "   📉 HIGH ERROR RATE: Average error exceeds 10 minutes. Review feature engineering."
    );
  }

  // Identify terminal pairs with poor performance
  const poorPerformingPairs = terminalPairMetrics.filter(
    (m) => m.accuracyWithinMae < 50 && m.predictionsWithMae > 10
  );

  if (poorPerformingPairs.length > 0) {
    console.log("\n   ⚠️  Terminal pairs with poor accuracy:");
    for (const pair of poorPerformingPairs) {
      console.log(
        `      - ${pair.terminalPair}: ${pair.accuracyWithinMae.toFixed(1)}% accurate, ` +
          `${pair.predictionsWithMae} predictions`
      );
    }
  }

  // Check for terminal pairs with no predictions
  const pairsWithNoPredictions = terminalPairMetrics.filter(
    (m) => m.predictionsWithMae === 0
  );

  if (pairsWithNoPredictions.length > 0) {
    console.log("\n   ℹ️  Terminal pairs with no predictions:");
    for (const pair of pairsWithNoPredictions) {
      console.log(
        `      - ${pair.terminalPair}: ${pair.totalTrips} trips, 0 predictions`
      );
    }
  }

  console.log();
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  validatePredictionAccuracy().catch((error) => {
    console.error("❌ Validation failed:", error);
    process.exit(1);
  });
}

export { validatePredictionAccuracy };
