import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "update vessel trips",
  { seconds: 15 }, // every fifteen seconds
  internal.functions.activeVesselTrips.actions.updateActiveVesselTrips
);

crons.cron(
  "fetch vessel pings",
  "* * * * *", // every minute
  internal.functions.vesselPings.actions.fetchAndStoreVesselPings
);

// Register a cron job to cleanup old vessel pings every 6 hours
crons.cron(
  "cleanup old vessel pings",
  "0 * * * *", // Every hour
  internal.functions.vesselPings.actions.cleanupOldPings
);

// Register a cron job to fetch vessel locations every 5 minutes
crons.cron(
  "fetch vessel locations",
  "*/5 * * * *", // every 5 minutes
  internal.functions.vesselLocation.actions.fetchAndStoreVesselLocations
);

// Register a cron job to train prediction models weekly
// crons.cron(
//   "train prediction models",
//   "0 4 * * 0", // Every Sunday at 4 AM
//   internal.ml.actions.trainPredictionModelsAction,
//   {}
// );

export default crons;
