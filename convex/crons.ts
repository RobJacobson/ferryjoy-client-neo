import { internal } from "_generated/api";
import { cronJobs } from "convex/server";

const crons = cronJobs();

crons.interval(
  "update vessel locations",
  { seconds: 15 }, // every ten seconds
  internal.functions.vesselLocation.actions.updateVesselLocations
);

// crons.interval(
//   "update vessel trips",
//   { seconds: 15 }, // every ten seconds
//   internal.functions.vesselTrips.actions.updateVesselTrips
// );

crons.interval(
  "fetch vessel pings",
  { seconds: 30 }, // every thirty seconds
  internal.functions.vesselPings.actions.fetchAndStoreVesselPings
);

// Weekly model retraining at 11:00 AM UTC on Mondays
// Note: Convex cron jobs run in UTC, not local timezones
crons.cron(
  "retrain ml models",
  "0 11 * * 1", // 11:00 AM UTC every Monday
  internal.domain.ml.training.actions.trainPredictionModelsAction
);

// Daily scheduled trips sync at 4:00 AM Pacific (between trip dates)
// Pacific timezone: UTC-8 (standard) or UTC-7 (DST)
// 4:00 AM Pacific = 12:00 PM UTC (standard time) or 11:00 AM UTC (DST)
// Use 11:00 AM UTC to ensure it runs between 3:00-4:00 AM Pacific in both cases
crons.cron(
  "daily scheduled trips sync",
  "0 11 * * *", // 11:00 AM UTC daily (covers 4:00 AM Pacific in both DST and standard time)
  internal.functions.scheduledTrips.actions.syncScheduledTripsWindowed,
  {}
);

export default crons;
