# VesselOrchestrator - Real-Time Ferry Trip Tracking & Prediction System

The VesselOrchestrator coordinates the entire pipeline for processing vessel location data, managing ferry trip lifecycles, and generating ML-powered predictions for ferry schedules.

## System Overview

This system processes real-time vessel location updates from external APIs to maintain accurate ferry trip tracking and generate predictive analytics. The orchestrator eliminates duplicate API calls by fetching vessel locations once, then delegating to specialized processing functions with robust error isolation.

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  External API   │───▶│ VesselOrchestrator│───▶│ Vessel Location │
│ (Vessel Pings)  │    │                  │    │ Database        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Vessel Trip     │───▶│ ML Predictions  │
                       │ Updates         │    │ Database        │
                       └─────────────────┘    └─────────────────┘
```

## Architecture Components

### 1. VesselOrchestrator (`actions.ts`)
**Purpose**: Main coordination hub that fetches vessel locations and orchestrates updates.

**Key Responsibilities**:
- Fetches vessel locations from external APIs using `fetchVesselLocations()`
- Converts raw location data through multiple transformation layers
- Deduplicates locations by vessel (keeps most recent per vessel)
- Executes vessel location and trip update operations with error isolation
- Returns success/failure status for each processing branch

### 2. Vessel Location Processing (`vesselLocation/`)

**Data Flow**:
```
Raw API Data → toConvexVesselLocation() → convertConvexVesselLocation() → Deduplication → Database
```

**Key Functions**:
- **`bulkUpsert`**: Efficiently upserts vessel locations using database indexes
- **Deduplication**: Ensures only the most recent location per vessel is processed
- **Error Isolation**: Location failures don't prevent trip processing

### 3. Vessel Trip Updates (`vesselTrips/updates/`)

This is the most complex component, handling the complete lifecycle of ferry trips and ML prediction generation.

## Vessel Trip Update Flow - Detailed Pipeline

The vessel trip update system processes location changes through a sophisticated state machine that handles trip lifecycles, boundary detection, and prediction generation.

### Core Processing Loop

```
┌─────────────────────┐
│   Fetch Active      │
│      Trips          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Process Each        │
│   Location          │
└─────────┬───────────┘
          │
          ▼
    ┌─────┴─────┐
    │ Event     │
    │ Type?     │
    └─────┬─────┘
     ┌────┴────┬────┴────┐
     │First    │Trip     │Trip
     │Trip     │Boundary │Update
     ▼         ▼         ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Create   │ │Complete │ │Update   │
│New Trip │ │Old +    │ │Existing │
│         │ │Start New│ │Trip     │
└─────────┘ └─────────┘ └─────────┘
     │         │         │
     └────┬────┴────┬────┘
          ▼         ▼
    ┌─────────────┐
    │Generate     │
    │Predictions  │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │Apply DB     │
    │Changes      │
    └─────────────┘
```

### Event Types & Trip Lifecycle

The system recognizes three fundamental event types based on vessel location changes:

#### 1. **First Trip Event** (`firstTrip`)
**Trigger**: No existing active trip for the vessel
**Action**: Create initial trip record with basic location data

```typescript
if (!existingTrip) {
  const newTrip = toConvexVesselTrip(currLocation, {});
  // Returns plan with activeUpsert only
}
```

#### 2. **Trip Boundary Event** (`tripBoundary`)
**Trigger**: Vessel arrives at a different terminal (departing terminal changes)
**Action**: Complete current trip + Start new trip

```typescript
const isTripBoundary =
  existingTrip.DepartingTerminalAbbrev !== currLocation.DepartingTerminalAbbrev;

if (isTripBoundary) {
  // 1. Complete existing trip with final calculations
  // 2. Start new trip with enriched data
  // 3. Generate immediate predictions for new trip
}
```

#### 3. **Trip Update Event** (`tripUpdate`)
**Trigger**: Location changes within same terminal pair
**Action**: Update existing trip fields and refresh predictions

### Trip Update Processing Stages

Each trip update goes through multiple enrichment stages:

#### Stage 1: Location-Derived Updates (`locationEnrichment.ts`)

```
┌─────────────────┐
│ Current         │
│ Location        │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Field           │
│ Enrichment      │
└─────┬─────┬─────┘
      │     │     │
      ▼     ▼     ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│AtDock   │ │LeftDock │ │ETA      │
│Status   │ │Logic    │ │Updates  │
└─────────┘ └─────────┘ └─────────┘
      │
      ▼
┌─────────────────┐
│ Derived         │
│ Fields          │
└─────┬─────┬─────┘
      │     │     │
      ▼     ▼     ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│TripDelay│ │AtDock   │ │(Other   │
│         │ │Duration │ │Derived) │
└─────────┘ └─────────┘ └─────────┘
```

**Key Logic**:
- **AtDock Flipping**: Critical for prediction strategy changes
- **LeftDock Priority**: Complex rules for setting departure timestamps
- **Derived Calculations**: Trip delays and dock durations

#### Stage 2: Terminal Inference (`arrivalTerminalLookup.ts`)

```typescript
// When vessel arrives at dock without identified destination
if (isAtDock && !arrivingTerminal) {
  // Lookup from scheduled trips database
  const inferredTerminal = await lookupArrivalTerminalFromSchedule(ctx, trip, location);
}
```

#### Stage 3: Scheduled Trip Enrichment (`scheduledTripEnrichment.ts`)

```
┌─────────────────┐
│ Trip            │
│ Fields          │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Derive          │
│ Trip Key        │
└─────────┬───────┘
          │
          ▼
    ┌─────┴─────┐
    │ Key       │
    │ Changed?  │
    └─────┬─────┘
     ┌────┴────┐
     │         │
  ┌──▼──┐   ┌──▼──┐
  │ Yes │   │ No  │
  └─────┘   └─────┘
     │         │
     ▼         ▼
┌─────────┐ ┌─────────┐
│Clear    │ │Check    │
│Derived  │ │Throttle │
│Data     │ │         │
└─────────┘ └─────────┘
              │
              ▼
        ┌─────────┐
        │Lookup   │
        │Scheduled│
        │Trip     │
        └─────────┘
              │
              ▼
        ┌─────────┐
        │Update   │
        │Trip     │
        │Identity │
        └─────────┘
```

**Trip Key Generation**:
```typescript
const tripKey = generateTripKey(
  vesselAbbrev,
  departingTerminal,
  arrivingTerminal,
  scheduledDepartureDate
);
```

#### Stage 4: ML Prediction Generation (`vesselTripPredictions.ts`)

The system generates 5 types of predictions based on trip state:

| Prediction Type | Model | Requires LeftDock | Anchor Point |
|-----------------|-------|-------------------|-------------|
| AtDockDepartCurr | at-dock-depart-curr | No | ScheduledDeparture |
| AtDockArriveNext | at-dock-arrive-next | No | ScheduledDeparture |
| AtDockDepartNext | at-dock-depart-next | No | NextDepartingTime |
| AtSeaArriveNext | at-sea-arrive-next | Yes | LeftDock |
| AtSeaDepartNext | at-sea-depart-next | Yes | NextDepartingTime |

```
┌─────────────────────┐
│ Trip Ready for      │
│ Prediction          │
└─────────┬───────────┘
          │
          ▼
    ┌─────┴─────┐
    │ Check     │
    │ Require-  │
    │ ments     │
    └─────┬─────┘
     ┌────┴────┬────┴────┐
     │AtDock + │AtSea +  │
     │Scheduled│LeftDock │
     ▼         ▼
┌─────────┐ ┌─────────┐
│Generate │ │Generate │
│AtDock   │ │AtSea    │
│Preds    │ │Preds    │
└─────────┘ └─────────┘
     │         │
     └────┬────┴────┬────┘
          ▼         ▼
    ┌─────────────┐
    │Apply        │
    │Throttling   │
    │Rules        │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │Compute      │
    │Predictions  │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │Update Trip  │
    │Fields       │
    └─────────────┘
```

### Prediction Throttling Strategy

Predictions are throttled to balance accuracy with performance:

```typescript
const shouldPredict = (trip: ConvexVesselTrip): boolean => {
  // AtDock predictions: Every 30 seconds
  // AtSea predictions: Every 60 seconds
  // Key changes: Immediate (no throttling)
};
```

### Database Write Operations

All trip updates are batched into atomic operations:

#### `applyVesselTripsWritePlan` Mutation

```typescript
type VesselTripsWritePlan = {
  activeUpserts: ConvexVesselTrip[];           // Update existing trips
  completions: TripCompletionPlan[];           // Complete + Start operations
  departNextBackfills: DepartNextBackfillPlan[]; // Backfill previous trip actuals
}
```

**Atomic Operations**:
1. **Active Trip Upserts**: Update existing trips with new data
2. **Trip Completions**: Insert completed trip + replace active trip
3. **Depart-Next Backfills**: Update previous completed trip with actual departure times

### Prediction Records & Actualization

#### Prediction Record Creation
When predictions are generated, they're stored as database records for analysis:

```typescript
const predictionRecord = {
  Key: trip.Key,
  PredictionType: "AtDockDepartCurr",
  PredTime: predictedTimestamp,
  MinTime: confidenceIntervalMin,
  MaxTime: confidenceIntervalMax,
  MAE: modelAccuracy,
  StdDev: predictionVariance,
  Actual: undefined,        // Set when event occurs
  DeltaTotal: undefined,    // Calculated: Actual - PredTime
  DeltaRange: undefined,    // Calculated: Distance from min/max bounds
};
```

#### Prediction Actualization Events

```
┌─────────────────────┐
│ Vessel              │
│ Departs Dock        │
└─────────┬───────────┘
          │
          ▼
    ┌─────┴─────┐
    │ Event     │
    │ Type?     │
    └─────┬─────┘
     ┌────┴────┬────┴────┐
     │Current  │Next     │
     │Trip     │Trip     │
     │Departure│Departure│
     ▼         ▼
┌─────────┐ ┌─────────┐
│Actualize│ │Actualize│
│AtDock-  │ │Depart-  │
│DepartCurr│ │Next on  │
│         │ │Prev Trip│
└─────────┘ └─────────┘
     │         │
     └────┬────┴────┬────┘
          ▼         ▼
    ┌─────────────┐
    │Calculate    │
    │Deltas       │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │Store        │
    │Prediction   │
    │Record       │
    └─────────────┘
```

**Delta Calculations**:
- **DeltaTotal**: `(Actual - Predicted) / minutes`
- **DeltaRange**: Distance from prediction confidence bounds

## Error Handling & Resilience

### Error Isolation Strategy
The orchestrator ensures failures in one component don't affect others:

```typescript
// Each operation runs independently with error capture
const locationsSuccess = await updateVesselLocations(ctx, locations).catch(error => false);
const tripsSuccess = await runUpdateVesselTrips(ctx, locations).catch(error => false);
```

### Per-Vessel Failure Handling
Individual vessel processing failures don't stop the entire batch:

```typescript
for (const location of locations) {
  try {
    await processVesselLocationTick(ctx, existingTripsDict, location);
  } catch (error) {
    // Log error but continue processing other vessels
    errors.push({ vesselAbbrev: location.VesselAbbrev, error });
  }
}
```

## Performance Optimizations

### Database Efficiency
- **Batch Operations**: Multiple updates in single transactions
- **Index Utilization**: Queries use optimized database indexes
- **Lazy Loading**: Scheduled trip lookups throttled to reduce database load

### Memory Management
- **Deduplication**: Process only most recent location per vessel
- **Streaming Processing**: Handle large batches without full memory loading
- **Reference Reuse**: Share deduplicated location data between processing branches

## Data Flow Summary

```
External API
    ↓
fetchVesselLocations()
    ↓
Data Conversion Pipeline
(toConvexVesselLocation → convertConvexVesselLocation)
    ↓
Deduplication by Vessel
    ↓
┌─────────────────┬─────────────────┐
│ Location DB     │ Trip Processing │
│ (bulkUpsert)    │                 │
└─────────────────┘                 │
                                   │
Prediction Generation ←────────────┘
(at-dock + at-sea models)
    ↓
Atomic Database Writes
(active + completed trips + prediction records)
```

## Monitoring & Observability

The system provides comprehensive logging:

- **Tick Summaries**: Vessel counts, event types, prediction metrics
- **Error Reporting**: Per-vessel failures with detailed stack traces
- **Performance Metrics**: Processing times, batch sizes, success rates

```typescript
console.log("[VesselTrips] tick summary:", {
  vessels: locations.length,
  firstTripCount: stats.firstTrip,
  tripBoundaryCount: stats.tripBoundary,
  tripUpdateCount: stats.tripUpdate,
  activeUpserts: activeUpserts.length,
  completions: completions.length,
  predictionRecords: allPredictionRecords.length,
});
```

This architecture provides a robust, scalable system for real-time ferry tracking with ML-powered predictive analytics, handling the complex lifecycle of ferry trips while maintaining data consistency and system resilience.