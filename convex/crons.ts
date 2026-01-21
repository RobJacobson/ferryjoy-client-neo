import { internal } from "_generated/api";
import { cronJobs } from "convex/server";

const crons = cronJobs();

// crons.interval(
//   "update vessel orchestrator",
//   { seconds: 5 }, // every 5 seconds
//   internal.functions.vesselOrchestrator.actions.updateVesselOrchestrator
// );

// crons.interval(
//   "fetch vessel pings",
//   { seconds: 30 }, // every thirty seconds
//   internal.functions.vesselPings.actions.fetchAndStoreVesselPings
// );

// Weekly model retraining at 11:00 AM UTC on Mondays
// Note: Convex cron jobs run in UTC, not local timezones
// crons.cron(
//   "retrain ml models",
//   "0 11 * * 1", // 11:00 AM UTC every Monday
//   internal.domain.ml.training.actions.trainPredictionModelsAction
// );

// Daily scheduled trips sync at 4:00 AM Pacific (between trip dates)
// Pacific timezone: UTC-8 (standard) or UTC-7 (DST)
// 4:00 AM Pacific = 12:00 PM UTC (standard time) or 11:00 AM UTC (DST)
// Use 11:00 AM UTC to ensure it runs between 3:00-4:00 AM Pacific in both cases
crons.cron(
  "daily scheduled trips sync",
  "1 11 * * *", // 11:01 AM UTC daily (covers ~4:01 AM Pacific in both DST and standard time)
  internal.functions.scheduledTrips.actions.syncScheduledTripsWindowed,
  { daysToSync: 2 } // Maintain a 2-day rolling window
);

// Daily purge of out-of-date scheduled trips at 11:00 AM UTC.
// Purges any records with DepartingTime older than 24 hours at run time.
crons.cron(
  "purge out-of-date scheduled trips",
  "0 11 * * *", // 11:00 AM UTC daily
  internal.functions.scheduledTrips.actions.purgeScheduledTripsOutOfDate,
  {}
);

// Hourly cleanup of old vessel pings.
// Deletes VesselPings records older than the configured threshold (default: 1 hour).
crons.interval(
  "cleanup old vessel pings",
  { hours: 1 }, // every hour
  internal.functions.vesselPings.actions.cleanupOldPings
);

export default crons;
