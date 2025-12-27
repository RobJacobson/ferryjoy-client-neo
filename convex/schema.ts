import { defineSchema, defineTable } from "convex/server";
import { modelParametersMutationSchema } from "functions/predictions/schemas";
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
    .index("by_timestamp", ["TimeStamp"]),

  // Completed vessel trips - finished trips with full trip data
  completedVesselTrips: defineTable(vesselTripSchema)
    .index("by_vessel_abbrev", ["VesselAbbrev"])
    .index("by_trip_end", ["TripEnd"])
    .index("by_timestamp", ["TimeStamp"]),

  // Scheduled trips - planned ferry trips with departure/arrival times
  scheduledTrips: defineTable(scheduledTripSchema)
    .index("by_vessel", ["VesselAbbrev"])
    .index("by_departing_time", ["DepartingTime"])
    .index("by_route", ["RouteID"])
    .index("by_departing_terminal", ["DepartingTerminalAbbrev"])
    .index("by_arriving_terminal", ["ArrivingTerminalAbbrev"])
    .index("by_key", ["Key"])
    .index("by_vessel_and_departing_time", ["VesselAbbrev", "DepartingTime"])
    .index("by_route_and_departing_time", ["RouteID", "DepartingTime"]),

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

  // Prediction model parameters
  modelParameters: defineTable(modelParametersMutationSchema)
    .index("by_terminals_and_type", [
      "departingTerminalAbbrev",
      "arrivingTerminalAbbrev",
      "modelType",
    ])
    .index("by_terminals", [
      "departingTerminalAbbrev",
      "arrivingTerminalAbbrev",
    ]),

  // Historical predictions for analysis (single table with type discriminator)
  // historicalPrcedictions: defineTable(historicalPredictionDataSchema)
  //   .index("by_timestamp", ["predictionTimestamp"])
  //   .index("by_vessel_and_type", ["vesselId", "predictionType"])
  //   .index("by_route", ["opRouteAbrv"]),

  // // Current predictions for caching (single table with type discriminator)
  // currentPredictions: defineTable(currentPredictionDataSchema)
  //   .index("by_vessel_and_type", ["vesselId", "predictionType"])
  //   .index("by_route", ["opRouteAbrv"]),
});
