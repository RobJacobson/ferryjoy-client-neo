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
  activeVesselTrips: defineTable(vesselTripSchema)
    .index("by_vessel_abbrev", ["VesselAbbrev"])
    .index("by_scheduled_departure", ["ScheduledDeparture"])
    .index("by_vessel_and_scheduled", ["VesselAbbrev", "ScheduledDeparture"])
    .index("by_timestamp", ["TimeStamp"])
    .index("by_key", ["Key"]),

  // Completed vessel trips - finished trips with full trip data
  completedVesselTrips: defineTable(vesselTripSchema)
    .index("by_vessel_abbrev", ["VesselAbbrev"])
    .index("by_trip_end", ["TripEnd"])
    .index("by_timestamp", ["TimeStamp"])
    .index("by_key", ["Key"]),

  // Scheduled trips - planned ferry trips with departure/arrival times
  scheduledTrips: defineTable(scheduledTripSchema)
    .index("by_vessel", ["VesselAbbrev"])
    .index("by_departing_time", ["DepartingTime"])
    .index("by_route", ["RouteID"])
    .index("by_departing_terminal", ["DepartingTerminalAbbrev"])
    .index("by_arriving_terminal", ["ArrivingTerminalAbbrev"])
    .index("by_key", ["Key"])
    .index("by_vessel_and_departing_time", ["VesselAbbrev", "DepartingTime"])
    .index("by_route_and_departing_time", ["RouteID", "DepartingTime"])
    .index("by_sailing_day", ["SailingDay"])
    .index("by_route_and_sailing_day", ["RouteID", "SailingDay"])
    .index("by_trip_type", ["TripType"])
    .index("by_route_and_trip_type", ["RouteID", "TripType"])
    .index("by_vessel_terminal_time_type", [
      "VesselAbbrev",
      "DepartingTerminalAbbrev",
      "DepartingTime",
      "TripType",
    ]),

  // Vessel ping collections - stores arrays of vessel pings with timestamps
  vesselPings: defineTable(vesselPingListValidationSchema).index(
    "by_timestamp",
    ["timestamp"]
  ),

  // Individual vessel pings - stores single vessel ping per document
  vesselPing: defineTable(vesselPingValidationSchema)
    .index("by_vessel_id", ["VesselID"])
    .index("by_timestamp", ["TimeStamp"])
    .index("by_vessel_id_and_timestamp", ["VesselID", "TimeStamp"]),

  // Vessel locations combining vessel location data
  vesselLocations: defineTable(vesselLocationValidationSchema).index(
    "by_vessel_id",
    ["VesselID"]
  ),

  // Prediction model parameters (pair buckets)
  modelParameters: defineTable(modelParametersSchema)
    .index("by_pair_and_type", ["pairKey", "modelType"])
    .index("by_pair_type_tag", ["pairKey", "modelType", "versionTag"])
    .index("by_version_tag", ["versionTag"]),

  // Completed ML predictions - one row per completed prediction
  predictions: defineTable(predictionRecordSchema)
    .index("by_key", ["Key"])
    .index("by_vessel_abbreviation", ["VesselAbbreviation"])
    .index("by_prediction_type", ["PredictionType"])
    .index("by_pred_time", ["PredTime"])
    .index("by_vessel_and_type", ["VesselAbbreviation", "PredictionType"]),

  // ML configuration - singleton table for runtime config values
  modelConfig: defineTable(modelConfigSchema).index("by_key", ["key"]),
});
