import { internal } from "_generated/api";
import { cronJobs } from "convex/server";

const crons = cronJobs();

crons.interval(
  "update vessel locations",
  { seconds: 10 }, // every ten seconds
  internal.functions.vesselLocation.actions.updateVesselLocations
);

crons.interval(
  "update vessel trips",
  { seconds: 10 }, // every ten seconds
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

// Weekly model retraining at 11:00 AM UTC on Mondays
// Note: Convex cron jobs run in UTC, not local timezones
crons.cron(
  "retrain ml models",
  "0 11 * * 1", // 11:00 AM UTC every Monday
  internal.domain.ml.training.actions.trainPredictionModelsAction
);

export default crons;
