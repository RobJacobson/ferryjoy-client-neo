import { defineSchema, defineTable } from "convex/server";
import {
  modelConfigSchema,
  modelParametersSchema,
  predictionRecordSchema,
} from "functions/predictions/schemas";
import { scheduledTripSchema } from "functions/scheduledTrips/schemas";
import { vesselLocationValidationSchema } from "functions/vesselLocation/schemas";
import {
  vesselPingListValidationSchema,
  vesselPingValidationSchema,
} from "functions/vesselPings/schemas";
import { vesselTripSchema } from "functions/vesselTrips/schemas";

export default defineSchema({
  // Active vessel trips - currently in progress, one per vessel
  activeVesselTrips: defineTable(vesselTripSchema).index("by_vessel_abbrev", [
    "VesselAbbrev",
  ]),

  // Completed vessel trips - finished trips with full trip data
  completedVesselTrips: defineTable(vesselTripSchema)
    .index("by_vessel_and_trip_end", ["VesselAbbrev", "TripEnd"])
    .index("by_sailing_day_and_departing_terminal", [
      "SailingDay",
      "DepartingTerminalAbbrev",
    ]),

  // Scheduled trips - planned ferry trips with departure/arrival times
  scheduledTrips: defineTable(scheduledTripSchema)
    .index("by_departing_time", ["DepartingTime"])
    .index("by_key", ["Key"])
    .index("by_sailing_day", ["SailingDay"])
    .index("by_terminal_and_sailing_day", [
      "DepartingTerminalAbbrev",
      "SailingDay",
    ])
    .index("by_vessel_and_sailing_day", ["VesselAbbrev", "SailingDay"])
    .index("by_vessel_terminal_time_type", [
      "VesselAbbrev",
      "DepartingTerminalAbbrev",
      "DepartingTime",
      "TripType",
    ])
    .index("by_vessel_sailing_day_trip_type", [
      "VesselAbbrev",
      "SailingDay",
      "TripType",
    ]),

  // Vessel ping collections - stores arrays of vessel pings with timestamps
  vesselPings: defineTable(vesselPingListValidationSchema).index(
    "by_timestamp",
    ["timestamp"]
  ),

  // Individual vessel pings - stores single vessel ping per document
  vesselPing: defineTable(vesselPingValidationSchema).index("by_timestamp", [
    "TimeStamp",
  ]),

  // Vessel locations combining vessel location data
  vesselLocations: defineTable(vesselLocationValidationSchema),

  // Prediction model parameters (pair buckets)
  modelParameters: defineTable(modelParametersSchema)
    .index("by_pair_and_type", ["pairKey", "modelType"])
    .index("by_pair_type_tag", ["pairKey", "modelType", "versionTag"])
    .index("by_version_tag", ["versionTag"]),

  // Completed ML predictions - one row per completed prediction
  predictions: defineTable(predictionRecordSchema)
    .index("by_key", ["Key"])
    .index("by_key_and_type", ["Key", "PredictionType"]),

  // ML configuration - singleton table for runtime config values
  modelConfig: defineTable(modelConfigSchema).index("by_key", ["key"]),
});
