import { internal } from "_generated/api";
import { cronJobs } from "convex/server";

const crons = cronJobs();

crons.interval(
  "update vessel orchestrator",
  { seconds: 5 }, // every 5 seconds
  internal.functions.vesselOrchestrator.actions.updateVesselOrchestrator
);

crons.interval(
  "fetch vessel pings",
  { seconds: 30 }, // every thirty seconds
  internal.functions.vesselPings.actions.fetchAndStoreVesselPings
);

crons.interval(
  "capture vessel location history",
  { minutes: 1 }, // every minute
  internal.functions.vesselLocationsHistoric.actions
    .captureHistoricVesselLocations
);

// Weekly model retraining at 11:00 AM UTC on Mondays
// Note: Convex cron jobs run in UTC, not local timezones
crons.cron(
  "retrain ml models",
  "0 11 * * 1", // 11:00 AM UTC every Monday
  internal.domain.ml.training.actions.trainPredictionModelsAction
);

// Daily scheduled trips sync near the sailing-day boundary.
// Convex cron expressions are UTC-only, so this fixed UTC time lands around
// 3:01 AM Pacific in standard time and 4:01 AM Pacific in daylight time.
// The VesselTimeline boundary-event cron below uses a stricter DST-safe local-hour guard
// because it specifically targets 3:00 AM Pacific.
crons.cron(
  "daily scheduled trips sync",
  "1 11 * * *", // 11:01 AM UTC daily (covers ~4:01 AM Pacific in both DST and standard time)
  internal.functions.scheduledTrips.actions.syncScheduledTripsWindowed,
  { daysToSync: 7 } // Maintain a 14-day rolling window
);

// Daily VesselTimeline boundary-event sync at the sailing-day boundary (~3:00 AM Pacific).
// Convex crons are UTC-only, so schedule both DST candidates and let the
// action itself run only during the Pacific 3 AM hour.
crons.cron(
  "daily VesselTimeline boundary sync (dst)",
  "5 10 * * *", // 3:05 AM PDT
  internal.functions.vesselTimeline.index.syncVesselTimelineAtSailingDayBoundary,
  { daysToSync: 2 }
);

crons.cron(
  "daily VesselTimeline boundary sync (standard)",
  "5 11 * * *", // 3:05 AM PST
  internal.functions.vesselTimeline.index.syncVesselTimelineAtSailingDayBoundary,
  { daysToSync: 2 }
);

// Daily purge of out-of-date scheduled trips at 11:00 AM UTC.
// Purges any records with DepartingTime older than 24 hours at run time.
crons.cron(
  "purge out-of-date scheduled trips",
  "0 11 * * *", // 11:00 AM UTC daily
  internal.functions.scheduledTrips.actions.purgeScheduledTripsOutOfDate,
  {}
);

// Daily purge of historic vessel locations by sailing-day retention window.
// Keeps the current sailing day plus the three immediately prior sailing days.
crons.cron(
  "purge historic vessel locations",
  "0 11 * * *", // 11:00 AM UTC daily
  internal.functions.vesselLocationsHistoric.actions
    .cleanupHistoricVesselLocations,
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
