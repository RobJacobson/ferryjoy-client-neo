import { defineSchema, defineTable } from "convex/server";
import { eventsActualSchema } from "functions/eventsActual/schemas";
import { eventsPredictedSchema } from "functions/eventsPredicted/schemas";
import { eventsScheduledSchema } from "functions/eventsScheduled/schemas";
import { keyValueStoreSchema } from "functions/keyValueStore/schemas";
import {
  modelConfigSchema,
  modelParametersSchema,
  predictionRecordSchema,
} from "functions/predictions/schemas";
import { scheduledTripSchema } from "functions/scheduledTrips/schemas";
import { terminalSchema } from "functions/terminals/schemas";
import { terminalTopologySchema } from "functions/terminalsTopology/schemas";
import { vesselLocationValidationSchema } from "functions/vesselLocation/schemas";
import { historicVesselLocationValidationSchema } from "functions/vesselLocationsHistoric/schemas";
import {
  vesselPingListValidationSchema,
  vesselPingValidationSchema,
} from "functions/vesselPings/schemas";
import { vesselSchema } from "functions/vessels/schemas";
import { vesselTripSchema } from "functions/vesselTrips/schemas";

export default defineSchema({
  vessels: defineTable(vesselSchema)
    .index("by_vessel_abbrev", ["VesselAbbrev"])
    .index("by_vessel_id", ["VesselID"])
    .index("by_vessel_name", ["VesselName"]),

  terminals: defineTable(terminalSchema)
    .index("by_terminal_abbrev", ["TerminalAbbrev"])
    .index("by_terminal_id", ["TerminalID"])
    .index("by_terminal_name", ["TerminalName"]),

  terminalsTopology: defineTable(terminalTopologySchema).index(
    "by_terminal_abbrev",
    ["TerminalAbbrev"]
  ),

  // Active vessel trips - currently in progress, one per vessel
  activeVesselTrips: defineTable(vesselTripSchema)
    .index("by_vessel_abbrev", ["VesselAbbrev"])
    .index("by_route_abbrev", ["RouteAbbrev"]),

  // Completed vessel trips - finished trips with full trip data
  completedVesselTrips: defineTable(vesselTripSchema)
    .index("by_vessel_and_trip_end", ["VesselAbbrev", "TripEnd"])
    .index("by_vessel_abbrev_and_sailing_day", ["VesselAbbrev", "SailingDay"])
    .index("by_sailing_day_and_departing_terminal", [
      "SailingDay",
      "DepartingTerminalAbbrev",
    ])
    .index("by_route_abbrev_and_sailing_day", ["RouteAbbrev", "SailingDay"]),

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
    ])
    .index("by_route_abbrev_and_sailing_day", ["RouteAbbrev", "SailingDay"]),

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
  vesselLocations: defineTable(vesselLocationValidationSchema)
    .index("by_vessel_abbrev", ["VesselAbbrev"])
    .index("by_key", ["Key"]),

  vesselLocationsHistoric: defineTable(historicVesselLocationValidationSchema)
    .index("by_sailing_day", ["SailingDay"])
    .index("by_timestamp", ["TimeStamp"])
    .index("by_vessel_abbrev_and_timestamp", ["VesselAbbrev", "TimeStamp"])
    .index("by_vessel_abbrev_and_sailing_day", ["VesselAbbrev", "SailingDay"]),

  eventsScheduled: defineTable(eventsScheduledSchema)
    .index("by_key", ["Key"])
    .index("by_sailing_day", ["SailingDay"])
    .index("by_vessel_and_sailing_day", ["VesselAbbrev", "SailingDay"])
    .index("by_vessel_sailing_day_last_arrival", [
      "VesselAbbrev",
      "SailingDay",
      "IsLastArrivalOfSailingDay",
    ]),

  eventsActual: defineTable(eventsActualSchema)
    .index("by_key", ["Key"])
    .index("by_sailing_day", ["SailingDay"])
    .index("by_vessel_and_sailing_day", ["VesselAbbrev", "SailingDay"]),

  eventsPredicted: defineTable(eventsPredictedSchema)
    .index("by_key", ["Key"])
    .index("by_key_and_prediction_type", ["Key", "PredictionType"])
    .index("by_sailing_day", ["SailingDay"])
    .index("by_vessel_and_sailing_day", ["VesselAbbrev", "SailingDay"]),

  // Prediction model parameters (pair buckets)
  modelParameters: defineTable(modelParametersSchema)
    .index("by_pair_and_type", ["pairKey", "modelType"])
    .index("by_pair_type_tag", ["pairKey", "modelType", "versionTag"])
    .index("by_version_tag", ["versionTag"]),

  // Completed ML predictions - one row per completed prediction
  predictions: defineTable(predictionRecordSchema)
    .index("by_key", ["Key"])
    .index("by_key_and_type", ["Key", "PredictionType"]),

  // ML configuration - DEPRECATED, use keyValueStore instead
  // Kept temporarily for migration - remove after running migration
  modelConfig: defineTable(modelConfigSchema).index("by_key", ["key"]),

  // Key-value store for arbitrary configuration and metadata
  keyValueStore: defineTable(keyValueStoreSchema).index("by_key", ["key"]),
});
