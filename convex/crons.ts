import { internal } from "_generated/api";
import { cronJobs } from "convex/server";

const crons = cronJobs();

crons.interval(
  "update vessel locations",
  { seconds: 10 }, // every ten seconds
  internal.functions.vesselLocation.actions.updateVesselLocations
);

crons.cron(
  "update vessel trips",
  "* * * * *", // every minute
  internal.functions.vesselTrips.actions.updateVesselTrips
);

crons.interval(
  "fetch vessel pings",
  { seconds: 30 }, // every fifteen seconds
  internal.functions.vesselPings.actions.fetchAndStoreVesselPings
);

// crons.interval(
//   "fetch vessel ping",
//   { minutes: 1 }, // every minute
//   internal.functions.vesselPing.actions.fetchAndStoreVesselPing
// );

// Daily model retraining at 4:00 AM Pacific Time (training on Convex data)
crons.cron(
  "retrain ml models",
  "0 4 * * *", // 4:00 AM daily (Pacific Time)
  internal.domain.ml.actions.trainPredictionModelsAction
);

export default crons;
