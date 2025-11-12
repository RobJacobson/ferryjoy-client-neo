import { defineSchema, defineTable } from "convex/server";

import { activeVesselTripSchema } from "./functions/activeVesselTrips/schemas";
import { completedVesselTripSchema } from "./functions/completedVesselTrips/schemas";
import { currentVesselLocationValidationSchema } from "./functions/currentVesselLocation/schemas";
import {
  currentPredictionDataSchema,
  historicalPredictionDataSchema,
  modelParametersMutationSchema,
} from "./functions/predictions/schemas";
import { vesselLocationValidationSchema } from "./functions/vesselLocation/schemas";
import { vesselPingCollectionValidationSchema } from "./functions/vesselPings/schemas";

export default defineSchema({
  // Active vessel trips - frequently updated, small dataset
  activeVesselTrips: defineTable(activeVesselTripSchema)
    .index("by_vessel_id", ["VesselID"])
    .index("by_timestamp", ["TimeStamp"])
    .index("by_vessel_and_timestamp", ["VesselID", "TimeStamp"]),

  // Completed vessel trips - static, large dataset, infrequent updates
  completedVesselTrips: defineTable(completedVesselTripSchema)
    .index("by_timestamp", ["TimeStamp"])
    .index("by_scheduled_departure", ["ScheduledDeparture"])
    .index("by_vessel_id_and_scheduled_departure", [
      "VesselID",
      "ScheduledDeparture",
    ]),

  // Vessel ping collections - stores arrays of vessel pings with timestamps
  vesselPings: defineTable(vesselPingCollectionValidationSchema).index(
    "by_timestamp",
    ["timestamp"]
  ),

  // Vessel locations combining vessel location data
  vesselLocations: defineTable(vesselLocationValidationSchema)
    .index("by_timestamp", ["TimeStamp"])
    .index("by_vessel_id_and_timestamp", ["VesselID", "TimeStamp"]),

  // Current vessel locations - latest position for each vessel
  currentVesselLocations: defineTable(currentVesselLocationValidationSchema)
    .index("by_vessel_id", ["VesselID"])
    .index("by_timestamp", ["TimeStamp"]),

  // Prediction model parameters
  modelParameters: defineTable(modelParametersMutationSchema).index(
    "by_route_and_type",
    ["routeId", "modelType"]
  ),

  // Historical predictions for analysis (single table with type discriminator)
  historicalPredictions: defineTable(historicalPredictionDataSchema)
    .index("by_timestamp", ["predictionTimestamp"])
    .index("by_vessel_and_type", ["vesselId", "predictionType"])
    .index("by_route", ["opRouteAbrv"]),

  // Current predictions for caching (single table with type discriminator)
  currentPredictions: defineTable(currentPredictionDataSchema)
    .index("by_vessel_and_type", ["vesselId", "predictionType"])
    .index("by_route", ["opRouteAbrv"]),
});
