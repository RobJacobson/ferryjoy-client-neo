import { defineSchema, defineTable } from "convex/server";
import { vesselLocationValidationSchema } from "./functions/vesselLocation/schemas";
import { vesselPingListValidationSchema } from "./functions/vesselPings/schemas";
import { vesselTripSchema } from "./functions/vesselTrips/schemas";

export default defineSchema({
  // Active vessel trips - frequently updated, small dataset
  activeVesselTrips: defineTable(vesselTripSchema)
    .index("by_vessel_id", ["VesselID"])
    .index("by_vessel_abbrev", ["VesselAbbrev"])
    .index("by_scheduled_departure", ["ScheduledDeparture"])
    .index("by_vessel_id_and_scheduled_departure", [
      "VesselID",
      "ScheduledDeparture",
    ])
    .index("by_timestamp", ["TimeStamp"]),

  // Completed vessel trips - static, large dataset, infrequent updates
  completedVesselTrips: defineTable(vesselTripSchema)
    .index("by_vessel_id", ["VesselID"])
    .index("by_vessel_abbrev", ["VesselAbbrev"])
    .index("by_scheduled_departure", ["ScheduledDeparture"])
    .index("by_vessel_id_and_scheduled_departure", [
      "VesselID",
      "ScheduledDeparture",
    ])
    .index("by_timestamp", ["TimeStamp"]),

  // Vessel ping collections - stores arrays of vessel pings with timestamps
  vesselPings: defineTable(vesselPingListValidationSchema).index(
    "by_timestamp",
    ["timestamp"]
  ),

  // Vessel locations combining vessel location data
  vesselLocations: defineTable(vesselLocationValidationSchema).index(
    "by_vessel_id",
    ["VesselID"]
  ),

  // Prediction model parameters
  // modelParameters: defineTable(modelParametersMutationSchema).index(
  //   "by_route_and_type",
  //   ["routeId", "modelType"]
  // ),

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
